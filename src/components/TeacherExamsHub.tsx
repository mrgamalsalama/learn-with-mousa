import React, { useState, useEffect } from 'react';
import { 
  FileCheck2, Plus, Sparkles, Upload, Clock, Eye, EyeOff, CheckCircle2, 
  AlertTriangle, ShieldAlert, XCircle, Trash2, Edit3, Volume2, VolumeX,
  HelpCircle, RefreshCw, BarChart3, Users, Play, StopCircle, ArrowRight,
  Check, FileText, Award, Search, Info
} from 'lucide-react';
import { Exam, ExamQuestion, ExamQuestionType, ExamSession, GradeLevel, ArabicTrack, STAGES_CONFIG } from '../types';
import { 
  getExams, saveExam, deleteExam, syncExamsFromCloud,
  getExamSessions, saveExamSession, syncExamSessionsFromCloud,
  forceStopStudentExam, updateStudentExamSession, getUsers
} from '../storage';
import { generateAIExamQuestions, autoTashkeelText, speakWithMousaVoice, stopMousaVoice } from '../geminiService';
import { parseQTIFile } from '../utils/qtiParser';

interface TeacherExamsHubProps {
  teacherId: string;
  teacherName: string;
  allowedGrades?: GradeLevel[];
  onOpenLiveProctoring?: (examId: string) => void;
}

export const TeacherExamsHub: React.FC<TeacherExamsHubProps> = ({
  teacherId,
  teacherName,
  allowedGrades = ['grade-1', 'grade-2']
}) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'proctoring'>('list');
  const [selectedExamForProctoring, setSelectedExamForProctoring] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  // حالة إنشاء/تعديل الاختبار
  const [createMethod, setCreateMethod] = useState<'manual' | 'ai' | 'qti'>('manual');
  const [examTitle, setExamTitle] = useState('');
  const [targetGrade, setTargetGrade] = useState<GradeLevel>(allowedGrades[0] || 'grade-1');
  const [targetTrack, setTargetTrack] = useState<ArabicTrack>('arabic-a');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [showResultsImmediately, setShowResultsImmediately] = useState<boolean>(true);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);

  // حالة التوليد الذكي بالـ AI
  const [aiSkillTopic, setAiSkillTopic] = useState('القواعد والظواهر النحوية والإملاء');
  const [aiQuestionCount, setAiQuestionCount] = useState<number>(5);
  const [aiDifficulty, setAiDifficulty] = useState<string>('متوسط');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // حالة استيراد QTI
  const [qtiImportStatus, setQtiImportStatus] = useState<string | null>(null);
  const [isImportingQti, setIsImportingQti] = useState(false);

  // حالة تفاصيل إجابات طالب في شاشة المراقبة
  const [viewingSession, setViewingSession] = useState<ExamSession | null>(null);
  const [speakingQuestionIdx, setSpeakingQuestionIdx] = useState<number | null>(null);

  // تحميل البيانات ومزامنتها
  useEffect(() => {
    setExams(getExams());
    setSessions(getExamSessions());

    syncExamsFromCloud().then(data => setExams(data));
    syncExamSessionsFromCloud().then(data => setSessions(data));

    // تحديث دوري لجلسات الطلاب كل 5 ثوانٍ لضمان المراقبة الحية الدقيقة
    const interval = setInterval(() => {
      syncExamSessionsFromCloud().then(data => setSessions(data));
    }, 5000);

    return () => {
      clearInterval(interval);
      stopMousaVoice();
    };
  }, []);

  const refreshData = async () => {
    setIsLoading(true);
    const [cloudExams, cloudSessions] = await Promise.all([
      syncExamsFromCloud(),
      syncExamSessionsFromCloud()
    ]);
    setExams(cloudExams);
    setSessions(cloudSessions);
    setIsLoading(false);
  };

  // تصفية الاختبارات
  const filteredExams = exams.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = gradeFilter === 'all' || e.target_grade === gradeFilter;
    return matchesSearch && matchesGrade;
  });

  // إحصائيات عامة
  const totalExams = exams.length;
  const activeExamsCount = exams.filter(e => e.is_active).length;
  const totalSessionsCount = sessions.length;
  const tabAlertsCount = sessions.reduce((sum, s) => sum + (s.tab_switch_count || 0), 0);

  // بدء إنشاء اختبار جديد
  const handleStartNewExam = () => {
    setEditingExamId(null);
    setExamTitle('');
    setTargetGrade(allowedGrades[0] || 'grade-1');
    setTargetTrack('arabic-a');
    setDurationMinutes(15);
    setShowResultsImmediately(true);
    setIsActive(true);
    setDescription('');
    setQuestions([
      {
        id: `q_${Date.now()}_1`,
        text: 'مَا الصَّوْتُ الأَوَّلُ فِي كَلِمَةِ: (كِتَابٌ)؟',
        type: 'multiple_choice',
        options: ['كَـ (حَرْفُ الكَافِ)', 'بَـ (حَرْفُ البَاءِ)', 'تَـ (حَرْفُ التَّاءِ)', 'مَـ (حَرْفُ المِيمِ)'],
        correctAnswer: 'كَـ (حَرْفُ الكَافِ)',
        points: 5,
        explanation: 'تَبْدَأُ الكَلِمَةُ بِحَرْفِ الكَافِ مَعَ الفَتْحِ.'
      }
    ]);
    setActiveTab('create');
  };

  // تعديل اختبار موجود
  const handleEditExam = (exam: Exam) => {
    setEditingExamId(exam.id);
    setExamTitle(exam.title);
    setTargetGrade(exam.target_grade);
    setTargetTrack(exam.target_track || 'arabic-a');
    setDurationMinutes(exam.duration_minutes);
    setShowResultsImmediately(exam.show_results_immediately);
    setIsActive(exam.is_active);
    setDescription(exam.description || '');
    setQuestions([...exam.questions]);
    setActiveTab('create');
  };

  // تبديل حالة الاختبار (مفعل / مغلق)
  const handleToggleExamActive = async (exam: Exam) => {
    const updated = { ...exam, is_active: !exam.is_active };
    await saveExam(updated);
    setExams(getExams());
  };

  // حذف اختبار
  const handleDeleteExam = async (examId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الاختبار نهائياً؟ سيتم حذف جميع جلسات الطلاب المرتبطة به.')) {
      await deleteExam(examId);
      setExams(getExams());
      setSessions(getExamSessions());
      if (selectedExamForProctoring === examId) {
        setSelectedExamForProctoring(null);
      }
    }
  };

  // إضافة سؤال يدوي
  const handleAddQuestion = (type: ExamQuestionType) => {
    const newQ: ExamQuestion = {
      id: `q_${Date.now()}_${questions.length + 1}`,
      text: type === 'true_false' 
        ? 'تُنْطَقُ اللَّامُ القَمَرِيَّةُ عِنْدَ القِرَاءَةِ بِوُضُوحٍ.' 
        : type === 'spelling_dictation'
        ? 'اكْتُبِ الكَلِمَةَ التَّالِيَةَ مَشْكُولَةً: (طَالِبٌ)'
        : 'اخْتَرِ الإِجَابَةَ الصَّحِيحَةَ مِمَّا يَلِي:',
      type,
      options: type === 'true_false' 
        ? ['صَحِيحٌ ✅', 'خَطَأٌ ❌']
        : type === 'multiple_choice'
        ? ['الخِيَارُ الأَوَّلُ', 'الخِيَارُ الثَّانِي', 'الخِيَارُ الثَّالِثُ', 'الخِيَارُ الرَّابِعُ']
        : undefined,
      correctAnswer: type === 'true_false' ? 'صَحِيحٌ ✅' : (type === 'spelling_dictation' ? 'طَالِبٌ' : 'الخِيَارُ الأَوَّلُ'),
      points: 5,
      explanation: 'تَوْجِيهٌ تَعْلِيمِيٌّ لِلْإِجَابَةِ الصَّحِيحَةِ',
      audioPromptText: type === 'spelling_dictation' ? 'طَالِبٌ' : undefined
    };
    setQuestions([...questions, newQ]);
  };

  // تعديل سؤال
  const handleUpdateQuestion = (index: number, updates: Partial<ExamQuestion>) => {
    const next = [...questions];
    next[index] = { ...next[index], ...updates };
    setQuestions(next);
  };

  // حذف سؤال
  const handleDeleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  // تشكيل تلقائي لنص السؤال
  const handleAutoTashkeelQuestion = async (index: number) => {
    const targetQ = questions[index];
    if (!targetQ.text) return;
    try {
      const formatted = await autoTashkeelText(targetQ.text);
      handleUpdateQuestion(index, { text: formatted });
    } catch {}
  };

  // تشغيل أو إيقاف صوت موسى للسؤال
  const handleToggleSpeakQuestion = (index: number, text: string) => {
    if (!text) return;
    if (speakingQuestionIdx === index) {
      stopMousaVoice();
      setSpeakingQuestionIdx(null);
    } else {
      stopMousaVoice();
      setSpeakingQuestionIdx(index);
      speakWithMousaVoice(text, () => {
        setSpeakingQuestionIdx(null);
      });
    }
  };

  // توليد الأسئلة بالذكاء الاصطناعي
  const handleGenerateAIQuestions = async () => {
    setIsGeneratingAI(true);
    try {
      const generated = await generateAIExamQuestions({
        targetGrade,
        skillTopic: aiSkillTopic,
        questionCount: aiQuestionCount,
        difficulty: aiDifficulty
      });
      setQuestions([...questions, ...generated]);
    } catch (e: any) {
      alert(`حدث خطأ أثناء التوليد بالذكاء الاصطناعي: ${e?.message || 'يرجى المحاولة مجدداً'}`);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // معالجة رفع واستيراد QTI ZIP / XML
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingQti(true);
    setQtiImportStatus('جاري قراءة وتحليل ملف QTI...');
    try {
      const result = await parseQTIFile(file);
      if (result.questions.length > 0) {
        setQuestions([...questions, ...result.questions]);
        if (!examTitle && result.assessmentTitle) {
          setExamTitle(result.assessmentTitle);
        }
        setQtiImportStatus(`تم استيراد ${result.questions.length} سؤالاً بنجاح من حزمة QTI!`);
      } else {
        setQtiImportStatus('لم يتم العثور على أي أسئلة صالحة في الملف.');
      }
    } catch (err: any) {
      setQtiImportStatus(`فشل استيراد الملف: ${err.message}`);
    } finally {
      setIsImportingQti(false);
    }
  };

  // حفظ الاختبار النهائي
  const handleSaveExam = async () => {
    if (!examTitle.trim()) {
      alert('يرجى كتابة عنوان للاختبار');
      return;
    }
    if (questions.length === 0) {
      alert('يرجى إضافة سؤال واحد على الأقل للاختبار');
      return;
    }

    const examData: Exam = {
      id: editingExamId || `exam_${Date.now()}`,
      title: examTitle.trim(),
      teacher_id: teacherId,
      teacher_name: teacherName,
      target_grade: targetGrade,
      target_track: targetTrack,
      duration_minutes: Number(durationMinutes) || 0,
      show_results_immediately: showResultsImmediately,
      is_active: isActive,
      questions,
      description: description.trim(),
      created_at: new Date().toISOString()
    };

    await saveExam(examData);
    setExams(getExams());
    setActiveTab('list');
    alert('تم حفظ الاختبار وتفعيله بنجاح! 🌟');
  };

  // جلسات الاختبار المحددة للمراقبة الحية
  const currentProctorExam = exams.find(e => e.id === selectedExamForProctoring);
  const examProctorSessions = sessions.filter(s => s.exam_id === selectedExamForProctoring);

  // طلاب الصف المسجلين لحساب من بدأ ومن لم يبدأ
  const allSystemUsers = getUsers();
  const classStudents = allSystemUsers.filter(u => u.role === 'student' && (!currentProctorExam || u.grade === currentProctorExam.target_grade));

  // إيقاف الاختبار فوراً عن طالب
  const handleForceStop = async (session: ExamSession) => {
    if (window.confirm(`هل أنت متأكد من إيقاف الاختبار فوراً عن الطالب (${session.student_name})؟`)) {
      await forceStopStudentExam(session.id);
      const updated = await syncExamSessionsFromCloud(session.exam_id);
      setSessions(updated);
    }
  };

  // إعادة تمكين الجلسة للطالب
  const handleReEnable = async (session: ExamSession) => {
    await updateStudentExamSession(session.id, {
      status: 'in_progress',
      end_time: null
    });
    const updated = await syncExamSessionsFromCloud(session.exam_id);
    setSessions(updated);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* رأس الصفحة والإحصائيات */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">مركز الاختبارات والتقييمات التفاعلية</h2>
                <p className="text-xs text-slate-500">تصميم الاختبارات المشكولة، التوليد الذكي، واستيراد QTI والمراقبة الحية</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={refreshData}
              disabled={isLoading}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition flex items-center gap-1.5 text-xs font-bold"
              title="تحديث البيانات لحظياً"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
              تحديث
            </button>

            <button
              onClick={handleStartNewExam}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 transition flex items-center gap-2 text-xs font-black shadow-md shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              إنشاء اختبار جديد
            </button>
          </div>
        </div>

        {/* بطاقات الإحصائيات الحية */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold">إجمالي الاختبارات</span>
              <FileText className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-slate-900">{totalExams}</p>
          </div>

          <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-100">
            <div className="flex items-center justify-between text-emerald-700 mb-1">
              <span className="text-xs font-bold">الاختبارات النشطة</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-800">{activeExamsCount}</p>
          </div>

          <div className="bg-blue-50/60 rounded-2xl p-4 border border-blue-100">
            <div className="flex items-center justify-between text-blue-700 mb-1">
              <span className="text-xs font-bold">جلسات الطلاب</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-black text-blue-800">{totalSessionsCount}</p>
          </div>

          <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-100">
            <div className="flex items-center justify-between text-amber-700 mb-1">
              <span className="text-xs font-bold">تنبيهات مغادرة التبويب</span>
              <ShieldAlert className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-black text-amber-800">{tabAlertsCount}</p>
          </div>
        </div>

        {/* شريط التنقل بين أقسام المركز */}
        <div className="flex items-center gap-2 mt-6 border-t border-slate-100 pt-4">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'list' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            قائمة الاختبارات ({exams.length})
          </button>

          <button
            onClick={handleStartNewExam}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'create' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            {editingExamId ? 'تعديل الاختبار الحالي' : 'إنشاء وتصميم اختبار'}
          </button>

          {selectedExamForProctoring && (
            <button
              onClick={() => setActiveTab('proctoring')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
                activeTab === 'proctoring' 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs' 
                  : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-blue-300" />
              المراقبة الحية: {currentProctorExam?.title.slice(0, 20)}...
            </button>
          )}
        </div>
      </div>

      {/* ======================= التبويب 1: قائمة الاختبارات ======================= */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* فلتر وبحث */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث في عناوين الاختبارات..."
                className="w-full pl-3 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500">الصف:</span>
              <select
                value={gradeFilter}
                onChange={e => setGradeFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-hidden"
              >
                <option value="all">جميع الصفوف</option>
                {allowedGrades.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* قائمة كروت الاختبارات */}
          {filteredExams.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <FileCheck2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">لا توجد اختبارات مضافة حالياً</h3>
                <p className="text-xs text-slate-500 mt-1">ابدأ بإنشاء أول اختبار تفاعلي مشكول أو ولّده بالذكاء الاصطناعي</p>
              </div>
              <button
                onClick={handleStartNewExam}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 transition"
              >
                إنشاء اختبار الآن
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredExams.map(exam => {
                const examSessions = sessions.filter(s => s.exam_id === exam.id);
                const activeSessionCount = examSessions.filter(s => s.status === 'in_progress').length;
                const submittedSessionCount = examSessions.filter(s => s.status === 'submitted').length;
                const totalMarks = exam.questions.reduce((sum, q) => sum + (q.points || 5), 0);

                return (
                  <div 
                    key={exam.id} 
                    className={`bg-white rounded-3xl p-5 border transition duration-200 hover:shadow-md flex flex-col justify-between gap-4 ${
                      exam.is_active ? 'border-slate-200' : 'border-slate-200/60 opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100">
                              {exam.target_grade}
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                              exam.is_active 
                                ? 'bg-green-50 text-green-700 border border-green-200' 
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {exam.is_active ? '● متاح للطلاب' : 'مغلق'}
                            </span>
                            {exam.duration_minutes > 0 ? (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 flex items-center gap-1 border border-amber-100">
                                <Clock className="w-3 h-3" /> {exam.duration_minutes} دقيقة
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                                وقت مفتوح
                              </span>
                            )}
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border ${
                              exam.show_results_immediately 
                                ? 'bg-teal-50 text-teal-700 border-teal-100' 
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {exam.show_results_immediately ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              {exam.show_results_immediately ? 'النتيجة فورية' : 'النتيجة بعد الاعتماد'}
                            </span>
                          </div>

                          <h3 className="text-base font-black text-slate-900 leading-snug">{exam.title}</h3>
                          {exam.description && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{exam.description}</p>
                          )}
                        </div>
                      </div>

                      {/* شريط الإحصائيات المصغر للاختبار */}
                      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
                        <div className="bg-slate-50 rounded-xl p-2">
                          <span className="text-[10px] text-slate-400 block font-bold">الأسئلة والدرجة</span>
                          <span className="text-xs font-black text-slate-700">{exam.questions.length} أسئلة ({totalMarks} د)</span>
                        </div>
                        <div className="bg-blue-50/60 rounded-xl p-2">
                          <span className="text-[10px] text-blue-500 block font-bold">يختبرون الآن</span>
                          <span className="text-xs font-black text-blue-700">{activeSessionCount} طالب</span>
                        </div>
                        <div className="bg-emerald-50/60 rounded-xl p-2">
                          <span className="text-[10px] text-emerald-600 block font-bold">تم التسليم</span>
                          <span className="text-xs font-black text-emerald-800">{submittedSessionCount} طالب</span>
                        </div>
                      </div>
                    </div>

                    {/* أزرار التحكم والعمليات */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setSelectedExamForProctoring(exam.id);
                          setActiveTab('proctoring');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-black hover:from-blue-700 hover:to-indigo-700 transition flex items-center gap-1.5 shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        المراقبة الحية ({examSessions.length})
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleExamActive(exam)}
                          className={`p-2 rounded-xl border text-xs font-bold transition ${
                            exam.is_active 
                              ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' 
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                          }`}
                          title={exam.is_active ? 'إيقاف الاختبار مؤقتاً' : 'تفعيل الاختبار'}
                        >
                          {exam.is_active ? <StopCircle className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>

                        <button
                          onClick={() => handleEditExam(exam)}
                          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                          title="تعديل الاختبار"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteExam(exam.id)}
                          className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition"
                          title="حذف الاختبار"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================= التبويب 2: استوديو إنشاء وتصميم الاختبار ======================= */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          {/* خيارات أسلوب الإنشاء (يدوي / AI / QTI) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              طريقة إعداد وبناء أسئلة الاختبار
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setCreateMethod('manual')}
                className={`p-4 rounded-2xl border text-right transition flex flex-col justify-between gap-2 ${
                  createMethod === 'manual' 
                    ? 'border-emerald-600 bg-emerald-50/40 text-emerald-900 shadow-xs' 
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black">1. تصميم يدوي مباشر</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">كتابة الأسئلة المخصصة، ضبط الخيارات، وتحديد الدرجات يدوياً.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCreateMethod('ai')}
                className={`p-4 rounded-2xl border text-right transition flex flex-col justify-between gap-2 ${
                  createMethod === 'ai' 
                    ? 'border-emerald-600 bg-emerald-50/40 text-emerald-900 shadow-xs' 
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black">2. توليد ذكي بالـ AI 🌟</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">تحديد المهارة والصف ليولد Gemini اختباراً مشكولاً متدرج الصعوبة.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCreateMethod('qti')}
                className={`p-4 rounded-2xl border text-right transition flex flex-col justify-between gap-2 ${
                  createMethod === 'qti' 
                    ? 'border-emerald-600 bg-emerald-50/40 text-emerald-900 shadow-xs' 
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black">3. استيراد ملف QTI ZIP / XML</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">فك حزم الأسئلة المعيارية العالمية واستيرادها فوراً للمنصة.</p>
                </div>
              </button>
            </div>
          </div>

          {/* لوحة التوليد بالذكاء الاصطناعي (عند اختيارها) */}
          {createMethod === 'ai' && (
            <div className="bg-gradient-to-br from-amber-50/80 via-white to-emerald-50/60 rounded-3xl p-6 border border-amber-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-amber-800">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <h4 className="text-sm font-black">توليد حزمة أسئلة مشكولة بالذكاء الاصطناعي (Gemini AI Generator)</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">المهارة اللغوية المستهدفة:</label>
                  <select
                    value={aiSkillTopic}
                    onChange={e => setAiSkillTopic(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 font-medium focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="الوعي الصوتي والحروف الهجائية">الوعي الصوتي والحروف الهجائية 🔤</option>
                    <option value="الحركات القصيرة والمدود الطويلة">الحركات القصيرة والمدود الطويلة 🎵</option>
                    <option value="التنوين بأنواعه (فتح، ضم، كسر)">التنوين بأنواعه (فتح، ضم، كسر) ✍️</option>
                    <option value="التاء المربوطة والمفتوحة والهاء">التاء المربوطة والمفتوحة والهاء ⚖️</option>
                    <option value="اللام الشمسية واللام القمرية">اللام الشمسية واللام القمرية ☀️🌙</option>
                    <option value="القواعد والظواهر النحوية والإملاء">القواعد والظواهر النحوية والإملاء 📚</option>
                    <option value="الفهم والاستيعاب القرائي">الفهم والاستيعاب القرائي 📖</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">عدد الأسئلة المطلوبة:</label>
                  <select
                    value={aiQuestionCount}
                    onChange={e => setAiQuestionCount(Number(e.target.value))}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 font-medium focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value={3}>3 أسئلة سريعة</option>
                    <option value={5}>5 أسئلة متوازنة (موصى بها)</option>
                    <option value={8}>8 أسئلة شاملة</option>
                    <option value={10}>10 أسئلة تقييم كامل</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">مستوى الصعوبة والتدرج:</label>
                  <select
                    value={aiDifficulty}
                    onChange={e => setAiDifficulty(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 font-medium focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="ميسر للمبتدئين">ميسر للمبتدئين (فهم مباشر)</option>
                    <option value="متوسط">متوسط وتفاعلي</option>
                    <option value="متقدم وتحدي لغوي">متقدم وتحدي لغوي (استنتاج وتطبيق)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleGenerateAIQuestions}
                  disabled={isGeneratingAI}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 text-white font-black text-xs hover:from-amber-600 hover:to-emerald-700 transition flex items-center gap-2 shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {isGeneratingAI ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      جاري صياغة وتشكيل الأسئلة بالـ AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      توليد الأسئلة وإضافتها للاختبار ✨
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* لوحة استيراد ملف QTI (عند اختيارها) */}
          {createMethod === 'qti' && (
            <div className="bg-white rounded-3xl p-6 border border-blue-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-blue-800">
                <Upload className="w-5 h-5 text-blue-600" />
                <h4 className="text-sm font-black">استيراد بنك أسئلة معياري QTI (ZIP / XML)</h4>
              </div>

              <div className="border-2 border-dashed border-blue-200 rounded-2xl p-6 text-center hover:border-blue-400 transition bg-blue-50/20">
                <input
                  type="file"
                  id="qti-file-input"
                  accept=".zip,.xml,.qti"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="qti-file-input" className="cursor-pointer space-y-2 block">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-black text-slate-800">انقر هنا لاختيار حزمة QTI ZIP أو ملف XML أو اسحبه إلى هنا</p>
                  <p className="text-[11px] text-slate-500">يدعم معايير IMS QTI 2.1 و 1.2 وبنوك الأسئلة الموحدة</p>
                </label>
              </div>

              {qtiImportStatus && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  qtiImportStatus.includes('نجاح') 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : qtiImportStatus.includes('فشل') 
                    ? 'bg-rose-50 text-rose-800 border border-rose-200' 
                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}>
                  <Info className="w-4 h-4 shrink-0" />
                  {qtiImportStatus}
                </div>
              )}
            </div>
          )}

          {/* الإعدادات العامة للاختبار */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900">البيانات والإعدادات الأساسية للاختبار</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">عنوان الاختبار:</label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={e => setExamTitle(e.target.value)}
                  placeholder="مثال: تَقْيِيمُ مُنْتَصَفِ الفَصْلِ: مَهَارَاتُ اللُّغَةِ العَرَبِيَّةِ 📝"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">الصف الدراسي المستهدف:</label>
                <select
                  value={targetGrade}
                  onChange={e => setTargetGrade(e.target.value as GradeLevel)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium focus:outline-hidden focus:border-emerald-500"
                >
                  {allowedGrades.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">مسار اللغة العربية:</label>
                <select
                  value={targetTrack}
                  onChange={e => setTargetTrack(e.target.value as ArabicTrack)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="arabic-a">المسار (أ) - الناطقين باللغة العربية</option>
                  <option value="arabic-b">المسار (ب) - غير الناطقين بها</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">مدة الاختبار (بالدقائق):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={180}
                    value={durationMinutes}
                    onChange={e => setDurationMinutes(parseInt(e.target.value) || 0)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500"
                  />
                  <span className="text-xs text-slate-500 whitespace-nowrap font-medium">
                    {durationMinutes === 0 ? '(وقت مفتوح دون عداد)' : 'دقيقة'}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">إظهار النتيجة للطالب:</label>
                <div className="flex items-center gap-3 mt-2">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="radio"
                      name="show_results"
                      checked={showResultsImmediately}
                      onChange={() => setShowResultsImmediately(true)}
                      className="accent-emerald-600"
                    />
                    إظهار النتيجة فوراً بعد التسليم
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="radio"
                      name="show_results"
                      checked={!showResultsImmediately}
                      onChange={() => setShowResultsImmediately(false)}
                      className="accent-emerald-600"
                    />
                    حجب النتيجة حتى اعتماد المعلم
                  </label>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">وصف أو تعليمات الاختبار للطلاب:</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="اكتب تعليمات الاختبار والنصائح للطلاب هنا..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* محرر الأسئلة */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-black text-slate-900">قائمة أسئلة الاختبار ({questions.length})</h3>
                <p className="text-xs text-slate-500">إجمالي درجات الاختبار: {questions.reduce((sum, q) => sum + (q.points || 5), 0)} درجة</p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleAddQuestion('multiple_choice')}
                  className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> + اختيار من متعدد
                </button>
                <button
                  type="button"
                  onClick={() => handleAddQuestion('true_false')}
                  className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> + صح وخطأ
                </button>
                <button
                  type="button"
                  onClick={() => handleAddQuestion('spelling_dictation')}
                  className="px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 text-xs font-bold hover:bg-purple-100 transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> + إملاء وكتابة مشكولة
                </button>
              </div>
            </div>

            {/* قائمة الأسئلة */}
            <div className="space-y-4 mt-4">
              {questions.map((q, idx) => (
                <div key={q.id || idx} className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {q.type === 'multiple_choice' ? 'اختيار من متعدد' : q.type === 'true_false' ? 'صح أو خطأ' : 'كتابة إملائية مشكولة'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAutoTashkeelQuestion(idx)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-bold transition flex items-center gap-1"
                        title="تشكيل السؤال تلقائياً بالحركات"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500" /> تشكيل تلقائي
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleSpeakQuestion(idx, q.text)}
                        className={`p-1.5 rounded-lg border text-xs transition flex items-center gap-1 ${
                          speakingQuestionIdx === idx
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-white border-slate-200 text-slate-600 hover:text-emerald-700'
                        }`}
                        title={speakingQuestionIdx === idx ? 'إيقاف الاستماع' : 'الاستماع بصوت موسى'}
                      >
                        {speakingQuestionIdx === idx ? <VolumeX className="w-3.5 h-3.5 text-amber-800" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>

                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-slate-400 font-bold">الدرجة:</span>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={q.points || 5}
                          onChange={e => handleUpdateQuestion(idx, { points: parseInt(e.target.value) || 5 })}
                          className="w-14 bg-white border border-slate-200 rounded-lg p-1 text-center font-bold text-xs"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(idx)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition"
                        title="حذف هذا السؤال"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* نص السؤال */}
                  <input
                    type="text"
                    value={q.text}
                    onChange={e => handleUpdateQuestion(idx, { text: e.target.value })}
                    placeholder="اكتب نص السؤال هنا مشكولاً بالحركات..."
                    className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl p-3 focus:outline-hidden focus:border-emerald-500"
                  />

                  {/* تفاصيل خيارات السؤال */}
                  {q.type === 'multiple_choice' && (
                    <div className="space-y-2 pt-2 border-t border-slate-200/60">
                      <label className="text-[11px] font-bold text-slate-500 block">
                        الخيارات الأربعة (حدد الدائرة بجانب الخيار للإشارة إلى أنه الإجابة الصحيحة):
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(q.options || ['', '', '', '']).map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2">
                            <input
                              type="radio"
                              name={`correct_${q.id}`}
                              checked={q.correctAnswer === opt}
                              onChange={() => handleUpdateQuestion(idx, { correctAnswer: opt })}
                              className="accent-emerald-600 w-4 h-4"
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={e => {
                                const newOpts = [...(q.options || ['', '', '', ''])];
                                const oldVal = newOpts[optIdx];
                                newOpts[optIdx] = e.target.value;
                                const isCurrentCorrect = q.correctAnswer === oldVal;
                                handleUpdateQuestion(idx, {
                                  options: newOpts,
                                  correctAnswer: isCurrentCorrect ? e.target.value : q.correctAnswer
                                });
                              }}
                              placeholder={`الخيار ${optIdx + 1}`}
                              className="w-full text-xs font-bold bg-transparent focus:outline-hidden text-slate-800"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {q.type === 'true_false' && (
                    <div className="flex items-center gap-4 pt-2 border-t border-slate-200/60">
                      <span className="text-[11px] font-bold text-slate-500">الإجابة الصحيحة:</span>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
                        <input
                          type="radio"
                          name={`correct_${q.id}`}
                          checked={q.correctAnswer.includes('صَحِيحٌ') || q.correctAnswer.includes('صحيح')}
                          onChange={() => handleUpdateQuestion(idx, { correctAnswer: 'صَحِيحٌ ✅' })}
                          className="accent-emerald-600"
                        />
                        صَحِيحٌ ✅
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-black text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5">
                        <input
                          type="radio"
                          name={`correct_${q.id}`}
                          checked={q.correctAnswer.includes('خَطَأٌ') || q.correctAnswer.includes('خطأ')}
                          onChange={() => handleUpdateQuestion(idx, { correctAnswer: 'خَطَأٌ ❌' })}
                          className="accent-rose-600"
                        />
                        خَطَأٌ ❌
                      </label>
                    </div>
                  )}

                  {q.type === 'spelling_dictation' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-1">الكلمة الصحيحة (الإملاء المشكول):</label>
                        <input
                          type="text"
                          value={q.correctAnswer}
                          onChange={e => handleUpdateQuestion(idx, { correctAnswer: e.target.value })}
                          placeholder="مثال: طَالِبٌ"
                          className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-1">النص الصوتي المسموع للإملاء:</label>
                        <input
                          type="text"
                          value={q.audioPromptText || q.correctAnswer}
                          onChange={e => handleUpdateQuestion(idx, { audioPromptText: e.target.value })}
                          placeholder="النص الذي سينطقه موسى للطالب"
                          className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                    </div>
                  )}

                  {/* حقل الشرح التعليمي */}
                  <div>
                    <input
                      type="text"
                      value={q.explanation || ''}
                      onChange={e => handleUpdateQuestion(idx, { explanation: e.target.value })}
                      placeholder="شرح وتوجيه تربوي يظهر للطالب عند مراجعة الإجابات (اختياري)..."
                      className="w-full text-[11px] text-slate-600 bg-white border border-slate-200 rounded-xl p-2 focus:outline-hidden"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* أزرار الحفظ والإلغاء */}
          <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition"
            >
              إلغاء والعودة
            </button>

            <button
              type="button"
              onClick={handleSaveExam}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs hover:from-emerald-700 hover:to-teal-700 transition flex items-center gap-2 shadow-md shadow-emerald-600/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              حفظ الاختبار واعتماده
            </button>
          </div>
        </div>
      )}

      {/* ======================= التبويب 3: لوحة المراقبة الحية (Live Proctoring Dashboard) ======================= */}
      {activeTab === 'proctoring' && currentProctorExam && (
        <div className="space-y-6">
          {/* شريط الاختبار المراقب */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[11px] font-black text-emerald-400 tracking-wider">مراقبة حية مباشرة (REALTIME PROCTORING)</span>
              </div>
              <h2 className="text-xl font-black text-white">{currentProctorExam.title}</h2>
              <p className="text-xs text-slate-300 mt-1">
                الصف: {currentProctorExam.target_grade} | مدة الاختبار: {currentProctorExam.duration_minutes > 0 ? `${currentProctorExam.duration_minutes} دقيقة` : 'مفتوح'} | الأسئلة: {currentProctorExam.questions.length}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => syncExamSessionsFromCloud(currentProctorExam.id).then(data => setSessions(data))}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> تحديث الجلسات
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition"
              >
                العودة للقائمة
              </button>
            </div>
          </div>

          {/* ملخص إحصائيات المراقبة */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-400 block">إجمالي طلاب الصف</span>
              <span className="text-xl font-black text-slate-900">{classStudents.length} طالب</span>
            </div>

            <div className="bg-blue-50/70 rounded-2xl p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-700">يجري الاختبار الآن</span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
              </div>
              <span className="text-xl font-black text-blue-900">
                {examProctorSessions.filter(s => s.status === 'in_progress').length}
              </span>
            </div>

            <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-700 block">أنهى وسلّم</span>
              <span className="text-xl font-black text-emerald-900">
                {examProctorSessions.filter(s => s.status === 'submitted').length}
              </span>
            </div>

            <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-800">تنبيهات مغادرة التبويب</span>
                <ShieldAlert className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-xl font-black text-amber-900">
                {examProctorSessions.reduce((sum, s) => sum + (s.tab_switch_count || 0), 0)}
              </span>
            </div>
          </div>

          {/* جدول مراقبة الطلاب المباشر */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                حالة الطلاب في قاعة الاختبار الافتراضية
              </h3>
              <span className="text-xs text-slate-400">تحديث لحظي عبر Supabase Realtime</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">اسم الطالب</th>
                    <th className="p-3.5">حالة الجلسة</th>
                    <th className="p-3.5">وقت البدء</th>
                    <th className="p-3.5">تنبيهات مغادرة الصفحة (Anti-Cheat)</th>
                    <th className="p-3.5">الدرجة</th>
                    <th className="p-3.5 text-center">إجراءات المراقبة الفورية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {classStudents.map(student => {
                    const session = examProctorSessions.find(s => s.student_id === student.id);
                    const status = session?.status || 'not_started';
                    const tabSwitches = session?.tab_switch_count || 0;

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/80 transition">
                        {/* اسم الطالب */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center">
                              {student.name.slice(0, 1)}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">{student.name}</span>
                              <span className="text-[10px] text-slate-400">@{student.username}</span>
                            </div>
                          </div>
                        </td>

                        {/* حالة الجلسة */}
                        <td className="p-3.5">
                          {status === 'not_started' && (
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600">
                              لم يبدأ بعد
                            </span>
                          )}
                          {status === 'in_progress' && (
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5 w-fit">
                              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                              يجري الاختبار الآن
                            </span>
                          )}
                          {status === 'submitted' && (
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 w-fit">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              أنهى وسلّم
                            </span>
                          )}
                          {status === 'force_stopped' && (
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5 w-fit">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              تم إيقاف الجلسة
                            </span>
                          )}
                        </td>

                        {/* وقت البدء */}
                        <td className="p-3.5 text-slate-500 text-[11px]">
                          {session?.start_time ? new Date(session.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>

                        {/* مؤشر مغادرة التبويب */}
                        <td className="p-3.5">
                          {tabSwitches === 0 ? (
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-green-50 text-green-700 border border-green-200 flex items-center gap-1 w-fit">
                              <Check className="w-3 h-3" />
                              آمن ومستمر
                            </span>
                          ) : tabSwitches < 3 ? (
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              {tabSwitches} تنبيهات مغادرة
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1 w-fit animate-pulse">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                              خطر متكرر: {tabSwitches} مرات!
                            </span>
                          )}
                        </td>

                        {/* الدرجة */}
                        <td className="p-3.5">
                          {session && (status === 'submitted' || session.score > 0) ? (
                            <span className="font-black text-slate-900 text-xs">
                              {session.score} / {session.total_marks || currentProctorExam.questions.reduce((s, q) => s + (q.points || 5), 0)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* إجراءات التحكم الفوري */}
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {session && status === 'in_progress' && (
                              <button
                                onClick={() => handleForceStop(session)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition text-[11px] font-black flex items-center gap-1"
                                title="إيقاف الاختبار فوراً عن الطالب عند رصد سلوك غير مصرح به"
                              >
                                <StopCircle className="w-3.5 h-3.5" />
                                إيقاف الاختبار عنه
                              </button>
                            )}

                            {session && status === 'force_stopped' && (
                              <button
                                onClick={() => handleReEnable(session)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition text-[11px] font-black flex items-center gap-1"
                                title="إعادة تمكين الطالب من استئناف جلسته"
                              >
                                <Play className="w-3.5 h-3.5" />
                                استئناف
                              </button>
                            )}

                            {session && (
                              <button
                                onClick={() => setViewingSession(session)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition text-[11px] font-bold"
                              >
                                عرض الإجابات
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* نافذة معاينة إجابات الطالب */}
      {viewingSession && currentProctorExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">إجابات الطالب: {viewingSession.student_name}</h3>
                <p className="text-xs text-slate-500">
                  الدرجة: {viewingSession.score} من {viewingSession.total_marks} | مغادرة التبويب: {viewingSession.tab_switch_count} مرات
                </p>
              </div>
              <button
                onClick={() => setViewingSession(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {currentProctorExam.questions.map((q, qIdx) => {
                const studentAns = viewingSession.answers?.[q.id] || viewingSession.answers?.[String(qIdx)] || 'لم يجب';
                const isCorrect = studentAns.trim() === q.correctAnswer.trim();

                return (
                  <div key={q.id} className={`p-4 rounded-2xl border ${isCorrect ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'}`}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-black text-slate-800">السؤال {qIdx + 1}: {q.text}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {isCorrect ? `+${q.points || 5} د` : '0 د'}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 mt-2">
                      <p className="text-slate-700">
                        <span className="font-bold text-slate-500">إجابة الطالب: </span>
                        <span className={isCorrect ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                          {studentAns}
                        </span>
                      </p>
                      {!isCorrect && (
                        <p className="text-emerald-800">
                          <span className="font-bold">الإجابة النموذجية: </span>
                          {q.correctAnswer}
                        </p>
                      )}
                      {q.explanation && (
                        <p className="text-[11px] text-slate-500 italic mt-1">{q.explanation}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingSession(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-slate-800"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
