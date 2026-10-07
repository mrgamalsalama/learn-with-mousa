import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || 'https://zlopmqrmfhkifhpfefew.supabase.co').replace(/\/rest\/v1\/?$/, '');
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsb3BtcXJtZmhraWZocGZlZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNzMyOTcsImV4cCI6MjEwNDY0OTI5N30.JYdgZPLwUsclBDHfPk5ctZAJ1lwSddOVvGj4GruIlc4';
const supabaseServer = createClient(SUPABASE_URL, SUPABASE_KEY);

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

  // ================= Super Admin Multi-Tenant SaaS APIs =================

  // 1. استرجاع جميع المدارس مع الإحصائيات
  app.get('/api/super-admin/schools', async (_req, res) => {
    try {
      const { data: schools, error } = await supabaseServer
        .from('schools')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase schools fetch notice:', error.message);
      }

      // حساب عدد الطلاب والمعلمين
      const { data: usersData } = await supabaseServer
        .from('users')
        .select('school_id, role');

      const counts: Record<string, { students: number; teachers: number }> = {};
      (usersData || []).forEach((u: any) => {
        const sId = u.school_id || '';
        if (!counts[sId]) counts[sId] = { students: 0, teachers: 0 };
        if (u.role === 'student') counts[sId].students++;
        if (u.role === 'teacher') counts[sId].teachers++;
      });

      const schoolList = (schools && schools.length > 0) ? schools : [
        {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'مدرسة موسى النموذجية الرائدة',
          slug: 'mousa-demo',
          status: 'active',
          plan_tier: 'annual',
          subscription_start_date: new Date().toISOString(),
          subscription_end_date: new Date(Date.now() + 365 * 86400000).toISOString(),
          ai_enabled: true,
          max_students: 500,
          created_at: new Date().toISOString(),
        }
      ];

      const enriched = schoolList.map((s: any) => ({
        ...s,
        student_count: counts[s.id]?.students || 0,
        teacher_count: counts[s.id]?.teachers || 0,
      }));

      res.json({ schools: enriched });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Server error fetching schools' });
    }
  });

  // 2. إنشاء مدرسة جديدة وتحديد اشتراكها وتعيين مديرها
  app.post('/api/super-admin/schools', async (req, res) => {
    try {
      const {
        name,
        slug,
        plan_tier = 'trial',
        duration_days,
        subscription_start_date,
        subscription_end_date,
        ai_enabled = true,
        max_students = 500,
        adminName,
        admin_name,
        adminUsername,
        admin_username,
        adminPassword,
        admin_password = '123',
        adminEmail
      } = req.body || {};

      if (!name || !slug) {
        return res.status(400).json({ error: 'اسم المدرسة والـ slug مطلوبان' });
      }

      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const resolvedDays = Number(duration_days) || (plan_tier === 'trial' ? 30 : 365);
      const startDate = subscription_start_date || new Date().toISOString();
      const endDate = subscription_end_date || new Date(Date.now() + resolvedDays * 86400000).toISOString();

      const { data: newSchool, error: schoolErr } = await supabaseServer
        .from('schools')
        .insert({
          name: name.trim(),
          slug: cleanSlug,
          status: 'active',
          plan_tier,
          subscription_start_date: startDate,
          subscription_end_date: endDate,
          ai_enabled: Boolean(ai_enabled),
          max_students: Number(max_students) || 500,
        })
        .select()
        .single();

      if (schoolErr) {
        return res.status(400).json({ error: schoolErr.message });
      }

      // إنشاء حساب مدير المدرسة
      let adminCreated = null;
      const effectiveAdminUser = (adminUsername || admin_username || '').trim();
      const effectiveAdminPass = adminPassword || admin_password;
      const effectiveAdminName = adminName || admin_name || `مدير ${name}`;

      if (effectiveAdminUser && newSchool) {
        const adminId = 'adm_' + (typeof crypto !== 'undefined' ? crypto.randomUUID() : Date.now());
        const { data: adm, error: admErr } = await supabaseServer
          .from('users')
          .insert({
            id: adminId,
            school_id: newSchool.id,
            name: effectiveAdminName,
            username: effectiveAdminUser.toLowerCase(),
            password: effectiveAdminPass,
            role: 'school_admin',
            email: adminEmail || null,
            allowed_stages: ['primary', 'middle', 'high'],
            allowed_grades: ['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6'],
            allowed_tracks: ['arabic-a', 'arabic-b'],
            login_count: 0
          })
          .select()
          .single();

        if (!admErr) adminCreated = adm;
      }

      res.status(201).json({
        success: true,
        school: newSchool,
        admin: adminCreated,
        message: 'تم إنشاء المدرسة بنجاح وتفعيل اشتراكها 🌟'
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Server error creating school' });
    }
  });

  // 3. تعديل حالة المدرسة (تفعيل / تعليق / تمديد الاشتراك / تبديل الذكاء الاصطناعي)
  app.patch('/api/super-admin/schools/:id', async (req, res) => {
    try {
      const schoolId = req.params.id;
      const body = req.body || {};
      const updatePayload: Record<string, any> = {};

      if (body.status && ['active', 'suspended', 'expired'].includes(body.status)) {
        updatePayload.status = body.status;
      }

      if (typeof body.ai_enabled === 'boolean') {
        updatePayload.ai_enabled = body.ai_enabled;
      }

      if (body.subscription_end_date) {
        updatePayload.subscription_end_date = body.subscription_end_date;
      }

      if (body.plan_tier && ['trial', 'annual'].includes(body.plan_tier)) {
        updatePayload.plan_tier = body.plan_tier;
      }

      if (body.max_students) {
        updatePayload.max_students = Number(body.max_students);
      }

      const extendDays = Number(body.extendDays ?? body.extend_days);
      if (extendDays && extendDays > 0) {
        const { data: current } = await supabaseServer
          .from('schools')
          .select('subscription_end_date')
          .eq('id', schoolId)
          .maybeSingle();

        const currentEnd = current?.subscription_end_date 
          ? new Date(current.subscription_end_date).getTime() 
          : Date.now();
        const base = Math.max(currentEnd, Date.now());
        updatePayload.subscription_end_date = new Date(base + extendDays * 86400000).toISOString();
        if (updatePayload.status === 'expired' || !updatePayload.status) {
          updatePayload.status = 'active';
        }
      }

      const { data: updated, error } = await supabaseServer
        .from('schools')
        .update(updatePayload)
        .eq('id', schoolId)
        .select()
        .single();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.json({ success: true, school: updated, message: 'تم تحديث بيانات وحالة المدرسة بنجاح ✨' });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Server error updating school' });
    }
  });

  // 4. فحص حالة المدرسة للاشتراك (للاستخدام مع Middleware أو فحص الجلسة)
  app.get('/api/school-status/:schoolId', async (req, res) => {
    try {
      const schoolId = req.params.schoolId;
      const { data: school, error } = await supabaseServer
        .from('schools')
        .select('id, name, slug, status, subscription_end_date, ai_enabled')
        .eq('id', schoolId)
        .maybeSingle();

      if (error || !school) {
        return res.status(404).json({ error: 'School not found' });
      }

      const isSuspended = school.status === 'suspended';
      const isExpired = school.status === 'expired' || 
        (school.subscription_end_date && new Date(school.subscription_end_date).getTime() < Date.now());

      res.json({
        id: school.id,
        name: school.name,
        status: isSuspended ? 'suspended' : isExpired ? 'expired' : 'active',
        is_accessible: !isSuspended && !isExpired,
        ai_enabled: school.ai_enabled,
        subscription_end_date: school.subscription_end_date
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error checking school status' });
    }
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

  app.get('/api/challenge/rooms/:pin', async (req, res) => {
    const pin = (req.params.pin || '').trim();
    let room = localChallengeRooms.get(pin);
    if (!room) {
      // محاولة استرداد الغرفة من Supabase في حال إعادة تشغيل الخادم
      try {
        const { data, error } = await supabaseServer
          .from('challenge_rooms')
          .select('*')
          .eq('pin', pin)
          .maybeSingle();

        if (!error && data) {
          const settings = data.settings || {};
          const roomQuestions = (Array.isArray(data.questions) && data.questions.length > 0)
            ? data.questions
            : (Array.isArray(settings.questions) ? settings.questions : []);

          room = {
            id: data.id,
            pin: data.pin,
            quiz_id: data.quiz_id || settings.quiz_id,
            quiz_title: data.quiz_title || settings.quiz_title,
            host_id: data.host_id,
            host_name: data.host_name || settings.host_name,
            target_grade: data.target_grade || settings.target_grade,
            status: data.status,
            current_question_index: Number(data.current_question_index || 0),
            question_start_time: settings.question_start_time,
            questions: roomQuestions,
            players: normalizePlayers(data.players),
            answers_received: Array.isArray(data.answers_received) ? data.answers_received : [],
            created_at: data.created_at,
            updated_at: data.updated_at
          };
          localChallengeRooms.set(pin, room);
        }
      } catch (err) {
        console.warn('Could not fetch room from Supabase on cache miss:', err);
      }
    }

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

    // دمج اللاعبين دون فقدان أي بطل منضم مع الحفاظ على أعلى رصيد نقاط مسجل
    const existingPlayers = normalizePlayers(existing.players);
    const incomingPlayers = normalizePlayers(room.players);
    const allPlayerIds = new Set([...Object.keys(existingPlayers), ...Object.keys(incomingPlayers)]);

    // حساب الدرجات من الإجابات المدمجة
    const computedScores: Record<string, number> = {};
    mergedAnswers.forEach((a: any) => {
      if (a && a.playerId && a.isCorrect) {
        computedScores[a.playerId] = (computedScores[a.playerId] || 0) + (Number(a.points) || 0);
      }
    });

    const mergedPlayers: Record<string, any> = {};
    allPlayerIds.forEach(id => {
      const ep = existingPlayers[id];
      const ip = incomingPlayers[id];
      const base = ip || ep;
      if (!base) return;

      const maxScore = Math.max(
        Number(ep?.score || 0),
        Number(ip?.score || 0),
        Number(computedScores[id] || 0)
      );

      const maxStreak = Math.max(
        Number(ep?.streak || 0),
        Number(ip?.streak || 0)
      );

      mergedPlayers[id] = {
        ...ep,
        ...ip,
        score: maxScore,
        streak: maxStreak,
        isOnline: true
      };
    });

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
    'gemini-2.5-flash',
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ];

  const AUDIO_FALLBACK_MODELS = [
    'gemini-3.8-flash-lite-tts',
    'gemini-3.8-flash-tts',
    'gemini-3.1-flash-tts-preview',
    'gemini-3.8-flash',
  ];

  app.post('/api/gemini/generate', async (req, res) => {
    try {
      const { model = 'gemini-2.5-flash', contents, config } = req.body;
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
        candidateModels = Array.from(new Set([model, ...AUDIO_FALLBACK_MODELS]));
      } else {
        candidateModels = Array.from(new Set([model, ...TEXT_FALLBACK_MODELS]));
      }

      let lastError: any = null;

      for (const currentModel of candidateModels) {
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
          console.warn(`[Gemini Server] خطأ في النموذج ${currentModel}:`, err?.message || err);
        }
      }

      console.error('Server Gemini Error (all models failed):', lastError?.message || lastError);
      res.status(lastError?.status || 500).json({
        error: lastError?.message || 'Gemini processing failed',
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
