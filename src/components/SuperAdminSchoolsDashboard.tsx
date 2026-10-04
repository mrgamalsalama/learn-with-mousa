import React, { useState, useEffect } from 'react';
import { 
  Building2, Plus, Search, ShieldAlert, Sparkles, CheckCircle2, 
  XCircle, Clock, Calendar, Users, RefreshCw, KeyRound, ExternalLink,
  Sliders, ShieldCheck, PowerOff, AlertTriangle, UserCheck, Check,
  Activity, Award, ChevronRight, X
} from 'lucide-react';
import { School, UserProfile, SchoolStatus, SchoolPlanTier } from '../types';
import { 
  getSchools, saveSchool, deleteSchool, syncSchoolsFromCloud,
  getUsers, saveUser, setCurrentUser 
} from '../storage';

interface SuperAdminSchoolsDashboardProps {
  currentUser: UserProfile;
  onSchoolsUpdated?: () => void;
  onSimulateUser?: (user: UserProfile) => void;
}

export const SuperAdminSchoolsDashboard: React.FC<SuperAdminSchoolsDashboardProps> = ({
  currentUser,
  onSchoolsUpdated,
  onSimulateUser
}) => {
  const [schools, setSchools] = useState<School[]>(() => getSchools());
  const [users, setUsers] = useState<UserProfile[]>(() => getUsers());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'expired'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // New School Form
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formPlan, setFormPlan] = useState<SchoolPlanTier>('annual');
  const [formMaxStudents, setFormMaxStudents] = useState('500');
  const [formDurationDays, setFormDurationDays] = useState('365');
  const [formAdminName, setFormAdminName] = useState('');
  const [formAdminUsername, setFormAdminUsername] = useState('');
  const [formAdminPassword, setFormAdminPassword] = useState('123456');
  const [formAdminEmail, setFormAdminEmail] = useState('');

  const refreshData = async () => {
    setLoading(true);
    try {
      const cloudSchools = await syncSchoolsFromCloud();
      setSchools(cloudSchools);
      setUsers(getUsers());
      onSchoolsUpdated?.();
    } catch (e) {
      console.warn('Sync failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Toggle School AI Kill Switch
  const handleToggleAi = async (school: School) => {
    setActionLoadingId(school.id);
    const updated: School = {
      ...school,
      ai_enabled: !school.ai_enabled
    };
    try {
      const newList = await saveSchool(updated);
      setSchools(newList);
      showToast(
        updated.ai_enabled 
          ? `تم تفعيل ميزات الذكاء الاصطناعي لمدرسة "${school.name}"`
          : `تم إيقاف الذكاء الاصطناعي (AI Kill Switch) لمدرسة "${school.name}"`
      );
      onSchoolsUpdated?.();
    } finally {
      setActionLoadingId(null);
    }
  };

  // Update Status (active / suspended / expired)
  const handleUpdateStatus = async (school: School, newStatus: SchoolStatus) => {
    setActionLoadingId(school.id);
    const updated: School = {
      ...school,
      status: newStatus
    };
    try {
      const newList = await saveSchool(updated);
      setSchools(newList);
      showToast(`تم تغيير حالة مدرسة "${school.name}" إلى: ${newStatus === 'active' ? 'نشطة' : newStatus === 'suspended' ? 'معلقة' : 'منتهية'}`);
      onSchoolsUpdated?.();
    } finally {
      setActionLoadingId(null);
    }
  };

  // Extend Subscription
  const handleExtendSubscription = async (school: School, days: number) => {
    setActionLoadingId(school.id);
    const currentEnd = school.subscription_end_date 
      ? new Date(school.subscription_end_date).getTime() 
      : Date.now();
    const base = Math.max(currentEnd, Date.now());
    const newEnd = new Date(base + days * 86400000).toISOString();

    const updated: School = {
      ...school,
      subscription_end_date: newEnd,
      status: 'active'
    };

    try {
      const newList = await saveSchool(updated);
      setSchools(newList);
      showToast(`تم تمديد اشتراك مدرسة "${school.name}" بنجاح (${days >= 365 ? 'سنة إضافية' : `${days} يوماً`})`);
      onSchoolsUpdated?.();
    } finally {
      setActionLoadingId(null);
    }
  };

  // Create New School & Admin
  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoadingId('new');

    const cleanSlug = formSlug.trim().toLowerCase().replace(/\s+/g, '-');
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `school_${Date.now()}`;
    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + Number(formDurationDays) * 86400000).toISOString();

    const newSchool: School = {
      id: newId,
      name: formName.trim(),
      slug: cleanSlug,
      status: 'active',
      plan_tier: formPlan,
      subscription_start_date: startDate,
      subscription_end_date: endDate,
      ai_enabled: true,
      max_students: Number(formMaxStudents) || 500,
      created_at: new Date().toISOString()
    };

    try {
      const updatedList = await saveSchool(newSchool);
      setSchools(updatedList);

      // Create initial school admin if specified
      if (formAdminUsername && formAdminPassword) {
        const adminId = `usr_adm_${Date.now()}`;
        const newAdminUser: UserProfile = {
          id: adminId,
          name: formAdminName.trim() || `مدير ${newSchool.name}`,
          username: formAdminUsername.trim(),
          password: formAdminPassword,
          email: formAdminEmail.trim() || undefined,
          role: 'school_admin',
          school_id: newId,
          allowedStages: ['primary', 'middle', 'high'],
          allowedGrades: ['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6'],
          allowedTracks: ['arabic-a', 'arabic-b'],
          loginCount: 0
        };
        await saveUser(newAdminUser);
        setUsers(getUsers());
      }

      setIsCreateModalOpen(false);
      setFormName('');
      setFormSlug('');
      setFormAdminName('');
      setFormAdminUsername('');
      setFormAdminPassword('123456');
      setFormAdminEmail('');
      showToast(`تم إنشاء مدرسة "${newSchool.name}" وضبط فترة اشتراكها بنجاح`);
      onSchoolsUpdated?.();
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered Schools
  const filteredSchools = schools.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 text-slate-800">
      {/* Toast Notice */}
      {successToast && (
        <div className="p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-between shadow-xl animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-200" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="p-1 hover:bg-emerald-700 rounded-lg">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-black border border-indigo-400/30 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>نظام الإدارة المركزي للمنصة (Super Admin SaaS Hub)</span>
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black mb-2">
              حوكمة عزل المدارس واشتراكات المنظومة
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              تحكم كامل في المدارس المسجلة، فترات وتجديد الاشتراكات السنوية، عزل البيانات (Tenant Isolation)، ومفتاح الإيقاف الطارئ للذكاء الاصطناعي (AI Kill Switch) لكل مدرسة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={refreshData}
              disabled={loading}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition border border-white/20 text-xs font-bold flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>تحديث البيانات</span>
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="py-3 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-white font-extrabold rounded-2xl transition text-xs shadow-lg shadow-emerald-500/30 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مدرسة جديدة</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي المدارس المسجلة</span>
            <Building2 className="w-5 h-5 text-indigo-600" />
          </div>
          <span className="text-3xl font-black text-slate-900">{schools.length}</span>
          <span className="block text-[11px] text-slate-400 mt-1">مدارس متعددة النطاقات</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-700">الاشتراكات النشطة</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <span className="text-3xl font-black text-emerald-600">
            {schools.filter(s => s.status === 'active').length}
          </span>
          <span className="block text-[11px] text-emerald-600/70 mt-1">تتمتع بوصول كامل للنظام</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-rose-100 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-700">المدارس المعلقة / المنتهية</span>
            <ShieldAlert className="w-5 h-5 text-rose-600" />
          </div>
          <span className="text-3xl font-black text-rose-600">
            {schools.filter(s => s.status !== 'active').length}
          </span>
          <span className="block text-[11px] text-rose-600/70 mt-1">محجوبة تلقائياً عند الدخول</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-700">مفتاح الذكاء الاصطناعي</span>
            <Sparkles className="w-5 h-5 text-amber-600" />
          </div>
          <span className="text-3xl font-black text-amber-600">
            {schools.filter(s => s.ai_enabled).length} / {schools.length}
          </span>
          <span className="block text-[11px] text-amber-600/70 mt-1">مدارس متاح لها الذكاء الاصطناعي</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            type="text"
            placeholder="ابحث باسم المدرسة أو المعرّف (slug)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {(['all', 'active', 'suspended', 'expired'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'all' ? 'جميع المدارس' : st === 'active' ? 'النشطة' : st === 'suspended' ? 'المعلقة' : 'المنتهية'}
            </button>
          ))}
        </div>
      </div>

      {/* Schools Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredSchools.map(school => {
          const isSuspended = school.status === 'suspended';
          const isExpired = 
            school.status === 'expired' || 
            (school.subscription_end_date && new Date(school.subscription_end_date).getTime() < Date.now());

          const daysLeft = school.subscription_end_date 
            ? Math.ceil((new Date(school.subscription_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;

          const schoolStudents = users.filter(u => u.school_id === school.id && u.role === 'student');
          const schoolTeachers = users.filter(u => u.school_id === school.id && (u.role === 'teacher' || u.role === 'hod'));

          return (
            <div
              key={school.id}
              className={`bg-white rounded-3xl p-6 border transition-all flex flex-col justify-between shadow-xs ${
                isSuspended
                  ? 'border-rose-300 ring-2 ring-rose-500/10'
                  : isExpired
                  ? 'border-amber-300 ring-2 ring-amber-500/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                {/* Header of card */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 mb-1">{school.name}</h3>
                    <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-bold">
                      {school.slug}
                    </span>
                  </div>

                  <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black tracking-wide border ${
                    school.status === 'active' && !isExpired
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : isSuspended
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    {school.status === 'active' && !isExpired
                      ? 'نشطة ومفعلة ✅'
                      : isSuspended
                      ? 'معلقة إدارياً ⛔'
                      : 'منتهية الصلاحية ⏳'}
                  </span>
                </div>

                {/* Info block */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100 mb-4">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">نوع الباقة</span>
                    <span className="font-extrabold text-slate-700">
                      {school.plan_tier === 'trial' ? 'تجريبية (Trial)' : 'اشتراك سنوي (Annual)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">الطلاب المسجلين</span>
                    <span className="font-extrabold text-slate-700">
                      {schoolStudents.length} / {school.max_students}
                    </span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-bold">نهاية الاشتراك:</span>
                    <span className={`font-black ${
                      daysLeft !== null && daysLeft <= 0
                        ? 'text-rose-600'
                        : daysLeft !== null && daysLeft <= 30
                        ? 'text-amber-600'
                        : 'text-emerald-700'
                    }`}>
                      {daysLeft !== null && daysLeft <= 0
                        ? 'منتهي الصلاحية'
                        : `${daysLeft} يوم متبقي`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                {/* AI Kill Switch Toggle */}
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <Sparkles className={`w-4 h-4 ${school.ai_enabled ? 'text-amber-500' : 'text-slate-400'}`} />
                    <div>
                      <span className="text-xs font-black text-slate-800 block">الذكاء الاصطناعي للمدرسة</span>
                      <span className="text-[10px] text-slate-400 block">
                        {school.ai_enabled ? 'مفعّل لجميع المستخدمين' : 'معطّل (Kill Switch)'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleAi(school)}
                    disabled={actionLoadingId === school.id}
                    title={school.ai_enabled ? 'إيقاف الذكاء الاصطناعي' : 'تفعيل الذكاء الاصطناعي'}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      school.ai_enabled ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                        school.ai_enabled ? '-translate-x-6' : '-translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {school.status === 'active' ? (
                    <button
                      onClick={() => handleUpdateStatus(school, 'suspended')}
                      disabled={actionLoadingId === school.id}
                      className="flex-1 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs transition text-center"
                    >
                      تعليق المدرسة
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpdateStatus(school, 'active')}
                      disabled={actionLoadingId === school.id}
                      className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold rounded-xl text-xs transition text-center"
                    >
                      تفعيل المدرسة
                    </button>
                  )}

                  <button
                    onClick={() => handleExtendSubscription(school, 30)}
                    disabled={actionLoadingId === school.id}
                    className="py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-xl text-xs transition"
                    title="تمديد 30 يوماً"
                  >
                    +30 يوم
                  </button>
                  <button
                    onClick={() => handleExtendSubscription(school, 365)}
                    disabled={actionLoadingId === school.id}
                    className="py-2 px-3 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 font-bold rounded-xl text-xs transition"
                    title="تمديد سنة كاملة"
                  >
                    +1 سنة
                  </button>
                </div>

                {/* Simulation trigger */}
                {school.id === '00000000-0000-0000-0000-000000000002' && onSimulateUser && (
                  <button
                    onClick={() => {
                      const suspendedUser = users.find(u => u.school_id === school.id) || {
                        id: 'usr_suspended_demo',
                        name: 'معلم مدرسة النور (المعلقة)',
                        username: 'suspended_user',
                        role: 'teacher',
                        school_id: school.id
                      };
                      onSimulateUser(suspendedUser);
                    }}
                    className="w-full py-2 px-3 bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 border border-rose-300 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>تجربة محاكاة الدخول كمستخدم من هذه المدرسة (اختبار المنع)</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create New School Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                <span>إضافة مدرسة جديدة إلى المنظومة</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSchool} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم المدرسة الرسمي</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أكاديمية النخبة الدولية"
                    value={formName}
                    onChange={e => {
                      setFormName(e.target.value);
                      if (!formSlug) setFormSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المعرّف النصي (slug)</label>
                  <input
                    type="text"
                    required
                    placeholder="al-nokhba-school"
                    value={formSlug}
                    onChange={e => setFormSlug(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">خطة الاشتراك</label>
                  <select
                    value={formPlan}
                    onChange={e => setFormPlan(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  >
                    <option value="annual">اشتراك سنوي (Annual Plan)</option>
                    <option value="trial">فترة تجريبية (Trial Plan)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">السعة القصوى للطلاب</label>
                  <input
                    type="number"
                    value={formMaxStudents}
                    onChange={e => setFormMaxStudents(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مدة الاشتراك (بالأيام)</label>
                  <input
                    type="number"
                    value={formDurationDays}
                    onChange={e => setFormDurationDays(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Initial School Admin Account */}
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-3">
                <span className="block text-xs font-black text-emerald-800">بيانات حساب مدير المدرسة (School Admin):</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">اسم المدير الكامل</label>
                    <input
                      type="text"
                      placeholder="أ. محمد أحمد"
                      value={formAdminName}
                      onChange={e => setFormAdminName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">اسم الدخول</label>
                    <input
                      type="text"
                      placeholder="nokhba_admin"
                      value={formAdminUsername}
                      onChange={e => setFormAdminUsername(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">كلمة المرور</label>
                    <input
                      type="text"
                      placeholder="123456"
                      value={formAdminPassword}
                      onChange={e => setFormAdminPassword(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId === 'new'}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20"
                >
                  {actionLoadingId === 'new' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>حفظ وإنشاء المدرسة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
