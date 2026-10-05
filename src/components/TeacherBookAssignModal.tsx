import React, { useState } from 'react';
import { 
  X, BookOpen, FileCheck2, Users, User, Calendar, CheckCircle2, 
  Sparkles, HelpCircle, Plus, Trash2, Award
} from 'lucide-react';
import { BookItem, UserProfile, GradeLevel, ArabicTrack, Activity, Question, ReadingBookAssignment } from '../types';
import { getGradeLabel } from '../utils/gradebookExport';
import { saveActivity, saveReadingBookAssignment, updateBookAssignment } from '../storage';

interface TeacherBookAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: BookItem | null;
  teacher: UserProfile;
  allowedGrades: GradeLevel[];
  students: UserProfile[];
  initialTab?: 'free_reading' | 'interactive_quiz';
  onSuccess: (msg: string) => void;
}

export const TeacherBookAssignModal: React.FC<TeacherBookAssignModalProps> = ({
  isOpen,
  onClose,
  book,
  teacher,
  allowedGrades,
  students,
  initialTab = 'free_reading',
  onSuccess
}) => {
  if (!isOpen || !book) return null;

  // نوع الإسناد المختار: قراءة حرة ممتعة أو نشاط قرائي تفاعلي
  const [activeTab, setActiveTab] = useState<'free_reading' | 'interactive_quiz'>(initialTab);

  // تحديث التبويب النشط عند تغير initialTab
  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, book?.id]);

  // الاستهداف: الفصل بالكامل أو طالب محدد
  const [targetType, setTargetType] = useState<'class' | 'student'>('class');
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>(allowedGrades[0] || 'grade-1');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // بيانات القراءة الحرة
  const [teacherNote, setTeacherNote] = useState<string>('قراءة ممتعة واستكشاف مشوق! ركز في معاني الكلمات وأحداث القصة.');

  // بيانات التكليف القرائي
  const [quizTitle, setQuizTitle] = useState<string>(`نشاط فهم مقروء: ${book.title}`);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [totalPoints, setTotalPoints] = useState<number>(10);

  // الأسئلة التفاعلية المعدة تلقائياً للقصة
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: 'q_main_idea',
      text: `ما هي الفكرة الرئيسة التي تدور حولها قصة «${book.title}»؟`,
      type: 'multiple_choice',
      options: [
        'التعاون والمثابرة لتحقيق الهدف',
        'التكاسل وإهمال العمل اليومي',
        'الخوف والتردد دون المحاولة',
        'السفر دون هدف محدد'
      ],
      correctAnswer: 'التعاون والمثابرة لتحقيق الهدف',
      points: 4
    },
    {
      id: 'q_character',
      text: 'ما هو السلوك الإيجابي الأبرز الذي ظهر في مجريات القصة؟',
      type: 'multiple_choice',
      options: [
        'المبادرة بمساعدة الآخرين بلطف',
        'التجاهل وعدم الاكتراث',
        'الغضب والتسرع في اتخاذ القرار'
      ],
      correctAnswer: 'المبادرة بمساعدة الآخرين بلطف',
      points: 3
    },
    {
      id: 'q_vocab',
      text: 'ما العبرة والدرس المستفاد من نهاية هذه القصة؟',
      type: 'multiple_choice',
      options: [
        'الأخلاق الحسنة وحسن التصرف يجلبان النجاح والسعادة',
        'تأجيل الواجبات إلى وقت لاحق',
        'الابتعاد عن القراءة والمعرفة'
      ],
      correctAnswer: 'الأخلاق الحسنة وحسن التصرف يجلبان النجاح والسعادة',
      points: 3
    }
  ]);

  // فلترة طلاب الصف المختار
  const classStudents = students.filter(
    s => s.role === 'student' && (!s.grade || s.grade === selectedGrade)
  );

  // تحديث نص سؤال
  const handleUpdateQuestion = (index: number, updated: Question) => {
    setQuestions(prev => {
      const copy = [...prev];
      copy[index] = updated;
      return copy;
    });
  };

  // إرسال كقراءة واستمتع
  const handleSendFreeReading = () => {
    const selectedStudent = selectedStudentId ? students.find(s => s.id === selectedStudentId) : undefined;

    const assignment: ReadingBookAssignment = {
      id: `assign_free_${book.id}_${Date.now()}`,
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
      bookCoverUrl: book.coverUrl,
      bookReadUrl: book.readUrl,
      section: book.section,
      assignmentType: 'free_reading',
      targetType,
      targetGrade: targetType === 'class' ? selectedGrade : selectedStudent?.grade || selectedGrade,
      targetStudentId: targetType === 'student' ? selectedStudentId : undefined,
      targetStudentName: targetType === 'student' ? selectedStudent?.name : undefined,
      teacherId: teacher.id,
      teacherName: teacher.name,
      school_id: teacher.school_id,
      assignedAt: new Date().toLocaleDateString('ar-EG'),
      notes: teacherNote
    };

    saveReadingBookAssignment(assignment);

    // تحديث ربط الكتاب بالصف في المستودع
    if (targetType === 'class') {
      const currentGrades = book.assignedGrades || [];
      if (!currentGrades.includes(selectedGrade)) {
        updateBookAssignment(
          book.id,
          [...currentGrades, selectedGrade],
          book.assignedTracks || ['arabic-a'],
          teacher.id
        );
      }
    }

    onSuccess(
      targetType === 'class'
        ? `تم إرسال قصة «${book.title}» لطلاب ${getGradeLabel(selectedGrade)} بنجاح!`
        : `تم إرسال قصة «${book.title}» للطالب (${selectedStudent?.name || 'المحدد'}) بنجاح!`
    );
    onClose();
  };

  // إرسال كنشاط قرائي تفاعلي عليه درجات
  const handleCreateReadingQuiz = async () => {
    const selectedStudent = selectedStudentId ? students.find(s => s.id === selectedStudentId) : undefined;
    const effectiveGrade = targetType === 'class' ? selectedGrade : (selectedStudent?.grade || selectedGrade);

    const activityId = `act_read_${book.id}_${Date.now()}`;
    const newActivity: Activity = {
      id: activityId,
      title: quizTitle,
      activityType: 'story',
      description: `نشاط قراءة وفهم تفاعلي للقصة المصورة «${book.title}» - مؤلف: ${book.author || 'هنداوي/بوك تايم'}`,
      passage: `📖 القصة المقررة: ${book.title}\nالمؤلف: ${book.author || 'مؤسسة هنداوي (بوك تايم)'}\nرابط قراءة القصة المباشر:\n${book.readUrl}\n\nيرجى قراءة القصة المصورة بدقة وتركيز، ثم الإجابة عن أسئلة الفهم والاستيعاب التالية:`,
      teacherId: teacher.id,
      teacherName: teacher.name,
      school_id: teacher.school_id,
      stage: teacher.stage || 'primary',
      grade: effectiveGrade,
      track: teacher.track || 'arabic-a',
      questions,
      createdAt: new Date().toLocaleDateString('ar-EG')
    };

    await saveActivity(newActivity);

    const assignment: ReadingBookAssignment = {
      id: `assign_quiz_${book.id}_${Date.now()}`,
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
      bookCoverUrl: book.coverUrl,
      bookReadUrl: book.readUrl,
      section: book.section,
      assignmentType: 'interactive_quiz',
      targetType,
      targetGrade: effectiveGrade,
      targetStudentId: targetType === 'student' ? selectedStudentId : undefined,
      targetStudentName: targetType === 'student' ? selectedStudent?.name : undefined,
      teacherId: teacher.id,
      teacherName: teacher.name,
      school_id: teacher.school_id,
      assignedAt: new Date().toLocaleDateString('ar-EG'),
      dueDate,
      notes: `نشاط قرائي رسمي عليه ${totalPoints} درجات - موعد التسليم: ${dueDate}`,
      activityId
    };

    saveReadingBookAssignment(assignment);

    onSuccess(
      `تم تعيين قصة «${book.title}» كنشاط قرائي تفاعلي برصد درجات آلي بنجاح!`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col relative my-auto animate-in fade-in duration-200" dir="rtl">
        
        {/* رأس النافذة ومعاينة الكتاب */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 p-5 text-white flex items-start justify-between relative">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-18 rounded-xl bg-white/10 p-1 border border-white/20 shadow-md flex-shrink-0 overflow-hidden">
              <img src={book.coverUrl} alt={book.title} className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-md inline-block mb-1 text-emerald-200">
                أدوات إسناد الكتاب المدرسي
              </span>
              <h3 className="text-base sm:text-lg font-black">{book.title}</h3>
              <p className="text-xs text-emerald-200/90 mt-0.5">{book.author || 'مؤسسة هنداوي (بوك تايم)'}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* التبديل بين الخيارين المطلوبين في حوكمة المعلم */}
        <div className="grid grid-cols-2 p-2 bg-slate-100 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('free_reading')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'free_reading'
                ? 'bg-white text-emerald-800 shadow-xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <span>خيار 1: إرسال للقراءة والاستمتاع 📖</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('interactive_quiz')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'interactive_quiz'
                ? 'bg-white text-teal-800 shadow-xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck2 className="w-4 h-4 text-teal-600" />
            <span>خيار 2: تعيين كنشاط قرائي تفاعلي 📝</span>
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          
          {/* 1. تحديد الفئة المستهدفة: الفصل بالكامل أم طالب محدد */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <label className="text-xs font-black text-slate-800 block mb-2.5">
              الفئة المستهدفة للإسناد:
            </label>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                type="button"
                onClick={() => setTargetType('class')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  targetType === 'class'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>الفصل بالكامل (الصف الدراسي)</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetType('student')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  targetType === 'student'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>طالب معين</span>
              </button>
            </div>

            {/* اختيار الصف */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  اختر الصف الدراسي:
                </label>
                <select
                  value={selectedGrade}
                  onChange={(e) => {
                    setSelectedGrade(e.target.value as GradeLevel);
                    setSelectedStudentId('');
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                >
                  {allowedGrades.map(g => (
                    <option key={g} value={g}>{getGradeLabel(g)}</option>
                  ))}
                </select>
              </div>

              {targetType === 'student' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    اختر الطالب المستهدف:
                  </label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                  >
                    <option value="">-- اضغط لاختيار طالب من الصف --</option>
                    {classStudents.map(st => (
                      <option key={st.id} value={st.id}>{st.name} ({st.username})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* محتوى خيار 1: إرسال للقراءة والاستمتاع */}
          {activeTab === 'free_reading' && (
            <div className="space-y-3.5">
              <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                  سيظهر هذا الكتاب فوراً في بوابة الطالب داخل رف مخصص بعنوان <b>"قصص رشحها لك معلمك"</b> للقراءة الحرة والاستمتاع دون اشتراط حل أسئلة درجات.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  رسالة وتوجيه تحفيزي من المعلم للطالب:
                </label>
                <textarea
                  value={teacherNote}
                  onChange={(e) => setTeacherNote(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
                  placeholder="أدخل رسالة تشجيعية تظهر للطالب فوق بطاقة القصة..."
                />
              </div>

              <button
                type="button"
                onClick={handleSendFreeReading}
                disabled={targetType === 'student' && !selectedStudentId}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <BookOpen className="w-4 h-4" />
                <span>إرسال القصة للقراءة والاستمتاع فوراً 📖</span>
              </button>
            </div>
          )}

          {/* محتوى خيار 2: تعيين كنشاط قرائي تفاعلي برصد درجات */}
          {activeTab === 'interactive_quiz' && (
            <div className="space-y-4">
              <div className="bg-teal-50/70 border border-teal-200 p-3.5 rounded-2xl flex items-start gap-2.5">
                <Award className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-teal-900 leading-relaxed font-medium">
                  يقوم هذا الخيار بإنشاء تكليف قرائي رسمي مرتبط بالقصة، مع أسئلة فهم مقروء، وإدراجه في قائمة تكليفات ومهام الطالب مع رصد درجات آلي وإشعار فوري.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">عنوان التكليف القرائي:</label>
                  <input
                    type="text"
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>آخر موعد للتسليم (Due Date):</span>
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* قائمة أسئلة الفهم والاستيعاب المرتبطة بالقصة */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-teal-600" />
                    <span>أسئلة الفهم والاستيعاب المقترحة ({questions.length} أسئلة):</span>
                  </label>
                  <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                    مجموع الدرجات: {questions.reduce((acc, q) => acc + (q.points || 1), 0)} درجة
                  </span>
                </div>

                <div className="space-y-2.5">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-black text-slate-700">السؤال {idx + 1} ({q.points} درجات):</span>
                        <span className="text-[10px] text-emerald-700 bg-emerald-100/70 px-2 py-0.2 rounded font-bold">
                          الإجابة النموذجية: {q.correctAnswer}
                        </span>
                      </div>
                      <p className="font-bold text-slate-800 mb-2">{q.text}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {q.options?.map((opt, oIdx) => (
                          <div 
                            key={oIdx} 
                            className={`p-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 ${
                              opt === q.correctAnswer 
                                ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900' 
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            <span className="w-3.5 h-3.5 rounded-full bg-slate-200 text-[9px] flex items-center justify-center font-bold">
                              {oIdx + 1}
                            </span>
                            <span className="truncate">{opt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateReadingQuiz}
                disabled={targetType === 'student' && !selectedStudentId}
                className="w-full py-3.5 bg-teal-700 hover:bg-teal-800 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-teal-700/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>إدراج التكليف القرائي ورصد الدرجات آلياً 📝</span>
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
