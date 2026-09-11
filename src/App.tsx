import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Users, GraduationCap, LogOut, Plus, Trash2, 
  Lock, User, BookOpen, Award, CheckCircle2, FileText, Send, Sparkles, Check, 
  Activity as ActivityIcon, UserCheck, HeartHandshake, BarChart3, Clock, 
  Library, Download, Eye, CheckSquare, X
} from 'lucide-react';
import { 
  UserProfile, UserRole, SchoolStage, GradeLevel, ArabicTrack, 
  STAGES_CONFIG, Activity, Question, StudentSubmission, StoryBankItem, BookItem 
} from './types';
import { 
  getUsers, saveUser, deleteUser, getCurrentUser, setCurrentUser, recordUserLogin,
  getActivities, saveActivity, deleteActivity, getSubmissions, saveSubmission,
  getStoryBank, getBooksRepository, updateBookAssignment
} from './storage';

export default function App() {
  const [currentUser, setUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [storyBank, setStoryBank] = useState<StoryBankItem[]>([]);
  const [books, setBooks] = useState<BookItem[]>([]);

  // تبويبات لوحة المشرف العام
  const [adminTab, setAdminTab] = useState<'hods' | 'teachers' | 'students' | 'parents' | 'bank'>('teachers');

  // تبويبات لوحة رئيس القسم
  const [hodTab, setHodTab] = useState<'overview' | 'teachers' | 'library'>('overview');

  // تبويبات لوحة المعلم
  const [teacherTab, setTeacherTab] = useState<'activities' | 'create' | 'grades' | 'library'>('activities');

  // تبويبات لوحة الطالب
  const [studentTab, setStudentTab] = useState<'activities' | 'library'>('activities');

  // تبويبات لوحة ولي الأمر
  const [parentTab, setParentTab] = useState<'progress' | 'library'>('progress');

  // مرشح تصفية الأقسام والمكتبات
  const [selectedSection, setSelectedSection] = useState<string>('all');

  // نافذة بنك القصص داخل استمارة النشاط
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);

  // نافذة إسناد الكتاب لصفوف المعلم / رئيس القسم
  const [selectedBookForAssign, setSelectedBookForAssign] = useState<BookItem | null>(null);
  const [tempAssignedGrades, setTempAssignedGrades] = useState<GradeLevel[]>([]);
  const [tempAssignedTracks, setTempAssignedTracks] = useState<ArabicTrack[]>(['arabic-a']);

  // عارض الكتاب التفاعلي المباشر (Direct Reader State)
  const [activeReadingBook, setActiveReadingBook] = useState<BookItem | null>(null);

  // بيانات تسجيل الدخول
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // استمارة إضافة مستخدم جديد (لوحة المشرف)
  const [formRole, setFormRole] = useState<UserRole>('teacher');
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');

  // صلاحيات المعلم / رئيس القسم
  const [selectedGrades, setSelectedGrades] = useState<GradeLevel[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<ArabicTrack[]>(['arabic-a']);

  // بيانات الطالب
  const [studentStage, setStudentStage] = useState<SchoolStage>('primary');
  const [studentGrade, setStudentGrade] = useState<GradeLevel>('grade-1');
  const [studentTrack, setStudentTrack] = useState<ArabicTrack>('arabic-a');

  // بيانات ولي الأمر
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // استمارة بناء نشاط جديد (المعلم)
  const [actTitle, setActTitle] = useState('');
  const [actPassage, setActPassage] = useState('');
  const [actGrade, setActGrade] = useState<GradeLevel>('grade-1');
  const [actTrack, setActTrack] = useState<ArabicTrack>('arabic-a');
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: 'q_1',
      text: '',
      type: 'multiple_choice',
      options: ['', '', '', ''],
      correctAnswer: '',
      points: 5,
    },
  ]);

  // حالة حل النشاط لدى الطالب
  const [selectedActivityToSolve, setSelectedActivityToSolve] = useState<Activity | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [lastScore, setLastScore] = useState<{ score: number; total: number } | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
    
    // سحب المستخدمين والأنشطة والدرجات من سحابة Supabase
    syncUsersFromCloud().then(cloudUsers => {
      setUsers(cloudUsers);
    });

    setActivities(getActivities());
    setSubmissions(getSubmissions());
    setStoryBank(getStoryBank());
    setBooks(getBooksRepository());
  }, []);

  const openReader = (book: BookItem) => {
    setActiveReadingBook(book);
  };

  const closeReader = () => {
    setActiveReadingBook(null);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const all = getUsers();
    const found = all.find(
      (u) => u.username.toLowerCase() === loginUsername.trim().toLowerCase() && u.password === loginPassword
    );

    if (found) {
      const updatedUser = recordUserLogin(found);
      setUser(updatedUser);
      setUsers(getUsers());

      if (updatedUser.role === 'teacher') {
        if (updatedUser.allowedGrades && updatedUser.allowedGrades.length > 0) {
          setActGrade(updatedUser.allowedGrades[0]);
        }
        if (updatedUser.allowedTracks && updatedUser.allowedTracks.length > 0) {
          setActTrack(updatedUser.allowedTracks[0]);
        }
      }
    } else {
      setLoginError('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUser(null);
    setLoginUsername('');
    setLoginPassword('');
    setSelectedActivityToSolve(null);
    setQuizFinished(false);
    closeReader();
  };

  const toggleGrade = (gId: GradeLevel) => {
    setSelectedGrades((prev) =>
      prev.includes(gId) ? prev.filter((g) => g !== gId) : [...prev, gId]
    );
  };

  const toggleTrack = (track: ArabicTrack) => {
    setSelectedTracks((prev) =>
      prev.includes(track)
        ? prev.length > 1 ? prev.filter((t) => t !== track) : prev
        : [...prev, track]
    );
  };

  const openAssignModal = (book: BookItem) => {
    setSelectedBookForAssign(book);
    setTempAssignedGrades(book.assignedGrades || []);
    setTempAssignedTracks(book.assignedTracks || ['arabic-a']);
  };

  const toggleAssignGrade = (gId: GradeLevel) => {
    setTempAssignedGrades(prev =>
      prev.includes(gId) ? prev.filter(g => g !== gId) : [...prev, gId]
    );
  };

  const toggleAssignTrack = (t: ArabicTrack) => {
    setTempAssignedTracks(prev =>
      prev.includes(t) ? (prev.length > 1 ? prev.filter(item => item !== t) : prev) : [...prev, t]
    );
  };

  const saveBookAssignment = () => {
    if (!selectedBookForAssign || !currentUser) return;
    updateBookAssignment(
      selectedBookForAssign.id,
      tempAssignedGrades,
      tempAssignedTracks,
      currentUser.id
    );
    setBooks(getBooksRepository());
    setSelectedBookForAssign(null);
    alert('تم تحديث إسناد الكتاب للصفوف بنجاح!');
  };

  const handleImportStory = (story: StoryBankItem) => {
    setActTitle(story.title);
    setActPassage(story.passage);
    setActGrade(story.grade);
    setActTrack(story.track);
    setQuestions(story.questions);
    setIsBankModalOpen(false);
    alert(`تم سحب قصة «${story.title}» وأسئلتها بنجاح!`);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formUsername || !formPassword) return;

    if ((formRole === 'teacher' || formRole === 'hod') && selectedGrades.length === 0) {
      alert('يرجى تحديد صف دراسي واحد على الأقل!');
      return;
    }

    if (formRole === 'parent' && !selectedStudentId) {
      alert('يرجى اختيار الطالب التابع له ولي الأمر!');
      return;
    }

    const stagesOfSelectedGrades: SchoolStage[] = [];
    (Object.keys(STAGES_CONFIG) as SchoolStage[]).forEach((st) => {
      const hasAny = STAGES_CONFIG[st].grades.some((g) => selectedGrades.includes(g.id));
      if (hasAny) stagesOfSelectedGrades.push(st);
    });

    const newUser: UserProfile = {
      id: 'usr_' + Date.now(),
      name: formName,
      username: formUsername.trim().toLowerCase(),
      password: formPassword,
      role: formRole,
      loginCount: 0,
      ...(formRole === 'teacher' || formRole === 'hod'
        ? {
            allowedGrades: selectedGrades,
            allowedStages: stagesOfSelectedGrades,
            allowedTracks: selectedTracks,
          }
        : {}),
      ...(formRole === 'student'
        ? {
            stage: studentStage,
            grade: studentGrade,
            track: studentTrack,
          }
        : {}),
      ...(formRole === 'parent'
        ? {
            studentId: selectedStudentId,
          }
        : {}),
    };

    saveUser(newUser);
    setUsers(getUsers());
    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setSelectedGrades([]);
    setSelectedTracks(['arabic-a']);
    alert('تم إضافة الحساب بنجاح!');
  };

  const handleDeleteUser = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الحساب؟')) {
      deleteUser(id);
      setUsers(getUsers());
    }
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: 'q_' + Date.now(),
        text: '',
        type: 'multiple_choice',
        options: ['', '', '', ''],
        correctAnswer: '',
        points: 5,
      },
    ]);
  };

  const updateQuestionText = (index: number, text: string) => {
    const updated = [...questions];
    updated[index].text = text;
    setQuestions(updated);
  };

  const updateQuestionOption = (qIndex: number, optIndex: number, val: string) => {
    const updated = [...questions];
    if (updated[qIndex].options) {
      updated[qIndex].options![optIndex] = val;
      setQuestions(updated);
    }
  };

  const setCorrectAnswer = (qIndex: number, val: string) => {
    const updated = [...questions];
    updated[qIndex].correctAnswer = val;
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSaveActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !actTitle) return;

    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].text.trim() || !questions[i].correctAnswer) {
        alert(`يرجى كتابة نص السؤال رقم (${i + 1}) وتحديد الإجابة الصحيحة له.`);
        return;
      }
    }

    let derivedStage: SchoolStage = 'primary';
    (Object.keys(STAGES_CONFIG) as SchoolStage[]).forEach((st) => {
      if (STAGES_CONFIG[st].grades.some((g) => g.id === actGrade)) {
        derivedStage = st;
      }
    });

    const newActivity: Activity = {
      id: 'act_' + Date.now(),
      title: actTitle,
      passage: actPassage,
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      stage: derivedStage,
      grade: actGrade,
      track: actTrack,
      questions,
      createdAt: new Date().toLocaleDateString('ar-EG'),
    };

    saveActivity(newActivity);
    setActivities(getActivities());
    setActTitle('');
    setActPassage('');
    setQuestions([
      {
        id: 'q_1',
        text: '',
        type: 'multiple_choice',
        options: ['', '', '', ''],
        correctAnswer: '',
        points: 5,
      },
    ]);
    alert('تم نشر النشاط التفاعلي بنجاح!');
    setTeacherTab('activities');
  };

  const handleSubmitQuiz = () => {
    if (!selectedActivityToSolve || !currentUser) return;

    let totalPoints = 0;
    let earnedPoints = 0;

    selectedActivityToSolve.questions.forEach((q) => {
      totalPoints += q.points;
      if (studentAnswers[q.id] === q.correctAnswer) {
        earnedPoints += q.points;
      }
    });

    const sub: StudentSubmission = {
      id: 'sub_' + Date.now(),
      activityId: selectedActivityToSolve.id,
      activityTitle: selectedActivityToSolve.title,
      studentId: currentUser.id,
      studentName: currentUser.name,
      grade: currentUser.grade,
      track: currentUser.track,
      score: earnedPoints,
      totalPoints: totalPoints,
      submittedAt: new Date().toLocaleString('ar-EG'),
      answers: studentAnswers,
    };

    saveSubmission(sub);
    setSubmissions(getSubmissions());
    setLastScore({ score: earnedPoints, total: totalPoints });
    setQuizFinished(true);
  };

  const getGradeLabel = (gId: GradeLevel): string => {
    for (const st of Object.values(STAGES_CONFIG)) {
      const found = st.grades.find((g) => g.id === gId);
      if (found) return found.labelAr;
    }
    return gId;
  };

  // المكون الموحد لبطاقة الكتاب بأبعاد الغلاف الكاملة وغير المقصوصة
  const renderBookCard = (
    book: BookItem, 
    role: 'teacher' | 'hod' | 'student' | 'parent',
    allowedGrades?: GradeLevel[]
  ) => {
    const isGenericTitle = !book.title || book.title.startsWith('قصة مصورة');
    const isAssigned = allowedGrades ? book.assignedGrades?.some(g => allowedGrades.includes(g)) : false;

    return (
      <div 
        key={book.id} 
        className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
      >
        {/* إطار الغلاف بنسبة أبعاد الكتب الطبيعية الكاملة (aspect 3/4) */}
        <div className="relative aspect-[3/4] w-full bg-slate-900/5 overflow-hidden group flex items-center justify-center p-2">
          <img 
            src={book.coverUrl} 
            alt={book.title} 
            loading="lazy"
            className="w-full h-full object-contain drop-shadow-md rounded-xl group-hover:scale-105 transition duration-300"
          />
          <div className="absolute top-3 right-3 flex flex-col gap-1">
            <span className="px-2.5 py-1 bg-emerald-700/90 backdrop-blur-xs text-white rounded-lg text-[10px] font-bold shadow-xs">
              {book.section || 'مكتبة بوك تايم'}
            </span>
          </div>
        </div>

        {/* بيانات الكتاب وأزرار الإجراءات */}
        <div className="p-4 flex-1 flex flex-col justify-between text-right" dir="rtl">
          <div>
            {!isGenericTitle && (
              <h3 className="font-extrabold text-sm text-slate-800 mb-1 line-clamp-1">
                {book.title}
              </h3>
            )}
            <span className="text-[11px] text-slate-400 block mb-2 font-medium">
              {book.author || 'مؤسسة هنداوي (بوك تايم)'}
            </span>

            {/* إظهار الصفوف المسندة لغير الطلاب */}
            {role !== 'student' && (
              <div className="mb-3">
                <span className="text-[10px] text-slate-400 font-semibold block mb-1">الصفوف المسند إليها:</span>
                {book.assignedGrades && book.assignedGrades.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {book.assignedGrades.map(gId => (
                      <span key={gId} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[9px] font-bold">
                        {getGradeLabel(gId)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-rose-500 font-medium">غير مسند لأي صف بعد</span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100">
            {(role === 'teacher' || role === 'hod') && (
              <button
                type="button"
                onClick={() => openAssignModal(book)}
                className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  isAssigned 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                {isAssigned ? 'تعديل إسناد الصفوف' : 'إسناد الكتاب لصفوفي'}
              </button>
            )}

            <button
              type="button"
              onClick={() => openReader(book)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-500" /> معاينة وقراءة القصة
            </button>
          </div>
        </div>
      </div>
    );
  };

  // المكون الموحد للقارئ التفاعلي المباشر
  const renderSharedReader = () => {
    if (!activeReadingBook) return null;

    const cleanId = activeReadingBook.id.replace('bt_', '');
    const directReaderUrl = `https://read.booktime.org/ar/books/${cleanId}`;

    const handleLaunchReader = () => {
      const w = window.screen.availWidth;
      const h = window.screen.availHeight;
      window.open(
        directReaderUrl,
        'BookReaderWindow',
        `width=${w},height=${h},top=0,left=0,toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );
    };

    return (
      <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-center shadow-2xl relative overflow-hidden">
          <button
            onClick={closeReader}
            className="absolute top-4 left-4 p-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl transition"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="aspect-[3/4] w-44 mx-auto rounded-2xl overflow-hidden shadow-2xl mb-5 border border-slate-700/80 bg-slate-800 p-2 flex items-center justify-center">
            <img
              src={activeReadingBook.coverUrl}
              alt={activeReadingBook.title}
              className="w-full h-full object-contain rounded-xl"
            />
          </div>

          <h3 className="text-lg font-black text-white mb-1">
            {!activeReadingBook.title.startsWith('قصة مصورة') ? activeReadingBook.title : 'معاينة القصة المصورة'}
          </h3>
          <p className="text-xs text-emerald-400 font-medium mb-6">
            {activeReadingBook.author} • {activeReadingBook.category || 'قصص تفاعلية'}
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleLaunchReader}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
            >
              <BookOpen className="w-5 h-5" /> ابدأ قراءة القصة الآن
            </button>

            <button
              type="button"
              onClick={() => {
                alert('رائع! يمكنك الآن التوجه لحل الأنشطة والأسئلة المرتبطة بهذه القصة 🌟');
                closeReader();
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition"
            >
              العودة للمنصة والأنشطة
            </button>
          </div>
        </div>
      </div>
    );
  };

  // استخراج الأقسام المتاحة ديناميكياً لتصنيف المكتبات
  const availableSections = ['all', ...new Set(books.map(b => b.section || 'مكتبة بوك تايم'))];

  // تصفية الكتب وعرض القصص الحقيقية فقط التي تمتلك أغلفة كتب رسمية
  const filteredBooks = books.filter(b => {
    const sec = b.section || 'مكتبة بوك تايم';
    const matchesSection = selectedSection === 'all' || sec === selectedSection;

    // التحقق من أن الغلاف يتبع مجلد الأغلفة الرسمي لبوك تايم
    const isRealBookCover = 
      b.coverUrl && 
      b.coverUrl.includes('/covers/ar/') && 
      !b.coverUrl.includes('.svg');

    // التأكد من وجود معرف رقمي حقيقي للقصة
    const hasValidReadUrl = 
      b.readUrl && 
      (b.readUrl.includes('/books/') || b.readUrl.includes('read.booktime.org')) &&
      !b.title.includes('حساب');

    return matchesSection && isRealBookCover && hasValidReadUrl;
  });

  // ================= 1. شاشة تسجيل الدخول الموحدة =================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-200/80">
          <div className="w-16 h-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold shadow-md shadow-emerald-200">
            م
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 text-center mb-1">منصة تعلَّم مع موسى</h1>
          <p className="text-slate-500 text-xs text-center mb-6">بوابة الدخول للنظام المركزي</p>

          {loginError && (
            <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl text-center font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="اسم المستخدم"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-emerald-600/20"
            >
              تسجيل الدخول
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400">
              دخول المؤسس الافتراضي: <b>admin</b> / كلمة المرور: <b>123</b>
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ================= 2. واجهة المؤسس والمشرف العام (Super Admin) =================
  if (currentUser.role === 'super_admin') {
    const hodsList = users.filter((u) => u.role === 'hod');
    const teachersList = users.filter((u) => u.role === 'teacher');
    const studentsList = users.filter((u) => u.role === 'student');
    const parentsList = users.filter((u) => u.role === 'parent');

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold text-lg">
              م
            </div>
            <div>
              <h1 className="font-extrabold text-base text-slate-800">تعلَّم مع موسى | لوحة المؤسس والإدارة العليا</h1>
              <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> المشرف العام: {currentUser.name}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
          >
            <LogOut className="w-3.5 h-3.5" /> تسجيل خروج
          </button>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <h2 className="font-bold text-base mb-4 flex items-center gap-2 text-slate-800">
                <Plus className="w-5 h-5 text-emerald-600" /> إضافة مستخدم جديد
              </h2>

              <div className="grid grid-cols-2 gap-1.5 mb-5">
                <button
                  type="button"
                  onClick={() => setFormRole('hod')}
                  className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border ${
                    formRole === 'hod' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" /> رئيس قسم
                </button>
                <button
                  type="button"
                  onClick={() => setFormRole('teacher')}
                  className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border ${
                    formRole === 'teacher' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> معلم
                </button>
                <button
                  type="button"
                  onClick={() => setFormRole('student')}
                  className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border ${
                    formRole === 'student' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" /> طالب
                </button>
                <button
                  type="button"
                  onClick={() => setFormRole('parent')}
                  className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border ${
                    formRole === 'parent' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <HeartHandshake className="w-3.5 h-3.5" /> ولي أمر
                </button>
              </div>

              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    required
                    placeholder="الاسم الكامل"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">اسم الدخول</label>
                    <input
                      type="text"
                      required
                      placeholder="Username"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">كلمة السر</label>
                    <input
                      type="text"
                      required
                      placeholder="Password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {(formRole === 'teacher' || formRole === 'hod') && (
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">المسار المصرح به:</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => toggleTrack('arabic-a')}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                            selectedTracks.includes('arabic-a') ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <span>ناطقين (Arabic A)</span>
                          {selectedTracks.includes('arabic-a') && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleTrack('arabic-b')}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                            selectedTracks.includes('arabic-b') ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <span>غير ناطقين (Arabic B)</span>
                          {selectedTracks.includes('arabic-b') && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">الصفوف المصرح بها:</label>
                      <div className="space-y-3 max-h-56 overflow-y-auto pr-1 border border-slate-100 p-2 rounded-2xl bg-slate-50/50">
                        {(Object.keys(STAGES_CONFIG) as SchoolStage[]).map((st) => (
                          <div key={st} className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-500 block">{STAGES_CONFIG[st].nameAr}</span>
                            <div className="grid grid-cols-2 gap-1.5">
                              {STAGES_CONFIG[st].grades.map((g) => (
                                <button
                                  key={g.id}
                                  type="button"
                                  onClick={() => toggleGrade(g.id)}
                                  className={`p-2 rounded-lg border text-right text-[11px] font-semibold transition flex items-center justify-between ${
                                    selectedGrades.includes(g.id) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  <span>{g.labelAr}</span>
                                  {selectedGrades.includes(g.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {formRole === 'student' && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">المرحلة الدراسية</label>
                      <select
                        value={studentStage}
                        onChange={(e) => {
                          const s = e.target.value as SchoolStage;
                          setStudentStage(s);
                          setStudentGrade(STAGES_CONFIG[s].grades[0].id);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                      >
                        {(Object.keys(STAGES_CONFIG) as SchoolStage[]).map((st) => (
                          <option key={st} value={st}>{STAGES_CONFIG[st].nameAr}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الصف التابع له</label>
                      <select
                        value={studentGrade}
                        onChange={(e) => setStudentGrade(e.target.value as GradeLevel)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                      >
                        {STAGES_CONFIG[studentStage].grades.map((g) => (
                          <option key={g.id} value={g.id}>{g.labelAr}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">المسار اللغوي</label>
                      <select
                        value={studentTrack}
                        onChange={(e) => setStudentTrack(e.target.value as ArabicTrack)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                      >
                        <option value="arabic-a">الناطقين باللغة العربية (Arabic A)</option>
                        <option value="arabic-b">الناطقين بغيرها (Arabic B)</option>
                      </select>
                    </div>
                  </div>
                )}

                {formRole === 'parent' && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">اختر الطالب التابع له:</label>
                      {studentsList.length === 0 ? (
                        <p className="text-xs text-rose-500 font-medium">يجب إضافة حساب طالب أولاً.</p>
                      ) : (
                        <select
                          value={selectedStudentId}
                          onChange={(e) => setSelectedStudentId(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-semibold"
                        >
                          {studentsList.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.name} ({getGradeLabel(st.grade!)})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20"
                >
                  حفظ وتأكيد الحساب
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-slate-100">
                <button
                  onClick={() => setAdminTab('teachers')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    adminTab === 'teachers' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  المعلمون ({teachersList.length})
                </button>
                <button
                  onClick={() => setAdminTab('hods')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    adminTab === 'hods' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  رؤساء الأقسام ({hodsList.length})
                </button>
                <button
                  onClick={() => setAdminTab('students')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    adminTab === 'students' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  الطلاب ({studentsList.length})
                </button>
                <button
                  onClick={() => setAdminTab('parents')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    adminTab === 'parents' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  أولياء الأمور ({parentsList.length})
                </button>
                <button
                  onClick={() => setAdminTab('bank')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                    adminTab === 'bank' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  <Library className="w-3.5 h-3.5" /> بنك القصص الإسلامية ({storyBank.length})
                </button>
              </div>

              {adminTab === 'bank' && (
                <div className="space-y-3">
                  {storyBank.map((s) => (
                    <div key={s.id} className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-extrabold text-sm text-slate-800">{s.title}</h4>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                          {s.moralTopic}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mb-2 line-clamp-2 leading-relaxed">{s.passage}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
                        <span>المستوى: {getGradeLabel(s.grade)}</span>
                        <span>•</span>
                        <span>المسار: {s.track === 'arabic-a' ? 'ناطقين' : 'غير ناطقين'}</span>
                        <span>•</span>
                        <span>الأسئلة: {s.questions.length} أسئلة</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {adminTab === 'teachers' && (
                <div className="space-y-3">
                  {teachersList.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">لم يتم إضافة معلمين بعد.</p>
                  ) : (
                    teachersList.map((t) => (
                      <div key={t.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-sm text-slate-800">{t.name}</h4>
                          <span className="text-[11px] text-slate-500">اسم المستخدم: <b>{t.username}</b> • كلمة السر: <b>{t.password}</b></span>
                          <div className="flex gap-1.5 mt-2">
                            {t.allowedTracks?.map((tr) => (
                              <span key={tr} className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md text-[10px] font-bold">
                                {tr === 'arabic-a' ? 'ناطقين' : 'غير ناطقين'}
                              </span>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {t.allowedGrades?.map((gId) => (
                              <span key={gId} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                                {getGradeLabel(gId)}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteUser(t.id)}
                          className="self-end sm:self-center p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {adminTab === 'hods' && (
                <div className="space-y-3">
                  {hodsList.map((h) => (
                    <div key={h.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">{h.name}</h4>
                        <span className="text-[11px] text-slate-500">اسم الدخول: <b>{h.username}</b> • كلمة السر: <b>{h.password}</b></span>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {h.allowedGrades?.map((gId) => (
                            <span key={gId} className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md text-[10px] font-bold">
                              {getGradeLabel(gId)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteUser(h.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {adminTab === 'students' && (
                <div className="space-y-3">
                  {studentsList.map((st) => (
                    <div key={st.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">{st.name}</h4>
                        <span className="text-[11px] text-slate-500">اسم الدخول: <b>{st.username}</b> • كلمة السر: <b>{st.password}</b></span>
                        <div className="flex gap-2 mt-2">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[10px] font-bold">
                            {st.stage ? STAGES_CONFIG[st.stage]?.nameAr : ''}
                          </span>
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md text-[10px] font-bold">
                            {getGradeLabel(st.grade!)}
                          </span>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold">
                            {st.track === 'arabic-a' ? 'ناطقين' : 'غير ناطقين'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteUser(st.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {adminTab === 'parents' && (
                <div className="space-y-3">
                  {parentsList.map((p) => {
                    const linkedStudent = users.find((u) => u.id === p.studentId);
                    return (
                      <div key={p.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-slate-800">{p.name}</h4>
                          <span className="text-[11px] text-slate-500">اسم الدخول: <b>{p.username}</b> • كلمة السر: <b>{p.password}</b></span>
                          <div className="mt-2 text-xs">
                            <span className="text-slate-500">ولي أمر الطالب: </span>
                            <b className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              {linkedStudent ? linkedStudent.name : 'غير محدد'}
                            </b>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteUser(p.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
        {renderSharedReader()}
      </div>
    );
  }

  // ================= 3. واجهة رئيس القسم (HOD Portal) =================
  if (currentUser.role === 'hod') {
    const hodGrades = currentUser.allowedGrades || [];
    const departmentTeachers = users.filter((u) => 
      u.role === 'teacher' && u.allowedGrades?.some((g) => hodGrades.includes(g))
    );
    const departmentSubmissions = submissions.filter((s) => s.grade && hodGrades.includes(s.grade));

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold text-lg">
              م
            </div>
            <div>
              <h1 className="font-extrabold text-base text-slate-800">تعلَّم مع موسى | لوحة رئيس القسم</h1>
              <p className="text-xs text-slate-500 font-medium">رئيس القسم: <b className="text-slate-800">{currentUser.name}</b></p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
          >
            <LogOut className="w-3.5 h-3.5" /> تسجيل خروج
          </button>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
          {/* تبويبات رئيس القسم */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setHodTab('overview')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                hodTab === 'overview' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <BarChart3 className="w-4 h-4" /> النظرة العامة والتقارير
            </button>
            <button
              onClick={() => setHodTab('library')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                hodTab === 'library' ? 'bg-emerald-800 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <Library className="w-4 h-4 text-emerald-400" /> المستودع القرائي وإسناد الكتب ({filteredBooks.length})
            </button>
          </div>

          {hodTab === 'overview' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium">معلمو القسم</span>
                    <h3 className="text-xl font-bold text-slate-800">{departmentTeachers.length} معلم</h3>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <ActivityIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium">إجمالي الأنشطة المنشورة</span>
                    <h3 className="text-xl font-bold text-slate-800">
                      {activities.filter(a => hodGrades.includes(a.grade)).length} نشاط
                    </h3>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium">حلول الطلاب</span>
                    <h3 className="text-xl font-bold text-slate-800">{departmentSubmissions.length} حل مكتمل</h3>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
                <h2 className="font-bold text-base mb-2 text-slate-800 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-600" /> تقرير نشاط وزيارات المعلمين
                </h2>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400">
                        <th className="pb-3 font-semibold">اسم المعلم</th>
                        <th className="pb-3 font-semibold">الصفوف المسندة</th>
                        <th className="pb-3 font-semibold">الأنشطة المنشورة</th>
                        <th className="pb-3 font-semibold">عدد مرات الدخول</th>
                        <th className="pb-3 font-semibold">آخر تسجيل دخول</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {departmentTeachers.map((t) => {
                        const actCount = activities.filter((a) => a.teacherId === t.id).length;
                        return (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="py-3 font-bold text-slate-800">{t.name}</td>
                            <td className="py-3">
                              <div className="flex flex-wrap gap-1">
                                {t.allowedGrades?.map((gId) => (
                                  <span key={gId} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">
                                    {getGradeLabel(gId)}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 font-bold text-emerald-600">{actCount} نشاط</td>
                            <td className="py-3 font-bold text-indigo-600">{t.loginCount || 0} زيارة</td>
                            <td className="py-3 text-slate-500">{t.lastLogin || 'لم يسجل دخول بعد'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {hodTab === 'library' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Library className="w-5 h-5 text-emerald-600" /> المستودع القرائي المركزي (إشراف القسم)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    يمكنك اعتماد القصص وإسنادها لصفوف قسمك لضمان توافقها مع الخطة التعليمية.
                  </p>
                </div>
                <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                  إجمالي الكتب: {filteredBooks.length} كتاب
                </div>
              </div>

              {/* أزرار تصفية الأقسام */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedSection('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    selectedSection === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  جميع الأقسام ({books.length})
                </button>
                {availableSections.filter(s => s !== 'all').map(sec => (
                  <button
                    key={sec}
                    onClick={() => setSelectedSection(sec)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                      selectedSection === sec ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    📚 {sec}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredBooks.map((book) => renderBookCard(book, 'hod', hodGrades))}
              </div>
            </div>
          )}
        </main>
        {renderSharedReader()}
      </div>
    );
  }

  // ================= 4. واجهة المعلم (Teacher Portal) =================
  if (currentUser.role === 'teacher') {
    const teacherAllowedGrades = currentUser.allowedGrades || [];
    const teacherAllowedTracks = currentUser.allowedTracks || ['arabic-a'];
    const teacherActivities = activities.filter((a) => a.teacherId === currentUser.id);

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold text-lg">
              م
            </div>
            <div>
              <h1 className="font-extrabold text-base text-slate-800">تعلَّم مع موسى | بوابة المعلم</h1>
              <p className="text-xs text-slate-500 font-medium">المعلم: <b className="text-slate-800">{currentUser.name}</b></p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
          >
            <LogOut className="w-3.5 h-3.5" /> تسجيل خروج
          </button>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setTeacherTab('activities')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                teacherTab === 'activities' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <BookOpen className="w-4 h-4" /> أنشطتي المنشورة ({teacherActivities.length})
            </button>
            <button
              onClick={() => setTeacherTab('create')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                teacherTab === 'create' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <Plus className="w-4 h-4" /> إنشاء نشاط تفاعلي
            </button>
            <button
              onClick={() => setTeacherTab('library')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                teacherTab === 'library' ? 'bg-emerald-800 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <Library className="w-4 h-4 text-emerald-400" /> المستودع القرائي وإسناد الكتب ({filteredBooks.length})
            </button>
            <button
              onClick={() => setTeacherTab('grades')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                teacherTab === 'grades' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <Award className="w-4 h-4" /> رصد درجات الطلاب ({submissions.length})
            </button>
          </div>

          {/* تبويب: المستودع القرائي الشامل وإسناد الكتب */}
          {teacherTab === 'library' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Library className="w-5 h-5 text-emerald-600" /> المستودع القرائي المركزي
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    اختر القصص والكتب المصورة الملائمة لمناهجك وأسندها لصفوفك لتظهر في مكتبة الطالب فوراً.
                  </p>
                </div>
                <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                  إجمالي الكتب: {filteredBooks.length} كتاب
                </div>
              </div>

              {/* أزرار تصفية الأقسام والمكتبات */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedSection('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    selectedSection === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  جميع الأقسام ({books.length})
                </button>
                {availableSections.filter(s => s !== 'all').map(sec => (
                  <button
                    key={sec}
                    onClick={() => setSelectedSection(sec)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                      selectedSection === sec ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    📚 {sec}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredBooks.map((book) => renderBookCard(book, 'teacher', teacherAllowedGrades))}
              </div>
            </div>
          )}

          {/* تبويب: إنشاء نشاط جديد */}
          {teacherTab === 'create' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs max-w-3xl mx-auto relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="font-extrabold text-lg flex items-center gap-2 text-slate-800">
                    <Sparkles className="w-5 h-5 text-emerald-600" /> بناء نشاط تفاعلي جديد
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">صمم نشاطك أو اسحب قصة وأسئلة إسلامية جاهزة بنقرة زر.</p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsBankModalOpen(true)}
                  className="px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-100 transition flex items-center gap-2 shadow-xs"
                >
                  <Library className="w-4 h-4 text-emerald-600" /> اختيار من بنك القصص الإسلامية
                </button>
              </div>

              {isBankModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto border border-slate-200 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Library className="w-5 h-5 text-emerald-600" />
                        <h3 className="font-extrabold text-sm text-slate-800">بنك القصص والأسئلة الإسلامية والتربوية</h3>
                      </div>
                      <button
                        onClick={() => setIsBankModalOpen(false)}
                        className="text-xs text-slate-400 hover:text-slate-600 font-bold px-2 py-1 rounded-lg"
                      >
                        إغلاق ✕
                      </button>
                    </div>

                    <div className="space-y-3">
                      {storyBank.map((story) => (
                        <div key={story.id} className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50/70 transition flex flex-col justify-between gap-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-bold text-sm text-emerald-950">{story.title}</h4>
                              <span className="px-2 py-0.5 bg-emerald-200/70 text-emerald-900 rounded-md text-[10px] font-bold">
                                {story.moralTopic}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-2">{story.passage}</p>
                            <span className="text-[11px] text-slate-400 font-medium">
                              المستوى: {getGradeLabel(story.grade)} • المسار: {story.track === 'arabic-a' ? 'ناطقين' : 'غير ناطقين'} • الأسئلة: {story.questions.length}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleImportStory(story)}
                            className="self-end px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5" /> سحب هذه القصة والأسئلة للنشاط
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {teacherAllowedGrades.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs">
                  تنبيه: لم يحدد لك المشرف العام صفوفاً دراسية بعد. يرجى مراجعة إدارة المنصة.
                </div>
              ) : (
                <form onSubmit={handleSaveActivity} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الصف المستهدف</label>
                      <select
                        value={actGrade}
                        onChange={(e) => setActGrade(e.target.value as GradeLevel)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-semibold"
                      >
                        {teacherAllowedGrades.map((gId) => (
                          <option key={gId} value={gId}>{getGradeLabel(gId)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">المسار اللغوي</label>
                      <select
                        value={actTrack}
                        onChange={(e) => setActTrack(e.target.value as ArabicTrack)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-semibold"
                      >
                        {teacherAllowedTracks.map((tr) => (
                          <option key={tr} value={tr}>
                            {tr === 'arabic-a' ? 'ناطقين باللغة العربية (Arabic A)' : 'ناطقين بغيرها (Arabic B)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">عنوان النشاط / الدرس</label>
                    <input
                      type="text"
                      required
                      placeholder="عنوان النشاط"
                      value={actTitle}
                      onChange={(e) => setActTitle(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نص قرائي أو قصة (اختياري)</label>
                    <textarea
                      rows={4}
                      placeholder="نص أو قصة ليقرأها الطالب قبل الأسئلة..."
                      value={actPassage}
                      onChange={(e) => setActPassage(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed"
                    />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-slate-800">الأسئلة التفاعلية</h3>
                      <button
                        type="button"
                        onClick={addQuestion}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> إضافة سؤال جديد
                      </button>
                    </div>

                    {questions.map((q, qIndex) => (
                      <div key={q.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-emerald-800">السؤال رقم ({qIndex + 1})</span>
                          {questions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeQuestion(qIndex)}
                              className="text-slate-400 hover:text-rose-600 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <input
                          type="text"
                          required
                          placeholder="اكتب نص السؤال هنا..."
                          value={q.text}
                          onChange={(e) => updateQuestionText(qIndex, e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />

                        <div className="space-y-2 pt-2">
                          <label className="block text-[11px] font-bold text-slate-600">الخيارات (اختر الدائرة للإجابة الصحيحة):</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {q.options?.map((opt, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                                <input
                                  type="radio"
                                  name={`correct_${q.id}`}
                                  checked={q.correctAnswer === opt && opt.trim() !== ''}
                                  onChange={() => setCorrectAnswer(qIndex, opt)}
                                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                                />
                                <input
                                  type="text"
                                  placeholder={`الخيار ${optIndex + 1}`}
                                  value={opt}
                                  onChange={(e) => updateQuestionOption(qIndex, optIndex, e.target.value)}
                                  className="w-full text-xs outline-none bg-transparent"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-sm transition shadow-md shadow-emerald-600/20"
                  >
                    اعتماد ونشر النشاط
                  </button>
                </form>
              )}
            </div>
          )}

          {teacherTab === 'activities' && (
            <div className="space-y-4">
              {teacherActivities.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-bold text-slate-700 text-sm">لا توجد أنشطة منشورة بعد</h3>
                  <p className="text-xs text-slate-400 mt-1 mb-4">أنشئ نشاطك الأول أو اسحب من بنك القصص الإسلامية.</p>
                  <button
                    onClick={() => setTeacherTab('create')}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                  >
                    إنشاء نشاط جديد
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teacherActivities.map((act) => (
                    <div key={act.id} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-200">
                            {getGradeLabel(act.grade)}
                          </span>
                          <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-bold">
                            {act.track === 'arabic-a' ? 'ناطقين' : 'غير ناطقين'}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm mb-1">{act.title}</h3>
                        <p className="text-xs text-slate-400 mb-4">عدد الأسئلة: {act.questions.length} سؤال • {act.createdAt}</p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-medium">
                          إجابات الطلاب: <b>{submissions.filter(s => s.activityId === act.id).length}</b>
                        </span>
                        <button
                          onClick={() => {
                            if (confirm('هل أنت متأكد من حذف هذا النشاط؟')) {
                              deleteActivity(act.id);
                              setActivities(getActivities());
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {teacherTab === 'grades' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
              <h2 className="font-extrabold text-base mb-4 text-slate-800">قائمة درجات وحلول الطلاب</h2>
              {submissions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">لم يقم أي طالب بحل الأنشطة بعد.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400">
                        <th className="pb-3 font-semibold">اسم الطالب</th>
                        <th className="pb-3 font-semibold">النشاط</th>
                        <th className="pb-3 font-semibold">الدرجة</th>
                        <th className="pb-3 font-semibold">النسبة</th>
                        <th className="pb-3 font-semibold">تاريخ التسليم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {submissions.map((sub) => {
                        const percentage = Math.round((sub.score / sub.totalPoints) * 100) || 0;
                        return (
                          <tr key={sub.id} className="hover:bg-slate-50">
                            <td className="py-3 font-bold text-slate-800">{sub.studentName}</td>
                            <td className="py-3 text-slate-600">{sub.activityTitle}</td>
                            <td className="py-3 font-bold text-emerald-600">{sub.score} / {sub.totalPoints}</td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                percentage >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {percentage}%
                              </span>
                            </td>
                            <td className="py-3 text-slate-400">{sub.submittedAt}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>

        {/* نافذة تخصيص إسناد الكتاب لصفوف المعلم */}
        {selectedBookForAssign && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">إسناد الكتاب للطلاب</h3>
                  <span className="text-xs text-emerald-700 font-semibold">{selectedBookForAssign.title}</span>
                </div>
                <button onClick={() => setSelectedBookForAssign(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    اختر الصفوف المصرح لك بها لتظهر القصة في مكتبتهم:
                  </label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {teacherAllowedGrades.map((gId) => (
                      <button
                        key={gId}
                        type="button"
                        onClick={() => toggleAssignGrade(gId)}
                        className={`w-full p-2 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                          tempAssignedGrades.includes(gId)
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span>{getGradeLabel(gId)}</span>
                        {tempAssignedGrades.includes(gId) && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">المسار المتاح له القراءة:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => toggleAssignTrack('arabic-a')}
                      className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                        tempAssignedTracks.includes('arabic-a') ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <span>ناطقين</span>
                      {tempAssignedTracks.includes('arabic-a') && <Check className="w-3 h-3 text-emerald-600" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAssignTrack('arabic-b')}
                      className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                        tempAssignedTracks.includes('arabic-b') ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <span>غير ناطقين</span>
                      {tempAssignedTracks.includes('arabic-b') && <Check className="w-3 h-3 text-emerald-600" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveBookAssignment}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition"
                >
                  حفظ التعيين
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBookForAssign(null)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {renderSharedReader()}
      </div>
    );
  }

  // ================= 5. واجهة الطالب (Student Portal) =================
  if (currentUser.role === 'student') {
    const studentActivities = activities.filter(
      (a) => a.grade === currentUser.grade && a.track === currentUser.track
    );

    const studentAssignedBooks = books.filter(
      (b) => 
        b.assignedGrades?.includes(currentUser.grade!) && 
        b.assignedTracks?.includes(currentUser.track!) &&
        b.coverUrl?.includes('/covers/ar/') &&
        !b.coverUrl?.includes('.svg') &&
        !b.title.includes('حساب')
    );

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold text-lg">
              م
            </div>
            <div>
              <h1 className="font-extrabold text-base text-slate-800">تعلَّم مع موسى | بوابة الطالب</h1>
              <p className="text-xs text-slate-500 font-medium">
                الطالب: <b className="text-slate-800">{currentUser.name}</b> • {getGradeLabel(currentUser.grade!)} ({currentUser.track === 'arabic-a' ? 'ناطقين' : 'غير ناطقين'})
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
          >
            <LogOut className="w-3.5 h-3.5" /> خروج
          </button>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setStudentTab('activities')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                studentTab === 'activities' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <FileText className="w-4 h-4" /> الأنشطة والواجبات ({studentActivities.length})
            </button>
            <button
              onClick={() => setStudentTab('library')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                studentTab === 'library' ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <Library className="w-4 h-4 text-emerald-400" /> رف القراءة ومكتبتي المصورة ({studentAssignedBooks.length})
            </button>
          </div>

          {studentTab === 'library' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-extrabold text-base text-slate-800">قصصك وكتبك المختارة من معلمك</h2>
                  <p className="text-xs text-slate-400">استمتع بقراءة القصص المصورة التفاعلية لتنمية مهاراتك اللغوية.</p>
                </div>
              </div>

              {studentAssignedBooks.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                  <Library className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="font-bold text-slate-700 text-sm">رف القراءة فارغ حالياً</h4>
                  <p className="text-xs text-slate-400 mt-1">سيقوم معلمك بإسناد قصص ممتعة لصفك قريباً.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {studentAssignedBooks.map((book) => renderBookCard(book, 'student'))}
                </div>
              )}
            </div>
          )}

          {studentTab === 'activities' && (
            <div>
              {selectedActivityToSolve ? (
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                  {!quizFinished ? (
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                        <div>
                          <h2 className="text-base font-bold text-slate-800">{selectedActivityToSolve.title}</h2>
                          <p className="text-xs text-slate-500">إعداد الأستاذ: {selectedActivityToSolve.teacherName}</p>
                        </div>
                        <button
                          onClick={() => setSelectedActivityToSolve(null)}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          إلغاء والعودة
                        </button>
                      </div>

                      {selectedActivityToSolve.passage && (
                        <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 mb-6 text-sm text-slate-700 leading-relaxed">
                          <b className="block text-emerald-800 text-xs mb-1">اقرأ الفقرة التالية بعناية:</b>
                          {selectedActivityToSolve.passage}
                        </div>
                      )}

                      <div className="space-y-6">
                        {selectedActivityToSolve.questions.map((q, idx) => (
                          <div key={q.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <h4 className="font-bold text-sm text-slate-800 mb-3">
                              {idx + 1}. {q.text}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {q.options?.map((opt, optIdx) => (
                                <label
                                  key={optIdx}
                                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition text-xs font-semibold ${
                                    studentAnswers[q.id] === opt
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`solve_${q.id}`}
                                    value={opt}
                                    checked={studentAnswers[q.id] === opt}
                                    onChange={() => setStudentAnswers({ ...studentAnswers, [q.id]: opt })}
                                    className="hidden"
                                  />
                                  <span>{opt}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={handleSubmitQuiz}
                        className="w-full mt-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl text-sm hover:bg-emerald-700 transition flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" /> تسليم الإجابات وإنهاء النشاط
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Award className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 mb-1">أحسنت صنعاً! تم تسليم إجابتك</h3>
                      <p className="text-xs text-slate-500 mb-4">نتيجتك في هذا النشاط:</p>
                      <div className="text-3xl font-extrabold text-emerald-600 mb-6">
                        {lastScore?.score} / {lastScore?.total}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedActivityToSolve(null);
                          setQuizFinished(false);
                          setStudentAnswers({});
                        }}
                        className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
                      >
                        العودة لقائمة الأنشطة
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <h2 className="font-extrabold text-base mb-4 text-slate-800">أنشطة صَفّك الدراسي الحالية</h2>
                  {studentActivities.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                      <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h4 className="font-bold text-slate-700 text-sm">لا توجد أنشطة جديدة موجهة لصفك حالياً</h4>
                      <p className="text-xs text-slate-400 mt-1">سيقوم معلمك بنشر الأنشطة والواجبات هنا قريباً.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {studentActivities.map((act) => (
                        <div key={act.id} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                          <div>
                            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-200 mb-2 inline-block">
                              نشاط متاح
                            </span>
                            <h3 className="font-bold text-slate-800 text-sm mb-1">{act.title}</h3>
                            <p className="text-xs text-slate-400 mb-4">إعداد: {act.teacherName} • {act.questions.length} أسئلة</p>
                          </div>
                          <button
                            onClick={() => setSelectedActivityToSolve(act)}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition"
                          >
                            بدء حل النشاط الآن
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
        {renderSharedReader()}
      </div>
    );
  }

  // ================= 6. واجهة ولي الأمر (Parent Portal) =================
  if (currentUser.role === 'parent') {
    const student = users.find((u) => u.id === currentUser.studentId);
    const studentSubs = submissions.filter((s) => s.studentId === currentUser.studentId);

    const totalEarned = studentSubs.reduce((acc, curr) => acc + curr.score, 0);
    const totalPossible = studentSubs.reduce((acc, curr) => acc + curr.totalPoints, 0);
    const avgPercentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

    const childAssignedBooks = student
      ? books.filter(
          (b) => b.assignedGrades?.includes(student.grade!) && b.assignedTracks?.includes(student.track!)
        )
      : [];

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold text-lg">
              م
            </div>
            <div>
              <h1 className="font-extrabold text-base text-slate-800">تعلَّم مع موسى | بوابة ولي الأمر</h1>
              <p className="text-xs text-slate-500 font-medium">مرحباً بك: <b className="text-slate-800">{currentUser.name}</b></p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
          >
            <LogOut className="w-3.5 h-3.5" /> تسجيل خروج
          </button>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          {!student ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
              <p className="text-xs text-rose-500">لم يتم العثور على حساب الطالب المرتبط.</p>
            </div>
          ) : (
            <>
              {/* تبويبات ولي الأمر */}
              <div className="flex gap-2">
                <button
                  onClick={() => setParentTab('progress')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    parentTab === 'progress' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  <Award className="w-4 h-4" /> بطاقة متابعة الطالب
                </button>
                <button
                  onClick={() => setParentTab('library')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    parentTab === 'library' ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  <Library className="w-4 h-4 text-emerald-400" /> مكتبة وكتب الطالب ({childAssignedBooks.length})
                </button>
              </div>

              {parentTab === 'progress' && (
                <>
                  <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
                      <div>
                        <span className="text-xs text-emerald-600 font-bold block mb-1">بطاقة متابعة الطالب</span>
                        <h2 className="text-xl font-black text-slate-800">{student.name}</h2>
                        <span className="text-xs text-slate-500">
                          {getGradeLabel(student.grade!)} • {student.track === 'arabic-a' ? 'مسار الناطقين بها' : 'مسار الناطقين بغيرها'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 bg-emerald-50 px-4 py-2.5 rounded-2xl border border-emerald-100">
                        <Award className="w-8 h-8 text-emerald-600" />
                        <div>
                          <span className="text-[10px] text-emerald-800 font-bold block">معدل التحصيل العام</span>
                          <span className="text-lg font-black text-emerald-700">{avgPercentage}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[11px] text-slate-400 block mb-1">الأنشطة المكتملة</span>
                        <span className="text-base font-extrabold text-slate-800">{studentSubs.length}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[11px] text-slate-400 block mb-1">مجموع الدرجات</span>
                        <span className="text-base font-extrabold text-emerald-600">{totalEarned} نقطة</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                        <span className="text-[11px] text-slate-400 block mb-1">تقييم الأداء</span>
                        <span className="text-xs font-bold text-slate-700">
                          {avgPercentage >= 85 ? 'ممتاز ومتميز 🌟' : avgPercentage >= 70 ? 'جيد جداً 👍' : 'يحتاج متابعة وتدريب 🎯'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
                    <h3 className="font-extrabold text-sm mb-4 text-slate-800">سجل إجابات ودرجات الأنشطة المكتملة</h3>
                    {studentSubs.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-8">لم يكمل الطالب أي نشاط حتى الآن.</p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {studentSubs.map((sub) => {
                          const perc = Math.round((sub.score / sub.totalPoints) * 100) || 0;
                          return (
                            <div key={sub.id} className="py-3.5 flex items-center justify-between">
                              <div>
                                <h4 className="font-bold text-xs text-slate-800 mb-0.5">{sub.activityTitle}</h4>
                                <span className="text-[10px] text-slate-400">تاريخ الإنجاز: {sub.submittedAt}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-xs text-slate-700">
                                  {sub.score} / {sub.totalPoints}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${
                                  perc >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {perc}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {parentTab === 'library' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-extrabold text-base text-slate-800">مكتبة ابنك ({student.name})</h2>
                      <p className="text-xs text-slate-400">يمكنك مطالعة القصص المقررة على ابنك ومشاركته القراءة الممتعة.</p>
                    </div>
                  </div>

                  {childAssignedBooks.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                      <Library className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h4 className="font-bold text-slate-700 text-sm">لا توجد كتب مسندة حالياً</h4>
                      <p className="text-xs text-slate-400 mt-1">سيقوم معلم الصف بإسناد كتب جديدة قريباً.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {childAssignedBooks.map((book) => renderBookCard(book, 'parent'))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
        {renderSharedReader()}
      </div>
    );
  }

  return renderSharedReader();
}
