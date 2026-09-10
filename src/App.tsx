import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Users, GraduationCap, LogOut, Plus, Trash2,
  Lock, User, Layers, CheckCircle2, ChevronLeft
} from 'lucide-react';
import { UserProfile, UserRole, SchoolStage, GradeLevel, ArabicTrack, STAGES_CONFIG } from './types';
import { getUsers, saveUser, deleteUser, getCurrentUser, setCurrentUser } from './storage';

export default function App() {
  const [currentUser, setUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tab, setTab] = useState<'teachers' | 'students'>('teachers');

  // بيانات تسجيل الدخول
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // استمارة إضافة مستخدم جديد (معلم / طالب)
  const [formRole, setFormRole] = useState<'teacher' | 'student'>('teacher');
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  
  // صلاحيات المعلم المحددة
  const [selectedStages, setSelectedStages] = useState<SchoolStage[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<ArabicTrack[]>(['arabic-a']);

  // بيانات الطالب
  const [studentStage, setStudentStage] = useState<SchoolStage>('primary');
  const [studentGrade, setStudentGrade] = useState<GradeLevel>('grade-1');
  const [studentTrack, setStudentTrack] = useState<ArabicTrack>('arabic-a');

  useEffect(() => {
    setUser(getCurrentUser());
    setUsers(getUsers());
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
    } else {
      setLoginError('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUser(null);
    setLoginUsername('');
    setLoginPassword('');
  };

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
        ? {
            allowedStages: selectedStages,
            allowedTracks: selectedTracks,
          }
        : {
            stage: studentStage,
            grade: studentGrade,
            track: studentTrack,
          }),
    };

    saveUser(newUser);
    setUsers(getUsers());
    
    // إعادة تعيين النموذج
    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setSelectedStages([]);
    alert('تم إضافة الحساب بنجاح وتعيين الصلاحيات!');
  };

  const handleDelete = (id: string) => {
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

  // شاشة تسجيل الدخول إذا لم يسجل دخوله بعد
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
              بيانات الدخول التجريبية للمشرف: admin / كلمة المرور: 123
            </span>
          </div>
        </div>
      </div>
    );
  }

  // واجهة المشرف العام (Super Admin)
  if (currentUser.role === 'super_admin') {
    const teachersList = users.filter((u) => u.role === 'teacher');
    const studentsList = users.filter((u) => u.role === 'student');

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        {/* شريط الإدارة العلوي */}
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
          {/* استمارة إضافة الحسابات وتخصيص الصلاحيات */}
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

                {/* خيارات تحديد الصلاحية للمعلم */}
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

                {/* خيارات صف ومرحلة الطالب */}
                {formRole === 'student' && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">المرحلة الدراسية</label>
                      <select
                        value={studentStage}
                        onChange={(e) => setStudentStage(e.target.value as SchoolStage)}
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

          {/* عرض وإدارة الحسابات المسجلة */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <div className="flex gap-2">
                  <button
                    onClick={() => setTab('teachers')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                      tab === 'teachers' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    قائمة المعلمين ({teachersList.length})
                  </button>
                  <button
                    onClick={() => setTab('students')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                      tab === 'students' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    قائمة الطلاب ({studentsList.length})
                  </button>
                </div>
              </div>

              {tab === 'teachers' && (
                <div className="space-y-3">
                  {teachersList.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">لم يتم إضافة معلمين حتى الآن.</p>
                  ) : (
                    teachersList.map((t) => (
                      <div key={t.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-slate-800">{t.name}</h4>
                          <span className="text-[11px] text-slate-500">اسم المستخدم: <b className="text-slate-700">{t.username}</b> • كلمة السر: <b>{t.password}</b></span>
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
                          onClick={() => handleDelete(t.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="حذف الحساب"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'students' && (
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
                          onClick={() => handleDelete(st.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="حذف الحساب"
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

  // واجهة المعلم أو الطالب عند الدخول
  return (
    <div className="min-h-screen bg-slate-100 p-8 flex flex-col items-center justify-center">
      <div className="max-w-lg w-full bg-white rounded-3xl p-8 text-center shadow-lg border border-slate-200">
        <h2 className="text-xl font-bold mb-2">مرحباً بك: {currentUser.name}</h2>
        <p className="text-xs text-slate-500 mb-6">
          نوع الحساب: {currentUser.role === 'teacher' ? 'معلم' : 'طالب'}
        </p>

        {currentUser.role === 'teacher' && (
          <div className="mb-6 p-4 bg-emerald-50 rounded-2xl text-right">
            <h4 className="text-xs font-bold text-emerald-800 mb-2">المراحل المصرح لك بدخولها فقط:</h4>
            <div className="flex flex-wrap gap-2">
              {currentUser.allowedStages?.map((st) => (
                <span key={st} className="px-3 py-1 bg-white text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">
                  {STAGES_CONFIG[st]?.nameAr}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="px-6 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition"
        >
          تسجيل خروج
        </button>
      </div>
    </div>
  );
}
