import React from 'react';
import { ShieldAlert, Clock, AlertTriangle, PhoneCall, LogOut, ArrowRight, RefreshCw, Sparkles, Building2 } from 'lucide-react';
import { School, UserProfile } from '../types';

interface SuspendedSchoolNoticeProps {
  user: UserProfile;
  school?: School;
  reason?: 'suspended' | 'expired' | 'not_found' | 'ok';
  message?: string;
  onLogout: () => void;
  onSwitchToDemoSchool?: () => void;
}

export const SuspendedSchoolNotice: React.FC<SuspendedSchoolNoticeProps> = ({
  user,
  school,
  reason = 'suspended',
  message,
  onLogout,
  onSwitchToDemoSchool
}) => {
  const isExpired = reason === 'expired';
  const schoolName = school?.name || 'مدرستكم التعليمية';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans relative overflow-hidden" dir="rtl">
      {/* Glow Effects */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-xl w-full bg-slate-900/90 backdrop-blur-2xl border border-rose-500/30 rounded-3xl p-8 shadow-2xl relative z-10 text-center">
        {/* Top Icon Badge */}
        <div className="w-20 h-20 rounded-3xl bg-rose-500/15 border-2 border-rose-500/30 flex items-center justify-center mx-auto mb-6 shadow-inner">
          {isExpired ? (
            <Clock className="w-10 h-10 text-amber-400 animate-pulse" />
          ) : (
            <ShieldAlert className="w-10 h-10 text-rose-400" />
          )}
        </div>

        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black tracking-wide uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 mb-3">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{isExpired ? 'انتهاء فترة الاشتراك السنوي' : 'تعليق حساب المدرسة إدارياً'}</span>
        </div>

        <h1 className="text-2xl font-black text-white mb-2">
          {schoolName}
        </h1>

        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          {message || (isExpired
            ? `انتهت صلاحية اشتراك مدرسة "${schoolName}" في منصة "تعلّم مع موسى". للحفاظ على أمان بيانات الطلاب والتقارير الأكاديمية والوصول إلى كافة الأنشطة التفاعلية، يرجى من إدارة المدرسة تجديد الاشتراك السنوي.`
            : `تم تعليق وصول منسوبي مدرسة "${schoolName}" إلى المنظومة بقرار إداري مركزي من المشرف العام. يرجى التواصل مع إدارة المنصة لتسوية حالة الحساب.`)}
        </p>

        {/* User Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 text-right space-y-2 mb-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-slate-300">بيانات المستخدم المسجل:</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-bold">{user.name} ({user.role})</span>
          </div>
          <p className="leading-relaxed text-[11px] text-slate-400">
            • تم حجب الوصول التلقائي إلى بنك الأنشطة، الألعاب الذكية، وجلسات الاختبار تطبيقاً لسياسات الأمان والحوكمة المركزية (Multi-Tenant Access Enforcement).
          </p>
          <p className="leading-relaxed text-[11px] text-slate-400">
            • لا يتم حذف أي بيانات أو سجلات درجات أثناء فترة التعليق.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            <span>إعادة التحقق من الحالة</span>
          </button>

          <button
            onClick={onLogout}
            className="flex-1 py-3 px-4 rounded-xl bg-rose-600/30 hover:bg-rose-600/40 text-rose-200 border border-rose-500/30 font-bold text-xs transition flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>

        {/* Demo Day Quick Switcher Helper */}
        {onSwitchToDemoSchool && (
          <div className="pt-4 border-t border-slate-800/80">
            <span className="block text-[11px] font-bold text-slate-400 mb-2">
              لوحة العرض التوضيحي (Demo Day Quick Switch):
            </span>
            <button
              onClick={onSwitchToDemoSchool}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 hover:from-emerald-600/30 hover:to-teal-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>التبديل إلى مدرسة موسى النموذجية (النشطة) للاختبار المباشر</span>
            </button>
          </div>
        )}

        <div className="mt-4 text-[11px] text-slate-500">
          منظومة "تعلّم مع موسى" © {new Date().getFullYear()} — نظام الحوكمة وعزل المدارس المتعددة
        </div>
      </div>
    </div>
  );
};
