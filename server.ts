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

  // Gemini API Proxy with intelligent fallback across modern models
  const FALLBACK_MODELS = [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
  ];

  app.post('/api/gemini/generate', async (req, res) => {
    const { model = 'gemini-3.8-flash', contents, config } = req.body;
    const ai = getAIClient();

    // استبعاد النماذج الملغاة مثل gemini-2.5-flash تلقائياً واستبدالها بنماذج مدعومة
    const targetModel = model.includes('2.5') ? 'gemini-3.6-flash' : model;
    const candidateModels = Array.from(new Set([targetModel, ...FALLBACK_MODELS]));

    let lastError: any = null;

    for (let i = 0; i < candidateModels.length; i++) {
      const currentModel = candidateModels[i];
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
        console.warn(`[Gemini Server] فشل التوليد بالنموذج ${currentModel}:`, err?.message || err);
        // إذا كان الخطأ 503 (ضغط مؤقت) أو 404 (نموذج غير موجود) أو 429، نجرب النموذج التالي بعد انتظار وجيز
        if (i < candidateModels.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }

    console.error('Server Gemini Error (all models failed):', lastError?.message || lastError);
    res.status(lastError?.status || 500).json({
      error: lastError?.message || 'Gemini processing failed across all available models',
    });
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
