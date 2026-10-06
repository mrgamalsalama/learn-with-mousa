import * as XLSX from 'xlsx';
import { UserProfile, StudentSubmission, ExamSession } from '../types';
import { getGradeLabel } from './gradebookExport';

export interface PerformancePoint {
  id: string;
  title: string;
  date: string;
  score: number;
  maxPoints: number;
  percentage: number;
  type: 'activity' | 'exam' | 'challenge' | 'reading';
  skillDomain: string;
}

export type SkillDomainKey = 'reading' | 'phonics' | 'spelling_grammar' | 'vocab_sentences' | 'exams_challenges';

export interface SkillDomainAnalytics {
  key: SkillDomainKey;
  name: string;
  icon: string;
  score: number;
  maxPoints: number;
  percentage: number;
  itemsCount: number;
  status: 'mastered' | 'progressing' | 'gap';
  statusLabel: string;
  gapSeverity: 'none' | 'moderate' | 'critical';
  diagnosedIssues: string[];
  suggestedRemediation: string[];
}

export interface GapDiagnosis {
  hasGap: boolean;
  overallLevel: 'advanced' | 'proficient' | 'needs_support' | 'critical_intervention';
  levelLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  primaryGapSummary: string;
  trend: 'improving' | 'stable' | 'declining' | 'volatile' | 'no_data';
  trendLabel: string;
  trendDescription: string;
  velocityPercentage: number;
  criticalGapsList: string[];
  strengthsList: string[];
  remedialPlan: {
    targetDomain: string;
    gapDescription: string;
    recommendedActions: string[];
    teacherRole: string;
    hodRole: string;
    parentRole: string;
  }[];
}

export interface StudentDetailedFactualReport {
  student: UserProfile;
  schoolName: string;
  reportDate: string;
  totalTasksCompleted: number;
  totalEarnedScore: number;
  totalPossibleScore: number;
  overallPercentage: number;
  timeline: PerformancePoint[];
  skills: Record<SkillDomainKey, SkillDomainAnalytics>;
  skillsList: SkillDomainAnalytics[];
  diagnosis: GapDiagnosis;
  examsCount: number;
  examsAvgPercentage: number;
  activitiesCount: number;
  activitiesAvgPercentage: number;
}

// دالة تصنيف النشاط ضمن المهارات الأساسية للغة العربية
export const categorizeTaskSkill = (title: string, skill: string = '', gameType: string = ''): SkillDomainKey => {
  const combined = `${title} ${skill} ${gameType}`.toLowerCase();

  // 1. الفهم القرائي والمكتبة
  if (
    gameType === 'story_quest' ||
    combined.includes('قراءة') ||
    combined.includes('فهم') ||
    combined.includes('قصة') ||
    combined.includes('نص') ||
    combined.includes('استيعاب') ||
    combined.includes('مكتبة') ||
    combined.includes('بوك تايم')
  ) {
    return 'reading';
  }

  // 2. الصوتيات والوعي الفونيمي
  if (
    gameType === 'phonics_treasure' ||
    gameType === 'vowel_train' ||
    gameType === 'letter_blending' ||
    combined.includes('صوت') ||
    combined.includes('حرك') ||
    combined.includes('مد') ||
    combined.includes('مقطع') ||
    combined.includes('حرف') ||
    combined.includes('فونيك')
  ) {
    return 'phonics';
  }

  // 3. الظواهر الإملائية والنحوية
  if (
    combined.includes('إملاء') ||
    combined.includes('املاء') ||
    combined.includes('تنوين') ||
    combined.includes('شمس') ||
    combined.includes('قمر') ||
    combined.includes('مربوطة') ||
    combined.includes('مفتوحة') ||
    combined.includes('همز') ||
    combined.includes('نحو') ||
    combined.includes('فاعل') ||
    combined.includes('مبتدأ')
  ) {
    return 'spelling_grammar';
  }

  // 4. المفردات وبناء الجمل
  if (
    gameType === 'vocab_detective' ||
    gameType === 'sentence_builder' ||
    gameType === 'category_sorter' ||
    combined.includes('جمل') ||
    combined.includes('ترادف') ||
    combined.includes('تضاد') ||
    combined.includes('مفرد') ||
    combined.includes('تركيب') ||
    combined.includes('سياق')
  ) {
    return 'vocab_sentences';
  }

  // 5. الاختبارات والتحديات
  return 'exams_challenges';
};

// الدالة المركزية لتوليد التقرير الفعلي الدقيق غير المعتمد على الذكاء الاصطناعي
export const generateStudentFactualReport = (
  student: UserProfile,
  allSubmissions: StudentSubmission[],
  allExamSessions: ExamSession[] = [],
  schoolName: string = 'منصة تعلّم مع موسى'
): StudentDetailedFactualReport => {
  // تصفية إجابات هذا الطالب تحديداً
  const studentSubs = allSubmissions.filter(
    (s) => s.studentId === student.id || s.studentName === student.name
  );

  // تصفية جلسات اختبارات هذا الطالب
  const studentExams = allExamSessions.filter(
    (e) => (e.student_id === student.id || e.student_name === student.name) && e.status === 'submitted'
  );

  // دمج كافة الأنشطة والاختبارات في خط زمني موحد
  const timeline: PerformancePoint[] = [];

  studentSubs.forEach((sub) => {
    const max = Number(sub.totalPoints) || (sub.score ? Math.max(sub.score, 10) : 10);
    const score = Number(sub.score) || 0;
    const pct = max > 0 ? Math.min(100, Math.round((score / max) * 100)) : 0;
    const domain = categorizeTaskSkill(sub.activityTitle || '', sub.targetSkill || '', sub.gameType || '');

    timeline.push({
      id: sub.id,
      title: sub.activityTitle || 'نشاط تفاعلي',
      date: sub.submittedAt || new Date().toISOString(),
      score,
      maxPoints: max,
      percentage: pct,
      type: (sub.gameType === 'challenge' || (sub.activityTitle || '').includes('تحدي')) ? 'challenge' : 'activity',
      skillDomain: domain,
    });
  });

  studentExams.forEach((ex) => {
    const max = Number(ex.total_marks) || 100;
    const score = Number(ex.score) || 0;
    const pct = max > 0 ? Math.min(100, Math.round((score / max) * 100)) : 0;

    timeline.push({
      id: ex.id,
      title: `اختبار أكاديمي رسمي (#${ex.exam_id.slice(0, 6)})`,
      date: ex.end_time || ex.start_time || ex.created_at || new Date().toISOString(),
      score,
      maxPoints: max,
      percentage: pct,
      type: 'exam',
      skillDomain: 'exams_challenges',
    });
  });

  // فرز الخط الزمني من الأقدم إلى الأحدث لمراقبة منحنى التطور
  timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // حساب الإجماليات العامة
  const totalTasksCompleted = timeline.length;
  const totalEarnedScore = timeline.reduce((sum, item) => sum + item.score, 0);
  const totalPossibleScore = timeline.reduce((sum, item) => sum + item.maxPoints, 0);
  const overallPercentage = totalPossibleScore > 0 ? Math.round((totalEarnedScore / totalPossibleScore) * 100) : 0;

  // إحصائيات الاختبارات فقط
  const examPoints = timeline.filter((t) => t.type === 'exam');
  const examsCount = examPoints.length;
  const examsAvgPercentage = examsCount > 0
    ? Math.round(examPoints.reduce((s, p) => s + p.percentage, 0) / examsCount)
    : 0;

  // إحصائيات الأنشطة فقط
  const actPoints = timeline.filter((t) => t.type !== 'exam');
  const activitiesCount = actPoints.length;
  const activitiesAvgPercentage = activitiesCount > 0
    ? Math.round(actPoints.reduce((s, p) => s + p.percentage, 0) / activitiesCount)
    : 0;

  // حساب أداء المهارات الأساسية الخمس
  const skillsConfig: Record<SkillDomainKey, { name: string; icon: string }> = {
    reading: { name: 'الفهم القرائي والاستيعاب', icon: '📖' },
    phonics: { name: 'الوعي الصوتي والحركات', icon: '🔊' },
    spelling_grammar: { name: 'الظواهر الإملائية والنحوية', icon: '✍️' },
    vocab_sentences: { name: 'المفردات وبناء الجمل', icon: '🧩' },
    exams_challenges: { name: 'الاختبارات والتحديات التنافسية', icon: '🏆' },
  };

  const domainScores: Record<SkillDomainKey, { score: number; max: number; count: number; percentages: number[] }> = {
    reading: { score: 0, max: 0, count: 0, percentages: [] },
    phonics: { score: 0, max: 0, count: 0, percentages: [] },
    spelling_grammar: { score: 0, max: 0, count: 0, percentages: [] },
    vocab_sentences: { score: 0, max: 0, count: 0, percentages: [] },
    exams_challenges: { score: 0, max: 0, count: 0, percentages: [] },
  };

  timeline.forEach((pt) => {
    const k = pt.skillDomain as SkillDomainKey;
    if (domainScores[k]) {
      domainScores[k].score += pt.score;
      domainScores[k].max += pt.maxPoints;
      domainScores[k].count += 1;
      domainScores[k].percentages.push(pt.percentage);
    }
  });

  const skills: Record<SkillDomainKey, SkillDomainAnalytics> = {} as any;

  (Object.keys(skillsConfig) as SkillDomainKey[]).forEach((key) => {
    const stat = domainScores[key];
    const pct = stat.max > 0 ? Math.round((stat.score / stat.max) * 100) : (stat.count > 0 ? 80 : 0);
    
    let status: 'mastered' | 'progressing' | 'gap' = 'progressing';
    let statusLabel = 'في مسار التقدم الطبيعي ✅';
    let gapSeverity: 'none' | 'moderate' | 'critical' = 'none';
    const diagnosedIssues: string[] = [];
    const suggestedRemediation: string[] = [];

    if (stat.count === 0) {
      status = 'progressing';
      statusLabel = 'لم يبدأ مهام هذا المجال بعد ⏳';
      gapSeverity = 'none';
      diagnosedIssues.push('لا توجد تسليمات كافية في هذا المجال حتى الآن لقياس التحصيل بدقة.');
      suggestedRemediation.push('إسناد أنشطة تدريبية استكشافية للطالب في هذا المجال.');
    } else if (pct >= 85) {
      status = 'mastered';
      statusLabel = 'إتقان تام ومستوى متفوق 🌟';
      gapSeverity = 'none';
      diagnosedIssues.push('يظهر الطالب استيعاباً كاملاً وطلاقة في تطبيق مهارات هذا المجال.');
      suggestedRemediation.push('توفير مهام إثرائية وتحديات متقدمة للحفاظ على شغف التميز.');
    } else if (pct >= 70) {
      status = 'progressing';
      statusLabel = 'مستوى جيد مع حاجة لتثبيت المهارة 👍';
      gapSeverity = 'none';
      diagnosedIssues.push('الطالب يحقق الحد الأدنى المقبول ولكن تظهر بعض الأخطاء العابرة.');
      suggestedRemediation.push('مراجعة الأخطاء المحددة وتكثيف التطبيقات العملية في الحصة.');
    } else if (pct >= 55) {
      status = 'gap';
      statusLabel = 'فجوة تعليمية متوسطة تتطلب تدريباً ⚠️';
      gapSeverity = 'moderate';
      diagnosedIssues.push(`تدني نسبة النجاح إلى ${pct}% في مهام ${skillsConfig[key].name}.`);
      diagnosedIssues.push('تكرار الإجابات غير المتقنة عند زيادة تعقيد الأسئلة.');
      suggestedRemediation.push('خطة تدريب علاجي قصيرة تركز على النماذج التوضيحية البسيطة أولاً.');
      suggestedRemediation.push('استخدام الألعاب التعليمية التفاعلية المرتبطة بالمجال لتثبيت المفهوم.');
    } else {
      status = 'gap';
      statusLabel = 'فجوة تعليمية حرجة تتطلب تدخلاً عاجلاً 🚨';
      gapSeverity = 'critical';
      diagnosedIssues.push(`هبوط حاد في التحصيل بمعدل ${pct}% يشير إلى صعوبة تأسيسية قائمة.`);
      diagnosedIssues.push('عدم تمكن الطالب من المعارف الأساسية في هذا المجال.');
      suggestedRemediation.push('جلسة دعم وتدخل فردي مباشر مع معلم المادة لتفكيك الصعوبة.');
      suggestedRemediation.push('طباعة أوراق العمل التأسيسية وإشراك ولي الأمر في التدريب الصوتي والقرائي.');
    }

    skills[key] = {
      key,
      name: skillsConfig[key].name,
      icon: skillsConfig[key].icon,
      score: stat.score,
      maxPoints: stat.max,
      percentage: pct,
      itemsCount: stat.count,
      status,
      statusLabel,
      gapSeverity,
      diagnosedIssues,
      suggestedRemediation,
    };
  });

  const skillsList = Object.values(skills);

  // تحليل مسار التقدم الزمني (Trend Analysis)
  let trend: 'improving' | 'stable' | 'declining' | 'volatile' | 'no_data' = 'no_data';
  let trendLabel = 'بيانات غير كافية';
  let trendDescription = 'يحتاج الطالب لإنجاز 3 أنشطة على الأقل لحساب مسار التطور الزمني.';
  let velocityPercentage = 0;

  if (timeline.length >= 3) {
    const half = Math.floor(timeline.length / 2);
    const firstHalf = timeline.slice(0, half);
    const secondHalf = timeline.slice(half);

    const firstAvg = firstHalf.reduce((s, p) => s + p.percentage, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, p) => s + p.percentage, 0) / secondHalf.length;
    velocityPercentage = Math.round(secondAvg - firstAvg);

    // حساب التذبذب (Variance)
    const recentScores = timeline.slice(-5).map((t) => t.percentage);
    const maxDiff = Math.max(...recentScores) - Math.min(...recentScores);

    if (velocityPercentage >= 10) {
      trend = 'improving';
      trendLabel = 'مسار تصاعدي متميز 📈';
      trendDescription = `يُظهر الطالب نمواً ملحوظاً في درجاته الأخيرة بزيادة بلغت (+${velocityPercentage}%) مقارنة ببداية الأنشطة.`;
    } else if (velocityPercentage <= -10) {
      trend = 'declining';
      trendLabel = 'مسار هابط يثير الانتباه 📉';
      trendDescription = `تراجع أداء الطالب في التسليمات الحديثة بمعدل (${velocityPercentage}%)، مما يشير إلى فجوة تراكمية حديثة تحتاج متابعة.`;
    } else if (maxDiff > 35) {
      trend = 'volatile';
      trendLabel = 'أداء متذبذب 📊';
      trendDescription = 'تتفاوت درجات الطالب تفاوتاً كبيراً بين نشاط وآخر؛ مما يشير إلى تأثره بطبيعة المهارة أو مستوى التركيز.';
    } else {
      trend = 'stable';
      trendLabel = 'أداء مستقر ومتوازن ⚖️';
      trendDescription = `يحافظ الطالب على مستوى تحصيل متقارب في كافة المهام بمتوسط (${Math.round(secondAvg)}%).`;
    }
  }

  // تشخيص الفجوة التعليمية الشامل (Educational Gap Diagnosis)
  const criticalSkills = skillsList.filter((s) => s.gapSeverity === 'critical');
  const moderateSkills = skillsList.filter((s) => s.gapSeverity === 'moderate');
  const masteredSkills = skillsList.filter((s) => s.status === 'mastered');

  const hasGap = criticalSkills.length > 0 || moderateSkills.length > 0 || overallPercentage < 70;

  let overallLevel: 'advanced' | 'proficient' | 'needs_support' | 'critical_intervention' = 'proficient';
  let levelLabel = 'مستوى جيد ومستقر ✅';
  let badgeBg = 'bg-emerald-50';
  let badgeText = 'text-emerald-800';
  let badgeBorder = 'border-emerald-200';
  let primaryGapSummary = 'الطالب في مسار التعلم الطبيعي ويحقق الكفايات المطلوبة للصف.';

  if (totalTasksCompleted === 0) {
    overallLevel = 'needs_support';
    levelLabel = 'في انتظار بدء الأنشطة ⏳';
    badgeBg = 'bg-slate-100';
    badgeText = 'text-slate-700';
    badgeBorder = 'border-slate-300';
    primaryGapSummary = 'لم يسجل الطالب أي حلول حتى الآن لإجراء التحليل الفعلي.';
  } else if (criticalSkills.length >= 2 || overallPercentage < 55) {
    overallLevel = 'critical_intervention';
    levelLabel = 'فجوة تعليمية حرجة تتطلب تدخلاً عاجلاً 🚨';
    badgeBg = 'bg-rose-50';
    badgeText = 'text-rose-800';
    badgeBorder = 'border-rose-300';
    primaryGapSummary = `يعاني الطالب من فجوة تعليمية عميقة في (${criticalSkills.map((s) => s.name).join(' و ')}). معدل الإتقان العام أقل من الحد الأدنى المقبول (${overallPercentage}%).`;
  } else if (criticalSkills.length === 1 || moderateSkills.length >= 1 || overallPercentage < 72) {
    overallLevel = 'needs_support';
    levelLabel = 'يعاني من فجوة مهارية محددة ⚠️';
    badgeBg = 'bg-amber-50';
    badgeText = 'text-amber-800';
    badgeBorder = 'border-amber-300';
    const gapNames = [...criticalSkills, ...moderateSkills].map((s) => s.name).join(' و ');
    primaryGapSummary = `أداؤه العام مقبول لكن تظهر فجوة مهارية دقيقة تتركز في (${gapNames || 'بعض التطبيقات الكتابية'}).`;
  } else if (overallPercentage >= 88 && criticalSkills.length === 0 && moderateSkills.length === 0) {
    overallLevel = 'advanced';
    levelLabel = 'إتقان متفوق وتميز أكاديمي 🌟';
    badgeBg = 'bg-purple-50';
    badgeText = 'text-purple-800';
    badgeBorder = 'border-purple-300';
    primaryGapSummary = `أداء استثنائي متفوق في كافة المهارات بنسبة إتقان (${overallPercentage}%). لا توجد أي فجوات تعليمية مسجلة.`;
  }

  // تجميع نقاط القوة والفجوات
  const criticalGapsList: string[] = [];
  const strengthsList: string[] = [];

  skillsList.forEach((s) => {
    if (s.status === 'gap') {
      criticalGapsList.push(`فجوة في ${s.name}: التحصيل الفعلي ${s.percentage}% (${s.score}/${s.maxPoints} نقطة)`);
    } else if (s.status === 'mastered') {
      strengthsList.push(`إتقان فائق في ${s.name}: التحصيل الفعلي ${s.percentage}%`);
    }
  });

  if (timeline.length >= 3 && trend === 'improving') {
    strengthsList.push(`دافعية عالية واستجابة إيجابية للتدريب (منحنى التطور +${velocityPercentage}%)`);
  } else if (timeline.length >= 3 && trend === 'declining') {
    criticalGapsList.push(`تراجع تدريجي في نتائج الاختبارات والأنشطة الأخيرة بمعدل ${velocityPercentage}%`);
  }

  // بناء خطة المعالجة والتمكين الأكاديمي (Rule-Based Actionable Remedial Plan)
  const remedialPlan: GapDiagnosis['remedialPlan'] = [];

  const gapDomains = [...criticalSkills, ...moderateSkills];
  gapDomains.forEach((g) => {
    let tRole = 'متابعة فردية وتكليف بأنشطة إضافية مبسطة.';
    let hRole = 'مراجعة أداء المعلم في تفعيل خطة المعالجة للصف.';
    let pRole = 'تخصيص 10 دقائق تدريب منزلي يومي.';

    if (g.key === 'reading') {
      tRole = 'توجيه الطالب لقراءة النصوص القصيرة المشكولة بصوت مسموع مع أسئلة فهم مباشرة قبل الاستنتاجية.';
      hRole = 'تزويد المعلم بنصوص قرائية إثرائية متدرجة في الصعوبة من مكتبة بوك تايم المعتمدة.';
      pRole = 'الاستماع للطالب وهو يقرأ قصة قصيرة يومياً وطرح سؤالين حول أحداثها لتنمية الاستيعاب.';
    } else if (g.key === 'phonics') {
      tRole = 'استخدام ألعاب قطار الحركات ومعمل دمج الحروف والتركيز على التمييز بين المدود والحركات القصيرة.';
      hRole = 'التأكد من تخصيص ركن صوتي تفاعلي في خطة تدريس المادة لطلاب الفئة المستهدفة.';
      pRole = 'تدريب الطفل على نطق الحروف المشكولة بوضوح ومطابقته للكلمات المحيطة به في المنزل.';
    } else if (g.key === 'spelling_grammar') {
      tRole = 'إجراء تدريبات إملائية مسموعة أسبوعية مع توضيح قاعدة التاء المربوطة والمفتوحة واللامين.';
      hRole = 'التوجيه بتطبيق ورقة عمل تشخيصية أسبوعية للظواهر الإملائية لقياس ردم الفجوة.';
      pRole = 'إملاء الطفل جملة يومياً ومكافأته عند كتابتها بدون أخطاء إملائية.';
    } else if (g.key === 'vocab_sentences') {
      tRole = 'استخدام بطاقات تركيب الجمل وتطبيق ألعاب سياق المفردات والترادف والتضاد.';
      hRole = 'إدراج استراتيجيات بناء المفردات التفاعلية ضمن الممارسات التدريسية المعتمدة.';
      pRole = 'تشجيع الطفل على التعبير بجمل كاملة وسؤاله عن معاني الكلمات الجديدة التي يتعلمها.';
    } else if (g.key === 'exams_challenges') {
      tRole = 'تدريب الطالب على إدارة وقت الاختبار التجريبي وإزالة رهبة التقييمات عبر التحديات الودية.';
      hRole = 'متابعة كشوفات نتائج الاختبارات الدورية وتوفير بيئة اختبار مرنة ومحفزة.';
      pRole = 'تشجيع الطالب نفسياً وتعزيز ثقته بقدراته والتركيز على المحاولة وليس فقط الدرجة.';
    }

    remedialPlan.push({
      targetDomain: g.name,
      gapDescription: g.diagnosedIssues.join(' • '),
      recommendedActions: g.suggestedRemediation,
      teacherRole: tRole,
      hodRole: hRole,
      parentRole: pRole,
    });
  });

  // إذا لم تكن هناك فجوة، نضع خطة إثرائية للمتفوقين
  if (remedialPlan.length === 0) {
    remedialPlan.push({
      targetDomain: 'التعزيز والإثراء الإبداعي (خطة التفوق)',
      gapDescription: 'لا توجد فجوات تعليمية مسجلة؛ الطالب متقن لكافة المهارات المقررة.',
      recommendedActions: [
        'إسناد كتابة نصوص إبداعية وقصص قصيرة ونشرها على جدار الإبداع بالمنصة.',
        'تكليف الطالب بالمشاركة في تحديات موسى التنافسية المتقدمة.',
        'تأهيل الطالب لمسابقات الإملاء والقراءة على مستوى المدرسة.'
      ],
      teacherRole: 'إشراك الطالب كقائد لمجموعات التعلم التعاوني وتكليفه بمهام إثرائية خاصة.',
      hodRole: 'توثيق قصة تفوق الطالب وترشيحه لجوائز التميز الأكاديمي وقائمة شرف القسم.',
      parentRole: 'الاستمرار في الدعم والتشجيع وتوسيع مدارك الطفل بالقراءة العامة خارج المنهج.',
    });
  }

  const diagnosis: GapDiagnosis = {
    hasGap,
    overallLevel,
    levelLabel,
    badgeBg,
    badgeText,
    badgeBorder,
    primaryGapSummary,
    trend,
    trendLabel,
    trendDescription,
    velocityPercentage,
    criticalGapsList: criticalGapsList.length > 0 ? criticalGapsList : ['لا توجد فجوات حرجة؛ الأداء متوازن ومتقن بالكامل.'],
    strengthsList: strengthsList.length > 0 ? strengthsList : ['انتظام في الحضور وحل الواجبات.'],
    remedialPlan,
  };

  return {
    student,
    schoolName,
    reportDate: new Date().toLocaleDateString('ar-EG', { dateStyle: 'full' }),
    totalTasksCompleted,
    totalEarnedScore,
    totalPossibleScore,
    overallPercentage,
    timeline,
    skills,
    skillsList,
    diagnosis,
    examsCount,
    examsAvgPercentage,
    activitiesCount,
    activitiesAvgPercentage,
  };
};

// دالة تصدير تقرير أداء الطالب الفعلي إلى Excel
export const exportStudentReportToExcel = (report: StudentDetailedFactualReport): void => {
  const wb = XLSX.utils.book_new();

  // 1. ورقة البيانات العامة والمؤشرات
  const summaryData = [
    ['تقرير الأداء الأكاديمي والتحصيل الفعلي (غير معتمد على AI)'],
    ['اسم المدرسة:', report.schoolName],
    ['اسم الطالب:', report.student.name],
    ['الرقم الأكاديمي / المعرف:', report.student.username || report.student.id],
    ['الصف الدراسي:', getGradeLabel(report.student.grade)],
    ['المسار:', report.student.track === 'arabic-b' ? 'عرب B (الناطقين بغيرها)' : 'عرب A (الناطقين بها)'],
    ['تاريخ استخراج التقرير:', report.reportDate],
    [''],
    ['مؤشرات التحصيل العامة'],
    ['إجمالي المهام المنجزة:', report.totalTasksCompleted],
    ['إجمالي النقاط المحققة:', report.totalEarnedScore],
    ['الدرجة الممكنة القصوى:', report.totalPossibleScore],
    ['نسبة التحصيل التراكمية:', `${report.overallPercentage}%`],
    ['حالة الفجوة التعليمية:', report.diagnosis.levelLabel],
    ['مسار التقدم الزمني:', report.diagnosis.trendLabel],
    [''],
    ['تشخيص الفجوات ونقاط القوة'],
    ['الملخص التشخيصي:', report.diagnosis.primaryGapSummary],
    ['مسار النمو الأكاديمي:', report.diagnosis.trendDescription],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'المؤشرات والتشخيص');

  // 2. ورقة توزيع المهارات والكفايات
  const skillsData = [
    ['المجال اللغوي / المهارة', 'الدرجة المحققة', 'الدرجة القصوى', 'نسبة الإتقان', 'عدد المهام', 'حالة المجال'],
    ...report.skillsList.map((s) => [
      s.name,
      s.score,
      s.maxPoints,
      `${s.percentage}%`,
      s.itemsCount,
      s.statusLabel,
    ]),
  ];

  const wsSkills = XLSX.utils.aoa_to_sheet(skillsData);
  XLSX.utils.book_append_sheet(wb, wsSkills, 'تحليل الكفايات اللغوية');

  // 3. ورقة سجل الأنشطة والدرجات التفصيلي
  const timelineData = [
    ['م', 'عنوان النشاط / الاختبار', 'النوع', 'المجال المستهدف', 'التاريخ والوقت', 'الدرجة', 'الدرجة القصوى', 'نسبة الإتقان'],
    ...report.timeline.map((item, idx) => [
      idx + 1,
      item.title,
      item.type === 'exam' ? 'اختبار رسمي' : item.type === 'challenge' ? 'تحدي تنافسي' : 'نشاط تفاعلي',
      report.skills[item.skillDomain as SkillDomainKey]?.name || item.skillDomain,
      item.date ? new Date(item.date).toLocaleString('ar-EG') : 'غير مسجل',
      item.score,
      item.maxPoints,
      `${item.percentage}%`,
    ]),
  ];

  const wsTimeline = XLSX.utils.aoa_to_sheet(timelineData);
  XLSX.utils.book_append_sheet(wb, wsTimeline, 'سجل التسليمات التفصيلي');

  // 4. ورقة خطة المعالجة والتمكين
  const planData = [
    ['المجال المستهدف', 'التشخيص الفعلي للفجوة', 'الإجراءات العلاجية المقترحة', 'دور المعلم', 'دور رئيس القسم', 'دور ولي الأمر'],
    ...report.diagnosis.remedialPlan.map((p) => [
      p.targetDomain,
      p.gapDescription,
      p.recommendedActions.join(' • '),
      p.teacherRole,
      p.hodRole,
      p.parentRole,
    ]),
  ];

  const wsPlan = XLSX.utils.aoa_to_sheet(planData);
  XLSX.utils.book_append_sheet(wb, wsPlan, 'خطة التدخل والمعالجة');

  // حفظ وتنزيل الملف
  const safeName = report.student.name.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
  XLSX.writeFile(wb, `تقرير_تحصيل_وفجوات_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

// دالة توليد ملخص نصي أنيق للتقرير قابل للنسخ إلى الحافظة
export const exportStudentReportTextSummary = (report: StudentDetailedFactualReport): string => {
  const lines = [
    `📊 تقرير التحصيل الأكاديمي وتشخيص الفجوات التعليمية الفعلي`,
    `═════════════════════════════════════════════`,
    `👤 الطالب: ${report.student.name} (${report.student.username || report.student.id})`,
    `🏫 المدرسة: ${report.schoolName}`,
    `📚 الصف: ${getGradeLabel(report.student.grade)} | المسار: ${report.student.track === 'arabic-b' ? 'ناطقين بغيرها (B)' : 'ناطقين (A)'}`,
    `📅 تاريخ التقرير: ${report.reportDate}`,
    `─────────────────────────────────────────────`,
    `📈 المؤشرات العامة المحققة (أداء فعلي غير معتمد على AI):`,
    `• نسبة التحصيل العامة: ${report.overallPercentage}% (${report.totalEarnedScore} من أصل ${report.totalPossibleScore} نقطة)`,
    `• إجمالي المهام والحلول المكتملة: ${report.totalTasksCompleted} مهمة`,
    `• معدل الاختبارات الرسمية: ${report.examsCount > 0 ? `${report.examsAvgPercentage}% (${report.examsCount} اختبار)` : 'لم يختبر بعد'}`,
    `• مسار التقدم الزمني: ${report.diagnosis.trendLabel} (${report.diagnosis.trendDescription})`,
    `• تشخيص الفجوة التعليمية: ${report.diagnosis.levelLabel}`,
    `─────────────────────────────────────────────`,
    `🎯 تفصيل الكفايات والمهارات اللغوية:`,
    ...report.skillsList.map((s) => `  ${s.icon} ${s.name}: ${s.percentage}% (${s.score}/${s.maxPoints}) - ${s.statusLabel}`),
    `─────────────────────────────────────────────`,
    `📋 ملخص التشخيص:`,
    `${report.diagnosis.primaryGapSummary}`,
    ``,
    `🌟 أبرز نقاط القوة:`,
    ...report.diagnosis.strengthsList.map((st) => `  + ${st}`),
    ``,
    `⚠️ الفجوات التي تحتاج تركيزاً:`,
    ...report.diagnosis.criticalGapsList.map((g) => `  - ${g}`),
    `─────────────────────────────────────────────`,
    `🛠️ خطة التدخل والمعالجة المقترحة:`,
    ...report.diagnosis.remedialPlan.map((p, i) => `${i + 1}. [${p.targetDomain}]: ${p.recommendedActions.join(' | ')}`),
    `═════════════════════════════════════════════`,
    `منصة "تعلّم مع موسى" للتعليم الذكي • تقرير رسمي مستخرج آلياً`,
  ];

  return lines.join('\n');
};
