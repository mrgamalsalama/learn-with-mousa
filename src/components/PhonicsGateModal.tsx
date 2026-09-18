import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Volume2, Sparkles, CheckCircle2, 
  AlertCircle, Unlock, Lock, Award, RefreshCw, Star, ChevronLeft
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PhonicsVerificationResult, ChildBadge } from '../types';
import { verifyPhonicsWord, speakWithMousaVoice, stopMousaVoice, prebufferMousaAudio } from '../geminiService';
import { saveStudentBadge, saveStudentPhonicsRecord } from '../storage';
import { ChildMicWaveVisualizer, MousaSpeakingAvatar } from './AudioInteractionVisualizer';

interface PhonicsGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
}

const LETTERS_CONFIG: { letter: string; name: string; sound: string; examples: string[] }[] = [
  { letter: 'أ', name: 'الأَلِف', sound: 'أَ - أُ - إِ', examples: ['أَرْنَبٌ', 'أَسَدٌ', 'أُمِّي'] },
  { letter: 'ب', name: 'البَاء', sound: 'بَ - بُ - بِ', examples: ['بَطَّةٌ', 'بَيْتٌ', 'بُرْتُقَالٌ'] },
  { letter: 'ت', name: 'التَّاء', sound: 'تَ - تُ - تِ', examples: ['تُفَّاحٌ', 'تِمْسَاحٌ', 'تَاجٌ'] },
  { letter: 'ث', name: 'الثَّاء', sound: 'ثَ - ثُ - ثِ', examples: ['ثَعْلَبٌ', 'ثَوْبٌ', 'ثِمَارٌ'] },
  { letter: 'ج', name: 'الجِيم', sound: 'جَ - جُ - جِ', examples: ['جَمَلٌ', 'جَبَلٌ', 'جَزَرٌ'] },
  { letter: 'ح', name: 'الحَاء', sound: 'حَ - حُ - حِ', examples: ['حِصَانٌ', 'حَلِيبٌ', 'حَمَامَةٌ'] },
  { letter: 'خ', name: 'الخَاء', sound: 'خَ - خُ - خِ', examples: ['خَرُوفٌ', 'خُبْزٌ', 'خَيْمَةٌ'] },
  { letter: 'د', name: 'الدَّال', sound: 'دَ - دُ - دِ', examples: ['دُبٌّ', 'دَرَاجَةٌ', 'دِيكٌ'] },
  { letter: 'ر', name: 'الرَّاء', sound: 'رَ - رُ - رِ', examples: ['رُمَّانٌ', 'رَبِيعٌ', 'رَسَّامٌ'] },
  { letter: 'س', name: 'السِّين', sound: 'سَ - سُ - سِ', examples: ['سَمَكَةٌ', 'سَفِينَةٌ', 'سَاعَةٌ'] },
  { letter: 'ص', name: 'الصَّاد', sound: 'صَ - صُ - صِ', examples: ['صَقْرٌ', 'صَابُونٌ', 'صَنْدُوقٌ'] },
  { letter: 'ض', name: 'الضَّاد', sound: 'ضَ - ضُ - ضِ', examples: ['ضِفْدَعٌ', 'ضِرْسٌ', 'ضَوْءٌ'] },
  { letter: 'ط', name: 'الطَّاء', sound: 'طَ - طُ - طِ', examples: ['طَيَّارَةٌ', 'طَبِيبٌ', 'طَاوُوسٌ'] },
  { letter: 'م', name: 'المِيم', sound: 'مَ - مُ - مِ', examples: ['مَسْجِدٌ', 'مَوْزٌ', 'مَطَرٌ'] },
];

export const PhonicsGateModal: React.FC<PhonicsGateModalProps> = ({
  isOpen,
  onClose,
  studentId
}) => {
  const [currentLetterIndex, setCurrentLetterIndex] = useState(1); // حرف الباء افتراضياً
  const [inputWord, setInputWord] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PhonicsVerificationResult | null>(null);
  const [gateUnlocked, setGateUnlocked] = useState(false);

  const recognitionRef = useRef<any>(null);
  const currentConfig = LETTERS_CONFIG[currentLetterIndex];

  // التوليد الاستباقي (Pre-buffering) لأصوات الحرف الحالي والأمثلة
  useEffect(() => {
    if (!isOpen || !currentConfig) return;

    prebufferMousaAudio([
      `صَوْتُ حَرْفِ ${currentConfig.name}: ${currentConfig.sound}`,
      currentConfig.sound,
      ...currentConfig.examples
    ]);
  }, [isOpen, currentLetterIndex, currentConfig]);

  const toggleMic = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('التعرف الصوتي غير مدعوم في هذا المتصفح، يمكنك كتابة الكلمة أو اختيار كلمة مقترحة!');
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = 'ar-SA';
      rec.continuous = false;
      rec.interimResults = false;

      rec.onstart = () => setIsListening(true);
      rec.onresult = (event: any) => {
        const spoken = event.results[0][0].transcript;
        setInputWord(spoken);
        setIsListening(false);
        handleVerify(spoken);
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);

      recognitionRef.current = rec;
      rec.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleVerify = async (wordToVerify?: string) => {
    const word = (wordToVerify ?? inputWord).trim();
    if (!word || isLoading) return;

    stopMousaVoice();
    setIsLoading(true);
    setResult(null);

    try {
      const res = await verifyPhonicsWord(currentConfig.letter, word);
      setResult(res);

      if (res.startsCorrectly) {
        setGateUnlocked(true);
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 }
        });

        // حفظ الوسام وسجل النطق
        const badge: ChildBadge = {
          id: 'badge_phonics_' + Date.now(),
          title: res.badgeName || `فارس حرف (${currentConfig.letter}) 🏅`,
          description: `أتقن نطق كلمة تبدأ بحرف (${currentConfig.letter}): ${res.formedWord}`,
          icon: '🎖️',
          earnedAt: new Date().toLocaleDateString('ar-EG'),
          category: 'phonics',
        };
        saveStudentBadge(studentId, badge);

        saveStudentPhonicsRecord(studentId, {
          letter: currentConfig.letter,
          word: res.formedWord,
          isCorrect: true,
          type: 'voice',
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        });

        speakWithMousaVoice(res.encouragement);
      } else {
        setGateUnlocked(false);
        saveStudentPhonicsRecord(studentId, {
          letter: currentConfig.letter,
          word,
          isCorrect: false,
          type: 'voice',
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        });
        speakWithMousaVoice(res.encouragement);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const nextLetterGate = () => {
    stopMousaVoice();
    setGateUnlocked(false);
    setResult(null);
    setInputWord('');
    setCurrentLetterIndex((prev) => (prev + 1) % LETTERS_CONFIG.length);
  };

  const playLetterSound = () => {
    speakWithMousaVoice(`صَوْتُ حَرْفِ ${currentConfig.name}: ${currentConfig.sound}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in">
      <div 
        id="phonics-gate-modal"
        className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col border border-emerald-200 shadow-2xl overflow-hidden"
        dir="rtl"
      >
        {/* الترويسة */}
        <div className="bg-gradient-to-r from-amber-500 via-emerald-600 to-teal-600 p-4 sm:p-5 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white text-emerald-700 font-black flex items-center justify-center shadow-md text-2xl">
              🚪
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg">بَوَّابَةُ التَّحَدِّي وَالكَلِمَةِ السِّحْرِيَّة</h3>
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold">
                  Phonics Gate
                </span>
              </div>
              <p className="text-xs text-emerald-100">
                انْطِقِ الكَلِمَةَ السِّحْرِيَّةَ لِتَفْتَحَ البَوَّابَةَ وَتَنَالَ الوِسَام! 🌟
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

        {/* جسم البوابة التفاعلية */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
          {/* بطاقة الحرف المستهدف والبوابة */}
          <div className={`p-6 rounded-3xl text-center border-2 transition duration-300 relative overflow-hidden ${
            gateUnlocked
              ? 'bg-gradient-to-br from-emerald-50 via-white to-amber-50 border-emerald-400 shadow-lg shadow-emerald-100'
              : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-500">
                بَوَّابَةُ رَقْم {currentLetterIndex + 1} مِنْ {LETTERS_CONFIG.length}
              </span>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                gateUnlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {gateUnlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span>{gateUnlocked ? 'البَوَّابَةُ مَفْتُوحَةٌ! 🎉' : 'البَوَّابَةُ مُغْلَقَة'}</span>
              </div>
            </div>

            {/* الحرف الكبير */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-5xl sm:text-6xl shadow-xl shadow-emerald-600/30 transform hover:scale-105 transition mb-3">
              {currentConfig.letter}
            </div>

            <h4 className="text-lg font-black text-slate-800 mb-1">
              حَرْفُ {currentConfig.name}
            </h4>
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                الأَصْوَات: {currentConfig.sound}
              </span>
              <button
                type="button"
                onClick={playLetterSound}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                title="استمع لنطق الحرف"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 font-medium max-w-sm mx-auto">
              هَاتِ كَلِمَةً عَرَبِيَّةً تَبْدَأُ بِحَرْفِ [ <b>{currentConfig.letter}</b> ] وَانْطِقْهَا أَوْ اكْتُبْهَا!
            </p>
          </div>

          {/* حقل الإدخال والنطق المباشر */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <ChildMicWaveVisualizer
                isListening={isListening}
                onClick={toggleMic}
                size="md"
              />

              <input
                type="text"
                value={inputWord}
                onChange={(e) => setInputWord(e.target.value)}
                placeholder={isListening ? 'تحدث الآن يا بطل...' : `اكتب أو انطق كلمة لحرف (${currentConfig.letter})...`}
                className="flex-1 px-4 py-3.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/70 font-semibold"
              />

              <button
                type="button"
                onClick={() => handleVerify()}
                disabled={!inputWord.trim() || isLoading}
                className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-2xl transition flex items-center gap-1.5 shadow-md shadow-emerald-200 shrink-0"
              >
                {isLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>تَحَقَّق</span>
                  </>
                )}
              </button>
            </div>

            {/* اقتراحات مساعدة سريعة */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400 font-bold">كلمات مقترحة:</span>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {currentConfig.examples.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setInputWord(ex);
                      handleVerify(ex);
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 rounded-lg text-xs font-bold transition"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* نتيجة التحقق من الذكاء الاصطناعي */}
          {result && (
            <div className={`p-5 rounded-3xl border-2 transition animate-in fade-in space-y-3 ${
              result.startsCorrectly 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950' 
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {result.startsCorrectly ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-extrabold text-sm">
                      {result.startsCorrectly ? 'كَلِمَةٌ سِحْرِيَّةٌ رَائِعَة!' : 'حَاوِلْ مَرَّةً أُخْرَى يَا بَطَل!'}
                    </h4>
                    <p className="text-xs font-semibold mt-0.5">{result.formedWord}</p>
                  </div>
                </div>

                {result.startsCorrectly && (
                  <span className="px-3 py-1 bg-amber-400 text-emerald-950 font-black rounded-xl text-xs shadow-xs">
                    +{result.scoreAwarded} نِقَاط 🌟
                  </span>
                )}
              </div>

              <p className="text-xs font-medium leading-relaxed bg-white/60 p-3 rounded-xl border border-black/5">
                {result.encouragement}
              </p>

              {result.meaningSimple && (
                <p className="text-[11px] text-slate-600">
                  💡 <b>المعنى:</b> {result.meaningSimple}
                </p>
              )}

              {result.badgeName && (
                <div className="flex items-center gap-2 p-2.5 bg-amber-100/80 rounded-xl border border-amber-300 text-xs font-bold text-amber-900">
                  <Award className="w-5 h-5 text-amber-600" />
                  <span>تَمَّ مَنْحُكَ: {result.badgeName}</span>
                </div>
              )}

              {result.startsCorrectly && (
                <button
                  type="button"
                  onClick={nextLetterGate}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md shadow-emerald-200 mt-2"
                >
                  <span>الانْتِقَالُ لِلْبَوَّابَةِ التَّالِيَة</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
