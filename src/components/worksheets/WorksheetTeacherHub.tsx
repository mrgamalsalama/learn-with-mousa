import React, { useState, useEffect } from 'react';
import { 
  InteractiveWorksheet, 
  WorksheetSubmission, 
  UserProfile, 
  GradeLevel, 
  STAGES_CONFIG 
} from '../../types';
import { 
  fetchWorksheets, 
  deleteWorksheet, 
  fetchWorksheetSubmissions 
} from '../../services/worksheetService';
import { WorksheetEditor } from './WorksheetEditor';
import { WorksheetSubmissions } from './WorksheetSubmissions';
import { WorksheetPlayer } from './WorksheetPlayer';

interface WorksheetTeacherHubProps {
  currentUser: UserProfile;
}

export const WorksheetTeacherHub: React.FC<WorksheetTeacherHubProps> = ({
  currentUser,
}) => {
  const [worksheets, setWorksheets] = useState<InteractiveWorksheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'create' | 'edit' | 'submissions' | 'preview'>('list');
  const [selectedWorksheet, setSelectedWorksheet] = useState<InteractiveWorksheet | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await fetchWorksheets({
        schoolId: currentUser.school_id,
        teacherId: currentUser.id,
      });
      setWorksheets(list);
    } catch (e) {
      console.error('Error fetching teacher worksheets:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser.id, currentUser.school_id]);

  const handleDelete = async (wsId: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف ورقة العمل هذه؟')) return;
    await deleteWorksheet(wsId);
    showToast('تم حذف ورقة العمل بنجاح');
    loadData();
  };

  const handleCopyLink = (wsId: string) => {
    const link = `${window.location.origin}/worksheets/play/${wsId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(wsId);
    showToast('تم نسخ الرابط العام بنجاح للمشاركة مع الطلاب!');
    setTimeout(() => setCopiedId(null), 2500);
  };

  // عرض محرر أوراق العمل
  if (mode === 'create' || mode === 'edit') {
    return (
      <WorksheetEditor
        currentUser={currentUser}
        initialWorksheet={mode === 'edit' ? selectedWorksheet : null}
        onCancel={() => {
          setMode('list');
          setSelectedWorksheet(null);
          loadData();
        }}
        onSave={() => {
          setMode('list');
          setSelectedWorksheet(null);
          loadData();
        }}
        onOpenPlayer={(id) => {
          const found = worksheets.find(w => w.id === id);
          setSelectedWorksheet(found || null);
          setMode('preview');
        }}
      />
    );
  }

  // عرض لوحة رصد النتائج
  if (mode === 'submissions' && selectedWorksheet) {
    return (
      <WorksheetSubmissions
        worksheetId={selectedWorksheet.id}
        initialWorksheet={selectedWorksheet}
        currentUser={currentUser}
        onBack={() => {
          setMode('list');
          setSelectedWorksheet(null);
        }}
      />
    );
  }

  // عرض تجربة حل الورقة كطالب
  if (mode === 'preview' && selectedWorksheet) {
    return (
      <WorksheetPlayer
        worksheetId={selectedWorksheet.id}
        currentUser={currentUser}
        onClose={() => {
          setMode('list');
          setSelectedWorksheet(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* إشعار سريع Toast */}
      {toastMsg && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in">
          <span className="text-emerald-400 font-bold">✓</span>
          <span className="text-xs font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* الشريط التعريفي وزر الإنشاء */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg flex flex-wrap items-center justify-between gap-6">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold mb-3">
            <span>✨</span>
            <span>أوراق العمل التفاعلية المدرسية (TopWorksheets Hub)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mb-2">
            حوّل أي ورقة عمل ورقية إلى نشاط تفاعلي ذاتي التصحيح
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
            ارفع صورة ورقة العمل، وارسم حقول ملء الفراغات أو الاختيارات المتعددة بنظام السحب فوق الورقة، ثم انشرها لطلاب فصلك أو شاركها كرابط عام مباشر.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedWorksheet(null);
            setMode('create');
          }}
          className="px-6 py-3.5 bg-white text-emerald-800 hover:bg-emerald-50 active:scale-95 text-sm font-extrabold rounded-2xl shadow-xl flex items-center gap-2 transition"
        >
          <span className="text-xl">➕</span>
          <span>إنشاء ورقة عمل جديدة</span>
        </button>
      </div>

      {/* قائمة أوراق العمل المنشأة */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <h3 className="font-bold text-slate-900 text-base">
              أوراق العمل الخاصة بي ({worksheets.length})
            </h3>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 font-medium">جارِ تحميل أوراق العمل التفاعلية...</p>
          </div>
        ) : worksheets.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <div className="text-5xl mb-3">📄</div>
            <h4 className="text-sm font-bold text-slate-700">لا توجد أوراق عمل منشأة حتى الآن</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4">
              ابدأ الآن بإنشاء أول ورقة عمل تفاعلية وسيقوم النظام بتصحيحها ورصد الدرجات لك تلقائياً!
            </p>
            <button
              onClick={() => {
                setSelectedWorksheet(null);
                setMode('create');
              }}
              className="px-5 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition"
            >
              + إنشاء أول ورقة عمل
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {worksheets.map((ws) => (
              <div
                key={ws.id}
                className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  {/* مصغرة الورقة */}
                  <div className="relative h-44 bg-slate-200 overflow-hidden group">
                    <img
                      src={ws.image_url || ws.background_url}
                      alt={ws.title}
                      className="w-full h-full object-cover object-top transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent flex items-end p-3">
                      <span className="text-[11px] font-bold text-white bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                        {ws.elements.length} حقول تفاعلية • {ws.total_points || 20} درجة
                      </span>
                    </div>
                  </div>

                  {/* تفاصيل الورقة */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                        {ws.grade_level ? `الصف: ${ws.grade_level}` : 'عام'}
                      </span>
                      {ws.is_public && (
                        <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
                          رابط عام نشط 🌐
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

                {/* أزرار الإجراءات للورقة */}
                <div className="p-4 pt-2 border-t border-slate-200/80 bg-white space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setSelectedWorksheet(ws);
                        setMode('submissions');
                      }}
                      className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1"
                    >
                      <span>📊</span>
                      <span>رصد النتائج</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedWorksheet(ws);
                        setMode('preview');
                      }}
                      className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1"
                    >
                      <span>👁️</span>
                      <span>معاينة وحل</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                    <button
                      onClick={() => handleCopyLink(ws.id)}
                      className={`flex-1 py-1.5 rounded-lg font-bold transition text-[11px] flex items-center justify-center gap-1 ${
                        copiedId === ws.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span>🔗</span>
                      <span>{copiedId === ws.id ? 'تم نسخ الرابط!' : 'نسخ الرابط العام'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedWorksheet(ws);
                        setMode('edit');
                      }}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                      title="تعديل الورقة"
                    >
                      ✏️
                    </button>

                    <button
                      onClick={() => handleDelete(ws.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                      title="حذف"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
