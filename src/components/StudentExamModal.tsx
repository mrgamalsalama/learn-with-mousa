import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, AlertTriangle, ShieldAlert, CheckCircle2, XCircle, 
  Volume2, VolumeX, ArrowRight, ArrowLeft, Send, Sparkles, Award, 
  HelpCircle, Eye, RefreshCw, X, Check, CalendarClock, Lock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Exam, ExamQuestion, ExamSession, UserProfile } from '../types';
import { 
  saveExamSession, updateStudentExamSession, incrementTabSwitchCount, 
  syncExamSessionsFromCloud 
} from '../storage';
import { speakWithMousaVoice, stopMousaVoice } from '../geminiService';
import { getExamScheduleStatus, formatArabicDateTime, formatCountdown } from '../utils/examSchedule';

interface StudentExamModalProps {
  exam: Exam;
  currentUser: UserProfile;
  onClose: () => void;
  onExamSubmitted?: (session: ExamSession) => void;
}

export const StudentExamModal: React.FC<StudentExamModalProps> = ({
  exam,
  currentUser,
  onClose,
  onExamSubmitted
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [isForceStopped, setIsForceStopped] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [finalSession, setFinalSession] = useState<ExamSession | null>(null);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [isSpeakingQuestion, setIsSpeakingQuestion] = useState(false);

  // حساب وقت الاختبار بالثواني
  const initialDurationSeconds = (exam.duration_minutes || 0) * 60;
  const [timeLeft, setTimeLeft] = useState<number>(initialDurationSeconds);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // التحقق اللحظي من النافذة الزمنية المجدولة
  const [scheduleNow, setScheduleNow] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setScheduleNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const scheduleInfo = getExamScheduleStatus(exam, scheduleNow);

  // جلسة الاختبار في قاعدة البيانات
  const sessionIdRef = useRef<string>(`session_${exam.id}_${currentUser.id}_${Date.now()}`);
  const hasInitializedRef = useRef(false);

  // لوحة أزرار التشكيل المساعدة لحقل الإملاء
  const TASHKEEL_BUTTONS = ['َ', 'ً', 'ُ', 'ٌ', 'ِ', 'ٍ', 'ْ', 'ّ'];

  // إيقاف الصوت عند تبديل السؤال أو إغلاق المودال
  useEffect(() => {
    stopMousaVoice();
    setIsSpeakingQuestion(false);
  }, [currentQuestionIndex]);

  useEffect(() => {
    return () => {
      stopMousaVoice();
    };
  }, []);

  // 1. تهيئة جلسة الاختبار في Supabase والتخزين المحلي (فقط عند فتح الاختبار ومصادقة الوقت)
  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (exam.is_scheduled && scheduleInfo.status !== 'open') return;
    hasInitializedRef.current = true;

    const totalMarks = exam.questions.reduce((sum, q) => sum + (q.points || 5), 0);

    const initialSession: ExamSession = {
      id: sessionIdRef.current,
      exam_id: exam.id,
      student_id: currentUser.id,
      student_name: currentUser.name,
      status: 'in_progress',
      start_time: new Date().toISOString(),
      score: 0,
      total_marks: totalMarks,
      answers: {},
      tab_switch_count: 0
    };

    saveExamSession(initialSession);
  }, [exam, currentUser, scheduleInfo.status]);

  // فحص انتهاء نافذة الإتاحة المجدولة تلقائياً أثناء أداء الاختبار
  useEffect(() => {
    if (isSubmitted || isForceStopped || !exam.is_scheduled || !exam.scheduled_end) return;

    if (scheduleInfo.status === 'expired') {
      alert('انتهت فترة الإتاحة الزمنية المحددة للاختبار! سيتم تسليم إجاباتك الحالية تلقائياً.');
      handleAutoSubmitOnTimeOut();
    }
  }, [scheduleInfo.status, isSubmitted, isForceStopped, exam.is_scheduled, exam.scheduled_end]);

  // 2. العداد التنازلي للاختبار
  useEffect(() => {
    if (isSubmitted || isForceStopped) return;

    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);

      if (exam.duration_minutes > 0) {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            // انتهاء الوقت -> تسليم تلقائي فوري
            handleAutoSubmitOnTimeOut();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isSubmitted, isForceStopped, exam.duration_minutes]);

  // 3. دروع الأمان ومنع الغش (Anti-Cheat Protection)
  useEffect(() => {
    if (isSubmitted || isForceStopped) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleTriggerTabSwitch();
      }
    };

    const handleWindowBlur = () => {
      handleTriggerTabSwitch();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isSubmitted, isForceStopped]);

  // 4. مراقبة لحظية لحالة الجلسة (إذا قام المعلم بـ Force Stop)
  useEffect(() => {
    if (isSubmitted || isForceStopped) return;

    const checkStatusInterval = setInterval(async () => {
      const sessions = await syncExamSessionsFromCloud(exam.id);
      const mySession = sessions.find(s => s.id === sessionIdRef.current);
      if (mySession && mySession.status === 'force_stopped') {
        setIsForceStopped(true);
        clearInterval(checkStatusInterval);
      }
    }, 4000);

    return () => clearInterval(checkStatusInterval);
  }, [exam.id, isSubmitted, isForceStopped]);

  // تسجيل مغادرة الشاشة وإظهار التحذير
  const handleTriggerTabSwitch = async () => {
    if (isSubmitted || isForceStopped) return;

    const newCount = await incrementTabSwitchCount(sessionIdRef.current);
    setTabSwitchCount(newCount);
    setShowTabWarning(true);
  };

  // معالجة اختيار الإجابة
  const handleSelectAnswer = (questionId: string, answerText: string) => {
    const updated = { ...answers, [questionId]: answerText };
    setAnswers(updated);

    // تحديث الإجابات في الجلسة دورياً
    updateStudentExamSession(sessionIdRef.current, { answers: updated });
  };

  // إضافة حركة تشكيل إلى حقل الإملاء الحالي
  const handleInsertTashkeel = (char: string) => {
    const currentQ = exam.questions[currentQuestionIndex];
    const currentVal = answers[currentQ.id] || '';
    handleSelectAnswer(currentQ.id, currentVal + char);
  };

  // قراءة أو إيقاف السؤال يدوياً بصوت موسى
  const handleToggleSpeakCurrentQuestion = () => {
    if (isSpeakingQuestion) {
      stopMousaVoice();
      setIsSpeakingQuestion(false);
    } else {
      stopMousaVoice();
      const q = exam.questions[currentQuestionIndex];
      const textToSpeak = q.audioPromptText || q.text;
      setIsSpeakingQuestion(true);
      speakWithMousaVoice(textToSpeak, () => {
        setIsSpeakingQuestion(false);
      });
    }
  };

  // تسليم تلقائي عند نفاد الوقت
  const handleAutoSubmitOnTimeOut = () => {
    alert('⏰ انْتَهَى وَقْتُ الاخْتِبَارِ! سَيَتِمُّ تَسْلِيمُ إِجَابَاتِكَ آلِيّاً الآنَ.');
    executeSubmission();
  };

  // تنفيذ عملية التسليم وحساب الدرجة
  const executeSubmission = async () => {
    let calculatedScore = 0;
    const totalMarks = exam.questions.reduce((sum, q) => sum + (q.points || 5), 0);

    exam.questions.forEach(q => {
      const studentAns = (answers[q.id] || '').trim();
      const correctAns = (q.correctAnswer || '').trim();

      if (studentAns === correctAns) {
        calculatedScore += (q.points || 5);
      }
    });

    const finishedSession: ExamSession = {
      id: sessionIdRef.current,
      exam_id: exam.id,
      student_id: currentUser.id,
      student_name: currentUser.name,
      status: 'submitted',
      start_time: new Date(Date.now() - elapsedTime * 1000).toISOString(),
      end_time: new Date().toISOString(),
      score: calculatedScore,
      total_marks: totalMarks,
      answers,
      tab_switch_count: tabSwitchCount
    };

    await saveExamSession(finishedSession);
    setFinalSession(finishedSession);
    setIsSubmitted(true);
    setShowConfirmSubmit(false);

    if (exam.show_results_immediately) {
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}
    }

    if (onExamSubmitted) {
      onExamSubmitted(finishedSession);
    }
  };

  // تنسيق الوقت بالدقائق والثواني
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQ = exam.questions[currentQuestionIndex];
  const totalQuestions = exam.questions.length;
  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round(((currentQuestionIndex + 1) / totalQuestions) * 100);

  // ===================== حالة إيقاف الجلسة عن الطالب (Force Stopped) =====================
  if (isForceStopped) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" dir="rtl">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border-4 border-rose-500 animate-in fade-in zoom-in duration-200">
          <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <XCircle className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-black text-slate-900">تم إيقاف جلسة الاختبار</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            عذراً يا بطل، لقد تم إيقاف جلسة الاختبار الخاصة بك من قِبل المعلم المشرف. يرجى التواصل مع معلمك لمراجعة الجلسة.
          </p>
          <div className="bg-rose-50 rounded-2xl p-3 border border-rose-200 text-[11px] text-rose-800 font-bold">
            عدد مرات مغادرة التبويب المرصودة: {tabSwitchCount} مرات
          </div>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-slate-800 transition"
          >
            العودة إلى المنصة
          </button>
        </div>
      </div>
    );
  }

  // ===================== حالة الاختبار المجدول مسبقاً ولم يبدأ بعد (Upcoming) =====================
  if (!isSubmitted && exam.is_scheduled && scheduleInfo.status === 'upcoming') {
    const countdown = formatCountdown(exam.scheduled_start || '', scheduleNow);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" dir="rtl">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 text-center space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-md shadow-amber-500/10">
            <CalendarClock className="w-8 h-8" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 inline-flex items-center gap-1">
              <Lock className="w-3 h-3" /> الاختبار مجدول مسبقاً
            </span>
            <h2 className="text-xl font-black text-slate-900 mt-2">{exam.title}</h2>
            <p className="text-xs text-slate-500 mt-1">البطل: {currentUser.name}</p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs space-y-2 text-slate-700 text-right">
            <div className="flex items-center justify-between font-bold">
              <span className="text-slate-500">موعد البدء:</span>
              <span className="text-emerald-800">{formatArabicDateTime(exam.scheduled_start)}</span>
            </div>
            <div className="flex items-center justify-between font-bold">
              <span className="text-slate-500">موعد الإغلاق:</span>
              <span className="text-rose-800">{formatArabicDateTime(exam.scheduled_end)}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-1">
            <span className="text-[11px] text-slate-400 block">الوقت المتبقي حتى فتح الاختبار:</span>
            <span className="font-mono text-xl font-black text-amber-400 dir-ltr block">
              {countdown.displayText}
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
            سيفتح زر الاختبار تلقائياً فور حلول موعد البدء.
          </p>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs transition"
          >
            العودة إلى المنصة
          </button>
        </div>
      </div>
    );
  }

  // ===================== حالة انتهاء موعد الاختبار (Expired Window) =====================
  if (!isSubmitted && exam.is_scheduled && scheduleInfo.status === 'expired') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" dir="rtl">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
          <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">انتهت فترة الاختبار المحددة</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            عذراً يا بطل، لقد انتهت النافذة الزمنية المخصصة لدخول هذا الاختبار ({formatArabicDateTime(exam.scheduled_end)}).
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-slate-800 transition"
          >
            العودة إلى المنصة
          </button>
        </div>
      </div>
    );
  }

  // ===================== حالة إتمام الاختبار وعرض النتائج (Results Screen) =====================
  if (isSubmitted && finalSession) {
    const score = finalSession.score;
    const total = finalSession.total_marks;
    const percentage = total > 0 ? Math.round((score / total) * 100) : 100;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto" dir="rtl">
        <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl border border-slate-200 my-8">
          {/* رأس بطاقة النتيجة */}
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-400 to-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <Award className="w-10 h-10" />
            </div>

            <div>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                {exam.show_results_immediately ? 'اكْتَمَلَ الاخْتِبَارُ بِنَجَاحٍ! 🎉' : 'تَمَّ تَسْلِيمُ الإِجَابَاتِ بِنَجَاحٍ! 🌟'}
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2">{exam.title}</h2>
              <p className="text-xs text-slate-500 mt-1">البطل: {currentUser.name}</p>
            </div>
          </div>

          {/* تفاصيل النتيجة الفورية */}
          {exam.show_results_immediately ? (
            <div className="space-y-6">
              {/* بطاقة النسبة المئوية والدرجة */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 rounded-3xl p-6 border border-emerald-100 flex items-center justify-around text-center">
                <div>
                  <span className="text-xs font-bold text-slate-500 block mb-1">الدَّرَجَةُ النِّهَائِيَّةُ</span>
                  <p className="text-3xl font-black text-emerald-800">
                    {score} <span className="text-sm font-bold text-slate-400">/ {total}</span>
                  </p>
                </div>
                <div className="h-12 w-px bg-slate-200"></div>
                <div>
                  <span className="text-xs font-bold text-slate-500 block mb-1">النِّسْبَةُ المِئَوِيَّةُ</span>
                  <p className="text-3xl font-black text-blue-800">{percentage}%</p>
                </div>
                <div className="h-12 w-px bg-slate-200"></div>
                <div>
                  <span className="text-xs font-bold text-slate-500 block mb-1">التَّقْدِيرُ</span>
                  <p className="text-base font-black text-purple-800">
                    {percentage >= 90 ? 'مُمْتَازٌ 🌟' : percentage >= 75 ? 'جَيِّدٌ جِدّاً 👏' : percentage >= 50 ? 'جَيِّدٌ 👍' : 'يَحْتَاجُ تَدْرِيباً 💪'}
                  </p>
                </div>
              </div>

              {/* مراجعة الأسئلة والإجابات الصحيحة مع الشرح */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-800">مُرَاجَعَةُ إِجَابَاتِكَ وَالتَّعْلِيمَاتِ التَّرْبَوِيَّةِ:</h4>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {exam.questions.map((q, qIdx) => {
                    const studentAns = (answers[q.id] || '').trim();
                    const isCorrect = studentAns === q.correctAnswer.trim();

                    return (
                      <div 
                        key={q.id} 
                        className={`p-4 rounded-2xl border text-xs space-y-2 ${
                          isCorrect ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-slate-900">السؤال {qIdx + 1}: {q.text}</span>
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                            isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {isCorrect ? `+${q.points || 5} درجات ✅` : '0 درجة ❌'}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <p className="text-slate-700">
                            <span className="font-bold text-slate-500">إجابتك: </span>
                            <span className={isCorrect ? 'text-emerald-700 font-black' : 'text-rose-700 font-black'}>
                              {studentAns || 'لم تتم الإجابة'}
                            </span>
                          </p>

                          {!isCorrect && (
                            <p className="text-emerald-800 font-bold">
                              <span>الإجابة النموذجية الصحيحة: </span>
                              {q.correctAnswer}
                            </p>
                          )}

                          {q.explanation && (
                            <p className="text-[11px] text-slate-500 italic bg-white/70 p-2 rounded-xl border border-slate-100 mt-1">
                              💡 {q.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50/60 rounded-3xl p-6 border border-blue-100 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-blue-900">سَتَصِلُكَ النَّتِيجَةُ بَعْدَ اعْتِمَادِ المُعَلِّمِ</h3>
              <p className="text-xs text-blue-700/80 leading-relaxed max-w-md mx-auto">
                أَحْسَنْتَ صُنْعاً يَا بَطَل! تَمَّ حِفْظُ وَتَوْثِيقُ جَمِيعِ إِجَابَاتِكَ فِي النِّظَامِ، وَسَيَقُومُ مُعَلِّمُكَ بِمُرَاجَعَتِهَا وَاعْتِمَادِ دَرَجَتِكَ قَرِيباً.
              </p>
            </div>
          )}

          {/* زر الخروج */}
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs hover:from-emerald-700 hover:to-teal-700 transition shadow-lg shadow-emerald-600/20"
            >
              العودة إلى المنصة الرئيسية
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===================== واجهة الاختبار التفاعلية الرئيسية =====================
  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col bg-slate-900/90 backdrop-blur-md select-none"
      dir="rtl"
      onCopy={e => { e.preventDefault(); handleTriggerTabSwitch(); }}
      onCut={e => { e.preventDefault(); handleTriggerTabSwitch(); }}
      onPaste={e => { e.preventDefault(); handleTriggerTabSwitch(); }}
      onContextMenu={e => { e.preventDefault(); handleTriggerTabSwitch(); }}
    >
      {/* شريط التحذير الأمني من مغادرة التبويب */}
      {showTabWarning && (
        <div className="bg-amber-500 text-white px-4 py-2.5 text-xs font-black flex items-center justify-between shadow-md animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
            <span>
              ⚠️ تَحْذِيرٌ أَمْنِيٌّ: تَمَّ رَصْدُ مُغَادَرَةٍ لِشَاشَةِ الاخْتِبَارِ ({tabSwitchCount} مَرَّاتٍ)! تَمَّ إِخْطَارُ المُعَلِّمِ فِي لَوْحَةِ المُرَاقَبَةِ الحَيَّةِ.
            </span>
          </div>
          <button
            onClick={() => setShowTabWarning(false)}
            className="p-1 rounded-lg hover:bg-amber-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* الرأس العلوي للاختبار والعداد */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 shrink-0 shadow-xs">
        <div>
          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
            {exam.target_grade}
          </span>
          <h1 className="text-base font-black text-slate-900 mt-1">{exam.title}</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* شارة نافذة الاختبار المجدول إن وجدت */}
          {exam.is_scheduled && exam.scheduled_end && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
              <CalendarClock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>يُغلق: {formatArabicDateTime(exam.scheduled_end)}</span>
            </div>
          )}

          {/* عداد الوقت */}
          {exam.duration_minutes > 0 ? (
            <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 font-mono text-sm font-black transition ${
              timeLeft < 60 
                ? 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse' 
                : timeLeft < 300 
                ? 'bg-amber-50 border-amber-300 text-amber-700' 
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              <Clock className="w-4 h-4" />
              <span>{formatTime(timeLeft)}</span>
            </div>
          ) : (
            <div className="px-3.5 py-1.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center gap-1.5 text-xs font-black">
              <Clock className="w-3.5 h-3.5" />
              <span>وقت مفتوح ({formatTime(elapsedTime)})</span>
            </div>
          )}

          {/* زر تسليم الاختبار */}
          <button
            onClick={() => setShowConfirmSubmit(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs hover:from-emerald-700 hover:to-teal-700 transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
          >
            <Send className="w-3.5 h-3.5" />
            تسليم الاختبار
          </button>
        </div>
      </header>

      {/* شريط تقدم الأسئلة */}
      <div className="w-full bg-slate-200 h-1.5">
        <div 
          className="bg-emerald-600 h-1.5 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* منطقة محتوى السؤال الرئيسي */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center">
        <div className="bg-white rounded-3xl max-w-3xl w-full p-6 md:p-8 border border-slate-200 shadow-xl space-y-6">
          {/* مؤشر ترقيم السؤال والصوت */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center shadow-xs">
                {currentQuestionIndex + 1}
              </span>
              <span className="text-xs font-bold text-slate-500">
                السؤال {currentQuestionIndex + 1} من أصل {totalQuestions}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600">
                {currentQ.points || 5} درجات
              </span>

              <button
                type="button"
                onClick={handleToggleSpeakCurrentQuestion}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 text-xs font-bold ${
                  isSpeakingQuestion
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                }`}
                title={isSpeakingQuestion ? 'إيقاف الصوت مؤقتاً' : 'الاستماع لنص السؤال بصوت موسى'}
              >
                {isSpeakingQuestion ? <VolumeX className="w-4 h-4 text-amber-700" /> : <Volume2 className="w-4 h-4" />}
                <span>{isSpeakingQuestion ? 'إيقاف ⏸️' : 'اسمع السؤال 🔊'}</span>
              </button>
            </div>
          </div>

          {/* نص السؤال المشكول بالخط العربي الواضح */}
          <div className="text-right py-2">
            <h2 className="text-lg md:text-xl font-black text-slate-900 leading-relaxed font-serif tracking-wide">
              {currentQ.text}
            </h2>
          </div>

          {/* خيارات الإجابة حسب نمط السؤال */}
          <div className="space-y-3 pt-2">
            {/* 1. نمط الاختيار من متعدد */}
            {currentQ.type === 'multiple_choice' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(currentQ.options || []).map((option, optIdx) => {
                  const isSelected = answers[currentQ.id] === option;
                  const optionLetters = ['أ', 'ب', 'ج', 'د'];

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectAnswer(currentQ.id, option)}
                      className={`p-4 rounded-2xl border text-right transition flex items-center justify-between gap-3 ${
                        isSelected 
                          ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-black ring-2 ring-emerald-600/30 shadow-xs' 
                          : 'border-slate-200 bg-slate-50/40 hover:bg-slate-100/60 text-slate-800 font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center ${
                          isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {optionLetters[optIdx] || optIdx + 1}
                        </span>
                        <span className="text-sm font-serif leading-relaxed">{option}</span>
                      </div>

                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 2. نمط صح أو خطأ */}
            {currentQ.type === 'true_false' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {['صَحِيحٌ ✅', 'خَطَأٌ ❌'].map((choice, cIdx) => {
                  const isSelected = answers[currentQ.id] === choice;
                  const isCorrectChoice = choice.includes('صَحِيحٌ');

                  return (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={() => handleSelectAnswer(currentQ.id, choice)}
                      className={`p-5 rounded-2xl border text-center transition flex items-center justify-center gap-3 text-base font-black ${
                        isSelected 
                          ? isCorrectChoice
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-600/30'
                            : 'border-rose-600 bg-rose-50 text-rose-900 ring-2 ring-rose-600/30'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span>{choice}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 3. نمط الكتابة والإملاء المشكول */}
            {currentQ.type === 'spelling_dictation' && (
              <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600">
                    اكتب الكلمة المشكولة بالحركات التامة:
                  </label>
                  <button
                    type="button"
                    onClick={handleToggleSpeakCurrentQuestion}
                    className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                      isSpeakingQuestion
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900'
                    }`}
                  >
                    {isSpeakingQuestion ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span>{isSpeakingQuestion ? 'إيقاف ⏸️' : 'اسمع السؤال 🔊'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={answers[currentQ.id] || ''}
                  onChange={e => handleSelectAnswer(currentQ.id, e.target.value)}
                  placeholder="اكتب هنا..."
                  className="w-full text-base font-black text-slate-900 bg-white border border-slate-300 rounded-xl p-3.5 text-center focus:outline-hidden focus:border-emerald-500"
                />

                {/* شريط أزرار الحركات السريعة (التشكيل الذكي) */}
                <div className="pt-2">
                  <span className="text-[11px] font-bold text-slate-500 block mb-1.5">مساعد التشكيل الفوري (انقر للإضافة):</span>
                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    {TASHKEEL_BUTTONS.map((tashkeel, tIdx) => (
                      <button
                        key={tIdx}
                        type="button"
                        onClick={() => handleInsertTashkeel(tashkeel)}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-emerald-800 hover:bg-emerald-50 text-base font-black flex items-center justify-center shadow-2xs transition active:scale-95"
                      >
                        {tashkeel}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* شريط التنقل بين الأسئلة */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition flex items-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ArrowRight className="w-4 h-4" />
              السؤال السابق
            </button>

            {/* دوائر الانتقال السريع بين الأسئلة */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-xs px-2 py-1">
              {exam.questions.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isCurrent = idx === currentQuestionIndex;

                return (
                  <button
                    key={q.id || idx}
                    type="button"
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`w-7 h-7 rounded-lg text-xs font-black transition flex items-center justify-center shrink-0 ${
                      isCurrent 
                        ? 'bg-slate-900 text-white' 
                        : isAnswered 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {currentQuestionIndex < totalQuestions - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-slate-800 transition flex items-center gap-1.5"
              >
                السؤال التالي
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirmSubmit(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs hover:from-emerald-700 hover:to-teal-700 transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <Send className="w-4 h-4" />
                تسليم الاختبار الآن
              </button>
            )}
          </div>
        </div>
      </main>

      {/* نافذة تأكيد تسليم الاختبار */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <HelpCircle className="w-8 h-8" />
            </div>

            <h3 className="text-base font-black text-slate-900">هل ترغب في تسليم الاختبار الآن؟</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              لقد قمت بالإجابة على ({answeredCount}) من أصل ({totalQuestions}) أسئلة.
              {answeredCount < totalQuestions && (
                <span className="block font-bold text-amber-600 mt-1">
                  تنبيه: هناك أسئلة لم تجب عليها بعد!
                </span>
              )}
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                مواصلة الحل
              </button>

              <button
                type="button"
                onClick={executeSubmission}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/20"
              >
                نعم، تسليم نهائي
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
