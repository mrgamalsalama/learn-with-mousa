import React, { useState, useEffect, useMemo } from 'react';
import { 
  Gamepad2, Trophy, BookOpen, Sparkles, Play, Target, 
  ChevronRight, Award, Flame, Star, CheckCircle2, Compass, Lock, Unlock, AlertCircle
} from 'lucide-react';
import { Activity, UserProfile, ChildBadge, AIGameType } from '../types';
import { 
  ADAPTIVE_LEVELS_META, 
  getRecommendedLevelForGrade, 
  getAdaptiveGamesForLevel,
  AdaptiveGameCardInfo 
} from '../data/adaptiveGamesData';
import { getStudentGameGovernance } from '../storage';

interface AdaptiveGamesSectionProps {
  currentUser: UserProfile;
  studentBadges: ChildBadge[];
  studentGames: Activity[];
  onPlayGame: (activity: Activity) => void;
}

export const AdaptiveGamesSection: React.FC<AdaptiveGamesSectionProps> = ({
  currentUser,
  studentBadges,
  studentGames,
  onPlayGame
}) => {
  // قواعد الحوكمة المسندة من المعلم
  const gameGovernance = useMemo(() => {
    return getStudentGameGovernance(currentUser.id, currentUser.grade || 'grade-1');
  }, [currentUser.id, currentUser.grade]);

  // حساب المستوى المقترح لصف الطالب
  const recommendedLevel = useMemo(() => {
    if (gameGovernance.defaultLevel) {
      return gameGovernance.defaultLevel;
    }
    return getRecommendedLevelForGrade(currentUser.grade);
  }, [currentUser.grade, gameGovernance.defaultLevel]);

  // حالة المستوى النشط الحالي (مبدئياً هو المستوى المقترح أو الافتراضي من المعلم)
  const [activeLevel, setActiveLevel] = useState<number>(() => {
    if (gameGovernance.lockLevelSwitcher && gameGovernance.defaultLevel) {
      return gameGovernance.defaultLevel;
    }
    try {
      const saved = localStorage.getItem(`mousa_active_game_level_${currentUser.id}`);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 1 && parsed <= 6) return parsed;
      }
    } catch (e) {}
    return recommendedLevel;
  });

  // تحديث المستوى المقترح تلقائياً إذا تغير توجيه المعلم أو صف الطالب
  useEffect(() => {
    if (gameGovernance.lockLevelSwitcher && gameGovernance.defaultLevel) {
      setActiveLevel(gameGovernance.defaultLevel);
    } else if (gameGovernance.defaultLevel) {
      setActiveLevel(gameGovernance.defaultLevel);
    } else {
      setActiveLevel(recommendedLevel);
    }
  }, [recommendedLevel, gameGovernance.defaultLevel, gameGovernance.lockLevelSwitcher]);

  // حفظ المستوى المختار (إن لم يكن التنقل مقفلاً من المعلم)
  const handleSelectLevel = (lvlNum: number) => {
    if (gameGovernance.lockLevelSwitcher) return;
    setActiveLevel(lvlNum);
    try {
      localStorage.setItem(`mousa_active_game_level_${currentUser.id}`, lvlNum.toString());
    } catch (e) {}
  };

  const activeLevelMeta = useMemo(() => {
    return ADAPTIVE_LEVELS_META.find(l => l.levelNumber === activeLevel) || ADAPTIVE_LEVELS_META[0];
  }, [activeLevel]);

  const adaptiveCards = useMemo(() => {
    return getAdaptiveGamesForLevel(activeLevel);
  }, [activeLevel]);

  // تشغيل لعبة مباشرة وفق المستوى النشط
  const handleStartAdaptiveGame = (card: AdaptiveGameCardInfo) => {
    const starterActivity: Activity = {
      id: `adaptive_${card.gameType}_lvl${activeLevel}_${Date.now()}`,
      title: `${card.title} (المستوى ${activeLevel})`,
      activityType: 'game',
      gameData: card.sampleData,
      teacherId: 'system_mousa_adaptive',
      teacherName: 'موسى التكيفي الذكي',
      stage: currentUser.stage,
      grade: currentUser.grade,
      track: currentUser.track,
      questions: [],
      createdAt: new Date().toLocaleDateString('ar-EG')
    };

    onPlayGame(starterActivity);
  };

  return (
    <div className="space-y-6">
      {/* ترويسة ساحة الألعاب التفاعلية */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-amber-500/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black text-amber-100 mb-2">
              <Gamepad2 className="w-4 h-4 text-amber-200" />
              <span>نظام الألعاب التدرجي التكيفي (6 مستويات ذكية) 🎮</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black mb-1.5">
              مَرْحَبًا بِكَ فِي سَاحَةِ أَلْعَابِ مُوسَى التَّكَيُّفِيَّةِ 🌟
            </h2>
            <p className="text-xs sm:text-sm text-amber-100 max-w-xl leading-relaxed">
              تم تسكين ألعابك وفق مستواك الدراسي المتدرج، ويمكنك التنقل بحرية بين المستويات الستة لصقل مهاراتك من التأسيس حتى فقه اللغة!
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/15 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 shadow-xs flex-shrink-0">
            <Trophy className="w-7 h-7 text-amber-200" />
            <div>
              <div className="text-[11px] text-amber-100 font-bold">أوسمتك المحققة</div>
              <div className="text-lg font-black text-white">{studentBadges.length} وسام 🏆</div>
            </div>
          </div>
        </div>
      </div>

      {/* التحدي الأسبوعي الإلزامي إن وُجد من المعلم */}
      {gameGovernance.weeklyQuest && (
        <div className="p-4 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white rounded-3xl shadow-lg border-2 border-white/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black shrink-0 shadow-inner">
              ⭐
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white text-amber-950 shadow-2xs">
                  تحدي أسبوعي إلزامي من المعلم 🎯
                </span>
                {gameGovernance.weeklyQuest.dueDate && (
                  <span className="text-[11px] text-amber-100 font-bold">
                    موعد التسليم: {gameGovernance.weeklyQuest.dueDate}
                  </span>
                )}
              </div>
              <h3 className="text-base font-black mt-1">
                {gameGovernance.weeklyQuest.title}
              </h3>
              <p className="text-xs text-amber-100 mt-0.5">
                المهارة المستهدفة: <b>{gameGovernance.weeklyQuest.targetSkill}</b> • نسبة الإتقان المطلوبة: <b>{gameGovernance.weeklyQuest.requiredMastery}%</b> ({gameGovernance.weeklyQuest.questionCount || 15} سؤالاً)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const questGameType = gameGovernance.weeklyQuest?.gameType || 'vowel_train';
              const adaptiveGames = getAdaptiveGamesForLevel(activeLevel);
              const matched = adaptiveGames.find(g => g.gameType === questGameType) || adaptiveGames[0];
              const questActivity: Activity = {
                id: `quest_${questGameType}_${Date.now()}`,
                title: gameGovernance.weeklyQuest?.title || 'التحدي الأسبوعي',
                activityType: 'game',
                gameData: matched.sampleData,
                teacherId: 'teacher_weekly_quest',
                teacherName: 'المعلم',
                stage: currentUser.stage,
                grade: currentUser.grade,
                track: currentUser.track,
                questions: [],
                min_mastery_score: gameGovernance.weeklyQuest?.requiredMastery || 80,
                due_date: gameGovernance.weeklyQuest?.dueDate,
                createdAt: new Date().toLocaleDateString('ar-EG')
              };
              onPlayGame(questActivity);
            }}
            className="px-5 py-2.5 bg-white hover:bg-amber-50 text-amber-950 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-md cursor-pointer shrink-0"
          >
            <Play className="w-4 h-4 text-amber-600" />
            <span>ابدأ التحدي الأسبوعي الآن 🚀</span>
          </button>
        </div>
      )}

      {/* شريط اختيار المستويات الستة التفاعلي (Adaptive 6-Level Switcher Bar) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
        {gameGovernance.lockLevelSwitcher && (
          <div className="mb-3.5 p-3 bg-amber-50 rounded-2xl border border-amber-300 flex items-center justify-between gap-2 text-xs text-amber-950 font-bold">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <b>حرية تنقل المستويات مقفلة:</b> لقد حدد معلمك المستوى ({gameGovernance.defaultLevel}) كمسار إلزامي لك لتركيز التعلّم.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black shrink-0">
              تنقل مقفل 🔒
            </span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-amber-600" />
            <h3 className="font-black text-sm sm:text-base text-slate-800">
              مسار المستويات المعيارية (اختر المستوى للتحدي):
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            {gameGovernance.lockLevelSwitcher 
              ? 'المستوى محدد بتوجيه المعلم 🔒' 
              : 'تتدرج الصعوبة والمفردات تلقائياً بحسب المستوى المختار'}
          </span>
        </div>

        {/* شبكة أزرار المستويات الستة */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {ADAPTIVE_LEVELS_META.map((lvl) => {
            const isSelected = lvl.levelNumber === activeLevel;
            const isRecommended = lvl.levelNumber === recommendedLevel;
            const isLocked = gameGovernance.lockLevelSwitcher && !isSelected;

            return (
              <button
                key={lvl.levelNumber}
                type="button"
                onClick={() => !isLocked && handleSelectLevel(lvl.levelNumber)}
                disabled={isLocked}
                className={`p-3 rounded-2xl border text-right transition flex flex-col justify-between relative ${
                  isLocked ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400' : 'cursor-pointer group'
                } ${
                  isSelected
                    ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-900 shadow-md shadow-slate-900/20 ring-2 ring-amber-400/50'
                    : isLocked ? '' : 'bg-slate-50/80 hover:bg-slate-100 text-slate-700 border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* شارة مستواك المقترح */}
                {isRecommended && !isLocked && (
                  <span className={`absolute -top-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-black shadow-xs flex items-center gap-0.5 ${
                    isSelected ? 'bg-amber-400 text-slate-900' : 'bg-amber-500 text-white'
                  }`}>
                    <Target className="w-2.5 h-2.5" />
                    <span>مقترح 🎯</span>
                  </span>
                )}

                {isLocked && (
                  <span className="absolute -top-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-300 text-slate-700 shadow-2xs flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" />
                    <span>مقفل</span>
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
                      isSelected ? 'bg-amber-400 text-slate-900' : 'bg-slate-200/80 text-slate-700'
                    }`}>
                      {lvl.levelNumber}
                    </span>
                    <span className={`text-[10px] font-bold ${
                      isSelected ? 'text-amber-300' : 'text-slate-400'
                    }`}>
                      {lvl.targetGrades}
                    </span>
                  </div>
                  <h4 className={`text-xs font-black line-clamp-1 mb-1 ${
                    isSelected ? 'text-white' : 'text-slate-800'
                  }`}>
                    المستوى {lvl.levelNumber}
                  </h4>
                </div>

                <div className="mt-1 pt-1.5 border-t border-slate-200/40">
                  <span className={`text-[10px] font-semibold line-clamp-1 ${
                    isSelected ? 'text-slate-300' : 'text-slate-500'
                  }`}>
                    {lvl.badge}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* بطاقة تفاصيل المستوى النشط المختار */}
        <div className="mt-4 p-3.5 bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-50/40 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-xs flex-shrink-0">
              L{activeLevelMeta.levelNumber}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900">
                  {activeLevelMeta.title} ({activeLevelMeta.targetGrades})
                </span>
                <span className="px-2 py-0.5 bg-amber-200/80 text-amber-950 rounded-md text-[10px] font-extrabold">
                  {activeLevelMeta.badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                🎯 المهارات المستهدفة: {activeLevelMeta.theme}
              </p>
            </div>
          </div>

          {activeLevel === recommendedLevel ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-extrabold self-start sm:self-auto border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>مستواك المتطابق مع صفك الدراسي</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => handleSelectLevel(recommendedLevel)}
              className="text-xs font-bold text-amber-800 hover:text-amber-950 underline self-start sm:self-auto cursor-pointer"
            >
              العودة لمستواي المقترح (المستوى {recommendedLevel}) ↩️
            </button>
          )}
        </div>
      </div>

      {/* ألعاب الصف المسندة من المعلم (إن وجدت) */}
      {studentGames.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-600" /> ألعاب صفي المسندة من المعلم ({studentGames.length})
            </h3>
            <span className="text-xs text-slate-400 font-medium">ألعاب مخصصة لمنهجك الدراسي المباشر</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {studentGames.map((gameAct) => {
              const gType = gameAct.gameData?.gameType || 'phonics_treasure';
              const icon = gType === 'phonics_treasure' ? '💎' : gType === 'sentence_builder' ? '🧩' : '🏰';
              const label = gType === 'phonics_treasure' ? 'كنز الحروف والصوتيات' : gType === 'sentence_builder' ? 'تركيب وبناء الجمل' : 'مغامرة موسى والقرارات';
              return (
                <div
                  key={gameAct.id}
                  className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-[10px] font-black flex items-center gap-1">
                        <span>{icon}</span> {label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">{gameAct.createdAt}</span>
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-800 mb-1.5">{gameAct.title}</h4>
                    {gameAct.gameData?.targetSkill && (
                      <p className="text-xs text-amber-800 font-bold bg-amber-50/60 p-2 rounded-xl mb-3 border border-amber-100">
                        🎯 المهارة: {gameAct.gameData.targetSkill}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mb-4 line-clamp-2">
                      {gameAct.gameData?.instructions || 'انطلق في هذا التحدي التفاعلي مع موسى واجمع النقاط!'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-3">
                    <span className="text-xs text-slate-500 font-semibold">
                      إعداد: <b className="text-slate-700">{gameAct.teacherName}</b>
                    </span>
                    <button
                      type="button"
                      onClick={() => onPlayGame(gameAct)}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" /> العب الآن 🎮
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* باقة ألعاب المستوى النشط (6 ألعاب تكيُّفية متكاملة) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="font-black text-base text-slate-800">
              ألعاب المستوى {activeLevel}: {activeLevelMeta.title} ({adaptiveCards.length} ألعاب ذكية)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            مفردات وتحديات مخصصة للمستوى {activeLevel}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {adaptiveCards.map((card) => {
            return (
              <div
                key={card.gameType}
                className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition flex flex-col justify-between group hover:border-amber-300"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-800 flex items-center justify-center text-xl shadow-2xs group-hover:scale-110 transition">
                      {card.icon}
                    </div>
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-black rounded-lg border border-slate-200/70">
                      المستوى {activeLevel}
                    </span>
                  </div>

                  <span className="px-2 py-0.5 bg-amber-50 text-amber-900 text-[10px] font-bold rounded-md border border-amber-200/80 inline-block mb-1.5">
                    🎯 {card.skillLabel}
                  </span>

                  <h4 className="font-black text-sm text-slate-800 mb-1.5 group-hover:text-amber-600 transition">
                    {card.title}
                  </h4>

                  <p className="text-xs text-slate-500 mb-4 leading-relaxed line-clamp-3">
                    {card.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleStartAdaptiveGame(card)}
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-[0.99] text-white font-black rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" /> العب الآن 🎮
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
