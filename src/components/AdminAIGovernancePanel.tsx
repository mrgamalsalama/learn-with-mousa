import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, ShieldCheck, Power, Bot, GraduationCap, Users, HeartHandshake,
  AlertTriangle, RefreshCw, CheckCircle2, Lock, Radio, Search, Sliders,
  UserCheck, Ban, Check, Sparkles, Filter, ChevronDown, CheckCircle, XCircle
} from 'lucide-react';
import { AIGovernanceRules, UserProfile, AIAccessStatus, UserRole } from '../types';
import { saveAIGovernanceRules, saveUser, getUsers, canUserUseAI } from '../storage';

interface AdminAIGovernancePanelProps {
  rules: AIGovernanceRules;
  onRulesUpdated: (newRules: AIGovernanceRules) => void;
  adminName?: string;
  users?: UserProfile[];
  onUserUpdated?: (updatedUser: UserProfile) => void;
}

export const AdminAIGovernancePanel: React.FC<AdminAIGovernancePanelProps> = ({
  rules,
  onRulesUpdated,
  adminName = 'المشرف العام',
  users: propUsers,
  onUserUpdated
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [pendingRules, setPendingRules] = useState<AIGovernanceRules>(rules);

  // إدارة قائمة المستخدمين والبحث والفلترة
  const [localUsers, setLocalUsers] = useState<UserProfile[]>(() => propUsers || getUsers());
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [overrideFilter, setOverrideFilter] = useState<'all' | AIAccessStatus>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [userActionNotice, setUserActionNotice] = useState<{ id: string; text: string } | null>(null);

  // مزامنة المستخدمين عند تغير propUsers
  React.useEffect(() => {
    if (propUsers && propUsers.length > 0) {
      setLocalUsers(propUsers);
    }
  }, [propUsers]);

  // تحديث pendingRules عند تغير rules الآتية من الـ Realtime
  React.useEffect(() => {
    setPendingRules(rules);
  }, [rules]);

  const handleToggle = async (key: keyof Pick<AIGovernanceRules, 'master_ai_killswitch' | 'student_ai_enabled' | 'teacher_ai_enabled' | 'parent_ai_enabled'>) => {
    const updated: AIGovernanceRules = {
      ...pendingRules,
      [key]: !pendingRules[key]
    };
    setPendingRules(updated);
    setIsSaving(true);
    setSaveSuccessNotice(null);

    const result = await saveAIGovernanceRules(updated, adminName);
    setIsSaving(false);
    onRulesUpdated(result.rules);
    setSaveSuccessNotice('تم تطبيق ونشر الصلاحيات لحظياً على المنصة ⚡');
    setTimeout(() => {
      setSaveSuccessNotice(null);
    }, 3500);
  };

  // تبديل الصلاحية الفردية لمستخدم محدد وحفظها في Supabase والبث الفوري
  const handleUserOverrideChange = async (targetUser: UserProfile, newStatus: AIAccessStatus) => {
    setUpdatingUserId(targetUser.id);
    const updated: UserProfile = {
      ...targetUser,
      ai_access_status: newStatus
    };

    // تحديث الحالة محلياً فوراً لاستجابة بصرية سلسة
    setLocalUsers(prev => prev.map(u => u.id === targetUser.id ? updated : u));

    try {
      const { user: savedUser, error } = await saveUser(updated);
      if (error) {
        console.error('فشل حفظ استثناء المستخدم في Supabase:', error);
      }
      if (onUserUpdated) {
        onUserUpdated(savedUser);
      }

      const statusLabels: Record<AIAccessStatus, string> = {
        inherit: 'تمت إعادة الضبط للافتراضي (تتبع الفئة)',
        allowed: 'تم التفعيل الاستثنائي الفردي بنجاح ⚡',
        blocked: 'تم تطبيق الحظر التام على الحساب 🚫'
      };

      setUserActionNotice({ id: targetUser.id, text: statusLabels[newStatus] });
      setTimeout(() => {
        setUserActionNotice(prev => prev?.id === targetUser.id ? null : prev);
      }, 3000);
    } catch (err) {
      console.error('خطأ أثناء حفظ استثناء المستخدم:', err);
    } finally {
      setUpdatingUserId(null);
    }
  };

  // تصفية المستخدمين بناءً على البحث والأدوار وحالة الاستثناء
  const filteredUsers = useMemo(() => {
    return localUsers.filter(u => {
      // استبعاد حساب المشرف العام نفسه من جدول الحظر
      if (u.role === 'super_admin') return false;

      // فلترة الدور
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;

      // فلترة الاستثناء
      const currentOverride = u.ai_access_status || 'inherit';
      if (overrideFilter !== 'all' && currentOverride !== overrideFilter) return false;

      // البحث بالاسم أو اسم المستخدم أو الكود
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchName = u.name?.toLowerCase().includes(q);
      const matchUsername = u.username?.toLowerCase().includes(q);
      const matchId = u.id?.toLowerCase().includes(q);
      return matchName || matchUsername || matchId;
    });
  }, [localUsers, searchQuery, roleFilter, overrideFilter]);

  const isMasterKilled = pendingRules.master_ai_killswitch;

  // إحصائيات سريعة للاستثناءات الفردية
  const stats = useMemo(() => {
    const nonAdmins = localUsers.filter(u => u.role !== 'super_admin');
    const allowed = nonAdmins.filter(u => u.ai_access_status === 'allowed').length;
    const blocked = nonAdmins.filter(u => u.ai_access_status === 'blocked').length;
    const inherit = nonAdmins.length - allowed - blocked;
    return { total: nonAdmins.length, allowed, blocked, inherit };
  }, [localUsers]);

  return (
    <div id="ai-governance-panel" className="space-y-6">
      {/* رأس لوحة التحكم */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 border border-slate-700 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${isMasterKilled ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
              {isMasterKilled ? <ShieldAlert className="w-8 h-8 animate-pulse text-rose-400" /> : <ShieldCheck className="w-8 h-8 text-emerald-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight">مركز التحكم والحوكمة المركزية للذكاء الاصطناعي</h3>
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200">
                  <Radio className="w-3 h-3 text-indigo-400 animate-pulse" /> بث مباشر لحظي Realtime
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                صلاحيات سيادية مطلقة للإدارة العليا للتحكم في ميزات نماذج Gemini AI التوليدية، وضمان الالتزام الأخلاقي والتربوي، وإيقاف الميزات فورياً عند الحاجة.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {isSaving && (
              <span className="flex items-center gap-1.5 text-xs text-amber-300 font-bold bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-400/30">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> جاري التحديث السحابي...
              </span>
            )}
            {saveSuccessNotice && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-300 font-bold bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-400/30 animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {saveSuccessNotice}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* زر الطوارئ الرئيسي - Master Kill-Switch */}
      <div className={`p-6 rounded-3xl border transition-all duration-300 shadow-md ${
        isMasterKilled 
          ? 'bg-rose-50 border-rose-300 shadow-rose-200/50' 
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-3.5 rounded-2xl flex-shrink-0 transition-colors ${
              isMasterKilled ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' : 'bg-slate-100 text-slate-600'
            }`}>
              <Power className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-extrabold text-base text-slate-900">
                  زر الإيقاف الشامل للطوارئ (Master AI Killswitch)
                </h4>
                {isMasterKilled ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white animate-pulse">
                    مُعَطَّلٌ كُلِّيّاً في كامل المنصة
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    النظام نشط ويعمل
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                عند تفعيل هذا الزر، سيتم حظر جميع استدعاءات Gemini API ومنع التوليد الصوتي والآلي فوراً عن كامل المنصة لجميع الطلاب والمعلمين وأولياء الأمور دون استثناء.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <button
              type="button"
              id="master-ai-killswitch-toggle"
              disabled={isSaving}
              onClick={() => handleToggle('master_ai_killswitch')}
              className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 ${
                isMasterKilled ? 'bg-rose-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition duration-200 ease-in-out shadow-md ${
                  isMasterKilled ? '-translate-x-9' : '-translate-x-1'
                }`}
              />
            </button>
            <span className={`text-xs font-black min-w-16 text-center ${isMasterKilled ? 'text-rose-700' : 'text-slate-500'}`}>
              {isMasterKilled ? 'مُفعّل (معطل)' : 'غير مُفعّل'}
            </span>
          </div>
        </div>

        {isMasterKilled && (
          <div className="mt-4 p-3.5 bg-rose-100/80 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-900 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-700 flex-shrink-0" />
            <span>
              تنبيه حرج: تم إيقاف الذكاء الاصطناعي مركزياً. تظهر الآن رسائل إشعار واضحة للمستخدمين توضح أن الميزات معطلة بأمر المشرف العام.
            </span>
          </div>
        )}
      </div>

      {/* بوابات التحكم الصلاحياتية حسب الأدوار (Role-Based AI Gates) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. بوابة الطلاب */}
        <div className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
          isMasterKilled 
            ? 'opacity-60 bg-slate-100 border-slate-200 pointer-events-none'
            : pendingRules.student_ai_enabled 
              ? 'bg-white border-emerald-200 hover:border-emerald-300 shadow-xs' 
              : 'bg-amber-50/70 border-amber-200'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-2xl ${pendingRules.student_ai_enabled && !isMasterKilled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="student-ai-toggle"
                  disabled={isSaving || isMasterKilled}
                  onClick={() => handleToggle('student_ai_enabled')}
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors focus:outline-none ${
                    pendingRules.student_ai_enabled && !isMasterKilled ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out shadow-sm ${
                      pendingRules.student_ai_enabled && !isMasterKilled ? '-translate-x-7' : '-translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-1.5">
              <h4 className="font-extrabold text-sm text-slate-800">ميزات الطلاب (Student AI)</h4>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                pendingRules.student_ai_enabled && !isMasterKilled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
              }`}>
                {pendingRules.student_ai_enabled && !isMasterKilled ? 'مفعلة ✅' : 'معطلة ⛔'}
              </span>
            </div>

            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              تشمل: المحادثة الصوتية مع موسى الرفيق، والتلميحات التكيفية التلقائية في التحديات، وتوليد المقالب والمفردات الذكية.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
            <Bot className="w-3.5 h-3.5 text-emerald-600" />
            <span>نطاق التحكم: واجهة الطالب وشاشات الألعاب</span>
          </div>
        </div>

        {/* 2. بوابة المعلمين */}
        <div className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
          isMasterKilled 
            ? 'opacity-60 bg-slate-100 border-slate-200 pointer-events-none'
            : pendingRules.teacher_ai_enabled 
              ? 'bg-white border-indigo-200 hover:border-indigo-300 shadow-xs' 
              : 'bg-amber-50/70 border-amber-200'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-2xl ${pendingRules.teacher_ai_enabled && !isMasterKilled ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-600'}`}>
                <Users className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="teacher-ai-toggle"
                  disabled={isSaving || isMasterKilled}
                  onClick={() => handleToggle('teacher_ai_enabled')}
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors focus:outline-none ${
                    pendingRules.teacher_ai_enabled && !isMasterKilled ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out shadow-sm ${
                      pendingRules.teacher_ai_enabled && !isMasterKilled ? '-translate-x-7' : '-translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-1.5">
              <h4 className="font-extrabold text-sm text-slate-800">ميزات المعلمين (Teacher AI)</h4>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                pendingRules.teacher_ai_enabled && !isMasterKilled ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-900'
              }`}>
                {pendingRules.teacher_ai_enabled && !isMasterKilled ? 'مفعلة ✅' : 'معطلة ⛔'}
              </span>
            </div>

            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              تشمل: توليد الألعاب والقصص التكيفية، التشكيل التلقائي للنصوص، توليد أسئلة الفهم، والتشخيص الصفي الفوري للطلاب.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
            <span>نطاق التحكم: لوحة المعلم واستوديو الأنشطة</span>
          </div>
        </div>

        {/* 3. بوابة أولياء الأمور */}
        <div className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
          isMasterKilled 
            ? 'opacity-60 bg-slate-100 border-slate-200 pointer-events-none'
            : pendingRules.parent_ai_enabled 
              ? 'bg-white border-amber-200 hover:border-amber-300 shadow-xs' 
              : 'bg-amber-50/70 border-amber-200'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-2xl ${pendingRules.parent_ai_enabled && !isMasterKilled ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-600'}`}>
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="parent-ai-toggle"
                  disabled={isSaving || isMasterKilled}
                  onClick={() => handleToggle('parent_ai_enabled')}
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors focus:outline-none ${
                    pendingRules.parent_ai_enabled && !isMasterKilled ? 'bg-amber-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out shadow-sm ${
                      pendingRules.parent_ai_enabled && !isMasterKilled ? '-translate-x-7' : '-translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-1.5">
              <h4 className="font-extrabold text-sm text-slate-800">ميزات أولياء الأمور (Parent AI)</h4>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                pendingRules.parent_ai_enabled && !isMasterKilled ? 'bg-amber-100 text-amber-900' : 'bg-amber-100 text-amber-900'
              }`}>
                {pendingRules.parent_ai_enabled && !isMasterKilled ? 'مفعلة ✅' : 'معطلة ⛔'}
              </span>
            </div>

            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              تشمل: توليد التقارير التشخيصية الفورية بنقرة واحدة، والتوصيات التربوية المخصصة لتعزيز المهارات القرائية في المنزل.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
            <span>نطاق التحكم: لوحة ولي الأمر ومتابعة التقدم</span>
          </div>
        </div>
      </div>

      {/* قسم إدارة الاستثناءات والصلاحيات الفردية (Individual User Overrides) */}
      <div id="individual-ai-overrides-section" className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md space-y-5">
        {/* ترويسة القسم والإحصائيات */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                <Sliders className="w-5 h-5" />
              </div>
              <h4 className="font-black text-base text-slate-900">
                إدارة الاستثناءات والصلاحيات الفردية (Individual User Overrides)
              </h4>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              التحكم الفردي الدقيق في صلاحيات الذكاء الاصطناعي لكل مستخدم على حدة مع الحفظ السحابي الفوري في Supabase.
            </p>
          </div>

          {/* شارات إحصائية سريعة */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              إجمالي المستخدمين: {stats.total}
            </span>
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              استثناء مسموح: {stats.allowed}
            </span>
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
              <Ban className="w-3 h-3 text-rose-600" />
              حظر فردي: {stats.blocked}
            </span>
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200">
              تلقائي (افتراضي): {stats.inherit}
            </span>
          </div>
        </div>

        {/* شريط البحث والفلاتر السريعة */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* حقل البحث */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              id="user-ai-search"
              placeholder="ابحث بالاسم، أو اسم المستخدم، أو معرّف الحساب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none bg-slate-50/50 hover:bg-white transition"
            />
          </div>

          {/* فلتر الدور */}
          <div className="md:col-span-3">
            <div className="relative">
              <select
                id="user-ai-role-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 text-xs bg-slate-50/50 font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none pr-8"
              >
                <option value="all">كل الأدوار (المعلمون، الطلاب، أولياء الأمور)</option>
                <option value="student">الطلاب فقط</option>
                <option value="teacher">المعلمون فقط</option>
                <option value="hod">رؤساء الأقسام فقط</option>
                <option value="parent">أولياء الأمور فقط</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* فلتر حالة الاستثناء */}
          <div className="md:col-span-3">
            <div className="relative">
              <select
                id="user-ai-override-filter"
                value={overrideFilter}
                onChange={(e) => setOverrideFilter(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 text-xs bg-slate-50/50 font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none pr-8"
              >
                <option value="all">كل حالات الذكاء الاصطناعي</option>
                <option value="inherit">الافتراضي (تتبع الفئة)</option>
                <option value="allowed">تفعيل استثنائي (مسموح)</option>
                <option value="blocked">حظر تام (ممنوع)</option>
              </select>
              <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* الجدول التفاعلي للمستخدمين */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-extrabold">
                  <th className="py-3 px-4 text-right">المستخدم</th>
                  <th className="py-3 px-3 text-right">الدور</th>
                  <th className="py-3 px-3 text-center">القرار الفعلي الحالي</th>
                  <th className="py-3 px-4 text-center">حالة الاستثناء (التحكم الفردي)</th>
                  <th className="py-3 px-4 text-center">إجراء التبديل السريع بنقرة واحدة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400 text-xs">
                      لا يوجد مستخدمون يطابقون معايير البحث أو الفلترة المحددة.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const currentOverride: AIAccessStatus = u.ai_access_status || 'inherit';
                    const permissionCheck = canUserUseAI(u, pendingRules);
                    const isAllowedNow = permissionCheck.allowed;
                    const isThisUpdating = updatingUserId === u.id;
                    const userNotice = userActionNotice?.id === u.id ? userActionNotice.text : null;

                    // ترجمة الدور وتلوينه
                    const roleBadge = (() => {
                      switch (u.role) {
                        case 'student':
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800">
                              <GraduationCap className="w-3 h-3 text-emerald-600" /> طالب
                            </span>
                          );
                        case 'teacher':
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-100 text-indigo-800">
                              <Users className="w-3 h-3 text-indigo-600" /> معلم
                            </span>
                          );
                        case 'hod':
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-100 text-purple-800">
                              <UserCheck className="w-3 h-3 text-purple-600" /> رئيس قسم
                            </span>
                          );
                        case 'parent':
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-900">
                              <HeartHandshake className="w-3 h-3 text-amber-700" /> ولي أمر
                            </span>
                          );
                        default:
                          return <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{u.role}</span>;
                      }
                    })();

                    return (
                      <tr 
                        key={u.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          currentOverride === 'allowed' 
                            ? 'bg-emerald-50/20' 
                            : currentOverride === 'blocked' 
                            ? 'bg-rose-50/20' 
                            : ''
                        }`}
                      >
                        {/* عمود اسم المستخدم */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900">{u.name}</span>
                              {isThisUpdating && (
                                <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">@{u.username}</span>
                            {userNotice && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md mt-1 w-fit animate-fade-in">
                                {userNotice}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* عمود الدور */}
                        <td className="py-3 px-3">
                          {roleBadge}
                        </td>

                        {/* عمود القرار الفعلي الحالي */}
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex flex-col items-center">
                            {isMasterKilled ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                <Power className="w-3 h-3 text-rose-600" /> معطل (زر الطوارئ)
                              </span>
                            ) : isAllowedNow ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle className="w-3 h-3 text-emerald-600" /> مسموح بالاستخدام
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                <XCircle className="w-3 h-3 text-rose-600" /> محظور حالياً
                              </span>
                            )}
                            <span className="text-[9px] text-slate-400 mt-0.5">
                              {currentOverride === 'allowed' ? 'استثناء مخصص' : currentOverride === 'blocked' ? 'حظر مخصص' : 'تابع للفئة'}
                            </span>
                          </div>
                        </td>

                        {/* عمود حالة الاستثناء */}
                        <td className="py-3 px-4 text-center">
                          {currentOverride === 'inherit' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              الافتراضي (تتبع الفئة)
                            </span>
                          )}
                          {currentOverride === 'allowed' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <Sparkles className="w-3 h-3 text-emerald-600" /> تفعيل استثنائي فردي
                            </span>
                          )}
                          {currentOverride === 'blocked' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-rose-100 text-rose-900 border border-rose-300">
                              <Ban className="w-3 h-3 text-rose-600" /> حظر تام للحساب
                            </span>
                          )}
                        </td>

                        {/* عمود إجراء التبديل السريع بنقرة واحدة */}
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center justify-center p-1 bg-slate-100 rounded-2xl border border-slate-200 gap-1">
                            {/* 1. زر الافتراضي */}
                            <button
                              type="button"
                              disabled={isThisUpdating}
                              onClick={() => handleUserOverrideChange(u, 'inherit')}
                              title="إعادة ضبط للافتراضي (يتبع بطاقة الفئة العامة)"
                              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 ${
                                currentOverride === 'inherit'
                                  ? 'bg-white text-slate-800 shadow-xs border border-slate-200'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              {currentOverride === 'inherit' && <Check className="w-3 h-3 text-slate-600" />}
                              الافتراضي
                            </button>

                            {/* 2. زر تفعيل استثنائي */}
                            <button
                              type="button"
                              disabled={isThisUpdating}
                              onClick={() => handleUserOverrideChange(u, 'allowed')}
                              title="تفعيل استثنائي فردي (سيعمل حتى لو كانت الفئة معطلة)"
                              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 ${
                                currentOverride === 'allowed'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              <Sparkles className="w-3 h-3" />
                              تفعيل استثنائي
                            </button>

                            {/* 3. زر حظر تام */}
                            <button
                              type="button"
                              disabled={isThisUpdating}
                              onClick={() => handleUserOverrideChange(u, 'blocked')}
                              title="حظر تام للمستخدم (سيُحظر حتى لو كانت الفئة مفعلة)"
                              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 ${
                                currentOverride === 'blocked'
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'text-rose-700 hover:bg-rose-50'
                              }`}
                            >
                              <Ban className="w-3 h-3" />
                              حظر تام
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* إشعار إيضاحي بقواعد الأسبقية المنطقية */}
        <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl text-[11px] text-indigo-950 space-y-1">
          <div className="font-extrabold flex items-center gap-1.5 text-indigo-900">
            <Lock className="w-3.5 h-3.5 text-indigo-600" /> قواعد أسبقية الصلاحيات الفردية (Precedence Rules):
          </div>
          <div className="text-slate-600 leading-relaxed pr-5">
            • <strong>زر الطوارئ الشامل</strong> يعطل الـ AI عن الجميع تلقائياً دون استثناء.<br />
            • <strong>الحظر التام (Blocked)</strong> يمنع المستخدم فورياً حتى لو كانت فئته مفعّلة في الأعلى.<br />
            • <strong>التفعيل الاستثنائي (Allowed)</strong> يمكّن المستخدم من العمل حتى لو كانت فئته العامة معطلة.<br />
            • <strong>الافتراضي (Inherit)</strong> يتبع زر الفئة المحدد في البطاقات الثلاث في الأعلى.
          </div>
        </div>
      </div>

      {/* سجل وتفاصيل الحوكمة */}
      <div className="p-4 bg-slate-100/70 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700">آخر تعديل بواسطة:</span>
          <span className="font-semibold text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">
            {pendingRules.updated_by || 'المشرف العام'}
          </span>
          <span className="text-slate-400">•</span>
          <span>{pendingRules.updated_at ? new Date(pendingRules.updated_at).toLocaleString('ar-EG') : 'الآن'}</span>
        </div>
        <div className="text-[11px] text-slate-500">
          تنعكس أي تعديلات فورياً عبر Supabase Realtime على جميع متصفحات المستخدمين المفتوحة.
        </div>
      </div>
    </div>
  );
};
