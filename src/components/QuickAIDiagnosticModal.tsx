import React, { useState, useEffect } from 'react';
import { 
  X, Sparkles, Volume2, VolumeX, Copy, Check, 
  Gamepad2, Clock, Award, AlertCircle, RefreshCw, Send, Share2 
} from 'lucide-react';
import { StudentSubmission, QuickAIDiagnosticResult } from '../types';
import { generateStudentDiagnostic, speakWithMousaVoice, stopMousaVoice } from '../geminiService';
import { MousaSpeakingAvatar } from './AudioInteractionVisualizer';

interface QuickAIDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  studentId: string;
  submissions: StudentSubmission[];
  onLaunchRecommendedGame?: (gameType: string) => void;
}

export const QuickAIDiagnosticModal: React.FC<QuickAIDiagnosticModalProps> = ({
  isOpen,
  onClose,
  studentName,
  studentId,
  submissions,
  onLaunchRecommendedGame
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState<QuickAIDiagnosticResult | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      handleGenerate();
    } else {
      stopMousaVoice();
      setIsSpeaking(false);
    }
  }, [isOpen, studentId]);

  const handleGenerate = async () => {
    stopMousaVoice();
    setIsSpeaking(false);
    setIsLoading(true);
    setDiagnostic(null);

    // تصفية تسليمات هذا الطالب
    const studentSubs = submissions.filter(s => s.studentId === studentId || s.studentName === studentName);

    try {
      const res = await generateStudentDiagnostic(studentSubs, studentName);
      setDiagnostic(res);
    } catch (err) {
      console.error('Error generating quick diagnostic:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSpeak = () => {
    if (isSpeaking) {
      stopMousaVoice();
      setIsSpeaking(false);
      return;
    }

    if (!diagnostic?.reportText) return;
    setIsSpeaking(true);
    speakWithMousaVoice(diagnostic.reportText, () => {
      setIsSpeaking(false);
    });
  };

  const copyReport = () => {
    if (!diagnostic) return;
    const textToCopy = `📋 *التقرير التشخيصي الفوري للطالب: ${studentName}*\n\n` +
      `✨ *التحليل التربوي:* ${diagnostic.reportText}\n\n` +
      `🌟 *نقاط القوة:* ${diagnostic.strengths}\n` +
      `🎯 *التحدي اللغوي:* ${diagnostic.challenge}\n` +
      `🎮 *التوصية العلاجية:* جولة مدتها (${diagnostic.recommendation.suggestedDuration}) في (${diagnostic.recommendation.gameTitleAr})\n\n` +
      `— تم التوليد عبر مستشار الذكاء الاصطناعي في منصة "تعلَّم مع موسى" 🌟`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareViaWhatsApp = () => {
    if (!diagnostic) return;
    const msg = `📋 *تقرير المتابعة الذكي للبطل: ${studentName}* 🌟\n\n` +
      `✨ ${diagnostic.reportText}\n\n` +
      `🌟 *نقاط القوة المكتسبة:* ${diagnostic.strengths}\n` +
      `🎯 *مجال التطوير:* ${diagnostic.challenge}\n` +
      `🎮 *التوصية:* ${diagnostic.recommendation.gameTitleAr} (${diagnostic.recommendation.suggestedDuration})\n\n` +
      `— منصة "تعلَّم مع موسى" لتعليم العربية الفصحى 📚`;

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in">
      <div 
        id="quick-ai-diagnostic-modal"
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col border border-emerald-200 shadow-2xl overflow-hidden"
        dir="rtl"
      >
        {/* الترويسة */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-4 sm:p-5 text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <MousaSpeakingAvatar
              src="/mousa-avatar.png"
              isSpeaking={isSpeaking}
              size="md"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-base sm:text-lg">
                  التقرير التشخيصي الفوري الذكي ⚡
                </h3>
                <span className="px-2 py-0.5 bg-amber-400 text-amber-950 rounded-full text-[10px] font-black">
                  1-Click AI Diagnostic
                </span>
              </div>
              <p className="text-xs text-emerald-100">
                تحليل تربوي دقيق مستند إلى آخر تسليمات البطل ({studentName})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopMousaVoice();
              onClose();
            }}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* محتوى التقرير */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isLoading ? (
            <div className="py-14 text-center space-y-4">
              <div className="relative inline-flex">
                <span className="w-14 h-14 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
                <Sparkles className="w-6 h-6 text-amber-500 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-base text-slate-800">
                  مستشار موسى التربوي يحلل آخر تسليمات ({studentName})...
                </h4>
                <p className="text-xs text-slate-500">
                  فحص دقة النطق، الظواهر الإملائية، وتحديد أنسب خطة علاجية مخصصة 🎯
                </p>
              </div>
            </div>
          ) : diagnostic ? (
            <div className="space-y-4">
              {/* بطاقة التحليل التربوي الموجز المشكول */}
              <div className="relative p-5 rounded-3xl bg-gradient-to-br from-emerald-50 via-teal-50/50 to-amber-50/30 border border-emerald-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded-full text-xs font-black shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" /> خلاصة التشخيص التربوي المعتمد
                  </span>
                  <span className="text-[11px] text-slate-400 font-bold">
                    {diagnostic.generatedAt}
                  </span>
                </div>

                <blockquote className="text-base sm:text-lg font-bold text-slate-800 leading-relaxed py-2 font-arabic selection:bg-amber-200">
                  «{diagnostic.reportText}»
                </blockquote>

                {/* أزرار الاستماع الصوتي والنسخ */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-emerald-100">
                  <button
                    type="button"
                    onClick={toggleSpeak}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
                      isSpeaking
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}
                  >
                    {isSpeaking ? (
                      <>
                        <VolumeX className="w-4 h-4" />
                        <span>إيقاف الصوت</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 text-emerald-600" />
                        <span>استمع للتقرير بصوت موسى 🔊</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={copyReport}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition shadow-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>نسخ التقرير</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={shareViaWhatsApp}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs mr-auto"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>مشاركة للأسرة عبر واتساب</span>
                  </button>
                </div>
              </div>

              {/* بطاقتا نقاط القوة والتحديات */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* نقاط القوة */}
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="p-1.5 bg-emerald-200/80 rounded-lg text-emerald-800 text-sm">
                      🌟
                    </span>
                    <h5 className="font-extrabold text-xs text-emerald-950">
                      نقاط القوة والإتقان المكتسبة
                    </h5>
                  </div>
                  <p className="text-xs text-emerald-900 font-medium leading-relaxed">
                    {diagnostic.strengths}
                  </p>
                </div>

                {/* التحدي الذي يحتاج تعزيزاً */}
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="p-1.5 bg-amber-200/80 rounded-lg text-amber-800 text-sm">
                      🎯
                    </span>
                    <h5 className="font-extrabold text-xs text-amber-950">
                      التحدي الصوتي / الإملائي المستهدف
                    </h5>
                  </div>
                  <p className="text-xs text-amber-900 font-medium leading-relaxed">
                    {diagnostic.challenge}
                  </p>
                </div>
              </div>

              {/* التوصية العلاجية المباشرة بلعبة محددة */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-2 border-orange-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-xs font-black text-orange-800">
                    <Gamepad2 className="w-4 h-4 text-orange-600" /> التوصية التربوية العلاجية المقترحة
                  </div>
                  <h4 className="font-black text-base text-orange-950">
                    {diagnostic.recommendation.gameTitleAr}
                  </h4>
                  <p className="text-xs text-slate-600">
                    {diagnostic.recommendation.rationale}
                  </p>
                  <div className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-700 mt-1">
                    <Clock className="w-3.5 h-3.5" /> المدة الموصى بها: <span className="bg-orange-200/80 px-2 py-0.5 rounded-md font-black">{diagnostic.recommendation.suggestedDuration}</span>
                  </div>
                </div>

                {onLaunchRecommendedGame && (
                  <button
                    type="button"
                    onClick={() => {
                      stopMousaVoice();
                      onClose();
                      onLaunchRecommendedGame(diagnostic.recommendation.gameType);
                    }}
                    className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-orange-300 transition flex items-center justify-center gap-2 shrink-0 transform active:scale-95"
                  >
                    <Sparkles className="w-4 h-4 text-yellow-200" />
                    <span>خوض الجولة المقترحة الآن 🚀</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400">
              <p className="text-sm font-bold text-slate-600">تعذر عرض التقرير التشخيصي</p>
              <button
                type="button"
                onClick={handleGenerate}
                className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
              >
                إعادة المحاولة
              </button>
            </div>
          )}
        </div>

        {/* ذيل النافذة */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث التقرير</span>
          </button>

          <span className="text-[11px] text-slate-400">
            مدعوم بنماذج Gemini المخصصة للأطفال 🌟
          </span>
        </div>
      </div>
    </div>
  );
};
