import React, { useState, useEffect } from 'react';
import { 
  X, Award, Sparkles, Volume2, ArrowRight, RotateCcw, 
  CheckCircle2, Star, Trophy, ArrowLeft, Lightbulb,
  Search, FlaskConical, Scale
} from 'lucide-react';
import { Activity, GameData, GameLevel, UserProfile, ChildBadge } from '../types';
import { speakWithMousaVoice, stopMousaVoice, prebufferMousaAudio } from '../geminiService';
import { saveStudentBadge, saveSubmission } from '../storage';
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

  const [currentLevelIndex, setCurrentLevelIndex] = useState<number>(0);
  const [stars, setStars] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [levelStatus, setLevelStatus] = useState<'playing' | 'success' | 'hint'>('playing');
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');
  const [shakeError, setShakeError] = useState<boolean>(false);
  const [showShareBadgeModal, setShowShareBadgeModal] = useState<boolean>(false);
  const [currentEarnedBadge, setCurrentEarnedBadge] = useState<ChildBadge | null>(null);

  // حالة لعبة تركيب الجمل
  const [selectedWordSequence, setSelectedWordSequence] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>([]);

  // حالة لعبة فرز الظواهر اللغوية
  const [sorterWordIndex, setSorterWordIndex] = useState<number>(0);
  const [sorterFinishedWords, setSorterFinishedWords] = useState<Record<string, boolean>>({});

  // إعداد المستوى الحالي عند التبديل
  const currentLevel: GameLevel | undefined = gameData?.levels?.[currentLevelIndex];
  const totalLevels = gameData?.levels?.length || 1;

  useEffect(() => {
    if (!isOpen || !gameData || !currentLevel) return;

    setLevelStatus('playing');
    setFeedbackMsg('');
    setShakeError(false);

    if (gameData.gameType === 'sentence_builder') {
      // خلط الكلمات المتاحة للمستوى
      const shuffled = [...currentLevel.options].sort(() => Math.random() - 0.5);
      setAvailableWords(shuffled);
      setSelectedWordSequence([]);
    } else if (gameData.gameType === 'category_sorter') {
      setSorterWordIndex(0);
      setSorterFinishedWords({});
    }

    // قراءة نص السؤال تلقائياً بصوت موسى
    const promptText = currentLevel.prompt.replace(/[\*\#\_]/g, '');
    speakWithMousaVoice(promptText);

    return () => {
      stopMousaVoice();
    };
  }, [currentLevelIndex, isOpen, gameData]);

  // التوليد الاستباقي (Pre-buffering) لأصوات وخيارات المستوى الحالي والمستوى التالي
  useEffect(() => {
    if (!isOpen || !gameData?.levels) return;

    const currentLvl = gameData.levels[currentLevelIndex];
    const nextLvl = gameData.levels[currentLevelIndex + 1];

    const toPrebuffer: string[] = [];

    if (currentLvl) {
      if (currentLvl.feedbackSuccess) toPrebuffer.push(currentLvl.feedbackSuccess);
      if (currentLvl.feedbackHint) toPrebuffer.push(currentLvl.feedbackHint);
      if (currentLvl.options) toPrebuffer.push(...currentLvl.options);
      if (currentLvl.segments) toPrebuffer.push(...currentLvl.segments);
      if (currentLvl.wordPuzzle) toPrebuffer.push(currentLvl.wordPuzzle);
      if (currentLvl.categories) toPrebuffer.push(...currentLvl.categories);
    }

    if (nextLvl) {
      if (nextLvl.prompt) toPrebuffer.push(nextLvl.prompt.replace(/[\*\#\_]/g, ''));
      if (nextLvl.feedbackSuccess) toPrebuffer.push(nextLvl.feedbackSuccess);
      if (nextLvl.feedbackHint) toPrebuffer.push(nextLvl.feedbackHint);
      if (nextLvl.options) toPrebuffer.push(...nextLvl.options);
      if (nextLvl.segments) toPrebuffer.push(...nextLvl.segments);
      if (nextLvl.wordPuzzle) toPrebuffer.push(nextLvl.wordPuzzle);
      if (nextLvl.categories) toPrebuffer.push(...nextLvl.categories);
    }

    // تجهيز الأصوات في الخلفية مسبقاً قبل نقر الطالب لتعمل فوراً 0ms
    prebufferMousaAudio(toPrebuffer);
  }, [isOpen, gameData, currentLevelIndex]);

  if (!isOpen || !gameData || !currentLevel) return null;

  // ================= 1. منطق لعبة كنز الحروف والكلمات السحرية =================
  const handlePhonicsOptionClick = (option: string) => {
    if (levelStatus === 'success') return;
    playSound('pop');

    const isCorrect = currentLevel.correctAnswers.some(
      (ans) => ans.trim() === option.trim() || option.includes(ans.trim())
    );

    if (isCorrect) {
      playSound('correct');
      setLevelStatus('success');
      setFeedbackMsg(currentLevel.feedbackSuccess);
      setStars((prev) => prev + 1);
      speakWithMousaVoice(currentLevel.feedbackSuccess);

      setTimeout(() => {
        advanceToNextLevel();
      }, 2200);
    } else {
      playSound('wrong');
      setLevelStatus('hint');
      setShakeError(true);
      setFeedbackMsg(currentLevel.feedbackHint);
      speakWithMousaVoice(currentLevel.feedbackHint);
      setTimeout(() => setShakeError(false), 700);
    }
  };

  // ================= 2. منطق لعبة متاهة تركيب الجمل =================
  const handleSelectWord = (word: string, index: number) => {
    if (levelStatus === 'success') return;
    playSound('pop');
    // نطق الكلمة المختارة فوراً بصوت موسى (المخزنة مسبقاً 0ms)
    speakWithMousaVoice(word);

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
      playSound('correct');
      setLevelStatus('success');
      setFeedbackMsg(currentLevel.feedbackSuccess);
      setStars((prev) => prev + 1);
      speakWithMousaVoice(currentLevel.feedbackSuccess);

      setTimeout(() => {
        advanceToNextLevel();
      }, 2400);
    } else {
      playSound('wrong');
      setLevelStatus('hint');
      setShakeError(true);
      setFeedbackMsg(currentLevel.feedbackHint);
      speakWithMousaVoice(currentLevel.feedbackHint);
      setTimeout(() => setShakeError(false), 700);
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
      playSound('correct');
      setLevelStatus('success');
      setFeedbackMsg(currentLevel.feedbackSuccess);
      setStars((prev) => prev + 1);
      speakWithMousaVoice(currentLevel.feedbackSuccess);

      setTimeout(() => {
        advanceToNextLevel();
      }, 2500);
    } else {
      playSound('wrong');
      setLevelStatus('hint');
      setShakeError(true);
      setFeedbackMsg(currentLevel.feedbackHint);
      speakWithMousaVoice(currentLevel.feedbackHint);
      setTimeout(() => setShakeError(false), 700);
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
      playSound('correct');
      setLevelStatus('success');
      setFeedbackMsg(currentLevel.feedbackSuccess);
      setStars((prev) => prev + 1);
      speakWithMousaVoice(currentLevel.feedbackSuccess);

      setTimeout(() => {
        advanceToNextLevel();
      }, 2400);
    } else {
      playSound('wrong');
      setLevelStatus('hint');
      setShakeError(true);
      setFeedbackMsg(currentLevel.feedbackHint);
      speakWithMousaVoice(currentLevel.feedbackHint);
      setTimeout(() => setShakeError(false), 700);
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
      playSound('correct');
      setLevelStatus('success');
      setFeedbackMsg(currentLevel.feedbackSuccess);
      setStars((prev) => prev + 1);
      speakWithMousaVoice(currentLevel.feedbackSuccess);

      setTimeout(() => {
        advanceToNextLevel();
      }, 2400);
    } else {
      playSound('wrong');
      setLevelStatus('hint');
      setShakeError(true);
      setFeedbackMsg(currentLevel.feedbackHint);
      speakWithMousaVoice(currentLevel.feedbackHint);
      setTimeout(() => setShakeError(false), 700);
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
      playSound('correct');
      setLevelStatus('success');
      setFeedbackMsg(currentLevel.feedbackSuccess);
      setStars((prev) => prev + 1);
      speakWithMousaVoice(currentLevel.feedbackSuccess);

      setTimeout(() => {
        advanceToNextLevel();
      }, 2400);
    } else {
      playSound('wrong');
      setLevelStatus('hint');
      setShakeError(true);
      setFeedbackMsg(currentLevel.feedbackHint);
      speakWithMousaVoice(currentLevel.feedbackHint);
      setTimeout(() => setShakeError(false), 700);
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
        setLevelStatus('success');
        setFeedbackMsg(currentLevel.feedbackSuccess);
        setStars((prev) => prev + 1);
        speakWithMousaVoice(currentLevel.feedbackSuccess);

        setTimeout(() => {
          advanceToNextLevel();
        }, 2400);
      }
    } else {
      playSound('wrong');
      setLevelStatus('hint');
      setShakeError(true);
      setFeedbackMsg(currentLevel.feedbackHint);
      speakWithMousaVoice(currentLevel.feedbackHint);
      setTimeout(() => setShakeError(false), 700);
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
                <span className="text-xs text-amber-200 font-bold">
                  المستوى {currentLevelIndex + 1} من {totalLevels}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black">{activity.title}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* عداد النجوم اللامعة */}
            <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/20">
              <Star className="w-4 h-4 text-amber-300 fill-amber-300 animate-pulse" />
              <span className="font-black text-sm text-amber-200">{stars}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                stopMousaVoice();
                onClose();
              }}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center text-white transition"
              title="إغلاق اللعبة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* مؤشر التقدم الشريطي في المستويات */}
        <div className="w-full bg-slate-100 h-2 flex">
          {Array.from({ length: totalLevels }).map((_, idx) => (
            <div
              key={idx}
              className={`flex-1 transition-all duration-500 border-r border-white/50 ${
                idx <= currentLevelIndex ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* الشاشة الختامية عند الفوز واجتياز اللعبة */}
        {isCompleted ? (
          <div className="p-8 sm:p-12 text-center flex flex-col items-center bg-gradient-to-b from-amber-50/50 to-white">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center shadow-xl shadow-amber-400/30 text-5xl animate-bounce">
                🏆
              </div>
              <div className="absolute -top-2 -right-2 text-2xl animate-spin" style={{ animationDuration: '6s' }}>
                ✨
              </div>
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-slate-800 mb-2">
              مُبَارَكٌ يَا بَطَل! فُزْتَ بِاللُّعْبَةِ! 🌟
            </h3>
            <p className="text-sm text-slate-600 max-w-md leading-relaxed mb-6">
              لَقَدْ أَكْمَلْتَ جَمِيعَ تَحَدِّيَاتِ <b className="text-amber-600">({activity.title})</b> بِتَفَوُّقٍ بَاهِرٍ، وَكَسَبْتَ وِسَامَ الأَبْطَالِ المُمَيَّز!
            </p>

            {/* بطاقة الوسام الممنوح */}
            <div className="bg-white border-2 border-amber-300 rounded-3xl p-5 shadow-lg max-w-sm w-full mb-8 flex items-center gap-4 text-right">
              <div className="text-4xl p-3 bg-amber-50 rounded-2xl border border-amber-200 flex-shrink-0">
                {gameData.gameType === 'phonics_treasure' && '💎'}
                {gameData.gameType === 'sentence_builder' && '🧩'}
                {gameData.gameType === 'story_quest' && '🏰'}
                {gameData.gameType === 'vowel_train' && '🚂'}
                {gameData.gameType === 'letter_blending' && '🧪'}
                {gameData.gameType === 'vocab_detective' && '🔍'}
                {gameData.gameType === 'category_sorter' && '⚖️'}
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md inline-block mb-1">
                  وسام مكتسب جديد
                </span>
                <h4 className="font-black text-sm text-slate-800">
                  {gameData.gameType === 'phonics_treasure' && 'بطل كنز الحروف 💎'}
                  {gameData.gameType === 'sentence_builder' && 'مهندس الجمل الماهر 🧩'}
                  {gameData.gameType === 'story_quest' && 'فارس مغامرات موسى 🏰'}
                  {gameData.gameType === 'vowel_train' && 'قائد قطار المدود 🚂'}
                  {gameData.gameType === 'letter_blending' && 'عالم معمل الكلمات 🧪'}
                  {gameData.gameType === 'vocab_detective' && 'المحقق اللغوي العبقري 🔍'}
                  {gameData.gameType === 'category_sorter' && 'خبير تصنيف الظواهر ⚖️'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  تم تسجيل درجتك (10/10) وإضافة الوسام إلى حائط إنجازاتك فوراً!
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
              <button
                type="button"
                onClick={() => setShowShareBadgeModal(true)}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm rounded-2xl transition shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-yellow-200" />
                مشاركة الإنجاز مع العائلة 🌟
              </button>

              <button
                type="button"
                onClick={() => {
                  stopMousaVoice();
                  onClose();
                }}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm rounded-2xl transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2"
              >
                <Trophy className="w-5 h-5 text-amber-300" />
                العودة للألعاب
              </button>
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
                    onClick={() => speakWithMousaVoice(currentLevel.prompt)}
                    className="flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 transition bg-amber-100/80 px-2 py-0.5 rounded-lg"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> اسمع السؤال
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
                className={`mt-4 p-3.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2.5 transition-all animate-fadeIn ${
                  levelStatus === 'success'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                {levelStatus === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                ) : (
                  <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0" />
                )}
                <span>{feedbackMsg}</span>
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
