import React, { useState, useEffect } from 'react';
import { 
  X, Award, Sparkles, Volume2, ArrowRight, RotateCcw, 
  CheckCircle2, Star, Trophy, ArrowLeft, Lightbulb
} from 'lucide-react';
import { Activity, GameData, GameLevel, UserProfile, ChildBadge } from '../types';
import { speakArabicText, stopArabicSpeech } from '../geminiService';
import { saveStudentBadge, saveSubmission } from '../storage';

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

  // حالة لعبة تركيب الجمل
  const [selectedWordSequence, setSelectedWordSequence] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>([]);

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
    }

    // قراءة نص السؤال تلقائياً بصوت موسى
    const promptText = currentLevel.prompt.replace(/[\*\#\_]/g, '');
    speakArabicText(promptText);

    return () => {
      stopArabicSpeech();
    };
  }, [currentLevelIndex, isOpen, gameData]);

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
      speakArabicText(currentLevel.feedbackSuccess);

      setTimeout(() => {
        advanceToNextLevel();
      }, 2200);
    } else {
      playSound('wrong');
      setLevelStatus('hint');
      setShakeError(true);
      setFeedbackMsg(currentLevel.feedbackHint);
      speakArabicText(currentLevel.feedbackHint);
      setTimeout(() => setShakeError(false), 700);
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
      playSound('correct');
      setLevelStatus('success');
      setFeedbackMsg(currentLevel.feedbackSuccess);
      setStars((prev) => prev + 1);
      speakArabicText(currentLevel.feedbackSuccess);

      setTimeout(() => {
        advanceToNextLevel();
      }, 2400);
    } else {
      playSound('wrong');
      setLevelStatus('hint');
      setShakeError(true);
      setFeedbackMsg(currentLevel.feedbackHint);
      speakArabicText(currentLevel.feedbackHint);
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
      speakArabicText(currentLevel.feedbackSuccess);

      setTimeout(() => {
        advanceToNextLevel();
      }, 2500);
    } else {
      playSound('wrong');
      setLevelStatus('hint');
      setShakeError(true);
      setFeedbackMsg(currentLevel.feedbackHint);
      speakArabicText(currentLevel.feedbackHint);
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

    // حفظ الوسام في جدول badges في Supabase
    saveStudentBadge(student.id, newBadge);

    // تسجيل الدرجة في جدول submissions ليراها المعلم فوراً
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
                stopArabicSpeech();
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
                {gameData.gameType === 'phonics_treasure' ? '💎' : gameData.gameType === 'sentence_builder' ? '🧩' : '🏰'}
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md inline-block mb-1">
                  وسام مكتسب جديد
                </span>
                <h4 className="font-black text-sm text-slate-800">
                  {gameData.gameType === 'phonics_treasure' ? 'بطل كنز الحروف 💎' : gameData.gameType === 'sentence_builder' ? 'مهندس الجمل الماهر 🧩' : 'فارس مغامرات موسى 🏰'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  تم تسجيل درجتك (10/10) وإضافة الوسام إلى حائط إنجازاتك فوراً!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                stopArabicSpeech();
                onClose();
              }}
              className="px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm rounded-2xl transition shadow-lg shadow-emerald-600/25 flex items-center gap-2"
            >
              <Trophy className="w-5 h-5 text-amber-300" />
              العودة إلى البوابة وقائمة الألعاب
            </button>
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
                  <span className="font-extrabold text-xs text-amber-900">موسى يقول لك:</span>
                  <button
                    type="button"
                    onClick={() => speakArabicText(currentLevel.prompt)}
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
                      <span className="text-base sm:text-lg font-black text-slate-800 group-hover:text-amber-900">
                        {opt}
                      </span>
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
                      <ArrowLeft className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:-translate-x-1 transition" />
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
    </div>
  );
};
