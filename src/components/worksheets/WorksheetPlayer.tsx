import React, { useState, useEffect, useRef } from 'react';
import { 
  InteractiveWorksheet, 
  WorksheetSubmission, 
  UserProfile 
} from '../../types';
import { 
  fetchWorksheetById, 
  gradeWorksheetSubmission, 
  submitWorksheetAnswers, 
  normalizeArabicText 
} from '../../services/worksheetService';

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

  // دعم الصفحات المتعددة ومستندات الـ PDF
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);

  // حالة التوصيل التفاعلي بالخطوط (Join Lines interaction)
  const [activeSourcePointId, setActiveSourcePointId] = useState<string | null>(null);
  
  const canvasContainerRef = useRef<HTMLDivElement>(null);

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

  // قائمة الصفحات
  const pages = (worksheet?.pages && worksheet.pages.length > 0)
    ? worksheet.pages
    : [worksheet?.image_url || worksheet?.background_url || ''];

  const currentImageUrl = pages[currentPageIndex] || pages[0] || '';

  // عناصر الصفحة المعروضة حالياً
  const currentPageElements = (worksheet?.elements || []).filter(
    el => (el.page || 1) === (currentPageIndex + 1)
  );

  // تحديث إجابة الطالب لعنصر ما
  const handleAnswerChange = (elementId: string, value: any) => {
    if (submissionResult) return; // مقفل بعد التسليم
    setAnswers(prev => ({
      ...prev,
      [elementId]: value
    }));
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

  // تسليم الإجابات والتصحيح التلقائي الفوري
  const handleSubmit = async () => {
    if (!worksheet) return;

    // التحقق من اسم الطالب في الرابط العام الزائر
    const finalStudentName = currentUser?.name || guestName.trim();
    if (!currentUser && !guestName.trim()) {
      alert('يرجى كتابة اسمك الثلاثي قبل تسليم الإجابات لكي يتم رصد درجتك بنجاح!');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. التصحيح التلقائي الدقيق لكافة أنواع الأسئلة
      const grading = gradeWorksheetSubmission(worksheet, answers);

      // 2. إعداد كائن التسليم
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

      // 3. الحفظ السحابي والمحلي
      await submitWorksheetAnswers(submission);

      setSubmissionResult(submission);
      setShowCelebration(grading.percentage >= 60);

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
        <p className="text-xs text-slate-500 mt-1">يتم الآن تجهيز الحقول التفاعلية والتصحيح الذاتي</p>
      </div>
    );
  }

  if (errorMessage || !worksheet) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center font-sans" dir="rtl">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-lg border border-slate-200">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">ورقة العمل غير متوفرة</h2>
          <p className="text-sm text-slate-600 mb-6">{errorMessage || 'لم يتم العثور على ورقة العمل'}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition"
            >
              العودة للرئيسية
            </button>
          )}
        </div>
      </div>
    );
  }

  const isGraded = Boolean(submissionResult);
  const breakdown = submissionResult?.results_breakdown || {};

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none" dir="rtl">
      {/* شريط الإنجاز العلوي */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3 shadow-sm">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-700 transition"
                title="إغلاق"
              >
                <svg className="w-5 h-5 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  ورقة عمل تفاعلية
                </span>
                <span className="text-xs text-slate-500">
                  {worksheet.elements.length} أسئلة • الدرجة الكلية: {worksheet.total_points || 20}
                  {pages.length > 1 && ` • ${pages.length} صفحات`}
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate max-w-md">
                {worksheet.title}
              </h1>
            </div>
          </div>

          {/* لوحة النتائج بعد التصحيح أو زر التسليم */}
          <div className="flex items-center gap-3">
            {isGraded ? (
              <div className="flex items-center gap-3 bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-md animate-in fade-in">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-semibold">النتيجة النهائية</span>
                  <span className="text-base font-extrabold text-emerald-400">
                    {submissionResult?.score} / {submissionResult?.total_score} ({submissionResult?.percentage}%)
                  </span>
                </div>
                <div className="text-2xl">
                  {(submissionResult?.percentage || 0) >= 80 ? '🌟' : (submissionResult?.percentage || 0) >= 50 ? '👍' : '💪'}
                </div>
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-extrabold rounded-2xl shadow-lg flex items-center gap-2 transition transform hover:scale-[1.02] disabled:opacity-50"
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
        <div className="bg-amber-500/10 border-b border-amber-200 px-4 py-3">
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

      {/* شريط التنقل بين الصفحات في مستندات PDF متعددة الصفحات */}
      {pages.length > 1 && (
        <div className="bg-white border-b border-slate-200 py-2.5 px-4 shadow-xs sticky top-[65px] z-20">
          <div className="max-w-4xl mx-auto flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-700 font-bold">
              <span>📄</span>
              <span>الصفحة {currentPageIndex + 1} من {pages.length}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPageIndex === 0}
                onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold disabled:opacity-40 transition"
              >
                السابق ⬅️
              </button>

              <div className="flex gap-1.5">
                {pages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPageIndex(i)}
                    className={`w-7 h-7 rounded-xl font-bold text-xs transition ${
                      currentPageIndex === i
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                disabled={currentPageIndex >= pages.length - 1}
                onClick={() => setCurrentPageIndex(prev => Math.min(pages.length - 1, prev + 1))}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold disabled:opacity-40 transition"
              >
                ➡️ التالي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* لوحة الاحتفال بالنجاح والتهنئة الفورية */}
      {showCelebration && submissionResult && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-4 py-4 text-center shadow-md animate-in slide-in-from-top-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎉</span>
              <div className="text-right">
                <h3 className="font-extrabold text-sm sm:text-base">
                  أحسنت صنعاً يا بطل! تم تصحيح ورقتك وحفظ إجابتك بنجاح
                </h3>
                <p className="text-xs text-emerald-100">
                  حصلت على {submissionResult.score} من {submissionResult.total_score} بنسبة إتقان {submissionResult.percentage}%
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
          <div className="w-full max-w-[800px] bg-white rounded-2xl p-3 mb-4 text-xs text-slate-700 border border-slate-200 shadow-sm flex items-center gap-2">
            <span className="text-base text-emerald-600">📌</span>
            <span>{worksheet.description}</span>
          </div>
        )}

        {/* حاوية الورقة بالخلفية والحقول التفاعلية التراكبية */}
        <div
          ref={canvasContainerRef}
          className="relative w-full max-w-[800px] bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-300 select-text"
          style={{ minHeight: '900px' }}
        >
          {/* صورة الورقة الأصلية للصفحة الحالية */}
          <img
            src={currentImageUrl}
            alt={`ورقة العمل - صفحة ${currentPageIndex + 1}`}
            className="w-full h-auto block select-none pointer-events-none"
            draggable={false}
          />

          {/* خطوط التوصيل (SVG overlay lines) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            {currentPageElements
              .filter(el => el.type === 'join_point' && el.joinRole === 'source')
              .map(sourceEl => {
                const connectedTargetId = answers[sourceEl.id];
                if (!connectedTargetId) return null;
                const targetEl = currentPageElements.find(item => item.id === connectedTargetId);
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

          {/* الحقول التفاعلية التراكبية (Interactive Inputs Overlay) */}
          {currentPageElements.map((el) => {
            const studentAns = answers[el.id];
            const result = breakdown[el.id];

            // تخصيص مظهر الحقل قبل وبعد التصحيح
            let containerBorder = 'border-blue-400 bg-white/90 hover:border-blue-600 shadow-sm';
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
    </div>
  );
};
