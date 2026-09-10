import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Users, GraduationCap, LogOut, Plus, Trash2,
  Lock, User, BookOpen, Award, CheckCircle2, FileText, Send, Sparkles
} from 'lucide-react';
import { 
  UserProfile, SchoolStage, GradeLevel, ArabicTrack, 
  STAGES_CONFIG, Activity, Question, StudentSubmission 
} from './types';
import { 
  getUsers, saveUser, deleteUser, getCurrentUser, setCurrentUser,
  getActivities, saveActivity, deleteActivity, getSubmissions, saveSubmission 
} from './storage';

export default function App() {
  const [currentUser, setUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);

  // تبويبات لوحة المشرف
  const [adminTab, setAdminTab] = useState<'teachers' | 'students'>('teachers');

  // تبويبات لوحة المعلم
  const [teacherTab, setTeacherTab] = useState<'activities' | 'create' | 'grades'>('activities');

  // بيانات تسجيل الدخول
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // استمارة إضافة مستخدم جديد (المشرف)
  const [formRole, setFormRole] = useState<'teacher' | 'student'>('teacher');
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [selectedStages, setSelectedStages] = useState<SchoolStage[]>([]);
  const [studentStage, setStudentStage] = useState<SchoolStage>('primary');
  const [studentGrade, setStudentGrade] = useState<GradeLevel>('grade-1');
  const [studentTrack, setStudentTrack] = useState<ArabicTrack>('arabic-a');

  // استمارة بناء نشاط جديد (المعلم)
  const [actTitle, setActTitle] = useState('');
  const [actPassage, setActPassage] = useState('');
  const [actStage, setActStage] = useState<SchoolStage>('primary');
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
    setUsers(getUsers());
    setActivities(getActivities());
    setSubmissions(getSubmissions());
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const all = getUsers();
    const found = all.find(
      (u) => u.username.toLowerCase() === loginUsername.trim().toLowerCase() && u.password === loginPassword
    );

    if (found) {
      setCurrentUser(found);
      setUser(found);
      if (found.role === 'teacher' && found.allowedStages && found.allowedStages.length > 0) {
        setActStage(found.allowedStages[0]);
        setActGrade(STAGES_CONFIG[found.allowedStages[0]].grades[0].id);
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
  };

  // إضافة مستخدم من المشرف
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formUsername || !formPassword) return;

    const newUser: UserProfile = {
      id: 'usr_' + Date.now(),
      name: formName,
      username: formUsername.trim().toLowerCase(),
      password: formPassword,
      role: formRole,
      ...(formRole === 'teacher'
        ? { allowedStages: selectedStages }
        : { stage: studentStage, grade: studentGrade, track: studentTrack }),
    };

    saveUser(newUser);
    setUsers(getUsers());
    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setSelectedStages([]);
    alert('تم إضافة الحساب بنجاح وتعيين الصلاحيات!');
  };

  const handleDeleteUser = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الحساب؟')) {
      deleteUser(id);
      setUsers(getUsers());
    }
  };

  const toggleStage = (st: SchoolStage) => {
    setSelectedStages((prev) =>
      prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]
    );
  };

  // دوال المعلم لإدارة الأسئلة والأنشطة
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

    // التحقق من تعبئة الإجابات الصحيحة
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].text.trim() || !questions[i].correctAnswer) {
        alert(`يرجى كتابة نص السؤال رقم (${i + 1}) وتحديد الإجابة الصحيحة له.`);
        return;
      }
    }

    const newActivity: Activity = {
      id: 'act_' + Date.now(),
      title: actTitle,
      passage: actPassage,
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      stage: actStage,
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
    alert('تم نشر النشاط التفاعلي لطلاب الصف المحدد بنجاح!');
    setTeacherTab('activities');
  };

  // دوال حل النشاط للطالب
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
      score: earnedPoints,
      totalPoints: totalPoints,
      submittedAt: new Date().toLocaleDateString('ar-EG'),
      answers: studentAnswers,
    };

    saveSubmission(sub);
    setSubmissions(getSubmissions());
    setLastScore({ score: earnedPoints, total: totalPoints });
    setQuizFinished(true);
  };

  // ================= 1. شاشة تسجيل الدخول =================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-200/80">
          <div className="w-16 h-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold shadow-md shadow-emerald-200">
            م
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 text-center mb-1">منصة تعلَّم مع موسى</h1>
          <p className="text-slate-500 text-xs text-center mb-6">تسجيل الدخول للنظام المركزي</p>

          {loginError && (
            <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl text-center">
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
                  placeholder="مثال: admin"
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
              بيانات الدخول للمشرف: <b>admin</b> / كلمة المرور: <b>123</b>
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ================= 2. واجهة المشرف العام (Super Admin) =================
  if (currentUser.role === 'super_admin') {
    const teachersList = users.filter((u) => u.role === 'teacher');
    const studentsList = users.filter((u) => u.role === 'student');

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold text-lg">
              م
            </div>
            <div>
              <h1 className="font-extrabold text-base text-slate-800">تعلَّم مع موسى | لوحة الإدارة العليا</h1>
              <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
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

        <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* استمارة إضافة الحسابات */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs sticky top-24">
              <h2 className="font-bold text-base mb-4 flex items-center gap-2 text-slate-800">
                <Plus className="w-5 h-5 text-emerald-600" /> إضافة مستخدم جديد
              </h2>

              <div className="flex gap-2 mb-5">
                <button
                  type="button"
                  onClick={() => setFormRole('teacher')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                    formRole === 'teacher'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> معلم
                </button>
                <button
                  type="button"
                  onClick={() => setFormRole('student')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                    formRole === 'student'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" /> طالب
                </button>
              </div>

              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أ/ محمد أحمد"
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
                      placeholder="teacher1"
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
                      placeholder="123456"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {formRole === 'teacher' && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <label className="block text-xs font-bold text-slate-700">
                      المراحل المسموح للمعلم بدخولها فقط:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(STAGES_CONFIG) as SchoolStage[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => toggleStage(st)}
                          className={`p-2 rounded-xl border text-right text-[11px] font-semibold transition flex items-center justify-between ${
                            selectedStages.includes(st)
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>{STAGES_CONFIG[st].nameAr}</span>
                          {selectedStages.includes(st) && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        </button>
                      ))}
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

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition"
                >
                  حفظ وتأكيد الحساب
                </button>
              </form>
            </div>
          </div>

          {/* استعراض القوائم */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
              <div className="flex gap-2 mb-6 pb-4 border-b border-slate-100">
                <button
                  onClick={() => setAdminTab('teachers')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    adminTab === 'teachers' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  قائمة المعلمين ({teachersList.length})
                </button>
                <button
                  onClick={() => setAdminTab('students')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    adminTab === 'students' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  قائمة الطلاب ({studentsList.length})
                </button>
              </div>

              {adminTab === 'teachers' && (
                <div className="space-y-3">
                  {teachersList.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">لم يتم إضافة معلمين حتى الآن.</p>
                  ) : (
                    teachersList.map((t) => (
                      <div key={t.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-slate-800">{t.name}</h4>
                          <span className="text-[11px] text-slate-500">اسم المستخدم: <b>{t.username}</b> • كلمة السر: <b>{t.password}</b></span>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {t.allowedStages && t.allowedStages.length > 0 ? (
                              t.allowedStages.map((st) => (
                                <span key={st} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                                  {STAGES_CONFIG[st]?.nameAr}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-rose-500 font-medium">لم يتم تحديد مراحل بعد</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteUser(t.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {adminTab === 'students' && (
                <div className="space-y-3">
                  {studentsList.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">لم يتم إضافة طلاب حتى الآن.</p>
                  ) : (
                    studentsList.map((st) => (
                      <div key={st.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-slate-800">{st.name}</h4>
                          <span className="text-[11px] text-slate-500">اسم الدخول: <b>{st.username}</b> • كلمة السر: <b>{st.password}</b></span>
                          <div className="flex gap-2 mt-2">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[10px] font-bold">
                              {st.stage ? STAGES_CONFIG[st.stage]?.nameAr : ''}
                            </span>
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md text-[10px] font-bold">
                              {st.grade}
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
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ================= 3. واجهة المعلم (Teacher Portal) =================
  if (currentUser.role === 'teacher') {
    const allowedStages = currentUser.allowedStages || [];
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
              <p className="text-xs text-slate-500 font-medium">
                المعلم: <b className="text-slate-800">{currentUser.name}</b>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
            >
              <LogOut className="w-3.5 h-3.5" /> تسجيل خروج
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">
          {/* شريط التبويبات للمعلم */}
          <div className="flex gap-3 mb-6">
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
              <Plus className="w-4 h-4" /> إنشاء نشاط تفاعلي جديد
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

          {/* تبويب: إنشاء نشاط جديد */}
          {teacherTab === 'create' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs max-w-3xl mx-auto">
              <h2 className="font-extrabold text-lg mb-1 flex items-center gap-2 text-slate-800">
                <Sparkles className="w-5 h-5 text-emerald-600" /> بناء نشاط تعليمي تفاعلي
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                صمم أسئلة تفاعلية لطلاب صفوفك المعتمدة ليتم حلها مباشرة.
              </p>

              {allowedStages.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs">
                  تنبيه: لم يقم المشرف العام بتعيين أي مراحل دراسية لحسابك بعد. يرجى مراجعة إدارة المنصة.
                </div>
              ) : (
                <form onSubmit={handleSaveActivity} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">المرحلة الدراسية المصرحة</label>
                      <select
                        value={actStage}
                        onChange={(e) => {
                          const s = e.target.value as SchoolStage;
                          setActStage(s);
                          setActGrade(STAGES_CONFIG[s].grades[0].id);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                      >
                        {allowedStages.map((st) => (
                          <option key={st} value={st}>{STAGES_CONFIG[st]?.nameAr}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الصف المستهدف</label>
                      <select
                        value={actGrade}
                        onChange={(e) => setActGrade(e.target.value as GradeLevel)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                      >
                        {STAGES_CONFIG[actStage]?.grades.map((g) => (
                          <option key={g.id} value={g.id}>{g.labelAr}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">المسار اللغوي</label>
                      <select
                        value={actTrack}
                        onChange={(e) => setActTrack(e.target.value as ArabicTrack)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                      >
                        <option value="arabic-a">الناطقين (Arabic A)</option>
                        <option value="arabic-b">غير الناطقين (Arabic B)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">عنوان النشاط / الدرس</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: نشاط تدريبي على علامات الإعراب الأصلية والفرعية"
                      value={actTitle}
                      onChange={(e) => setActTitle(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نص قرائي أو قصة (اختياري)</label>
                    <textarea
                      rows={3}
                      placeholder="يمكنك كتابة نص قصير للقراءة والفهم ليجيب الطالب عن الأسئلة بناءً عليه..."
                      value={actPassage}
                      onChange={(e) => setActPassage(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* بناء الأسئلة */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-slate-800">قائمة الأسئلة التفاعلية</h3>
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
                          <span className="text-xs font-extrabold text-emerald-800">
                            السؤال رقم ({qIndex + 1})
                          </span>
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
                          <label className="block text-[11px] font-bold text-slate-600">
                            خيارات الإجابة (اضغط على الدائرة لاختيار الإجابة الصحيحة):
                          </label>
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
                    اعتماد ونشر النشاط للطلاب
                  </button>
                </form>
              )}
            </div>
          )}

          {/* تبويب: أنشطتي المنشورة */}
          {teacherTab === 'activities' && (
            <div className="space-y-4">
              {teacherActivities.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-bold text-slate-700 text-sm">لا توجد أنشطة منشورة بعد</h3>
                  <p className="text-xs text-slate-400 mt-1 mb-4">ابدأ الآن ببناء أول نشاط تفاعلي لطلابك.</p>
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
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-200">
                            {STAGES_CONFIG[act.stage]?.nameAr}
                          </span>
                          <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold">
                            {act.grade}
                          </span>
                          <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-bold">
                            {act.track === 'arabic-a' ? 'ناطقين' : 'غير ناطقين'}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm mb-1">{act.title}</h3>
                        <p className="text-xs text-slate-400 mb-4">عدد الأسئلة: {act.questions.length} سؤال • تاريخ النشر: {act.createdAt}</p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-medium">
                          إجابات الطلاب المسجلة: <b>{submissions.filter(s => s.activityId === act.id).length}</b>
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

          {/* تبويب: رصد الدرجات */}
          {teacherTab === 'grades' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
              <h2 className="font-extrabold text-base mb-4 text-slate-800">قائمة إجابات ودرجات الطلاب</h2>
              {submissions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">لم يقم أي طالب بحل الأنشطة حتى الآن.</p>
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
      </div>
    );
  }

  // ================= 4. واجهة الطالب (Student Portal) =================
  if (currentUser.role === 'student') {
    const studentActivities = activities.filter(
      (a) => a.stage === currentUser.stage && a.grade === currentUser.grade && a.track === currentUser.track
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
                الطالب: <b className="text-slate-800">{currentUser.name}</b> • {STAGES_CONFIG[currentUser.stage!]?.nameAr} ({currentUser.grade})
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

        <main className="max-w-4xl mx-auto px-4 py-8">
          {/* وضع حل النشاط */}
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
        </main>
      </div>
    );
  }

  return null;
}
