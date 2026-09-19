import React, { useState, useEffect } from 'react';
import { 
  X, BarChart3, Sparkles, CheckCircle2, AlertTriangle, 
  TrendingUp, RefreshCw, Printer, BookOpen, 
  Users, Target, Award, ArrowUpRight, ShieldAlert
} from 'lucide-react';
import { StudentSubmission, ClassDiagnosticSummary } from '../types';
import { generateClassDiagnosticSummary } from '../geminiService';
import { canUserUseAI, getCurrentUser, isAIFeatureAllowed } from '../storage';

interface ClassDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissions: StudentSubmission[];
  teacherName: string;
  activityTitle?: string;
}

export const ClassDiagnosticModal: React.FC<ClassDiagnosticModalProps> = ({
  isOpen,
  onClose,
  submissions,
  teacherName,
  activityTitle,
}) => {
  const [summary, setSummary] = useState<ClassDiagnosticSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentUser = getCurrentUser();
  const userPerm = canUserUseAI(currentUser);
  const isAIPermitted = userPerm.overrideStatus === 'inherit' 
    ? isAIFeatureAllowed('teacher').allowed 
    : userPerm.allowed;
  const aiBlockReason = userPerm.reason || isAIFeatureAllowed('teacher').reason;

  const runClassAnalysis = async () => {
    if (!isAIPermitted) {
      setErrorMessage(aiBlockReason || 'ميزات الذكاء الاصطناعي معطلة عن حسابك.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await generateClassDiagnosticSummary(submissions, activityTitle);
      setSummary(result);
    } catch (err: any) {
      console.error('Error generating class diagnostic summary:', err);
      setErrorMessage(err?.message || 'تعذر استخراج تقرير التحليل التراكمي للفصل.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (isAIPermitted) {
        runClassAnalysis();
      } else {
        setErrorMessage(aiBlockReason || 'ميزات الذكاء الاصطناعي معطلة عن حسابك.');
      }
    }
  }, [isOpen, submissions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* شريط الرأس */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 text-white p-5 sm:p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-white shadow-inner">
              <BarChart3 className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg">
                  تقرير الفاقد التعليمي والتحليل التراكمي للفصل
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/30 text-[10px] font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Gemini 2.5 Flash
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                تحليل لغوي وإحصائي ذكي لمستوى الفصل | المعلم: <b className="text-white">{teacherName}</b>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => runClassAnalysis()}
              disabled={isLoading || !isAIPermitted}
              title={!isAIPermitted ? aiBlockReason : "إعادة التحليل الذكي"}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              title="طباعة التقرير"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition hidden sm:flex items-center gap-1 text-xs font-bold"
            >
              <Printer className="w-4 h-4" /> طباعة
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/80 text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* محتوى التقرير */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-slate-800">
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

          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                <Sparkles className="w-6 h-6 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-slate-800">جاري تحليل بيانات الفصل اللغوية...</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  يقوم الذكاء الاصطناعي برصد مواطن القوة والضعف واستخراج التوصيات العلاجية وفق مستويات بلوم.
                </p>
              </div>
            </div>
          ) : summary ? (
            <>
              {/* بطاقات الإحصاءات العلوية */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-700">نسبة الإتقان العامة</span>
                    <div className="text-2xl font-black text-indigo-950 mt-1">
                      {summary.overallMasteryRate}%
                    </div>
                    <span className="text-[10px] text-indigo-500 font-medium">
                      {summary.overallMasteryRate >= 80 ? 'مستوى متقدم ممتاز' : summary.overallMasteryRate >= 65 ? 'مستوى متوسط مستقر' : 'يتطلب تدخلاً علاجياً'}
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-600/20">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-emerald-700">متوسط درجات الطلاب</span>
                    <div className="text-2xl font-black text-emerald-950 mt-1">
                      {summary.averageScore} <span className="text-xs font-bold text-slate-400">/ {summary.totalPoints || 20}</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-medium">متوسط أداء الفصل</span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-emerald-600/20">
                    <Award className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-blue-700">تسليمات الطلاب المعتمدة</span>
                    <div className="text-2xl font-black text-blue-950 mt-1">
                      {summary.totalSubmissions}
                    </div>
                    <span className="text-[10px] text-blue-500 font-medium">طالب شملهم التقييم</span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-blue-600/20">
                    <Users className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-rose-700">الطلاب ذوو الأولوية العلاجية</span>
                    <div className="text-2xl font-black text-rose-950 mt-1">
                      {summary.studentsNeedingRemediation.length}
                    </div>
                    <span className="text-[10px] text-rose-500 font-medium">أقل من 65% إتقان</span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-rose-600/20">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* قسم مفاهيم الفاقد التعليمي الأكثر تعثراً */}
              <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80">
                <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-rose-600" />
                  مفاهيم الفاقد التعليمي والظواهر الأكثر تعثراً بالفصل
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {summary.strugglingConcepts.map((concept, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white rounded-xl border border-rose-100 shadow-2xs flex items-start gap-2.5 text-xs text-slate-700"
                    >
                      <span className="w-5 h-5 rounded-lg bg-rose-50 text-rose-600 font-extrabold text-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-rose-200">
                        {idx + 1}
                      </span>
                      <span className="font-semibold leading-relaxed">{concept}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* الأسئلة الأكثر صعوبة ونسب الخطأ */}
              {summary.difficultQuestions && summary.difficultQuestions.length > 0 && (
                <div className="bg-white rounded-2xl p-5 border border-slate-200">
                  <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-amber-600" />
                    تحليل الأسئلة ذات أعلى نسب خطأ (مستويات بلوم)
                  </h4>
                  <div className="space-y-3">
                    {summary.difficultQuestions.map((q, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-200/70">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            {q.questionText}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-200/60 text-amber-900 text-[10px] font-extrabold shrink-0">
                            نسبة الخطأ: {q.mistakeRate}%
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          💡 <b className="text-slate-700">التشخيص التربوي:</b> {q.note}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* الطلاب المحتاجون لخطة علاجية عاجلة */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    قائمة الطلاب الموصى بإشراكهم في خطة علاجية عاجلة
                  </h4>
                  <span className="text-xs text-slate-400 font-medium">
                    (مستهدف برامج التعزيز والدعم)
                  </span>
                </div>

                {summary.studentsNeedingRemediation.length === 0 ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs text-center font-bold">
                    🎉 ممتاز! جميع طلاب الفصل حققوا نسبة إتقان أعلى من 65%.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400">
                          <th className="pb-2 font-semibold">اسم الطالب</th>
                          <th className="pb-2 font-semibold">الدرجة</th>
                          <th className="pb-2 font-semibold">نسبة الإتقان</th>
                          <th className="pb-2 font-semibold">المجال العلاجي الموصى به</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {summary.studentsNeedingRemediation.map((st, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 font-bold text-slate-800">{st.studentName}</td>
                            <td className="py-2.5 font-bold text-rose-600">
                              {st.score} / {st.totalPoints}
                            </td>
                            <td className="py-2.5">
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                                {st.percentage}%
                              </span>
                            </td>
                            <td className="py-2.5 text-slate-600 font-medium">
                              {st.remedialFocus}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* التوصيات الإجرائية والتدريسية المباشرة للمعلم */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-5 border border-indigo-100">
                <h4 className="font-extrabold text-sm text-indigo-950 flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  التوصيات الإجرائية والتدريسية لتدارك الفاقد التعليمي
                </h4>
                <div className="space-y-2.5">
                  {summary.actionableRecommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-indigo-900 bg-white/70 p-2.5 rounded-xl border border-indigo-100">
                      <ArrowUpRight className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <span className="font-medium leading-relaxed">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* تذييل التقرير */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
                <span>تاريخ إصدار التقرير: {summary.generatedAt}</span>
                <span>منصة «تعلَّم مع موسى» | منظومة التشخيص اللغوي الذكي</span>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              لم يتم استرجاع أي بيانات للتقرير. يرجى المحاولة مجدداً.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
