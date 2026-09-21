import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

let genAIClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server');
    }
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  // Local Room State Fallback (ذاكرة تخزين غرف التحدي المحلية لضمان اللعب عبر الشبكة دون انقطاع)
  const localChallengeRooms = new Map<string, any>();

  app.get('/api/challenge/rooms/:pin', (req, res) => {
    const pin = (req.params.pin || '').trim();
    const room = localChallengeRooms.get(pin);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json({ room });
  });

  app.post('/api/challenge/rooms', (req, res) => {
    const room = req.body;
    if (!room || !room.pin) {
      return res.status(400).json({ error: 'Room PIN is required' });
    }
    const cleanPin = String(room.pin).trim();
    localChallengeRooms.set(cleanPin, { ...room, pin: cleanPin });
    res.json({ status: 'ok', room });
  });

  // Gemini API Proxy with intelligent fallback across modern models
  const TEXT_FALLBACK_MODELS = [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
  ];

  app.post('/api/gemini/generate', async (req, res) => {
    try {
      const { model = 'gemini-3.8-flash', contents, config } = req.body;
      let ai: GoogleGenAI;
      try {
        ai = getAIClient();
      } catch (err: any) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY is not configured on the server. Please provide it in environment settings.',
        });
      }

    // التحقق مما إذا كان الطلب مخصصاً للصوت أو تحويل النص لكلام (TTS)
    const isAudioRequest =
      model.includes('tts') ||
      (Array.isArray(config?.responseModalities) && config.responseModalities.includes('AUDIO'));

    // تحديد قائمة النماذج المناسبة لنوع الطلب
    let candidateModels: string[];
    if (isAudioRequest) {
      candidateModels = ['gemini-3.1-flash-tts-preview'];
    } else {
      // استبعاد أي نماذج ملغاة أو غير مستقرة مثل gemini-2.5 أو gemini-flash-latest
      const cleanModel = model.includes('2.5') || model.includes('flash-latest')
        ? 'gemini-3.8-flash'
        : model;
      candidateModels = Array.from(new Set([cleanModel, ...TEXT_FALLBACK_MODELS]));
    }

    let lastError: any = null;

    for (let i = 0; i < candidateModels.length; i++) {
      const currentModel = candidateModels[i];
      // محاولة تنفيذ الطلب حتى مرتين للنموذج عند وجود ضغط لحظي
      for (let attempt = 1; attempt <= (isAudioRequest ? 2 : 1); attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: currentModel,
            contents,
            config,
          });

          return res.json({
            text: response.text || '',
            candidates: response.candidates,
            usageMetadata: response.usageMetadata,
            modelUsed: currentModel,
          });
        } catch (err: any) {
          lastError = err;
          const errMsg = err?.message || String(err || '');
          const isDemandSpike =
            err?.status === 503 ||
            err?.status === 429 ||
            errMsg.includes('503') ||
            errMsg.includes('high demand') ||
            errMsg.includes('UNAVAILABLE') ||
            errMsg.includes('RESOURCE_EXHAUSTED');

          console.warn(`[Gemini Server] محاولة ${attempt} بالنموذج ${currentModel} فشلت:`, errMsg);

          // عند حدوث ضغط مؤقت، ننتظر مهلة زمنية قصيرة قبل إعادة المحاولة أو الانتقال للنموذج البديل
          if (isDemandSpike) {
            const backoffMs = 500 + Math.floor(Math.random() * 400);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
          } else {
            // خطأ بنيوي لا يتعلق بالضغط، ننتقل فوراً للنموذج التالي
            break;
          }
        }
      }
    }

    console.error('Server Gemini Error (all models/attempts failed):', lastError?.message || lastError);
    const is503 = lastError?.status === 503 || String(lastError?.message || '').includes('503') || String(lastError?.message || '').includes('high demand');
    const userFriendlyError = is503
      ? 'خوادم الذكاء الاصطناعي تشهد ضغطاً مؤقتاً في هذه اللحظة، يرجى إعادة المحاولة بعد ثوانٍ قليلة.'
      : (lastError?.message || 'Gemini processing failed');

    res.status(lastError?.status || (is503 ? 503 : 500)).json({
      error: userFriendlyError,
    });
    } catch (topErr: any) {
      console.error('Unhandled Gemini endpoint error:', topErr);
      res.status(500).json({ error: topErr?.message || 'Server error' });
    }
  });

  // Vite middleware in development vs static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
