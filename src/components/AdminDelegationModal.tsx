import React, { useState, useEffect } from 'react';
import { UserProfile, DelegatedAdminPermissions, DEFAULT_DELEGATED_PERMISSIONS } from '../types';
import { saveUserDelegatedPermissions } from '../storage';
import { sanitizeDelegatedPermissions, countDelegatedPermissions } from '../utils/permissions';
import { ShieldCheck, ShieldAlert, KeyRound, Check, X, Sparkles, GraduationCap, ListTodo, Sliders, UserCheck, AlertCircle } from 'lucide-react';

interface AdminDelegationModalProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  adminUser: UserProfile;
  onSaved?: (updatedUser: UserProfile) => void;
}

export const AdminDelegationModal: React.FC<AdminDelegationModalProps> = ({
  user,
  isOpen,
  onClose,
  adminUser,
  onSaved,
}) => {
  const [permissions, setPermissions] = useState<DelegatedAdminPermissions>({ ...DEFAULT_DELEGATED_PERMISSIONS });
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setPermissions(sanitizeDelegatedPermissions(user.delegated_admin_permissions));
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleToggle = (key: keyof DelegatedAdminPermissions) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const res = await saveUserDelegatedPermissions(user.id, permissions, adminUser);
      if (res.error) {
        setErrorMessage(res.error.message || 'حدث خطأ أثناء حفظ الصلاحيات.');
      } else {
        setSuccessMessage('تم حفظ وبث الصلاحيات المفوضة بنجاح وتحديث واجهة المستخدم لحظياً ⚡');
        onSaved?.(res.user);
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'حدث خطأ غير متوقع.');
    } finally {
      setIsSaving(false);
    }
  };

  const activeCount = countDelegatedPermissions(permissions);

  const permissionItems: {
    key: keyof DelegatedAdminPermissions;
    title: string;
    description: string;
    icon: React.ReactNode;
    colorClass: string;
  }[] = [
    {
      key: 'can_manage_teacher_grades',
      title: 'تعديل صفوف ومسارات المعلمين',
      description: 'يمنح القدرة على تعديل الصفوف والمراحل والمسارات التعليمية المسندة لأي معلم داخل المنصة.',
      icon: <GraduationCap className="w-5 h-5 text-indigo-600" />,
      colorClass: 'border-indigo-100 bg-indigo-50/40',
    },
    {
      key: 'can_manage_teacher_tasks',
      title: 'إدارة وإسناد وحذف مهام المعلمين',
      description: 'يمنح صلاحية إسناد تكليفات رسمية جديدة للمعلمين، وحذف المهام، ومتابعة نسب إنجازهم.',
      icon: <ListTodo className="w-5 h-5 text-teal-600" />,
      colorClass: 'border-teal-100 bg-teal-50/40',
    },
    {
      key: 'can_control_ai_governance',
      title: 'التحكم في حوكمة وقواعد الذكاء الاصطناعي',
      description: 'صلاحية عليا تتيح تفعيل وتعطيل زر الطوارئ الشامل (Killswitch) وسياسات الـ AI لجميع الأدوار.',
      icon: <Sliders className="w-5 h-5 text-purple-600" />,
      colorClass: 'border-purple-100 bg-purple-50/40',
    },
    {
      key: 'can_create_hod',
      title: 'تعيين وترقية رؤساء الأقسام (HOD)',
      description: 'صلاحية عليا تتيح إضافة حسابات جديدة برتبة رئيس قسم أو ترقية المعلمين إلى هذه الرتبة.',
      icon: <UserCheck className="w-5 h-5 text-amber-600" />,
      colorClass: 'border-amber-100 bg-amber-50/40',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        id="admin-delegation-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <KeyRound className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">تفويض صلاحيات الإدارة العليا</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-semibold border border-amber-400/30">
                  Admin Privileges
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                تخصيص صلاحيات إدارية استثنائية لـ: <span className="text-white font-bold">{user.name}</span> ({user.username})
              </p>
            </div>
          </div>
          <button
            id="close-delegation-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Security Principle Banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-relaxed">
              <span className="font-bold text-slate-800">مبدأ الحد الأدنى من الصلاحيات (Least Privilege):</span>
              <p className="mt-0.5">
                جميع هذه الصلاحيات معطلة افتراضياً <span className="font-semibold text-rose-600">(false)</span>. لا يحصل هذا المستخدم على أي امتياز إداري إلا بعد تفعيل المفتاح الخاص به يدوياً من قِبل المشرف العام.
              </p>
            </div>
          </div>

          {/* Active Status Badge */}
          <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/60 rounded-xl border border-indigo-100">
            <span className="text-xs font-bold text-indigo-900">
              حالة التفويض للمستخدم: {user.name}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
              activeCount > 0 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {activeCount > 0 ? `${activeCount} من 4 صلاحيات مفوضة` : 'لا توجد صلاحيات مفوضة (الوضع القياسي)'}
            </span>
          </div>

          {/* Permission Toggles List */}
          <div className="space-y-3">
            {permissionItems.map((item) => {
              const isEnabled = permissions[item.key];
              return (
                <div
                  key={item.key}
                  id={`delegation-toggle-card-${item.key}`}
                  onClick={() => handleToggle(item.key)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-4 ${
                    isEnabled
                      ? 'border-indigo-300 bg-indigo-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isEnabled ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {item.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                        {isEnabled && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-bold border border-emerald-200 flex items-center gap-1">
                            <Check className="w-3 h-3" /> مفوض
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEnabled}
                    id={`toggle-${item.key}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(item.key);
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? '-translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Feedback messages */}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>يتم بث التحديث عبر Supabase Realtime مباشرة</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="cancel-delegation-btn"
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
            >
              إلغاء
            </button>
            <button
              id="save-delegation-btn"
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              {isSaving ? 'جارٍ الحفظ والبث...' : 'حفظ وبث التفويض لحظياً ⚡'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
