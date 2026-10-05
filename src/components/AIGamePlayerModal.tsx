import React, { useState, useEffect } from 'react';
import { 
  X, Award, Sparkles, Volume2, VolumeX, ArrowRight, RotateCcw, 
  CheckCircle2, Star, Trophy, ArrowLeft, Lightbulb,
  Search, FlaskConical, Scale, Flame, Zap, RefreshCw, Target
} from 'lucide-react';
import { Activity, GameData, GameLevel, UserProfile, ChildBadge } from '../types';
import { speakWithMousaVoice, stopMousaVoice, prebufferMousaAudio } from '../geminiService';
import { saveStudentBadge, saveSubmission } from '../storage';
import { getRandomized20Questions } from '../data/questionPoolGenerator';
import { ADAPTIVE_LEVELS_META } from '../data/adaptiveGamesData';
import { ShareableBadgeModal } from './ShareableBadgeModal';

// مسار صورة موسى
const MOUSA_AVATAR_SRC = '/mousa-avatar.png';

interface AIGamePlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: Activity;
  student: UserProfile;
  onGameCompleted?: (earnedBadge?: ChildBadge) => void;
}

// دالة توليد المؤثرات الصوتية التفاعلية عبر Web Audio API
function playSound(type: 'correct' | 'wrong' | 'pop' | 'victory') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'pop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'correct') {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const startTime = ctx.currentTime + idx * 0.09;
        gain.gain.setValueAtTime(0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.25);
      });
    } else if (type === 'wrong') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(140, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'victory') {
      const fanfare = [
        { f: 523.25, d: 0.15 },
        { f: 659.25, d: 0.15 },
        { f: 783.99, d: 0.15 },
        { f: 1046.5, d: 0.4 },
        { f: 880, d: 0.2 },
        { f: 1046.5, d: 0.6 }
      ];
      let t = ctx.currentTime;
      fanfare.forEach(({ f, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + d);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + d);
        t += d * 0.9;
      });
    }
  } catch (e) {
    // Web Audio non-blocking
  }
}

export const AIGamePlayerModal: React.FC<AIGamePlayerModalProps> = ({
  isOpen,
  onClose,
  activity,
  student,
  onGameCompleted
}) => {
  const gameData: GameData | undefined = activity.gameData;

  // استخراج المستوى التكيفي الحالي
  const initialAdaptiveLevel = React.useMemo(() => {
    const match = activity.id.match(/lvl(\d+)/) || activity.title.match(/المستوى\s*(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }, [activity.id, activity.title]);

  const [currentAdaptiveLevel, setCurrentAdaptiveLevel] = useState<number>(initialAdaptiveLevel);

  // مصفوفة الـ 20 سؤالاً عشوائياً للجولة الحالية
  const [activeLevels, setActiveLevels] = useState<GameLevel[]>(() => {
    if (activity.gameData?.gameType) {
      return getRandomized20Questions(activity.gameData.gameType, initialAdaptiveLevel);
    }
    return activity.gameData?.levels || [];
  });

  const [currentLevelIndex, setCurrentLevelIndex] = useState<number>(0);
  const [stars, setStars] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [milestoneNotification, setMilestoneNotification] = useState<{
    title: string;
    subtitle: string;
    icon: string;
    badge: string;
  } | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [levelStatus, setLevelStatus] = useState<'playing' | 'success' | 'hint'>('playing');
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');
  const [shakeError, setShakeError] = useState<boolean>(false);
  const [showShareBadgeModal, setShowShareBadgeModal] = useState<boolean>(false);
  const [currentEarnedBadge, setCurrentEarnedBadge] = useState<ChildBadge | null>(null);
  const [isSpeakingPrompt, setIsSpeakingPrompt] = useState<boolean>(false);
  const [isSpeakingFeedback, setIsSpeakingFeedback] = useState<boolean>(false);

  // حالة لعبة تركيب الجمل
  const [selectedWordSequence, setSelectedWordSequence] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>([]);

  // حالة لعبة فرز الظواهر اللغوية
  const [sorterWordIndex, setSorterWordIndex] = useState<number>(0);
  const [sorterFinishedWords, setSorterFinishedWords] = useState<Record<string, boolean>>({});

  // تحديث الجولة عند فتح النشاط أو تغيره
  useEffect(() => {
    if (!isOpen || !activity.gameData) return;
    const detected = (() => {
      const match = activity.id.match(/lvl(\d+)/) || activity.title.match(/المستوى\s*(\d+)/);
      return match ? parseInt(match[1], 10) : 1;
    })();
    setCurrentAdaptiveLevel(detected);
    const new20 = getRandomized20Questions(activity.gameData.gameType, detected);
    setActiveLevels(new20);
    setCurrentLevelIndex(0);
    setStars(0);
    setStreak(0);
    setIsCompleted(false);
    setMilestoneNotification(null);
  }, [activity.id, isOpen]);

  // إعداد السؤال الحالي عند التبديل
  const totalLevels = activeLevels.length || 20;
  const currentLevel: GameLevel | undefined = activeLevels[currentLevelIndex] || gameData?.levels?.[0];

  useEffect(() => {
    if (!isOpen || !gameData || !currentLevel) return;

    setLevelStatus('playing');
    setFeedbackMsg('');
    setShakeError(false);
    setIsSpeakingPrompt(false);
    setIsSpeakingFeedback(false);
    stopMousaVoice();

    if (gameData.gameType === 'sentence_builder') {
      // خلط الكلمات المتاحة للمستوى
      const shuffled = [...currentLevel.options].sort(() => Math.random() - 0.5);
      setAvailableWords(shuffled);
      setSelectedWordSequence([]);
    } else if (gameData.gameType === 'category_sorter') {
      setSorterWordIndex(0);
      setSorterFinishedWords({});
    }

    return () => {
      stopMousaVoice();
      setIsSpeakingPrompt(false);
      setIsSpeakingFeedback(false);
    };
  }, [currentLevelIndex, isOpen, gameData, currentLevel]);

  // تشغيل / إيقاف قراءة السؤال يدوياً بصوت موسى
  const handleToggleSpeakPrompt = () => {
    if (!currentLevel) return;
    if (isSpeakingPrompt) {
      stopMousaVoice();
      setIsSpeakingPrompt(false);
    } else {
      stopMousaVoice();
      setIsSpeakingPrompt(true);
      setIsSpeakingFeedback(false);
      const promptText = currentLevel.prompt.replace(/[\*\#\_]/g, '');
      speakWithMousaVoice(promptText, () => {
        setIsSpeakingPrompt(false);
      });
    }
  };

  // تشغيل / إيقاف قراءة رسالة التغذية الراجعة يدوياً بصوت موسى
  const handleToggleSpeakFeedback = () => {
    if (!feedbackMsg) return;
    if (isSpeakingFeedback) {
      stopMousaVoice();
      setIsSpeakingFeedback(false);
    } else {
      stopMousaVoice();
      setIsSpeakingFeedback(true);
      setIsSpeakingPrompt(false);
      speakWithMousaVoice(feedbackMsg, () => {
        setIsSpeakingFeedback(false);
      });
    }
  };

  if (!isOpen || !gameData || !currentLevel) return null;

  // إطلاق محطات الحوافز الفورية
  const triggerMilestone = (title: string, subtitle: string, icon: string, badgeText: string) => {
    setMilestoneNotification({ title, subtitle, icon, badge: badgeText });
    playSound('victory');
    setTimeout(() => {
      setMilestoneNotification(null);
    }, 4500);
  };

  // تسجيل الإجابة الصحيحة وتحديث النقاط والـ Streak ومحطات الحوافز
  const handleRegisterCorrect = (successMsg: string, advanceDelay = 2200) => {
    playSound('correct');
    setLevelStatus('success');
    setFeedbackMsg(successMsg);

    const questionNumber = currentLevelIndex + 1;
    const nextStreak = streak + 1;
    setStreak(nextStreak);

    // حساب النقاط مع مكافأة منتصف الجولة (السؤال 10)
    let pointsEarned = 1;
    if (questionNumber === 10) {
      pointsEarned = 2; // مكافأة نقاط مضاعفة للمنتصف
    }
    setStars((prev) => prev + pointsEarned);

    // محطات الحوافز الفورية:
    // عند السؤال 5: تنبيه حماسي من موسى
    if (questionNumber === 5) {
      triggerMilestone('بداية رائعة يا بطل! 🌟', 'أتممت 5 أسئلة بتركيز عالٍ! استمر في التقدم نحو القمة!', '🌟', 'محطة السؤال 5');
    }
    // عند السؤال 10: مكافأة نقاط مضاعفة للمنتصف
    else if (questionNumber === 10) {
      triggerMilestone('أنت في منتصف الطريق نحو القمة! 🚀', 'مكافأة منتصف الجولة: نقاط مضاعفة (+2) مستحقة!', '🚀', 'محطة السؤال 10');
    }
    // عند السؤال 15: حافز اقتراب خط النهاية
    else if (questionNumber === 15) {
      triggerMilestone('باقي 5 أسئلة لتصبح بطل التحدي! ⚡', 'أنت على بعد خطوات قليلة من التتويج النهائي بالوسام!', '⚡', 'محطة السؤال 15');
    }
    // عند تحقيق 3 إجابات صحيحة متتالية: إضافة تأثير الـ Streak لمضاعفة الحماس
    else if (nextStreak >= 3 && nextStreak % 3 === 0) {
      triggerMilestone(`سلسلة إجابات ملتهبة (${nextStreak}x)! 🔥`, '3 إجابات صحيحة متتالية! شغف وتركيز بطولي!', '🔥', `Streak ${nextStreak}x`);
    }

    setTimeout(() => {
      advanceToNextLevel();
    }, advanceDelay);
  };

  // تسجيل الإجابة الخاطئة وتصفير الـ Streak
  const handleRegisterWrong = (hintMsg: string) => {
    playSound('wrong');
    setLevelStatus('hint');
    setShakeError(true);
    setStreak(0); // تصفير العداد المتتالي عند الخطأ
    setFeedbackMsg(hintMsg);
    setTimeout(() => setShakeError(false), 700);
  };

  // زر: جولة جديدة بأسئلة مختلفة فوراً
  const handleNewRoundSameLevel = () => {
    playSound('pop');
    stopMousaVoice();
    const new20 = getRandomized20Questions(gameData.gameType, currentAdaptiveLevel);
    setActiveLevels(new20);
    setCurrentLevelIndex(0);
    setStars(0);
    setStreak(0);
    setIsCompleted(false);
    setMilestoneNotification(null);
  };

  // زر: تحدي المستوى التالي
  const handleNextLevelChallenge = () => {
    playSound('pop');
    stopMousaVoice();
    const nextLvl = currentAdaptiveLevel < 6 ? currentAdaptiveLevel + 1 : 1;
    setCurrentAdaptiveLevel(nextLvl);
    const new20 = getRandomized20Questions(gameData.gameType, nextLvl);
    setActiveLevels(new20);
    setCurrentLevelIndex(0);
    setStars(0);
    setStreak(0);
    setIsCompleted(false);
    setMilestoneNotification(null);
  };

  // ================= 1. منطق لعبة كنز الحروف والكلمات السحرية =================
  const handlePhonicsOptionClick = (option: string) => {
    if (levelStatus === 'success') return;
    playSound('pop');

    const isCorrect = currentLevel.correctAnswers.some(
      (ans) => ans.trim() === option.trim() || option.includes(ans.trim())
    );

    if (isCorrect) {
      handleRegisterCorrect(currentLevel.feedbackSuccess, 2200);
    } else {
      handleRegisterWrong(currentLevel.feedbackHint);
    }
  };

  // ================= 2. منطق لعبة متاهة تركيب الجمل =================
  const handleSelectWord = (word: string, index: number) => {
    if (levelStatus === 'success') return;
    playSound('pop');

    const nextSelected = [...selectedWordSequence, word];
    setSelectedWordSequence(nextSelected);

    const nextAvailable = [...availableWords];
    nextAvailable.splice(index, 1);
    setAvailableWords(nextAvailable);

    // إذا اكتملت جميع الكلمات، نقوم بالفحص التلقائي الفوري
    if (nextSelected.length === currentLevel.correctAnswers.length) {
      checkSentence(nextSelected);
    }
  };

  const handleRemoveWord = (word: string, index: number) => {
    if (levelStatus === 'success') return;
    playSound('pop');

    const nextSelected = [...selectedWordSequence];
    nextSelected.splice(index, 1);
    setSelectedWordSequence(nextSelected);

    setAvailableWords([...availableWords, word]);
    setLevelStatus('playing');
    setFeedbackMsg('');
  };

  const checkSentence = (sequenceToCheck = selectedWordSequence) => {
    const isExactMatch = sequenceToCheck.every(
      (w, idx) => w.trim() === currentLevel.correctAnswers[idx]?.trim()
    );

    if (isExactMatch) {
      handleRegisterCorrect(currentLevel.feedbackSuccess, 2400);
    } else {
      handleRegisterWrong(currentLevel.feedbackHint);
    }
  };

  const resetSentenceWords = () => {
    playSound('pop');
    setAvailableWords([...currentLevel.options].sort(() => Math.random() - 0.5));
    setSelectedWordSequence([]);
    setLevelStatus('playing');
    setFeedbackMsg('');
  };

  // ================= 3. منطق لعبة مغامرة موسى وقرارات الحكاية =================
  const handleQuestChoice = (choice: string) => {
    if (levelStatus === 'success') return;
    playSound('pop');

    const isCorrect = currentLevel.correctAnswers.some(
      (ans) => ans.trim() === choice.trim() || choice.includes(ans.trim())
    );

    if (isCorrect) {
      handleRegisterCorrect(currentLevel.feedbackSuccess, 2400);
    } else {
      handleRegisterWrong(currentLevel.feedbackHint);
    }
  };

  // ================= 4. منطق لعبة قطار الحركات والمدود =================
  const handleVowelTrainChoice = (carriageWord: string) => {
    if (levelStatus === 'success') return;
    playSound('pop');

    const isCorrect = currentLevel.correctAnswers.some(
      (ans) => ans.trim() === carriageWord.trim() || carriageWord.includes(ans.trim())
    );

    if (isCorrect) {
      handleRegisterCorrect(currentLevel.feedbackSuccess, 2200);
    } else {
      handleRegisterWrong(currentLevel.feedbackHint);
    }
  };

  // ================= 5. منطق لعبة معمل دمج الحروف وتكوين الكلمات =================
  const handleLetterBlendingChoice = (blendedWord: string) => {
    if (levelStatus === 'success') return;
    playSound('pop');

    const isCorrect = currentLevel.correctAnswers.some(
      (ans) => ans.trim() === blendedWord.trim() || blendedWord.includes(ans.trim())
    );

    if (isCorrect) {
      handleRegisterCorrect(currentLevel.feedbackSuccess, 2200);
    } else {
      handleRegisterWrong(currentLevel.feedbackHint);
    }
  };

  // ================= 6. منطق لعبة محقق المفردات (الترادف والتضاد) =================
  const handleVocabDetectiveChoice = (choice: string) => {
    if (levelStatus === 'success') return;
    playSound('pop');

    const isCorrect = currentLevel.correctAnswers.some(
      (ans) => ans.trim() === choice.trim() || choice.includes(ans.trim())
    );

    if (isCorrect) {
      handleRegisterCorrect(currentLevel.feedbackSuccess, 2200);
    } else {
      handleRegisterWrong(currentLevel.feedbackHint);
    }
  };

  // ================= 7. منطق لعبة فرز الظواهر اللغوية =================
  const sorterWords = currentLevel?.options || [];
  const activeSorterWord = sorterWords[sorterWordIndex] || '';
  const sorterCategories = currentLevel?.categories && currentLevel.categories.length >= 2 
    ? currentLevel.categories 
    : ['اللام الشمسية ☀️', 'اللام القمرية 🌙'];

  const handleCategorySortChoice = (category: string) => {
    if (levelStatus === 'success' || !activeSorterWord) return;
    playSound('pop');

    let isCorrect = false;
    if (currentLevel.categoryMap && currentLevel.categoryMap[activeSorterWord]) {
      isCorrect = currentLevel.categoryMap[activeSorterWord].trim() === category.trim();
    } else {
      const belongsToFirst = currentLevel.correctAnswers.some(
        (ans) => ans.trim() === activeSorterWord.trim() || activeSorterWord.includes(ans.trim())
      );
      isCorrect = (category === sorterCategories[0] && belongsToFirst) || (category === sorterCategories[1] && !belongsToFirst);
    }

    if (isCorrect) {
      playSound('correct');
      setSorterFinishedWords((prev) => ({ ...prev, [activeSorterWord]: true }));

      if (sorterWordIndex + 1 < sorterWords.length) {
        setSorterWordIndex((prev) => prev + 1);
        setLevelStatus('playing');
        setFeedbackMsg(`أَحْسَنْتَ! اخْتِيَارٌ صَحِيحٌ لِـ (${activeSorterWord}) 👏`);
      } else {
        handleRegisterCorrect(currentLevel.feedbackSuccess, 2200);
      }
    } else {
      handleRegisterWrong(currentLevel.feedbackHint);
    }
  };

  // التقدم للمستوى التالي أو إنهاء اللعبة وتتويج البطل
  const advanceToNextLevel = () => {
    if (currentLevelIndex + 1 < totalLevels) {
      setCurrentLevelIndex((prev) => prev + 1);
    } else {
      // إتمام اللعبة بالكامل!
      finishGameAndAwardStudent();
    }
  };

  // تسجيل الإنجاز في جدول badges و submissions
  const finishGameAndAwardStudent = () => {
    playSound('victory');
    setIsCompleted(true);

    let badgeTitle = 'بطل ألعاب موسى الذكية 🏆';
    let badgeDesc = 'اجتياز مراحل اللعبة الذكية بنجاح وتفوق';
    let badgeIcon = '🎮';

    if (gameData.gameType === 'phonics_treasure') {
      badgeTitle = 'بطل كنز الحروف والكلمات 💎';
      badgeDesc = `أتقن مهارة (${gameData.targetSkill}) في لعبة كنز الحروف السحرية`;
      badgeIcon = '💎';
    } else if (gameData.gameType === 'sentence_builder') {
      badgeTitle = 'مهندس الجمل الماهر 🧩';
      badgeDesc = `رتب الكلمات وصنع جملاً عربية تامة بمهارة (${gameData.targetSkill})`;
      badgeIcon = '🧩';
    } else if (gameData.gameType === 'story_quest') {
      badgeTitle = 'فارس مغامرات موسى 🏰';
      badgeDesc = `اتخذ القرارات اللغوية الصائبة وأكمل مغامرة (${gameData.targetSkill})`;
      badgeIcon = '🏰';
    } else if (gameData.gameType === 'vowel_train') {
      badgeTitle = 'قائد قطار المدود والحركات 🚂';
      badgeDesc = `ميز بين الحركات القصيرة والمدود الطويلة بمهارة (${gameData.targetSkill})`;
      badgeIcon = '🚂';
    } else if (gameData.gameType === 'letter_blending') {
      badgeTitle = 'عالم معمل دمج الكلمات 🧪';
      badgeDesc = `دمج المقاطع الصوتية والحروف وكون كلمات عربية بمهارة (${gameData.targetSkill})`;
      badgeIcon = '🧪';
    } else if (gameData.gameType === 'vocab_detective') {
      badgeTitle = 'المحقق اللغوي العبقري 🔍';
      badgeDesc = `فك شفرات الكلمات واكتشف الترادف والتضاد بمهارة (${gameData.targetSkill})`;
      badgeIcon = '🔍';
    } else if (gameData.gameType === 'category_sorter') {
      badgeTitle = 'خبير تصنيف الظواهر اللغوية ⚖️';
      badgeDesc = `فرز وصنف الكلمات وأتقن التمييز بين الظواهر بمهارة (${gameData.targetSkill})`;
      badgeIcon = '⚖️';
    }

    const newBadge: ChildBadge = {
      id: `badge_${gameData.gameType}_${Date.now()}`,
      studentId: student.id,
      title: badgeTitle,
      description: badgeDesc,
      icon: badgeIcon,
      category: 'game',
      earnedAt: new Date().toLocaleDateString('ar-EG')
    };

    setCurrentEarnedBadge(newBadge);

    // حفظ الوسام في جدول badges في Supabase
    saveStudentBadge(student.id, newBadge);

    // تسجيل الدرجة في جدول submissions ليراها المعلم فوراً ومستشار التشخيص الذكي
    saveSubmission({
      id: `sub_game_${Date.now()}`,
      activityId: activity.id,
      activityTitle: activity.title,
      studentId: student.id,
      studentName: student.name,
      grade: student.grade,
      track: student.track,
      score: 10,
      totalPoints: 10,
      submittedAt:
        new Date().toLocaleDateString('ar-EG') +
        ' ' +
        new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      gameType: gameData.gameType,
      targetSkill: gameData.targetSkill,
      accuracyRate: 100,
      repeatedErrors: [],
      answers: {
        gameType: gameData.gameType,
        status: 'completed',
        starsEarned: String(stars + 1),
        targetSkill: gameData.targetSkill
      }
    });

    if (onGameCompleted) {
      onGameCompleted(newBadge);
    }
  };

  const getGameTheme = () => {
    switch (gameData.gameType) {
      case 'phonics_treasure':
        return {
          bgGrad: 'from-amber-500 via-orange-500 to-amber-600',
          accent: 'amber',
          titleAr: 'كنز الحروف والكلمات السحرية 💎',
          badgeTag: 'لعبة الصيد والأصوات'
        };
      case 'sentence_builder':
        return {
          bgGrad: 'from-emerald-600 via-teal-600 to-cyan-700',
          accent: 'emerald',
          titleAr: 'متاهة تركيب الجمل التفاعلية 🧩',
          badgeTag: 'لعبة بناء الجمل'
        };
      case 'story_quest':
        return {
          bgGrad: 'from-indigo-600 via-purple-600 to-violet-800',
          accent: 'indigo',
          titleAr: 'مغامرة موسى وقرارات الحكاية 🏰',
          badgeTag: 'المغامرة القصصية'
        };
      case 'vowel_train':
        return {
          bgGrad: 'from-blue-600 via-cyan-600 to-teal-700',
          accent: 'sky',
          titleAr: 'قطار الحركات والمدود 🚂',
          badgeTag: 'لعبة قطار المدود'
        };
      case 'letter_blending':
        return {
          bgGrad: 'from-violet-600 via-fuchsia-600 to-pink-700',
          accent: 'purple',
          titleAr: 'معمل دمج الحروف والكلمات 🧪',
          badgeTag: 'معمل كيمياء الكلمات'
        };
      case 'vocab_detective':
        return {
          bgGrad: 'from-amber-600 via-orange-600 to-red-700',
          accent: 'amber',
          titleAr: 'محقق المفردات والترادف 🔍',
          badgeTag: 'تحقيق لغوي ذكي'
        };
      case 'category_sorter':
        return {
          bgGrad: 'from-teal-600 via-emerald-600 to-green-700',
          accent: 'teal',
          titleAr: 'فرز وتصنيف الظواهر اللغوية ⚖️',
          badgeTag: 'لعبة الفرز والتصنيف'
        };
      default:
        return {
          bgGrad: 'from-amber-500 via-orange-500 to-amber-600',
          accent: 'amber',
          titleAr: 'ألعاب موسى الذكية 🎮',
          badgeTag: 'تحدي لغوي'
        };
    }
  };

  const theme = getGameTheme();
  const levelMeta = ADAPTIVE_LEVELS_META.find(l => l.levelNumber === currentAdaptiveLevel) || ADAPTIVE_LEVELS_META[0];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border-4 border-white/80 overflow-hidden flex flex-col relative my-auto">
        
        {/* شريط رأس اللعبة */}
        <div className={`bg-gradient-to-r ${theme.bgGrad} p-4 sm:p-5 text-white flex items-center justify-between relative`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 p-1 flex-shrink-0 shadow-md">
              <img 
                src={MOUSA_AVATAR_SRC} 
                alt="موسى" 
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-white/25 rounded-md text-[10px] font-black uppercase tracking-wider">
                  {theme.badgeTag}
                </span>
                <span className="px-2 py-0.5 bg-black/20 rounded-md text-[10px] font-bold text-amber-200">
                  المستوى {currentAdaptiveLevel}: {levelMeta.badge}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black">{activity.title}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* عداد الجواهر / النقاط الحية */}
            <div className="flex items-center gap-1.5 bg-black/25 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/20 shadow-xs">
              <Star className="w-4 h-4 text-amber-300 fill-amber-300 animate-pulse" />
              <span className="font-black text-xs sm:text-sm text-amber-200">{stars} 💎</span>
            </div>

            {/* عداد الإجابات المتتالية (Streak Counter) مع تأثير الحماس */}
            <div className={`flex items-center gap-1.5 backdrop-blur-md px-3 py-1.5 rounded-2xl border transition-all duration-300 ${
              streak >= 3
                ? 'bg-rose-500/35 border-rose-300 text-rose-100 shadow-md shadow-rose-500/30 scale-105 animate-pulse'
                : 'bg-black/20 border-white/20 text-white'
            }`}>
              <Flame className={`w-4 h-4 ${streak >= 3 ? 'text-amber-300 fill-rose-500 animate-bounce' : 'text-slate-300'}`} />
              <span className="font-black text-xs">
                {streak > 0 ? `${streak}x 🔥` : '0🔥'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                stopMousaVoice();
                onClose();
              }}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center text-white transition cursor-pointer"
              title="إغلاق اللعبة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* شريط التقدم العلوي الواضح (20-Question Progression Bar) */}
        <div className="bg-slate-900 text-white px-5 py-2.5 border-b border-slate-800 flex flex-col gap-1.5 shadow-inner">
          <div className="flex items-center justify-between text-xs font-black">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Target className="w-3.5 h-3.5 text-amber-400" />
              <span>السؤال {currentLevelIndex + 1} من {totalLevels}</span>
            </span>
            <div className="flex items-center gap-3">
              {streak >= 3 && (
                <span className="text-[10px] font-extrabold text-rose-300 bg-rose-950/70 border border-rose-500/50 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <Flame className="w-3 h-3 text-rose-400 fill-rose-400" /> سلسلة نشطة {streak}x مضاعف الحماس!
                </span>
              )}
              <span className="text-slate-400 text-[11px] font-bold">
                نسبة التقدم: {Math.round(((currentLevelIndex + 1) / totalLevels) * 100)}%
              </span>
            </div>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${((currentLevelIndex + 1) / totalLevels) * 100}%` }}
            />
          </div>
        </div>

        {/* تنبيه محطات الحوافز الفورية الموجهة من موسى */}
        {milestoneNotification && (
          <div className="mx-4 mt-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-xl shadow-amber-500/25 flex items-center justify-between animate-bounce border-2 border-white/40">
            <div className="flex items-center gap-3">
              <span className="text-3xl p-1.5 bg-white/20 rounded-2xl backdrop-blur-xs flex-shrink-0">
                {milestoneNotification.icon}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-black text-white">{milestoneNotification.title}</h4>
                  <span className="text-[9px] font-black bg-black/25 px-2 py-0.5 rounded-full text-amber-200">
                    {milestoneNotification.badge}
                  </span>
                </div>
                <p className="text-[11px] text-amber-100 font-semibold mt-0.5">{milestoneNotification.subtitle}</p>
              </div>
            </div>
            <Sparkles className="w-5 h-5 text-yellow-200 animate-spin" style={{ animationDuration: '4s' }} />
          </div>
        )}

        {/* الشاشة الختامية عند الفوز واجتياز اللعبة (End-of-Game Victory Screen) */}
        {isCompleted ? (
          <div className="p-6 sm:p-10 text-center flex flex-col items-center bg-gradient-to-b from-amber-50/60 via-white to-amber-50/40">
            <div className="relative mb-5">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center shadow-xl shadow-amber-400/30 text-5xl animate-bounce">
                🏆
              </div>
              <div className="absolute -top-2 -right-2 text-2xl animate-spin" style={{ animationDuration: '6s' }}>
                ✨
              </div>
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-slate-800 mb-1.5">
              مُبَارَكٌ يَا بَطَل! أَكْمَلْتَ تَحَدِّي الـ 20 سُؤَالًا! 🌟
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md leading-relaxed mb-6">
              لَقَدْ أَكْمَلْتَ جَمِيعَ جَوْلَةِ <b className="text-amber-600">({activity.title})</b> بنجاح باهر وتغلبت على جميع التحديات!
            </p>

            {/* بطاقتان لإجمالي الدرجات ونسبة الإتقان المئوية */}
            <div className="grid grid-cols-2 gap-3 max-w-sm w-full mb-5">
              <div className="bg-white border-2 border-amber-200 rounded-2xl p-3.5 shadow-sm text-center">
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">إجمالي النقاط المكتسبة</span>
                <div className="text-2xl font-black text-amber-600 flex items-center justify-center gap-1">
                  <span>{stars}</span>
                  <span className="text-sm">💎</span>
                </div>
              </div>
              <div className="bg-white border-2 border-emerald-200 rounded-2xl p-3.5 shadow-sm text-center">
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">نسبة الإتقان المئوية</span>
                <div className="text-2xl font-black text-emerald-600 flex items-center justify-center gap-1">
                  <span>{Math.min(100, Math.round((stars / totalLevels) * 100))}%</span>
                  <span className="text-sm">🎯</span>
                </div>
              </div>
            </div>

            {/* شارة التحدي المكتسب الخاصة بالمستوى */}
            <div className="bg-white border-2 border-amber-300 rounded-3xl p-4 sm:p-5 shadow-lg max-w-sm w-full mb-6 flex items-center gap-4 text-right">
              <div className="text-4xl p-3 bg-amber-50 rounded-2xl border border-amber-200 flex-shrink-0">
                {currentAdaptiveLevel === 1 && '🌱'}
                {currentAdaptiveLevel === 2 && '📖'}
                {currentAdaptiveLevel === 3 && '⚔️'}
                {currentAdaptiveLevel === 4 && '🛡️'}
                {currentAdaptiveLevel === 5 && '💎'}
                {currentAdaptiveLevel === 6 && '👑'}
              </div>
              <div>
                <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md inline-block mb-1">
                  شارة التحدي المكتسبة للمستوى {currentAdaptiveLevel} 🎖️
                </span>
                <h4 className="font-black text-sm sm:text-base text-slate-800">
                  {levelMeta.badge} - {levelMeta.title}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  تم توثيق إنجازك في ملفك الشخصي وسجل بطولات المدرسة!
                </p>
              </div>
            </div>

            {/* الخياران الرئيسيان: جولة جديدة بأسئلة مختلفة + تحدي المستوى التالي */}
            <div className="flex flex-col gap-2.5 w-full max-w-sm">
              <button
                type="button"
                onClick={handleNewRoundSameLevel}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm rounded-2xl transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <RefreshCw className="w-4 h-4 text-emerald-200 animate-spin" style={{ animationDuration: '6s' }} />
                جولة جديدة بأسئلة مختلفة 🔄
              </button>

              <button
                type="button"
                onClick={handleNextLevelChallenge}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm rounded-2xl transition shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Target className="w-4 h-4 text-yellow-200" />
                تحدي المستوى التالي 🎯
              </button>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowShareBadgeModal(true)}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  مشاركة الوسام 🌟
                </button>

                <button
                  type="button"
                  onClick={() => {
                    stopMousaVoice();
                    onClose();
                  }}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                  العودة للألعاب
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* منطقة اللعب التفاعلية */
          <div className="p-5 sm:p-7 flex-1 flex flex-col justify-between">
            
            {/* فقاعة توجيه موسى ومساعدته الصوتية */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 mb-5 flex items-start gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-amber-400 bg-white flex-shrink-0">
                <img src={MOUSA_AVATAR_SRC} alt="موسى" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-extrabold text-xs text-amber-900 flex items-center gap-1.5">
                    موسى يقول لك:
                    <span className="text-[10px] text-amber-700 font-normal bg-amber-200/60 px-1.5 py-0.5 rounded">صوت بشري أصلي ✨</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleSpeakPrompt}
                    className={`flex items-center gap-1 text-[11px] font-bold transition px-2.5 py-1 rounded-lg ${
                      isSpeakingPrompt
                        ? 'bg-amber-200 text-amber-950 border border-amber-400 shadow-2xs'
                        : 'text-amber-800 hover:text-amber-950 bg-amber-100/90 hover:bg-amber-200/80'
                    }`}
                    title={isSpeakingPrompt ? 'إيقاف الاستماع' : 'استمع للسؤال بصوت موسى'}
                  >
                    {isSpeakingPrompt ? <VolumeX className="w-3.5 h-3.5 text-amber-900" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span>{isSpeakingPrompt ? 'إيقاف ⏸️' : 'اسمع السؤال 🔊'}</span>
                  </button>
                </div>
                <p className="text-sm sm:text-base font-black text-slate-800 leading-relaxed">
                  {currentLevel.prompt}
                </p>
              </div>
            </div>

            {/* محرك اللعبة 1: كنز الحروف والكلمات السحرية */}
            {gameData.gameType === 'phonics_treasure' && (
              <div className="space-y-4 my-2">
                <div className="text-center mb-2">
                  <span className="text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
                    المهارة: {gameData.targetSkill} 🎯
                  </span>
                </div>

                <div className={`grid grid-cols-2 gap-3.5 ${shakeError ? 'animate-bounce' : ''}`}>
                  {currentLevel.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handlePhonicsOptionClick(opt)}
                      disabled={levelStatus === 'success'}
                      className="group relative p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-white to-amber-50/40 border-2 border-amber-200/90 hover:border-amber-400 hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center text-center disabled:opacity-75"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 group-hover:scale-110 transition-transform flex items-center justify-center text-2xl mb-2 shadow-xs">
                        💎
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-base sm:text-lg font-black text-slate-800 group-hover:text-amber-900">
                          {opt}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            speakWithMousaVoice(opt);
                          }}
                          className="p-1.5 rounded-xl bg-amber-100/80 hover:bg-amber-200 text-amber-800 transition"
                          title="استمع للكلمة بصوت موسى (فوري 0ms)"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* محرك اللعبة 2: متاهة تركيب الجمل التفاعلية */}
            {gameData.gameType === 'sentence_builder' && (
              <div className="space-y-5 my-2">
                <div className="text-center mb-1">
                  <span className="text-xs font-bold text-teal-800 bg-teal-100 px-3 py-1 rounded-full">
                    رَتِّبِ الكَلِمَاتِ بِالنَّقْرِ عَلَيْهَا بِالتَّرْتِيبِ الصَّحِيحِ 🧩
                  </span>
                </div>

                {/* شريط بناء الجملة المستهدفة */}
                <div className={`min-h-[70px] p-3 rounded-2xl bg-teal-50/60 border-2 border-dashed border-teal-300 flex flex-wrap items-center justify-center gap-2 ${shakeError ? 'border-rose-400 bg-rose-50/50' : ''}`}>
                  {selectedWordSequence.length === 0 ? (
                    <span className="text-xs font-bold text-teal-600/70">
                      انقر على الكلمات بالترتيب لتضعها هنا...
                    </span>
                  ) : (
                    selectedWordSequence.map((word, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleRemoveWord(word, idx)}
                        disabled={levelStatus === 'success'}
                        className="px-3.5 py-2 bg-white border border-teal-400 text-teal-900 font-black rounded-xl text-sm shadow-xs hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 transition flex items-center gap-1.5"
                        title="انقر للإزالة"
                      >
                        <span>{word}</span>
                        <span className="text-[10px] text-slate-400">×</span>
                      </button>
                    ))
                  )}
                </div>

                {/* الكلمات المبعثرة المتاحة للاختيار */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500">بنك الكلمات المبعثرة:</span>
                    {selectedWordSequence.length > 0 && levelStatus !== 'success' && (
                      <button
                        type="button"
                        onClick={resetSentenceWords}
                        className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> إعادة تعيين
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2.5 justify-center">
                    {availableWords.map((word, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectWord(word, idx)}
                        disabled={levelStatus === 'success'}
                        className="px-4 py-2.5 bg-white border-2 border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 text-slate-800 font-black rounded-2xl text-sm shadow-xs transition transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* محرك اللعبة 3: مغامرة موسى وقرارات الحكاية */}
            {gameData.gameType === 'story_quest' && (
              <div className="space-y-4 my-2">
                <div className="text-center mb-1">
                  <span className="text-xs font-bold text-indigo-800 bg-indigo-100 px-3 py-1 rounded-full">
                    مَحَطَّةُ القَرَارِ اللُّغَوِيِّ 🏰
                  </span>
                </div>

                <div className={`space-y-2.5 ${shakeError ? 'animate-bounce' : ''}`}>
                  {currentLevel.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuestChoice(opt)}
                      disabled={levelStatus === 'success'}
                      className="w-full p-3.5 sm:p-4 rounded-2xl bg-white border-2 border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all text-right flex items-center justify-between group shadow-xs disabled:opacity-75"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white transition text-indigo-700 flex items-center justify-center font-black text-xs">
                          {idx + 1}
                        </div>
                        <span className="font-extrabold text-sm sm:text-base text-slate-800 group-hover:text-indigo-950">
                          {opt}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            speakWithMousaVoice(opt);
                          }}
                          className="p-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition"
                          title="استمع للخيار بصوت موسى (فوري 0ms)"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </span>
                        <ArrowLeft className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:-translate-x-1 transition" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* محرك اللعبة 4: قطار الحركات والمدود */}
            {gameData.gameType === 'vowel_train' && (
              <div className="space-y-4 my-2">
                <div className="text-center mb-1">
                  <span className="text-xs font-bold text-sky-800 bg-sky-100 px-3 py-1 rounded-full">
                    🚂 قِطَارُ الحَرَكَاتِ وَالمُدُودِ: {gameData.targetSkill}
                  </span>
                </div>

                {/* قاطرة القطار ومسار السكة الحديدية */}
                <div className="bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 border border-sky-200 rounded-2xl p-3 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl animate-pulse">🚂</span>
                    <div className="text-right">
                      <span className="text-[10px] font-black text-sky-700 bg-sky-100 px-2 py-0.5 rounded">قَاطِرَةُ مُوسَى</span>
                      <p className="text-xs font-bold text-slate-600">اخْتَرِ العَرَبَةَ الَّتِي تَحْمِلُ الإِجَابَةَ الصَّحِيحَةَ!</p>
                    </div>
                  </div>
                  <span className="text-xl animate-bounce">💨✨</span>
                </div>

                {/* عربات القطار كخيارات */}
                <div className={`grid grid-cols-2 gap-3.5 ${shakeError ? 'animate-bounce' : ''}`}>
                  {currentLevel.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleVowelTrainChoice(opt)}
                      disabled={levelStatus === 'success'}
                      className="group relative p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-white to-sky-50/60 border-2 border-sky-200 hover:border-sky-500 hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center text-center disabled:opacity-75"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-sky-100 group-hover:scale-110 transition-transform flex items-center justify-center text-2xl mb-2 shadow-xs">
                        🚃
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-base sm:text-lg font-black text-slate-800 group-hover:text-sky-950">
                          {opt}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            speakWithMousaVoice(opt);
                          }}
                          className="p-1.5 rounded-xl bg-sky-100/80 hover:bg-sky-200 text-sky-800 transition"
                          title="استمع للكلمة بصوت موسى (فوري 0ms)"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </span>
                      </div>
                      <span className="text-[10px] text-sky-600 font-bold mt-1">عَرَبَةُ رَقْم {idx + 1}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* محرك اللعبة 5: معمل دمج الحروف وتكوين الكلمات */}
            {gameData.gameType === 'letter_blending' && (
              <div className="space-y-4 my-2">
                <div className="text-center mb-1">
                  <span className="text-xs font-bold text-violet-800 bg-violet-100 px-3 py-1 rounded-full">
                    🧪 مَعْمَلُ دَمْجِ الحُرُوفِ وَالمَقَاطِعِ الصَّوْتِيَّةِ
                  </span>
                </div>

                {/* منصة التفاعل الصوتي للمقاطع المكونة للكلمة */}
                <div className="bg-gradient-to-b from-purple-50 to-pink-50 border-2 border-dashed border-purple-300 rounded-3xl p-4 text-center">
                  <span className="text-xs font-bold text-purple-700 block mb-2">
                    المَقَاطِعُ الصَّوْتِيَّةُ (انْقُرْ لِسَمَاعِ نُطْقِ كُلِّ مَقْطَع):
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {(currentLevel.segments && currentLevel.segments.length > 0 
                      ? currentLevel.segments 
                      : (currentLevel.options[0] ? currentLevel.options[0].split('') : [])
                    ).map((seg, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => speakWithMousaVoice(seg)}
                        className="px-4 py-2.5 bg-white border-2 border-purple-300 hover:border-purple-600 text-purple-900 font-black text-lg rounded-2xl shadow-xs transition hover:scale-105 flex items-center gap-1.5"
                        title="اسمع صوت المقطع"
                      >
                        <span>{seg}</span>
                        <Volume2 className="w-3.5 h-3.5 text-purple-500" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* خيارات الكلمة الناتجة عن الدمج */}
                <div className={`grid grid-cols-2 gap-3.5 ${shakeError ? 'animate-bounce' : ''}`}>
                  {currentLevel.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleLetterBlendingChoice(opt)}
                      disabled={levelStatus === 'success'}
                      className="group relative p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-white to-purple-50/50 border-2 border-purple-200 hover:border-purple-500 hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center text-center disabled:opacity-75"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-purple-100 group-hover:scale-110 transition-transform flex items-center justify-center text-2xl mb-2 shadow-xs">
                        🧪
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-base sm:text-lg font-black text-slate-800 group-hover:text-purple-950">
                          {opt}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            speakWithMousaVoice(opt);
                          }}
                          className="p-1.5 rounded-xl bg-purple-100/80 hover:bg-purple-200 text-purple-800 transition"
                          title="استمع للكلمة بصوت موسى (فوري 0ms)"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* محرك اللعبة 6: محقق المفردات (الترادف والتضاد) */}
            {gameData.gameType === 'vocab_detective' && (
              <div className="space-y-4 my-2">
                <div className="text-center mb-1">
                  <span className="text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
                    🔍 مَلَفُّ التَّحْقِيقِ اللُّغَوِيِّ: {gameData.targetSkill}
                  </span>
                </div>

                {/* بطاقة الكلمة المستهدفة بالبحث الجنائي اللغوي */}
                <div className="bg-gradient-to-r from-amber-100/80 via-yellow-50 to-orange-100/80 border-2 border-amber-300 rounded-3xl p-4 text-center relative shadow-xs">
                  <span className="text-xs font-bold text-amber-800 block mb-1">
                    الكَلِمَةُ المَطْلُوبُ التَّحْقِيقُ عَنْهَا:
                  </span>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl sm:text-3xl font-black text-amber-950 bg-white/80 px-5 py-1.5 rounded-2xl border border-amber-300 shadow-xs">
                      {currentLevel.wordPuzzle || currentLevel.options[0]}
                    </span>
                    <button
                      type="button"
                      onClick={() => speakWithMousaVoice(currentLevel.wordPuzzle || currentLevel.options[0])}
                      className="p-2 bg-amber-200/80 hover:bg-amber-300 text-amber-900 rounded-xl transition shadow-xs"
                      title="استمع للكلمة بصوت موسى"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* خيارات المحقق لاختيار المرادف أو التضاد */}
                <div className={`grid grid-cols-2 gap-3.5 ${shakeError ? 'animate-bounce' : ''}`}>
                  {currentLevel.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleVocabDetectiveChoice(opt)}
                      disabled={levelStatus === 'success'}
                      className="group relative p-4 sm:p-5 rounded-3xl bg-white border-2 border-amber-200 hover:border-amber-500 hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center text-center disabled:opacity-75"
                    >
                      <div className="w-10 h-10 rounded-2xl bg-amber-100 group-hover:scale-110 transition-transform flex items-center justify-center text-xl mb-2 shadow-xs">
                        🕵️
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-base sm:text-lg font-black text-slate-800 group-hover:text-amber-950">
                          {opt}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            speakWithMousaVoice(opt);
                          }}
                          className="p-1.5 rounded-xl bg-amber-100/80 hover:bg-amber-200 text-amber-800 transition"
                          title="استمع للخيار بصوت موسى (فوري 0ms)"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* محرك اللعبة 7: فرز الظواهر اللغوية */}
            {gameData.gameType === 'category_sorter' && (
              <div className="space-y-4 my-2">
                <div className="text-center mb-1">
                  <span className="text-xs font-bold text-teal-800 bg-teal-100 px-3 py-1 rounded-full">
                    ⚖️ فَرْزُ وَتَصْنِيفُ الظَّوَاهِرِ اللُّغَوِيَّةِ
                  </span>
                </div>

                {/* بطاقة الكلمة الحالية المعروضة للفرز */}
                {activeSorterWord ? (
                  <div className={`bg-gradient-to-b from-teal-50 to-emerald-50 border-2 border-teal-300 rounded-3xl p-5 text-center shadow-xs ${shakeError ? 'animate-bounce border-rose-400' : ''}`}>
                    <span className="text-xs font-bold text-teal-700 block mb-1">
                      الكَلِمَةُ {sorterWordIndex + 1} مِنْ {sorterWords.length} (انْقُرْ عَلَى السَّلَّةِ الصَّحِيحَةِ فِي الأَسْفَل):
                    </span>
                    <div className="flex items-center justify-center gap-3 my-2">
                      <span className="text-2xl sm:text-3xl font-black text-teal-950 bg-white px-6 py-2 rounded-2xl border border-teal-200 shadow-sm">
                        {activeSorterWord}
                      </span>
                      <button
                        type="button"
                        onClick={() => speakWithMousaVoice(activeSorterWord)}
                        className="p-2.5 bg-teal-200 hover:bg-teal-300 text-teal-900 rounded-2xl transition shadow-xs"
                        title="استمع للكلمة بصوت موسى"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* سلتا التصنيف التفاعليتان */}
                <div className="grid grid-cols-2 gap-4">
                  {sorterCategories.map((cat, cIdx) => (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={() => handleCategorySortChoice(cat)}
                      disabled={levelStatus === 'success' || !activeSorterWord}
                      className={`p-5 rounded-3xl border-2 transition-all flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] ${
                        cIdx === 0
                          ? 'bg-amber-50/70 border-amber-300 hover:border-amber-500 text-amber-950'
                          : 'bg-indigo-50/70 border-indigo-300 hover:border-indigo-500 text-indigo-950'
                      }`}
                    >
                      <span className="text-3xl mb-1">{cIdx === 0 ? '☀️' : '🌙'}</span>
                      <span className="font-black text-sm sm:text-base mb-1">{cat}</span>
                      <span className="text-[11px] font-bold text-slate-500">
                        انقر لوضع الكلمة هنا 📥
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* رسائل التغذية الراجعة التفاعلية (نجاح أو تلميح) */}
            {feedbackMsg && (
              <div
                className={`mt-4 p-3.5 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-between gap-2.5 transition-all animate-fadeIn ${
                  levelStatus === 'success'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                <div className="flex items-center gap-2.5 flex-1">
                  {levelStatus === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  )}
                  <span>{feedbackMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSpeakFeedback}
                  className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg transition shrink-0 ${
                    isSpeakingFeedback
                      ? 'bg-amber-200 text-amber-950 border border-amber-400 shadow-2xs'
                      : levelStatus === 'success'
                        ? 'bg-emerald-200/80 hover:bg-emerald-300 text-emerald-900'
                        : 'bg-amber-200/80 hover:bg-amber-300 text-amber-900'
                  }`}
                  title={isSpeakingFeedback ? 'إيقاف الاستماع' : 'استمع للتعليق بصوت موسى'}
                >
                  {isSpeakingFeedback ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{isSpeakingFeedback ? 'إيقاف ⏸️' : 'استمع 🔊'}</span>
                </button>
              </div>
            )}

          </div>
        )}

      </div>

      {/* نافذة مشاركة وسام الإنجاز المكتسب مع الأسرة */}
      <ShareableBadgeModal
        isOpen={showShareBadgeModal}
        onClose={() => setShowShareBadgeModal(false)}
        badge={currentEarnedBadge}
        studentName={student.name}
      />
    </div>
  );
};
