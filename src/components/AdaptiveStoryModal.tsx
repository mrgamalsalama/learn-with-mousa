import React, { useState, useEffect } from 'react';
import { 
  X, BookOpen, Volume2, Sparkles, Award, ArrowLeft, 
  CheckCircle2, RefreshCw, Compass, BookmarkCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AdaptiveStoryNode, ChildBadge } from '../types';
import { generateAdaptiveStoryScene, speakArabicText, stopArabicSpeech } from '../geminiService';
import { saveStudentBadge } from '../storage';

interface AdaptiveStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
}

const ARABIC_LETTERS = [
  'أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'هـ', 'و', 'ي'
];

export const AdaptiveStoryModal: React.FC<AdaptiveStoryModalProps> = ({
  isOpen,
  onClose,
  studentId
}) => {
  const [selectedLetter, setSelectedLetter] = useState<string>('ب');
  const [storyTopic, setStoryTopic] = useState<string>('مُغَامَرَةٌ فِي البُسْتَانِ البَدِيع');
  const [currentNode, setCurrentNode] = useState<AdaptiveStoryNode | null>(null);
  const [storyHistory, setStoryHistory] = useState<AdaptiveStoryNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [earnedBadge, setEarnedBadge] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      stopArabicSpeech();
    };
  }, []);

  const startNewStory = async (letterToUse = selectedLetter) => {
    stopArabicSpeech();
    setIsSpeaking(false);
    setIsLoading(true);
    setEarnedBadge(null);
    setStoryHistory([]);

    try {
      const firstScene = await generateAdaptiveStoryScene({
        letter: letterToUse,
        topic: storyTopic,
        stepNumber: 1,
      });

      setCurrentNode(firstScene);
      setStoryHistory([firstScene]);

      speakArabicText(firstScene.passage, () => setIsSpeaking(false));
      setIsSpeaking(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChooseOption = async (chosenOption: string) => {
    if (!currentNode || isLoading) return;

    stopArabicSpeech();
    setIsSpeaking(false);
    setIsLoading(true);

    const nextStep = currentNode.step + 1;

    try {
      const nextScene = await generateAdaptiveStoryScene({
        letter: selectedLetter,
        topic: storyTopic,
        previousScene: currentNode.passage,
        chosenOption,
        stepNumber: nextStep,
      });

      setCurrentNode(nextScene);
      setStoryHistory(prev => [...prev, nextScene]);

      speakArabicText(nextScene.passage, () => setIsSpeaking(false));
      setIsSpeaking(true);

      if (nextScene.isEnding) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });

        const badgeTitle = nextScene.badgeEarned || `حكواتي حرف (${selectedLetter}) المبدع 🏆`;
        setEarnedBadge(badgeTitle);

        const newBadge: ChildBadge = {
          id: 'badge_' + Date.now(),
          title: badgeTitle,
          description: `أتم قصة تكيفية مشوقة لحرف (${selectedLetter}) واختار مسار الأحداث`,
          icon: '📖',
          earnedAt: new Date().toLocaleDateString('ar-EG'),
          category: 'story',
        };
        saveStudentBadge(studentId, newBadge);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReadCurrentScene = () => {
    if (!currentNode) return;
    if (isSpeaking) {
      stopArabicSpeech();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      speakArabicText(currentNode.passage, () => setIsSpeaking(false));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in">
      <div 
        id="adaptive-story-modal"
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-emerald-200 shadow-2xl overflow-hidden"
        dir="rtl"
      >
        {/* ترويسة الصانع التفاعلي */}
        <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 p-4 sm:p-5 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-teal-950 font-black flex items-center justify-center shadow-md text-2xl">
              📖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg">صَانِعُ القِصَصِ التَّكَيُّفِيَّة</h3>
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold">
                  Gemini Storyteller
                </span>
              </div>
              <p className="text-xs text-emerald-100">
                أَنْتَ صَانِعُ القِصَّةِ! اِخْتَرْ حَرْفَكَ وَقَرِّرْ كَيْفَ تَمْضِي المُغَامَرَة! 🌟
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopArabicSpeech();
              onClose();
            }}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* محتوى النافذة */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
          {/* شريط اختيار الحرف والبدء */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-emerald-600" />
                <span>اختر حرف القصة المستهدف:</span>
              </label>
              <span className="text-xs font-bold text-emerald-700">
                الحرف الحالي: [ {selectedLetter} ]
              </span>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar">
              {ARABIC_LETTERS.map((ltr) => (
                <button
                  key={ltr}
                  type="button"
                  onClick={() => {
                    setSelectedLetter(ltr);
                    startNewStory(ltr);
                  }}
                  className={`w-9 h-9 rounded-xl font-black text-sm shrink-0 transition flex items-center justify-center ${
                    selectedLetter === ltr
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-300 scale-105'
                      : 'bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-900 border border-slate-200'
                  }`}
                >
                  {ltr}
                </button>
              ))}
            </div>
          </div>

          {/* حالة التحميل */}
          {isLoading && (
            <div className="p-12 text-center bg-white rounded-3xl border border-emerald-100 shadow-xs">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 animate-spin">
                <RefreshCw className="w-8 h-8" />
              </div>
              <h4 className="text-base font-extrabold text-slate-800 mb-1">
                مُوسَى وَالذَّكَاءُ الاصْطِنَاعِيُّ يَبْنِيَانِ المَشْهَدَ التَّالِي... 🎨
              </h4>
              <p className="text-xs text-slate-500">
                تَشْكِيلُ الحُرُوفِ وَصِيَاغَةُ المُغَامَرَةِ بِالحَرَكَاتِ التَّامَّة
              </p>
            </div>
          )}

          {/* عرض المشهد القصصي التفاعلي */}
          {!isLoading && currentNode && (
            <div className="bg-white rounded-3xl p-5 sm:p-6 border-2 border-emerald-200 shadow-md space-y-5">
              {/* شريط حالة المشهد */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-900 font-black rounded-xl text-xs">
                    المَشْهَدُ {currentNode.step} مِنْ 3
                  </span>
                  <h4 className="font-extrabold text-sm text-slate-800">
                    {currentNode.sceneTitle}
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={handleReadCurrentScene}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    isSpeaking 
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{isSpeaking ? 'يُقرَأ الآن...' : 'استمع للمشهد'}</span>
                </button>
              </div>

              {/* نص المشهد المشكول بالحركات */}
              <div className="p-4 sm:p-5 bg-gradient-to-br from-amber-50/50 to-emerald-50/40 rounded-2xl border border-emerald-100">
                <p className="text-base sm:text-lg text-slate-800 leading-loose font-semibold tracking-wide">
                  {currentNode.passage}
                </p>
              </div>

              {/* السؤال وخيارا القرار التكيفي */}
              {!currentNode.isEnding ? (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>{currentNode.question}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleChooseOption(currentNode.optionA)}
                      className="p-4 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-950 border-2 border-emerald-300 rounded-2xl text-sm font-extrabold transition shadow-xs flex items-center justify-between group text-right"
                    >
                      <span>{currentNode.optionA}</span>
                      <ArrowLeft className="w-4 h-4 opacity-70 group-hover:opacity-100 group-hover:-translate-x-1 transition" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleChooseOption(currentNode.optionB)}
                      className="p-4 bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-950 border-2 border-teal-300 rounded-2xl text-sm font-extrabold transition shadow-xs flex items-center justify-between group text-right"
                    >
                      <span>{currentNode.optionB}</span>
                      <ArrowLeft className="w-4 h-4 opacity-70 group-hover:opacity-100 group-hover:-translate-x-1 transition" />
                    </button>
                  </div>
                </div>
              ) : (
                /* نهاية القصة وتكريم الطفل */
                <div className="p-5 bg-gradient-to-r from-amber-100 via-amber-50 to-emerald-100 rounded-2xl border-2 border-amber-300 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-amber-400 text-white flex items-center justify-center mx-auto text-3xl shadow-md">
                    🏆
                  </div>
                  <h4 className="text-lg font-black text-amber-950">
                    مُبَارَكٌ يَا بَطَل! اكْتَمَلَتِ القِصَّةُ بِنَجَاح! 🎉
                  </h4>
                  <p className="text-xs text-amber-900 font-bold">
                    حَصَلْتَ عَلَى: <span className="underline text-emerald-800">{earnedBadge || 'وسام الحكواتي الذهبي'}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => startNewStory()}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition shadow-md shadow-emerald-200"
                  >
                    بَدْءُ مُغَامَرَةٍ قَصَصِيَّةٍ جَدِيدَة 🌟
                  </button>
                </div>
              )}
            </div>
          )}

          {/* زر البدء الأولي إن لم يكن هناك مشهد */}
          {!currentNode && !isLoading && (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-xs space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-3xl">
                ✨
              </div>
              <h4 className="text-base font-extrabold text-slate-800">
                مُسْتَعِدٌّ لِبَدْءِ قِصَّةِ حَرْفِ ({selectedLetter})؟
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                سَيَقُومُ الذَّكَاءُ الاصْطِنَاعِيُّ بِتَوْلِيدِ مَشَاهِدَ مَشْكُولَةٍ خَصِيصًا لَكَ، وَتَسْتَطِيعُ اخْتِيَارَ مَسَارِ الأَحْدَاثِ بِنَفْسِك!
              </p>
              <button
                type="button"
                onClick={() => startNewStory()}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-sm transition shadow-lg shadow-emerald-200"
              >
                اِبْدَأِ القِصَّةَ الآن 🚀
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
