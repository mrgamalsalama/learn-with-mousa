import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  X, Eraser, Trash2, Undo2, Sparkles, Star, Award, 
  RefreshCw, CheckCircle2, Volume2, VolumeX, ShieldAlert, Check,
  ChevronRight, ChevronLeft
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DrawingAnalysisResult, ChildBadge } from '../types';
import { analyzeChildDrawing, speakWithMousaVoice, stopMousaVoice } from '../geminiService';
import { saveStudentBadge, saveStudentPhonicsRecord, canUserUseAI, getCurrentUser, isAIFeatureAllowed } from '../storage';
import { ARABIC_ALPHABET, LetterPosition, ArabicLetterItem } from '../data/arabicLettersData';

interface DrawingCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
}

const COLORS = [
  '#0f172a', // أسود كحلي
  '#dc2626', // أحمر
  '#ea580c', // برتقالي
  '#eab308', // أصفر
  '#16a34a', // أخضر
  '#0284c7', // أزرق سماوي
  '#7c3aed', // بنفسجي
  '#854d0e', // بني
];

const BRUSH_SIZES = [
  { id: 'thin', label: 'رفيع', size: 3, dotClass: 'w-1.5 h-1.5' },
  { id: 'medium', label: 'متوسط', size: 7, dotClass: 'w-2.5 h-2.5' },
  { id: 'thick', label: 'عريض', size: 14, dotClass: 'w-4 h-4' },
];

export const DrawingCanvasModal: React.FC<DrawingCanvasModalProps> = ({
  isOpen,
  onClose,
  studentId
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const lettersScrollRef = useRef<HTMLDivElement | null>(null);

  // اختيار الحرف وموضعه
  const [selectedLetter, setSelectedLetter] = useState<ArabicLetterItem>(ARABIC_ALPHABET[1]); // الحرف الافتراضي: ب
  const [selectedPosition, setSelectedPosition] = useState<LetterPosition>('initial');

  // أدوات الرسم
  const [color, setColor] = useState('#0f172a');
  const [lineWidth, setLineWidth] = useState(7);
  const [brushSizeId, setBrushSizeId] = useState<'thin' | 'medium' | 'thick'>('medium');
  const [isEraser, setIsEraser] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  // حالة الذكاء الاصطناعي والتحليل
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DrawingAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSpeakingFeedback, setIsSpeakingFeedback] = useState<boolean>(false);

  const currentUser = getCurrentUser();
  const userPerm = canUserUseAI(currentUser);
  const isAIPermitted = userPerm.overrideStatus === 'inherit' 
    ? isAIFeatureAllowed('student').allowed 
    : userPerm.allowed;
  const aiBlockReason = userPerm.reason || isAIFeatureAllowed('student').reason;

  const currentPosData = selectedLetter.positions[selectedPosition];

  // حفظ لقطة للتراجع (Undo)
  const saveUndoSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > 20) {
      undoStackRef.current.shift();
    }
    setCanUndo(undoStackRef.current.length > 0);
  }, []);

  // التراجع خطوة واحدة للخلف
  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || undoStackRef.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const previousSnapshot = undoStackRef.current.pop();
    setCanUndo(undoStackRef.current.length > 0);

    if (previousSnapshot) {
      ctx.putImageData(previousSnapshot, 0, 0);
    }
  };

  // تهيئة اللوحة عند الفتح أو تغيير الحرف/الموضع
  useEffect(() => {
    stopMousaVoice();
    setIsSpeakingFeedback(false);

    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      undoStackRef.current = [];
      setCanUndo(false);
      setHasDrawn(false);
      setResult(null);
      setErrorMessage(null);
    }

    return () => {
      stopMousaVoice();
      setIsSpeakingFeedback(false);
    };
  }, [isOpen, selectedLetter, selectedPosition]);

  // أحداث الرسم بالماوس واللمس
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // حفظ الحالة الحالية قبل بداية الخط الجديد
    saveUndoSnapshot();

    setIsDrawing(true);
    setHasDrawn(true);

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.strokeStyle = isEraser ? '#ffffff' : color;
    ctx.lineWidth = isEraser ? lineWidth * 2.5 : lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.closePath();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      saveUndoSnapshot();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawn(false);
    setResult(null);
  };

  const handleBrushSizeChange = (id: 'thin' | 'medium' | 'thick', size: number) => {
    setBrushSizeId(id);
    setLineWidth(size);
    setIsEraser(false);
  };

  // تحليل الرسمة بواسطة Gemini AI
  const handleAnalyzeDrawing = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn || isLoading) return;

    if (!isAIPermitted) {
      setErrorMessage(aiBlockReason || 'ميزات الذكاء الاصطناعي معطلة حالياً.');
      return;
    }

    stopMousaVoice();
    setIsLoading(true);
    setResult(null);
    setErrorMessage(null);

    try {
      const base64Image = canvas.toDataURL('image/png');
      const res = await analyzeChildDrawing(selectedLetter.letter, base64Image, {
        positionLabel: currentPosData.label,
        letterForm: currentPosData.form,
        exampleWord: currentPosData.exampleWord,
      });
      setResult(res);

      if (res.starsCount >= 4) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      }

      // حفظ الوسام والإنجاز في ملف الطالب
      const badgeTitle = res.badgeEarned || `فنان حرف (${currentPosData.form}) 🎨`;
      const badge: ChildBadge = {
        id: 'badge_art_' + Date.now(),
        title: badgeTitle,
        description: `رسم موضع حرف (${currentPosData.form}) - ${res.recognizedObject}`,
        icon: '🎨',
        earnedAt: new Date().toLocaleDateString('ar-EG'),
        category: 'drawing',
      };
      saveStudentBadge(studentId, badge);

      saveStudentPhonicsRecord(studentId, {
        letter: selectedLetter.letter,
        word: res.recognizedObject,
        isCorrect: res.startsWithTargetLetter,
        type: 'drawing',
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e?.message || 'تعذر تحليل الرسمة بالذكاء الاصطناعي.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSpeakFeedback = () => {
    if (!result?.feedback) return;
    if (isSpeakingFeedback) {
      stopMousaVoice();
      setIsSpeakingFeedback(false);
    } else {
      stopMousaVoice();
      setIsSpeakingFeedback(true);
      speakWithMousaVoice(result.feedback, () => {
        setIsSpeakingFeedback(false);
      });
    }
  };

  const scrollLetters = (direction: 'left' | 'right') => {
    if (lettersScrollRef.current) {
      const offset = direction === 'left' ? -180 : 180;
      lettersScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 z-50 animate-in fade-in select-none">
      <div 
        id="drawing-canvas-modal"
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[96vh] flex flex-col border border-purple-200 shadow-2xl overflow-hidden text-slate-800"
        dir="rtl"
      >
        {/* 1. الترويسة المدمجة (Compact Header) */}
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-emerald-600 px-3.5 py-2.5 text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-purple-950 font-black flex items-center justify-center shadow-xs text-lg">
              🎨
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-sm sm:text-base leading-tight">لَوْحَةُ الرَّسْمِ وَالتَّعَرُّفِ البَصَرِيّ</h3>
                <span className="px-1.5 py-0.2 bg-white/20 rounded-md text-[10px] font-bold">
                  Gemini Vision AI
                </span>
              </div>
              <p className="text-[11px] text-purple-100 hidden sm:block">
                ارْسُمْ كَلِمَةَ الحَرْفِ أَوْ شَكْلَهُ وَدَعْ مُوسَى يَكْتَشِفْ إِبْدَاعَكَ! 🌟
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopMousaVoice();
              onClose();
            }}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition cursor-pointer"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. جسم المودال بدون أشرطة تمرير (Zero-Scroll Body) */}
        <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between overflow-hidden gap-2 bg-slate-50/70">
          {/* تنبيه الحظر أو الخطأ إن وجد */}
          {!isAIPermitted && (
            <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-[11px] shrink-0">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-bold">ميزات الذكاء الاصطناعي معطلة: {aiBlockReason}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-900 text-[11px] font-bold shrink-0">
              <span>⚠️ {errorMessage}</span>
            </div>
          )}

          {/* أ) قائمة الحروف الهجائية كاملة من (أ) إلى (ي) */}
          <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-2xs shrink-0">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500">اخْتَرِ الحَرْفَ:</span>
                <span className="text-xs font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                  حرف ({selectedLetter.letter}) - {selectedLetter.name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => scrollLetters('right')}
                  className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                  title="السابق"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollLetters('left')}
                  className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                  title="التالي"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div 
              ref={lettersScrollRef}
              className="flex gap-1 overflow-x-auto pb-1 no-scrollbar scroll-smooth"
            >
              {ARABIC_ALPHABET.map((item) => (
                <button
                  key={item.letter}
                  type="button"
                  onClick={() => setSelectedLetter(item)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg font-black text-xs sm:text-sm shrink-0 transition flex items-center justify-center cursor-pointer ${
                    selectedLetter.letter === item.letter
                      ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-400 scale-105'
                      : 'bg-slate-100 text-slate-700 hover:bg-purple-100 border border-slate-200/80'
                  }`}
                  title={`${item.name} (${item.letter})`}
                >
                  {item.letter}
                </button>
              ))}
            </div>
          </div>

          {/* ب) أزرار تبديل موضع الحرف (أول الكلمة، وسط الكلمة، آخر الكلمة متصل، آخر الكلمة منفصل) */}
          <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-2xs shrink-0">
            <div className="text-[11px] font-bold text-slate-500 mb-1.5 px-1 flex items-center justify-between">
              <span>مَوْضِعُ الحَرْفِ فِي الكَلِمَةِ:</span>
              <span className="text-emerald-700 font-extrabold text-[11px] flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <span>كَلِمَةُ المَوْضِع:</span>
                <span className="text-xs">{currentPosData.exampleWord}</span>
                <span>{currentPosData.exampleIcon}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(['initial', 'medial', 'final_connected', 'final_separate'] as LetterPosition[]).map((posKey) => {
                const posData = selectedLetter.positions[posKey];
                const isSelected = selectedPosition === posKey;
                return (
                  <button
                    key={posKey}
                    type="button"
                    onClick={() => setSelectedPosition(posKey)}
                    className={`p-1.5 sm:p-2 rounded-xl text-right transition border flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-500 shadow-sm'
                        : 'bg-slate-50 hover:bg-purple-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-[10px] font-bold ${isSelected ? 'text-purple-100' : 'text-slate-500'}`}>
                        {posData.label}
                      </span>
                      <span className={`text-sm sm:text-base font-black ${isSelected ? 'text-amber-300' : 'text-purple-700'}`}>
                        {posData.form}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] font-semibold truncate">
                      <span>{posData.exampleIcon}</span>
                      <span className={isSelected ? 'text-white' : 'text-slate-600'}>{posData.exampleWord}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* نص التحدي التلقائي بناءً على الحرف وموضعه المختار */}
            <div className="mt-1.5 text-[11px] text-slate-700 font-bold bg-amber-50/90 px-2.5 py-1.5 rounded-xl border border-amber-200/80 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate">
                ارْسُمْ شَيْئًا يُعَبِّرُ عَنْ حَرْفِ <b className="text-purple-700 font-black">({currentPosData.form})</b> فِي {currentPosData.label} مِثْلَ: <b className="text-emerald-700 font-black">({currentPosData.exampleWord} {currentPosData.exampleIcon})</b> أَوْ ارْسُمْ شَكْلَ الحَرْفِ!
              </span>
            </div>
          </div>

          {/* ج) شريط أدوات الرسم (الفرشاة، الألوان، التراجع، الممحاة، المسح) */}
          <div className="bg-white rounded-2xl px-2.5 py-1.5 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2 shrink-0">
            {/* باليت الألوان مع تحديد بصري بارز للون النشط */}
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => {
                const isActive = color === c && !isEraser;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setColor(c);
                      setIsEraser(false);
                    }}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-full transition-all duration-150 transform hover:scale-110 flex items-center justify-center cursor-pointer ${
                      isActive 
                        ? 'ring-3 ring-purple-600 ring-offset-2 scale-115 shadow-md z-10' 
                        : 'border border-black/10'
                    }`}
                    title={c}
                  >
                    {isActive && (
                      <Check className={`w-3.5 h-3.5 stroke-[3] ${c === '#eab308' ? 'text-slate-900' : 'text-white'}`} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* أحجام الفرشاة الثلاثة (رفيع، متوسط، عريض) */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              {BRUSH_SIZES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleBrushSizeChange(b.id as any, b.size)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                    brushSizeId === b.id && !isEraser
                      ? 'bg-white text-purple-900 shadow-xs border border-purple-200 font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title={`حجم الفرشاة: ${b.label}`}
                >
                  <span className={`rounded-full bg-current ${b.dotClass}`} />
                  <span>{b.label}</span>
                </button>
              ))}
            </div>

            {/* أدوات التراجع والممحاة ومسح اللوحة */}
            <div className="flex items-center gap-1.5">
              {/* زر تراجع خطوة Undo */}
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                className="px-2.5 py-1 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                title="تراجع خطوة واحدة للخلف"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>تراجع ↩️</span>
              </button>

              {/* زر الممحاة */}
              <button
                type="button"
                onClick={() => setIsEraser(!isEraser)}
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                  isEraser
                    ? 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
                title="تفعيل الممحاة"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>ممحاة</span>
              </button>

              {/* زر مسح اللوحة */}
              <button
                type="button"
                onClick={clearCanvas}
                className="px-2.5 py-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                title="مسح اللوحة بالكامل"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>مسح</span>
              </button>
            </div>
          </div>

          {/* د) مساحة اللوحة التفاعلية (Canvas) مصممة لتناسب الشاشة بدقة */}
          <div className="bg-white rounded-2xl p-1.5 border-2 border-purple-200 shadow-inner flex flex-col items-center justify-center shrink-0 relative">
            <canvas
              ref={canvasRef}
              width={560}
              height={230}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full max-w-[560px] h-[180px] sm:h-[210px] border border-dashed border-slate-300 rounded-xl cursor-crosshair touch-none bg-white"
            />

            {/* تلميح شفاف للرسم عند فراغ اللوحة */}
            {!hasDrawn && !result && (
              <div className="absolute pointer-events-none inset-0 flex items-center justify-center flex-col text-slate-300 gap-1 opacity-70">
                <span className="text-3xl font-black">{currentPosData.form}</span>
                <span className="text-[11px] font-bold text-slate-400">
                  ارْسُمْ هُنَا بَقَلَمِكَ الجَمِيلِ ✏️
                </span>
              </div>
            )}

            {/* نافذة النتيجة المنبثقة فوق اللوحة عند الانتهاء من التحليل دون الحاجة للتمرير */}
            {result && (
              <div className="absolute inset-2 bg-white/95 backdrop-blur-xs rounded-xl p-3 border-2 border-purple-400 shadow-xl flex flex-col justify-between z-20 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                  <div>
                    <h4 className="font-black text-sm text-purple-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>العُنْصُرُ المُكْتَشَف: {result.recognizedObject}</span>
                    </h4>
                    <span className="text-[10px] text-slate-500 font-bold">
                      دقة الرؤية بالذكاء الاصطناعي: {result.confidenceScore}%
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-amber-100/90 px-2 py-1 rounded-xl border border-amber-300">
                    {Array.from({ length: result.starsCount }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                    ))}
                  </div>
                </div>

                {/* تعليق موسى الصوتي */}
                <div className="bg-purple-50/80 p-2 rounded-xl border border-purple-100 my-1.5 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-800 leading-relaxed flex-1 line-clamp-2">
                    {result.feedback}
                  </p>
                  <button
                    type="button"
                    onClick={handleToggleSpeakFeedback}
                    className={`px-2.5 py-1 rounded-lg transition shrink-0 flex items-center gap-1 text-[10px] font-bold cursor-pointer ${
                      isSpeakingFeedback
                        ? 'bg-amber-200 text-amber-950 border border-amber-300 animate-pulse'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                  >
                    {isSpeakingFeedback ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span>{isSpeakingFeedback ? 'إيقاف ⏸️' : 'صوت موسى 🔊'}</span>
                  </button>
                </div>

                {/* الوسام وزر المتابعة */}
                <div className="flex items-center justify-between pt-1 border-t border-purple-100">
                  {result.badgeEarned ? (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                      <Award className="w-3.5 h-3.5 text-amber-600" />
                      <span>{result.badgeEarned}</span>
                    </div>
                  ) : <div />}

                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      clearCanvas();
                    }}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer shadow-xs"
                  >
                    ارسم تحدياً جديداً 🎨
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* هـ) زر التحليل الثابت والمباشر أسفل اللوحة (Fixed Analysis Button) */}
          <div className="shrink-0 pt-0.5">
            <button
              type="button"
              onClick={handleAnalyzeDrawing}
              disabled={!hasDrawn || isLoading || !isAIPermitted}
              className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed text-white font-black rounded-2xl text-xs sm:text-sm transition shadow-md shadow-purple-200 flex items-center justify-center gap-2 transform active:scale-98 cursor-pointer"
              title={!isAIPermitted ? aiBlockReason : 'تحليل الرسمة بالذكاء الاصطناعي'}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                  <span>الذَّكَاءُ الاصْطِنَاعِيُّ يَتَفَحَّصُ رَسْمَتَكَ الآن... 🎨</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{!isAIPermitted ? 'الذكاء الاصطناعي معطل' : 'تَحْلِيلُ الرَّسْمَةِ بِالذَّكَاءِ الاصْطِنَاعِيّ 🚀'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
