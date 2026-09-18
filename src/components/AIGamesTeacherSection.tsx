import React, { useState } from 'react';
import { 
  Sparkles, Gamepad2, Award, Wand2, Loader2, CheckCircle2, 
  Trash2, Eye, Send, Play, Star, BookOpen, Layers
} from 'lucide-react';
import { 
  Activity, AIGameType, GameData, UserProfile, SchoolStage, 
  GradeLevel, ArabicTrack, STAGES_CONFIG 
} from '../types';
import { generateAIGame } from '../geminiService';
import { saveActivity, deleteActivity, syncActivitiesFromCloud } from '../storage';
import { AIGamePlayerModal } from './AIGamePlayerModal';

interface AIGamesTeacherSectionProps {
  currentUser: UserProfile;
  activities: Activity[];
  onActivitiesUpdated: (newActivities: Activity[]) => void;
}

export const AIGamesTeacherSection: React.FC<AIGamesTeacherSectionProps> = ({
  currentUser,
  activities,
  onActivitiesUpdated
}) => {
  const teacherAllowedGrades = currentUser.allowedGrades || ['grade-1'];
  const teacherAllowedTracks = currentUser.allowedTracks || ['arabic-a'];

  // الحالات
  const [selectedStage, setSelectedStage] = useState<SchoolStage>(currentUser.stage || 'primary');
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>(
    (teacherAllowedGrades[0] as GradeLevel) || 'grade-1'
  );
  const [selectedTrack, setSelectedTrack] = useState<ArabicTrack>(
    (teacherAllowedTracks[0] as ArabicTrack) || 'arabic-a'
  );
  const [gameType, setGameType] = useState<AIGameType>('phonics_treasure');
  const [targetSkill, setTargetSkill] = useState<string>('حروف الهجاء والمدود الطويلة');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedGame, setGeneratedGame] = useState<GameData | null>(null);
  const [gameTitle, setGameTitle] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [previewModalActivity, setPreviewModalActivity] = useState<Activity | null>(null);

  // تصفية الألعاب المنشورة بواسطة هذا المعلم
  const teacherGames = activities.filter(
    (a) => a.teacherId === currentUser.id && a.activityType === 'game'
  );

  const getGradeLabel = (gradeId: string) => {
    for (const stage of Object.values(STAGES_CONFIG)) {
      const found = stage.grades.find((g) => g.id === gradeId);
      if (found) return found.labelAr;
    }
    return gradeId;
  };

  // توليد اللعبة بالذكاء الاصطناعي
  const handleGenerate = async () => {
    if (!targetSkill.trim()) {
      alert('يرجى كتابة الحرف أو المهارة المستهدفة أولاً');
      return;
    }

    setIsGenerating(true);
    try {
      const gradeName = getGradeLabel(selectedGrade);
      const gameData = await generateAIGame(gameType, gradeName, targetSkill);
      setGeneratedGame(gameData);

      let defaultTitle = '';
      if (gameType === 'phonics_treasure') {
        defaultTitle = `كنز الحروف: ${targetSkill}`;
      } else if (gameType === 'sentence_builder') {
        defaultTitle = `متاهة الجمل: ${targetSkill}`;
      } else if (gameType === 'story_quest') {
        defaultTitle = `مغامرة موسى: ${targetSkill}`;
      } else if (gameType === 'vowel_train') {
        defaultTitle = `قطار الحركات والمدود: ${targetSkill}`;
      } else if (gameType === 'letter_blending') {
        defaultTitle = `معمل دمج الكلمات: ${targetSkill}`;
      } else if (gameType === 'vocab_detective') {
        defaultTitle = `محقق المفردات: ${targetSkill}`;
      } else {
        defaultTitle = `فرز الظواهر اللغوية: ${targetSkill}`;
      }
      setGameTitle(defaultTitle);
    } catch (err: any) {
      console.error('فشل توليد اللعبة:', err);
      alert('حدث خطأ أثناء توليد اللعبة بالذكاء الاصطناعي. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsGenerating(false);
    }
  };

  // إسناد اللعبة وحفظها في قاعدة البيانات
  const handleAssignToClass = async () => {
    if (!generatedGame) return;

    setIsSaving(true);
    try {
      const finalTitle = gameTitle.trim() || 'لعبة تعليمية تفاعلية';
      const newActivity: Activity = {
        id: `game_${Date.now()}`,
        title: finalTitle,
        activityType: 'game',
        gameData: generatedGame,
        teacherId: currentUser.id,
        teacherName: currentUser.name,
        stage: selectedStage,
        grade: selectedGrade,
        track: selectedTrack,
        questions: [],
        createdAt: new Date().toLocaleDateString('ar-EG')
      };

      await saveActivity(newActivity);
      alert('🎉 تم إسناد ونشر اللعبة التعليمية لصفك بنجاح!');
      setGeneratedGame(null);
      setGameTitle('');
      const fresh = await syncActivitiesFromCloud();
      onActivitiesUpdated(fresh);
    } catch (err) {
      console.error('فشل إسناد اللعبة:', err);
      alert('تعذر حفظ اللعبة، يرجى المحاولة ثانية.');
    } finally {
      setIsSaving(false);
    }
  };

  // حذف لعبة
  const handleDeleteGame = async (gameId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه اللعبة؟')) return;
    await deleteActivity(gameId);
    const fresh = await syncActivitiesFromCloud();
    onActivitiesUpdated(fresh);
  };

  return (
    <div className="space-y-8">
      {/* بطاقة رأس القسم */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-amber-600/15 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black text-amber-100 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            <span>حزمة الألعاب التفاعلية الثلاث بالذكاء الاصطناعي</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black mb-2">
            مُولّد ألعاب موسى التعليمية الذكية 🎮✨
          </h2>
          <p className="text-xs sm:text-sm text-amber-50 leading-relaxed">
            أنشئ ألعاباً تفاعلية مشكولة بالحركات مخصصة لصفك في ثوانٍ معدودة! اختر نوع اللعبة والمهارة المستهدفة، وسيقوم الذكاء الاصطناعي ببناء المراحل والتحديات والتغذية الراجعة فورياً.
          </p>
        </div>
      </div>

      {/* نموذج إعداد وتوليد اللعبة */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-6">
        <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-amber-500" />
          تخصيص اللعبة للفصل الدراسي
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* الصف الدراسي */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              الصف الدراسي المستهدف
            </label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value as GradeLevel)}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50/50 focus:ring-2 focus:ring-amber-500 outline-none"
            >
              {teacherAllowedGrades.map((g) => (
                <option key={g} value={g}>
                  {getGradeLabel(g)}
                </option>
              ))}
            </select>
          </div>

          {/* المسار */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              مسار اللغة العربية
            </label>
            <select
              value={selectedTrack}
              onChange={(e) => setSelectedTrack(e.target.value as ArabicTrack)}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50/50 focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="arabic-a">للناطقين باللغة العربية</option>
              <option value="arabic-b">لغير الناطقين بها</option>
            </select>
          </div>

          {/* نوع اللعبة التعليمية */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              نوع اللعبة التفاعلية
            </label>
            <select
              value={gameType}
              onChange={(e) => setGameType(e.target.value as AIGameType)}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-amber-50/40 text-amber-950 focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="phonics_treasure">💎 كنز الحروف والكلمات السحرية (صيد وأصوات)</option>
              <option value="sentence_builder">🧩 متاهة تركيب الجمل التفاعلية (بناء وتركيب)</option>
              <option value="story_quest">🏰 مغامرة موسى وقرارات الحكاية (اختيارات قصصية)</option>
              <option value="vowel_train">🚂 قطار الحركات والمدود (حركات قصيرة وطويلة)</option>
              <option value="letter_blending">🧪 معمل دمج الحروف وتكوين الكلمات (تركيب صوتي)</option>
              <option value="vocab_detective">🔍 محقق المفردات (الترادف والتضاد والمعاني)</option>
              <option value="category_sorter">⚖️ فرز الظواهر اللغوية (شمسية/قمرية، تاء/هاء)</option>
            </select>
          </div>
        </div>

        {/* الحرف أو المهارة المستهدفة */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            الحرف أو المهارة اللغوية المستهدفة
          </label>
          <input
            type="text"
            value={targetSkill}
            onChange={(e) => setTargetSkill(e.target.value)}
            placeholder="مثال: حرف السين والصاد والفرق بينهما / المدود الطويلة / التاء المربوطة / أدوات الاستفهام..."
            className="w-full p-3 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none bg-slate-50/40"
          />
        </div>

        {/* زر التوليد */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm rounded-2xl transition shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-white" />
              <span>جاري صياغة مراحل اللعبة وتشكيل كلماتها بالذكاء الاصطناعي...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-amber-200" />
              <span>توليد اللعبة بالذكاء الاصطناعي الآن ✨</span>
            </>
          )}
        </button>
      </div>

      {/* شاشة المعاينة التفاعلية بعد التوليد */}
      {generatedGame && (
        <div className="bg-white rounded-3xl p-6 border-2 border-amber-300 shadow-lg space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-black inline-block mb-1">
                معاينة اللعبة المولَّدة جاهزة للنشر
              </span>
              <h3 className="text-base font-black text-slate-800">
                {generatedGame.gameType === 'phonics_treasure' && '💎 كنز الحروف والكلمات السحرية'}
                {generatedGame.gameType === 'sentence_builder' && '🧩 متاهة تركيب الجمل التفاعلية'}
                {generatedGame.gameType === 'story_quest' && '🏰 مغامرة موسى وقرارات الحكاية'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                التعليمات للطفل: <b>{generatedGame.instructions}</b>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPreviewModalActivity({
                    id: 'temp_preview',
                    title: gameTitle || 'معاينة تجريبية للعبة',
                    activityType: 'game',
                    gameData: generatedGame,
                    teacherId: currentUser.id,
                    teacherName: currentUser.name,
                    stage: selectedStage,
                    grade: selectedGrade,
                    track: selectedTrack,
                    questions: [],
                    createdAt: new Date().toLocaleDateString('ar-EG')
                  });
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Eye className="w-4 h-4 text-amber-600" /> تجربة اللعبة كطالب
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              عنوان اللعبة (الذي سيظهر للطالب في حسابه):
            </label>
            <input
              type="text"
              value={gameTitle}
              onChange={(e) => setGameTitle(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-black text-slate-800 bg-slate-50/50 outline-none"
            />
          </div>

          {/* استعراض مراحل اللعبة */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-xs text-slate-600">
              المراحل والأسئلة المشكولة ({generatedGame.levels.length} مستويات):
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {generatedGame.levels.map((lvl) => (
                <div key={lvl.id} className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/70 text-right">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                      المستوى {lvl.id}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold">
                      الإجابة: {lvl.correctAnswers.join(' / ')}
                    </span>
                  </div>
                  <p className="text-xs font-black text-slate-800 mb-2 leading-relaxed">
                    {lvl.prompt}
                  </p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {lvl.options.map((opt, i) => (
                      <span key={i} className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-amber-200 font-bold text-slate-700">
                        {opt}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    تلميح عند الخطأ: {lvl.feedbackHint}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* زر إسناد ونشر اللعبة للفصل */}
          <button
            type="button"
            onClick={handleAssignToClass}
            disabled={isSaving}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري حفظ وإسناد اللعبة إلى قاعدة البيانات...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>إسناد اللعبة للفصل ونشرها الآن 🚀</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* قائمة الألعاب المسندة مسبقاً من المعلم */}
      <div className="space-y-4">
        <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-amber-600" />
          ألعابك المنشورة لطلابك ({teacherGames.length})
        </h3>

        {teacherGames.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/80">
            <Gamepad2 className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <h4 className="font-bold text-slate-700 text-sm">لا توجد ألعاب منشورة حالياً</h4>
            <p className="text-xs text-slate-400 mt-1">
              استخدم النموذج أعلاه لتوليد أول لعبة تفاعلية لصفك بضغطة زر.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teacherGames.map((game) => (
              <div
                key={game.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-lg text-[10px] font-black border border-amber-200">
                      {game.gameData?.gameType === 'phonics_treasure' && '💎 كنز الحروف'}
                      {game.gameData?.gameType === 'sentence_builder' && '🧩 تركيب الجمل'}
                      {game.gameData?.gameType === 'story_quest' && '🏰 مغامرة موسى'}
                      {game.gameData?.gameType === 'vowel_train' && '🚂 قطار المدود'}
                      {game.gameData?.gameType === 'letter_blending' && '🧪 معمل الكلمات'}
                      {game.gameData?.gameType === 'vocab_detective' && '🔍 محقق المفردات'}
                      {game.gameData?.gameType === 'category_sorter' && '⚖️ فرز الظواهر'}
                    </span>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold">
                      {getGradeLabel(game.grade || '')}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">
                      {game.track === 'arabic-a' ? 'ناطقين' : 'غير ناطقين'}
                    </span>
                  </div>

                  <h4 className="font-black text-sm text-slate-800 mb-1">{game.title}</h4>
                  <p className="text-xs text-slate-500 mb-3">
                    المهارة: <b>{game.gameData?.targetSkill || 'لغوية عامة'}</b> • {game.gameData?.levels?.length || 3} مستويات
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPreviewModalActivity(game)}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 text-amber-600 fill-amber-600" /> تجربة اللعبة
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteGame(game.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                    title="حذف اللعبة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* مشغل اللعبة للمعاينة من المعلم */}
      {previewModalActivity && (
        <AIGamePlayerModal
          isOpen={!!previewModalActivity}
          onClose={() => setPreviewModalActivity(null)}
          activity={previewModalActivity}
          student={currentUser}
        />
      )}
    </div>
  );
};
