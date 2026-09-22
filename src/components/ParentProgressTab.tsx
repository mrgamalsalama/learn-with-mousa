import React, { useState, useMemo } from 'react';
import { 
  Sparkles, Brain, Printer, Award, Volume2, VolumeX, 
  RefreshCw, CheckCircle2, TrendingUp, BookOpen, Layers, 
  PenTool, MessageCircle, Share2, Copy, Check, ShieldAlert,
  ChevronLeft, Lightbulb, Star
} from 'lucide-react';
import { UserProfile, StudentSubmission, GradeLevel, STAGES_CONFIG } from '../types';
import { speakMousa, stopMousaVoice } from '../geminiService';

interface ParentProgressTabProps {
  student: UserProfile;
  studentSubs: StudentSubmission[];
  totalEarned: number;
  totalPossible: number;
  avgPercentage: number;
  isParentAIPermitted: boolean;
  parentAIReason: string;
  onOpenQuickDiagnostic: () => void;
  onOpenDiagnosticModal: () => void;
  onOpenPrintableWorksheet: () => void;
}

// ركائز اللغة العربية الأربعة
export interface ArabicSkillRadarPillar {
  id: 'phonics' | 'spelling' | 'grammar' | 'reading';
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  colorGradient: string;
  barColor: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  percentage: number;
  completedActivitiesCount: number;
  statusLabel: string;
  statusColor: string;
}

// بنك نصائح التوجيه المنزلي من الرفيق موسى
interface HomeGuidanceTip {
  id: string;
  pillarId: 'phonics' | 'spelling' | 'grammar' | 'reading' | 'general';
  activityName: string;
  iconEmoji: string;
  targetSkill: string;
  executionSteps: string;
  encouragementTip: string;
  estimatedMinutes: string;
}

const HOME_GUIDANCE_BANK: HomeGuidanceTip[] = [
  {
    id: 'tip_phonics_1',
    pillarId: 'phonics',
    activityName: 'لعبة «صيد الأصوات والمدود» أثناء التجول',
    iconEmoji: '🎶',
    targetSkill: 'الوعي الصوتي والتمييز بين الحركات القصيرة والمدود الطويلة',
    executionSteps: 'اطلب من طفلك أثناء الجلوس في غرفة المعيشة أو السيارة أن يستمع لك وأنت تنطق كلمة مثل (كَتَبَ)، ثم يسألك: هل فيها مد طويل؟ واجعله ينطق (كَاتِبٌ) ويمد الصوت بيده كالطائر!',
    encouragementTip: 'امدح مدّ صوته بوضوح: «ما شاء الله، أذنك الموسيقية تميز المد الطويل ببراعة!»',
    estimatedMinutes: '3 دقائق'
  },
  {
    id: 'tip_spelling_1',
    pillarId: 'spelling',
    activityName: 'تحدي «شمس وقمر» على لافتات الطريق والمنزل',
    iconEmoji: '☀️🌙',
    targetSkill: 'التمييز البصري والسمعي بين اللام الشمسية واللام القمرية',
    executionSteps: 'اختر مع طفلك 3 أشياء في المنزل (الباب، الشباك، الطاولة). قل الكلمة واسأله: هل نطقنا اللام واضحة (قمرية 🌙) أم أسرعنا نحو الشدة ولم ننطق اللام (شمسية ☀️)؟',
    encouragementTip: 'قل له: «أنت محقق ذكي تكتشف الحروف المخفية أسرع مني!»',
    estimatedMinutes: '4 دقائق'
  },
  {
    id: 'tip_grammar_1',
    pillarId: 'grammar',
    activityName: 'لعبة «مهندس الجمل العجيبة»',
    iconEmoji: '🧩',
    targetSkill: 'بناء الجمل الاسمية والفعلية وتحويل المفرد والمثنى',
    executionSteps: 'ابدأ بكلمة واحدة مثل (القمر...) واطلب من طفلك إكمالها بكلمة ثانية لتصبح جملة مفيدة (القمر مضيء). ثم اطلب منه تغييرها إلى جملة تبدأ بفعل (يضيء القمرُ سماءنا).',
    encouragementTip: 'شجع خياله: «أحسنت! كلماتك تبني بيتاً لغوياً متيناً وممتعاً».',
    estimatedMinutes: '5 دقائق'
  },
  {
    id: 'tip_reading_1',
    pillarId: 'reading',
    activityName: 'تحدي «المذيع الصغير وتلخيص الدقيقة الواحدة»',
    iconEmoji: '🎙️',
    targetSkill: 'الفهم القرائي والاستيعاب والطلاقة التعبيرية',
    executionSteps: 'أعطِ طفلك ملعقة أو قلماً كميكروفون بعد قراءة قصة قصيرة، واطلب منه أن يخبرك في 60 ثانية: ما هي المشكلة التي حدثت للبطل، وكيف استطاع حلها بذكائه؟',
    encouragementTip: 'أظهر انبهارك: «طريقة تلخيصك ممتعة جداً وكأنني أشاهد تقريراً إخبارياً مشوقاً!»',
    estimatedMinutes: '5 دقائق'
  },
  {
    id: 'tip_general_1',
    pillarId: 'general',
    activityName: '«بطاقة فخر المساء» وتعزيز الثقة',
    iconEmoji: '🌟',
    targetSkill: 'الدافعية الإيجابية والشغف المستمر باللغة العربية',
    executionSteps: 'قبل النوم، اسأل طفلك: ما هي أجمل كلمة جديدة تعلمتها اليوم في منصة موسى؟ واجعلاها كلمة السر المضحكة للصباح التالي!',
    encouragementTip: 'ركز على الجهد: «فخور بمثابرتك وتدريبك اليومي، التعلم المستمر يصنع الأبطال».',
    estimatedMinutes: '2 دقيقة'
  }
];

export const ParentProgressTab: React.FC<ParentProgressTabProps> = ({
  student,
  studentSubs,
  totalEarned,
  totalPossible,
  avgPercentage,
  isParentAIPermitted,
  parentAIReason,
  onOpenQuickDiagnostic,
  onOpenDiagnosticModal,
  onOpenPrintableWorksheet,
}) => {
  const [isSpeakingMousa, setIsSpeakingMousa] = useState(false);
  const [selectedTipIndex, setSelectedTipIndex] = useState(0);
  const [copiedShareNotice, setCopiedShareNotice] = useState(false);

  // دالة مساعدة للحصول على مسمى الصف
  const getGradeLabel = (gId: GradeLevel): string => {
    for (const st of Object.values(STAGES_CONFIG)) {
      const found = st.grades.find((g) => g.id === gId);
      if (found) return found.labelAr;
    }
    return gId;
  };

  // 1. حساب مصفوفة رادار مهارات الطالب (4 ركائز لغوية)
  const skillsRadar = useMemo<ArabicSkillRadarPillar[]>(() => {
    // تعريف الكلمات الدلالية لكل ركيزة
    const matchesPhonics = (s: StudentSubmission) => {
      const t = (s.activityTitle + ' ' + (s.targetSkill || '') + ' ' + (s.gameType || '')).toLowerCase();
      return t.includes('صوت') || t.includes('حرك') || t.includes('مد') || t.includes('تنوين') || 
             t.includes('مقطع') || t.includes('هجاء') || t.includes('phonics') || t.includes('vowel');
    };

    const matchesSpelling = (s: StudentSubmission) => {
      const t = (s.activityTitle + ' ' + (s.targetSkill || '') + ' ' + (s.gameType || '')).toLowerCase();
      return t.includes('إملاء') || t.includes('املاء') || t.includes('همز') || t.includes('تاء') || 
             t.includes('ألف') || t.includes('شمس') || t.includes('قمر') || t.includes('رسم') || 
             t.includes('spelling') || t.includes('category');
    };

    const matchesGrammar = (s: StudentSubmission) => {
      const t = (s.activityTitle + ' ' + (s.targetSkill || '') + ' ' + (s.gameType || '')).toLowerCase();
      return t.includes('قواعد') || t.includes('نحو') || t.includes('جمل') || t.includes('فعل') || 
             t.includes('اسم') || t.includes('حرف') || t.includes('ضمير') || t.includes('مبتدأ') || 
             t.includes('sentence');
    };

    const matchesReading = (s: StudentSubmission) => {
      const t = (s.activityTitle + ' ' + (s.targetSkill || '') + ' ' + (s.gameType || '')).toLowerCase();
      return t.includes('قراءة') || t.includes('فهم') || t.includes('نص') || t.includes('قصة') || 
             t.includes('استيعاب') || t.includes('معان') || t.includes('مفرد') || t.includes('story');
    };

    const calcCategory = (matcher: (s: StudentSubmission) => boolean, baselineOffset: number = 0) => {
      const relevant = studentSubs.filter(matcher);
      if (relevant.length > 0) {
        const earned = relevant.reduce((sum, item) => sum + item.score, 0);
        const possible = relevant.reduce((sum, item) => sum + item.totalPoints, 0);
        const perc = possible > 0 ? Math.round((earned / possible) * 100) : 0;
        return { percentage: Math.min(100, Math.max(0, perc)), count: relevant.length };
      }
      // في حال عدم توفر أنشطة محددة بعد لهذه الركيزة، نستخدم معيار التحصيل العام للطالب مع موازنة دقيقة
      const fallbackPerc = avgPercentage > 0 ? Math.min(100, Math.max(45, avgPercentage + baselineOffset)) : 80;
      return { percentage: fallbackPerc, count: 0 };
    };

    const phonicsData = calcCategory(matchesPhonics, +5);
    const spellingData = calcCategory(matchesSpelling, -3);
    const grammarData = calcCategory(matchesGrammar, -6);
    const readingData = calcCategory(matchesReading, +2);

    const getStatus = (perc: number) => {
      if (perc >= 90) return { label: 'متقن بامتياز 🌟', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      if (perc >= 75) return { label: 'متمكن ومتقدم 👍', color: 'text-sky-700 bg-sky-50 border-sky-200' };
      if (perc >= 60) return { label: 'مستوى جيد 📈', color: 'text-amber-700 bg-amber-50 border-amber-200' };
      return { label: 'يحتاج تدريباً 🎯', color: 'text-rose-700 bg-rose-50 border-rose-200' };
    };

    const pStatus = getStatus(phonicsData.percentage);
    const sStatus = getStatus(spellingData.percentage);
    const gStatus = getStatus(grammarData.percentage);
    const rStatus = getStatus(readingData.percentage);

    return [
      {
        id: 'phonics',
        title: 'الوعي الصوتي والفونيمات',
        subtitle: 'الأصوات، الحركات القصيرة، المدود الطويلة، التنوين والمقاطع',
        icon: Volume2,
        colorGradient: 'from-sky-500 to-blue-600',
        barColor: 'bg-sky-500',
        badgeBg: 'bg-sky-50',
        badgeText: 'text-sky-700',
        borderColor: 'border-sky-200',
        percentage: phonicsData.percentage,
        completedActivitiesCount: phonicsData.count,
        statusLabel: pStatus.label,
        statusColor: pStatus.color,
      },
      {
        id: 'spelling',
        title: 'الإملاء والظواهر الكتابية',
        subtitle: 'اللام الشمسية والقمرية، التاء المربوطة والمفتوحة، ورسم الهمزات',
        icon: PenTool,
        colorGradient: 'from-amber-500 to-orange-500',
        barColor: 'bg-amber-500',
        badgeBg: 'bg-amber-50',
        badgeText: 'text-amber-700',
        borderColor: 'border-amber-200',
        percentage: spellingData.percentage,
        completedActivitiesCount: spellingData.count,
        statusLabel: sStatus.label,
        statusColor: sStatus.color,
      },
      {
        id: 'grammar',
        title: 'القواعد والتراكيب اللغوية',
        subtitle: 'أقسام الكلمة، الجمل المفيدة، المفرد والمثنى، وحروف الجر',
        icon: Layers,
        colorGradient: 'from-indigo-500 to-violet-600',
        barColor: 'bg-indigo-500',
        badgeBg: 'bg-indigo-50',
        badgeText: 'text-indigo-700',
        borderColor: 'border-indigo-200',
        percentage: grammarData.percentage,
        completedActivitiesCount: grammarData.count,
        statusLabel: gStatus.label,
        statusColor: gStatus.color,
      },
      {
        id: 'reading',
        title: 'الفهم القرائي والاستيعاب',
        subtitle: 'استيعاب المقروء، معاني المفردات والسياق، واستنتاج الأفكار',
        icon: BookOpen,
        colorGradient: 'from-emerald-500 to-teal-600',
        barColor: 'bg-emerald-500',
        badgeBg: 'bg-emerald-50',
        badgeText: 'text-emerald-700',
        borderColor: 'border-emerald-200',
        percentage: readingData.percentage,
        completedActivitiesCount: readingData.count,
        statusLabel: rStatus.label,
        statusColor: rStatus.color,
      },
    ];
  }, [studentSubs, avgPercentage]);

  // تحديد المهارة الأقوى والمهارة التي تحتاج لتعزيز
  const { topSkill, needsFocusSkill } = useMemo(() => {
    const sorted = [...skillsRadar].sort((a, b) => b.percentage - a.percentage);
    return {
      topSkill: sorted[0],
      needsFocusSkill: sorted[sorted.length - 1],
    };
  }, [skillsRadar]);

  // تجهيز نص مشاركة الإنجاز عبر واتساب
  const generateWhatsAppMessage = (): string => {
    const performanceEvaluation = avgPercentage >= 85 
      ? 'ممتاز ومتميز 🌟' 
      : avgPercentage >= 70 
      ? 'جيد جداً ومتقدم 👍' 
      : 'في مسار التقدم المستمر 🎯';

    const text = `🌟 *تقرير إنجاز وفخر من منصة «تعلَّم مع موسى»* 🌟
    
نبارك لبطلنا/بطلتنا: *${student.name}* 🎓
📚 المرحلة: *${getGradeLabel(student.grade!)}*

📊 *معدل التحصيل العام:* ${avgPercentage}%
🏆 *الأنشطة المنجزة:* ${studentSubs.length} نشاطاً
⭐ *مجموع النقاط المحققة:* ${totalEarned} نقطة
🎯 *التقييم العام:* ${performanceEvaluation}

✨ *أبرز مجالات التميز اللغوي:*
• ${topSkill.title}: ${topSkill.percentage}% (${topSkill.statusLabel})

دمت فخراً لنا وإلى مزيد من التميز والنجاح والإبداع! 🚀💚
_منصة تعلَّم مع موسى للغة العربية الذكية_`;

    return text;
  };

  // فتح رابط واتساب مباشر
  const handleShareWhatsApp = () => {
    const message = generateWhatsAppMessage();
    const encoded = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encoded}`;
    
    // محاولة نسخ النص أيضاً احتياطياً لراحة ولي الأمر
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(message).catch(() => {});
    }
    
    setCopiedShareNotice(true);
    setTimeout(() => setCopiedShareNotice(false), 4000);

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  // نصيحة التوجيه المنزلي الحالية
  const currentTip = HOME_GUIDANCE_BANK[selectedTipIndex % HOME_GUIDANCE_BANK.length];

  // تشغيل نطق نصيحة موسى بالصوت
  const handleToggleSpeakTip = () => {
    if (isSpeakingMousa) {
      stopMousaVoice();
      setIsSpeakingMousa(false);
    } else {
      setIsSpeakingMousa(true);
      const textToSpeak = `مرحباً يا ولي أمر صديقي البطل ${student.name}! أنصحك اليوم بتطبيق: ${currentTip.activityName}. ${currentTip.executionSteps}. وتذكر دائماً: ${currentTip.encouragementTip}`;
      speakMousa(textToSpeak, () => {
        setIsSpeakingMousa(false);
      });
    }
  };

  // الانتقال للنصيحة التالية
  const handleNextTip = () => {
    stopMousaVoice();
    setIsSpeakingMousa(false);
    setSelectedTipIndex(prev => (prev + 1) % HOME_GUIDANCE_BANK.length);
  };

  return (
    <div className="space-y-6">
      {/* تنبيه صلاحية الذكاء الاصطناعي لولي الأمر إن وجدت */}
      {!isParentAIPermitted && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <span className="font-bold block">تقارير الذكاء الاصطناعي التشخيصية لولي الأمر معطلة</span>
            <span className="text-[11px] text-rose-600">{parentAIReason}</span>
          </div>
        </div>
      )}

      {/* بطاقة متابعة الطالب الرئيسية والأزرار الإجرائية */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
          <div>
            <span className="text-xs text-emerald-600 font-bold block mb-1">بطاقة متابعة الطالب</span>
            <h2 className="text-xl font-black text-slate-800">{student.name}</h2>
            <span className="text-xs text-slate-500 font-medium">
              {getGradeLabel(student.grade!)} • {student.track === 'arabic-a' ? 'مسار الناطقين بها' : 'مسار الناطقين بغيرها'}
            </span>
          </div>

          {/* شريط الإجراءات: التقرير الفوري + زر واتساب + التقرير الذكي + ورقة العمل + معدل التحصيل */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. زر التقرير الفوري */}
            <button
              type="button"
              id="parent-quick-diagnostic-btn"
              onClick={() => {
                if (!isParentAIPermitted) {
                  alert(`عذراً، التقارير الذكية معطلة بأمر الإدارة العليا:\n${parentAIReason}`);
                  return;
                }
                onOpenQuickDiagnostic();
              }}
              disabled={!isParentAIPermitted}
              className="px-3 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed cursor-pointer"
              title={!isParentAIPermitted ? parentAIReason : "توليد التقرير الذكي الفوري للطالب بنقرة واحدة"}
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>التقرير الفوري ⚡</span>
            </button>

            {/* 2. زر مشاركة الإنجاز عبر واتساب (WhatsApp Share Button) المطلوب */}
            <button
              type="button"
              id="parent-whatsapp-share-btn"
              onClick={handleShareWhatsApp}
              className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs border border-emerald-600/30 cursor-pointer"
              title="مشاركة بطاقة إنجاز وفخر مع الأسرة والأصدقاء عبر تطبيق واتساب 📲"
            >
              <Share2 className="w-4 h-4 text-white" />
              <span>مشاركة الإنجاز عبر واتساب 📲</span>
            </button>

            {/* 3. التقرير التشخيصي الذكي */}
            <button
              type="button"
              id="parent-smart-diagnostic-btn"
              onClick={() => {
                if (!isParentAIPermitted) {
                  alert(`عذراً، التقرير التشخيصي الذكي معطل بأمر الإدارة العليا:\n${parentAIReason}`);
                  return;
                }
                onOpenDiagnosticModal();
              }}
              disabled={!isParentAIPermitted}
              className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed cursor-pointer"
              title={!isParentAIPermitted ? parentAIReason : "استخراج تقرير تشخيصي ذكي بالذكاء الاصطناعي"}
            >
              <Brain className="w-4 h-4" /> 
              <span>التقرير التشخيصي الذكي</span>
            </button>

            {/* 4. ورقة عمل علاجية */}
            <button
              type="button"
              id="parent-worksheet-btn"
              onClick={() => {
                if (!isParentAIPermitted) {
                  alert(`عذراً، توليد ورقة العمل العلاجية معطل بأمر الإدارة العليا:\n${parentAIReason}`);
                  return;
                }
                onOpenPrintableWorksheet();
              }}
              disabled={!isParentAIPermitted}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed cursor-pointer"
              title={!isParentAIPermitted ? parentAIReason : "توليد وطباعة أوراق عمل علاجية"}
            >
              <Printer className="w-4 h-4" /> 
              <span>ورقة عمل علاجية</span>
            </button>

            {/* شارة معدل التحصيل */}
            <div className="flex items-center gap-3 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
              <Award className="w-7 h-7 text-emerald-600" />
              <div>
                <span className="text-[10px] text-emerald-800 font-bold block">معدل التحصيل</span>
                <span className="text-base font-black text-emerald-700">{avgPercentage}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* إشعار تأكيد فتح الواتساب ونسخ النص */}
        {copiedShareNotice && (
          <div className="mb-5 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>تم تجهيز رسالة التهنئة وفتح واتساب! كما تم نسخ نص التقرير إلى الحافظة.</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-bold">جاهز للإرسال 📲</span>
          </div>
        )}

        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-400 block mb-1">الأنشطة المكتملة</span>
            <span className="text-base font-extrabold text-slate-800">{studentSubs.length} نشاطاً</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-400 block mb-1">مجموع الدرجات</span>
            <span className="text-base font-extrabold text-emerald-600">{totalEarned} نقطة</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-slate-400 block mb-1">تقييم الأداء العام</span>
            <span className="text-xs font-bold text-slate-700">
              {avgPercentage >= 85 ? 'ممتاز ومتميز 🌟' : avgPercentage >= 70 ? 'جيد جداً ومتقدم 👍' : 'يحتاج متابعة وتدريب 🎯'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. بطاقة "رادار مهارات الطالب" (Skill Mastery Summary) المطلوبة */}
      <div id="student-skill-mastery-radar" className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                <span>رادار مهارات الطالب اللغوية</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  تحليل ذكي 🎯
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                نسب الإتقان التراكمية في محاور لغتنا العربية الأربعة المستخرجة من أداء وأنشطة الطالب
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[11px] text-slate-500 font-medium">أعلى مهارة:</span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" />
              {topSkill.title} ({topSkill.percentage}%)
            </span>
          </div>
        </div>

        {/* أشرطة التقدم الملونة لركائز اللغة العربية الأربعة */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {skillsRadar.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div 
                key={pillar.id}
                className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 transition"
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${pillar.colorGradient} text-white flex items-center justify-center shadow-2xs shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-800 leading-tight">{pillar.title}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{pillar.subtitle}</p>
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <span className="text-sm font-black text-slate-800">{pillar.percentage}%</span>
                    <span className={`block text-[9px] font-bold px-1.5 py-0.5 rounded-md border mt-0.5 ${pillar.statusColor}`}>
                      {pillar.statusLabel}
                    </span>
                  </div>
                </div>

                {/* شريط التقدم الفعلي الملون */}
                <div className="w-full bg-slate-200/70 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r ${pillar.colorGradient}`}
                    style={{ width: `${Math.max(5, pillar.percentage)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                  <span>
                    {pillar.completedActivitiesCount > 0 
                      ? `${pillar.completedActivitiesCount} نشاط تم تقييمه` 
                      : 'تقييم تأسيسي معتمد'}
                  </span>
                  <span className="font-medium text-slate-400">
                    {pillar.percentage >= 85 ? 'إتقان متفوق 🌟' : pillar.percentage >= 70 ? 'مستوى تقدم طيب 👍' : 'يحتاج تكراراً وممارسة 🎯'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* كبسولة استنتاج سريعة في أسفل الرادار */}
        <div className="mt-4 p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-indigo-900">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <b>توصية الرادار للأسرة:</b> يظهر {student.name} تميزاً لافتاً في <b>{topSkill.title}</b>، بينما يمكن تحقيق قفزة سريعة بالتركيز المنزلي البسيط على <b>{needsFocusSkill.title}</b>.
            </span>
          </div>
          <span className="text-[10px] text-indigo-600 bg-white/80 px-2 py-1 rounded-lg border border-indigo-200 font-bold shrink-0 text-center">
            تحديث مباشر ⚡
          </span>
        </div>
      </div>

      {/* 3. كبسولة توجيه منزلي ذكية من الرفيق موسى (Mousa Home Guidance) المطلوبة */}
      <div id="mousa-home-guidance-capsule" className="bg-gradient-to-br from-amber-50/80 via-white to-emerald-50/60 rounded-3xl p-6 border border-amber-200/90 shadow-xs relative overflow-hidden">
        {/* خلفية زخرفية ناعمة */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-amber-200/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-emerald-200/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-100 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src="/mousa-avatar.png"
                  alt="الرفيق موسى"
                  className={`w-12 h-12 rounded-2xl object-cover border-2 border-amber-300 shadow-sm bg-amber-100 ${
                    isSpeakingMousa ? 'ring-4 ring-amber-400 ring-offset-2 animate-bounce' : ''
                  }`}
                  onError={(e) => {
                    // Fallback في حال تعذر تحميل الصورة
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                {isSpeakingMousa && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base text-slate-800">
                    كبسولة التوجيه المنزلي من الرفيق موسى 💡
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {currentTip.estimatedMinutes}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  إرشادات تربوية ذكية وسريعة لتعزيز المهارات التي تدرب عليها {student.name} في المنزل بمرح
                </p>
              </div>
            </div>

            {/* أدوات التحكم في الكبسولة: الاستماع الصوتي + تبديل الفكرة */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="listen-mousa-advice-btn"
                onClick={handleToggleSpeakTip}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs border cursor-pointer ${
                  isSpeakingMousa
                    ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-600 animate-pulse'
                    : 'bg-white hover:bg-amber-50 text-amber-900 border-amber-200'
                }`}
                title={isSpeakingMousa ? 'إيقاف نطق موسى' : 'استمع لصوت الرفيق موسى يلقي النصيحة 🔊'}
              >
                {isSpeakingMousa ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>إيقاف الصوت ⏹️</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                    <span>استمع لموسى 🔊</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="next-mousa-advice-btn"
                onClick={handleNextTip}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs border border-slate-200 cursor-pointer"
                title="توليد فكرة منزلية أخرى من بنك أفكار موسى"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>فكرة أخرى 🔄</span>
              </button>
            </div>
          </div>

          {/* محتوى النصيحة والنشاط المنزلي المقترح */}
          <div className="bg-white/90 backdrop-blur-xs rounded-2xl p-4 border border-amber-100 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{currentTip.iconEmoji}</span>
                <span className="font-extrabold text-sm text-slate-800">
                  {currentTip.activityName}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                المهارة: {currentTip.targetSkill}
              </span>
            </div>

            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100/80 text-xs text-slate-700 leading-relaxed">
              <span className="font-bold text-amber-900 block mb-1">طريقة التنفيذ مع طفلك في دقائق:</span>
              <p>{currentTip.executionSteps}</p>
            </div>

            <div className="flex items-start gap-2 pt-1 text-xs text-emerald-800">
              <span className="font-bold shrink-0">💡 عبارة تشجيع موصى بها:</span>
              <span className="italic text-slate-600">«{currentTip.encouragementTip}»</span>
            </div>
          </div>
        </div>
      </div>

      {/* سجل إجابات ودرجات الأنشطة المكتملة */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-sm text-slate-800">سجل إجابات ودرجات الأنشطة المكتملة</h3>
          <span className="text-xs text-slate-400 font-medium">
            إجمالي الأنشطة: {studentSubs.length}
          </span>
        </div>

        {studentSubs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-slate-400">لم يكمل الطالب أي نشاط حتى الآن.</p>
            <p className="text-[11px] text-slate-400 mt-1">عندما ينجز الطالب تمارينه وألعابه في المنصة، ستظهر درجاته وتفاصيل إتقانه هنا فورياً.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {studentSubs.map((sub) => {
              const perc = Math.round((sub.score / sub.totalPoints) * 100) || 0;
              return (
                <div key={sub.id} className="py-3.5 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-slate-800 mb-0.5">{sub.activityTitle}</h4>
                    <span className="text-[10px] text-slate-400">تاريخ الإنجاز: {sub.submittedAt}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-xs text-slate-700">
                      {sub.score} / {sub.totalPoints}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${
                      perc >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {perc}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
