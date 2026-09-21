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

  // مساعد تطبيع اللاعبين
  const normalizePlayers = (raw: any): Record<string, any> => {
    if (!raw) return {};
    if (Array.isArray(raw)) {
      const map: Record<string, any> = {};
      raw.forEach((p: any) => {
        if (p && p.id) map[p.id] = p;
      });
      return map;
    }
    if (typeof raw === 'object') return raw;
    return {};
  };

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
    const existing = localChallengeRooms.get(cleanPin);

    if (!existing) {
      localChallengeRooms.set(cleanPin, {
        ...room,
        pin: cleanPin,
        players: normalizePlayers(room.players),
        answers_received: Array.isArray(room.answers_received) ? room.answers_received : []
      });
      return res.json({ status: 'ok', room: localChallengeRooms.get(cleanPin) });
    }

    // دمج اللاعبين دون فقدان أي بطل منضم
    const mergedPlayers = {
      ...normalizePlayers(existing.players),
      ...normalizePlayers(room.players)
    };

    // دمج الإجابات دون مسح إجابات الطلاب السابقة
    const existingAnswers = Array.isArray(existing.answers_received) ? existing.answers_received : [];
    const incomingAnswers = Array.isArray(room.answers_received) ? room.answers_received : [];
    const answerMap = new Map<string, any>();
    existingAnswers.forEach((a: any) => {
      if (a && a.playerId !== undefined) {
        answerMap.set(`${a.playerId}_${a.questionIndex}`, a);
      }
    });
    incomingAnswers.forEach((a: any) => {
      if (a && a.playerId !== undefined) {
        answerMap.set(`${a.playerId}_${a.questionIndex}`, a);
      }
    });
    const mergedAnswers = Array.from(answerMap.values());

    const isHost = room.senderRole === 'host' || !room.senderRole;
    const mergedRoom = {
      ...existing,
      ...room,
      pin: cleanPin,
      status: isHost ? (room.status || existing.status) : existing.status,
      current_question_index: isHost && typeof room.current_question_index === 'number'
        ? room.current_question_index
        : existing.current_question_index,
      question_start_time: isHost && room.question_start_time ? room.question_start_time : existing.question_start_time,
      questions: (Array.isArray(room.questions) && room.questions.length > 0) ? room.questions : existing.questions,
      players: mergedPlayers,
      answers_received: mergedAnswers
    };

    localChallengeRooms.set(cleanPin, mergedRoom);
    res.json({ status: 'ok', room: mergedRoom });
  });

  // نقطة وصول فائقة السرعة لتسجيل إجابة الطالب
  app.post('/api/challenge/rooms/:pin/answer', (req, res) => {
    const pin = (req.params.pin || '').trim();
    const { playerId, playerName, questionIndex, optionIndex, isCorrect, points, answeredAt } = req.body || {};

    if (!pin || playerId === undefined || questionIndex === undefined || optionIndex === undefined) {
      return res.status(400).json({ error: 'Missing required answer data' });
    }

    let room = localChallengeRooms.get(pin);
    if (!room) {
      room = {
        pin,
        players: {},
        answers_received: [],
        current_question_index: Number(questionIndex)
      };
    }

    const answers = Array.isArray(room.answers_received) ? [...room.answers_received] : [];
    const existingIdx = answers.findIndex((a: any) => a.playerId === playerId && Number(a.questionIndex) === Number(questionIndex));
    const newAnswerRecord = {
      playerId,
      playerName: playerName || 'بطل التحدي',
      questionIndex: Number(questionIndex),
      optionIndex: Number(optionIndex),
      isCorrect: Boolean(isCorrect),
      points: Number(points) || 0,
      answeredAt: answeredAt || Date.now()
    };

    if (existingIdx >= 0) {
      answers[existingIdx] = newAnswerRecord;
    } else {
      answers.push(newAnswerRecord);
    }
    room.answers_received = answers;

    // تحديث نقاط وسلسلة اللاعب
    const players = normalizePlayers(room.players);
    const existingPlayer = players[playerId] || {
      id: playerId,
      name: playerName || 'بطل التحدي',
      score: 0,
      streak: 0,
      isOnline: true
    };

    const newScore = (existingPlayer.score || 0) + (isCorrect ? (Number(points) || 0) : 0);
    const newStreak = isCorrect ? ((existingPlayer.streak || 0) + 1) : 0;
    players[playerId] = {
      ...existingPlayer,
      score: newScore,
      streak: newStreak,
      lastAnswer: {
        selectedIndex: Number(optionIndex),
        questionIndex: Number(questionIndex),
        isCorrect: Boolean(isCorrect),
        pointsEarned: Number(points) || 0,
        answeredAt: Date.now()
      }
    };
    room.players = players;

    localChallengeRooms.set(pin, room);
    res.json({ status: 'ok', room, answer: newAnswerRecord });
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
