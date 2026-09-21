import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, Play, Users, Sparkles, Plus, Clock, Award, Flame, CheckCircle2, 
  XCircle, RotateCcw, Volume2, VolumeX, ArrowRight, BookOpen, AlertCircle, 
  ChevronRight, BarChart3, HelpCircle, Loader2, Copy, Check, Radio, PlayCircle, Eye, LogOut
} from 'lucide-react';
import { 
  UserProfile, GradeLevel, ArabicTrack, ChallengeQuiz, ChallengeRoom, 
  ChallengeQuestion, ChallengePlayer, ChallengePlayerAnswer, ChallengeShape 
} from '../types';
import { 
  getChallengeQuizzes, saveChallengeQuiz, deleteChallengeQuiz, 
  getChallengeRooms, saveChallengeRoom, syncChallengeRoomFromCloud, 
  syncChallengeQuizzesFromCloud, getChallengeRoomByPin, normalizeRoomPlayers
} from '../storage';
import { supabase } from '../supabaseClient';
import { generateAIChallengeQuestions, autoTashkeelText } from '../geminiService';
import { SHAPE_CONFIG, DEFAULT_SHAPES, INITIAL_CHALLENGE_QUIZZES } from '../data/challengeData';
import { challengeAudio } from '../utils/challengeAudio';
import confetti from 'canvas-confetti';

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
  const [playerNameInput, setPlayerNameInput] = useState(currentUser.name || '');
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

  // نموذج إنشاء تحدي جديد (AI أو يدوي)
  const [creationMode, setCreationMode] = useState<'ai' | 'manual'>('ai');
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState<number>(4);
  const [aiTimeLimit, setAiTimeLimit] = useState<number>(20);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizQuestions, setNewQuizQuestions] = useState<ChallengeQuestion[]>([]);

  // محرر يدوي لسؤال
  const [manualQuestionText, setManualQuestionText] = useState('');
  const [manualExplanation, setManualExplanation] = useState('');
  const [manualOptions, setManualOptions] = useState<string[]>(['', '', '', '']);
  const [manualCorrectIndex, setManualCorrectIndex] = useState<number>(0);
  const [manualTimeLimit, setManualTimeLimit] = useState<number>(20);
  const [isTashkeelActive, setIsTashkeelActive] = useState(false);

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

    // 1. استماع للتحديثات المحلية عبر CustomEvent
    const handleLocalUpdate = (e: any) => {
      const updated = e.detail as ChallengeRoom;
      if (updated && updated.pin === roomPin) {
        const incomingStatus = (updated.status === 'in_progress') ? 'question_active' : updated.status;
        setActiveRoom(prev => {
          if (!prev) return { ...updated, status: incomingStatus };
          return {
            ...updated,
            status: incomingStatus,
            questions: (Array.isArray(updated.questions) && updated.questions.length > 0) ? updated.questions : prev.questions
          };
        });
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
            const incomingStatus = (found.status === 'in_progress') ? 'question_active' : found.status;
            setActiveRoom(prev => {
              if (!prev) return { ...found, status: incomingStatus };
              return {
                ...found,
                status: incomingStatus,
                questions: (Array.isArray(found.questions) && found.questions.length > 0) ? found.questions : prev.questions
              };
            });
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
            const incomingStatus = (updated.status === 'in_progress') ? 'question_active' : updated.status;
            setActiveRoom(prev => {
              if (!prev) return { ...updated, status: incomingStatus };
              return {
                ...updated,
                status: incomingStatus,
                questions: (Array.isArray(updated.questions) && updated.questions.length > 0) ? updated.questions : prev.questions
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
            const data: any = payload.new;
            const incomingStatus = (data.status === 'in_progress') ? 'question_active' : data.status;
            setActiveRoom(prev => {
              if (!prev) return null;
              const settingsQuestions = data.settings?.questions;
              const extractedQuestions = (Array.isArray(data.questions) && data.questions.length > 0)
                ? data.questions
                : ((Array.isArray(settingsQuestions) && settingsQuestions.length > 0) ? settingsQuestions : prev.questions);

              const formatted: ChallengeRoom = {
                ...prev,
                id: data.id || prev.id,
                pin: data.pin || prev.pin,
                quiz_id: data.quiz_id || data.settings?.quiz_id || prev.quiz_id,
                quiz_title: data.quiz_title || data.settings?.quiz_title || prev.quiz_title,
                host_id: data.host_id || prev.host_id,
                host_name: data.host_name || data.settings?.host_name || prev.host_name,
                target_grade: data.target_grade || data.settings?.target_grade || prev.target_grade,
                status: incomingStatus,
                current_question_index: (typeof data.current_question_index === 'number') ? data.current_question_index : prev.current_question_index,
                questions: (Array.isArray(extractedQuestions) && extractedQuestions.length > 0) ? extractedQuestions : prev.questions,
                players: data.players ? normalizeRoomPlayers(data.players) : prev.players,
                answers_received: Array.isArray(data.answers_received) ? data.answers_received : prev.answers_received,
                question_start_time: data.settings?.question_start_time || prev.question_start_time,
                created_at: data.created_at || prev.created_at,
                updated_at: data.updated_at
              };
              return formatted;
            });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // 5. فحص دوري استباقي احتياطي (Polling Fallback) كل 1 ثانية عبر السحابة وخادم الشبكة لضمان المزامنة الفورية
    const pollInterval = setInterval(async () => {
      // أ) فحص سحابي عبر Supabase
      try {
        const { data, error } = await supabase
          .from('challenge_rooms')
          .select('*')
          .eq('pin', roomPin)
          .maybeSingle();

        if (!error && data) {
          const incomingStatus = (data.status === 'in_progress') ? 'question_active' : data.status;
          setActiveRoom(prev => {
            if (!prev) return null;
            const settingsQuestions = data.settings?.questions;
            const questionsToUse = (Array.isArray(data.questions) && data.questions.length > 0)
              ? data.questions
              : ((Array.isArray(settingsQuestions) && settingsQuestions.length > 0) ? settingsQuestions : prev.questions);

            if (
              prev.status !== incomingStatus ||
              prev.current_question_index !== data.current_question_index ||
              (data.answers_received && data.answers_received.length !== prev.answers_received?.length) ||
              (data.players && Object.keys(data.players).length !== Object.keys(prev.players).length) ||
              (!prev.questions || prev.questions.length === 0)
            ) {
              return {
                ...prev,
                status: incomingStatus,
                current_question_index: (typeof data.current_question_index === 'number') ? data.current_question_index : prev.current_question_index,
                questions: (Array.isArray(questionsToUse) && questionsToUse.length > 0) ? questionsToUse : prev.questions,
                players: data.players ? normalizeRoomPlayers(data.players) : prev.players,
                answers_received: Array.isArray(data.answers_received) ? data.answers_received : prev.answers_received,
                question_start_time: data.settings?.question_start_time || prev.question_start_time
              };
            }
            return prev;
          });
        }
      } catch {}

      // ب) فحص عبر خادم الشبكة المحلي (Fast Local Network Fallback)
      try {
        const resp = await fetch(`/api/challenge/rooms/${roomPin}`);
        if (resp.ok) {
          const json = await resp.json();
          if (json?.room) {
            const lr = json.room;
            const incomingStatus = (lr.status === 'in_progress') ? 'question_active' : lr.status;
            setActiveRoom(prev => {
              if (!prev) return lr;
              if (
                prev.status !== incomingStatus ||
                prev.current_question_index !== lr.current_question_index ||
                (!prev.questions || prev.questions.length === 0)
              ) {
                return {
                  ...prev,
                  ...lr,
                  status: incomingStatus,
                  questions: (Array.isArray(lr.questions) && lr.questions.length > 0) ? lr.questions : prev.questions,
                  players: lr.players ? normalizeRoomPlayers(lr.players) : prev.players
                };
              }
              return prev;
            });
          }
        }
      } catch {}
    }, 1000);

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

  // إدارة المؤقت التنازلي التفاعلي
  useEffect(() => {
    if (!activeRoom || (activeRoom.status !== 'question_active' && activeRoom.status !== 'in_progress')) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const currentQ = activeRoom.questions[activeRoom.current_question_index];
    if (!currentQ) return;

    // إعادة تهيئة حالة إجابة الطالب عند السؤال الجديد
    setSelectedOptionIndex(null);
    setHasAnswered(false);
    setAnswerResult(null);

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
        host_name: currentUser.name
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
      question_start_time: Date.now()
    };
    const saved = await saveChallengeRoom(updated);
    setActiveRoom(saved);
  };

  // كشف الإجابة الصحيحة وشرح موسى
  const handleRevealAnswer = async () => {
    if (!activeRoom) return;
    const updated: ChallengeRoom = {
      ...activeRoom,
      status: 'question_revealed'
    };
    const saved = await saveChallengeRoom(updated);
    setActiveRoom(saved);
  };

  // الانتقال للوحة الصدارة
  const handleShowLeaderboard = async () => {
    if (!activeRoom) return;
    const updated: ChallengeRoom = {
      ...activeRoom,
      status: 'leaderboard'
    };
    const saved = await saveChallengeRoom(updated);
    setActiveRoom(saved);
  };

  // الانتقال للسؤال التالي أو إنهاء المسابقة
  const handleNextQuestion = async () => {
    if (!activeRoom) return;
    const nextIndex = activeRoom.current_question_index + 1;
    if (nextIndex < activeRoom.questions.length) {
      const updated: ChallengeRoom = {
        ...activeRoom,
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
        } else {
          // فحص خادم الشبكة المحلي (Local Network Server Fallback)
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
            }
          } catch {}
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

  // إرسال الإجابة وحساب النقاط وسرعة النقر
  const handleSelectAnswer = async (optionIndex: number) => {
    if (!activeRoom || hasAnswered) return;
    if (activeRoom.status !== 'question_active' && activeRoom.status !== 'in_progress') return;

    const currentQ = activeRoom.questions?.[activeRoom.current_question_index];
    const qId = currentQ?.id || `q_${activeRoom.current_question_index || 0}`;

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch {}

    setHasAnswered(true);
    setSelectedOptionIndex(optionIndex);

    const isCorrect = currentQ ? (optionIndex === currentQ.correctIndex) : true;
    const timeLimit = currentQ?.timeLimitSeconds || 20;
    const startTime = activeRoom.question_start_time || Date.now();
    const timeTakenMs = Math.max(100, Date.now() - startTime);

    // حساب النقاط بناءً على الصحة والسرعة
    // الحد الأقصى: 1000 نقطة للسؤال + بونص سرعة
    let points = 0;
    if (isCorrect) {
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
          isCorrect,
          timeTakenMs,
          pointsEarned: points,
          answeredAt: Date.now()
        }
      }
    };

    const existingAnswers = Array.isArray(activeRoom.answers_received) ? [...activeRoom.answers_received] : [];
    const updatedAnswers = [
      ...existingAnswers.filter((a: any) => !(a.playerId === playerId && a.questionIndex === activeRoom.current_question_index)),
      {
        playerId,
        playerName: currentUser.name || playerNameInput || 'بطل التحدي',
        questionIndex: activeRoom.current_question_index,
        optionIndex,
        isCorrect,
        points,
        answeredAt: Date.now()
      }
    ];

    const updatedRoom: ChallengeRoom = {
      ...activeRoom,
      players: updatedPlayers,
      answers_received: updatedAnswers
    };

    await saveChallengeRoom(updatedRoom);
    setActiveRoom(updatedRoom);
  };

  // ================= توليد الأسئلة وإنشاء التحديات =================

  // توليد عبر الذكاء الاصطناعي (Gemini 2.5 Flash)
  const handleGenerateWithAI = async () => {
    if (!aiTopic.trim()) return;
    setIsGeneratingAi(true);
    try {
      const generated = await generateAIChallengeQuestions({
        topic: aiTopic,
        grade: selectedGrade,
        count: aiCount,
        timeLimitSeconds: aiTimeLimit
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

  // إضافة سؤال يدوي
  const handleAddManualQuestion = () => {
    if (!manualQuestionText.trim() || manualOptions.some(o => !o.trim())) return;

    const newQ: ChallengeQuestion = {
      id: `q_man_${Date.now()}`,
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

    setNewQuizQuestions(prev => [...prev, newQ]);
    // إعادة تعيين الحقول
    setManualQuestionText('');
    setManualExplanation('');
    setManualOptions(['', '', '', '']);
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

  // حساب ترتيب المتصدرين
  const sortedPlayers = Object.values(activeRoom?.players || {}).sort((a, b) => b.score - a.score);
  const currentPlayer = activeRoom ? activeRoom.players[currentUser.id] : null;
  const studentRank = sortedPlayers.findIndex(p => p.id === currentUser.id) + 1;
  const studentScore = currentPlayer?.score || 0;

  // إحصائيات إجابات السؤال الحالي
  const currentQ = activeRoom?.questions[activeRoom.current_question_index];
  const optionAnswerCounts = [0, 0, 0, 0];
  let totalAnswersCount = 0;
  if (activeRoom && currentQ) {
    if (Array.isArray(activeRoom.answers_received) && activeRoom.answers_received.length > 0) {
      activeRoom.answers_received.forEach((ans: any) => {
        if (ans.questionIndex === activeRoom.current_question_index) {
          const idx = ans.optionIndex;
          if (idx >= 0 && idx < 4) {
            optionAnswerCounts[idx]++;
            totalAnswersCount++;
          }
        }
      });
    } else {
      Object.values(activeRoom.players).forEach(p => {
        if (p.lastAnswer && p.lastAnswer.questionId === currentQ.id) {
          const idx = p.lastAnswer.selectedIndex;
          if (idx >= 0 && idx < 4) {
            optionAnswerCounts[idx]++;
            totalAnswersCount++;
          }
        }
      });
    }
  }

  // نسخ الرمز
  const handleCopyPin = () => {
    if (activeRoom) {
      navigator.clipboard.writeText(activeRoom.pin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 font-sans select-none overflow-hidden rounded-2xl border border-slate-800 shadow-2xl relative">
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

                {/* الخيارات الأربعة مع الأشكال التنافسية */}
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
                  disabled={!manualQuestionText.trim() || manualOptions.some(o => !o.trim())}
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
                        <span className="font-bold text-amber-400">سؤال {qIdx + 1} ({q.timeLimitSeconds} ثانية)</span>
                        <button
                          onClick={() => setNewQuizQuestions(prev => prev.filter((_, idx) => idx !== qIdx))}
                          className="text-rose-400 hover:text-rose-300 transition"
                        >
                          حذف
                        </button>
                      </div>
                      <p className="text-sm font-black text-white">{q.text}</p>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {q.options.map((opt, oIdx) => {
                          const cfg = SHAPE_CONFIG[opt.shape];
                          const isCorrect = oIdx === q.correctIndex;
                          return (
                            <div
                              key={oIdx}
                              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 border ${
                                isCorrect
                                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                                  : 'bg-slate-800/40 border-slate-700/40 text-slate-300'
                              }`}
                            >
                              <span>{cfg.symbol}</span>
                              <span className="truncate">{opt.text}</span>
                              {isCorrect && <Check className="w-3.5 h-3.5 text-emerald-400 mr-auto shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
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
                      <button
                        onClick={handleShowLeaderboard}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-md transition flex items-center gap-1 cursor-pointer"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>لَوْحَةُ الصَّدَارَةِ 📊</span>
                      </button>
                    )}

                    {activeRoom.status === 'leaderboard' && (
                      <button
                        onClick={handleNextQuestion}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>{activeRoom.current_question_index + 1 < activeRoom.questions.length ? 'السُّؤَالُ التَّالِي ❯' : 'مِنَصَّةُ التَّتْوِيجِ 🏆'}</span>
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
                        السُّؤَالُ {activeRoom.current_question_index + 1} مِنْ {activeRoom.questions.length}
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

                    {/* بطاقات الخيارات الأربعة - للعرض فقط على شاشة المعلم/السبورة الذكية (Display Only - No Answering) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {currentQ.options.map((opt, idx) => {
                        const shape = opt.shape || DEFAULT_SHAPES[idx] || 'triangle';
                        const cfg = SHAPE_CONFIG[shape] || SHAPE_CONFIG.triangle;

                        return (
                          <div
                            key={idx}
                            className={`p-4 rounded-2xl border-2 flex items-center gap-4 text-right select-none shadow-md ${cfg.bgClass} ${cfg.borderClass}`}
                          >
                            <div className="w-12 h-12 rounded-2xl bg-black/25 flex items-center justify-center text-3xl shrink-0 shadow-inner">
                              {cfg.symbol}
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

                    {/* شريط التحكم السفلي للمعلم */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-slate-500 font-medium">
                        💡 تنبيه: الطلاب يجيبون الآن عبر هواتفهم/أجهزتهم بالأشكال التنافسية الأربعة.
                      </span>
                      <button
                        onClick={handleRevealAnswer}
                        className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>كَشْفُ الإِجَابَةِ المعتمدة 💡</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* C. شاشة كشف الإجابة الصحيحة للمعلم مع الإحصائيات (Host Revealed View) */}
                {activeRoom.status === 'question_revealed' && currentQ && (
                  <div className="flex-1 flex flex-col justify-center space-y-5 py-4 animate-in zoom-in-95 duration-200 max-w-4xl mx-auto w-full">
                    {/* بطاقة الإجابة الصحيحة وشرح موسى */}
                    <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-5">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-3xl shadow-inner">
                          💡
                        </div>
                        <div>
                          <span className="text-xs text-slate-400 font-bold">الإِجَابَةُ الصَّحِيحَةُ المَعْتَمَدَةُ:</span>
                          <h3 className="text-2xl font-black text-white flex items-center gap-2">
                            <span>{SHAPE_CONFIG[currentQ.options[currentQ.correctIndex].shape]?.symbol}</span>
                            <span>{currentQ.options[currentQ.correctIndex].text}</span>
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

                      {/* توزيع إجابات الطلاب على الخيارات الأربعة */}
                      <div className="space-y-2 pt-2">
                        <span className="text-xs font-bold text-slate-400 block">إحصائيات إجابات الصف الحالية:</span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {currentQ.options.map((opt, idx) => {
                            const count = optionAnswerCounts[idx];
                            const pct = totalAnswersCount > 0 ? Math.round((count / totalAnswersCount) * 100) : 0;
                            const shape = opt.shape || DEFAULT_SHAPES[idx] || 'triangle';
                            const cfg = SHAPE_CONFIG[shape] || SHAPE_CONFIG.triangle;
                            const isCorrect = idx === currentQ.correctIndex;

                            return (
                              <div
                                key={idx}
                                className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center text-center ${
                                  isCorrect ? 'bg-emerald-950/60 border-emerald-500/50' : 'bg-slate-900/60 border-slate-800'
                                }`}
                              >
                                <span className="text-2xl">{cfg.symbol}</span>
                                <span className="text-base font-black text-white mt-1">{count} إجابة</span>
                                <span className="text-xs text-slate-400 font-bold">{pct}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={handleShowLeaderboard}
                        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>الانْتِقَالُ إِلَى لَوْحَةِ الصَّدَارَةِ 📊</span>
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
                        <span>{activeRoom.current_question_index + 1 < activeRoom.questions.length ? 'السُّؤَالُ التَّالِي ❯' : 'مِنَصَّةُ التَّتْوِيجِ 🏆'}</span>
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
                        أنت متصل الآن بغرفة التحدي <span className="text-amber-400 font-mono font-bold">{activeRoom.pin}</span>. استعد لاختيار الأشكال التنافسية بأعلى سرعة فور انطلاق السؤال!
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
                        السُّؤَالُ {(activeRoom.current_question_index || 0) + 1} مِنْ {Math.max(1, activeRoom.questions?.length || 1)}
                      </span>
                      <div className={`px-3.5 py-1.5 rounded-full font-mono font-black text-xs flex items-center gap-1.5 border ${
                        timeLeft <= 5 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse' : 'bg-slate-800 text-amber-400 border-slate-700'
                      }`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{timeLeft} ثانية</span>
                      </div>
                    </div>

                    {!hasAnswered ? (
                      /* أزرار الإجابة التنافسية الأربعة الكبيرة (🔺 أحمر، 🔷 أزرق، 🟡 أصفر، 🟩 أخضر) */
                      <div className="flex-1 flex flex-col justify-center space-y-3">
                        <div className="text-center mb-1">
                          <span className="text-xs font-black text-amber-300 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>اختر الشكل واللون المطابق لإجابتك بسرعة! ⚡</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:gap-4 flex-1 max-h-[480px]">
                          {(currentQ?.options || [
                            { text: 'الخيار الأول', shape: 'triangle' },
                            { text: 'الخيار الثاني', shape: 'diamond' },
                            { text: 'الخيار الثالث', shape: 'circle' },
                            { text: 'الخيار الرابع', shape: 'square' }
                          ]).map((opt, idx) => {
                            const shape = (opt as any).shape || DEFAULT_SHAPES[idx] || 'triangle';
                            const cfg = SHAPE_CONFIG[shape] || SHAPE_CONFIG.triangle;

                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSelectAnswer(idx)}
                                className={`w-full h-full min-h-[140px] sm:min-h-[170px] rounded-3xl p-4 flex flex-col items-center justify-center text-center transition-all duration-150 shadow-xl border-4 active:scale-95 cursor-pointer relative overflow-hidden group ${
                                  idx === 0 
                                    ? 'bg-rose-600 hover:bg-rose-500 border-rose-700 text-white shadow-rose-900/30' 
                                    : idx === 1 
                                    ? 'bg-blue-600 hover:bg-blue-500 border-blue-700 text-white shadow-blue-900/30' 
                                    : idx === 2 
                                    ? 'bg-amber-500 hover:bg-amber-400 border-amber-600 text-slate-950 shadow-amber-900/30' 
                                    : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-700 text-white shadow-emerald-900/30'
                                }`}
                              >
                                <div className="text-5xl sm:text-6xl md:text-7xl mb-2 filter drop-shadow-md group-hover:scale-110 transition-transform duration-150">
                                  {cfg.symbol}
                                </div>
                                <span className="text-base sm:text-lg font-black tracking-wide">
                                  {cfg.name} ({cfg.colorName})
                                </span>
                                {opt.text && (
                                  <span className="text-[11px] opacity-80 mt-1 font-bold line-clamp-1 px-2">
                                    {opt.text}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* شاشة تأكيد بعد النقر: «تم استلام إجابتك! في انتظار بقية الأبطال» */
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

                        {selectedOptionIndex !== null && currentQ.options[selectedOptionIndex] && (
                          <div className="px-5 py-2.5 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center gap-2.5 shadow-md">
                            <span className="text-xl">
                              {SHAPE_CONFIG[currentQ.options[selectedOptionIndex].shape]?.symbol}
                            </span>
                            <span className="text-xs font-black text-amber-300">
                              إجابتك المسجلة: {SHAPE_CONFIG[currentQ.options[selectedOptionIndex].shape]?.name} ({SHAPE_CONFIG[currentQ.options[selectedOptionIndex].shape]?.colorName})
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                          <span>في انتظار إعلان المعلم للنتيجة الصحيحة...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* C. شاشة كشف النتيجة للطالب (Player Result Feedback) */}
                {activeRoom.status === 'question_revealed' && currentQ && (
                  <div className="flex-1 flex flex-col justify-center space-y-5 py-4 animate-in zoom-in-95 duration-200 max-w-lg mx-auto w-full">
                    {/* شارة توضيحية فورية خاصة بالطالب */}
                    {answerResult ? (
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
                            {SHAPE_CONFIG[currentQ.options[currentQ.correctIndex].shape]?.symbol} {currentQ.options[currentQ.correctIndex].text}
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
                      <span>في انتظار انتقال المعلم إلى لوحة الصدارة...</span>
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
