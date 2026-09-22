import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Trophy, Play, Users, Sparkles, Plus, Clock, Award, Flame, CheckCircle2, 
  XCircle, RotateCcw, Volume2, VolumeX, ArrowRight, BookOpen, AlertCircle, 
  ChevronRight, BarChart3, HelpCircle, Loader2, Copy, Check, Radio, PlayCircle, Eye, LogOut,
  Sliders, Zap, Upload, ArrowUp, ArrowDown, Send, Cloud, Vote, CheckSquare, MessageSquare,
  Maximize2, Minimize2
} from 'lucide-react';
import { 
  UserProfile, GradeLevel, ArabicTrack, ChallengeQuiz, ChallengeRoom, 
  ChallengeQuestion, ChallengePlayer, ChallengePlayerAnswer, ChallengeShape, ChallengeQuestionType
} from '../types';
import { 
  getChallengeQuizzes, saveChallengeQuiz, deleteChallengeQuiz, 
  getChallengeRooms, saveChallengeRoom, syncChallengeRoomFromCloud, 
  syncChallengeQuizzesFromCloud, getChallengeRoomByPin, normalizeRoomPlayers,
  submitChallengeAnswerToCloudAndLocal, isLocalApiAvailable, disableLocalApi
} from '../storage';
import { supabase } from '../supabaseClient';
import { generateAIChallengeQuestions, autoTashkeelText } from '../geminiService';
import { SHAPE_CONFIG, DEFAULT_SHAPES, INITIAL_CHALLENGE_QUIZZES } from '../data/challengeData';
import { challengeAudio } from '../utils/challengeAudio';
import { parseQTIForChallenge } from '../utils/qtiChallengeParser';
import { checkArabicAnswerMatch, normalizeArabicText } from '../utils/arabicNorm';
import confetti from 'canvas-confetti';

export const ARABIC_OPTION_LETTERS = ['أ', 'ب', 'ج', 'د'];
export const ARABIC_OPTION_STYLES = [
  {
    letter: 'أ',
    bg: 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700',
    border: 'border-rose-700',
    badgeBg: 'bg-rose-950/60 border-rose-400/50 text-white',
    text: 'text-white',
    shadow: 'shadow-rose-950/40'
  },
  {
    letter: 'ب',
    bg: 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700',
    border: 'border-blue-700',
    badgeBg: 'bg-blue-950/60 border-blue-400/50 text-white',
    text: 'text-white',
    shadow: 'shadow-blue-950/40'
  },
  {
    letter: 'ج',
    bg: 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600',
    border: 'border-amber-600',
    badgeBg: 'bg-amber-950/60 border-amber-400/50 text-slate-950',
    text: 'text-slate-950',
    shadow: 'shadow-amber-950/40'
  },
  {
    letter: 'د',
    bg: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700',
    border: 'border-emerald-700',
    badgeBg: 'bg-emerald-950/60 border-emerald-400/50 text-white',
    text: 'text-white',
    shadow: 'shadow-emerald-950/40'
  }
];

interface MousaChallengeProps {
  currentUser: UserProfile;
  initialGrade?: GradeLevel;
  initialTrack?: ArabicTrack;
  onClose?: () => void;
}

export const MousaChallenge: React.FC<MousaChallengeProps> = ({
  currentUser,
  initialGrade = 'grade-1',
  initialTrack = 'arabic-a',
  onClose
}) => {
  const isTeacherOrAdmin = ['teacher', 'hod', 'super_admin'].includes(currentUser.role);

  // حالة التبويب الرئيسي
  const [activeTab, setActiveTab] = useState<'bank' | 'host' | 'play' | 'create'>(
    currentUser.role === 'student' ? 'play' : 'bank'
  );

  // بنك الأسئلة والتحديات
  const [quizzes, setQuizzes] = useState<ChallengeQuiz[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>(
    currentUser.role === 'student' ? (currentUser.grade || initialGrade) : initialGrade
  );

  // غرفة اللعب النشطة (سواء كان المعلم هو المضيف أو الطالب لاعب)
  const [activeRoom, setActiveRoom] = useState<ChallengeRoom | null>(null);
  const [userRoleInRoom, setUserRoleInRoom] = useState<'host' | 'player'>('player');
  const [pinInput, setPinInput] = useState('');
  const defaultPlayerName = currentUser.preferences?.anonymousInLeaderboard
    ? `بطل التحدي 🌟 (${currentUser.name.slice(0, 1)}***)`
    : (currentUser.name || '');
  const [playerNameInput, setPlayerNameInput] = useState(defaultPlayerName);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // تحديد دور المستخدم في الغرفة بفصل صارم:
  // المعلم كمضيف (Host) vs الطالب كلاعب (Player)
  const isHost = Boolean(
    activeRoom &&
    currentUser.role !== 'student' &&
    (userRoleInRoom === 'host' || activeRoom.host_id === currentUser.id) &&
    userRoleInRoom !== 'player'
  );
  const isPlayer = !isHost;

  // حالة السؤال النشط والمؤقت
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; points: number } | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // نمط سير التحدي: تحكم يدوي للمعلم خطوة بخطوة vs تحدٍّ تلقائي متتابع
  const [progressionMode, setProgressionMode] = useState<'teacher_paced' | 'auto_continuous'>('teacher_paced');
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);

  // نموذج إنشاء تحدي جديد (AI أو يدوي)
  const [creationMode, setCreationMode] = useState<'ai' | 'manual'>('ai');
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState<number>(4);
  const [aiTimeLimit, setAiTimeLimit] = useState<number>(20);
  const [aiQuestionTypeSelection, setAiQuestionTypeSelection] = useState<string>('mixed');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizQuestions, setNewQuizQuestions] = useState<ChallengeQuestion[]>([]);

  // محرر يدوي لسؤال
  const [manualQuestionType, setManualQuestionType] = useState<ChallengeQuestionType>('classic');
  const [manualQuestionText, setManualQuestionText] = useState('');
  const [manualExplanation, setManualExplanation] = useState('');
  const [manualOptions, setManualOptions] = useState<string[]>(['', '', '', '']);
  const [manualWordCloudHint, setManualWordCloudHint] = useState('');
  const [manualCorrectIndex, setManualCorrectIndex] = useState<number>(0);
  const [manualCorrectAnswerText, setManualCorrectAnswerText] = useState<string>('');
  const [manualTimeLimit, setManualTimeLimit] = useState<number>(20);
  const [isTashkeelActive, setIsTashkeelActive] = useState(false);

  // استيراد بنوك الأسئلة QTI
  const [isImportingQTI, setIsImportingQTI] = useState(false);
  const [qtiImportError, setQtiImportError] = useState<string | null>(null);
  const qtiFileInputRef = useRef<HTMLInputElement>(null);

  // حالات إجابة الطالب للأنماط التفاعلية الجديدة
  const [studentTextAnswer, setStudentTextAnswer] = useState<string>('');
  const [studentPuzzleOrder, setStudentPuzzleOrder] = useState<number[]>([0, 1, 2, 3]);
  const [lastSubmittedAnswerDetail, setLastSubmittedAnswerDetail] = useState<{
    type?: ChallengeQuestionType;
    textAnswer?: string;
    orderAnswer?: number[];
    selectedIndex?: number;
  } | null>(null);

  const timerRef = useRef<any>(null);
  const channelRef = useRef<any>(null);

  // تحميل التحديات عند البدء
  useEffect(() => {
    const loaded = getChallengeQuizzes();
    setQuizzes(loaded);
    syncChallengeQuizzesFromCloud().then(res => {
      if (res && res.length > 0) setQuizzes(res);
    });
  }, []);

  // اشتراك Realtime في غرفة اللعب المحددة عبر رمز الغرفة PIN (سحابي + محلي متكامل)
  useEffect(() => {
    if (!activeRoom || !activeRoom.pin) return;
    const roomPin = activeRoom.pin.trim();

    // دالة دمج موحدة فائقة الدقة لحماية الإجابات واللاعبين من الفقدان أو المسح
    const mergeIncomingRoom = (incoming: any, prev: ChallengeRoom | null): ChallengeRoom => {
      if (!incoming) return prev as ChallengeRoom;
      const incomingStatus = (incoming.status === 'in_progress') ? 'question_active' : (incoming.status || prev?.status || 'lobby');
      const settingsQuestions = incoming.settings?.questions;
      const questionsToUse = (Array.isArray(incoming.questions) && incoming.questions.length > 0)
        ? incoming.questions
        : ((Array.isArray(settingsQuestions) && settingsQuestions.length > 0)
          ? settingsQuestions
          : (prev?.questions || []));

      // دمج الإجابات بدقة حسب playerId ورقم السؤال
      const prevAnswers = Array.isArray(prev?.answers_received) ? prev.answers_received : [];
      const incomingAnswers = Array.isArray(incoming.answers_received) ? incoming.answers_received : [];
      const ansMap = new Map<string, any>();
      prevAnswers.forEach((a: any) => {
        if (a && a.playerId !== undefined) ansMap.set(`${a.playerId}_${a.questionIndex}`, a);
      });
      incomingAnswers.forEach((a: any) => {
        if (a && a.playerId !== undefined) ansMap.set(`${a.playerId}_${a.questionIndex}`, a);
      });
      const finalAnswers = Array.from(ansMap.values());

      // احتساب النقاط التراكمية من جميع الإجابات الصحيحة لحماية نتائج الطلاب
      const computedScores: Record<string, number> = {};
      finalAnswers.forEach((a: any) => {
        if (a && a.playerId && a.isCorrect) {
          computedScores[a.playerId] = (computedScores[a.playerId] || 0) + (Number(a.points) || 0);
        }
      });

      // دمج اللاعبين مع الحفاظ على أعلى رصيد نقاط مسجل
      const prevPlayers = prev?.players || {};
      const incomingPlayers = normalizeRoomPlayers(incoming.players);
      const allPlayerIds = new Set([
        ...Object.keys(prevPlayers),
        ...Object.keys(incomingPlayers),
        ...Object.keys(computedScores)
      ]);

      const mergedPlayers: Record<string, ChallengePlayer> = {};
      allPlayerIds.forEach(id => {
        const pp = prevPlayers[id];
        const ip = incomingPlayers[id];
        const base = ip || pp;
        if (!base) return;

        const maxScore = Math.max(
          Number(pp?.score || 0),
          Number(ip?.score || 0),
          Number(computedScores[id] || 0)
        );

        const maxStreak = Math.max(
          Number(pp?.streak || 0),
          Number(ip?.streak || 0)
        );

        mergedPlayers[id] = {
          ...pp,
          ...ip,
          score: maxScore,
          streak: maxStreak,
          isOnline: true
        };
      });

      const effectiveSettings = {
        ...(prev?.settings || {}),
        ...(incoming.settings || {}),
        progression_mode: incoming.settings?.progression_mode || prev?.settings?.progression_mode || 'teacher_paced'
      };

      return {
        ...(prev || {}),
        id: incoming.id || prev?.id,
        pin: incoming.pin || prev?.pin || roomPin,
        quiz_id: incoming.quiz_id || incoming.settings?.quiz_id || prev?.quiz_id,
        quiz_title: incoming.quiz_title || incoming.settings?.quiz_title || prev?.quiz_title,
        host_id: incoming.host_id || prev?.host_id,
        host_name: incoming.host_name || incoming.settings?.host_name || prev?.host_name,
        target_grade: incoming.target_grade || incoming.settings?.target_grade || prev?.target_grade,
        status: incomingStatus,
        current_question_index: (incoming.current_question_index !== undefined && incoming.current_question_index !== null)
          ? Number(incoming.current_question_index)
          : (prev?.current_question_index !== undefined ? Number(prev.current_question_index) : 0),
        question_start_time: incoming.settings?.question_start_time || incoming.question_start_time || prev?.question_start_time,
        questions: questionsToUse,
        players: mergedPlayers,
        answers_received: finalAnswers,
        settings: effectiveSettings,
        created_at: incoming.created_at || prev?.created_at || new Date().toISOString(),
        updated_at: incoming.updated_at || new Date().toISOString()
      };
    };

    // 1. استماع للتحديثات المحلية عبر CustomEvent
    const handleLocalUpdate = (e: any) => {
      const updated = e.detail as ChallengeRoom;
      if (updated && updated.pin === roomPin) {
        setActiveRoom(prev => mergeIncomingRoom(updated, prev));
      }
    };
    window.addEventListener('challenge_room_updated', handleLocalUpdate);

    // 2. استماع لتحديثات التخزين بين التبويبات المختلفة في نفس المتصفح
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lwm_challenge_rooms' && e.newValue) {
        try {
          const rooms: ChallengeRoom[] = JSON.parse(e.newValue);
          const found = rooms.find(r => r.pin === roomPin);
          if (found) {
            setActiveRoom(prev => mergeIncomingRoom(found, prev));
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 3. استماع لقناة البث المحلي BroadcastChannel
    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('mousa_challenge_sync') : null;
    if (bc) {
      bc.onmessage = (event) => {
        if (event.data?.type === 'ROOM_UPDATE') {
          const updated = event.data.room as ChallengeRoom;
          if (updated && updated.pin === roomPin) {
            setActiveRoom(prev => mergeIncomingRoom(updated, prev));
          }
        } else if (event.data?.type === 'ROOM_ANSWER' && event.data.pin === roomPin) {
          const ans = event.data.answer;
          if (ans) {
            setActiveRoom(prev => {
              if (!prev) return null;
              const existing = Array.isArray(prev.answers_received) ? [...prev.answers_received] : [];
              const filtered = existing.filter((a: any) => !(a.playerId === ans.playerId && Number(a.questionIndex) === Number(ans.questionIndex)));
              const updatedAnswers = [...filtered, ans];
              const players = { ...prev.players };
              if (players[ans.playerId]) {
                players[ans.playerId] = {
                  ...players[ans.playerId],
                  score: (players[ans.playerId].score || 0) + (ans.points || 0),
                  streak: ans.isCorrect ? ((players[ans.playerId].streak || 0) + 1) : 0,
                  lastAnswer: {
                    questionId: `q_${ans.questionIndex}`,
                    selectedIndex: ans.optionIndex,
                    questionIndex: ans.questionIndex,
                    isCorrect: ans.isCorrect,
                    timeTakenMs: 1000,
                    pointsEarned: ans.points,
                    answeredAt: ans.answeredAt || Date.now()
                  }
                };
              }
              return {
                ...prev,
                players,
                answers_received: updatedAnswers
              };
            });
          }
        }
      };
    }

    // 4. استماع للتحديثات السحابية عبر Supabase Realtime Channel: 'room-sync-' + roomPin
    const channelName = `room-sync-${roomPin}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'challenge_rooms',
          filter: `pin=eq.${roomPin}`
        },
        (payload) => {
          if (payload.new) {
            setActiveRoom(prev => mergeIncomingRoom(payload.new, prev));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // 5. فحص دوري استباقي احتياطي (Polling Fallback) كل 800 مللي ثانية عبر السحابة وخادم الشبكة لضمان المزامنة الفورية
    let canPollLocalServer = isLocalApiAvailable();

    const pollInterval = setInterval(async () => {
      // أ) فحص سحابي عبر Supabase
      try {
        const { data, error } = await supabase
          .from('challenge_rooms')
          .select('*')
          .eq('pin', roomPin)
          .maybeSingle();

        if (!error && data) {
          setActiveRoom(prev => mergeIncomingRoom(data, prev));
        }
      } catch {}

      // ب) فحص عبر خادم الشبكة المحلي (فقط في حال توفره وتجنباً لأخطاء 404 على Vercel)
      if (canPollLocalServer && isLocalApiAvailable()) {
        try {
          const resp = await fetch(`/api/challenge/rooms/${roomPin}`);
          if (resp.ok) {
            const json = await resp.json();
            if (json?.room) {
              setActiveRoom(prev => mergeIncomingRoom(json.room, prev));
            }
          } else if (resp.status === 404) {
            canPollLocalServer = false;
            disableLocalApi();
          }
        } catch {
          canPollLocalServer = false;
          disableLocalApi();
        }
      }
    }, 800);

    return () => {
      window.removeEventListener('challenge_room_updated', handleLocalUpdate);
      window.removeEventListener('storage', handleStorageChange);
      if (bc) bc.close();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      clearInterval(pollInterval);
    };
  }, [activeRoom?.pin]);

  // إعادة ضبط حالة إجابة الطالب فور انتقال الغرفة لسؤال جديد
  useEffect(() => {
    setSelectedOptionIndex(null);
    setHasAnswered(false);
    setAnswerResult(null);
    setStudentTextAnswer('');
    setLastSubmittedAnswerDetail(null);

    const roomQuestions = (Array.isArray(activeRoom?.questions) && activeRoom.questions.length > 0)
      ? activeRoom.questions
      : ((Array.isArray(activeRoom?.settings?.questions) && activeRoom.settings.questions.length > 0)
        ? activeRoom.settings.questions
        : []);
    const qIndex = Number(activeRoom?.current_question_index || 0);
    const currentQ = roomQuestions[qIndex];
    if (currentQ?.options) {
      // خلط مبدئي لترتيب خيارات سؤال الترتيب puzzle
      const initialIndices = currentQ.options.map((_, i) => i);
      setStudentPuzzleOrder(initialIndices);
    } else {
      setStudentPuzzleOrder([0, 1, 2, 3]);
    }
  }, [activeRoom?.current_question_index]);

  // إدارة المؤقت التنازلي التفاعلي
  useEffect(() => {
    if (!activeRoom || (activeRoom.status !== 'question_active' && activeRoom.status !== 'in_progress')) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const roomQuestions = (Array.isArray(activeRoom.questions) && activeRoom.questions.length > 0)
      ? activeRoom.questions
      : ((Array.isArray(activeRoom.settings?.questions) && activeRoom.settings.questions.length > 0)
        ? activeRoom.settings.questions
        : []);
    const qIndex = Number(activeRoom.current_question_index || 0);
    const currentQ = roomQuestions[qIndex];
    if (!currentQ) return;

    // فحص ما إذا كان الطالب قد أجاب بالفعل على هذا السؤال
    const studentAlreadyAnswered = activeRoom.answers_received?.find(
      (a: any) => a.playerId === currentUser.id && Number(a.questionIndex) === Number(qIndex)
    );
    if (studentAlreadyAnswered) {
      setHasAnswered(true);
      setSelectedOptionIndex(Number(studentAlreadyAnswered.optionIndex));
      setAnswerResult({ isCorrect: studentAlreadyAnswered.isCorrect, points: studentAlreadyAnswered.points });
    } else {
      setSelectedOptionIndex(null);
      setHasAnswered(false);
      setAnswerResult(null);
    }

    const timeLimit = currentQ.timeLimitSeconds || 20;
    const startTime = activeRoom.question_start_time || Date.now();
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const initialRemaining = Math.max(0, timeLimit - elapsed);
    setTimeLeft(initialRemaining);

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const currentElapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, timeLimit - currentElapsed);
      setTimeLeft(remaining);

      // مؤثرات صوتية
      if (!soundMuted && remaining > 0) {
        if (remaining <= 5) {
          challengeAudio.playUrgent();
        } else if (remaining <= 10) {
          challengeAudio.playTick();
        }
      }

      // انتهاء الوقت
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        // إذا كان المضيف (المعلم)، ينتقل تلقائياً لكشف النتيجة
        if (isHost) {
          handleRevealAnswer();
        }
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeRoom?.status, activeRoom?.current_question_index, activeRoom?.question_start_time, soundMuted, isHost]);

  // تشغيل الكونفيتي وصوت التتويج عند شاشة النهاية
  useEffect(() => {
    if (activeRoom?.status === 'finished') {
      if (!soundMuted) challengeAudio.playPodium();
      try {
        confetti({
          particleCount: 150,
          spread: 90,
          origin: { y: 0.6 }
        });
      } catch {}
    }
  }, [activeRoom?.status]);

  // ================= إجراءات المضيف (Host Actions) =================

  // بدء غرفة جديدة من كويز محدد
  const handleStartHosting = async (quiz: ChallengeQuiz) => {
    setUserRoleInRoom('host');
    const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
    const teacherId = currentUser.id;

    // مطابقة كائن الغرفة المرسل مع أعمدة الجدول:
    // التأكد من إرسال الحقول الأساسية فقط المتوافقة مع Supabase وحفظ الأسئلة في settings
    const essentialRoomPayload = {
      pin: generatedPin,
      host_id: teacherId,
      status: 'lobby',
      current_question_index: 0,
      players: [],
      answers_received: [],
      quiz_id: quiz.id || null,
      quiz_title: quiz.title || null,
      settings: {
        questions: quiz.questions,
        target_grade: quiz.target_grade,
        host_name: currentUser.name,
        progression_mode: progressionMode
      }
    };

    let cloudRoomId: string | null = null;
    try {
      const { data, error } = await supabase
        .from('challenge_rooms')
        .insert(essentialRoomPayload)
        .select()
        .single();

      if (error) {
        // طباعة تفاصيل الخطأ بوضوح في الكونسول
        console.error('Room creation failed:', error.message, error.details);
      } else if (data) {
        cloudRoomId = data.id || null;
      }
    } catch (err: any) {
      console.error('Room creation failed:', err?.message || err, err?.details);
    }

    // بناء الغرفة المحلية الكاملة (Local Room State) لتوفير Fallback فوري متزامن
    const roomId = cloudRoomId || `room_${Date.now()}`;
    const newRoom: ChallengeRoom = {
      id: roomId,
      pin: generatedPin,
      quiz_id: quiz.id,
      quiz_title: quiz.title,
      host_id: teacherId,
      host_name: currentUser.name,
      target_grade: quiz.target_grade,
      status: 'lobby',
      current_question_index: 0,
      questions: quiz.questions,
      players: {},
      answers_received: [],
      settings: {
        progression_mode: progressionMode
      },
      created_at: new Date().toISOString()
    };

    const saved = await saveChallengeRoom(newRoom);
    setActiveRoom(saved);
    setActiveTab('host');
  };

  // إطلاق المسابقة ونشر أول سؤال
  const handleLaunchChallenge = async () => {
    if (!activeRoom) return;
    const updated: ChallengeRoom = {
      ...activeRoom,
      status: 'question_active',
      current_question_index: 0,
      question_start_time: Date.now(),
      settings: {
        ...(activeRoom.settings || {}),
        progression_mode: progressionMode
      }
    };
    const saved = await saveChallengeRoom(updated);
    setActiveRoom(saved);
  };

  // كشف الإجابة الصحيحة وشرح موسى
  const handleRevealAnswer = async () => {
    if (!activeRoom) return;
    const roomQuestions = (Array.isArray(activeRoom.questions) && activeRoom.questions.length > 0)
      ? activeRoom.questions
      : ((Array.isArray(activeRoom.settings?.questions) && activeRoom.settings.questions.length > 0)
        ? activeRoom.settings.questions
        : []);
    const updated: ChallengeRoom = {
      ...activeRoom,
      questions: roomQuestions,
      status: 'question_revealed'
    };
    const saved = await saveChallengeRoom(updated);
    setActiveRoom(saved);
  };

  // الانتقال للوحة الصدارة
  const handleShowLeaderboard = async () => {
    if (!activeRoom) return;
    const roomQuestions = (Array.isArray(activeRoom.questions) && activeRoom.questions.length > 0)
      ? activeRoom.questions
      : ((Array.isArray(activeRoom.settings?.questions) && activeRoom.settings.questions.length > 0)
        ? activeRoom.settings.questions
        : []);
    const updated: ChallengeRoom = {
      ...activeRoom,
      questions: roomQuestions,
      status: 'leaderboard'
    };
    const saved = await saveChallengeRoom(updated);
    setActiveRoom(saved);
  };

  // الانتقال للسؤال التالي أو إنهاء المسابقة
  const handleNextQuestion = async () => {
    if (!activeRoom) return;
    const roomQuestions = (Array.isArray(activeRoom.questions) && activeRoom.questions.length > 0)
      ? activeRoom.questions
      : ((Array.isArray(activeRoom.settings?.questions) && activeRoom.settings.questions.length > 0)
        ? activeRoom.settings.questions
        : []);
    const nextIndex = (typeof activeRoom.current_question_index === 'number' ? activeRoom.current_question_index : 0) + 1;
    if (nextIndex < roomQuestions.length) {
      const updated: ChallengeRoom = {
        ...activeRoom,
        questions: roomQuestions,
        status: 'question_active',
        current_question_index: nextIndex,
        question_start_time: Date.now()
      };
      const saved = await saveChallengeRoom(updated);
      setActiveRoom(saved);
    } else {
      // نهاية التحدي والتتويج
      const updated: ChallengeRoom = {
        ...activeRoom,
        questions: roomQuestions,
        status: 'finished'
      };
      const saved = await saveChallengeRoom(updated);
      setActiveRoom(saved);
    }
  };

  // ================= إجراءات الطالب واللاعب (Player Actions) =================

  // الانضمام عبر الرمز (PIN)
  const handleJoinByPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setJoinError(null);
    const enteredPin = pinInput.trim();
    if (!enteredPin || enteredPin.length !== 6) {
      setJoinError('يرجى إدخال رمز دخول سداسي صحيح (6 أرقام)');
      return;
    }

    const cleanName = (playerNameInput || currentUser.name || '').trim();
    if (!cleanName) {
      setJoinError('يرجى كتابة اسم البطل للمشاركة في التحدي');
      return;
    }

    setIsJoining(true);
    try {
      let room: ChallengeRoom | null = null;

      // 1. في شاشة الطالب: التأكد من البحث عن الغرفة بالرمز PIN
      try {
        const { data, error } = await supabase
          .from('challenge_rooms')
          .select('*')
          .eq('pin', enteredPin.trim())
          .maybeSingle();

        if (error) {
          console.warn('Supabase room query warning:', error.message, error.details);
        } else if (data && data.status !== 'finished') {
          const localMatch = getChallengeRoomByPin(enteredPin.trim());
          const quizzes = getChallengeQuizzes();
          const quizMatch = quizzes.find(q => q.id === data.quiz_id || q.title === data.quiz_title);
          const settingsQuestions = data.settings?.questions;
          const roomQuestions = (Array.isArray(data.questions) && data.questions.length > 0)
            ? data.questions
            : ((Array.isArray(settingsQuestions) && settingsQuestions.length > 0)
                ? settingsQuestions
                : (localMatch?.questions || quizMatch?.questions || INITIAL_CHALLENGE_QUIZZES[0].questions));

          room = {
            id: data.id || localMatch?.id || `room_${Date.now()}`,
            pin: data.pin,
            quiz_id: data.quiz_id || data.settings?.quiz_id || localMatch?.quiz_id || '',
            quiz_title: data.quiz_title || data.settings?.quiz_title || localMatch?.quiz_title || 'تحدي موسى التفاعلي',
            host_id: data.host_id,
            host_name: data.host_name || data.settings?.host_name || localMatch?.host_name || 'المعلم',
            target_grade: data.target_grade || data.settings?.target_grade || localMatch?.target_grade || 'grade-1',
            status: data.status,
            current_question_index: typeof data.current_question_index === 'number' ? data.current_question_index : 0,
            questions: roomQuestions,
            players: normalizeRoomPlayers(data.players || localMatch?.players),
            answers_received: Array.isArray(data.answers_received) ? data.answers_received : [],
            question_start_time: data.settings?.question_start_time || undefined,
            created_at: data.created_at || new Date().toISOString(),
            updated_at: data.updated_at
          };
        }
      } catch (cloudErr) {
        console.warn('Cloud connection failed, trying Local Room State fallback:', cloudErr);
      }

      // 2. توفير Fallback محلي (Local Room State) في حال تعذر الاتصال بالسحابة أو عدم العثور عليها
      if (!room) {
        const localRoom = getChallengeRoomByPin(enteredPin.trim());
        if (localRoom && (localRoom.status === 'lobby' || localRoom.status === 'question_active')) {
          console.log('Using Local Room State fallback for PIN:', enteredPin.trim());
          room = localRoom;
        } else if (isLocalApiAvailable()) {
          // فحص خادم الشبكة المحلي (فقط في حال توفره)
          try {
            const resp = await fetch(`/api/challenge/rooms/${enteredPin.trim()}`);
            if (resp.ok) {
              const json = await resp.json();
              if (json?.room) {
                console.log('Using local network server fallback for PIN:', enteredPin.trim());
                room = {
                  ...json.room,
                  players: normalizeRoomPlayers(json.room.players)
                };
              }
            } else if (resp.status === 404) {
              disableLocalApi();
            }
          } catch {
            disableLocalApi();
          }
        }
      }

      if (!room) {
        setJoinError('لم يتم العثور على غرفة تحدٍّ نشطة بهذا الرمز. تأكد من المعلم.');
        setIsJoining(false);
        return;
      }

      // إضافة الطالب كلاعب في الغرفة
      const playerId = currentUser.id || `guest_${Date.now()}`;
      const existingPlayer = room.players[playerId];
      const userAvatar = (currentUser as any).avatar || '🌟';
      const updatedPlayers = {
        ...room.players,
        [playerId]: {
          id: playerId,
          name: cleanName,
          avatar: userAvatar,
          score: existingPlayer?.score || 0,
          streak: existingPlayer?.streak || 0,
          isOnline: true,
          joinedAt: existingPlayer?.joinedAt || Date.now(),
          lastAnswer: existingPlayer?.lastAnswer
        }
      };

      const updatedRoom: ChallengeRoom = {
        ...room,
        players: updatedPlayers
      };

      await saveChallengeRoom(updatedRoom);
      setActiveRoom(updatedRoom);
      setUserRoleInRoom('player');
      setActiveTab('play');
    } catch (err) {
      setJoinError('حدث خطأ أثناء الاتصال بغرفة التحدي، حاول مرة أخرى');
    } finally {
      setIsJoining(false);
    }
  };

  // مغادرة الغرفة أو إنهاؤها
  const handleLeaveRoom = () => {
    if (activeRoom && isHost) {
      if (!window.confirm('هل أنت متأكد من إنهاء جلسة التحدي لجميع الطلاب؟')) {
        return;
      }
    }
    setActiveRoom(null);
    setUserRoleInRoom('player');
    setActiveTab(isTeacherOrAdmin ? 'bank' : 'play');
  };

  // إرسال الإجابة وحساب النقاط وسرعة النقر لجميع الأنماط التفاعلية
  const handleSelectAnswer = async (
    optionIndex: number,
    extraPayload?: { textAnswer?: string; orderAnswer?: number[] }
  ) => {
    if (!activeRoom || hasAnswered) return;
    if (activeRoom.status !== 'question_active' && activeRoom.status !== 'in_progress') return;

    const roomQuestions = (Array.isArray(activeRoom.questions) && activeRoom.questions.length > 0)
      ? activeRoom.questions
      : ((Array.isArray(activeRoom.settings?.questions) && activeRoom.settings.questions.length > 0)
        ? activeRoom.settings.questions
        : []);
    const qIndex = typeof activeRoom.current_question_index === 'number' ? activeRoom.current_question_index : 0;
    const currentQ = roomQuestions[qIndex];
    const qId = currentQ?.id || `q_${qIndex}`;
    const qType: ChallengeQuestionType = currentQ?.type || 'classic';

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch {}

    setHasAnswered(true);
    setSelectedOptionIndex(optionIndex);
    setLastSubmittedAnswerDetail({
      type: qType,
      textAnswer: extraPayload?.textAnswer,
      orderAnswer: extraPayload?.orderAnswer,
      selectedIndex: optionIndex
    });

    // تقييم صحة الإجابة حسب نمط السؤال
    let isCorrect = true;
    if (currentQ) {
      if (qType === 'classic' || qType === 'true_false') {
        isCorrect = optionIndex === currentQ.correctIndex;
      } else if (qType === 'type_answer') {
        const studentText = extraPayload?.textAnswer || '';
        const acceptable = currentQ.acceptableAnswers && currentQ.acceptableAnswers.length > 0
          ? currentQ.acceptableAnswers
          : [currentQ.correctAnswerText || ''];
        isCorrect = checkArabicAnswerMatch(studentText, acceptable);
      } else if (qType === 'puzzle') {
        const studentOrder = extraPayload?.orderAnswer || [];
        const correctOrder = currentQ.correctOrder || currentQ.options.map((_, i) => i);
        isCorrect = studentOrder.length === correctOrder.length &&
          studentOrder.every((val, idx) => val === correctOrder[idx]);
      } else if (qType === 'word_cloud' || qType === 'poll') {
        // أنماط تصويت واستطلاع رأي وسحابة كلمات: كل مشاركة صحيحة ومقبولة
        isCorrect = true;
      }
    }

    const timeLimit = currentQ?.timeLimitSeconds || 20;
    const startTime = activeRoom.question_start_time || Date.now();
    const timeTakenMs = Math.max(100, Date.now() - startTime);

    // حساب النقاط بناءً على النمط والصحة والسرعة
    let points = 0;
    if (qType === 'poll' || qType === 'word_cloud') {
      points = 1000; // نقاط مشاركة وتفاعل كاملة
      if (!soundMuted) challengeAudio.playCorrect();
    } else if (isCorrect) {
      const fractionRemaining = Math.max(0, (timeLimit * 1000 - timeTakenMs) / (timeLimit * 1000));
      points = Math.round(500 + 500 * fractionRemaining);
      if (!soundMuted) challengeAudio.playCorrect();
    } else {
      if (!soundMuted) challengeAudio.playWrong();
    }

    setAnswerResult({ isCorrect, points });

    // تحديث بيانات اللاعب في الغرفة ومزامنتها
    const playerId = currentUser.id;
    const currentPlayer = activeRoom.players[playerId] || {
      id: playerId,
      name: currentUser.name || playerNameInput || 'بطل التحدي',
      avatar: (currentUser as any).avatar || '🌟',
      score: 0,
      streak: 0,
      isOnline: true,
      joinedAt: Date.now()
    };

    const newStreak = isCorrect ? (currentPlayer.streak + 1) : 0;
    const newScore = currentPlayer.score + points;

    const updatedPlayers = {
      ...activeRoom.players,
      [playerId]: {
        ...currentPlayer,
        score: newScore,
        streak: newStreak,
        lastAnswer: {
          questionId: qId,
          selectedIndex: optionIndex,
          textAnswer: extraPayload?.textAnswer,
          orderAnswer: extraPayload?.orderAnswer,
          isCorrect,
          timeTakenMs,
          pointsEarned: points,
          answeredAt: Date.now()
        }
      }
    };

    const answerRecord: any = {
      playerId,
      playerName: currentUser.name || playerNameInput || 'بطل التحدي',
      questionIndex: qIndex,
      optionIndex,
      textAnswer: extraPayload?.textAnswer,
      orderAnswer: extraPayload?.orderAnswer,
      isCorrect,
      points,
      answeredAt: Date.now()
    };

    const existingAnswers = Array.isArray(activeRoom.answers_received) ? [...activeRoom.answers_received] : [];
    const updatedAnswers = [
      ...existingAnswers.filter((a: any) => !(a.playerId === playerId && Number(a.questionIndex) === Number(qIndex))),
      answerRecord
    ];

    const updatedRoom: ChallengeRoom = {
      ...activeRoom,
      questions: roomQuestions,
      players: updatedPlayers,
      answers_received: updatedAnswers
    };

    setActiveRoom(updatedRoom);

    // إرسال الإجابة عبر طبقات المزامنة السحابية والمحلية وخادم الشبكة فوراً
    await submitChallengeAnswerToCloudAndLocal(activeRoom.pin, answerRecord, {
      score: newScore,
      streak: newStreak,
      lastAnswer: {
        questionId: qId,
        selectedIndex: optionIndex,
        textAnswer: extraPayload?.textAnswer,
        orderAnswer: extraPayload?.orderAnswer,
        questionIndex: qIndex,
        isCorrect,
        pointsEarned: points,
        answeredAt: Date.now()
      } as any
    });
  };

  // ================= توليد الأسئلة وإنشاء التحديات =================

  // توليد عبر الذكاء الاصطناعي (Gemini 2.5 Flash)
  const handleGenerateWithAI = async () => {
    if (!aiTopic.trim()) return;
    setIsGeneratingAi(true);
    try {
      // تحديد الأنماط المطلوبة بناءً على اختيار المعلم
      let targetTypes: ChallengeQuestionType[] | undefined = undefined;
      if (aiQuestionTypeSelection === 'mixed') {
        targetTypes = ['classic', 'true_false', 'puzzle', 'type_answer', 'word_cloud', 'poll'];
      } else if (aiQuestionTypeSelection === 'interactive_only') {
        targetTypes = ['true_false', 'puzzle', 'type_answer', 'word_cloud', 'poll'];
      } else {
        targetTypes = [aiQuestionTypeSelection as ChallengeQuestionType];
      }

      const generated = await generateAIChallengeQuestions({
        topic: aiTopic,
        grade: selectedGrade,
        count: aiCount,
        timeLimitSeconds: aiTimeLimit,
        questionTypes: targetTypes
      });

      if (generated && generated.length > 0) {
        setNewQuizQuestions(generated);
        setNewQuizTitle(`تَحَدِّي ${aiTopic} الذَّكِيُّ ⚡`);
      }
    } catch (err) {
      console.error('فشل التوليد:', err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // استيراد بنك أسئلة QTI ZIP
  const handleQTIFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingQTI(true);
    setQtiImportError(null);
    try {
      const result = await parseQTIForChallenge(file);
      if (result.questions.length === 0) {
        setQtiImportError('لم يتم العثور على أسئلة متوافقة داخل ملف QTI. يرجى التأكد من احتواء الملف على بنك أسئلة سليم.');
        return;
      }

      setNewQuizQuestions(prev => [...prev, ...result.questions]);
      if (!newQuizTitle.trim()) {
        setNewQuizTitle(result.quizTitle || file.name.replace(/\.[^/.]+$/, ''));
      }
    } catch (err: any) {
      console.error('فشل استيراد QTI:', err);
      setQtiImportError(err.message || 'حدث خطأ أثناء فك ضغط واستيراد ملف QTI.');
    } finally {
      setIsImportingQTI(false);
      if (e.target) e.target.value = '';
    }
  };

  // إضافة سؤال يدوي (يدعم جميع الأنماط)
  const handleAddManualQuestion = () => {
    if (!manualQuestionText.trim()) return;

    let newQ: ChallengeQuestion;

    if (manualQuestionType === 'true_false') {
      newQ = {
        id: `q_tf_${Date.now()}`,
        type: 'true_false',
        text: manualQuestionText,
        timeLimitSeconds: manualTimeLimit,
        correctIndex: manualCorrectIndex,
        explanation: manualExplanation || 'أحسنتم يا أبطال!',
        options: [
          { id: '0', text: 'صَحِيحٌ (صَوَابٌ) ✅', shape: 'diamond' },
          { id: '1', text: 'خَاطِئٌ (خَطَأٌ) ❌', shape: 'triangle' },
        ]
      };
    } else if (manualQuestionType === 'type_answer') {
      const cleanAns = manualCorrectAnswerText.trim();
      if (!cleanAns) return;
      newQ = {
        id: `q_type_${Date.now()}`,
        type: 'type_answer',
        text: manualQuestionText,
        timeLimitSeconds: manualTimeLimit,
        correctIndex: 0,
        correctAnswerText: cleanAns,
        acceptableAnswers: [cleanAns],
        explanation: manualExplanation || `الإجابة الصحيحة هي: ${cleanAns}`,
        options: []
      };
    } else if (manualQuestionType === 'puzzle') {
      const validOpts = manualOptions.filter(o => o.trim());
      if (validOpts.length < 2) return;
      newQ = {
        id: `q_puz_${Date.now()}`,
        type: 'puzzle',
        text: manualQuestionText,
        timeLimitSeconds: manualTimeLimit,
        correctIndex: 0,
        correctOrder: validOpts.map((_, i) => i),
        explanation: manualExplanation || 'ترتيب سليم ومتقن!',
        options: validOpts.map((optText, idx) => ({
          id: String(idx),
          text: optText,
          shape: DEFAULT_SHAPES[idx % DEFAULT_SHAPES.length]
        }))
      };
    } else if (manualQuestionType === 'word_cloud') {
      if (!manualQuestionText.trim()) return;
      const suggestions = manualWordCloudHint
        .split(/[,،\n]/)
        .map(w => w.trim())
        .filter(Boolean);
      newQ = {
        id: `q_cloud_${Date.now()}`,
        type: 'word_cloud',
        text: manualQuestionText,
        timeLimitSeconds: manualTimeLimit,
        correctIndex: 0,
        explanation: manualExplanation || 'سحابة كلمات تفاعلية رائعة بمشاركاتكم وتفاعلكم الذكي!',
        options: [], // سحابة الكلمات بدون خيارات مسبقة، إدخال حر من أجهزة الطلاب
        acceptableAnswers: suggestions
      };
    } else if (manualQuestionType === 'poll') {
      const validOpts = manualOptions.filter(o => o.trim());
      if (validOpts.length < 2) return;
      newQ = {
        id: `q_poll_${Date.now()}`,
        type: 'poll',
        text: manualQuestionText,
        timeLimitSeconds: manualTimeLimit,
        correctIndex: -1, // لا يوجد خيار وحيد صحيح، تصويت حر بين الخيارات
        explanation: manualExplanation || 'شكراً لمشاركتكم وتصويتكم في استطلاع الرأي!',
        options: validOpts.map((optText, idx) => ({
          id: String(idx),
          text: optText,
          shape: DEFAULT_SHAPES[idx % DEFAULT_SHAPES.length]
        }))
      };
    } else {
      // classic multiple choice
      if (manualOptions.some(o => !o.trim())) return;
      newQ = {
        id: `q_man_${Date.now()}`,
        type: 'classic',
        text: manualQuestionText,
        timeLimitSeconds: manualTimeLimit,
        correctIndex: manualCorrectIndex,
        explanation: manualExplanation || 'إجابة متميزة يا أبطال!',
        options: manualOptions.map((optText, idx) => ({
          id: String(idx),
          text: optText,
          shape: DEFAULT_SHAPES[idx]
        }))
      };
    }

    setNewQuizQuestions(prev => [...prev, newQ]);
    // إعادة تعيين الحقول
    setManualQuestionText('');
    setManualExplanation('');
    setManualOptions(['', '', '', '']);
    setManualWordCloudHint('');
    setManualCorrectAnswerText('');
    setManualCorrectIndex(0);
  };

  // التشكيل التلقائي للنص
  const handleTashkeel = async (text: string, setter: (val: string) => void) => {
    if (!text.trim()) return;
    setIsTashkeelActive(true);
    try {
      const formatted = await autoTashkeelText(text);
      setter(formatted);
    } catch (e) {
      console.warn('تعذر التشكيل:', e);
    } finally {
      setIsTashkeelActive(false);
    }
  };

  // حفظ التحدي الجديد في البنك
  const handleSaveQuiz = async () => {
    if (!newQuizTitle.trim() || newQuizQuestions.length === 0) return;

    const newQuiz: ChallengeQuiz = {
      id: `quiz_${Date.now()}`,
      title: newQuizTitle,
      teacher_id: currentUser.id,
      teacher_name: currentUser.name,
      target_grade: selectedGrade,
      target_track: initialTrack,
      topic: aiTopic || 'مسابقة لغة عربية',
      is_ai_generated: creationMode === 'ai',
      questions: newQuizQuestions,
      created_at: new Date().toISOString()
    };

    const saved = await saveChallengeQuiz(newQuiz);
    setQuizzes(prev => [saved, ...prev]);
    setActiveTab('bank');
    setNewQuizQuestions([]);
    setNewQuizTitle('');
    setAiTopic('');
  };

  // حساب درجات الطلاب الإجمالية من كافة الإجابات المؤكدة لضمان عدم ضياع أي نقطة
  const computedScores: Record<string, number> = {};
  if (Array.isArray(activeRoom?.answers_received)) {
    activeRoom.answers_received.forEach((ans: any) => {
      if (ans && ans.playerId && ans.isCorrect) {
        computedScores[ans.playerId] = (computedScores[ans.playerId] || 0) + (Number(ans.points) || 0);
      }
    });
  }

  const playersList = Object.values(activeRoom?.players || {}).map(p => ({
    ...p,
    score: Math.max(Number(p.score || 0), Number(computedScores[p.id] || 0))
  }));

  // حساب ترتيب المتصدرين
  const sortedPlayers = playersList.sort((a, b) => b.score - a.score);
  const currentPlayer = activeRoom ? {
    ...(activeRoom.players[currentUser.id] || {}),
    score: Math.max(
      Number(activeRoom.players[currentUser.id]?.score || 0),
      Number(computedScores[currentUser.id] || 0)
    )
  } as ChallengePlayer : null;
  const studentRank = sortedPlayers.findIndex(p => p.id === currentUser.id) + 1;
  const studentScore = currentPlayer?.score || 0;

  // إحصائيات إجابات السؤال الحالي
  const roomQuestions = (Array.isArray(activeRoom?.questions) && activeRoom.questions.length > 0)
    ? activeRoom.questions
    : ((Array.isArray(activeRoom?.settings?.questions) && activeRoom.settings.questions.length > 0)
      ? activeRoom.settings.questions
      : []);
  const currentQIndex = Number(activeRoom?.current_question_index || 0);
  const currentQ = roomQuestions[currentQIndex];
  const optionAnswerCounts = [0, 0, 0, 0];
  let totalAnswersCount = 0;
  if (activeRoom && currentQ) {
    const qIdx = Number(currentQIndex);
    const countedPlayerIds = new Set<string>();

    if (Array.isArray(activeRoom.answers_received)) {
      activeRoom.answers_received.forEach((ans: any) => {
        if (Number(ans.questionIndex) === qIdx) {
          const idx = Number(ans.optionIndex);
          if (idx >= 0 && idx < 4) {
            optionAnswerCounts[idx]++;
          }
          if (ans.playerId && !countedPlayerIds.has(String(ans.playerId))) {
            totalAnswersCount++;
            countedPlayerIds.add(String(ans.playerId));
          } else if (!ans.playerId) {
            totalAnswersCount++;
          }
        }
      });
    }

    if (activeRoom.players) {
      Object.values(activeRoom.players).forEach((p: any) => {
        if (p?.id && !countedPlayerIds.has(String(p.id)) && p.lastAnswer) {
          if (p.lastAnswer.questionId === currentQ.id || Number(p.lastAnswer.questionIndex) === qIdx) {
            const idx = Number(p.lastAnswer.selectedIndex);
            if (idx >= 0 && idx < 4) {
              optionAnswerCounts[idx]++;
            }
            totalAnswersCount++;
            countedPlayerIds.add(String(p.id));
          }
        }
      });
    }
  }

  // إحصائيات سحابة الكلمات التفاعلية (Word Cloud) للسؤال الحالي
  const wordCloudStats = useMemo(() => {
    if (!activeRoom || !currentQ || currentQ.type !== 'word_cloud') {
      return { words: [] as { word: string; count: number; players: string[] }[], totalSubmissions: 0, uniqueCount: 0 };
    }
    const qIdx = Number(currentQIndex);
    const freqMap = new Map<string, { word: string; count: number; players: string[] }>();
    let totalSubmissions = 0;

    const processWord = (raw: string, playerName?: string) => {
      if (!raw || typeof raw !== 'string') return;
      const tokens = raw.split(/[,،\n]/).map(t => t.trim()).filter(Boolean);
      tokens.forEach(token => {
        const clean = token.replace(/["'«»()[\]{}.,!؟]/g, '').trim();
        if (!clean) return;
        const key = clean.toLowerCase();
        totalSubmissions++;
        if (!freqMap.has(key)) {
          freqMap.set(key, { word: clean, count: 1, players: playerName ? [playerName] : [] });
        } else {
          const item = freqMap.get(key)!;
          item.count += 1;
          if (playerName && !item.players.includes(playerName)) {
            item.players.push(playerName);
          }
        }
      });
    };

    if (Array.isArray(activeRoom.answers_received)) {
      activeRoom.answers_received.forEach((a: any) => {
        if (Number(a.questionIndex) === qIdx) {
          processWord(a.textAnswer || a.selectedText || '', a.playerName);
        }
      });
    }

    if (activeRoom.players) {
      Object.values(activeRoom.players).forEach((p: any) => {
        if (p?.lastAnswer && (p.lastAnswer.questionId === currentQ.id || Number(p.lastAnswer.questionIndex) === qIdx)) {
          if (p.lastAnswer.textAnswer) {
            processWord(p.lastAnswer.textAnswer, p.name);
          }
        }
      });
    }

    const words = Array.from(freqMap.values()).sort((a, b) => b.count - a.count);
    return {
      words,
      totalSubmissions,
      uniqueCount: words.length
    };
  }, [activeRoom?.answers_received, activeRoom?.players, currentQIndex, currentQ]);

  // إحصائيات استطلاع الرأي (Poll) للسؤال الحالي
  const pollStats = useMemo(() => {
    if (!activeRoom || !currentQ || currentQ.type !== 'poll') {
      return { optionsWithVotes: [] as any[], totalVotes: 0, highestVoteIndex: -1 };
    }
    const qIdx = Number(currentQIndex);
    const options = currentQ.options || [];
    const counts = options.map(() => 0);
    let totalVotes = 0;
    const countedPlayers = new Set<string>();

    if (Array.isArray(activeRoom.answers_received)) {
      activeRoom.answers_received.forEach((a: any) => {
        if (Number(a.questionIndex) === qIdx) {
          const idx = Number(a.optionIndex);
          if (idx >= 0 && idx < counts.length) {
            counts[idx]++;
            totalVotes++;
            if (a.playerId) countedPlayers.add(String(a.playerId));
          }
        }
      });
    }

    if (activeRoom.players) {
      Object.values(activeRoom.players).forEach((p: any) => {
        if (p?.id && !countedPlayers.has(String(p.id)) && p.lastAnswer) {
          if (p.lastAnswer.questionId === currentQ.id || Number(p.lastAnswer.questionIndex) === qIdx) {
            const idx = Number(p.lastAnswer.selectedIndex);
            if (idx >= 0 && idx < counts.length) {
              counts[idx]++;
              totalVotes++;
              countedPlayers.add(String(p.id));
            }
          }
        }
      });
    }

    let maxVotes = -1;
    let highestVoteIndex = -1;
    counts.forEach((c, i) => {
      if (c > maxVotes && c > 0) {
        maxVotes = c;
        highestVoteIndex = i;
      }
    });

    const optionsWithVotes = options.map((opt, idx) => {
      const count = counts[idx] || 0;
      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      return {
        ...opt,
        count,
        pct,
        isWinner: idx === highestVoteIndex && count > 0
      };
    });

    return {
      optionsWithVotes,
      totalVotes,
      highestVoteIndex
    };
  }, [activeRoom?.answers_received, activeRoom?.players, currentQIndex, currentQ]);

  // 1. الانتقال التلقائي للأسئلة في وضع «التحدي المتتابع التلقائي» (auto_continuous)
  useEffect(() => {
    if (!isHost || !activeRoom) return;
    const isAutoMode = activeRoom.settings?.progression_mode === 'auto_continuous';

    if (activeRoom.status === 'question_revealed' && isAutoMode) {
      setAutoAdvanceCountdown(4);
      const interval = setInterval(() => {
        setAutoAdvanceCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            handleNextQuestion();
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(interval);
      };
    } else {
      setAutoAdvanceCountdown(null);
    }
  }, [activeRoom?.status, activeRoom?.current_question_index, activeRoom?.settings?.progression_mode, isHost]);

  // 2. في وضع التحدي التلقائي: إذا أجاب جميع الطلاب الحاضرين، يتم كشف الإجابة فوراً
  useEffect(() => {
    if (!isHost || !activeRoom) return;
    const isAutoMode = activeRoom.settings?.progression_mode === 'auto_continuous';
    if (!isAutoMode || (activeRoom.status !== 'question_active' && activeRoom.status !== 'in_progress')) return;

    const totalJoined = Object.keys(activeRoom.players || {}).length;
    if (totalJoined > 0 && totalAnswersCount >= totalJoined) {
      const timer = setTimeout(() => {
        handleRevealAnswer();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [totalAnswersCount, activeRoom?.status, activeRoom?.players, activeRoom?.settings?.progression_mode, isHost]);

  // 3. مزامنة وضع التحدي مع إعدادات الغرفة إذا كانت محددة
  useEffect(() => {
    if (activeRoom?.settings?.progression_mode) {
      setProgressionMode(activeRoom.settings.progression_mode);
    }
  }, [activeRoom?.settings?.progression_mode]);

  // نسخ الرمز
  const handleCopyPin = () => {
    if (activeRoom) {
      navigator.clipboard.writeText(activeRoom.pin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-slate-900 text-slate-100 font-sans select-none overflow-hidden transition-all duration-200 ${
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen rounded-none border-0 shadow-none'
          : 'h-full w-full rounded-2xl border border-slate-800 shadow-2xl relative'
      }`}
    >
      {/* شريط الرأس العلوي */}
      <header className="bg-slate-950/80 backdrop-blur-md px-4 py-3 border-b border-slate-800 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <span>تَحَدِّي مُوسَى 🏆</span>
              <span className="text-[10px] bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black px-2 py-0.5 rounded-full">
                مُبَاشِرٌ وَتَنَافُسِيٌّ
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              مسابقات اللغة العربية الحية التفاعلية مع رفيقكم الذكي موسى
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* كتم / تشغيل الصوت الحماسي */}
          <button
            onClick={() => setSoundMuted(!soundMuted)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title={soundMuted ? 'تشغيل المؤثرات الصوتية' : 'كتم المؤثرات الصوتية'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* زر ملء الشاشة للسبورة الذكية والعرض الصفي الكامل */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`p-2 rounded-xl border transition-colors flex items-center gap-1.5 text-xs font-bold ${
              isFullscreen
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title={isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة بالكامل'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">إنهاء ملء الشاشة</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 text-slate-300" />
                <span className="hidden sm:inline">ملء الشاشة</span>
              </>
            )}
          </button>

          {/* تبويبات التنقل السريع */}
          {!activeRoom && (
            <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setActiveTab('bank')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'bank' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                بنك التحديات
              </button>
              <button
                onClick={() => setActiveTab('play')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  activeTab === 'play' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>دخول برمز PIN</span>
                <Radio className="w-3 h-3 text-rose-400 animate-pulse" />
              </button>
              {isTeacherOrAdmin && (
                <button
                  onClick={() => setActiveTab('create')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    activeTab === 'create' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>توليد تحدٍّ جديد</span>
                </button>
              )}
            </div>
          )}

          {activeRoom && (
            <button
              onClick={() => {
                if (window.confirm('هل تريد بالتأكيد الخروج من غرفة التحدي؟')) {
                  setActiveRoom(null);
                  setActiveTab('bank');
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-bold border border-rose-500/30 transition"
            >
              مغادرة الغرفة
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="flex-1 overflow-y-auto p-4 relative flex flex-col">
        {/* ================= 1. بنك التحديات (Bank View) ================= */}
        {!activeRoom && activeTab === 'bank' && (
          <div className="max-w-5xl mx-auto w-full space-y-6 animate-in fade-in duration-300">
            {/* لافتة دعوة حماسية للانضمام المباشر للطلاب */}
            <div className="bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-3xl shadow-inner">
                  🎮
                </div>
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <span>هل دعاك المعلم للمنافسة الآن؟</span>
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                      LIVE
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    أدخل الرمز السداسي (PIN) المعروض على شاشة المعلم وانطلق في التحدي التنافسي!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('play')}
                className="w-full md:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <span>الانضمام بالرمز (PIN)</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </button>
            </div>

            {/* فلتر الصفوف والتصنيفات */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {(['grade-1', 'grade-2', 'grade-3', 'grade-4'] as GradeLevel[]).map(gr => (
                  <button
                    key={gr}
                    onClick={() => setSelectedGrade(gr)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition ${
                      selectedGrade === gr
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {gr === 'grade-1' ? 'الصف الأول' : gr === 'grade-2' ? 'الصف الثاني' : gr === 'grade-3' ? 'الصف الثالث' : 'الصف الرابع'}
                  </button>
                ))}
              </div>

              {isTeacherOrAdmin && (
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-emerald-600/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء / توليد تحدٍّ جديد</span>
                </button>
              )}
            </div>

            {/* قائمة كروت التحديات المتوفرة */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quizzes
                .filter(q => !selectedGrade || q.target_grade === selectedGrade)
                .map(quiz => (
                  <div
                    key={quiz.id}
                    className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500/50 rounded-2xl p-5 flex flex-col justify-between transition group shadow-lg"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg">
                          {quiz.questions.length} أسئلة
                        </span>
                        {quiz.is_ai_generated && (
                          <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> ذكاء اصطناعي
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-black text-white group-hover:text-indigo-300 transition-colors leading-relaxed">
                        {quiz.title}
                      </h4>
                      {quiz.description && (
                        <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                          {quiz.description}
                        </p>
                      )}
                      {quiz.topic && (
                        <div className="mt-3 inline-block text-[11px] font-medium bg-slate-900/60 text-slate-300 px-2 py-0.5 rounded-md">
                          📌 {quiz.topic}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-700/60 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-500">
                        {quiz.teacher_name || 'الأستاذة فاطمة'}
                      </div>

                      <div className="flex items-center gap-2">
                        {isTeacherOrAdmin && (
                          <button
                            onClick={() => handleStartHosting(quiz)}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>بَدْءُ التَّحَدِّي 🚀</span>
                          </button>
                        )}
                        {!isTeacherOrAdmin && (
                          <button
                            onClick={() => {
                              // إتاحة اللعب الفردي التدريبي للطالب
                              handleStartHosting(quiz);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>تَدْرِيبٌ فَرْدِيٌّ</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ================= 2. شاشة الانضمام برمز PIN (Play Join View) ================= */}
        {!activeRoom && activeTab === 'play' && (
          <div className="max-w-md mx-auto w-full my-auto py-8 animate-in zoom-in-95 duration-200">
            <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 md:p-8 shadow-2xl text-center backdrop-blur-xl">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-rose-500 to-indigo-600 mx-auto flex items-center justify-center text-3xl shadow-lg shadow-rose-500/20 mb-4">
                ⚡
              </div>

              <h3 className="text-xl font-black text-white">
                دُخُولُ «تَحَدِّي مُوسَى»
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                أدخل رمز المسابقة السداسي واسمك لتظهر فوراً في ساحة الأبطال!
              </p>

              {joinError && (
                <div className="mt-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2 text-right">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{joinError}</span>
                </div>
              )}

              <form onSubmit={handleJoinByPin} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 text-right mb-1">
                    رَمْزُ الدُّخُولِ السُّدَاسِيُّ (PIN):
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="مثال: 829410"
                    className="w-full text-center text-3xl tracking-widest font-mono font-black py-3 px-4 rounded-2xl bg-slate-900 border-2 border-slate-700 focus:border-amber-400 text-amber-400 placeholder:text-slate-600 focus:outline-hidden transition"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 text-right mb-1">
                    اسْمُ البَطَلِ:
                  </label>
                  <input
                    type="text"
                    value={playerNameInput}
                    onChange={(e) => setPlayerNameInput(e.target.value)}
                    placeholder="اكتب اسمك الثلاثي أو المستعار..."
                    className="w-full py-3 px-4 text-center font-bold text-sm rounded-2xl bg-slate-900 border border-slate-700 focus:border-indigo-400 text-white placeholder:text-slate-600 focus:outline-hidden transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isJoining || pinInput.length !== 6 || !playerNameInput.trim()}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-black text-base shadow-lg shadow-emerald-500/20 transition-transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>جَارٍ الانْضِمَامُ...</span>
                    </>
                  ) : (
                    <>
                      <span>انْضَمَّ إِلَى السَّاحَةِ 🚀</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-700/60 flex items-center justify-center gap-2">
                <button
                  onClick={() => setActiveTab('bank')}
                  className="text-xs text-slate-400 hover:text-white transition"
                >
                  ← العودة لبنك التحديات
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 3. شاشة إنشاء وتوليد تحدي جديد (AI / Manual) ================= */}
        {!activeRoom && activeTab === 'create' && isTeacherOrAdmin && (
          <div className="max-w-3xl mx-auto w-full py-4 space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>صَانِعُ تَحَدِّيَاتِ مُوسَى التَّنَافُسِيَّةِ</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  أنشئ مسابقة حماسية بضغطة زر عبر ذكاء Gemini أو اضبطها يدوياً
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  ref={qtiFileInputRef}
                  onChange={handleQTIFileChange}
                  accept=".zip,application/zip,application/x-zip-compressed"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => qtiFileInputRef.current?.click()}
                  disabled={isImportingQTI}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  title="استيراد بنك أسئلة قياسي من ملف QTI ZIP"
                >
                  {isImportingQTI ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{isImportingQTI ? 'جَارٍ الاسْتِيرَاد...' : 'اسْتِيرَاد QTI (.zip)'}</span>
                </button>

                <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                  <button
                    onClick={() => setCreationMode('ai')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      creationMode === 'ai' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>توليد ذكي (AI)</span>
                  </button>
                  <button
                    onClick={() => setCreationMode('manual')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      creationMode === 'manual' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>إدخال يدوي</span>
                  </button>
                </div>
              </div>
            </div>

            {/* تنبيه خطأ استيراد QTI إن وُجد */}
            {qtiImportError && (
              <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{qtiImportError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setQtiImportError(null)}
                  className="text-rose-400 hover:text-white text-xs underline mr-2"
                >
                  إغلاق
                </button>
              </div>
            )}

            {/* نمط التوليد الذكي عبر الذكاء الاصطناعي */}
            {creationMode === 'ai' && (
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-xl">
                <div>
                  <label className="block text-xs font-black text-slate-200 mb-1.5">
                    مَوْضُوعُ الدَّرْسِ أَوِ المَهَارَةِ المُسْتَهْدَفَةِ:
                  </label>
                  <input
                    type="text"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="مثال: المبتدأ والخبر، همزة الوصل والقطع، اللام الشمسية والقمرية..."
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-700 focus:border-indigo-400 text-white placeholder:text-slate-500 font-bold text-sm focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      الصف الدراسي:
                    </label>
                    <select
                      value={selectedGrade}
                      onChange={(e) => setSelectedGrade(e.target.value as GradeLevel)}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-hidden"
                    >
                      <option value="grade-1">الصف الأول الابتدائي</option>
                      <option value="grade-2">الصف الثاني الابتدائي</option>
                      <option value="grade-3">الصف الثالث الابتدائي</option>
                      <option value="grade-4">الصف الرابع الابتدائي</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      عَدَدُ الأَسْئِلَةِ:
                    </label>
                    <select
                      value={aiCount}
                      onChange={(e) => setAiCount(Number(e.target.value))}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-hidden"
                    >
                      <option value={3}>3 أسئلة سريعة</option>
                      <option value={4}>4 أسئلة (مثالي)</option>
                      <option value={5}>5 أسئلة شاملة</option>
                      <option value={6}>6 أسئلة غنية</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      مؤقت الإجابة لكل سؤال:
                    </label>
                    <select
                      value={aiTimeLimit}
                      onChange={(e) => setAiTimeLimit(Number(e.target.value))}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-hidden"
                    >
                      <option value={15}>15 ثانية (سريع جداً)</option>
                      <option value={20}>20 ثانية (متوازن)</option>
                      <option value={30}>30 ثانية (للتفكير الهادئ)</option>
                    </select>
                  </div>
                </div>

                {/* نمط الأسئلة المراد توليدها بالذكاء الاصطناعي */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>الأَنْمَاطُ التَّفَاعُلِيَّةُ المَطْلُوبُ تَوْلِيدُهَا:</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {aiQuestionTypeSelection === 'mixed'
                        ? 'توليد مشكل يشمل جميع الأنماط'
                        : aiQuestionTypeSelection === 'interactive_only'
                        ? 'الأنماط الحديثة فقط (بدون الكلاسيكي)'
                        : 'نمط محدد مخصص'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
                    {[
                      { id: 'mixed', label: 'شامل كل الأنماط 🌟', icon: Sparkles, badge: 'موصى به' },
                      { id: 'interactive_only', label: 'أنماط حديثة فقط 🚀', icon: Zap },
                      { id: 'classic', label: 'كلاسيكي (4 خيارات)', icon: CheckSquare },
                      { id: 'true_false', label: 'صح أم خطأ', icon: CheckCircle2 },
                      { id: 'puzzle', label: 'سباق الترتيب', icon: Sliders },
                      { id: 'type_answer', label: 'اكتب الإجابة', icon: MessageSquare },
                      { id: 'word_cloud', label: 'سحابة كلمات', icon: Cloud },
                      { id: 'poll', label: 'استطلاع رأي', icon: Vote }
                    ].map(item => {
                      const Icon = item.icon;
                      const isSelected = aiQuestionTypeSelection === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setAiQuestionTypeSelection(item.id)}
                          className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer relative ${
                            isSelected
                              ? 'bg-gradient-to-b from-indigo-600/40 to-purple-600/30 border-indigo-400 text-amber-300 ring-2 ring-indigo-500/50 shadow-md'
                              : 'bg-slate-900/70 border-slate-700/80 text-slate-400 hover:text-white hover:border-slate-600'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />
                          <span className="text-[10.5px] font-bold leading-tight">{item.label}</span>
                          {item.badge && (
                            <span className="absolute -top-1.5 -right-1 px-1 py-0.2 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleGenerateWithAI}
                    disabled={isGeneratingAi || !aiTopic.trim()}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isGeneratingAi ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                        <span>جَارٍ تَأْلِيفُ الأَسْئِلَةِ وَضَبْطُ التَّشْكِيلِ بِالذَّكَاءِ الاصْطِنَاعِيِّ...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>تَوْلِيدُ تَحَدِّي مُوسَى الآنَ 🚀</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* نمط الإدخال اليدوي */}
            {creationMode === 'manual' && (
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-xl">
                {/* اختيار نمط السؤال التفاعلي */}
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-2">
                    نَمَطُ السُّؤَالِ التَّفَاعُلِيِّ:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {[
                      { id: 'classic', label: 'كلاسيكي (4 خيارات)', icon: CheckSquare },
                      { id: 'true_false', label: 'صح أم خطأ', icon: CheckCircle2 },
                      { id: 'puzzle', label: 'سباق الترتيب', icon: Sliders },
                      { id: 'type_answer', label: 'اكتب الإجابة', icon: MessageSquare },
                      { id: 'word_cloud', label: 'سحابة كلمات', icon: Cloud },
                      { id: 'poll', label: 'استطلاع رأي', icon: Vote }
                    ].map(t => {
                      const Icon = t.icon;
                      const isSelected = manualQuestionType === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setManualQuestionType(t.id as any)}
                          className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600/30 border-indigo-400 text-amber-300 ring-2 ring-indigo-500/40'
                              : 'bg-slate-900/60 border-slate-700/80 text-slate-400 hover:text-white hover:border-slate-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-[11px] font-bold leading-tight">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black text-slate-200">
                      نَصُّ السُّؤَالِ (مَشْكُولٌ):
                    </label>
                    <button
                      type="button"
                      onClick={() => handleTashkeel(manualQuestionText, setManualQuestionText)}
                      disabled={isTashkeelActive || !manualQuestionText.trim()}
                      className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>تشكيل تلقائي بالحركات</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={manualQuestionText}
                    onChange={(e) => setManualQuestionText(e.target.value)}
                    placeholder="مثال: مَا هُمَا الرُّكْنَانِ الأَسَاسِيَّانِ فِي الجُمْلَةِ الاسْمِيَّةِ؟"
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-700 focus:border-indigo-400 text-white placeholder:text-slate-500 font-bold text-sm focus:outline-hidden"
                  />
                </div>

                {/* واجهة إدخال الخيارات حسب نمط السؤال المحدد */}
                {manualQuestionType === 'true_false' && (
                  <div className="space-y-2">
                    <span className="block text-xs font-black text-slate-300">
                      حَدِّدِ الإِجَابَةَ الصَّحِيحَةَ:
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setManualCorrectIndex(0)}
                        className={`p-4 rounded-xl border-2 font-black text-sm transition flex items-center justify-center gap-2 ${
                          manualCorrectIndex === 0
                            ? 'bg-blue-600/30 border-blue-400 text-blue-300 ring-2 ring-blue-500/40'
                            : 'bg-slate-900/60 border-slate-700 text-slate-400'
                        }`}
                      >
                        <span>🔷 صَوَابٌ (صَحِيحٌ)</span>
                        {manualCorrectIndex === 0 && <Check className="w-4 h-4 text-blue-300" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualCorrectIndex(1)}
                        className={`p-4 rounded-xl border-2 font-black text-sm transition flex items-center justify-center gap-2 ${
                          manualCorrectIndex === 1
                            ? 'bg-rose-600/30 border-rose-400 text-rose-300 ring-2 ring-rose-500/40'
                            : 'bg-slate-900/60 border-slate-700 text-slate-400'
                        }`}
                      >
                        <span>🔺 خَطَأٌ (غَيْرُ صَحِيحٍ)</span>
                        {manualCorrectIndex === 1 && <Check className="w-4 h-4 text-rose-300" />}
                      </button>
                    </div>
                  </div>
                )}

                {manualQuestionType === 'type_answer' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-300">
                      الإِجَابَةُ الصَّحِيحَةُ المَعْتَمَدَةُ (النص الدقيق المقبول):
                    </label>
                    <input
                      type="text"
                      value={manualCorrectAnswerText}
                      onChange={(e) => setManualCorrectAnswerText(e.target.value)}
                      placeholder="مثال: الفاعل، مفعول به، اسم مجرور..."
                      className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-emerald-500/60 text-emerald-300 placeholder:text-slate-500 font-bold text-sm focus:outline-hidden"
                    />
                    <p className="text-[11px] text-slate-400">
                      💡 سيقوم النظام تلقائياً بتطبيع التشكيل والهمزات والتاء المربوطة لضمان العدالة للطلاب.
                    </p>
                  </div>
                )}

                {manualQuestionType === 'puzzle' && (
                  <div className="space-y-2.5">
                    <span className="block text-xs font-black text-slate-300">
                      أَدْخِلِ الكَلِمَاتِ بِالتَّرْتِيبِ الصَّحِيحِ (سيقوم النظام بخلطها للطلاب):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {manualOptions.map((opt, idx) => (
                        <div key={idx} className="p-3 rounded-xl border border-slate-700 bg-slate-900/60 flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-mono font-black text-xs shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const updated = [...manualOptions];
                              updated[idx] = e.target.value;
                              setManualOptions(updated);
                            }}
                            placeholder={`العنصر رقم ${idx + 1} بالترتيب الصحيح`}
                            className="flex-1 bg-transparent text-white text-xs font-bold focus:outline-hidden"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {manualQuestionType === 'word_cloud' && (
                  <div className="p-4 rounded-2xl bg-sky-950/30 border border-sky-500/30 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black text-sky-300">
                      <Cloud className="w-4 h-4 text-sky-400" />
                      <span>إِعْدَادُ سَحَابَةِ الكَلِمَاتِ الحَيَّةِ:</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      سحابة الكلمات تسمح لجميع الطلاب بكتابة كلماتهم وتعبيراتهم بحرية من أجهزتهم لتتطاير وتظهر مباشرة بحجم يتناسب مع تكرارها على الشاشة. لا تحتاج لتحديد خيارات مسبقة.
                    </p>
                    <div className="space-y-1.5 pt-1">
                      <label className="block text-[11px] font-bold text-sky-200">
                        كلمات مقترحة أو تلميحات أولية للطلاب (اختياري - مفصولة بفواصل):
                      </label>
                      <input
                        type="text"
                        value={manualWordCloudHint}
                        onChange={(e) => setManualWordCloudHint(e.target.value)}
                        placeholder="مثال: الشجاعة، الصدق، الأمانة، الوفاء..."
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 font-bold text-xs focus:outline-hidden focus:border-sky-400"
                      />
                    </div>
                  </div>
                )}

                {manualQuestionType === 'poll' && (
                  <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <div className="flex items-center gap-2 text-xs font-black text-indigo-300">
                        <Vote className="w-4 h-4 text-indigo-400" />
                        <span>خِيَارَاتُ اسْتِطْلاعِ الرَّأْيِ وَالتَّصْوِيتِ (2 - 4 خيارات):</span>
                      </div>
                      <span className="text-[11px] text-indigo-200/80 font-medium">
                        (تصويت ديمقراطي حر دون إجابة صحيحة واحدة)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {manualOptions.map((opt, idx) => {
                        const style = ARABIC_OPTION_STYLES[idx] || ARABIC_OPTION_STYLES[0];
                        return (
                          <div
                            key={idx}
                            className="p-3 rounded-xl border border-slate-700 bg-slate-900/70 flex items-center gap-2"
                          >
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm text-white shadow-xs ${style.bg}`}>
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const updated = [...manualOptions];
                                updated[idx] = e.target.value;
                                setManualOptions(updated);
                              }}
                              placeholder={`خيار التصويت ${idx + 1}`}
                              className="flex-1 bg-transparent text-white text-xs font-bold focus:outline-hidden placeholder:text-slate-500"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {manualQuestionType === 'classic' && (
                  <div className="space-y-2.5">
                    <span className="block text-xs font-black text-slate-300">
                      الخِيَارَاتُ الأَرْبَعَةُ التَّنَافُسِيَّةُ (حَدِّدِ الإِجَابَةَ الصَّحِيحَةَ):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {manualOptions.map((opt, idx) => {
                        const shape = DEFAULT_SHAPES[idx];
                        const cfg = SHAPE_CONFIG[shape];
                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border flex items-center gap-2 ${
                              manualCorrectIndex === idx
                                ? 'bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/40'
                                : 'bg-slate-900/60 border-slate-700'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setManualCorrectIndex(idx)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-base shadow-sm ${cfg.bgClass} ${cfg.textClass}`}
                              title="انقر لتحديد هذا الخيار كإجابة صحيحة"
                            >
                              {cfg.symbol}
                            </button>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const updated = [...manualOptions];
                                updated[idx] = e.target.value;
                                setManualOptions(updated);
                              }}
                              placeholder={`الخيار ${idx + 1} (${cfg.name} - ${cfg.colorName})`}
                              className="flex-1 bg-transparent text-white text-xs font-bold focus:outline-hidden"
                            />
                            <input
                              type="radio"
                              name="correctOption"
                              checked={manualCorrectIndex === idx}
                              onChange={() => setManualCorrectIndex(idx)}
                              className="w-4 h-4 text-emerald-500 accent-emerald-500 cursor-pointer"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    شَرْحُ مُوسَى التَّرْبَوِيُّ عِنْدَ كَشْفِ النَّتِيجَةِ:
                  </label>
                  <input
                    type="text"
                    value={manualExplanation}
                    onChange={(e) => setManualExplanation(e.target.value)}
                    placeholder="مثال: تتكون الجملة الاسمية من مبتدأ وخبر دائماً..."
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-medium focus:outline-hidden"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddManualQuestion}
                  disabled={
                    !manualQuestionText.trim() ||
                    (manualQuestionType === 'type_answer' && !manualCorrectAnswerText.trim()) ||
                    (manualQuestionType === 'classic' && manualOptions.some(o => !o.trim())) ||
                    (manualQuestionType === 'poll' && manualOptions.filter(o => o.trim()).length < 2) ||
                    (manualQuestionType === 'puzzle' && manualOptions.filter(o => o.trim()).length < 2)
                  }
                  className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>إِضَافَةُ هَذَا السُّؤَالِ إِلَى القَائِمَةِ</span>
                </button>
              </div>
            )}

            {/* معاينة الأسئلة المولدة أو المضافة */}
            {newQuizQuestions.length > 0 && (
              <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-black text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>أَسْئِلَةُ التَّحَدِّي ({newQuizQuestions.length} أسئلة جاهزة)</span>
                  </h4>
                  <div className="w-1/2">
                    <input
                      type="text"
                      value={newQuizTitle}
                      onChange={(e) => setNewQuizTitle(e.target.value)}
                      placeholder="عنوان التحدي..."
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-amber-400 text-xs font-black text-right focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {newQuizQuestions.map((q, qIdx) => (
                    <div
                      key={q.id}
                      className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4 space-y-2 text-right"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-amber-400">سؤال {qIdx + 1} ({q.timeLimitSeconds} ثانية)</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-indigo-300 border border-slate-700">
                            {q.type === 'true_false' ? 'صح أم خطأ' :
                             q.type === 'puzzle' ? 'سباق الترتيب' :
                             q.type === 'type_answer' ? 'اكتب الإجابة' :
                             q.type === 'word_cloud' ? 'سحابة كلمات' :
                             q.type === 'poll' ? 'استطلاع رأي' : 'كلاسيكي'}
                          </span>
                        </div>
                        <button
                          onClick={() => setNewQuizQuestions(prev => prev.filter((_, idx) => idx !== qIdx))}
                          className="text-rose-400 hover:text-rose-300 transition"
                        >
                          حذف
                        </button>
                      </div>
                      <p className="text-sm font-black text-white">{q.text}</p>

                      {q.type === 'type_answer' ? (
                        <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                          <span>الإجابة الصحيحة المقبولة:</span>
                          <span className="text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700 font-mono">
                            {q.correctAnswerText || q.acceptableAnswers?.[0] || 'غير محدد'}
                          </span>
                        </div>
                      ) : q.type === 'word_cloud' ? (
                        <div className="p-2.5 rounded-lg bg-sky-950/40 border border-sky-500/40 text-sky-300 text-xs font-bold flex items-center gap-2">
                          <Cloud className="w-4 h-4 text-sky-400" />
                          <span>سحابة كلمات تفاعلية مفتوحة لإجابات الطلاب التشاركية (بدون خيارات مسبقة).</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {q.options.map((opt, oIdx) => {
                            const cfg = SHAPE_CONFIG[opt.shape] || SHAPE_CONFIG['triangle'];
                            const isCorrect = q.type === 'puzzle' || q.type === 'poll' || q.type === 'word_cloud'
                              ? false
                              : oIdx === q.correctIndex;
                            return (
                              <div
                                key={oIdx}
                                className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 border ${
                                  isCorrect
                                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                                    : 'bg-slate-800/40 border-slate-700/40 text-slate-300'
                                }`}
                              >
                                {q.type === 'puzzle' && (
                                  <span className="w-5 h-5 rounded bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-mono text-[10px]">
                                    {oIdx + 1}
                                  </span>
                                )}
                                <span>{cfg.symbol}</span>
                                <span className="truncate">{opt.text}</span>
                                {isCorrect && <Check className="w-3.5 h-3.5 text-emerald-400 mr-auto shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-700/60">
                  <button
                    onClick={() => setNewQuizQuestions([])}
                    className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold transition"
                  >
                    إلغاء وتفريغ
                  </button>
                  <button
                    onClick={handleSaveQuiz}
                    disabled={!newQuizTitle.trim()}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition cursor-pointer"
                  >
                    حِفْظُ التَّحَدِّي فِي البَنْكِ 💾
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= 4. غرفة التحدي الحية (Active Room View) ================= */}
        {activeRoom && (
          <div className="flex-1 flex flex-col justify-between max-w-5xl mx-auto w-full h-full py-2">
            {/* شريط حالة الغرفة العلوي - مخصص حسب دور المستخدم (المعلم كـ Host vs الطالب كـ Player) */}
            <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl px-5 py-3 flex items-center justify-between flex-wrap gap-3 shadow-lg shrink-0">
              {isHost ? (
                /* رأس شاشة المعلم (المضيف) */
                <>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-medium">رَمْزُ الدُّخُولِ (PIN):</span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black font-mono tracking-wider text-amber-400">
                          {activeRoom.pin}
                        </span>
                        <button
                          onClick={handleCopyPin}
                          className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
                          title="نسخ الرمز السداسي"
                        >
                          {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="h-8 w-[1px] bg-slate-700 hidden sm:block mx-1" />
                    <div>
                      <h4 className="text-xs font-bold text-white max-w-xs truncate">{activeRoom.quiz_title}</h4>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Users className="w-3 h-3 text-indigo-400" />
                        <span>{Object.keys(activeRoom.players).length} لاعب منضم</span>
                      </span>
                    </div>
                  </div>

                  {/* أدوات تحكم المعلم في مراحل التحدي */}
                  <div className="flex items-center gap-2">
                    {activeRoom.status === 'lobby' && (
                      <button
                        onClick={handleLaunchChallenge}
                        disabled={Object.keys(activeRoom.players).length === 0}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>انْطِلاقُ التَّحَدِّي 🚀</span>
                      </button>
                    )}

                    {(activeRoom.status === 'question_active' || activeRoom.status === 'in_progress') && (
                      <button
                        onClick={handleRevealAnswer}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>كَشْفُ الإِجَابَةِ 💡</span>
                      </button>
                    )}

                    {activeRoom.status === 'question_revealed' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handleShowLeaderboard}
                          className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-black text-xs shadow-md transition flex items-center gap-1 cursor-pointer"
                        >
                          <BarChart3 className="w-3.5 h-3.5 text-indigo-300" />
                          <span>لَوْحَةُ الصَّدَارَةِ 📊</span>
                        </button>
                        <button
                          onClick={handleNextQuestion}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1 cursor-pointer"
                        >
                          <span>{currentQIndex + 1 < roomQuestions.length ? 'السُّؤَالُ التَّالِي ❯' : 'مِنَصَّةُ التَّتْوِيجِ 🏆'}</span>
                        </button>
                      </div>
                    )}

                    {activeRoom.status === 'leaderboard' && (
                      <button
                        onClick={handleNextQuestion}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>{currentQIndex + 1 < roomQuestions.length ? 'السُّؤَالُ التَّالِي ❯' : 'مِنَصَّةُ التَّتْوِيجِ 🏆'}</span>
                      </button>
                    )}

                    {activeRoom.status === 'finished' && (
                      <button
                        onClick={handleLeaveRoom}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-md transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>إِنْهَاءُ الجَلْسَةِ 🏁</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      className={`p-2 rounded-xl border transition flex items-center gap-1 text-xs font-bold ${
                        isFullscreen
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300 hover:text-white'
                      }`}
                      title={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة بالكامل'}
                    >
                      {isFullscreen ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4 text-slate-300" />}
                    </button>

                    <button
                      onClick={handleLeaveRoom}
                      className="p-2 rounded-xl bg-slate-700 hover:bg-rose-900/60 hover:text-rose-300 text-slate-400 transition"
                      title="إنهاء التحدي والخروج"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                /* رأس شاشة الطالب (اللاعب) */
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-lg shadow-md shrink-0">
                      {currentPlayer?.avatar || (currentUser as any).avatar || '🌟'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">
                          {currentPlayer?.name || currentUser.name}
                        </span>
                        {currentPlayer && currentPlayer.streak > 1 && (
                          <span className="text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                            <Flame className="w-3 h-3 text-rose-400 fill-current" />
                            <span>{currentPlayer.streak} متتالية</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-amber-400 font-bold">
                        {studentScore.toLocaleString()} نقطة
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono bg-slate-900/80 border border-slate-700 px-2.5 py-1 rounded-lg text-slate-300">
                      غرفة: {activeRoom.pin}
                    </span>
                    <button
                      onClick={() => setSoundMuted(!soundMuted)}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
                      title={soundMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
                    >
                      {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      className={`p-1.5 rounded-lg border transition ${
                        isFullscreen
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300 hover:text-white'
                      }`}
                      title={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة بالكامل'}
                    >
                      {isFullscreen ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4 text-slate-300" />}
                    </button>
                    <button
                      onClick={handleLeaveRoom}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-rose-900/60 hover:text-rose-300 text-slate-400 transition text-xs font-bold flex items-center gap-1"
                      title="مغادرة الغرفة"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">مغادرة</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* ========================================================================= */}
            {/* فصل صارم بين واجهة المعلم (Host / Display View) وواجهة الطالب (Player View) */}
            {/* ========================================================================= */}
            {isHost ? (
              /* ================= 1. واجهة المعلم (Host / Smartboard Display View) ================= */
              <div className="flex-1 flex flex-col justify-between py-2">
                {/* A. شاشة اللوبي للمعلم (Host Lobby) */}
                {activeRoom.status === 'lobby' && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-6 max-w-3xl mx-auto w-full animate-in fade-in duration-300">
                    <div className="space-y-2">
                      <span className="text-xs font-black tracking-widest text-amber-400 uppercase bg-amber-400/10 border border-amber-400/20 px-3.5 py-1.5 rounded-full inline-block">
                        شَاشَةُ انْتِظَارِ الأَبْطَالِ (عَرْضُ المُعَلِّمِ) 🌟
                      </span>
                      <h3 className="text-3xl sm:text-4xl font-black text-white">
                        ادخل الرمز <span className="text-amber-400 font-mono tracking-wider">{activeRoom.pin}</span> للمشاركة
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-400">
                        اطلب من الطلاب فتح تبويب «تحدي موسى» وإدخال هذا الرمز السداسي للانضمام إلى المسابقة فوراً
                      </p>
                    </div>

                    {/* قائمة الأبطال المنضمين حالياً */}
                    <div className="w-full bg-slate-950/60 border border-slate-800 rounded-3xl p-6 min-h-[180px]">
                      <div className="text-xs font-bold text-slate-400 mb-3 flex items-center justify-center gap-2">
                        <Users className="w-4 h-4 text-indigo-400" />
                        <span>الأبطال المستعدون في الغرفة ({Object.keys(activeRoom.players).length}):</span>
                      </div>

                      {Object.keys(activeRoom.players).length === 0 ? (
                        <div className="py-10 text-slate-600 text-xs font-bold flex flex-col items-center gap-3">
                          <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
                          <span>في انتظار انضمام أول بطل للساحة...</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-center gap-2.5 max-h-56 overflow-y-auto p-1">
                          {Object.values(activeRoom.players).map(player => (
                            <div
                              key={player.id}
                              className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-black flex items-center gap-2 shadow-sm animate-in zoom-in-75 duration-200"
                            >
                              <span className="text-base">{player.avatar || '🌟'}</span>
                              <span>{player.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* اختيار نمط سير التحدي للمعلم */}
                    <div className="w-full bg-slate-950/60 border border-slate-800 rounded-3xl p-5 text-right space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-xs font-black text-amber-300">
                          <Sliders className="w-4 h-4 text-amber-400" />
                          <span>طَرِيقَةُ عَرْضِ وَسَيْرِ التَّحَدِّي:</span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-bold">
                          اختر النظام الأنسب لخطتك الدراسية
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setProgressionMode('teacher_paced')}
                          className={`p-4 rounded-2xl border text-right transition flex items-start gap-3 cursor-pointer ${
                            progressionMode === 'teacher_paced'
                              ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                            progressionMode === 'teacher_paced' ? 'border-indigo-400 bg-indigo-500' : 'border-slate-600'
                          }`}>
                            {progressionMode === 'teacher_paced' && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <div>
                            <span className="text-xs font-black block text-slate-200 mb-1">تحكم يدوي خطوة بخطوة 👨‍🏫</span>
                            <span className="text-[11px] text-slate-400 block leading-relaxed">
                              يمرّر المعلم كل سؤال يدوياً بالضغط على زر «السؤال التالي»، مما يتيح لك مناقشة وتوضيح كل سؤال للطلاب.
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setProgressionMode('auto_continuous')}
                          className={`p-4 rounded-2xl border text-right transition flex items-start gap-3 cursor-pointer ${
                            progressionMode === 'auto_continuous'
                              ? 'bg-amber-950/80 border-amber-500 text-white shadow-lg shadow-amber-500/20'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                            progressionMode === 'auto_continuous' ? 'border-amber-400 bg-amber-500' : 'border-slate-600'
                          }`}>
                            {progressionMode === 'auto_continuous' && <div className="w-2 h-2 rounded-full bg-slate-950" />}
                          </div>
                          <div>
                            <span className="text-xs font-black block text-slate-200 mb-1">تحدٍّ متتابع وتلقائي ⚡</span>
                            <span className="text-[11px] text-slate-400 block leading-relaxed">
                              تتعاقب الأسئلة وراء بعضها تلقائياً وبشكل سريع ومستمر، مع إعلان النتيجة النهائية الشاملة في النهاية.
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* زر إطلاق التحدي للمعلم */}
                    <button
                      onClick={handleLaunchChallenge}
                      disabled={Object.keys(activeRoom.players).length === 0}
                      className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 transition flex items-center gap-2 cursor-pointer"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      <span>ابْدَأِ التَّحَدِّي الآنَ 🚀 ({Object.keys(activeRoom.players).length} لاعب جاهز)</span>
                    </button>
                  </div>
                )}

                {/* B. شاشة السؤال النشط للمعلم (Host Question Display) - بطاقات عرض فقط دون أزرار إجابة */}
                {(activeRoom.status === 'question_active' || activeRoom.status === 'in_progress') && currentQ && (
                  <div className="flex-1 flex flex-col justify-between py-2 space-y-5 animate-in fade-in duration-200 max-w-4xl mx-auto w-full">
                    {/* رأس السؤال والمؤقت الدائري التفاعلي الكبير وعداد الطلاب المجيبين */}
                    <div className="flex items-center justify-between gap-4 flex-wrap bg-slate-950/60 border border-slate-800 rounded-2xl px-6 py-3">
                      <div className="text-xs font-black text-slate-300 bg-slate-800 px-4 py-2 rounded-xl border border-slate-700">
                        السُّؤَالُ {currentQIndex + 1} مِنْ {roomQuestions.length}
                      </div>

                      {/* المؤقت الدائري التفاعلي التنازلي للمعلم والشاشة الرئيسية */}
                      <div className="relative w-20 h-20 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="40"
                            cy="40"
                            r="32"
                            stroke="currentColor"
                            strokeWidth="6"
                            className="text-slate-800"
                            fill="transparent"
                          />
                          <circle
                            cx="40"
                            cy="40"
                            r="32"
                            stroke="currentColor"
                            strokeWidth="6"
                            strokeDasharray={2 * Math.PI * 32}
                            strokeDashoffset={
                              2 * Math.PI * 32 * (1 - timeLeft / (currentQ.timeLimitSeconds || 20))
                            }
                            strokeLinecap="round"
                            className={`transition-all duration-1000 ${
                              timeLeft <= 5 ? 'text-rose-500 animate-pulse' : timeLeft <= 10 ? 'text-amber-400' : 'text-emerald-400'
                            }`}
                            fill="transparent"
                          />
                        </svg>
                        <span className={`absolute text-xl font-black font-mono ${
                          timeLeft <= 5 ? 'text-rose-400 scale-110' : 'text-white'
                        }`}>
                          {timeLeft}
                        </span>
                      </div>

                      {/* عداد الطلاب الذين أجابوا */}
                      <div className="text-xs font-black text-slate-300 bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-400" />
                        <span>{totalAnswersCount} / {Object.keys(activeRoom.players).length} أبطال أجابوا</span>
                      </div>
                    </div>

                    {/* نص السؤال المشكول بالكامل في لافتة بارزة على الشاشة الكبيرة */}
                    <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 text-center shadow-xl flex items-center justify-center min-h-[140px]">
                      <h3 className="text-2xl md:text-3xl font-black text-white leading-relaxed">
                        {currentQ.text}
                      </h3>
                    </div>

                    {/* بطاقات الخيارات أو نموذج العرض حسب نمط السؤال - لشاشة المعلم/السبورة الذكية */}
                    {currentQ.type === 'true_false' ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-6 rounded-3xl border-2 border-blue-500/50 bg-blue-950/40 flex flex-col items-center justify-center text-center shadow-lg">
                          <span className="text-4xl mb-2">🔷</span>
                          <span className="text-2xl font-black text-blue-300">صَوَابٌ (صَحِيحٌ)</span>
                        </div>
                        <div className="p-6 rounded-3xl border-2 border-rose-500/50 bg-rose-950/40 flex flex-col items-center justify-center text-center shadow-lg">
                          <span className="text-4xl mb-2">🔺</span>
                          <span className="text-2xl font-black text-rose-300">خَطَأٌ (غَيْرُ صَحِيحٍ)</span>
                        </div>
                      </div>
                    ) : currentQ.type === 'type_answer' ? (
                      <div className="p-6 rounded-3xl border-2 border-indigo-500/40 bg-indigo-950/30 text-center space-y-3 shadow-lg">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-black">
                          <MessageSquare className="w-4 h-4" />
                          <span>سُؤَالُ إِدْخَالِ نَصٍّ (يكتب الطلاب الإجابة من لوحة المفاتيح)</span>
                        </div>
                        <p className="text-sm font-bold text-slate-300">
                          يكتب الطلاب الإجابة الصحيحة الآن مباشرة من أجهزتهم، ويتم التحقق والتطبيع آلياً.
                        </p>
                      </div>
                    ) : currentQ.type === 'puzzle' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {currentQ.options.map((opt, idx) => (
                          <div
                            key={idx}
                            className="p-4 rounded-2xl border-2 border-amber-500/40 bg-slate-900/80 flex items-center gap-4 text-right select-none shadow-md"
                          >
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center text-lg font-black shrink-0">
                              {idx + 1}
                            </div>
                            <span className="text-base sm:text-lg font-black block leading-relaxed text-white">
                              {opt.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : currentQ.type === 'word_cloud' ? (
                      /* عرض سحابة الكلمات الحية التفاعلية على شاشة المعلم / السبورة */
                      <div className="p-6 rounded-3xl border-2 border-sky-500/40 bg-slate-900/90 shadow-xl space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
                              <Cloud className="w-5 h-5 animate-pulse" />
                            </span>
                            <div>
                              <h4 className="text-sm font-black text-sky-300">سَحَابَةُ الكَلِمَاتِ الحَيَّةِ (مُبَاشِرٌ)</h4>
                              <p className="text-[11px] text-slate-400">الكلمات تتطاير وتكبر تلقائياً مع تكرار مشاركات الطلاب</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black bg-sky-950 px-3 py-1.5 rounded-xl border border-sky-800 text-sky-200">
                              {wordCloudStats.totalSubmissions} كلمة مستلمة
                            </span>
                            <span className="text-xs font-black bg-indigo-950 px-3 py-1.5 rounded-xl border border-indigo-800 text-indigo-200">
                              {wordCloudStats.uniqueCount} كلمة مميزة
                            </span>
                          </div>
                        </div>

                        {wordCloudStats.words.length === 0 ? (
                          <div className="min-h-[180px] rounded-2xl border-2 border-dashed border-sky-500/30 bg-sky-950/20 flex flex-col items-center justify-center p-6 text-center space-y-3">
                            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-3xl animate-bounce">
                              ☁️
                            </div>
                            <p className="text-sm font-bold text-sky-300">
                              في انتظار مشاركات الأبطال... اطلب من الطلاب كتابة كلماتهم الآن!
                            </p>
                            {currentQ.acceptableAnswers && currentQ.acceptableAnswers.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap justify-center pt-2">
                                <span className="text-[11px] text-slate-400">أمثلة مقترحة:</span>
                                {currentQ.acceptableAnswers.map((ans, aIdx) => (
                                  <span key={aIdx} className="text-[10px] bg-slate-800 text-sky-300 px-2 py-0.5 rounded-md border border-slate-700">
                                    {ans}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="min-h-[180px] p-6 rounded-2xl bg-slate-950/80 border border-sky-500/30 flex flex-wrap items-center justify-center gap-3.5 transition-all">
                            {wordCloudStats.words.map((item, wIdx) => {
                              const maxCount = wordCloudStats.words[0]?.count || 1;
                              const ratio = item.count / maxCount;
                              const sizeClass =
                                ratio >= 0.8 ? 'text-2xl sm:text-3xl font-black py-2.5 px-5' :
                                ratio >= 0.5 ? 'text-xl sm:text-2xl font-black py-2 px-4' :
                                ratio >= 0.3 ? 'text-base sm:text-lg font-bold py-1.5 px-3.5' : 'text-xs sm:text-sm font-semibold py-1 px-3';
                              const palette = [
                                'from-sky-400 to-blue-500 text-white border-sky-300/40 shadow-sky-500/20',
                                'from-emerald-400 to-teal-500 text-white border-emerald-300/40 shadow-emerald-500/20',
                                'from-amber-400 to-orange-500 text-slate-950 border-amber-300/40 shadow-amber-500/20',
                                'from-fuchsia-400 to-purple-500 text-white border-fuchsia-300/40 shadow-fuchsia-500/20',
                                'from-rose-400 to-pink-500 text-white border-rose-300/40 shadow-rose-500/20',
                                'from-indigo-400 to-cyan-500 text-white border-indigo-300/40 shadow-indigo-500/20'
                              ];
                              const theme = palette[wIdx % palette.length];

                              return (
                                <div
                                  key={wIdx}
                                  className={`rounded-2xl bg-gradient-to-r border shadow-lg flex items-center gap-2 transform hover:scale-105 transition duration-200 animate-in zoom-in-75 ${theme} ${sizeClass}`}
                                >
                                  <span>{item.word}</span>
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-black/30 font-mono font-black shrink-0">
                                    {item.count}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : currentQ.type === 'poll' ? (
                      /* عرض استطلاع الرأي الحي بنسب التصويت المباشرة على شاشة المعلم / السبورة */
                      <div className="p-6 rounded-3xl border-2 border-indigo-500/40 bg-slate-900/90 shadow-xl space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                              <Vote className="w-5 h-5 animate-pulse" />
                            </span>
                            <div>
                              <h4 className="text-sm font-black text-indigo-300">اسْتِطْلاعُ الرَّأْيِ الحَيُّ (تَصْوِيتٌ مُبَاشِرٌ)</h4>
                              <p className="text-[11px] text-slate-400">تحديث فوري لخيارات الطلاب ونسب الأصوات دون إجابة صحيحة واحدة</p>
                            </div>
                          </div>
                          <span className="text-xs font-black bg-indigo-950 px-3.5 py-1.5 rounded-xl border border-indigo-800 text-indigo-200">
                            إجمالي الأصوات: {pollStats.totalVotes}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {pollStats.optionsWithVotes.map((opt, idx) => {
                            const style = ARABIC_OPTION_STYLES[idx] || ARABIC_OPTION_STYLES[0];
                            return (
                              <div
                                key={idx}
                                className={`p-4 rounded-2xl border-2 flex flex-col justify-between text-right shadow-md relative overflow-hidden ${style.bg} ${style.border}`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
                                  <div className="flex items-center gap-2.5">
                                    <span className="w-9 h-9 rounded-xl bg-black/30 flex items-center justify-center font-black text-base text-white shrink-0 shadow-inner">
                                      {idx + 1}
                                    </span>
                                    <span className="text-base sm:text-lg font-black text-white">
                                      {opt.text}
                                    </span>
                                  </div>
                                  <div className="text-left shrink-0">
                                    <span className="text-sm font-black text-white block">{opt.count} صوت</span>
                                    <span className="text-xs font-bold text-white/80">{opt.pct}%</span>
                                  </div>
                                </div>

                                <div className="w-full bg-black/40 h-3 rounded-full overflow-hidden relative z-10 border border-white/10">
                                  <div
                                    className="h-full bg-white transition-all duration-500 rounded-full"
                                    style={{ width: `${opt.pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {currentQ.options.map((opt, idx) => {
                          const style = ARABIC_OPTION_STYLES[idx] || ARABIC_OPTION_STYLES[0];

                          return (
                            <div
                              key={idx}
                              className={`p-4 rounded-2xl border-2 flex items-center gap-4 text-right select-none shadow-md ${style.bg} ${style.border}`}
                            >
                              <div className="w-12 h-12 rounded-2xl bg-black/30 flex items-center justify-center text-2xl font-black text-white shrink-0 shadow-inner">
                                ({style.letter})
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-base sm:text-lg font-black block leading-relaxed text-white">
                                  {opt.text}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* لوحة متابعة إجابات ودرجات الطلاب الحية للمعلم */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-right space-y-3 shadow-xl">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-xs font-black text-amber-300">
                          <Award className="w-4 h-4 text-amber-400" />
                          <span>دَرَجَاتُ وَتَفَاعُلُ الأَبْطَالِ فِي هَذَا السُّؤَالِ ({sortedPlayers.length} بطل):</span>
                        </div>
                        <span className="text-[11px] font-bold text-indigo-300">
                          {totalAnswersCount} أجابوا من أصل {sortedPlayers.length}
                        </span>
                      </div>

                      {sortedPlayers.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-500 font-bold">
                          لا يوجد طلاب منضمون حتى الآن
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1">
                          {sortedPlayers.map((player) => {
                            const playerAns = Array.isArray(activeRoom.answers_received)
                              ? activeRoom.answers_received.find((a: any) => a.playerId === player.id && Number(a.questionIndex) === currentQIndex)
                              : null;
                            const hasAnsweredCurrent = Boolean(playerAns || (player.lastAnswer && Number(player.lastAnswer.questionIndex) === currentQIndex));

                            return (
                              <div
                                key={player.id}
                                className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                                  hasAnsweredCurrent
                                    ? 'bg-indigo-950/60 border-indigo-500/60 text-indigo-200'
                                    : 'bg-slate-900/60 border-slate-800 text-slate-400'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-base shrink-0">{player.avatar || '🌟'}</span>
                                  <div className="truncate">
                                    <span className="text-xs font-black text-white block truncate">{player.name}</span>
                                    <span className="text-[10px] text-amber-400 font-mono font-bold block">مجموع النقاط: {player.score}</span>
                                  </div>
                                </div>

                                <div className="text-left shrink-0">
                                  {hasAnsweredCurrent ? (
                                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/40 flex items-center gap-1">
                                      <Check className="w-3 h-3 stroke-[3]" />
                                      <span>أجاب ✓</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      <span>يفكر...</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* شريط التحكم السفلي للمعلم */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>💡 يجيب الطلاب الآن باختيار الحرف العربي المناسب (أ، ب، ج، د) من أجهزتهم.</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleRevealAnswer}
                          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>كَشْفُ الإِجَابَةِ 💡</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleNextQuestion}
                          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg shadow-indigo-600/20 transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>السُّؤَالُ التَّالِي ❯</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* C. شاشة كشف الإجابة الصحيحة للمعلم مع الإحصائيات (Host Revealed View) */}
                {activeRoom.status === 'question_revealed' && currentQ && (
                  <div className="flex-1 flex flex-col justify-center space-y-5 py-4 animate-in zoom-in-95 duration-200 max-w-4xl mx-auto w-full">
                    {/* تنبيه الانتقال التلقائي إذا كان وضع التتابع مفعل */}
                    {activeRoom.settings?.progression_mode === 'auto_continuous' && (
                      <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 flex items-center justify-between gap-3 shadow-lg animate-in fade-in duration-200">
                        <div className="flex items-center gap-2 text-xs sm:text-sm font-black">
                          <Zap className="w-4 h-4 text-amber-400 animate-bounce" />
                          <span>
                            {currentQIndex + 1 < roomQuestions.length 
                              ? `وضع التتابع التلقائي: السؤال التالي سينطلق خلال ${autoAdvanceCountdown !== null ? autoAdvanceCountdown : 4} ثوانٍ...`
                              : `وضع التتابع التلقائي: إعلان النتيجة النهائية والتتويج خلال ${autoAdvanceCountdown !== null ? autoAdvanceCountdown : 4} ثوانٍ...`
                            }
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleNextQuestion}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shrink-0 transition cursor-pointer"
                        >
                          الانتقال فوراً ❯
                        </button>
                      </div>
                    )}

                    {/* بطاقة الإجابة الصحيحة وشرح موسى */}
                    <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-5">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-3xl shadow-inner">
                          💡
                        </div>
                        <div>
                          <span className="text-xs text-slate-400 font-bold">الإِجَابَةُ الصَّحِيحَةُ المَعْتَمَدَةُ:</span>
                          <h3 className="text-2xl font-black text-white flex items-center gap-2">
                            {currentQ.type === 'true_false' ? (
                              <span>{currentQ.correctIndex === 0 ? '🔷 صَوَابٌ (صَحِيحٌ)' : '🔺 خَطَأٌ (غَيْرُ صَحِيحٍ)'}</span>
                            ) : currentQ.type === 'type_answer' ? (
                              <span className="text-emerald-300 font-mono">{currentQ.correctAnswerText || currentQ.acceptableAnswers?.[0] || 'تم فحص الإجابات'}</span>
                            ) : currentQ.type === 'puzzle' ? (
                              <span className="text-amber-300 text-lg">
                                {currentQ.correctOrder && currentQ.correctOrder.length > 0
                                  ? currentQ.correctOrder.map(idx => currentQ.options[idx]?.text || '').filter(Boolean).join(' ⬅️ ')
                                  : currentQ.options.map(o => o.text).join(' ⬅️ ')}
                              </span>
                            ) : currentQ.type === 'poll' || currentQ.type === 'word_cloud' ? (
                              <span className="text-indigo-300">مشاركة جماعية (استطلاع رأي / سحابة كلمات)</span>
                            ) : (
                              <>
                                <span className="text-amber-400 font-black">({ARABIC_OPTION_LETTERS[currentQ.correctIndex] || 'أ'})</span>
                                <span>{currentQ.options[currentQ.correctIndex]?.text}</span>
                              </>
                            )}
                          </h3>
                        </div>
                      </div>

                      {currentQ.explanation && (
                        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-700/60 text-right">
                          <div className="text-xs font-black text-amber-300 flex items-center gap-1.5 mb-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>شَرْحُ الصَّدِيقِ مُوسَى التَّرْبَوِيُّ:</span>
                          </div>
                          <p className="text-base font-bold text-slate-200 leading-relaxed">
                            {currentQ.explanation}
                          </p>
                        </div>
                      )}

                      {/* توزيع إجابات الطلاب على الخيارات */}
                      {currentQ.type === 'true_false' ? (
                        <div className="space-y-2 pt-2">
                          <span className="text-xs font-bold text-slate-400 block">إحصائيات إجابات الصف (صح أم خطأ):</span>
                          <div className="grid grid-cols-2 gap-4">
                            {[
                              { label: 'صواب 🔷', count: optionAnswerCounts[0] || 0, isCorrect: currentQ.correctIndex === 0, color: 'blue' },
                              { label: 'خطأ 🔺', count: optionAnswerCounts[1] || 0, isCorrect: currentQ.correctIndex === 1, color: 'rose' }
                            ].map((item, idx) => {
                              const pct = totalAnswersCount > 0 ? Math.round((item.count / totalAnswersCount) * 100) : 0;
                              return (
                                <div
                                  key={idx}
                                  className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center ${
                                    item.isCorrect ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300' : 'bg-slate-900/60 border-slate-800 text-slate-300'
                                  }`}
                                >
                                  <span className="text-xl font-black">{item.label}</span>
                                  <span className="text-base font-black text-white mt-1">{item.count} إجابة ({pct}%)</span>
                                  <div className="w-full bg-slate-800 h-2.5 rounded-full mt-2 overflow-hidden">
                                    <div
                                      className={`h-full ${item.isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : currentQ.type === 'type_answer' ? (
                        <div className="space-y-2 pt-2">
                          <span className="text-xs font-bold text-slate-400 block">إجابات الطلاب النصية المستلمة:</span>
                          <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-900/60 rounded-2xl border border-slate-800">
                            {Array.isArray(activeRoom.answers_received) && activeRoom.answers_received.filter((a: any) => Number(a.questionIndex) === currentQIndex).length > 0 ? (
                              activeRoom.answers_received
                                .filter((a: any) => Number(a.questionIndex) === currentQIndex)
                                .map((ans: any, aIdx: number) => {
                                  const player = activeRoom.players[ans.playerId];
                                  return (
                                    <div key={aIdx} className="flex items-center justify-between text-xs py-1 px-2.5 bg-slate-800/80 rounded-xl">
                                      <span className="text-slate-300 font-bold">{player?.name || 'طالب'}:</span>
                                      <span className={`font-mono font-black ${ans.isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        «{ans.textAnswer || ans.selectedText || 'بدون إدخال'}» {ans.isCorrect ? '✓' : '✗'}
                                      </span>
                                    </div>
                                  );
                                })
                            ) : (
                              <div className="text-center text-xs text-slate-500 py-3">لا توجد إجابات نصية مسجلة بعد</div>
                            )}
                          </div>
                        </div>
                      ) : currentQ.type === 'word_cloud' ? (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                              <Cloud className="w-4 h-4 text-sky-400" />
                              <span>سَحَابَةُ الكَلِمَاتِ النِّهَائِيَّةُ لِهَذَا السُّؤَالِ:</span>
                            </span>
                            <span className="text-xs font-bold text-sky-200">
                              {wordCloudStats.totalSubmissions} مشاركة ({wordCloudStats.uniqueCount} كلمة فريدة)
                            </span>
                          </div>
                          {wordCloudStats.words.length === 0 ? (
                            <div className="p-6 rounded-2xl bg-slate-900/60 text-center text-xs text-slate-400">
                              لم يتم تسجيل كلمات في هذا السؤال
                            </div>
                          ) : (
                            <div className="p-6 rounded-3xl bg-slate-950/80 border-2 border-sky-500/40 flex flex-wrap items-center justify-center gap-3">
                              {wordCloudStats.words.map((item, wIdx) => {
                                const maxCount = wordCloudStats.words[0]?.count || 1;
                                const ratio = item.count / maxCount;
                                const sizeClass =
                                  ratio >= 0.8 ? 'text-2xl sm:text-3xl font-black py-2.5 px-5' :
                                  ratio >= 0.5 ? 'text-xl sm:text-2xl font-black py-2 px-4' :
                                  ratio >= 0.3 ? 'text-base sm:text-lg font-bold py-1.5 px-3.5' : 'text-xs sm:text-sm font-semibold py-1 px-3';
                                const colorStyles = [
                                  'from-sky-400 to-blue-500 text-white shadow-sky-500/30 border-sky-400/40',
                                  'from-emerald-400 to-teal-500 text-white shadow-emerald-500/30 border-emerald-400/40',
                                  'from-amber-400 to-orange-500 text-slate-950 shadow-amber-500/30 border-amber-300/40',
                                  'from-fuchsia-400 to-purple-500 text-white shadow-fuchsia-500/30 border-fuchsia-400/40',
                                  'from-rose-400 to-pink-500 text-white shadow-rose-500/30 border-rose-400/40',
                                  'from-indigo-400 to-cyan-500 text-white shadow-indigo-500/30 border-indigo-400/40'
                                ];
                                const color = colorStyles[wIdx % colorStyles.length];

                                return (
                                  <div
                                    key={wIdx}
                                    className={`rounded-2xl bg-gradient-to-r border shadow-lg flex items-center gap-2 ${color} ${sizeClass}`}
                                  >
                                    <span>«{item.word}»</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-black/30 font-mono font-black">
                                      {item.count}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : currentQ.type === 'poll' ? (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                              <Vote className="w-4 h-4 text-indigo-400" />
                              <span>نَتَائِجُ وَنِسَبُ اسْتِطْلاعِ الرَّأْيِ النِّهَائِيَّةُ:</span>
                            </span>
                            <span className="text-xs font-bold text-indigo-200">
                              إجمالي الأصوات: {pollStats.totalVotes} صوت
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {pollStats.optionsWithVotes.map((opt, idx) => {
                              const style = ARABIC_OPTION_STYLES[idx] || ARABIC_OPTION_STYLES[0];
                              return (
                                <div
                                  key={idx}
                                  className={`p-4 rounded-2xl border-2 flex flex-col justify-between text-right shadow-md relative overflow-hidden ${
                                    opt.isWinner ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900' : ''
                                  } ${style.bg} ${style.border}`}
                                >
                                  <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
                                    <div className="flex items-center gap-2.5">
                                      <span className="w-8 h-8 rounded-xl bg-black/30 flex items-center justify-center font-black text-sm text-white shrink-0">
                                        {idx + 1}
                                      </span>
                                      <span className="text-base sm:text-lg font-black text-white">
                                        {opt.text}
                                      </span>
                                    </div>
                                    <div className="text-left shrink-0">
                                      <span className="text-sm font-black text-white block">{opt.count} صوت</span>
                                      <span className="text-xs font-bold text-white/80">{opt.pct}%</span>
                                    </div>
                                  </div>

                                  <div className="w-full bg-black/40 h-3 rounded-full overflow-hidden relative z-10 border border-white/10">
                                    <div
                                      className="h-full bg-white transition-all duration-500 rounded-full"
                                      style={{ width: `${opt.pct}%` }}
                                    />
                                  </div>

                                  {opt.isWinner && (
                                    <div className="mt-2 text-center text-xs font-black text-amber-200 bg-black/30 py-1 rounded-lg">
                                      🌟 الخيار الأكثر تفضيلاً بين الطلاب!
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 pt-2">
                          <span className="text-xs font-bold text-slate-400 block">إحصائيات إجابات الصف الحالية:</span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {currentQ.options.map((opt, idx) => {
                              const count = optionAnswerCounts[idx];
                              const pct = totalAnswersCount > 0 ? Math.round((count / totalAnswersCount) * 100) : 0;
                              const isCorrect = idx === currentQ.correctIndex;
                              const letter = ARABIC_OPTION_LETTERS[idx] || 'أ';

                              return (
                                <div
                                  key={idx}
                                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center text-center ${
                                    isCorrect ? 'bg-emerald-950/60 border-emerald-500/50' : 'bg-slate-900/60 border-slate-800'
                                  }`}
                                >
                                  <span className={`text-2xl font-black ${isCorrect ? 'text-emerald-400' : 'text-slate-300'}`}>
                                    ({letter})
                                  </span>
                                  <span className="text-base font-black text-white mt-1">{count} إجابة</span>
                                  <span className="text-xs text-slate-400 font-bold">{pct}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* لوحة درجات الطلاب بعد كشف السؤال لمعرفة من أصاب ومن أخطأ */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-right space-y-3 shadow-xl">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-xs font-black text-amber-300">
                          <Award className="w-4 h-4 text-amber-400" />
                          <span>نَتَائِجُ وَدَرَجَاتُ الأَبْطَالِ فِي هَذَا السُّؤَالِ ({sortedPlayers.length} بطل):</span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">
                          الدرجة الكلية المحدثة لكل طالب
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1">
                        {sortedPlayers.map((player) => {
                          const playerAns = Array.isArray(activeRoom.answers_received)
                            ? activeRoom.answers_received.find((a: any) => a.playerId === player.id && Number(a.questionIndex) === currentQIndex)
                            : null;
                          const hasAnsweredCurrent = Boolean(playerAns || (player.lastAnswer && Number(player.lastAnswer.questionIndex) === currentQIndex));
                          const isCorrectAns = playerAns ? Boolean(playerAns.isCorrect) : (player.lastAnswer?.isCorrect || false);
                          const pointsEarned = playerAns ? (Number(playerAns.points) || 0) : (player.lastAnswer?.pointsEarned || 0);

                          return (
                            <div
                              key={player.id}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                                hasAnsweredCurrent
                                  ? isCorrectAns
                                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                                    : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                                  : 'bg-slate-800/50 border-slate-700/60 text-slate-400'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-base shrink-0">{player.avatar || '🌟'}</span>
                                <div className="truncate">
                                  <span className="text-xs font-black text-white block truncate">{player.name}</span>
                                  <span className="text-[10px] text-amber-400 font-mono font-bold block">المجموع: {player.score} نقطة</span>
                                </div>
                              </div>

                              <div className="text-left shrink-0">
                                {hasAnsweredCurrent ? (
                                  isCorrectAns ? (
                                    <span className="text-[11px] font-black text-emerald-400 bg-emerald-900/60 px-2 py-0.5 rounded-md border border-emerald-500/40">
                                      +{pointsEarned} ✓
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-black text-rose-400 bg-rose-900/60 px-2 py-0.5 rounded-md border border-rose-500/40">
                                      خطأ ✗
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-500">
                                    لم يجب
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleShowLeaderboard}
                        className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <BarChart3 className="w-4 h-4 text-indigo-400" />
                        <span>لَوْحَةُ الصَّدَارَةِ 📊</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleNextQuestion}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>{currentQIndex + 1 < roomQuestions.length ? 'السُّؤَالُ التَّالِي ❯' : 'مِنَصَّةُ التَّتْوِيجِ 🏆'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* D. لوحة الصدارة للمعلم (Host Leaderboard View) */}
                {activeRoom.status === 'leaderboard' && (
                  <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full py-4 space-y-5 animate-in fade-in duration-300">
                    <div className="text-center space-y-1">
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-black">
                        <BarChart3 className="w-4 h-4" />
                        <span>لَوْحَةُ الصَّدَارَةِ وَالتَّرْتِيبِ الحَالِيِّ 🏅</span>
                      </div>
                      <h3 className="text-3xl font-black text-white">
                        أَبْطَالُ تِلْكَ الجَوْلَةِ
                      </h3>
                    </div>

                    <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 space-y-3 shadow-2xl max-h-96 overflow-y-auto">
                      {sortedPlayers.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-xs">لا يوجد لاعبين حتى الآن</div>
                      ) : (
                        sortedPlayers.slice(0, 10).map((player, idx) => (
                          <div
                            key={player.id}
                            className={`p-3.5 rounded-2xl flex items-center justify-between border transition ${
                              idx === 0
                                ? 'bg-gradient-to-r from-amber-500/20 via-amber-600/10 to-transparent border-amber-500/40 text-amber-300'
                                : idx === 1
                                ? 'bg-gradient-to-r from-slate-400/20 to-transparent border-slate-400/40 text-slate-200'
                                : idx === 2
                                ? 'bg-gradient-to-r from-amber-700/20 to-transparent border-amber-700/40 text-amber-500'
                                : 'bg-slate-900/60 border-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 rounded-xl bg-slate-950/80 font-mono font-black text-xs flex items-center justify-center">
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                              </span>
                              <span className="text-base font-black">{player.name}</span>
                              {player.streak > 1 && (
                                <span className="text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                  <Flame className="w-3 h-3 text-rose-400 fill-current" />
                                  <span>{player.streak} متتالية!</span>
                                </span>
                              )}
                            </div>

                            <div className="text-left font-mono font-black text-base text-white">
                              {player.score.toLocaleString()} <span className="text-[10px] text-slate-400 font-sans font-normal">نقطة</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={handleNextQuestion}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>{currentQIndex + 1 < roomQuestions.length ? 'السُّؤَالُ التَّالِي ❯' : 'مِنَصَّةُ التَّتْوِيجِ 🏆'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* E. منصة التتويج النهائية للمعلم (Host Podium Finish) */}
                {activeRoom.status === 'finished' && (
                  <div className="flex-1 flex flex-col items-center justify-center py-4 space-y-6 text-center animate-in zoom-in-95 duration-500">
                    <div className="space-y-1">
                      <span className="text-xs font-black tracking-widest text-amber-400 uppercase bg-amber-400/10 border border-amber-400/20 px-3.5 py-1.5 rounded-full inline-block">
                        مِنَصَّةُ الأَبْطَالِ وَالتَّتْوِيجِ 🏆
                      </span>
                      <h3 className="text-3xl md:text-4xl font-black text-white">
                        نِهَايَةُ تَحَدِّي مُوسَى!
                      </h3>
                      <p className="text-xs text-slate-400">
                        مبارك لجميع الأبطال المشاركين على هذا الأداء الرائع والحماسي!
                      </p>
                    </div>

                    {/* منصة المراكز الثلاثة الأولى (Podium) */}
                    <div className="flex items-end justify-center gap-2 md:gap-4 w-full max-w-lg pt-8 pb-4">
                      {/* المركز الثاني */}
                      {sortedPlayers[1] ? (
                        <div className="flex-1 flex flex-col items-center">
                          <div className="text-2xl mb-1">🥈</div>
                          <span className="text-xs font-black text-slate-300 truncate max-w-[90px]">{sortedPlayers[1].name}</span>
                          <span className="text-[11px] font-mono text-slate-400 font-bold mb-2">{sortedPlayers[1].score} نقطة</span>
                          <div className="w-full bg-slate-700/80 border-t-4 border-slate-400 rounded-t-2xl h-28 flex items-center justify-center text-xl font-black text-slate-300 shadow-lg">
                            2
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 h-20 bg-slate-800/40 rounded-t-2xl" />
                      )}

                      {/* المركز الأول البطل الذهبي */}
                      {sortedPlayers[0] ? (
                        <div className="flex-1 flex flex-col items-center -mt-6">
                          <div className="text-4xl mb-1 animate-bounce">👑</div>
                          <span className="text-sm font-black text-amber-300 truncate max-w-[110px]">{sortedPlayers[0].name}</span>
                          <span className="text-xs font-mono text-amber-400 font-bold mb-2">{sortedPlayers[0].score} نقطة</span>
                          <div className="w-full bg-gradient-to-t from-amber-600 to-amber-500 border-t-4 border-amber-300 rounded-t-2xl h-40 flex items-center justify-center text-3xl font-black text-slate-950 shadow-2xl shadow-amber-500/30">
                            🥇 1
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 h-32 bg-slate-800/40 rounded-t-2xl" />
                      )}

                      {/* المركز الثالث */}
                      {sortedPlayers[2] ? (
                        <div className="flex-1 flex flex-col items-center">
                          <div className="text-2xl mb-1">🥉</div>
                          <span className="text-xs font-black text-amber-600 truncate max-w-[90px]">{sortedPlayers[2].name}</span>
                          <span className="text-[11px] font-mono text-slate-400 font-bold mb-2">{sortedPlayers[2].score} نقطة</span>
                          <div className="w-full bg-amber-900/60 border-t-4 border-amber-600 rounded-t-2xl h-20 flex items-center justify-center text-xl font-black text-amber-500 shadow-lg">
                            3
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 h-16 bg-slate-800/40 rounded-t-2xl" />
                      )}
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleLeaveRoom}
                        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg transition cursor-pointer"
                      >
                        العَوْدَةُ لِبَنْكِ التَّحَدِّيَاتِ 📚
                      </button>
                      <button
                        onClick={() => {
                          try {
                            confetti({
                              particleCount: 100,
                              spread: 70,
                              origin: { y: 0.6 }
                            });
                          } catch {}
                        }}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-slate-700 transition cursor-pointer"
                      >
                        🎉 إطلاق الاحتفالات مجدداً
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ================= 2. واجهة الطالب (Player / Controller View) ================= */
              <div className="flex-1 flex flex-col justify-between py-2">
                {/* A. شاشة انتظار الطالب (Waiting Screen) */}
                {activeRoom.status === 'lobby' && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-6 max-w-md mx-auto w-full animate-in fade-in zoom-in-95 duration-300">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-purple-600 p-1 shadow-2xl shadow-indigo-500/20">
                      <div className="w-full h-full bg-slate-900 rounded-[22px] flex items-center justify-center text-5xl">
                        🚀
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="text-xs font-black text-amber-300 bg-amber-400/10 border border-amber-400/20 px-3.5 py-1.5 rounded-full inline-block">
                        أَهْلاً بِكَ يَا {currentUser.name || playerNameInput || 'بَطَلَ التَّحَدِّي'}! 🌟
                      </span>

                      {/* الرسالة التشجيعية المطلوبة بالضبط */}
                      <h3 className="text-2xl sm:text-3xl font-black text-white leading-relaxed">
                        أنت في اللعبة يا بطل! انتظر إشارة المعلم للبدء 🚀
                      </h3>

                      <p className="text-xs text-slate-400 leading-relaxed">
                        أنت متصل الآن بغرفة التحدي <span className="text-amber-400 font-mono font-bold">{activeRoom.pin}</span>. استعد لاختيار الإجابة الصحيحة (أ، ب، ج، د) بأعلى سرعة فور انطلاق السؤال!
                      </p>
                    </div>

                    <div className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-center gap-3 text-xs text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>في انتظار إشارة المعلم لانطلاق الجولة الأولى...</span>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      يوجد معك {Object.keys(activeRoom.players).length} أبطال مستعدون للتنافس في هذه الغرفة
                    </div>
                  </div>
                )}

                {/* B. شاشة السؤال والتحكم للطالب (Player Controller View) */}
                {(activeRoom.status === 'question_active' || activeRoom.status === 'in_progress') && (
                  <div className="flex-1 flex flex-col justify-between py-2 space-y-4 animate-in fade-in duration-200 max-w-2xl mx-auto w-full">
                    {/* رأس مصغر: رقم السؤال والوقت المتبقي */}
                    <div className="flex items-center justify-between px-2">
                      <span className="text-xs font-black text-slate-300 bg-slate-800 px-3.5 py-1.5 rounded-full border border-slate-700">
                        السُّؤَالُ {(activeRoom.current_question_index || 0) + 1} مِنْ {Math.max(1, roomQuestions.length || activeRoom.questions?.length || 1)}
                      </span>
                      <div className={`px-3.5 py-1.5 rounded-full font-mono font-black text-xs flex items-center gap-1.5 border ${
                        timeLeft <= 5 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse' : 'bg-slate-800 text-amber-400 border-slate-700'
                      }`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{timeLeft} ثانية</span>
                      </div>
                    </div>

                    {/* نص السؤال بوضوح كامل وتشكيل للطالب */}
                    {currentQ && (
                      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 sm:p-5 text-center shadow-lg">
                        <span className="text-xs font-bold text-amber-400 block mb-1">
                          سُؤَالُ الجَوْلَةِ {((activeRoom.current_question_index || 0) + 1)}:
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-white leading-relaxed">
                          {currentQ.text}
                        </h3>
                      </div>
                    )}

                    {!hasAnswered ? (
                      /* واجهات إجابة الطالب المخصصة حسب نمط السؤال التفاعلي */
                      <div className="flex-1 flex flex-col justify-center space-y-3">
                        {/* 1. نمط صح أم خطأ (True / False): خياران عملاقان فقط */}
                        {currentQ?.type === 'true_false' ? (
                          <div className="flex-1 flex flex-col justify-center space-y-4">
                            <div className="text-center mb-1">
                              <span className="text-xs font-black text-amber-300 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>صَحٌّ أَمْ خَطَأ؟ اختر قرارك بسرعة! ⚡</span>
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                              {/* صواب */}
                              <button
                                type="button"
                                onClick={() => handleSelectAnswer(0)}
                                className="w-full min-h-[140px] sm:min-h-[160px] rounded-3xl p-5 flex flex-col items-center justify-center gap-3 text-center transition-all duration-150 shadow-xl border-4 active:scale-95 cursor-pointer bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 border-blue-400 shadow-blue-900/40 text-white"
                              >
                                <span className="text-5xl">🔷</span>
                                <span className="text-2xl sm:text-3xl font-black tracking-wide">صَوَابٌ</span>
                              </button>

                              {/* خطأ */}
                              <button
                                type="button"
                                onClick={() => handleSelectAnswer(1)}
                                className="w-full min-h-[140px] sm:min-h-[160px] rounded-3xl p-5 flex flex-col items-center justify-center gap-3 text-center transition-all duration-150 shadow-xl border-4 active:scale-95 cursor-pointer bg-gradient-to-br from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 border-rose-400 shadow-rose-900/40 text-white"
                              >
                                <span className="text-5xl">🔺</span>
                                <span className="text-2xl sm:text-3xl font-black tracking-wide">خَطَأٌ</span>
                              </button>
                            </div>
                          </div>
                        ) : currentQ?.type === 'type_answer' ? (
                          /* 2. نمط اكتب الإجابة (Type Answer): حقل إدخال نصي ذكي وكبير */
                          <div className="flex-1 flex flex-col justify-center space-y-4 max-w-lg mx-auto w-full">
                            <div className="text-center mb-1">
                              <span className="text-xs font-black text-amber-300 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>اكتب الإجابة بالتشكيل أو بدونه، ثم اضغط إرسال! ✍️</span>
                              </span>
                            </div>

                            <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
                              <input
                                type="text"
                                value={studentTextAnswer}
                                onChange={(e) => setStudentTextAnswer(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && studentTextAnswer.trim()) {
                                    handleSelectAnswer(0, { textAnswer: studentTextAnswer.trim() });
                                  }
                                }}
                                placeholder="اكتب إجابتك هنا يا بطل..."
                                autoFocus
                                className="w-full py-4 px-5 rounded-2xl bg-slate-950 border-2 border-indigo-500/60 focus:border-indigo-400 text-white placeholder:text-slate-500 font-black text-lg text-center focus:outline-hidden shadow-inner"
                              />

                              <button
                                type="button"
                                onClick={() => handleSelectAnswer(0, { textAnswer: studentTextAnswer.trim() })}
                                disabled={!studentTextAnswer.trim()}
                                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 text-slate-950 font-black text-base shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Send className="w-4 h-4" />
                                <span>تَأْكِيدُ وَإِرْسَالُ الإِجَابَةِ 🚀</span>
                              </button>
                            </div>
                          </div>
                        ) : currentQ?.type === 'puzzle' ? (
                          /* 3. نمط سباق الترتيب (Puzzle / Sequence): إعادة ترتيب البطاقات للأعلى والأسفل */
                          <div className="flex-1 flex flex-col justify-center space-y-3 max-w-lg mx-auto w-full">
                            <div className="text-center mb-1">
                              <span className="text-xs font-black text-amber-300 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5" />
                                <span>رتّب الكلمات بالسهمين لأعلى وأسفل ثم اضغط تأكيد الترتيب! 🧩</span>
                              </span>
                            </div>

                            <div className="space-y-2.5">
                              {(() => {
                                const currentOrder = studentPuzzleOrder.length === currentQ.options.length
                                  ? studentPuzzleOrder
                                  : currentQ.options.map((_, i) => i);

                                return currentOrder.map((optIdx, pos) => {
                                  const opt = currentQ.options[optIdx];
                                  if (!opt) return null;

                                  const moveUp = () => {
                                    if (pos === 0) return;
                                    const nextOrder = [...currentOrder];
                                    const temp = nextOrder[pos - 1];
                                    nextOrder[pos - 1] = nextOrder[pos];
                                    nextOrder[pos] = temp;
                                    setStudentPuzzleOrder(nextOrder);
                                  };

                                  const moveDown = () => {
                                    if (pos === currentOrder.length - 1) return;
                                    const nextOrder = [...currentOrder];
                                    const temp = nextOrder[pos + 1];
                                    nextOrder[pos + 1] = nextOrder[pos];
                                    nextOrder[pos] = temp;
                                    setStudentPuzzleOrder(nextOrder);
                                  };

                                  return (
                                    <div
                                      key={optIdx}
                                      className="p-3.5 rounded-2xl bg-slate-800 border-2 border-indigo-500/40 flex items-center justify-between gap-3 shadow-md"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center justify-center font-mono font-black text-sm">
                                          {pos + 1}
                                        </span>
                                        <span className="text-base font-black text-white">{opt.text}</span>
                                      </div>

                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={moveUp}
                                          disabled={pos === 0}
                                          className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white text-xs font-bold transition"
                                          title="تحريك لأعلى"
                                        >
                                          ▲
                                        </button>
                                        <button
                                          type="button"
                                          onClick={moveDown}
                                          disabled={pos === currentOrder.length - 1}
                                          className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white text-xs font-bold transition"
                                          title="تحريك لأسفل"
                                        >
                                          ▼
                                        </button>
                                      </div>
                                    </div>
                                  );
                                });
                              })()}

                              <button
                                type="button"
                                onClick={() => {
                                  const finalOrder = studentPuzzleOrder.length === currentQ.options.length
                                    ? studentPuzzleOrder
                                    : currentQ.options.map((_, i) => i);
                                  handleSelectAnswer(0, { orderAnswer: finalOrder });
                                }}
                                className="w-full py-3.5 mt-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Check className="w-4 h-4 stroke-[3]" />
                                <span>تَأْكِيدُ التَّرْتِيبِ النِّهَائِيِّ 🎯</span>
                              </button>
                            </div>
                          </div>
                        ) : currentQ?.type === 'word_cloud' ? (
                          /* 4. نمط سحابة الكلمات التفاعلية للطالب (Word Cloud Submission) */
                          <div className="flex-1 flex flex-col justify-center space-y-4 max-w-lg mx-auto w-full">
                            <div className="text-center mb-1">
                              <span className="text-xs font-black text-sky-300 bg-sky-400/10 border border-sky-400/20 px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5">
                                <Cloud className="w-3.5 h-3.5 text-sky-400" />
                                <span>سَحَابَةُ الكَلِمَاتِ: اكتب كلمتك لتتطاير على شاشة الصف! ☁️</span>
                              </span>
                            </div>

                            <div className="bg-slate-800/90 border border-sky-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
                              <input
                                type="text"
                                value={studentTextAnswer}
                                onChange={(e) => setStudentTextAnswer(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && studentTextAnswer.trim()) {
                                    handleSelectAnswer(0, { textAnswer: studentTextAnswer.trim() });
                                  }
                                }}
                                placeholder="اكتب كلمة أو فكرة هنا لتنضم للسحابة..."
                                autoFocus
                                className="w-full py-4 px-5 rounded-2xl bg-slate-950 border-2 border-sky-500/60 focus:border-sky-400 text-white placeholder:text-slate-500 font-black text-lg text-center focus:outline-hidden shadow-inner"
                              />

                              {/* كلمات مقترحة سريعة إن وجدت كخيارات مساعدة */}
                              {currentQ.acceptableAnswers && currentQ.acceptableAnswers.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="text-[11px] text-slate-400 font-bold block text-right">أفكار مقترحة سريعة:</span>
                                  <div className="flex items-center gap-2 flex-wrap justify-center">
                                    {currentQ.acceptableAnswers.map((sug, sIdx) => (
                                      <button
                                        key={sIdx}
                                        type="button"
                                        onClick={() => setStudentTextAnswer(sug)}
                                        className="text-xs font-bold px-3 py-1 rounded-xl bg-slate-900 border border-sky-500/30 text-sky-300 hover:bg-sky-950 transition"
                                      >
                                        + {sug}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => handleSelectAnswer(0, { textAnswer: studentTextAnswer.trim() })}
                                disabled={!studentTextAnswer.trim()}
                                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-40 text-white font-black text-base shadow-lg shadow-sky-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Send className="w-4 h-4" />
                                <span>أَرْسِلْ كَلِمَتَكَ لِلسَّحَابَةِ الآنَ ☁️</span>
                              </button>
                            </div>
                          </div>
                        ) : currentQ?.type === 'poll' ? (
                          /* 5. نمط استطلاع الرأي والتصويت للطالب (Poll Voting) */
                          <div className="flex-1 flex flex-col justify-center space-y-3">
                            <div className="text-center mb-1">
                              <span className="text-xs font-black text-indigo-300 bg-indigo-400/10 border border-indigo-400/20 px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5">
                                <Vote className="w-3.5 h-3.5 text-indigo-400" />
                                <span>اسْتِطْلاعُ رَأْيٍ: انقر على الخيار الذي يعبّر عن رأيك! 🗳️</span>
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1">
                              {(currentQ?.options || []).map((opt, idx) => {
                                const style = ARABIC_OPTION_STYLES[idx] || ARABIC_OPTION_STYLES[0];

                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSelectAnswer(idx)}
                                    className={`w-full min-h-[110px] sm:min-h-[130px] rounded-3xl p-5 flex items-center gap-4 text-right transition-all duration-150 shadow-xl border-4 active:scale-95 cursor-pointer relative overflow-hidden group ${style.bg} ${style.border}`}
                                  >
                                    <div className="w-12 h-12 rounded-2xl bg-black/30 border border-white/20 flex items-center justify-center text-xl font-black text-white shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                                      {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-base sm:text-lg font-black block leading-relaxed text-white">
                                        {opt.text}
                                      </span>
                                    </div>
                                    <div className="text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Check className="w-6 h-6" />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          /* 6. نمط الاختيار الكلاسيكي (Classic 4-choices) */
                          <div className="flex-1 flex flex-col justify-center space-y-3">
                            <div className="text-center mb-1">
                              <span className="text-xs font-black text-amber-300 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>اختر الحرف الصحيح بأسرع ما يمكن! ⚡</span>
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 flex-1">
                              {(currentQ?.options || [
                                { text: 'الخيار الأول' },
                                { text: 'الخيار الثاني' },
                                { text: 'الخيار الثالث' },
                                { text: 'الخيار الرابع' }
                              ]).map((opt, idx) => {
                                const style = ARABIC_OPTION_STYLES[idx] || ARABIC_OPTION_STYLES[0];

                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSelectAnswer(idx)}
                                    className={`w-full min-h-[110px] sm:min-h-[130px] rounded-3xl p-4 flex items-center gap-3.5 text-right transition-all duration-150 shadow-xl border-4 active:scale-95 cursor-pointer relative overflow-hidden group ${style.bg} ${style.border} ${style.shadow}`}
                                  >
                                    <div className="w-14 h-14 rounded-2xl bg-black/30 border border-white/20 flex items-center justify-center text-3xl font-black text-white shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                                      ({style.letter})
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-base sm:text-lg font-black block leading-relaxed text-white">
                                        {opt.text}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* شاشة تأكيد بعد النقر أو الإرسال */
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center text-4xl shadow-xl shadow-emerald-500/20 animate-bounce">
                          <Check className="w-10 h-10 stroke-[3]" />
                        </div>

                        <div className="space-y-2">
                          <h3 className="text-2xl sm:text-3xl font-black text-white">
                            تم استلام إجابتك! في انتظار بقية الأبطال ⏳
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                            أحسنت يا بطل في سرعة البديهة! يتم الآن احتساب نقاطك وسرعة إجابتك بدقة.
                          </p>
                        </div>

                        {currentQ.type === 'word_cloud' ? (
                          <div className="px-5 py-3 rounded-2xl bg-sky-950/70 border border-sky-500/50 flex items-center gap-2.5 shadow-md text-sky-200">
                            <Cloud className="w-5 h-5 text-sky-400" />
                            <span className="text-xs font-black">
                              تمت إضافة كلمتك: «{lastSubmittedAnswerDetail?.textAnswer || studentTextAnswer || 'مشاركتك'}» لتتطاير في سحابة الصف ☁️
                            </span>
                          </div>
                        ) : currentQ.type === 'poll' ? (
                          <div className="px-5 py-3 rounded-2xl bg-indigo-950/70 border border-indigo-500/50 flex items-center gap-2.5 shadow-md text-indigo-200">
                            <Vote className="w-5 h-5 text-indigo-400" />
                            <span className="text-xs font-black">
                              تم تسجيل صوتك بنجاح في الاستطلاع 🗳️
                            </span>
                          </div>
                        ) : currentQ.type === 'type_answer' ? (
                          <div className="px-5 py-2.5 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center gap-2.5 shadow-md">
                            <span className="text-xs font-black text-amber-300">
                              إجابتك المكتوبة: «{studentTextAnswer || lastSubmittedAnswerDetail?.textAnswer || 'مسجلة'}»
                            </span>
                          </div>
                        ) : currentQ.type === 'true_false' ? (
                          <div className="px-5 py-2.5 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center gap-2.5 shadow-md">
                            <span className="text-xs font-black text-amber-300">
                              إجابتك المختارة: {selectedOptionIndex === 0 ? '🔷 صَوَاب' : '🔺 خَطَأ'}
                            </span>
                          </div>
                        ) : currentQ.type === 'puzzle' ? (
                          <div className="px-5 py-2.5 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center gap-2.5 shadow-md">
                            <span className="text-xs font-black text-amber-300">
                              تم تسجيل ترتيبك بنجاح 🧩
                            </span>
                          </div>
                        ) : (
                          selectedOptionIndex !== null && currentQ.options[selectedOptionIndex] && (
                            <div className="px-5 py-2.5 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center gap-2.5 shadow-md">
                              <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-base font-black shrink-0">
                                ({ARABIC_OPTION_LETTERS[selectedOptionIndex] || 'أ'})
                              </span>
                              <span className="text-xs font-black text-amber-300 truncate">
                                إجابتك المسجلة: ({ARABIC_OPTION_LETTERS[selectedOptionIndex] || 'أ'}) {currentQ.options[selectedOptionIndex].text}
                              </span>
                            </div>
                          )
                        )}

                        <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                          <span>في انتظار إعلان المعلم للنتيجة...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* C. شاشة كشف النتيجة للطالب (Player Result Feedback) */}
                {activeRoom.status === 'question_revealed' && currentQ && (
                  <div className="flex-1 flex flex-col justify-center space-y-5 py-4 animate-in zoom-in-95 duration-200 max-w-lg mx-auto w-full">
                    {/* شارة توضيحية فورية خاصة بالطالب */}
                    {currentQ.type === 'word_cloud' || currentQ.type === 'poll' ? (
                      <div className="p-5 rounded-3xl border text-center font-black shadow-xl bg-gradient-to-r from-sky-950/80 to-indigo-950/80 border-sky-500/50 text-sky-200 shadow-indigo-900/30">
                        <div className="text-3xl mb-1.5">🌟 شُكْراً لِمُشَارَكَتِكَ الفَعَّالَةِ!</div>
                        <div className="text-sm">
                          حصلت على +1000 نقطة لمشاركتك وإثراء الحوار مع زملائك في الصف!
                        </div>
                      </div>
                    ) : answerResult ? (
                      <div className={`p-5 rounded-3xl border text-center font-black shadow-xl ${
                        answerResult.isCorrect
                          ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200 shadow-emerald-900/30'
                          : 'bg-rose-950/80 border-rose-500/50 text-rose-200 shadow-rose-900/30'
                      }`}>
                        <div className="text-3xl mb-1.5">{answerResult.isCorrect ? '🎉 إِجَابَةٌ رَائِعَةٌ وَصَحِيحَةٌ!' : '💫 حَظًّا أَوْفَرَ فِي السُّؤَالِ القَادِمِ!'}</div>
                        <div className="text-sm">
                          {answerResult.isCorrect ? `حصلت على +${answerResult.points} نقطة لسرعة البديهة!` : 'لم تحصل على نقاط، ركز في السؤال القادم للتعويض!'}
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 rounded-3xl bg-slate-800 border border-slate-700 text-center font-black text-slate-300">
                        انتهى الوقت قبل تسجيل الإجابة! استعد للسؤال القادم.
                      </div>
                    )}

                    {/* بطاقة الإجابة الصحيحة وشرح موسى */}
                    <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-5 shadow-xl space-y-3 text-right">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
                          💡
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 font-bold block">الإِجَابَةُ الصَّحِيحَةُ:</span>
                          <span className="text-base font-black text-white">
                            {currentQ.type === 'true_false' ? (
                              currentQ.correctIndex === 0 ? '🔷 صَوَابٌ (صَحِيحٌ)' : '🔺 خَطَأٌ (غَيْرُ صَحِيحٍ)'
                            ) : currentQ.type === 'type_answer' ? (
                              `«${currentQ.correctAnswerText || currentQ.acceptableAnswers?.[0] || ''}»`
                            ) : currentQ.type === 'puzzle' ? (
                              currentQ.correctOrder && currentQ.correctOrder.length > 0
                                ? currentQ.correctOrder.map(idx => currentQ.options[idx]?.text || '').filter(Boolean).join(' ⬅️ ')
                                : currentQ.options.map(o => o.text).join(' ⬅️ ')
                            ) : currentQ.type === 'poll' || currentQ.type === 'word_cloud' ? (
                              'مشاركة جماعية مقبولة'
                            ) : (
                              `(${ARABIC_OPTION_LETTERS[currentQ.correctIndex] || 'أ'}) ${currentQ.options[currentQ.correctIndex]?.text}`
                            )}
                          </span>
                        </div>
                      </div>

                      {currentQ.explanation && (
                        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs font-medium text-slate-200 leading-relaxed">
                          <span className="font-bold text-amber-300 block mb-0.5">معلومة من موسى:</span>
                          {currentQ.explanation}
                        </div>
                      )}
                    </div>

                    <div className="text-center text-xs text-slate-500 font-bold flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>في انتظار انتقال المعلم للسؤال التالي أو لوحة الصدارة...</span>
                    </div>
                  </div>
                )}

                {/* D. شاشة لوحة الصدارة للطالب مع ترتيبه الخاص (Player Leaderboard Rank) */}
                {activeRoom.status === 'leaderboard' && (
                  <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full py-4 space-y-4 animate-in fade-in duration-300">
                    {/* شارة الترتيب الخاص بالطالب */}
                    <div className="p-4 rounded-3xl bg-gradient-to-r from-indigo-900/60 via-purple-900/60 to-slate-900 border border-indigo-500/40 text-center shadow-xl">
                      <span className="text-xs text-indigo-300 font-bold block mb-1">تَرْتِيبُكَ فِي هَذِهِ الجَوْلَةِ 🏅</span>
                      <div className="text-2xl font-black text-amber-300">
                        المركز #{studentRank > 0 ? studentRank : '-'}
                      </div>
                      <span className="text-xs font-mono text-slate-300 mt-1 block">
                        مجموع نقاطك: {studentScore.toLocaleString()} نقطة
                      </span>
                    </div>

                    {/* قائمة المتصدرين */}
                    <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-4 space-y-2 shadow-xl max-h-72 overflow-y-auto">
                      <span className="text-xs font-bold text-slate-400 block px-1">المتصدرون:</span>
                      {sortedPlayers.slice(0, 5).map((player, idx) => {
                        const isCurrent = player.id === currentUser.id;
                        return (
                          <div
                            key={player.id}
                            className={`p-2.5 rounded-xl flex items-center justify-between border text-xs font-black ${
                              isCurrent
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                : 'bg-slate-900/60 border-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}</span>
                              <span>{player.name} {isCurrent && '(أنت)'}</span>
                            </div>
                            <span className="font-mono text-white">{player.score.toLocaleString()}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-center text-xs text-slate-500 font-bold flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>استعد... المعلم سينتقل للسؤال القادم قريباً! ⚡</span>
                    </div>
                  </div>
                )}

                {/* E. منصة التتويج النهائية للطالب (Player Podium) */}
                {activeRoom.status === 'finished' && (
                  <div className="flex-1 flex flex-col items-center justify-center py-4 space-y-6 text-center animate-in zoom-in-95 duration-500 max-w-md mx-auto w-full">
                    <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center text-4xl shadow-xl">
                      {studentRank === 1 ? '👑' : studentRank <= 3 ? '🏆' : '🌟'}
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-3xl font-black text-white">
                        {studentRank === 1 ? 'مبارك يا بطل! أنت المركز الأول 🥇' : studentRank <= 3 ? 'رائع جداً! أنت على منصة التتويج 🏅' : 'أحسنت الأداء يا بطل! 👏'}
                      </h3>
                      <p className="text-sm text-amber-300 font-black">
                        أنهيت التحدي في المركز #{studentRank > 0 ? studentRank : '-'} برصيد {studentScore.toLocaleString()} نقطة!
                      </p>
                    </div>

                    <button
                      onClick={handleLeaveRoom}
                      className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg transition cursor-pointer"
                    >
                      العودة للرئيسية 🚀
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
