import React, { useRef, useState, useEffect } from 'react';
import { 
  X, Palette, Eraser, Trash2, Sparkles, Star, Award, 
  RefreshCw, CheckCircle2, Volume2, VolumeX, HelpCircle, ShieldAlert
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DrawingAnalysisResult, ChildBadge } from '../types';
import { analyzeChildDrawing, speakWithMousaVoice, stopMousaVoice } from '../geminiService';
import { saveStudentBadge, saveStudentPhonicsRecord, canUserUseAI, getCurrentUser, isAIFeatureAllowed } from '../storage';

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

const DRAWING_LETTERS = [
  { letter: 'ب', prompt: 'ارْسُمْ شَيْئًا يَبْدَأُ بِحَرْفِ (ب) مِثْلَ: بَطَّة، بَيْت، أَوْ بُرْتُقَالَة 🦆' },
  { letter: 'أ', prompt: 'ارْسُمْ شَيْئًا يَبْدَأُ بِحَرْفِ (أ) مِثْلَ: أَرْنَب، أَسَد، أَوْ إِبْرِيق 🐰' },
  { letter: 'ت', prompt: 'ارْسُمْ شَيْئًا يَبْدَأُ بِحَرْفِ (ت) مِثْلَ: تُفَّاحَة، تَاج، أَوْ تِمْسَاح 🍎' },
  { letter: 'س', prompt: 'ارْسُمْ شَيْئًا يَبْدَأُ بِحَرْفِ (س) مِثْلَ: سَمَكَة، سَفِينَة، أَوْ سَاعَة 🐟' },
  { letter: 'ش', prompt: 'ارْسُمْ شَيْئًا يَبْدَأُ بِحَرْفِ (ش) مِثْلَ: شَمْس، شَجَرَة، أَوْ شِرَاع ☀️' },
  { letter: 'م', prompt: 'ارْسُمْ شَيْئًا يَبْدَأُ بِحَرْفِ (م) مِثْلَ: مَسْجِد، مَوْز، أَوْ مَظَلَّة 🕌' },
];

export const DrawingCanvasModal: React.FC<DrawingCanvasModalProps> = ({
  isOpen,
  onClose,
  studentId
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedLetterIndex, setSelectedLetterIndex] = useState(0);
  const [color, setColor] = useState('#0f172a');
  const [lineWidth, setLineWidth] = useState(6);
  const [isEraser, setIsEraser] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
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

  const currentItem = DRAWING_LETTERS[selectedLetterIndex];

  // إعداد اللوحة عند الفتح
  useEffect(() => {
    stopMousaVoice();
    setIsSpeakingFeedback(false);

    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // خلفية بيضاء نقية لضمان دقة الرؤية بالذكاء الاصطناعي
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      setHasDrawn(false);
      setResult(null);
    }

    return () => {
      stopMousaVoice();
      setIsSpeakingFeedback(false);
    };
  }, [isOpen, selectedLetterIndex]);

  // أحداث الرسم بالماوس واللمس
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
    ctx.lineWidth = lineWidth;
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
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawn(false);
    setResult(null);
  };

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
      const res = await analyzeChildDrawing(currentItem.letter, base64Image);
      setResult(res);

      if (res.starsCount >= 4) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      }

      // حفظ الوسام والإنجاز
      const badgeTitle = res.badgeEarned || `فنان حرف (${currentItem.letter}) 🎨`;
      const badge: ChildBadge = {
        id: 'badge_art_' + Date.now(),
        title: badgeTitle,
        description: `رسم عنصراً يمثل حرف (${currentItem.letter}) - ${res.recognizedObject}`,
        icon: '🎨',
        earnedAt: new Date().toLocaleDateString('ar-EG'),
        category: 'drawing',
      };
      saveStudentBadge(studentId, badge);

      saveStudentPhonicsRecord(studentId, {
        letter: currentItem.letter,
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in">
      <div 
        id="drawing-canvas-modal"
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col border border-emerald-200 shadow-2xl overflow-hidden"
        dir="rtl"
      >
        {/* الترويسة */}
        <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-600 p-4 sm:p-5 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-purple-950 font-black flex items-center justify-center shadow-md text-2xl">
              🎨
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg">لَوْحَةُ الرَّسْمِ وَالتَّعَرُّفِ البَصَرِيّ</h3>
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold">
                  Gemini Vision AI
                </span>
              </div>
              <p className="text-xs text-purple-100">
                ارْسُمْ كَلِمَةَ الحَرْفِ وَدَعْ مُوسَى يَكْتَشِفْ إِبْدَاعَكَ! 🌟
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
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* جسم النافذة */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/50">
          {!isAIPermitted && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <span className="font-bold block">ميزات الذكاء الاصطناعي معطلة عن حسابك</span>
                <span className="text-[11px] text-rose-600">{aiBlockReason}</span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2 text-amber-900 text-xs font-bold">
              <span>⚠️ {errorMessage}</span>
            </div>
          )}

          {/* شريط اختيار الحرف التحدي */}
          <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">تحدي الرسم الحالي:</span>
              <span className="text-xs font-bold text-emerald-700">حرف ({currentItem.letter})</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {DRAWING_LETTERS.map((item, idx) => (
                <button
                  key={item.letter}
                  type="button"
                  onClick={() => setSelectedLetterIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs shrink-0 transition flex items-center gap-1.5 ${
                    selectedLetterIndex === idx
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-300'
                      : 'bg-slate-100 text-slate-700 hover:bg-purple-50 border border-slate-200'
                  }`}
                >
                  <span className="text-base font-black">{item.letter}</span>
                  <span>{idx === 0 ? 'بطة' : idx === 1 ? 'أرنب' : idx === 2 ? 'تفاح' : idx === 3 ? 'سمكة' : idx === 4 ? 'شمس' : 'مسجد'}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 font-semibold mt-2.5 bg-purple-50/80 p-2.5 rounded-xl border border-purple-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
              <span>{currentItem.prompt}</span>
            </p>
          </div>

          {/* شريط أدوات الرسم (الألوان والأحجام) */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            {/* باليت الألوان */}
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    setIsEraser(false);
                  }}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-full transition transform hover:scale-110 ${
                    color === c && !isEraser ? 'ring-3 ring-purple-500 scale-110 shadow-md' : ''
                  }`}
                />
              ))}
            </div>

            {/* أدوات الممحاة ومسح اللوحة */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEraser(!isEraser)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                  isEraser
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>ممحاة</span>
              </button>

              <button
                type="button"
                onClick={clearCanvas}
                className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>مسح</span>
              </button>
            </div>
          </div>

          {/* مساحة اللوحة التفاعلية */}
          <div className="bg-white rounded-3xl p-2 border-2 border-purple-200 shadow-md flex flex-col items-center justify-center">
            <canvas
              ref={canvasRef}
              width={560}
              height={320}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full max-w-[560px] h-[260px] sm:h-[300px] border border-dashed border-slate-300 rounded-2xl cursor-crosshair touch-none bg-white"
            />
          </div>

          {/* زر الفحص والتحليل بالذكاء الاصطناعي */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={handleAnalyzeDrawing}
              disabled={!hasDrawn || isLoading || !isAIPermitted}
              className="px-8 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed text-white font-black rounded-2xl text-sm transition shadow-lg shadow-purple-200 flex items-center gap-2 transform active:scale-98"
              title={!isAIPermitted ? aiBlockReason : 'تحليل الرسمة'}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>الذَّكَاءُ الاصْطِنَاعِيُّ يَتَفَحَّصُ رَسْمَتَكَ الآن... 🎨</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  <span>{!isAIPermitted ? 'الذكاء الاصطناعي معطل' : 'تَحْلِيلُ الرَّسْمَةِ بِالذَّكَاءِ الاصْطِنَاعِيّ 🚀'}</span>
                </>
              )}
            </button>
          </div>

          {/* نتيجة التحليل البصري من Gemini */}
          {result && (
            <div className="p-5 bg-gradient-to-br from-purple-50 via-white to-amber-50 rounded-3xl border-2 border-purple-300 shadow-md space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-base text-purple-950 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>العُنْصُرُ المُكْتَشَف: {result.recognizedObject}</span>
                  </h4>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">
                    دقة الفهم البصري: {result.confidenceScore}%
                  </p>
                </div>

                {/* النجوم */}
                <div className="flex items-center gap-1 bg-amber-100/90 px-3 py-1.5 rounded-2xl border border-amber-300">
                  {Array.from({ length: result.starsCount }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-500 fill-amber-400" />
                  ))}
                </div>
              </div>

              {/* تعليق موسى المشكول */}
              <div className="p-4 bg-white rounded-2xl border border-purple-100 shadow-xs flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800 leading-relaxed flex-1">
                  {result.feedback}
                </p>
                <button
                  type="button"
                  onClick={handleToggleSpeakFeedback}
                  className={`px-3 py-1.5 rounded-xl transition shrink-0 flex items-center gap-1.5 text-xs font-bold ${
                    isSpeakingFeedback
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-purple-100 hover:bg-purple-200 text-purple-800'
                  }`}
                  title={isSpeakingFeedback ? 'إيقاف الاستماع' : 'استمع لتعليق موسى بصوته الأصلي'}
                >
                  {isSpeakingFeedback ? <VolumeX className="w-4 h-4 text-amber-700" /> : <Volume2 className="w-4 h-4" />}
                  <span>{isSpeakingFeedback ? 'إيقاف ⏸️' : 'استمع 🔊'}</span>
                </button>
              </div>

              {result.badgeEarned && (
                <div className="flex items-center gap-2 p-3 bg-amber-100/80 rounded-xl border border-amber-300 text-xs font-bold text-amber-900">
                  <Award className="w-5 h-5 text-amber-600" />
                  <span>تَمَّ مَنْحُكَ: {result.badgeEarned}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
