import React, { useState, useEffect } from 'react';
import { 
  InteractiveWorksheet, 
  WorksheetSubmission, 
  UserProfile 
} from '../../types';
import { 
  fetchWorksheetSubmissions, 
  fetchWorksheetById 
} from '../../services/worksheetService';

interface WorksheetSubmissionsProps {
  worksheetId?: string;
  initialWorksheet?: InteractiveWorksheet | null;
  currentUser: UserProfile;
  onBack?: () => void;
}

export const WorksheetSubmissions: React.FC<WorksheetSubmissionsProps> = ({
  worksheetId,
  initialWorksheet,
  currentUser,
  onBack,
}) => {
  const [worksheet, setWorksheet] = useState<InteractiveWorksheet | null>(initialWorksheet || null);
  const [submissions, setSubmissions] = useState<WorksheetSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectingSubmission, setInspectingSubmission] = useState<WorksheetSubmission | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      try {
        if (!worksheet && worksheetId) {
          const ws = await fetchWorksheetById(worksheetId);
          if (isMounted && ws) setWorksheet(ws);
        }

        const subs = await fetchWorksheetSubmissions(worksheetId);
        if (isMounted) {
          setSubmissions(subs);
        }
      } catch (e) {
        console.error('Error loading submissions:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [worksheetId]);

  // تصفية التسليمات حسب البحث
  const filteredSubmissions = submissions.filter(s => {
    const name = (s.student_name || s.guest_name || '').toLowerCase();
    return name.includes(searchQuery.trim().toLowerCase());
  });

  // إحصائيات عامة
  const totalSubmissions = submissions.length;
  const averagePercentage = totalSubmissions > 0
    ? Math.round(submissions.reduce((acc, s) => acc + (Number(s.percentage) || 0), 0) / totalSubmissions)
    : 0;
  const highScorersCount = submissions.filter(s => (s.percentage || 0) >= 80).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans" dir="rtl">
      {/* الشريط العلوي Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition"
                title="رجوع"
              >
                <svg className="w-5 h-5 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  لوحة رصد نتائج ورقة العمل
                </span>
                {worksheet && (
                  <span className="text-xs text-slate-500 font-medium">
                    الدرجة الكلية: {worksheet.total_points || 20}
                  </span>
                )}
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900">
                {worksheet?.title || 'إجابات وتسليمات الطلاب'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl font-semibold">
              إجمالي التسليمات: <strong className="text-slate-900">{totalSubmissions}</strong>
            </span>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 space-y-6">
        {/* كروت الإحصائيات السريعة */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl font-bold">
              📝
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">عدد التسليمات</span>
              <h3 className="text-2xl font-bold text-slate-900">{totalSubmissions} طالب</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl font-bold">
              📊
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">متوسط نسبة الإتقان</span>
              <h3 className="text-2xl font-bold text-emerald-600">{averagePercentage}%</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl font-bold">
              ⭐
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">طلاب متميزون (80% فأعلى)</span>
              <h3 className="text-2xl font-bold text-amber-600">{highScorersCount} طالب</h3>
            </div>
          </div>
        </div>

        {/* شريط البحث والتصفية */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن اسم طالب أو زائر..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-10 pl-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3.5 top-2.5 text-slate-400">🔍</span>
          </div>
        </div>

        {/* جدول رصد النتائج */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500 font-medium">جارِ جلب نتائج وإجابات الطلاب...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <span className="text-4xl block mb-2">📭</span>
              <h4 className="text-sm font-bold text-slate-700">لا توجد تسليمات حتى الآن</h4>
              <p className="text-xs text-slate-500 mt-1">
                عندما يحل الطلاب ورقة العمل عبر الرابط العام أو الفصل، ستظهر إجاباتهم ودرجاتهم هنا فوراً.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                  <tr>
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">اسم الطالب</th>
                    <th className="py-3 px-4">نوع الحساب</th>
                    <th className="py-3 px-4">وقت التسليم</th>
                    <th className="py-3 px-4">الدرجة المحققة</th>
                    <th className="py-3 px-4">نسبة الإتقان</th>
                    <th className="py-3 px-4 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubmissions.map((sub, idx) => {
                    const isRegistered = Boolean(sub.student_id);
                    const pct = Number(sub.percentage) || 0;

                    let badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                    if (pct >= 85) badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    else if (pct >= 60) badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 text-slate-400 font-semibold">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {sub.student_name || sub.guest_name || 'طالب مجهول'}
                        </td>
                        <td className="py-3 px-4">
                          {isRegistered ? (
                            <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              🏫 طالب مقيد بالصف
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              🔗 زائر برابط عام
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {sub.submitted_at
                            ? new Date(sub.submitted_at).toLocaleDateString('ar-EG', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {sub.score} / {sub.total_score || sub.max_score || 20}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${badgeColor}`}>
                            {pct}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setInspectingSubmission(sub)}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition text-[11px] flex items-center gap-1 mx-auto"
                          >
                            <span>👁️ معاينة ورقة الإجابة</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* نافذة معاينة ورقة إجابة الطالب التفصيلية (Inspection Modal) */}
      {inspectingSubmission && worksheet && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 overflow-hidden">
            {/* رأس النافذة */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg font-bold">
                  📝
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    ورقة إجابة الطالب: {inspectingSubmission.student_name || inspectingSubmission.guest_name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    النتيجة: {inspectingSubmission.score} من {inspectingSubmission.total_score} ({inspectingSubmission.percentage}%)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectingSubmission(null)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg text-sm font-bold"
              >
                ✕ إغلاق
              </button>
            </div>

            {/* مساحة عرض الورقة مع إجابات الطالب ومواضع الأخطاء */}
            <div className="flex-1 overflow-auto p-4 flex flex-col items-center bg-slate-100">
              <div
                className="relative w-full max-w-[750px] bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-300"
                style={{ minHeight: '850px' }}
              >
                <img
                  src={worksheet.image_url || worksheet.background_url}
                  alt="ورقة العمل"
                  className="w-full h-auto block select-none pointer-events-none"
                />

                {worksheet.elements.map((el, i) => {
                  const studentAns = inspectingSubmission.answers?.[el.id];
                  const breakdown = inspectingSubmission.results_breakdown?.[el.id];
                  const isCorrect = breakdown ? breakdown.isCorrect : false;

                  return (
                    <div
                      key={el.id}
                      className={`absolute border-2 rounded-lg p-1 flex flex-col justify-between text-[11px] font-bold ${
                        isCorrect
                          ? 'border-emerald-500 bg-emerald-50/90 text-emerald-950'
                          : 'border-rose-500 bg-rose-50/90 text-rose-950'
                      }`}
                      style={{
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        width: `${el.width}%`,
                        height: `${el.height}%`,
                      }}
                    >
                      <div className="flex items-center justify-between text-[9px] pointer-events-none">
                        <span className="bg-black/60 text-white px-1 rounded">
                          #{i + 1}
                        </span>
                        <span className={`px-1 rounded text-white ${isCorrect ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                          {isCorrect ? '✓ صحيح' : '✗ خطأ'}
                        </span>
                      </div>

                      <div className="text-center font-bold text-xs truncate">
                        {el.type === 'text' && (
                          <span>{studentAns || <em className="text-slate-400">فارغ</em>}</span>
                        )}
                        {el.type === 'choice' && (
                          <span>{studentAns ? 'تم اختياره' : 'لم يختره'}</span>
                        )}
                        {el.type === 'checkbox' && (
                          <span>{studentAns ? 'محدد ✓' : 'غير محدد'}</span>
                        )}
                      </div>

                      {/* إظهار الإجابة الصحيحة عند الخطأ */}
                      {!isCorrect && (
                        <div className="text-[9px] text-rose-700 bg-white/90 px-1 rounded text-center truncate border border-rose-200">
                          الصواب: {el.type === 'text' ? (el.correctAnswers?.[0] || breakdown?.expected) : (el.isCorrect ? 'مطلوب اختياره' : 'خاطئ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
