import React, { useState, useMemo } from 'react';
import { 
  X, Trophy, Sparkles, CheckCircle2, RotateCcw, Lock, Play, 
  HelpCircle, ChevronRight, Award, Zap, Clock, ShieldCheck, 
  Layers, Star, BookOpen, AlertCircle, RefreshCw, Check, ArrowRight
} from 'lucide-react';
import { 
  UserProfile, KnowledgeNode, KnowledgeDomainId, NodeMasteryState, NodeMasteryStatus,
  GradeLevel, ArabicTrack 
} from '../types';
import { 
  KNOWLEDGE_DOMAINS, 
  KNOWLEDGE_TREE_NODES, 
  calculateSpacedRepetitionState 
} from '../data/knowledgeTreeData';
import { getNodeMasteryStates, recordNodePractice } from '../storage';
import { getGradeLabel } from '../utils/gradebookExport';

interface AdaptiveKnowledgeTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  targetStudent?: UserProfile;
}

export const AdaptiveKnowledgeTreeModal: React.FC<AdaptiveKnowledgeTreeModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  targetStudent,
}) => {
  const student = targetStudent || currentUser;
  const isStudentSelf = currentUser.id === student.id;

  // النطاق المعرفي المختار للفلترة (أو عرض الكل)
  const [selectedDomain, setSelectedDomain] = useState<KnowledgeDomainId | 'all'>('all');

  // جلب حالات الإتقان الحالية للطالب
  const [masteryStates, setMasteryStates] = useState<Record<string, NodeMasteryState>>(() => {
    return getNodeMasteryStates(student.id);
  });

  // العقدة المختارة للممارسة والتدريب التفاعلي
  const [activePracticeNode, setActivePracticeNode] = useState<KnowledgeNode | null>(null);
  const [examLength, setExamLength] = useState<50 | 25 | 10>(50); // افتراضياً 50 سؤالاً كاملاً
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [practiceFinished, setPracticeFinished] = useState(false);

  // تحديث الحالات عند فتح النافذة
  React.useEffect(() => {
    if (isOpen) {
      setMasteryStates(getNodeMasteryStates(student.id));
    }
  }, [isOpen, student.id]);

  // حساب حالات التكرار المتباعد والتلاشي المعرفي لكل عقدة
  const nodesWithDecay = useMemo(() => {
    return KNOWLEDGE_TREE_NODES.map(node => {
      const state = masteryStates[node.id];
      const decayInfo = calculateSpacedRepetitionState(
        state?.lastPracticedDate,
        state?.masteryScore ?? (state?.status === 'mastered_gold' ? 100 : 0),
        state?.retentionStrength ?? 14
      );

      // التحقق من فك القفل بحسب المتطلبات السابقة
      const arePrereqsMet = node.prerequisites.length === 0 || node.prerequisites.every(prereqId => {
        const prereqState = masteryStates[prereqId];
        return prereqState && (prereqState.status === 'mastered_gold' || prereqState.crowns > 0);
      });

      let finalStatus: NodeMasteryStatus = 'locked';
      if (!arePrereqsMet) {
        finalStatus = 'locked';
      } else if (!state || state.status === 'unlocked') {
        finalStatus = 'unlocked';
      } else {
        finalStatus = decayInfo.status;
      }

      // أسماء المتطلبات السابقة للعرض الواضح
      const prereqNodes = node.prerequisites.map(pid => {
        const p = KNOWLEDGE_TREE_NODES.find(n => n.id === pid);
        return p ? p.titleAr : pid;
      });

      return {
        ...node,
        computedStatus: finalStatus,
        effectiveScore: state ? decayInfo.effectiveScore : 0,
        decayPercentage: state ? decayInfo.decayPercentage : 0,
        daysSincePractice: decayInfo.daysSincePractice,
        crowns: state?.crowns || 0,
        lastPracticedDate: state?.lastPracticedDate,
        prereqNodes,
      };
    });
  }, [masteryStates]);

  // الإحصاءات الإجمالية للشجرة
  const stats = useMemo(() => {
    const total = nodesWithDecay.length;
    const masteredGold = nodesWithDecay.filter(n => n.computedStatus === 'mastered_gold').length;
    const needsPolish = nodesWithDecay.filter(n => n.computedStatus === 'needs_polish').length;
    const practicing = nodesWithDecay.filter(n => n.computedStatus === 'practicing' || n.computedStatus === 'unlocked').length;
    const totalCrowns = nodesWithDecay.reduce((acc, curr) => acc + curr.crowns, 0);
    const overallMasteryRate = Math.round((masteredGold / (total || 1)) * 100);

    return {
      total,
      masteredGold,
      needsPolish,
      practicing,
      totalCrowns,
      overallMasteryRate,
    };
  }, [nodesWithDecay]);

  // تصفية العقد حسب النطاق المختار
  const filteredNodes = useMemo(() => {
    if (selectedDomain === 'all') return nodesWithDecay;
    return nodesWithDecay.filter(n => n.domain === selectedDomain);
  }, [nodesWithDecay, selectedDomain]);

  // أسئلة الجلسة النشطة
  const activeQuestions = useMemo(() => {
    if (!activePracticeNode) return [];
    return activePracticeNode.questions.slice(0, examLength);
  }, [activePracticeNode, examLength]);

  // العثور على المهارة اللاحقة مباشرة
  const nextTargetNode = useMemo(() => {
    if (!activePracticeNode) return null;
    const child = KNOWLEDGE_TREE_NODES.find(n => n.prerequisites.includes(activePracticeNode.id));
    if (child) return child;
    const idx = KNOWLEDGE_TREE_NODES.findIndex(n => n.id === activePracticeNode.id);
    return KNOWLEDGE_TREE_NODES[idx + 1] || null;
  }, [activePracticeNode]);

  if (!isOpen) return null;

  // بدء جلسة تدريب على مهارة
  const handleStartPractice = (node: KnowledgeNode, targetLength: 50 | 25 | 10 = 50) => {
    setActivePracticeNode(node);
    setExamLength(targetLength);
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setShowAnswerFeedback(false);
    setCorrectAnswersCount(0);
    setPracticeFinished(false);
  };

  // تقديم إجابة
  const handleSubmitAnswer = () => {
    if (!selectedOption || !activePracticeNode || activeQuestions.length === 0) return;
    const currentQ = activeQuestions[currentQuestionIndex];
    const isCorrect = selectedOption === currentQ.correctAnswer;
    if (isCorrect) {
      setCorrectAnswersCount(prev => prev + 1);
    }
    setShowAnswerFeedback(true);
  };

  // الانتقال للسؤال التالي أو إنهاء الجلسة والتحقق من الإتقان
  const handleNextQuestion = () => {
    if (!activePracticeNode) return;
    if (currentQuestionIndex + 1 < activeQuestions.length) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setShowAnswerFeedback(false);
    } else {
      // إنهاء الجلسة واحتساب النتيجة
      const totalQ = activeQuestions.length;
      const score = Math.round((correctAnswersCount / totalQ) * 100);
      const updatedState = recordNodePractice(student.id, activePracticeNode.id, score);
      
      setMasteryStates(prev => ({
        ...prev,
        [activePracticeNode.id]: updatedState,
      }));
      setPracticeFinished(true);
    }
  };

  const finalScore = activeQuestions.length > 0 
    ? Math.round((correctAnswersCount / activeQuestions.length) * 100) 
    : 0;
  const isMasteredNow = finalScore >= 80;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in" dir="rtl">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[94vh] overflow-hidden">
        
        {/* الترويسة العلوية */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white px-6 py-4.5 border-b border-indigo-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-bold text-xl shadow-inner">
              🌳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">
                  شجرة الكفايات التكيفية والتكرار المتباعد
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400/20 text-amber-200 border border-amber-400/30">
                  Adaptive Knowledge Graph • بنك الـ 50 سؤالاً
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                الطالب: <b className="text-white">{student.name}</b> • {getGradeLabel(student.grade || 'grade-2')} • فك المهارات مشروط بتحقيق حد الإتقان (80%)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* جسم النافذة الرئيسي */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/60">

          {/* لوحة المؤشرات العلوية */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">نسبة الإتقان التراكمي</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-indigo-700">{stats.overallMasteryRate}%</span>
                <span className="text-[10px] text-slate-400 font-medium">من الشجرة</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500" 
                  style={{ width: `${stats.overallMasteryRate}%` }}
                />
              </div>
            </div>

            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">المهارات الذهبية 🏆</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-amber-500">{stats.masteredGold}</span>
                <span className="text-[10px] text-slate-400 font-medium">/ {stats.total} مهارة</span>
              </div>
              <span className="text-[10px] text-emerald-600 font-bold block mt-1">إتقان 80%+ فك المهارات اللاحقة</span>
            </div>

            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">تحتاج إلى صقل 🔄</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-rose-500">{stats.needsPolish}</span>
                <span className="text-[10px] text-slate-400 font-medium">مهارات</span>
              </div>
              <span className="text-[10px] text-rose-600 font-bold block mt-1">تجاوزت 14 يوماً بلا ممارسة</span>
            </div>

            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">بنك الأسئلة المعتمد 🎓</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-teal-600">50</span>
                <span className="text-[10px] text-slate-400 font-medium">سؤالاً مراجعاً لكل مهارة</span>
              </div>
              <span className="text-[10px] text-teal-700 font-bold block mt-1">إجمالي 850 سؤالاً مشكولاً</span>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3.5 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-200 shadow-2xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 block mb-0.5">نظام التتابع المشروط</span>
                <span className="text-xs font-black text-indigo-950 block">Mastery Learning Standard</span>
              </div>
              <p className="text-[10px] text-indigo-700 leading-tight mt-1">
                تفتح المهارة التالية تلقائياً عند التأكد من إتقان المهارة السابقة بدرجة 80% فأعلى.
              </p>
            </div>
          </div>

          {/* تبويبات النطاقات المعرفية الخمسة */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              type="button"
              onClick={() => setSelectedDomain('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
                selectedDomain === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              كل النطاقات ({nodesWithDecay.length})
            </button>
            {Object.values(KNOWLEDGE_DOMAINS).map(domain => {
              const count = nodesWithDecay.filter(n => n.domain === domain.id).length;
              const isSelected = selectedDomain === domain.id;
              return (
                <button
                  key={domain.id}
                  type="button"
                  onClick={() => setSelectedDomain(domain.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{domain.icon}</span>
                  <span>{domain.titleAr}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* خريطة الشجرة التراكمية (Sequential Node Map) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-xs text-slate-700 flex items-center gap-2">
                <span>مسار التعلم التراكمي المشروط:</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  (كل مستوى به 50 سؤالاً مراجعاً، وتفتح المهارة التالية فور التأكد من إتقان المهارة السابقة)
                </span>
              </h3>
              <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
                <span className="flex items-center gap-1 text-amber-600">🏆 ذهبي متقن</span>
                <span className="flex items-center gap-1 text-rose-600 animate-pulse">🔄 يحتاج صقلاً</span>
                <span className="flex items-center gap-1 text-indigo-600">⚡ مفتوح للاختبار</span>
                <span className="flex items-center gap-1 text-slate-400">🔒 مقفل</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredNodes.map(node => {
                const domainMeta = KNOWLEDGE_DOMAINS[node.domain];
                const isLocked = node.computedStatus === 'locked';
                const isGold = node.computedStatus === 'mastered_gold';
                const isNeedsPolish = node.computedStatus === 'needs_polish';

                let cardBorder = 'border-slate-200 bg-white hover:border-indigo-300';
                let statusBadge = (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500">
                    مفتوح للتقييم
                  </span>
                );

                if (isGold) {
                  cardBorder = 'border-amber-300 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/20 shadow-xs hover:border-amber-400';
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                      <span>🏆</span>
                      <span>متقن ذهبي (80%+)</span>
                    </span>
                  );
                } else if (isNeedsPolish) {
                  cardBorder = 'border-rose-300 bg-gradient-to-br from-rose-50/50 via-white to-rose-50/20 shadow-xs hover:border-rose-400';
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 animate-pulse">
                      <span>🔄</span>
                      <span>صقل وتجديد</span>
                    </span>
                  );
                } else if (isLocked) {
                  cardBorder = 'border-slate-200 bg-slate-50/70 opacity-60';
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-500 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>مقفل</span>
                    </span>
                  );
                }

                return (
                  <div 
                    key={node.id} 
                    className={`rounded-2xl border p-4.5 transition-all flex flex-col justify-between ${cardBorder}`}
                  >
                    <div>
                      {/* الترويسة المصغرة للكارت */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{node.icon}</span>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block">
                              المستوى {node.level} • {domainMeta.titleAr}
                            </span>
                            <h4 className="font-black text-sm text-slate-900 leading-snug">
                              {node.titleAr}
                            </h4>
                          </div>
                        </div>
                        {statusBadge}
                      </div>

                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 my-2">
                        {node.descriptionAr}
                      </p>

                      {/* شارة بنك الـ 50 سؤالاً وحالة الفتح */}
                      <div className="my-2 p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-indigo-700 font-extrabold flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-indigo-500" />
                          <span>بنك المهارة: 50 سؤالاً مراجعاً</span>
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-white border border-slate-200 text-slate-600">
                          {node.cefrLevel}
                        </span>
                      </div>

                      {/* تنبيه شرط الفتح إذا كان مقفلاً */}
                      {isLocked && node.prereqNodes.length > 0 && (
                        <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-200/60 text-[10px] text-amber-900 font-bold flex items-center gap-1.5 mb-2">
                          <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>يتطلب إتقان: «{node.prereqNodes.join('، ')}» (80%+)</span>
                        </div>
                      )}

                      {/* مؤشرات التكرار المتباعد والتيجان */}
                      <div className="flex items-center justify-between text-xs py-1.5 border-t border-slate-100 mt-1">
                        <div className="flex items-center gap-1 text-amber-500">
                          {[1, 2, 3, 4, 5].map(star => (
                            <span 
                              key={star} 
                              className={`text-xs ${star <= node.crowns ? 'opacity-100' : 'opacity-20'}`}
                            >
                              👑
                            </span>
                          ))}
                        </div>

                        {node.lastPracticedDate ? (
                          <span className="text-[10px] text-slate-400 font-medium">
                            آخر ممارسة: منذ {node.daysSincePractice} يوم
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">
                            لم تُمارس بعد
                          </span>
                        )}
                      </div>
                    </div>

                    {/* أزرار بدء الاختبار والتقييم */}
                    <div className="pt-2">
                      {isLocked ? (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 justify-center py-2.5 bg-slate-100 rounded-xl">
                          <Lock className="w-3.5 h-3.5" />
                          <span>مقفل حتى إتقان المهارة السابقة</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartPractice(node, 50)}
                          className={`w-full py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
                            isNeedsPolish
                              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                              : isGold
                              ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>
                            {isNeedsPolish 
                              ? 'صقل المهارة (50 سؤالاً) 🔄' 
                              : isGold 
                              ? 'اختبار إثرائي ذهبي (50 سؤالاً) 🏆' 
                              : 'اختبار الإتقان لفك اللاحق (50 سؤالاً) ⚡'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* الشريط السفلي */}
        <div className="bg-white border-t border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400 font-medium">
            تضمن المنظومة التكيفية عدم الانتقال لأي مهارة لاحقة إلا بعد التحقق الأكاديمي الصارم من إتقان المهارات التأسيسية.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* نافذة التمرين التفاعلي للمهارة (Practice Session Modal) */}
      {/* ========================================================================= */}
      {activePracticeNode && (
        <div className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" dir="rtl">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
            
            {/* رأس نافذة الاختبار */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{activePracticeNode.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 block">اختبار الإتقان الأكاديمي:</span>
                    <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-indigo-100 text-indigo-700">
                      بنك الـ 50 سؤالاً
                    </span>
                  </div>
                  <h3 className="font-black text-sm text-slate-900">{activePracticeNode.titleAr}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePracticeNode(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!practiceFinished ? (
              <div className="space-y-5">
                {/* مفتاح تبديل عدد الأسئلة إن رغب المستخدم قبل أو أثناء البدء */}
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl border border-slate-200 text-xs">
                  <span className="text-[11px] font-bold text-slate-500">حجم الاختبار:</span>
                  <div className="flex items-center gap-1">
                    {([50, 25, 10] as const).map(len => (
                      <button
                        key={len}
                        type="button"
                        onClick={() => {
                          setExamLength(len);
                          setCurrentQuestionIndex(0);
                          setCorrectAnswersCount(0);
                          setShowAnswerFeedback(false);
                          setSelectedOption(null);
                        }}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition cursor-pointer ${
                          examLength === len 
                            ? 'bg-indigo-600 text-white shadow-xs' 
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {len === 50 ? '50 سؤالاً (شامل)' : `${len} أسئلة`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* عداد الأسئلة ومؤشر التقدم */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>السؤال {currentQuestionIndex + 1} من {activeQuestions.length}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-700 font-black">
                        الإجابات الصحيحة: {correctAnswersCount}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-indigo-600 font-black">
                        معيار الإتقان المطلوب: 80%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${((currentQuestionIndex + 1) / activeQuestions.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* نص السؤال */}
                {activeQuestions[currentQuestionIndex] && (
                  <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                    <p className="text-base sm:text-lg font-black text-slate-900 leading-relaxed">
                      {activeQuestions[currentQuestionIndex].prompt}
                    </p>
                  </div>
                )}

                {/* الخيارات الأربعة */}
                {activeQuestions[currentQuestionIndex] && (
                  <div className="space-y-2.5">
                    {activeQuestions[currentQuestionIndex].options.map((option, idx) => {
                      const isSelected = selectedOption === option;
                      const isCorrect = option === activeQuestions[currentQuestionIndex].correctAnswer;
                      
                      let btnStyle = 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-800';
                      if (showAnswerFeedback) {
                        if (isCorrect) {
                          btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-black';
                        } else if (isSelected) {
                          btnStyle = 'border-rose-500 bg-rose-50 text-rose-950 font-black';
                        } else {
                          btnStyle = 'border-slate-200 opacity-50 text-slate-400';
                        }
                      } else if (isSelected) {
                        btnStyle = 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-black shadow-2xs';
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={showAnswerFeedback}
                          onClick={() => setSelectedOption(option)}
                          className={`w-full p-3.5 rounded-2xl border text-sm text-right transition cursor-pointer flex items-center justify-between ${btnStyle}`}
                        >
                          <span>{option}</span>
                          {showAnswerFeedback && isCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* التغذية الراجعة والشرح التربوي الأكاديمي */}
                {showAnswerFeedback && activeQuestions[currentQuestionIndex] && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-xs animate-fade-in">
                    <span className="font-extrabold text-slate-800 block">💡 التوضيح التربوي الأكاديمي:</span>
                    <p className="text-slate-600 leading-relaxed">
                      {activeQuestions[currentQuestionIndex].explanation}
                    </p>
                  </div>
                )}

                {/* أزرار التحكم بالسؤال */}
                <div className="pt-2">
                  {!showAnswerFeedback ? (
                    <button
                      type="button"
                      disabled={!selectedOption}
                      onClick={handleSubmitAnswer}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black transition cursor-pointer shadow-md shadow-indigo-600/20"
                    >
                      تأكيد الإجابة ✅
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black transition cursor-pointer shadow-md"
                    >
                      {currentQuestionIndex + 1 < activeQuestions.length ? 'السؤال التالي ➔' : 'إنهاء الاختبار والتحقق من الإتقان 🏁'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* شاشة إتمام التمرين والتحقق الأكاديمي من الإتقان وفك المهارة التالية */
              <div className="space-y-5 py-2 animate-fade-in text-center">
                
                {isMasteredNow ? (
                  <>
                    <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-100 border border-amber-300 text-amber-600 flex items-center justify-center text-3xl shadow-inner animate-bounce">
                      🏆
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900">
                        مبارك! تم التأكد من إتقان المهارة بنجاح 🎓
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        حققت درجة إتقان <b className="text-emerald-600 font-black">{finalScore}%</b> ({correctAnswersCount} من أصل {activeQuestions.length} أسئلة صحيحة)، وتجاوزت حد الإتقان المطلوب (80%).
                      </p>
                    </div>

                    <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-center">
                      <span className="text-[11px] font-bold text-amber-800 block">تم منح وسام التاج الذهبي 👑</span>
                      <span className="text-xs font-black text-amber-950 block mt-0.5">
                        تم تثبيت المهارة في الذاكرة طويلة المدى وفق خوارزمية التكرار المتباعد
                      </span>
                    </div>

                    {/* إشعار فك المهارة التالية */}
                    {nextTargetNode && (
                      <div className="p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-400 text-right space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                            <span>🔓</span> تم فك قفل المهارة التالية رسمياً:
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-200 text-emerald-900">
                            {nextTargetNode.cefrLevel}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{nextTargetNode.icon}</span>
                          <div>
                            <h5 className="font-black text-sm text-slate-900">{nextTargetNode.titleAr}</h5>
                            <p className="text-xs text-slate-600 line-clamp-1">{nextTargetNode.descriptionAr}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 space-y-2">
                      {nextTargetNode && (
                        <button
                          type="button"
                          onClick={() => handleStartPractice(nextTargetNode, 50)}
                          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
                        >
                          <span>الانتقال لاختبار المهارة التالية الآن</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => setActivePracticeNode(null)}
                        className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition cursor-pointer"
                      >
                        العودة إلى شجرة الكفايات 🌳
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-100 border border-rose-300 text-rose-600 flex items-center justify-center text-3xl shadow-inner">
                      ⚠️
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900">
                        لم يتم تحقيق حد الإتقان المطلوب (80%)
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        حققت درجة <b className="text-rose-600 font-black">{finalScore}%</b> ({correctAnswersCount} من {activeQuestions.length} أسئلة صحيحة). حد الإتقان الأكاديمي لفك المهارة اللاحقة هو 80%.
                      </p>
                    </div>

                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-right space-y-1 text-xs">
                      <span className="font-black text-rose-900 block flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-rose-700" />
                        المهارة التالية تظل مقفلة مؤقتاً:
                      </span>
                      <p className="text-rose-800 leading-relaxed text-[11px]">
                        لحماية البناء المعرفي التراكمي، تظل المهارة التالية مغلقة حتى تؤكد إتقانك لهذه المهارة. يُرجى صقل المفاهيم وإعادة المحاولة.
                      </p>
                    </div>

                    <div className="pt-2 space-y-2">
                      <button
                        type="button"
                        onClick={() => handleStartPractice(activePracticeNode, examLength)}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black transition cursor-pointer shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>إعادة المحاولة وصقل المهارة لتحقيق 80% 🔄</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActivePracticeNode(null)}
                        className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition cursor-pointer"
                      >
                        العودة إلى شجرة الكفايات 🌳
                      </button>
                    </div>
                  </>
                )}

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
