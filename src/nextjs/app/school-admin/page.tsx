'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, GraduationCap, Plus, Trash2, Edit3, KeyRound, 
  CheckCircle2, XCircle, Clock, Calendar, Sparkles, ShieldCheck, 
  ShieldAlert, Sliders, AlertTriangle, UserCheck, HeartHandshake,
  Search, BookOpen, Layers, BarChart3, ListTodo, Award, FileText,
  TrendingUp, Printer, Download, Check, RefreshCw
} from 'lucide-react';

interface SchoolData {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'expired';
  plan_tier: 'trial' | 'annual';
  subscription_end_date: string;
  ai_enabled: boolean;
  max_students: number;
}

interface UserProfile {
  id: string;
  name: string;
  username: string;
  role: 'school_admin' | 'teacher' | 'hod' | 'student' | 'parent';
  school_id: string;
  allowedGrades?: string[];
  allowedTracks?: string[];
  grade?: string;
  track?: string;
  ai_access_status?: 'inherit' | 'allowed' | 'blocked';
}

export default function SchoolAdminPortalPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'ai_controls' | 'reports'>('users');
  const [usersSubTab, setUsersSubTab] = useState<'teachers' | 'hods' | 'students' | 'parents'>('teachers');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Demo School State (Scoped to current school)
  const [school, setSchool] = useState<SchoolData>({
    id: '00000000-0000-0000-0000-000000000001',
    name: 'مدرسة موسى النموذجية الرائدة',
    slug: 'mousa-demo',
    status: 'active',
    plan_tier: 'annual',
    subscription_end_date: '2027-12-31T23:59:59.000Z',
    ai_enabled: true,
    max_students: 500,
  });

  const [aiRules, setAiRules] = useState({
    teacher_ai: true,
    student_ai: true,
    parent_ai: true
  });

  const [usersList, setUsersList] = useState<UserProfile[]>([
    {
      id: 'usr_t1',
      name: 'الأستاذة فاطمة الزهراء',
      username: 'teacher_fatima',
      role: 'teacher',
      school_id: '00000000-0000-0000-0000-000000000001',
      allowedGrades: ['الصف الأول', 'الصف الثاني'],
      allowedTracks: ['ناطقين (Arabic A)'],
      ai_access_status: 'allowed'
    },
    {
      id: 'usr_h1',
      name: 'د. أحمد المنصوري',
      username: 'hod_ahmed',
      role: 'hod',
      school_id: '00000000-0000-0000-0000-000000000001',
      ai_access_status: 'inherit'
    },
    {
      id: 'usr_s1',
      name: 'موسى البطل 🌟',
      username: 'mousa_hero',
      role: 'student',
      school_id: '00000000-0000-0000-0000-000000000001',
      grade: 'الصف الأول الابتدائي',
      track: 'ناطقين (Arabic A)',
      ai_access_status: 'inherit'
    },
    {
      id: 'usr_p1',
      name: 'الأستاذ عمر (ولي أمر موسى)',
      username: 'omar_parent',
      role: 'parent',
      school_id: '00000000-0000-0000-0000-000000000001',
      ai_access_status: 'inherit'
    }
  ]);

  // Form State
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formRole, setFormRole] = useState<'teacher' | 'hod' | 'student' | 'parent'>('teacher');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUsername.trim()) return;

    const newUser: UserProfile = {
      id: `usr_${Date.now()}`,
      name: formName.trim(),
      username: formUsername.trim(),
      role: formRole,
      school_id: school.id,
      ai_access_status: 'inherit'
    };

    setUsersList(prev => [...prev, newUser]);
    setFormName('');
    setFormUsername('');
    showToast(`تمت إضافة المستخدم (${newUser.name}) بنجاح`);
  };

  const handleDeleteUser = (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف حساب (${name})؟`)) {
      setUsersList(prev => prev.filter(u => u.id !== id));
      showToast('تم حذف الحساب بنجاح');
    }
  };

  const toggleSchoolAi = () => {
    setSchool(prev => ({ ...prev, ai_enabled: !prev.ai_enabled }));
    showToast(!school.ai_enabled ? 'تم تفعيل الذكاء الاصطناعي للمدرسة' : 'تم تعطيل الذكاء الاصطناعي للمدرسة ككل (Kill Switch)');
  };

  const filteredUsers = usersList.filter(u => {
    const matchRole = u.role === usersSubTab;
    const matchSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        u.username.toLowerCase().includes(searchQuery.toLowerCase());
    return matchRole && matchSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans" dir="rtl">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-2xl animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base text-slate-900">
                بوابة الإدارة العليا للمدرسة | {school.name}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                ● اشتراك سنوي نشط
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              مدير المدرسة: <b className="text-slate-800">أ. عبد الله الراشد</b> • المعرّف: {school.slug}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-semibold hidden md:inline">
            سعة الطلاب: {usersList.filter(u => u.role === 'student').length} / {school.max_students}
          </span>
          <button 
            onClick={() => window.location.href = '/'}
            className="px-3.5 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition"
          >
            تسجيل خروج
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 sticky top-[73px] z-20 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'users'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>إدارة المستخدمين والكادر ({usersList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ai_controls')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'ai_controls'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : !school.ai_enabled
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>الحوكمة الدقيقة للذكاء الاصطناعي (Granular AI Controls)</span>
            {!school.ai_enabled && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'reports'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>التقارير المدرسية الشاملة ومخرجات اللغة العربية 📊</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        
        {/* TAB 1: USERS */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Add User Form */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs sticky top-36">
                <h3 className="font-black text-sm text-slate-900 mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-600" /> إضافة مستخدم لكادر المدرسة
                </h3>

                <div className="grid grid-cols-2 gap-1.5 mb-4">
                  {(['teacher', 'hod', 'student', 'parent'] as const).map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setFormRole(role)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        formRole === role ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {role === 'teacher' ? 'معلم' : role === 'hod' ? 'رئيس قسم' : role === 'student' ? 'طالب' : 'ولي أمر'}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleAddUser} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل</label>
                    <input
                      type="text"
                      required
                      placeholder="الاسم الكامل"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">اسم الدخول (Username)</label>
                    <input
                      type="text"
                      required
                      placeholder="Username"
                      value={formUsername}
                      onChange={e => setFormUsername(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition shadow-md shadow-indigo-600/20"
                  >
                    إضافة الحساب لمدرستي
                  </button>
                </form>
              </div>
            </div>

            {/* List */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div className="flex gap-1.5">
                    {(['teachers', 'hods', 'students', 'parents'] as const).map(sub => (
                      <button
                        key={sub}
                        onClick={() => setUsersSubTab(sub)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                          usersSubTab === sub ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {sub === 'teachers' ? 'المعلمون' : sub === 'hods' ? 'رؤساء الأقسام' : sub === 'students' ? 'الطلاب' : 'أولياء الأمور'}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-48">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="بحث..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredUsers.map(u => (
                    <div key={u.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900">{u.name}</h4>
                        <p className="text-[11px] text-slate-500">اسم الدخول: <b>{u.username}</b></p>
                      </div>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <p className="text-center py-8 text-xs text-slate-400">لا توجد حسابات مطابقة في هذا التصنيف.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GRANULAR AI CONTROLS */}
        {activeTab === 'ai_controls' && (
          <div className="space-y-6">
            <div className={`p-6 sm:p-8 rounded-3xl border transition-all ${
              school.ai_enabled 
                ? 'bg-gradient-to-l from-emerald-950 via-slate-900 to-slate-900 text-white border-emerald-500/30'
                : 'bg-gradient-to-l from-rose-950 via-slate-900 to-slate-900 text-white border-rose-500/40'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-2xl font-black mb-2">
                    مفتاح التعطيل الشامل لمدرسة {school.name} (School Master AI Switch)
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                    إيقاف أو استئناف كافة خدمات الذكاء الاصطناعي على مستوى مدرستك فقط (مع استمرار باقي مدارس المنصة بشكل طبيعي).
                  </p>
                </div>
                <button
                  onClick={toggleSchoolAi}
                  className={`py-3 px-6 rounded-2xl font-black text-xs transition shadow-lg ${
                    school.ai_enabled ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {school.ai_enabled ? 'إيقاف الذكاء الاصطناعي للمدرسة ⛔' : 'تشغيل الذكاء الاصطناعي ⚡'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <h4 className="font-black text-base text-slate-900 mb-1">الذكاء الاصطناعي للمعلمين</h4>
                  <p className="text-xs text-slate-500">توليد الاختبارات، التشكيل الآلي، بنك الأسئلة وتحضير الأنشطة.</p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">الحالة: {aiRules.teacher_ai ? 'مفعّل' : 'معطل'}</span>
                  <button
                    onClick={() => {
                      setAiRules(prev => ({ ...prev, teacher_ai: !prev.teacher_ai }));
                      showToast('تم تحديث إعداد الذكاء الاصطناعي للمعلمين');
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-black bg-slate-900 text-white"
                  >
                    تبديل
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <h4 className="font-black text-base text-slate-900 mb-1">الذكاء الاصطناعي للطلاب</h4>
                  <p className="text-xs text-slate-500">المحادثة مع موسى، التحديات الصوتية والقصص التكيفية.</p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">الحالة: {aiRules.student_ai ? 'مفعّل' : 'معطل'}</span>
                  <button
                    onClick={() => {
                      setAiRules(prev => ({ ...prev, student_ai: !prev.student_ai }));
                      showToast('تم تحديث إعداد الذكاء الاصطناعي للطلاب');
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-black bg-slate-900 text-white"
                  >
                    تبديل
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <h4 className="font-black text-base text-slate-900 mb-1">التقارير الذكية لأولياء الأمور</h4>
                  <p className="text-xs text-slate-500">التحليل التوليدي لنقاط قوة وضعف الطالب القرائية.</p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">الحالة: {aiRules.parent_ai ? 'مفعّل' : 'معطل'}</span>
                  <button
                    onClick={() => {
                      setAiRules(prev => ({ ...prev, parent_ai: !prev.parent_ai }));
                      showToast('تم تحديث إعداد تقارير أولياء الأمور');
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-black bg-slate-900 text-white"
                  >
                    تبديل
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                <span className="text-xs font-bold text-slate-500 block mb-1">إجمالي الطلاب</span>
                <span className="text-3xl font-black text-slate-900">
                  {usersList.filter(u => u.role === 'student').length}
                </span>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-xs">
                <span className="text-xs font-bold text-emerald-700 block mb-1">مسار الناطقين (Arabic A)</span>
                <span className="text-3xl font-black text-emerald-600">92%</span>
                <span className="text-[11px] text-emerald-600/70 block mt-1">نسبة الإتقان القرائي</span>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-xs">
                <span className="text-xs font-bold text-amber-700 block mb-1">مسار غير الناطقين (Arabic B)</span>
                <span className="text-3xl font-black text-amber-600">85%</span>
                <span className="text-[11px] text-amber-600/70 block mt-1">نسبة الوعي الصوتي</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-base text-slate-900">تقرير مخرجات مادة اللغة العربية للفصل الحالي</h4>
                <p className="text-xs text-slate-500 mt-1">يتضمن سجلات الأنشطة ونتائج الاختبارات التشخيصية للطلاب.</p>
              </div>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة التقرير الشامل</span>
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
