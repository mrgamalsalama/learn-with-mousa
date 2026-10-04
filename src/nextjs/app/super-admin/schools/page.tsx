'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, Plus, Search, ShieldAlert, Sparkles, CheckCircle2, 
  XCircle, Clock, Calendar, Users, RefreshCw, KeyRound, ExternalLink,
  Sliders, ShieldCheck, PowerOff, AlertTriangle
} from 'lucide-react';

interface SchoolData {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'expired';
  plan_tier: 'trial' | 'annual';
  subscription_start_date: string;
  subscription_end_date: string;
  ai_enabled: boolean;
  max_students: number;
  student_count?: number;
  teacher_count?: number;
}

export default function SuperAdminSchoolsPage() {
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'expired'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formPlan, setFormPlan] = useState<'trial' | 'annual'>('annual');
  const [formMaxStudents, setFormMaxStudents] = useState('500');
  const [formDurationDays, setFormDurationDays] = useState('365');
  const [formAdminName, setFormAdminName] = useState('');
  const [formAdminUsername, setFormAdminUsername] = useState('');
  const [formAdminPassword, setFormAdminPassword] = useState('');

  const fetchSchools = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/schools');
      const json = await res.json();
      if (json.schools) {
        setSchools(json.schools);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  const handleToggleAi = async (school: SchoolData) => {
    setActionLoadingId(school.id);
    try {
      const res = await fetch(`/api/super-admin/schools/${school.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_enabled: !school.ai_enabled })
      });
      if (res.ok) {
        setSchools(prev => prev.map(s => s.id === school.id ? { ...s, ai_enabled: !s.ai_enabled } : s));
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUpdateStatus = async (schoolId: string, newStatus: 'active' | 'suspended' | 'expired') => {
    setActionLoadingId(schoolId);
    try {
      const res = await fetch(`/api/super-admin/schools/${schoolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setSchools(prev => prev.map(s => s.id === schoolId ? { ...s, status: newStatus } : s));
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleExtendSubscription = async (schoolId: string, days: number) => {
    setActionLoadingId(schoolId);
    try {
      const res = await fetch(`/api/super-admin/schools/${schoolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extendDays: days })
      });
      const data = await res.json();
      if (res.ok && data.school) {
        setSchools(prev => prev.map(s => s.id === schoolId ? { ...s, ...data.school } : s));
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoadingId('new');
    try {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + Number(formDurationDays) * 86400000).toISOString();

      const res = await fetch('/api/super-admin/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          slug: formSlug || formName.toLowerCase().replace(/\s+/g, '-'),
          plan_tier: formPlan,
          subscription_start_date: startDate,
          subscription_end_date: endDate,
          max_students: Number(formMaxStudents) || 500,
          ai_enabled: true,
          adminName: formAdminName,
          adminUsername: formAdminUsername,
          adminPassword: formAdminPassword,
        })
      });

      if (res.ok) {
        setIsCreateModalOpen(false);
        setFormName('');
        setFormSlug('');
        setFormAdminName('');
        setFormAdminUsername('');
        setFormAdminPassword('');
        fetchSchools();
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredSchools = schools.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/80 backdrop-blur-xl border border-slate-700 p-6 rounded-3xl shadow-xl">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">إدارة المدارس والاشتراكات المركزية</h1>
                <p className="text-xs text-slate-400">التحكم في العزل المدرسي، اشتراكات SaaS، ومفتاح تعطيل الذكاء الاصطناعي (AI Kill Switch)</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchSchools}
              className="p-2.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-600 text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white font-bold rounded-xl transition text-xs shadow-lg shadow-emerald-600/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مدرسة جديدة</span>
            </button>
          </div>
        </header>

        {/* Stats KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
            <span className="text-xs font-bold text-slate-400 block mb-1">إجمالي المدارس</span>
            <span className="text-3xl font-black text-white">{schools.length}</span>
          </div>
          <div className="bg-slate-800/60 border border-emerald-500/20 rounded-2xl p-4">
            <span className="text-xs font-bold text-emerald-400 block mb-1">المدارس النشطة</span>
            <span className="text-3xl font-black text-emerald-300">
              {schools.filter(s => s.status === 'active').length}
            </span>
          </div>
          <div className="bg-slate-800/60 border border-rose-500/20 rounded-2xl p-4">
            <span className="text-xs font-bold text-rose-400 block mb-1">المدارس المعلقة / المنتهية</span>
            <span className="text-3xl font-black text-rose-300">
              {schools.filter(s => s.status !== 'active').length}
            </span>
          </div>
          <div className="bg-slate-800/60 border border-indigo-500/20 rounded-2xl p-4">
            <span className="text-xs font-bold text-indigo-400 block mb-1">الذكاء الاصطناعي مفعّل</span>
            <span className="text-3xl font-black text-indigo-300">
              {schools.filter(s => s.ai_enabled).length} / {schools.length}
            </span>
          </div>
        </div>

        {/* Filter & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/60">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="ابحث باسم المدرسة أو المعرّف (slug)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {(['all', 'active', 'suspended', 'expired'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {st === 'all' ? 'الكل' : st === 'active' ? 'نشطة' : st === 'suspended' ? 'معلقة' : 'منتهية'}
              </button>
            ))}
          </div>
        </div>

        {/* Schools Cards List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSchools.map(school => {
            const isSuspended = school.status === 'suspended';
            const isExpired = school.status === 'expired' || (school.subscription_end_date && new Date(school.subscription_end_date).getTime() < Date.now());
            const daysLeft = school.subscription_end_date 
              ? Math.ceil((new Date(school.subscription_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <div 
                key={school.id}
                className={`bg-slate-800/90 rounded-3xl p-5 border transition-all relative flex flex-col justify-between ${
                  isSuspended 
                    ? 'border-rose-500/40 shadow-lg shadow-rose-950/20' 
                    : isExpired
                    ? 'border-amber-500/40 shadow-lg shadow-amber-950/20'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-base font-extrabold text-white mb-0.5">{school.name}</h3>
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded-md">
                        {school.slug}
                      </span>
                    </div>

                    <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black tracking-wide ${
                      school.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : school.status === 'suspended'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {school.status === 'active' ? 'نشطة' : school.status === 'suspended' ? 'معلقة إدارياً' : 'منتهية الصلاحية'}
                    </span>
                  </div>

                  {/* Metadata pills */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-3 rounded-2xl border border-slate-700/50 mb-4">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">باقة الاشتراك</span>
                      <span className="font-bold text-slate-200 capitalize">
                        {school.plan_tier === 'trial' ? 'تجريبي (Trial)' : 'سنوي (Annual)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">الطلاب</span>
                      <span className="font-bold text-slate-200">
                        {school.student_count || 0} / {school.max_students}
                      </span>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">نهاية الاشتراك:</span>
                      <span className={`text-[11px] font-bold ${
                        daysLeft !== null && daysLeft <= 0 
                          ? 'text-rose-400 font-black' 
                          : daysLeft !== null && daysLeft <= 30
                          ? 'text-amber-400'
                          : 'text-slate-300'
                      }`}>
                        {daysLeft !== null && daysLeft <= 0 ? 'منتهي الصلاحية' : `${daysLeft} يوم متبقي`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Controls & Actions */}
                <div className="space-y-3 pt-3 border-t border-slate-700/60">
                  {/* AI Kill Switch Toggle */}
                  <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/60">
                    <div className="flex items-center gap-2">
                      <Sparkles className={`w-4 h-4 ${school.ai_enabled ? 'text-amber-400' : 'text-slate-500'}`} />
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">الذكاء الاصطناعي (AI)</span>
                        <span className="text-[10px] text-slate-400">
                          {school.ai_enabled ? 'مفعّل للمدرسة' : 'معطّل (Kill Switch)'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleAi(school)}
                      disabled={actionLoadingId === school.id}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        school.ai_enabled ? 'bg-emerald-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          school.ai_enabled ? '-translate-x-6' : '-translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2">
                    {school.status === 'active' ? (
                      <button
                        onClick={() => handleUpdateStatus(school.id, 'suspended')}
                        disabled={actionLoadingId === school.id}
                        className="flex-1 py-2 px-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold rounded-xl text-xs transition text-center"
                      >
                        تعليق المدرسة
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(school.id, 'active')}
                        disabled={actionLoadingId === school.id}
                        className="flex-1 py-2 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold rounded-xl text-xs transition text-center"
                      >
                        تفعيل المدرسة
                      </button>
                    )}

                    <button
                      onClick={() => handleExtendSubscription(school.id, 30)}
                      disabled={actionLoadingId === school.id}
                      className="py-2 px-3 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 font-bold rounded-xl text-xs transition"
                      title="تمديد 30 يوماً"
                    >
                      +30 يوم
                    </button>
                    <button
                      onClick={() => handleExtendSubscription(school.id, 365)}
                      disabled={actionLoadingId === school.id}
                      className="py-2 px-3 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 font-bold rounded-xl text-xs transition"
                      title="تمديد سنة كاملة"
                    >
                      +1 سنة
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal إضافة مدرسة جديدة */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <span>إضافة مدرسة جديدة إلى المنظومة</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSchool} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">اسم المدرسة</label>
                  <input
                    type="text"
                    required
                    placeholder="مدرسة الأمل الدولية"
                    value={formName}
                    onChange={e => {
                      setFormName(e.target.value);
                      if (!formSlug) setFormSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">المعرّف النصي (slug)</label>
                  <input
                    type="text"
                    required
                    placeholder="al-amal-school"
                    value={formSlug}
                    onChange={e => setFormSlug(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">باقة الاشتراك</label>
                  <select
                    value={formPlan}
                    onChange={e => setFormPlan(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="annual">سنوي (Annual)</option>
                    <option value="trial">تجريبي (Trial)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">السعة القصوى للطلاب</label>
                  <input
                    type="number"
                    value={formMaxStudents}
                    onChange={e => setFormMaxStudents(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">مدة الاشتراك (بالأيام)</label>
                  <input
                    type="number"
                    value={formDurationDays}
                    onChange={e => setFormDurationDays(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              {/* حساب مدير المدرسة */}
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-700/60 space-y-3">
                <span className="block text-xs font-black text-emerald-400">حساب مدير المدرسة الافتراضي:</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">اسم المدير</label>
                    <input
                      type="text"
                      placeholder="أ. خالد المحمدي"
                      value={formAdminName}
                      onChange={e => setFormAdminName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">اسم الدخول</label>
                    <input
                      type="text"
                      placeholder="school_admin"
                      value={formAdminUsername}
                      onChange={e => setFormAdminUsername(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">كلمة المرور</label>
                    <input
                      type="text"
                      placeholder="123456"
                      value={formAdminPassword}
                      onChange={e => setFormAdminPassword(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId === 'new'}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20"
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
}
