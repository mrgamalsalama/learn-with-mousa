import React, { useState, useMemo } from 'react';
import { 
  X, Printer, Download, Share2, Check, TrendingUp, TrendingDown, 
  Minus, AlertTriangle, CheckCircle2, Award, BookOpen, Clock, 
  Calendar, Layers, FileSpreadsheet, ShieldAlert, Sparkles,
  BarChart3, User, ChevronDown, RefreshCw, BookmarkCheck,
  Building2, School, GraduationCap, Target, ArrowUpRight, ArrowDownRight,
  HelpCircle, Eye
} from 'lucide-react';
import { UserProfile, StudentSubmission, ExamSession } from '../types';
import { 
  generateStudentFactualReport, 
  exportStudentReportToExcel, 
  exportStudentReportTextSummary,
  StudentDetailedFactualReport,
  PerformancePoint
} from '../utils/studentPerformanceAnalytics';
import { getGradeLabel } from '../utils/gradebookExport';

interface InstantStudentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: UserProfile;
  allSubmissions: StudentSubmission[];
  allExamSessions?: ExamSession[];
  schoolName?: string;
  allClassStudents?: UserProfile[]; // للتبديل السريع بين طلاب الفصل
  onSelectAnotherStudent?: (student: UserProfile) => void;
  actorRole: 'teacher' | 'hod' | 'super_admin' | 'school_admin';
}

export const InstantStudentReportModal: React.FC<InstantStudentReportModalProps> = ({
  isOpen,
  onClose,
  student,
  allSubmissions,
  allExamSessions = [],
  schoolName = 'منصة تعلّم مع موسى النموذجية',
  allClassStudents = [],
  onSelectAnotherStudent,
  actorRole,
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'skills' | 'remedial' | 'history'>('analytics');
  const [copiedToast, setCopiedToast] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<PerformancePoint | null>(null);

  // توليد التقرير الفعلي الشامل دون أي استدعاء للذكاء الاصطناعي
  const report: StudentDetailedFactualReport = useMemo(() => {
    return generateStudentFactualReport(student, allSubmissions, allExamSessions, schoolName);
  }, [student, allSubmissions, allExamSessions, schoolName]);

  if (!isOpen) return null;

  // نسخ ملخص نصي للحافظة
  const handleCopySummary = () => {
    const text = exportStudentReportTextSummary(report);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 3000);
    }
  };

  // تصدير إكسيل
  const handleExportExcel = () => {
    exportStudentReportToExcel(report);
  };

  // طباعة التقرير الأكاديمي الرسمي
  const handlePrint = () => {
    window.print();
  };

  // إعداد بيانات الرسم البياني الخطي المتجهي (Vector SVG Chart)
  const chartWidth = 720;
  const chartHeight = 260;
  const paddingX = 55;
  const paddingY = 40;
  const usableWidth = chartWidth - paddingX * 2;
  const usableHeight = chartHeight - paddingY * 2;

  const pointsCount = report.timeline.length;
  const svgPoints = report.timeline.map((pt, idx) => {
    const x = pointsCount > 1 
      ? paddingX + (idx / (pointsCount - 1)) * usableWidth 
      : paddingX + usableWidth / 2;
    const y = paddingY + (1 - (pt.percentage / 100)) * usableHeight;
    return { ...pt, x, y };
  });

  const polylinePoints = svgPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPolygonPoints = svgPoints.length > 0 
    ? `${svgPoints[0].x},${chartHeight - paddingY} ${polylinePoints} ${svgPoints[svgPoints.length - 1].x},${chartHeight - paddingY}`
    : '';

  // خط حد الإتقان (80%) وخط حد النجاح (60%)
  const yMastery80 = paddingY + (1 - 0.8) * usableHeight;
  const yPass60 = paddingY + (1 - 0.6) * usableHeight;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in" dir="rtl">
      {/* نافذة التقرير الرئيسية */}
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* ترويسة النافذة المنبثقة والشريط العلوي */}
        <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-5 border-b border-indigo-900 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg shadow-emerald-500/20 shrink-0">
              📊
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white">
                  تقرير التحصيل الفوري وتشخيص الفجوات التعليمية
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  أداء فعلي مباشر • غير معتمد على AI
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5 flex flex-wrap items-center gap-x-2">
                <span>المدرسة: <b className="text-white">{report.schoolName}</b></span>
                <span>•</span>
                <span>تاريخ التقرير: <b>{report.reportDate}</b></span>
                <span>•</span>
                <span>مستخرج لـ: <b>{actorRole === 'hod' ? 'رئيس قسم اللغة العربية' : 'معلم المادة'}</b></span>
              </p>
            </div>
          </div>

          {/* أزرار الإجراءات السريعة (طباعة وتصدير وإغلاق) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/15 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="طباعة التقرير الأكاديمي الرسمي مباشرة"
            >
              <Printer className="w-3.5 h-3.5 text-teal-300" />
              <span>طباعة التقرير الأكاديمي</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/30"
              title="تنزيل كشف الدرجات التفصيلي بصيغة Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
              <span>تصدير Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleCopySummary}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/15 transition cursor-pointer"
              title="نسخ ملخص التقرير للحافظة"
            >
              {copiedToast ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-slate-300" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* بطاقة تعريف الطالب والتبديل السريع بين طلاب الفصل */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-sm border border-indigo-200 shrink-0">
              {student.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-slate-900">{student.name}</h3>
                <span className="text-[11px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  #{student.username || student.id.slice(0, 8)}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {getGradeLabel(student.grade)}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {student.track === 'arabic-b' ? 'عرب B (الناطقين بغيرها)' : 'عرب A (الناطقين بها)'}
                </span>
              </div>
            </div>
          </div>

          {/* تبديل سريع بين طلاب الفصل إن توفرت القائمة */}
          {allClassStudents.length > 1 && onSelectAnotherStudent && (
            <div className="flex items-center gap-2 self-start md:self-auto">
              <span className="text-xs text-slate-500 font-medium">عرض طالب آخر:</span>
              <select
                value={student.id}
                onChange={(e) => {
                  const target = allClassStudents.find((s) => s.id === e.target.value);
                  if (target) onSelectAnotherStudent(target);
                }}
                className="bg-white border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-1.5 font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
              >
                {allClassStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({getGradeLabel(s.grade)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* شريط تبويبات التقرير */}
        <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center gap-2 overflow-x-auto shrink-0 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>المؤشرات ومسار التقدم 📈</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('skills')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'skills'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>كفايات اللغة وتشخيص الفجوات 🎯</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('remedial')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'remedial'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>خطة المعالجة والتمكين الأكاديمي 🛠️</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>سجل الدرجات والأنشطة التفصيلي ({report.totalTasksCompleted}) 📋</span>
          </button>
        </div>

        {/* محتوى التقرير التفاعلي */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          
          {/* ================= التبويب 1: المؤشرات العامة والرسم البياني ================= */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              
              {/* بطاقة التشخيص المركزي للفجوة التعليمية */}
              <div className={`p-5 rounded-3xl border ${report.diagnosis.badgeBorder} ${report.diagnosis.badgeBg} shadow-xs relative overflow-hidden`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-black border ${report.diagnosis.badgeBorder} bg-white shadow-2xs ${report.diagnosis.badgeText}`}>
                        {report.diagnosis.levelLabel}
                      </span>
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        <span>المسار الزمني:</span>
                        <b className="text-slate-800">{report.diagnosis.trendLabel}</b>
                      </span>
                    </div>
                    <p className="text-sm font-extrabold text-slate-900 leading-relaxed">
                      {report.diagnosis.primaryGapSummary}
                    </p>
                    <p className="text-xs text-slate-600 leading-normal">
                      {report.diagnosis.trendDescription}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 bg-white/80 backdrop-blur-xs p-3.5 rounded-2xl border border-slate-200/80 shrink-0 shadow-2xs">
                    <div className="text-center px-2">
                      <span className="text-[10px] text-slate-400 font-bold block mb-0.5">نسبة الإتقان العامة</span>
                      <span className={`text-2xl font-black ${
                        report.overallPercentage >= 85 ? 'text-emerald-600' :
                        report.overallPercentage >= 70 ? 'text-indigo-600' :
                        report.overallPercentage >= 55 ? 'text-amber-600' : 'text-rose-600'
                      }`}>
                        {report.overallPercentage}%
                      </span>
                    </div>
                    <div className="w-px h-10 bg-slate-200"></div>
                    <div className="text-center px-2">
                      <span className="text-[10px] text-slate-400 font-bold block mb-0.5">المهام المنجزة</span>
                      <span className="text-2xl font-black text-slate-800">
                        {report.totalTasksCompleted}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* بطاقات المؤشرات الرقمية الفورية (KPIs) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                    <span>إجمالي الدرجات المحققة</span>
                    <Award className="w-4 h-4 text-amber-500" />
                  </span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-slate-900">{report.totalEarnedScore}</span>
                    <span className="text-xs text-slate-400 font-bold mr-1">/ {report.totalPossibleScore} نقطة</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold mt-1">حاصل التقييمات المستمرة</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                    <span>الأنشطة والواجبات</span>
                    <BookOpen className="w-4 h-4 text-blue-500" />
                  </span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-slate-900">{report.activitiesCount}</span>
                    <span className="text-xs text-slate-400 font-bold mr-1">حل مكتمل</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold mt-1">متوسط إتقان: <b>{report.activitiesAvgPercentage}%</b></span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                    <span>الاختبارات والتقييمات</span>
                    <Target className="w-4 h-4 text-indigo-500" />
                  </span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-slate-900">{report.examsCount}</span>
                    <span className="text-xs text-slate-400 font-bold mr-1">جلسة مؤكدة</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold mt-1">متوسط درجات: <b>{report.examsAvgPercentage}%</b></span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                    <span>سرعة نمو التحصيل</span>
                    {report.diagnosis.velocityPercentage >= 0 ? (
                      <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-rose-500" />
                    )}
                  </span>
                  <div className="mt-2">
                    <span className={`text-xl font-black ${
                      report.diagnosis.velocityPercentage >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {report.diagnosis.velocityPercentage >= 0 ? `+${report.diagnosis.velocityPercentage}%` : `${report.diagnosis.velocityPercentage}%`}
                    </span>
                    <span className="text-xs text-slate-400 font-bold mr-1">مقارنة بالبداية</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold mt-1">حساب رياضي خطي دقيق</span>
                </div>
              </div>

              {/* الرسم البياني لمسار التقدم الزمني (Chronological Progress Curve) */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-indigo-600" />
                      منحنى تطور الأداء والتحصيل الزمني التراكمي
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      تتبع الدرجات الفعلية لكل نشاط واختبار خاضه الطالب ومقارنتها بحد الإتقان المرجعي (80%) وحد النجاح (60%).
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <span>حد الإتقان (80%)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <span>حد النجاح (60%)</span>
                    </div>
                  </div>
                </div>

                {report.timeline.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 space-y-2">
                    <BarChart3 className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
                    <p className="text-xs font-bold">لا توجد تسليمات مسجلة للطالب حتى الآن لرسم منحنى التقدم.</p>
                    <p className="text-[11px] text-slate-400">بمجرد قيام الطالب بحل أول نشاط أو اختبار ستظهر نقاط الرسم البياني تلقائياً.</p>
                  </div>
                ) : (
                  <div className="relative w-full overflow-x-auto pb-2">
                    <svg
                      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                      className="w-full h-auto max-h-[300px] select-none"
                    >
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* خطوط الشبكة الأفقية والمحاور */}
                      {[100, 75, 50, 25, 0].map((val) => {
                        const y = paddingY + (1 - val / 100) * usableHeight;
                        return (
                          <g key={val}>
                            <line
                              x1={paddingX}
                              y1={y}
                              x2={chartWidth - paddingX}
                              y2={y}
                              stroke="#f1f5f9"
                              strokeWidth="1"
                            />
                            <text
                              x={paddingX - 10}
                              y={y + 4}
                              textAnchor="end"
                              className="text-[10px] fill-slate-400 font-mono font-bold"
                            >
                              {val}%
                            </text>
                          </g>
                        );
                      })}

                      {/* خط حد الإتقان المرجعي (80%) */}
                      <line
                        x1={paddingX}
                        y1={yMastery80}
                        x2={chartWidth - paddingX}
                        y2={yMastery80}
                        stroke="#10b981"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={chartWidth - paddingX}
                        y={yMastery80 - 6}
                        textAnchor="end"
                        className="text-[9px] fill-emerald-600 font-extrabold"
                      >
                        حد الإتقان (80%)
                      </text>

                      {/* خط حد النجاح (60%) */}
                      <line
                        x1={paddingX}
                        y1={yPass60}
                        x2={chartWidth - paddingX}
                        y2={yPass60}
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={chartWidth - paddingX}
                        y={yPass60 - 6}
                        textAnchor="end"
                        className="text-[9px] fill-amber-600 font-extrabold"
                      >
                        حد النجاح (60%)
                      </text>

                      {/* مساحة التدرج اللوني أسفل المنحنى */}
                      {areaPolygonPoints && (
                        <polygon
                          points={areaPolygonPoints}
                          fill="url(#areaGrad)"
                        />
                      )}

                      {/* المنحنى الخطي للأداء */}
                      {polylinePoints && (
                        <polyline
                          fill="none"
                          stroke="#4f46e5"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={polylinePoints}
                        />
                      )}

                      {/* نقاط البيانات التفاعلية (Data Dots) */}
                      {svgPoints.map((pt, idx) => {
                        const isHovered = hoveredPoint?.id === pt.id;
                        const dotColor = pt.percentage >= 80 ? '#10b981' : pt.percentage >= 60 ? '#f59e0b' : '#ef4444';

                        return (
                          <g key={pt.id || idx}>
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={isHovered ? 7 : 4.5}
                              fill="#ffffff"
                              stroke={dotColor}
                              strokeWidth={isHovered ? 3.5 : 2.5}
                              className="cursor-pointer transition-all duration-200"
                              onMouseEnter={() => setHoveredPoint(pt)}
                              onMouseLeave={() => setHoveredPoint(null)}
                            />
                            {/* تسمية النسبة أعلى النقطة */}
                            <text
                              x={pt.x}
                              y={pt.y - 10}
                              textAnchor="middle"
                              className="text-[9px] font-extrabold fill-slate-700 pointer-events-none"
                            >
                              {pt.percentage}%
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    {/* بطاقة التلميح المنبثقة عند تمرير الفأرة فوق النقطة */}
                    {hoveredPoint && (
                      <div className="mt-2 p-3 bg-slate-900 text-white rounded-xl text-xs flex items-center justify-between animate-fade-in shadow-xl">
                        <div>
                          <span className="font-extrabold block text-indigo-300">
                            {hoveredPoint.title}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {hoveredPoint.date ? new Date(hoveredPoint.date).toLocaleString('ar-EG') : 'تاريخ غير محدد'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-300">
                            الدرجة: <b>{hoveredPoint.score} / {hoveredPoint.maxPoints}</b>
                          </span>
                          <span className={`px-2 py-0.5 rounded-full font-black text-xs ${
                            hoveredPoint.percentage >= 80 ? 'bg-emerald-500/20 text-emerald-300' :
                            hoveredPoint.percentage >= 60 ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {hoveredPoint.percentage}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* بطاقات مقارنة الكفايات اللغوية السريعة */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-600" />
                    خريطة الكفايات اللغوية الخمس ومعدلات الإتقان الفعلية
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('skills')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    عرض التفاصيل التشخيصية الكاملة ←
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {report.skillsList.map((skill) => (
                    <div key={skill.key} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{skill.icon}</span>
                          <span className="font-extrabold text-xs text-slate-800">{skill.name}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          skill.status === 'mastered' ? 'bg-emerald-100 text-emerald-800' :
                          skill.status === 'gap' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {skill.percentage}%
                        </span>
                      </div>

                      {/* شريط التقدم */}
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            skill.percentage >= 80 ? 'bg-emerald-500' :
                            skill.percentage >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, skill.percentage))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-1">
                        <span>الدرجة: {skill.score} من أصل {skill.maxPoints} ({skill.itemsCount} مهمة)</span>
                        <span className="font-bold text-slate-700">{skill.statusLabel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= التبويب 2: تشخيص الكفايات والفجوات بالتفصيل ================= */}
          {activeTab === 'skills' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                    <Target className="w-4 h-4 text-indigo-600" />
                    المصفوفة التشخيصية الدقيقة للكفايات اللغوية والفجوات المرصودة
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    تحليل تفصيلي لكل مهارة مستند إلى عدد الإجابات الصحيحة ونسب الخطأ المتكررة دون أي تكهنات آلية.
                  </p>
                </div>

                <div className="space-y-4">
                  {report.skillsList.map((skill) => {
                    const isGap = skill.status === 'gap';
                    const isMastered = skill.status === 'mastered';

                    return (
                      <div
                        key={skill.key}
                        className={`p-5 rounded-2xl border transition-all ${
                          isGap ? 'bg-rose-50/40 border-rose-200' :
                          isMastered ? 'bg-emerald-50/30 border-emerald-200' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shadow-2xs">
                              {skill.icon}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-sm text-slate-900">{skill.name}</h4>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                  isGap ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                                  isMastered ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {skill.statusLabel}
                                </span>
                              </div>
                              <span className="text-xs text-slate-400 font-medium mt-0.5 block">
                                عدد الأنشطة المنجزة: {skill.itemsCount} • مجموع النقاط: {skill.score} من أصل {skill.maxPoints}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 font-bold block">معدل الإتقان</span>
                              <span className={`text-xl font-black ${
                                skill.percentage >= 80 ? 'text-emerald-600' :
                                skill.percentage >= 60 ? 'text-amber-600' : 'text-rose-600'
                              }`}>
                                {skill.percentage}%
                              </span>
                            </div>
                            <div className="w-24 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  skill.percentage >= 80 ? 'bg-emerald-500' :
                                  skill.percentage >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(5, skill.percentage))}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* مؤشرات التشخيص والتوصية المباشرة */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1.5 bg-white/80 p-3 rounded-xl border border-slate-100">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <AlertTriangle className={`w-3.5 h-3.5 ${isGap ? 'text-rose-500' : 'text-amber-500'}`} />
                              التشخيص والأدلة المرصودة:
                            </span>
                            <ul className="space-y-1 text-slate-600 pr-4 list-disc text-[11px]">
                              {skill.diagnosedIssues.map((issue, idx) => (
                                <li key={idx} className="leading-relaxed">{issue}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="space-y-1.5 bg-white/80 p-3 rounded-xl border border-slate-100">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              الإجراء التدريسي الموصى به:
                            </span>
                            <ul className="space-y-1 text-slate-600 pr-4 list-disc text-[11px]">
                              {skill.suggestedRemediation.map((rem, idx) => (
                                <li key={idx} className="leading-relaxed">{rem}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ================= التبويب 3: خطة المعالجة والتمكين الأكاديمي ================= */}
          {activeTab === 'remedial' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                    <BookmarkCheck className="w-4 h-4 text-emerald-600" />
                    خطة التدخل والمعالجة والتمكين الأكاديمي المقترحة
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    إجراءات تربوية عملية ومحددة مقسمة بحسب أدوار المعلم ورئيس القسم وولي الأمر لمعالجة الفجوات المرصودة أو تعزيز التفوق.
                  </p>
                </div>

                <div className="space-y-5">
                  {report.diagnosis.remedialPlan.map((plan, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <h4 className="font-black text-sm text-slate-900">{plan.targetDomain}</h4>
                        </div>
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                          خطة إجرائية مستهدفة
                        </span>
                      </div>

                      <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-100">
                        <b className="text-slate-900 block mb-1">وصف الفجوة ومبرر التدخل:</b>
                        <p className="leading-relaxed">{plan.gapDescription}</p>
                      </div>

                      {/* تفصيل الأدوار الإجرائية الثلاثة */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* دور المعلم */}
                        <div className="bg-white p-3.5 rounded-xl border border-blue-100 space-y-1.5 shadow-2xs">
                          <span className="text-[11px] font-extrabold text-blue-700 flex items-center gap-1.5">
                            <GraduationCap className="w-3.5 h-3.5" />
                            دور المعلم في الحصة:
                          </span>
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            {plan.teacherRole}
                          </p>
                        </div>

                        {/* دور رئيس القسم */}
                        <div className="bg-white p-3.5 rounded-xl border border-purple-100 space-y-1.5 shadow-2xs">
                          <span className="text-[11px] font-extrabold text-purple-700 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5" />
                            إشراف رئيس القسم:
                          </span>
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            {plan.hodRole}
                          </p>
                        </div>

                        {/* دور ولي الأمر */}
                        <div className="bg-white p-3.5 rounded-xl border border-emerald-100 space-y-1.5 shadow-2xs">
                          <span className="text-[11px] font-extrabold text-emerald-700 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            المتابعة الأسرية المنزلية:
                          </span>
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            {plan.parentRole}
                          </p>
                        </div>
                      </div>

                      {/* الأنشطة المقترحة */}
                      <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                        <span className="text-[11px] font-extrabold text-slate-800 block">
                          الأنشطة والمهام المقترح إسنادها فوراً:
                        </span>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {plan.recommendedActions.map((act, i) => (
                            <span key={i} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              ✓ {act}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= التبويب 4: سجل الدرجات والأنشطة التفصيلي ================= */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      سجل الدرجات والأنشطة التراكمي للطالب ({report.totalTasksCompleted} مهمة)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      قائمة كاملة بكافة الحلول والاستجابات المسجلة داخل المنصة مع النتيجة وتاريخ الإنجاز.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-100 transition flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    تصدير الجدول إلى Excel
                  </button>
                </div>

                {report.timeline.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <p className="text-xs font-bold">لا توجد تسليمات مسجلة للطالب بعد.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 bg-slate-50">
                          <th className="py-3 px-3 font-semibold rounded-r-xl">م</th>
                          <th className="py-3 px-3 font-semibold">عنوان المهمة / النشاط</th>
                          <th className="py-3 px-3 font-semibold">نوع المهمة</th>
                          <th className="py-3 px-3 font-semibold">المجال اللغوي</th>
                          <th className="py-3 px-3 font-semibold">تاريخ التسليم</th>
                          <th className="py-3 px-3 font-semibold text-center">الدرجة</th>
                          <th className="py-3 px-3 font-semibold text-center rounded-l-xl">نسبة الإتقان</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.timeline.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-3 font-mono font-bold text-slate-400 text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-800">
                              {item.title}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.type === 'exam' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                                item.type === 'challenge' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {item.type === 'exam' ? 'اختبار رسمي 📝' : item.type === 'challenge' ? 'تحدي تنافسي 🏆' : 'نشاط تفاعلي 📖'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600 text-[11px]">
                              {report.skills[item.skillDomain as any]?.name || item.skillDomain}
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-[11px]">
                              {item.date ? new Date(item.date).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-800">
                              {item.score} / {item.maxPoints}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full font-black text-[11px] ${
                                item.percentage >= 80 ? 'bg-emerald-100 text-emerald-800' :
                                item.percentage >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {item.percentage}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* التذييل والأزرار السفلية */}
        <div className="bg-white border-t border-slate-200 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>التقرير صادر بصفة رسمية ومسجل في سجلات المنظومة الأكاديمية السحابية.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-teal-300" />
              <span>طباعة المستند الرسمي</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* قالب الطباعة الأكاديمي المخصص لـ window.print() بمواصفات التقارير المدرسية الرسمية */}
      {/* ========================================================================= */}
      <div id="printable-academic-report" className="hidden print:block p-8 bg-white text-slate-900 font-sans" dir="rtl">
        {/* ترويسة التقرير الرسمية */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold block text-slate-600">المملكة العربية السعودية / وزارة التعليم</span>
            <h1 className="text-xl font-black text-slate-900">{report.schoolName}</h1>
            <span className="text-xs font-bold text-slate-700 block">قسم اللغة العربية والتعليم التفاعلي • منصة تعلّم مع موسى</span>
          </div>
          <div className="text-left space-y-1">
            <span className="text-xs font-bold block text-slate-600">تقرير تشخيص التحصيل والفجوات التعليمية</span>
            <span className="text-xs text-slate-500 block">تاريخ الإصدار: <b>{report.reportDate}</b></span>
            <span className="text-[10px] text-slate-400 font-mono">DOC-REF: {student.id.slice(0, 10).toUpperCase()}</span>
          </div>
        </div>

        {/* بطاقة معلومات الطالب */}
        <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block">اسم الطالب الرباعي:</span>
            <span className="font-black text-sm text-slate-900">{student.name}</span>
          </div>
          <div>
            <span className="text-slate-500 block">الرقم الأكاديمي / الهوية:</span>
            <span className="font-mono font-bold text-slate-900">{student.username || student.id}</span>
          </div>
          <div>
            <span className="text-slate-500 block">الصف الدراسي:</span>
            <span className="font-bold text-slate-900">{getGradeLabel(student.grade)}</span>
          </div>
          <div>
            <span className="text-slate-500 block">مسار اللغة العربية:</span>
            <span className="font-bold text-slate-900">{student.track === 'arabic-b' ? 'الناطقين بغيرها (B)' : 'الناطقين بها (A)'}</span>
          </div>
        </div>

        {/* نتيجة التشخيص العامة والنسبة */}
        <div className="border-2 border-slate-900 rounded-xl p-4 mb-6 bg-slate-50/50">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-black text-sm text-slate-900">تشخيص الفجوة التعليمية ومستوى التحصيل الفعلي:</h2>
            <span className="text-base font-black px-3 py-1 rounded bg-slate-900 text-white">
              نسبة التحصيل: {report.overallPercentage}% ({report.totalEarnedScore} / {report.totalPossibleScore} نقطة)
            </span>
          </div>
          <p className="text-xs leading-relaxed font-bold text-slate-800">
            • {report.diagnosis.primaryGapSummary}
          </p>
          <p className="text-xs leading-relaxed text-slate-600 mt-1">
            • مسار التطور الزمني: {report.diagnosis.trendLabel} - {report.diagnosis.trendDescription}
          </p>
        </div>

        {/* جدول الكفايات اللغوية الخمس */}
        <div className="mb-6">
          <h3 className="font-black text-xs text-slate-900 mb-2">جدول تقييم الكفايات والمهارات اللغوية:</h3>
          <table className="w-full text-right text-xs border border-slate-300">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                <th className="p-2 border-l border-slate-300">الكفاية اللغوية</th>
                <th className="p-2 border-l border-slate-300 text-center">المهام المنجزة</th>
                <th className="p-2 border-l border-slate-300 text-center">الدرجة المحققة</th>
                <th className="p-2 border-l border-slate-300 text-center">نسبة الإتقان</th>
                <th className="p-2 text-center">الحالة التشخيصية</th>
              </tr>
            </thead>
            <tbody>
              {report.skillsList.map((skill) => (
                <tr key={skill.key} className="border-b border-slate-200">
                  <td className="p-2 font-bold border-l border-slate-200">{skill.name}</td>
                  <td className="p-2 text-center border-l border-slate-200">{skill.itemsCount}</td>
                  <td className="p-2 text-center border-l border-slate-200">{skill.score} / {skill.maxPoints}</td>
                  <td className="p-2 text-center font-bold border-l border-slate-200">{skill.percentage}%</td>
                  <td className="p-2 text-center font-bold">{skill.statusLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* خطة التدخل والتوصيات */}
        <div className="mb-8 border border-slate-300 rounded-xl p-4">
          <h3 className="font-black text-xs text-slate-900 mb-2">خطة التدخل والمعالجة المعتمدة:</h3>
          <div className="space-y-3 text-xs">
            {report.diagnosis.remedialPlan.map((p, idx) => (
              <div key={idx} className="border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-900 block">• [{p.targetDomain}]: {p.gapDescription}</span>
                <span className="text-slate-700 block pr-4">الإجراءات: {p.recommendedActions.join(' ، ')}</span>
                <span className="text-slate-600 block pr-4 text-[11px]">توجيه المعلم: {p.teacherRole} | توجيه ولي الأمر: {p.parentRole}</span>
              </div>
            ))}
          </div>
        </div>

        {/* خانات التوقيعات والاعتماد الرسمي */}
        <div className="grid grid-cols-3 gap-6 pt-6 border-t-2 border-slate-900 text-center text-xs">
          <div>
            <span className="font-bold block text-slate-800">معلم المادة</span>
            <div className="h-14"></div>
            <span className="text-slate-500 text-[11px]">التوقيع: .................................</span>
          </div>
          <div>
            <span className="font-bold block text-slate-800">رئيس قسم اللغة العربية</span>
            <div className="h-14"></div>
            <span className="text-slate-500 text-[11px]">الاعتماد: .................................</span>
          </div>
          <div>
            <span className="font-bold block text-slate-800">ختم إدارة المدرسة</span>
            <div className="h-14 flex items-center justify-center">
              <div className="w-16 h-12 border-2 border-dashed border-slate-300 rounded flex items-center justify-center text-[9px] text-slate-400">
                موضع الختم
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
