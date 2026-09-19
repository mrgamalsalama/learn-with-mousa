import React, { useState, useEffect } from 'react';
import { 
  X, Brain, Sparkles, CheckCircle2, AlertTriangle, 
  TrendingUp, Award, Printer, RefreshCw, BookOpen, 
  Target, ShieldCheck, HeartHandshake, FileText, ShieldAlert
} from 'lucide-react';
import { DiagnosticReport, StudentSubmission, ChildPhonicsRecord } from '../types';
import { generateDiagnosticAnalytics } from '../geminiService';
import { getStudentPhonicsRecords, canUserUseAI, getCurrentUser, isAIFeatureAllowed } from '../storage';
import { PrintableWorksheetModal } from './PrintableWorksheetModal';

interface DiagnosticReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  studentId: string;
  submissions: StudentSubmission[];
}

export const DiagnosticReportModal: React.FC<DiagnosticReportModalProps> = ({
  isOpen,
  onClose,
  studentName,
  studentId,
  submissions,
}) => {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [phonicsRecords, setPhonicsRecords] = useState<ChildPhonicsRecord[]>([]);
  const [isWorksheetOpen, setIsWorksheetOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentUser = getCurrentUser();
  const userPerm = canUserUseAI(currentUser);
  const isAIPermitted = userPerm.overrideStatus === 'inherit' 
    ? (isAIFeatureAllowed(currentUser?.role === 'parent' ? 'parent' : 'teacher').allowed)
    : userPerm.allowed;
  const aiBlockReason = userPerm.reason || isAIFeatureAllowed(currentUser?.role === 'parent' ? 'parent' : 'teacher').reason;

  const loadDataAndAnalyze = async () => {
    if (!isAIPermitted) {
      setErrorMessage(aiBlockReason || 'ميزات الذكاء الاصطناعي معطلة عن حسابك.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const records = getStudentPhonicsRecords(studentId);
      setPhonicsRecords(records);

      const generated = await generateDiagnosticAnalytics(
        studentName,
        submissions,
        records
      );
      setReport(generated);
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e?.message || 'تعذر استخراج التقرير التشخيصي بالذكاء الاصطناعي.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (isAIPermitted) {
        loadDataAndAnalyze();
      } else {
        const records = getStudentPhonicsRecords(studentId);
        setPhonicsRecords(records);
        setErrorMessage(aiBlockReason || 'ميزات الذكاء الاصطناعي معطلة عن حسابك.');
      }
    }
  }, [isOpen, studentId]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in">
        <div 
          id="diagnostic-report-modal"
          className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-emerald-200 shadow-2xl overflow-hidden"
          dir="rtl"
        >
          {/* الترويسة */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-emerald-950 p-4 sm:p-5 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-950 font-black flex items-center justify-center shadow-md text-2xl">
                🧠
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base sm:text-lg">التَّقْرِيرُ التَّشْخِيصِيُّ لِلنُّطْقِ وَالتَّقَدُّم</h3>
                  <span className="px-2 py-0.5 bg-emerald-500/80 rounded-full text-[10px] font-bold">
                    Gemini Diagnostic AI
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  تَحْلِيلٌ تَرْبَوِيٌّ ذَكِيٌّ لِمُسْتَوَى الطَّالِبِ ({studentName}) فِي الحُرُوفِ وَالأَصْوَات
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadDataAndAnalyze}
                disabled={isLoading || !isAIPermitted}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition disabled:opacity-50"
                title={!isAIPermitted ? aiBlockReason : "تحديث التحليل"}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* محتوى التقرير التشخيصي */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/60">
            {!isAIPermitted && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <span className="font-bold block">ميزات الذكاء الاصطناعي معطلة عن حسابك</span>
                  <span className="text-[11px] text-rose-600">{aiBlockReason}</span>
                </div>
              </div>
            )}

            {errorMessage && isAIPermitted && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2 text-amber-900 text-xs font-bold">
                <span>⚠️ {errorMessage}</span>
              </div>
            )}

            {isLoading && (
              <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto animate-spin">
                  <Brain className="w-7 h-7" />
                </div>
                <h4 className="font-extrabold text-sm text-slate-800">
                  جَارٍ تَحْلِيلُ سِجِلَّاتِ النُّطْقِ وَالمُحَاوَلَاتِ عَبْرَ Gemini... 📊
                </h4>
                <p className="text-xs text-slate-500">
                  تَقْيِيمُ مَخَارِجِ الأَصْوَاتِ وَتَحْدِيدُ الحُرُوفِ المَسْتَهْدَفَةِ بِالتَّعْزِيز
                </p>
              </div>
            )}

            {!isLoading && report && (
              <>
                {/* مقاييس الأداء الرئيسية */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Target className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-500">دقة التمييز الصوتي</span>
                      <p className="text-xl font-black text-emerald-700">{report.overallAccuracy}%</p>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-teal-200 shadow-xs flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-500">معدل التفاعل والنشاط</span>
                      <p className="text-xl font-black text-teal-700">{report.engagementRate}%</p>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-500">الحروف المكتسبة</span>
                      <p className="text-xl font-black text-amber-700">{report.masteredLetters.length} حُرُوف</p>
                    </div>
                  </div>
                </div>

                {/* تصنيف الحروف: المتقنة والضعيفة */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* الحروف المتقنة */}
                  <div className="bg-white p-4 sm:p-5 rounded-3xl border border-emerald-200 shadow-xs space-y-3">
                    <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm border-b border-slate-100 pb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>الحُرُوفُ المُتْقَنَةُ (نِقَاطُ القُوَّة)</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {report.masteredLetters.map((ltr) => (
                        <div
                          key={ltr}
                          className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>حرف ({ltr})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* الحروف المحتاجة لتدريب */}
                  <div className="bg-white p-4 sm:p-5 rounded-3xl border border-rose-200 shadow-xs space-y-3">
                    <div className="flex items-center gap-2 text-rose-800 font-extrabold text-sm border-b border-slate-100 pb-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      <span>حُرُوفٌ تَحْتَاجُ تَدْرِيبًا إِضَافِيًّا</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {report.needsPracticeLetters.map((ltr) => (
                        <div
                          key={ltr}
                          className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs"
                        >
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          <span>حرف ({ltr})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* التوصية والملاحظات التربوية */}
                <div className="bg-gradient-to-br from-indigo-50/60 to-purple-50/60 p-5 rounded-3xl border border-indigo-200 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-sm">
                    <HeartHandshake className="w-5 h-5 text-indigo-600" />
                    <span>المُلَاحَظَاتُ التَّرْبَوِيَّةُ لِلْمُعَلِّمِ وَوَلِيِّ الأَمْر</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium bg-white/80 p-4 rounded-2xl border border-indigo-100">
                    {report.teacherPedagogicalNotes}
                  </p>
                </div>

                {/* الخطوات العلاجية المقترحة */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <h4 className="font-extrabold text-xs text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>خُطُوَاتُ التَّعْزِيزِ المَنْزِلِيِّ المُقْتَرَحَة:</span>
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-700 font-medium">
                    {report.recommendedNextSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* إجراء التحويل لورقة عمل مطبوعة */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-5 rounded-3xl text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-emerald-200">
                  <div>
                    <h4 className="font-black text-sm sm:text-base">
                      هَلْ تَرْغَبُ فِي وَرَقَةِ عَمَلٍ عِلَاجِيَّةٍ لِهَذِهِ الحُرُوف؟
                    </h4>
                    <p className="text-xs text-emerald-100 mt-1">
                      يَقُومُ الذَّكَاءُ الاصْطِنَاعِيُّ بِتَوْلِيدِ نَمُوذَجٍ جَاهِزٍ لِلطِّبَاعَةِ المَنْزِلِيَّةِ فَوْرًا.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsWorksheetOpen(true)}
                    className="px-5 py-3 bg-amber-400 hover:bg-amber-300 text-slate-900 font-black rounded-2xl text-xs transition shadow-md flex items-center gap-2 shrink-0 transform active:scale-95"
                  >
                    <Printer className="w-4 h-4" />
                    <span>تَوْلِيدُ وَرَقَةِ العَمَلِ وَطِبَاعَتُهَا 🖨️</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* نافذة ورقة العمل المطبوعة */}
      {isWorksheetOpen && (
        <PrintableWorksheetModal
          isOpen={isWorksheetOpen}
          onClose={() => setIsWorksheetOpen(false)}
          studentName={studentName}
          weakLetters={report?.needsPracticeLetters || ['ص', 'ض', 'ط']}
        />
      )}
    </>
  );
};
