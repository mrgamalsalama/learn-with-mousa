import React, { useState, useMemo } from 'react';
import { 
  Award, FileSpreadsheet, Download, Upload, Search, Filter, 
  Sparkles, BarChart3, Zap, ShieldAlert, CheckCircle2, ChevronDown,
  Layers, Users, BookOpen, Trophy, PenTool, Check, Calendar, RefreshCw
} from 'lucide-react';
import { UserProfile, StudentSubmission, GradeLevel, ArabicTrack } from '../types';
import { 
  computeStudentGradebookEntry, 
  exportGradebookToExcel, 
  exportGradebookToCSV,
  getGradeLabel,
  StudentGradebookEntry
} from '../utils/gradebookExport';
import { BulkStudentImportModal } from './BulkStudentImportModal';

interface GradebookManagerProps {
  currentUser: UserProfile;
  students: UserProfile[];
  submissions: StudentSubmission[];
  allowedGrades?: GradeLevel[];
  onOpenQuickDiagnostic: (student: { id: string; name: string }) => void;
  onOpenFullDiagnostic: (student: UserProfile) => void;
  onOpenClassDiagnostic: () => void;
  isAIPermitted: boolean;
  aiBlockedReason?: string;
  onRefreshData?: () => void;
}

export const GradebookManager: React.FC<GradebookManagerProps> = ({
  currentUser,
  students,
  submissions,
  allowedGrades = [],
  onOpenQuickDiagnostic,
  onOpenFullDiagnostic,
  onOpenClassDiagnostic,
  isAIPermitted,
  aiBlockedReason,
  onRefreshData,
}) => {
  // فلاتر البحث والفرز
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedTrackFilter, setSelectedTrackFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'gradebook' | 'submissions'>('gradebook');
  
  // نوافذ منبثقة
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // إظهار تنبيه نجاح مؤقت
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // قائمة الطلاب الخاضعين للفلترة
  const studentUsers = useMemo(() => {
    return students.filter((u) => u.role === 'student');
  }, [students]);

  // حساب كشف الدرجات التراكمي لجميع الطلاب
  const gradebookEntries: StudentGradebookEntry[] = useMemo(() => {
    return studentUsers.map((st) => computeStudentGradebookEntry(st, submissions));
  }, [studentUsers, submissions]);

  // تطبيق الفلاتر على الطلاب
  const filteredEntries = useMemo(() => {
    return gradebookEntries.filter((entry) => {
      // فلتر الصف
      if (selectedGradeFilter !== 'all' && entry.gradeId !== selectedGradeFilter) {
        return false;
      }
      // فلتر المسار
      if (selectedTrackFilter !== 'all' && entry.trackId !== selectedTrackFilter) {
        return false;
      }
      // فلتر البحث بالاسم أو الرقم الأكاديمي
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = entry.name.toLowerCase().includes(q);
        const matchesId = entry.academicId.toLowerCase().includes(q);
        if (!matchesName && !matchesId) return false;
      }
      return true;
    });
  }, [gradebookEntries, selectedGradeFilter, selectedTrackFilter, searchQuery]);

  // تطبيق الفلاتر على سجل التسليمات الفردية
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      if (selectedGradeFilter !== 'all' && sub.grade !== selectedGradeFilter) {
        return false;
      }
      if (selectedTrackFilter !== 'all' && sub.track !== selectedTrackFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = (sub.studentName || '').toLowerCase().includes(q);
        const matchesAct = (sub.activityTitle || '').toLowerCase().includes(q);
        if (!matchesName && !matchesAct) return false;
      }
      return true;
    });
  }, [submissions, selectedGradeFilter, selectedTrackFilter, searchQuery]);

  // إحصائيات عامة سريعة
  const stats = useMemo(() => {
    const totalStudents = filteredEntries.length;
    if (totalStudents === 0) {
      return { totalStudents: 0, avgPercentage: 0, excellenceRate: 0, totalSubs: 0 };
    }
    const sumPercentage = filteredEntries.reduce((acc, curr) => acc + curr.percentage, 0);
    const avgPercentage = Math.round(sumPercentage / totalStudents);
    const excellentCount = filteredEntries.filter((e) => e.percentage >= 85).length;
    const excellenceRate = Math.round((excellentCount / totalStudents) * 100);
    const totalSubs = filteredEntries.reduce((acc, curr) => acc + curr.submissionsCount, 0);

    return { totalStudents, avgPercentage, excellenceRate, totalSubs };
  }, [filteredEntries]);

  // تنفيذ التصدير إلى إكسيل
  const handleExportExcel = (exportAllGrades: boolean = false) => {
    const filterToUse = exportAllGrades ? 'all' : selectedGradeFilter;
    exportGradebookToExcel(studentUsers, submissions, filterToUse);
    setIsExportMenuOpen(false);
    showToast('تم تصدير كشف الدرجات بنجاح بصيغة Microsoft Excel (.xlsx) 📥');
  };

  // تنفيذ التصدير إلى CSV مع UTF-8 BOM
  const handleExportCSV = (exportAllGrades: boolean = false) => {
    const filterToUse = exportAllGrades ? 'all' : selectedGradeFilter;
    exportGradebookToCSV(studentUsers, submissions, filterToUse);
    setIsExportMenuOpen(false);
    showToast('تم تصدير كشف الدرجات بصيغة CSV المتوافقة مع اللغة العربية 📄');
  };

  // قائمة الصفوف المتاحة للاختيار
  const availableGradesList = useMemo(() => {
    if (allowedGrades && allowedGrades.length > 0) {
      return allowedGrades;
    }
    // في حال عدم تعيين صفوف محددة، استخراج الصفوف الموجودة لدى الطلاب
    const gradeSet = new Set<GradeLevel>();
    studentUsers.forEach((s) => {
      if (s.grade) gradeSet.add(s.grade);
    });
    return Array.from(gradeSet);
  }, [allowedGrades, studentUsers]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* إشعار نجاح منبثق (Toast) */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-bold border border-emerald-500 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* تنبيه حوكمة الذكاء الاصطناعي إن وُجد حجب */}
      {!isAIPermitted && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <span className="font-bold block">ميزات الذكاء الاصطناعي معطلة</span>
            <span className="text-[11px] text-rose-600">{aiBlockedReason}</span>
          </div>
        </div>
      )}

      {/* لوحة التحكم الرئيسية والترويسة */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-2xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-black text-base sm:text-lg text-slate-800 flex items-center gap-2">
                  سجل الدرجات وكشوف الطلاب المعتمدة 📊
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  التكامل المؤسسي ورصد نتائج الفصول، والتصدير المباشر لـ Excel / CSV، والاستيراد الجماعي
                </p>
              </div>
            </div>
          </div>

          {/* أزرار الإجراءات المؤسسية الكبرى */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* زر استيراد الطلاب الجماعي */}
            <button
              type="button"
              id="bulk-student-import-trigger"
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Upload className="w-4 h-4 text-emerald-200" />
              <span>استيراد قائمة الطلاب 👥</span>
            </button>

            {/* قائمة منسدلة لتصدير كشف الدرجات */}
            <div className="relative">
              <button
                type="button"
                id="export-gradebook-menu-trigger"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4 text-amber-300" />
                <span>تصدير كشف الدرجات (Excel / CSV) 📥</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>

              {isExportMenuOpen && (
                <div 
                  className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-40 animate-fadeIn"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 py-2 border-b border-slate-100 text-[11px] font-bold text-slate-400">
                    خيارات تصدير السجل المعتمد:
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExportExcel(false)}
                    className="w-full px-4 py-2.5 text-right text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition flex items-center gap-2.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <div>
                      <span className="block">تصدير Excel (.xlsx) للصف المختار</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({selectedGradeFilter === 'all' ? 'جميع الصفوف' : getGradeLabel(selectedGradeFilter)})
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportCSV(false)}
                    className="w-full px-4 py-2.5 text-right text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-800 transition flex items-center gap-2.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-blue-600" />
                    <div>
                      <span className="block">تصدير كملف CSV (مع UTF-8 BOM)</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        متوافق بدقة مع اللغة العربية في برامج الجداول
                      </span>
                    </div>
                  </button>

                  <div className="border-t border-slate-100 my-1"></div>

                  <button
                    type="button"
                    onClick={() => handleExportExcel(true)}
                    className="w-full px-4 py-2 text-right text-xs font-bold text-slate-600 hover:bg-slate-50 transition flex items-center gap-2.5 cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>تصدير كشف شامل لكافة الصفوف التابعة (Excel)</span>
                  </button>
                </div>
              )}
            </div>

            {/* أزرار الذكاء الاصطناعي */}
            <button
              type="button"
              onClick={onOpenClassDiagnostic}
              disabled={submissions.length === 0 || !isAIPermitted}
              className="px-3.5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title={!isAIPermitted ? aiBlockedReason : "تحليل ذكي تراكمي للفاقد التعليمي للفصل بالكامل"}
            >
              <BarChart3 className="w-4 h-4 text-amber-300" />
              <span>تقرير الفاقد للفصل 📊</span>
            </button>
          </div>
        </div>

        {/* بطاقات المؤشرات الرقمية (KPI Summary Cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-medium block">إجمالي الطلاب</span>
              <span className="text-base font-extrabold text-slate-800">{stats.totalStudents} طالب</span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-medium block">متوسط التحصيل العام</span>
              <span className="text-base font-extrabold text-slate-800">{stats.avgPercentage}%</span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-medium block">نسبة الإتقان المرتفع</span>
              <span className="text-base font-extrabold text-slate-800">{stats.excellenceRate}%</span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-medium block">الأنشطة المنجزة</span>
              <span className="text-base font-extrabold text-slate-800">{stats.totalSubs} حل مكتمل</span>
            </div>
          </div>
        </div>

        {/* شريط الفلاتر والبحث والتبديل */}
        <div className="mt-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-5 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* حقل البحث */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم أو الرقم الأكاديمي..."
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>

            {/* فلتر الصف الدراسي */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500 text-[11px]">الصف:</span>
              <select
                value={selectedGradeFilter}
                onChange={(e) => setSelectedGradeFilter(e.target.value)}
                className="bg-transparent text-slate-800 font-bold focus:outline-hidden cursor-pointer"
              >
                <option value="all">كافة الصفوف الدراسية</option>
                {availableGradesList.map((g) => (
                  <option key={g} value={g}>
                    {getGradeLabel(g)}
                  </option>
                ))}
              </select>
            </div>

            {/* فلتر المسار */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 text-[11px]">المسار:</span>
              <select
                value={selectedTrackFilter}
                onChange={(e) => setSelectedTrackFilter(e.target.value)}
                className="bg-transparent text-slate-800 font-bold focus:outline-hidden cursor-pointer"
              >
                <option value="all">كافة المسارات</option>
                <option value="arabic-a">عرب A (الناطقين بها)</option>
                <option value="arabic-b">عرب B (الناطقين بغيرها)</option>
              </select>
            </div>
          </div>

          {/* تبديل طريقة العرض (كشف تراكمي vs سجل تسليمات) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveView('gradebook')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeView === 'gradebook' 
                  ? 'bg-white text-slate-800 shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              كشف الدرجات التراكمي (10 محاور) 📋
            </button>
            <button
              type="button"
              onClick={() => setActiveView('submissions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeView === 'submissions' 
                  ? 'bg-white text-slate-800 shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              سجل الحلول والتسليمات الفردية 📝
            </button>
          </div>
        </div>
      </div>

      {/* العرض 1: كشف الدرجات المؤسسي التراكمي بالأعمدة العشرة المعتمدة */}
      {activeView === 'gradebook' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" />
              كشف نتائج الطلاب وتوزيع المهارات المعتمد ({filteredEntries.length} طالب)
            </h3>
            <span className="text-[11px] text-slate-400">
              مطابق تماماً لهيكل ملفات التصدير الرسمية لميكروسوفت إكسيل
            </span>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Users className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs">لا يوجد طلاب يطابقون خيارات البحث الحالية.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedGradeFilter('all');
                  setSelectedTrackFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs text-emerald-600 font-bold hover:underline"
              >
                إعادة ضبط الفلاتر
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 bg-slate-50/70">
                    <th className="py-3 px-3 font-bold rounded-r-xl">الرقم الأكاديمي</th>
                    <th className="py-3 px-3 font-bold">اسم الطالب</th>
                    <th className="py-3 px-3 font-bold">الصف والشعبة</th>
                    <th className="py-3 px-3 font-bold">المسار</th>
                    <th className="py-3 px-3 font-bold text-center">تحديات موسى</th>
                    <th className="py-3 px-3 font-bold text-center">الفهم والمكتبة</th>
                    <th className="py-3 px-3 font-bold text-center">الإملاء والصوتيات</th>
                    <th className="py-3 px-3 font-bold text-center">النحو والتطبيق</th>
                    <th className="py-3 px-3 font-bold text-center">التحصيل العام</th>
                    <th className="py-3 px-3 font-bold">آخر نشاط</th>
                    <th className="py-3 px-3 font-bold text-center rounded-l-xl">تشخيص الذكاء الاصطناعي 🧠</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEntries.map((e) => (
                    <tr key={e.student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-indigo-700 text-[11px]">
                        {e.academicId}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">
                        {e.name}
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-[11px]">
                        {e.gradeLabel}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          e.trackId === 'arabic-b' 
                            ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {e.trackLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-amber-600">
                        {e.challengesScore}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-blue-600">
                        {e.readingScore}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-teal-600">
                        {e.spellingPhonicsScore}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-indigo-600">
                        {e.grammarTasksScore}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-[11px] ${
                            e.percentage >= 85
                              ? 'bg-emerald-100 text-emerald-800'
                              : e.percentage >= 70
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {e.percentage}%
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            {e.totalEarnedScore} نقطة
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {e.lastActivityDate}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenQuickDiagnostic({ id: e.student.id, name: e.student.name })}
                            disabled={!isAIPermitted}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-[10px] font-bold border border-amber-300 transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            title="توليد التشخيص الذكي الفوري للطالب بنقرة واحدة"
                          >
                            <Zap className="w-3 h-3 text-amber-600" />
                            <span>تشخيص فوري</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenFullDiagnostic(e.student)}
                            disabled={!isAIPermitted}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-lg text-[10px] font-bold border border-indigo-200 transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            title="عرض التقرير التشخيصي المتعمق"
                          >
                            <Sparkles className="w-3 h-3 text-indigo-600" />
                            <span>تقرير شامل</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* العرض 2: سجل التسليمات الفردية التراكمي */}
      {activeView === 'submissions' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              سجل استجابات وحلول الطلاب التفاعلية ({filteredSubmissions.length} حل مسجل)
            </h3>
          </div>

          {filteredSubmissions.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">
              لم يقم أي طالب بحل الأنشطة أو لا توجد استجابات تطابق الفلتر المختار.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 bg-slate-50/70">
                    <th className="py-3 px-3 font-semibold rounded-r-xl">اسم الطالب</th>
                    <th className="py-3 px-3 font-semibold">عنوان النشاط / اللعبة</th>
                    <th className="py-3 px-3 font-semibold">الدرجة المحققة</th>
                    <th className="py-3 px-3 font-semibold">نسبة الإتقان</th>
                    <th className="py-3 px-3 font-semibold">تاريخ التسليم</th>
                    <th className="py-3 px-3 font-semibold text-center rounded-l-xl">أدوات الذكاء الاصطناعي 🧠</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubmissions.map((sub) => {
                    const percentage = Math.round((sub.score / (sub.totalPoints || 1)) * 100) || 0;
                    const targetStudent = students.find((u) => u.id === sub.studentId) || {
                      id: sub.studentId,
                      name: sub.studentName,
                      role: 'student' as const,
                      grade: sub.grade,
                      track: sub.track,
                      stage: 'primary' as const,
                      username: 'student',
                      password: '123',
                    };

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-800">{sub.studentName}</td>
                        <td className="py-3 px-3 text-slate-600">{sub.activityTitle}</td>
                        <td className="py-3 px-3 font-bold text-emerald-600">
                          {sub.score} / {sub.totalPoints}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              percentage >= 75
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {percentage}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400">{sub.submittedAt}</td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenQuickDiagnostic({ id: sub.studentId, name: sub.studentName })}
                              disabled={!isAIPermitted}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-[10px] font-bold border border-amber-300 transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              title="توليد التشخيص الذكي الفوري للطالب"
                            >
                              <Zap className="w-3 h-3 text-amber-600" /> تشخيص فوري ⚡
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenFullDiagnostic(targetStudent)}
                              disabled={!isAIPermitted}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-lg text-[10px] font-bold border border-indigo-200 transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              title="التقرير التشخيصي المتكامل"
                            >
                              <Sparkles className="w-3 h-3 text-indigo-600" /> تقرير شامل
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* نافذة الاستيراد الجماعي للطلاب */}
      <BulkStudentImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        currentUser={currentUser}
        allowedGrades={allowedGrades}
        onImportSuccess={(count, gradeLabel) => {
          showToast(`تم تسجيل وتحديث ${count} طالب بنجاح في ${gradeLabel} ✨`);
          if (onRefreshData) {
            onRefreshData();
          }
        }}
      />
    </div>
  );
};
