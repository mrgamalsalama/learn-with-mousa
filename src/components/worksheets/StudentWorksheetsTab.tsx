import React, { useState, useEffect } from 'react';
import { 
  InteractiveWorksheet, 
  WorksheetSubmission, 
  UserProfile 
} from '../../types';
import { 
  fetchWorksheets, 
  fetchWorksheetSubmissions 
} from '../../services/worksheetService';
import { WorksheetPlayer } from './WorksheetPlayer';

interface StudentWorksheetsTabProps {
  currentUser: UserProfile;
}

export const StudentWorksheetsTab: React.FC<StudentWorksheetsTabProps> = ({
  currentUser,
}) => {
  const [worksheets, setWorksheets] = useState<InteractiveWorksheet[]>([]);
  const [submissions, setSubmissions] = useState<WorksheetSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlayingWorksheetId, setActivePlayingWorksheetId] = useState<string | null>(null);

  const loadStudentWorksheets = async () => {
    setLoading(true);
    try {
      // جلب الأوراق المعينة لفصل الطالب أو مدرسته
      const allWorksheets = await fetchWorksheets({
        schoolId: currentUser.school_id,
        classId: currentUser.grade,
      });

      // جلب تسليمات الطالب السابقة لمعرفة درجاته وحالة الحل
      const mySubmissions = await fetchWorksheetSubmissions();
      const filteredMySubs = mySubmissions.filter(s => s.student_id === currentUser.id);

      setWorksheets(allWorksheets);
      setSubmissions(filteredMySubs);
    } catch (e) {
      console.error('Error fetching student worksheets:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentWorksheets();
  }, [currentUser.id, currentUser.grade]);

  // التحقق من حالة حل الورقة للطالب
  const getSubmissionForWorksheet = (wsId: string): WorksheetSubmission | undefined => {
    return submissions.find(s => s.worksheet_id === wsId);
  };

  // إذا كان الطالب يحل ورقة عمل حالياً
  if (activePlayingWorksheetId) {
    return (
      <WorksheetPlayer
        worksheetId={activePlayingWorksheetId}
        currentUser={currentUser}
        onClose={() => {
          setActivePlayingWorksheetId(null);
          loadStudentWorksheets();
        }}
        onCompleted={() => {
          loadStudentWorksheets();
        }}
      />
    );
  }

  // إحصائيات سريعة للطالب
  const solvedCount = worksheets.filter(w => Boolean(getSubmissionForWorksheet(w.id))).length;
  const pendingCount = worksheets.length - solvedCount;

  return (
    <div className="space-y-6" dir="rtl">
      {/* بطاقة الترحيب والإحصاءات */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg flex flex-wrap items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold mb-3">
            <span>📝</span>
            <span>أوراق العمل والواجبات التفاعلية</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mb-2">
            حل أوراق العمل واحصل على تصحيح فوري ودرجاتك مباشرة!
          </h2>
          <p className="text-xs sm:text-sm text-blue-100 max-w-lg">
            الأوراق المدرسية المعينة لفصلك الدراسي متاحة هنا للحل الذاتي مع تقييم ذكي فوري لكل سؤال.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
          <div className="text-center px-3 border-l border-white/20">
            <span className="text-2xl font-black block">{solvedCount}</span>
            <span className="text-[11px] text-blue-100 font-semibold">أوراق مكتملة</span>
          </div>
          <div className="text-center px-3">
            <span className="text-2xl font-black block text-amber-300">{pendingCount}</span>
            <span className="text-[11px] text-blue-100 font-semibold">بانتظار الحل</span>
          </div>
        </div>
      </div>

      {/* قائمة أوراق العمل */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-bold text-slate-900 text-base mb-6 flex items-center gap-2">
          <span>📋</span>
          <span>أوراق عمل فصلي الدراسي ({worksheets.length})</span>
        </h3>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 font-medium">جارِ تحميل أوراق العمل...</p>
          </div>
        ) : worksheets.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <div className="text-5xl mb-3">🎉</div>
            <h4 className="text-sm font-bold text-slate-700">لا توجد أوراق عمل جديدة حالياً</h4>
            <p className="text-xs text-slate-500 mt-1">
              رائع! لقد أنجزت جميع المهام، أو لم يعين معلمك أوراق عمل جديدة بعد.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {worksheets.map((ws) => {
              const sub = getSubmissionForWorksheet(ws.id);
              const isSolved = Boolean(sub);

              return (
                <div
                  key={ws.id}
                  className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    {/* صورة الورقة وحالة الإنجاز */}
                    <div className="relative h-44 bg-slate-200 overflow-hidden group">
                      <img
                        src={ws.image_url || ws.background_url}
                        alt={ws.title}
                        className="w-full h-full object-cover object-top transition duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent flex items-end justify-between p-3">
                        <span className="text-[11px] font-bold text-white bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                          {ws.elements.length} أسئلة
                        </span>

                        {isSolved ? (
                          <span className="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow">
                            ✓ تم الحل ({sub?.percentage}%)
                          </span>
                        ) : (
                          <span className="bg-amber-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow">
                            ⏳ بانتظار الحل
                          </span>
                        )}
                      </div>
                    </div>

                    {/* معلومات الورقة */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-500">
                          الدرجة الكلية: {ws.total_points || 20}
                        </span>
                        {isSolved && sub && (
                          <span className="font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            درجتك: {sub.score} / {sub.total_score}
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm line-clamp-1">
                        {ws.title}
                      </h4>

                      {ws.description && (
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {ws.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* زر الإجراء */}
                  <div className="p-4 pt-2 border-t border-slate-200/80 bg-white">
                    <button
                      onClick={() => setActivePlayingWorksheetId(ws.id)}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition ${
                        isSolved
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                      }`}
                    >
                      <span>{isSolved ? '👁️ مراجعة إجاباتي والدرجة' : '🚀 ابدأ الحل الآن'}</span>
                    </button>
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
