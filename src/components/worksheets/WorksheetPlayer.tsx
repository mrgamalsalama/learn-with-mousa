import React, { useState, useEffect, useRef } from 'react';
import { 
  InteractiveWorksheet, 
  WorksheetSubmission, 
  WorksheetElement,
  UserProfile 
} from '../../types';
import { 
  fetchWorksheetById, 
  gradeWorksheetSubmission, 
  submitWorksheetAnswers, 
  normalizeArabicText 
} from '../../services/worksheetService';
import { WorksheetAudioRecorder } from './WorksheetAudioRecorder';

interface WorksheetPlayerProps {
  worksheetId: string;
  currentUser?: UserProfile | null;
  onClose?: () => void;
  onCompleted?: (submission: WorksheetSubmission) => void;
  isGuestMode?: boolean;
}

export const WorksheetPlayer: React.FC<WorksheetPlayerProps> = ({
  worksheetId,
  currentUser,
  onClose,
  onCompleted,
  isGuestMode = false,
}) => {
  const [worksheet, setWorksheet] = useState<InteractiveWorksheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestName, setGuestName] = useState('');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<WorksheetSubmission | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // نمط العرض: إما صفحة بصفحة (single) أو تمرير عمودي متتالي لكافة الصفحات (scroll)
  const [viewMode, setViewMode] = useState<'single' | 'scroll'>('single');
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);

  // حالة التوصيل التفاعلي بالخطوط (Join Lines interaction)
  const [activeSourcePointId, setActiveSourcePointId] = useState<string | null>(null);

  // نافذة تأكيد التسليم عند وجود أسئلة متروكة دون حل
  const [showUnansweredConfirm, setShowUnansweredConfirm] = useState(false);
  const [unansweredSummary, setUnansweredSummary] = useState<{ total: number; missing: number; missingPages: number[] }>({
    total: 0,
    missing: 0,
    missingPages: []
  });

  // تحميل ورقة العمل
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const ws = await fetchWorksheetById(worksheetId);
        if (isMounted) {
          if (ws) {
            setWorksheet(ws);
          } else {
            setErrorMessage('عذراً، لم يتم العثور على ورقة العمل المطلوبة أو قد تم حذفها.');
          }
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage('تعذر تحميل ورقة العمل، يرجى التحقق من اتصالك بالإنترنت.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (worksheetId) {
      loadData();
    }
    return () => { isMounted = false; };
  }, [worksheetId]);

  // دالة موحدة لاستخراج رقم الصفحة للعنصر (تدعم page و pageIndex)
  const getElementPageNumber = (el: WorksheetElement): number => {
    if (typeof el.page === 'number') return el.page;
    if (typeof (el as any).pageIndex === 'number') return (el as any).pageIndex + 1;
    return 1;
  };

  // استخراج وضمان مصفوفة الصفحات كاملة مع منع أي نقصان
  const rawPages: string[] = (worksheet?.pages && Array.isArray(worksheet.pages) && worksheet.pages.length > 0)
    ? worksheet.pages
    : [worksheet?.image_url || worksheet?.background_url || ''];

  const maxElementPage = (worksheet?.elements || []).reduce((max, el) => {
    return Math.max(max, getElementPageNumber(el));
  }, 1);

  const pages: string[] = [...rawPages];
  while (pages.length < maxElementPage) {
    pages.push(rawPages[0] || '');
  }

  // عناصر الصفحة المعروضة حالياً في نمط الصفحة الواحدة
  const currentPageElements = (worksheet?.elements || []).filter(
    el => getElementPageNumber(el) === (currentPageIndex + 1)
  );

  // تحديث إجابة الطالب لعنصر ما مع الحفاظ الكامل على بقية الإجابات
  const handleAnswerChange = (elementId: string, value: any) => {
    if (submissionResult) return; // مقفل بعد التسليم
    setAnswers(prev => {
      const next = { ...prev, [elementId]: value };

      // إذا كان العنصر خياراً ولديه مجموعة (groupName)، إلغاء تحديد باقي عناصر نفس المجموعة
      const currentEl = worksheet?.elements?.find(e => e.id === elementId);
      if (currentEl && (currentEl.type === 'choice' || (currentEl.type as string) === 'single_choice') && value === true && currentEl.groupName) {
        worksheet?.elements?.forEach(other => {
          if (other.id !== elementId && other.groupName === currentEl.groupName) {
            next[other.id] = false;
          }
        });
      }

      return next;
    });
  };

  // تفاعل التوصيل: اختيار نقطة البداية والنقر على نقطة الهدف
  const handleJoinPointClick = (el: any) => {
    if (submissionResult) return;

    if (el.joinRole === 'source') {
      if (activeSourcePointId === el.id) {
        setActiveSourcePointId(null); // إلغاء التحديد
      } else {
        setActiveSourcePointId(el.id);
      }
    } else if (el.joinRole === 'target' && activeSourcePointId) {
      // إتمام الربط بين نقطة البداية وهذه النقطة
      handleAnswerChange(activeSourcePointId, el.id);
      setActiveSourcePointId(null);
    }
  };

  // إلغاء خط توصيل قائم لنقطة انطلاق معينة
  const handleRemoveConnection = (sourceId: string) => {
    if (submissionResult) return;
    setAnswers(prev => {
      const next = { ...prev };
      delete next[sourceId];
      return next;
    });
  };

  // إحصائيات الأسئلة المحلولة
  const answerableElements = (worksheet?.elements || []).filter(
    el => !(el.type === 'join_point' && (el.joinRole === 'target' || (el as any).role === 'target'))
  );

  const isElementAnswered = (elId: string) => {
    const val = answers[elId];
    if (val === undefined || val === null) return false;
    if (typeof val === 'string' && val.trim() === '') return false;
    return true;
  };

  const totalAnsweredCount = answerableElements.filter(el => isElementAnswered(el.id)).length;
  const isAllAnswered = answerableElements.length > 0 && totalAnsweredCount >= answerableElements.length;

  // التحقق قبل التسليم للتنبيه عند وجود أسئلة متروكة
  const handlePreSubmit = () => {
    if (!worksheet) return;

    const finalStudentName = currentUser?.name || guestName.trim();
    if (!currentUser && !guestName.trim()) {
      alert('يرجى كتابة اسمك الثلاثي قبل تسليم الإجابات لكي يتم رصد درجتك بنجاح!');
      return;
    }

    const missingEls = answerableElements.filter(el => !isElementAnswered(el.id));
    if (missingEls.length > 0) {
      const missingPages = [...new Set(missingEls.map(el => getElementPageNumber(el)))].sort((a, b) => a - b);
      setUnansweredSummary({
        total: answerableElements.length,
        missing: missingEls.length,
        missingPages
      });
      setShowUnansweredConfirm(true);
    } else {
      handleSubmit();
    }
  };

  // تسليم الإجابات والتصحيح التلقائي الفوري
  const handleSubmit = async () => {
    if (!worksheet) return;
    setShowUnansweredConfirm(false);

    const finalStudentName = currentUser?.name || guestName.trim();
    if (!currentUser && !guestName.trim()) {
      alert('يرجى كتابة اسمك الثلاثي قبل تسليم الإجابات لكي يتم رصد درجتك بنجاح!');
      return;
    }

    setIsSubmitting(true);

    try {
      const elements = worksheet.elements || [];

      // كشف تفاصيل التصحيح في الكونسول
      console.log("== تفاصيل عناصر الورقة من المعلم ==", elements);
      console.log("== إجابات الطالب المسجلة ==", answers);
      elements.forEach((el, idx) => {
        let target = (el as any).targetId || (el as any).matchId || (el as any).correctTargetId || el.targetPointId || (el as any).connectsTo || (el as any).correctAnswer;
        if (!target && (el.type === 'join_point' || (el.type as string) === 'matching') && el.joinRole !== 'target') {
          const sources = elements.filter(item => (item.type === 'join_point' || (item.type as string) === 'matching') && item.joinRole !== 'target');
          const targets = elements.filter(item => (item.type === 'join_point' || (item.type as string) === 'matching') && item.joinRole === 'target');
          const myIndex = sources.findIndex(s => s.id === el.id);
          if (myIndex >= 0 && targets[myIndex]) target = targets[myIndex].id;
        }

        console.log(`عنصر ${idx}:`, {
          نوع: el.type,
          الصفحة: getElementPageNumber(el),
          الدور: (el as any).joinRole || (el as any).role,
          الإجابة_المطلوبة: (el.type === 'join_point' || (el.type as string) === 'matching')
            ? target
            : ((el as any).correctAnswer ?? (el as any).correctAnswers ?? el.isCorrect ?? (el as any).value),
          إجابة_الطالب: answers[el.id],
          الدرجة_المستحقة: el.points
        });
      });

      // التصحيح التلقائي الدقيق لكافة أنواع الأسئلة
      const grading = gradeWorksheetSubmission(worksheet, answers);

      // إعداد كائن التسليم
      const submission: WorksheetSubmission = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        worksheet_id: worksheet.id,
        school_id: worksheet.school_id || '00000000-0000-0000-0000-000000000001',
        student_id: currentUser?.id || null,
        student_name: finalStudentName,
        guest_name: currentUser ? undefined : finalStudentName,
        class_id: currentUser?.grade || worksheet.target_class_id || worksheet.class_id || null,
        answers: answers,
        score: grading.score,
        total_score: grading.totalScore,
        max_score: grading.totalScore,
        percentage: grading.percentage,
        status: 'graded',
        submitted_at: new Date().toISOString(),
        results_breakdown: grading.breakdown
      };

      // الحفظ السحابي والمحلي
      await submitWorksheetAnswers(submission);

      setSubmissionResult(submission);
      setShowCelebration(true);

      if (onCompleted) {
        onCompleted(submission);
      }
    } catch (err) {
      console.error('Error submitting answers:', err);
      alert('حدث خطأ أثناء إرسال الإجابة، يرجى المحاولة ثانية.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center font-sans" dir="rtl">
        <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-800">جارِ فتح ورقة العمل التفاعلية...</h2>
        <p className="text-xs text-slate-500 mt-1">يتم الآن تجهيز الصفحات والحقول التفاعلية والتصحيح الذاتي</p>
      </div>
    );
  }

  if (errorMessage || !worksheet) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center font-sans" dir="rtl">
        <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center text-3xl mb-4">
          ⚠️
        </div>
        <h2 className="text-base font-bold text-slate-800 mb-2">{errorMessage || 'ورقة العمل غير متوفرة'}</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition mt-4"
          >
            الرجوع للصفحة السابقة
          </button>
        )}
      </div>
    );
  }

  const isGraded = Boolean(submissionResult);
  const breakdown = submissionResult?.results_breakdown || {};

  // دالة رسم لوحة الصفحة وحقولها التفاعلية
  const renderPageCanvas = (pageIdx: number, pageImgUrl: string, pageElements: WorksheetElement[]) => {
    return (
      <div
        key={`page_canvas_${pageIdx}`}
        id={`page-canvas-${pageIdx}`}
        className="relative w-full max-w-[820px] bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-300 select-text"
        style={{ minHeight: '900px' }}
      >
        {/* صورة الورقة الأصلية لهذه الصفحة */}
        <img
          src={pageImgUrl}
          alt={`ورقة العمل - صفحة ${pageIdx + 1}`}
          className="w-full h-auto block select-none pointer-events-none"
          draggable={false}
        />

        {/* خطوط التوصيل (SVG overlay lines) التابعة لهذه الصفحة */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {pageElements
            .filter(el => el.type === 'join_point' && el.joinRole === 'source')
            .map(sourceEl => {
              const connectedTargetId = answers[sourceEl.id];
              if (!connectedTargetId) return null;
              const targetEl = pageElements.find(item => item.id === connectedTargetId);
              if (!targetEl) return null;

              const result = breakdown[sourceEl.id];
              let strokeColor = '#3b82f6'; // أزرق أثناء الحل
              if (isGraded && result) {
                strokeColor = result.isCorrect ? '#10b981' : '#f43f5e';
              }

              const x1 = sourceEl.x + sourceEl.width / 2;
              const y1 = sourceEl.y + sourceEl.height / 2;
              const x2 = targetEl.x + targetEl.width / 2;
              const y2 = targetEl.y + targetEl.height / 2;

              return (
                <g key={`conn_${sourceEl.id}_${targetEl.id}`}>
                  <line
                    x1={`${x1}%`}
                    y1={`${y1}%`}
                    x2={`${x2}%`}
                    y2={`${y2}%`}
                    stroke={strokeColor}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <circle cx={`${x1}%`} cy={`${y1}%`} r="5" fill={strokeColor} />
                  <circle cx={`${x2}%`} cy={`${y2}%`} r="5" fill={strokeColor} />
                </g>
              );
            })}
        </svg>

        {/* الحقول التفاعلية التراكبية التابعة لهذه الصفحة */}
        {pageElements.map((el) => {
          const studentAns = answers[el.id];
          const result = breakdown[el.id];

          // تخصيص مظهر الحقل قبل وبعد التصحيح
          let containerBorder = el.type === 'voice_recording'
            ? 'border-violet-400 bg-violet-50/90 hover:border-violet-600 shadow-sm'
            : 'border-blue-400 bg-white/90 hover:border-blue-600 shadow-sm';
          if (isGraded && result) {
            containerBorder = result.isCorrect
              ? 'border-emerald-500 bg-emerald-50/95 ring-2 ring-emerald-400/50'
              : 'border-rose-500 bg-rose-50/95 ring-2 ring-rose-400/50';
          }

          return (
            <div
              key={el.id}
              className={`absolute transition-all rounded-lg overflow-hidden border-2 flex items-center justify-center p-0.5 ${containerBorder}`}
              style={{
                left: `${el.x}%`,
                top: `${el.y}%`,
                width: `${el.width}%`,
                height: `${el.height}%`,
              }}
            >
              {/* 1. ملء الفراغ القصير (Text Input) */}
              {el.type === 'text' && (
                <div className="w-full h-full relative flex items-center">
                  <input
                    type="text"
                    disabled={isGraded}
                    value={studentAns || ''}
                    onChange={(e) => handleAnswerChange(el.id, e.target.value)}
                    placeholder="اكتب هنا..."
                    className={`w-full h-full text-center font-bold text-xs sm:text-sm bg-transparent focus:outline-none focus:bg-blue-50/70 transition ${
                      isGraded
                        ? result?.isCorrect
                          ? 'text-emerald-800'
                          : 'text-rose-800 line-through'
                        : 'text-slate-900'
                    }`}
                  />

                  {/* إظهار الإجابة الصحيحة عند الخطأ بعد التسليم */}
                  {isGraded && result && !result.isCorrect && (
                    <div className="absolute -bottom-6 right-0 bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded shadow-lg z-20 whitespace-nowrap font-bold">
                      الصواب: {result.expected}
                    </div>
                  )}
                </div>
              )}

              {/* 2. سؤال مقالي تفاعلي (Open Essay / Paragraph) */}
              {el.type === 'essay' && (
                <div className="w-full h-full relative flex flex-col p-1">
                  <textarea
                    disabled={isGraded}
                    value={studentAns || ''}
                    onChange={(e) => handleAnswerChange(el.id, e.target.value)}
                    placeholder="اكتب إجابتك وشرحك هنا بالتفصيل..."
                    rows={2}
                    className={`w-full h-full font-medium text-xs bg-transparent focus:outline-none focus:bg-purple-50/70 resize-none transition leading-relaxed ${
                      isGraded
                        ? result?.isCorrect
                          ? 'text-emerald-900'
                          : 'text-rose-900'
                        : 'text-slate-900'
                    }`}
                  />

                  {isGraded && result && (
                    <div className="mt-1 text-[9px] font-bold text-slate-600 truncate border-t border-slate-200/60 pt-0.5">
                      {result.expected}
                    </div>
                  )}
                </div>
              )}

              {/* 3. خيار من متعدد (Single Choice Box) */}
              {el.type === 'choice' && (
                <button
                  type="button"
                  disabled={isGraded}
                  onClick={() => handleAnswerChange(el.id, !studentAns)}
                  className={`w-full h-full flex items-center justify-center font-bold text-xs transition rounded ${
                    studentAns
                      ? isGraded
                        ? result?.isCorrect
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                        : 'bg-blue-600 text-white'
                      : 'bg-transparent text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {studentAns ? '✓ تم الاختيار' : 'انقر للاختيار'}
                </button>
              )}

              {/* 4. خانة اختيار / صح وخطأ (Checkbox) */}
              {el.type === 'checkbox' && (
                <label className="w-full h-full flex items-center justify-center cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isGraded}
                    checked={Boolean(studentAns)}
                    onChange={(e) => handleAnswerChange(el.id, e.target.checked)}
                    className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer disabled:cursor-default"
                  />
                </label>
              )}

              {/* 5. أداة التوصيل بين الأعمدة (Join Line Point) */}
              {el.type === 'join_point' && (
                <button
                  type="button"
                  disabled={isGraded}
                  onClick={() => handleJoinPointClick(el)}
                  className={`w-full h-full flex flex-col items-center justify-center text-xs font-bold transition rounded cursor-pointer ${
                    activeSourcePointId === el.id
                      ? 'bg-rose-600 text-white animate-pulse'
                      : el.joinRole === 'source'
                        ? studentAns
                          ? 'bg-blue-600 text-white'
                          : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                        : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
                  }`}
                >
                  <div className="flex items-center gap-1 text-[10px]">
                    <span>{el.joinRole === 'source' ? '🔗 انطلاق' : '🎯 هدف'}</span>
                  </div>
                  {el.joinRole === 'source' && studentAns && !isGraded && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveConnection(el.id);
                      }}
                      className="text-[9px] underline text-white hover:text-rose-200 mt-0.5"
                      title="إلغاء التوصيل"
                    >
                      (فك الربط)
                    </span>
                  )}
                </button>
              )}

              {/* 6. سؤال التسجيل الصوتي وقراءة الفقرات (Audio Recording Task) */}
              {el.type === 'voice_recording' && (
                <WorksheetAudioRecorder
                  element={el}
                  currentAudioUrl={studentAns}
                  onSaveAudio={(audioUrl) => handleAnswerChange(el.id, audioUrl)}
                  onRemoveAudio={() => handleAnswerChange(el.id, '')}
                  isGraded={isGraded}
                  result={result}
                />
              )}

              {/* شارة صغيرة لدرجة السؤال بعد التصحيح */}
              {isGraded && result && el.joinRole !== 'target' && (
                <div
                  className={`absolute -top-3 -left-2 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow ${
                    result.isCorrect ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                  }`}
                >
                  {result.pointsEarned}/{el.points}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none pb-24" dir="rtl">
      {/* 1. شريط الرأس الرئيسي الثابت */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3 shadow-sm">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-700 transition"
                title="إغلاق والرجوع"
              >
                <svg className="w-5 h-5 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  ورقة عمل تفاعلية
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {answerableElements.length} أسئلة • الدرجة الكلية: {worksheet.total_points || 20}
                  {pages.length > 1 && ` • ${pages.length} صفحات`}
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 truncate max-w-md mt-0.5">
                {worksheet.title}
              </h1>
            </div>
          </div>

          {/* أدوات الرأس: تبديل نمط العرض + زر التسليم أو النتيجة */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* زر التبديل بين العرض صفحة بصفحة أو التمرير العمودي لجميع الصفحات */}
            {pages.length > 1 && (
              <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode('single')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    viewMode === 'single'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="عرض ورقة العمل صفحة بصفحة مع شريط تنقل"
                >
                  <span>📑</span>
                  <span>صفحة بصفحة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('scroll')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    viewMode === 'scroll'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="عرض جميع صفحات ورقة العمل مصفوفة رأسياً تحت بعضها"
                >
                  <span>📜</span>
                  <span>عرض متصل</span>
                </button>
              </div>
            )}

            {/* لوحة النتائج بعد التصحيح أو زر التسليم */}
            {isGraded ? (
              <div className="flex items-center gap-2 bg-slate-900 text-white px-3.5 py-1.5 rounded-xl shadow-md animate-in fade-in">
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 block font-semibold leading-tight">النتيجة النهائية</span>
                  <span className="text-sm font-extrabold text-emerald-400">
                    {submissionResult?.score} / {submissionResult?.total_score} ({submissionResult?.percentage}%)
                  </span>
                </div>
                <div className="text-xl">
                  {(submissionResult?.percentage || 0) >= 80 ? '🌟' : (submissionResult?.percentage || 0) >= 50 ? '👍' : '💪'}
                </div>
              </div>
            ) : (
              <button
                onClick={handlePreSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
              >
                <span>🚀</span>
                <span>{isSubmitting ? 'جارِ التصحيح...' : 'تسليم الإجابات'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* تنبيه للطالب الزائر عبر الرابط العام لكتابة اسمه الثلاثي */}
      {(!currentUser || isGuestMode) && !isGraded && (
        <div className="bg-amber-500/10 border-b border-amber-200 px-4 py-2.5">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-900 font-bold">
              <span className="text-base">👤</span>
              <span>أهلاً بك! يرجى إدخال اسمك الثلاثي ليتم رصد درجتك للمعلم:</span>
            </div>
            <div className="flex-1 max-w-xs">
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="اكتب اسمك الثلاثي هنا..."
                className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. شريط التنقل العلوي الصريح والواضح بين الصفحات (Page Navigation Controls) */}
      {pages.length > 1 && (
        <div className="bg-white/95 backdrop-blur-sm border-b border-slate-200 py-2 px-4 shadow-xs sticky top-[57px] z-20">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* مؤشر الصفحة الصريح والأرقام السريعة */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <span>📄</span>
                <span>الصفحة</span>
                <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-lg text-xs font-black">
                  {currentPageIndex + 1}
                </span>
                <span className="text-slate-400 font-normal">من</span>
                <span className="text-slate-600 font-bold">{pages.length}</span>
              </div>

              {/* أزرار سريعة للأرقام (1 | 2 | 3 ...) مع مؤشرات الإنجاز الدقيقة لكل صفحة */}
              <div className="flex items-center gap-1.5">
                {pages.map((_, idx) => {
                  const pageNum = idx + 1;
                  const elsOnPage = (worksheet.elements || []).filter(el => getElementPageNumber(el) === pageNum);
                  const answerableOnPage = elsOnPage.filter(
                    el => !(el.type === 'join_point' && (el.joinRole === 'target' || (el as any).role === 'target'))
                  );
                  const answeredOnPage = answerableOnPage.filter(el => isElementAnswered(el.id));
                  const isPageComplete = answerableOnPage.length > 0 && answeredOnPage.length === answerableOnPage.length;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setCurrentPageIndex(idx);
                        if (viewMode === 'scroll') {
                          const target = document.getElementById(`page-section-${idx}`);
                          if (target) target.scrollIntoView({ behavior: 'smooth' });
                        } else {
                          window.scrollTo({ top: 100, behavior: 'smooth' });
                        }
                      }}
                      className={`px-3 py-1 rounded-xl font-bold text-xs transition flex items-center gap-1.5 ${
                        currentPageIndex === idx
                          ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      title={`الانتقال إلى الصفحة ${pageNum} (${answeredOnPage.length}/${answerableOnPage.length} أسئلة محلولة)`}
                    >
                      <span>{pageNum}</span>
                      {isPageComplete ? (
                        <span className="text-[10px] text-emerald-300 font-black">✓</span>
                      ) : answerableOnPage.length > 0 ? (
                        <span className={`text-[9px] font-mono ${currentPageIndex === idx ? 'text-emerald-100' : 'text-slate-400'}`}>
                          ({answeredOnPage.length}/{answerableOnPage.length})
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* أزرار التنقل السريع: الصفحة السابقة ⬅️ و الصفحة التالية ➡️ */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPageIndex === 0}
                onClick={() => {
                  const nextIdx = Math.max(0, currentPageIndex - 1);
                  setCurrentPageIndex(nextIdx);
                  if (viewMode === 'scroll') {
                    const target = document.getElementById(`page-section-${nextIdx}`);
                    if (target) target.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    window.scrollTo({ top: 100, behavior: 'smooth' });
                  }
                }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold disabled:opacity-40 transition text-xs flex items-center gap-1"
              >
                <span>⬅️</span>
                <span>الصفحة السابقة</span>
              </button>

              <button
                type="button"
                disabled={currentPageIndex >= pages.length - 1}
                onClick={() => {
                  const nextIdx = Math.min(pages.length - 1, currentPageIndex + 1);
                  setCurrentPageIndex(nextIdx);
                  if (viewMode === 'scroll') {
                    const target = document.getElementById(`page-section-${nextIdx}`);
                    if (target) target.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    window.scrollTo({ top: 100, behavior: 'smooth' });
                  }
                }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold disabled:opacity-40 transition text-xs flex items-center gap-1"
              >
                <span>الصفحة التالية</span>
                <span>➡️</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* لوحة الاحتفال بالنجاح والتهنئة الفورية بعد التسليم */}
      {showCelebration && submissionResult && (
        <div className={`px-4 py-4 text-center shadow-md animate-in slide-in-from-top-4 text-white ${
          submissionResult.percentage >= 80
            ? 'bg-gradient-to-r from-emerald-600 to-teal-700'
            : submissionResult.percentage >= 50
              ? 'bg-gradient-to-r from-blue-600 to-indigo-700'
              : 'bg-gradient-to-r from-amber-600 to-orange-700'
        }`}>
          <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl">
                {submissionResult.percentage >= 80 ? '🎉' : submissionResult.percentage >= 50 ? '👏' : '💡'}
              </span>
              <div className="text-right">
                <h3 className="font-extrabold text-sm sm:text-base">
                  {submissionResult.percentage >= 80
                    ? 'أحسنت صنعاً يا بطل! نتيجة متميزة ومتقنة 🌟'
                    : submissionResult.percentage >= 50
                      ? 'عمل جيد جداً! تم تصحيح ورقتك وحفظ إجابتك 👍'
                      : 'تم تسليم الورقة ورصد نتيجتك! راجع إجاباتك لمزيد من التعلم 💪'}
                </h3>
                <p className="text-xs text-white/90">
                  حصلت على <strong className="text-yellow-200 text-sm">{submissionResult.score}</strong> من <strong>{submissionResult.total_score}</strong> (نسبة {submissionResult.percentage}%)
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCelebration(false)}
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg font-bold transition"
            >
              مراجعة إجاباتي على الورقة
            </button>
          </div>
        </div>
      )}

      {/* مساحة عرض وحل ورقة العمل */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 flex flex-col items-center">
        {worksheet.description && (
          <div className="w-full max-w-[820px] bg-white rounded-2xl p-3 mb-4 text-xs text-slate-700 border border-slate-200 shadow-sm flex items-center gap-2">
            <span className="text-base text-emerald-600">📌</span>
            <span>{worksheet.description}</span>
          </div>
        )}

        {/* ===================== النمط الأول: عرض صفحة بصفحة (Single Page Mode) ===================== */}
        {viewMode === 'single' && (
          <div className="w-full flex flex-col items-center">
            {/* لوحة رأس الصفحة الحالية */}
            {pages.length > 1 && (
              <div className="w-full max-w-[820px] flex items-center justify-between bg-slate-200/90 px-4 py-2 rounded-t-2xl border-t border-x border-slate-300 text-xs font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <span>📄</span>
                  <span>الصفحة {currentPageIndex + 1} من {pages.length}</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    ({currentPageElements.length} أسئلة في هذه الصفحة)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <span>المحلول في هذه الصفحة:</span>
                  <strong className="text-emerald-700">
                    {currentPageElements.filter(e => isElementAnswered(e.id)).length} / {currentPageElements.filter(e => !(e.type === 'join_point' && (e.joinRole === 'target' || (e as any).role === 'target'))).length}
                  </strong>
                </div>
              </div>
            )}

            {/* ورقة العمل الحالية */}
            {renderPageCanvas(
              currentPageIndex,
              pages[currentPageIndex] || pages[0],
              currentPageElements
            )}

            {/* شريط سفلي للانتقال بين الصفحات تحت الورقة مباشرة */}
            {pages.length > 1 && (
              <div className="w-full max-w-[820px] bg-white rounded-2xl p-3.5 mt-4 border border-slate-200 shadow-sm flex items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  disabled={currentPageIndex === 0}
                  onClick={() => {
                    setCurrentPageIndex(prev => Math.max(0, prev - 1));
                    window.scrollTo({ top: 100, behavior: 'smooth' });
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl disabled:opacity-40 transition flex items-center gap-1"
                >
                  <span>⬅️</span>
                  <span>الصفحة السابقة</span>
                </button>

                <div className="text-center font-bold text-slate-600">
                  <span>الصفحة {currentPageIndex + 1} من {pages.length}</span>
                </div>

                {currentPageIndex < pages.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPageIndex(prev => Math.min(pages.length - 1, prev + 1));
                      window.scrollTo({ top: 100, behavior: 'smooth' });
                    }}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow transition flex items-center gap-1"
                  >
                    <span>الصفحة التالية</span>
                    <span>➡️</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePreSubmit}
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow transition flex items-center gap-1"
                  >
                    <span>🚀 تسليم الإجابات</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================== النمط الثاني: التمرير العمودي المتتالي (Vertical Stack Mode) ===================== */}
        {viewMode === 'scroll' && (
          <div className="w-full flex flex-col items-center space-y-8">
            {pages.map((pageUrl, pageIdx) => {
              const pageNum = pageIdx + 1;
              const pageElements = (worksheet.elements || []).filter(el => getElementPageNumber(el) === pageNum);
              const answerableOnPage = pageElements.filter(
                el => !(el.type === 'join_point' && (el.joinRole === 'target' || (el as any).role === 'target'))
              );
              const answeredOnPage = answerableOnPage.filter(el => isElementAnswered(el.id));

              return (
                <div
                  key={`page_section_${pageIdx}`}
                  id={`page-section-${pageIdx}`}
                  className="w-full flex flex-col items-center"
                >
                  {/* رأس كل صفحة في العرض العمودي */}
                  <div className="w-full max-w-[820px] flex items-center justify-between bg-slate-200/90 px-4 py-2.5 rounded-t-2xl border-t border-x border-slate-300 text-xs font-bold text-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📄</span>
                      <span className="text-sm">الصفحة {pageNum} من {pages.length}</span>
                      <span className="text-[11px] font-normal text-slate-500">
                        ({pageElements.length} أسئلة)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] bg-white px-2.5 py-1 rounded-full text-slate-700 shadow-2xs font-bold">
                        تم حل {answeredOnPage.length} من {answerableOnPage.length}
                      </span>
                    </div>
                  </div>

                  {/* لوحة رسم الصفحة */}
                  {renderPageCanvas(pageIdx, pageUrl, pageElements)}
                </div>
              );
            })}
          </div>
        )}

        {/* زر إعادة المحاولة بعد التسليم */}
        {isGraded && (
          <div className="mt-8 flex items-center gap-4">
            <button
              onClick={() => {
                setSubmissionResult(null);
                setAnswers({});
                setShowCelebration(false);
              }}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow transition"
            >
              🔄 إعادة حل الورقة من جديد
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition"
              >
                الانتهاء والخروج
              </button>
            )}
          </div>
        )}
      </main>

      {/* 3. شريط التسليم السفلي العائم الثابت (Sticky Bottom Submission Bar) */}
      {!isGraded && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 z-30 shadow-2xl">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
            {/* مؤشر إجمالي الأسئلة المحلولة */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">
                📝
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <span>تقدّم الحل:</span>
                  <span className="text-emerald-700 font-black">
                    {totalAnsweredCount} من أصل {answerableElements.length} أسئلة
                  </span>
                  {isAllAnswered && (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      ✓ مكتمل
                    </span>
                  )}
                </div>
                {/* شريط تقدّم بصري */}
                <div className="w-36 sm:w-48 bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-emerald-600 h-full transition-all duration-300"
                    style={{
                      width: `${answerableElements.length > 0 ? (totalAnsweredCount / answerableElements.length) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* أزرار التنقل السريعة والتسليم */}
            <div className="flex items-center gap-2 mr-auto">
              {pages.length > 1 && viewMode === 'single' && (
                <>
                  <button
                    type="button"
                    disabled={currentPageIndex === 0}
                    onClick={() => {
                      setCurrentPageIndex(prev => Math.max(0, prev - 1));
                      window.scrollTo({ top: 100, behavior: 'smooth' });
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs disabled:opacity-40 transition"
                  >
                    ⬅️ السابقة
                  </button>
                  <button
                    type="button"
                    disabled={currentPageIndex >= pages.length - 1}
                    onClick={() => {
                      setCurrentPageIndex(prev => Math.min(pages.length - 1, prev + 1));
                      window.scrollTo({ top: 100, behavior: 'smooth' });
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs disabled:opacity-40 transition"
                  >
                    التالية ➡️
                  </button>
                </>
              )}

              {/* زر التسليم الفوري النهائي */}
              <button
                type="button"
                onClick={handlePreSubmit}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>🚀</span>
                <span>{isSubmitting ? 'جارِ التصحيح...' : 'تسليم الإجابات'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. نافذة التنبيه عند محاولة التسليم مع وجود أسئلة دون إجابة (Unanswered Guard Modal) */}
      {showUnansweredConfirm && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-slate-900"
          dir="rtl"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-amber-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl">
                ⚠️
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  تنبيه: يوجد أسئلة لم تقم بحلها بعد!
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  تم حل {totalAnsweredCount} من أصل {unansweredSummary.total} سؤالاً
                </p>
              </div>
            </div>

            <div className="my-4 bg-amber-50 p-4 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-2">
              <p className="font-bold">
                يوجد <strong>{unansweredSummary.missing}</strong> أسئلة متبقية لم تقم بالإجابة عليها في:
              </p>
              <div className="flex gap-2 flex-wrap">
                {unansweredSummary.missingPages.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setShowUnansweredConfirm(false);
                      setCurrentPageIndex(p - 1);
                      if (viewMode === 'scroll') {
                        const target = document.getElementById(`page-section-${p - 1}`);
                        if (target) target.scrollIntoView({ behavior: 'smooth' });
                      } else {
                        window.scrollTo({ top: 100, behavior: 'smooth' });
                      }
                    }}
                    className="bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 font-extrabold px-3 py-1 rounded-lg text-xs transition"
                  >
                    الصفحة {p} 🔍
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-amber-800 pt-1">
                هل ترغب في العودة لحل الأسئلة المتبقية لزيادة درجتك، أم تفضل تسليم الورقة الآن كما هي؟
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowUnansweredConfirm(false);
                  if (unansweredSummary.missingPages.length > 0) {
                    const firstMissingPage = unansweredSummary.missingPages[0];
                    setCurrentPageIndex(firstMissingPage - 1);
                    if (viewMode === 'scroll') {
                      const target = document.getElementById(`page-section-${firstMissingPage - 1}`);
                      if (target) target.scrollIntoView({ behavior: 'smooth' });
                    } else {
                      window.scrollTo({ top: 100, behavior: 'smooth' });
                    }
                  }
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow transition active:scale-95"
              >
                🔙 العودة لإكمال الحل
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                className="py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition"
              >
                تسليم الورقة الآن 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
