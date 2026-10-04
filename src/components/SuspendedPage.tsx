import React from 'react';
import { AlertOctagon, PhoneCall, Mail, ArrowLeft, ShieldAlert } from 'lucide-react';

interface SuspendedPageProps {
  schoolName?: string;
  reason?: 'suspended' | 'expired' | string;
  onLogout?: () => void;
}

export const SuspendedPage: React.FC<SuspendedPageProps> = ({
  schoolName = 'مدرستك التعليمية',
  reason = 'suspended',
  onLogout,
}) => {
  const isExpired = reason === 'expired';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 text-white flex items-center justify-center p-4" dir="rtl">
      <div className="max-w-lg w-full bg-slate-800/90 border border-slate-700/80 rounded-3xl p-8 shadow-2xl backdrop-blur-md text-center">
        {/* أيقونة التنبيه */}
        <div className={`w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center border shadow-xl ${
          isExpired 
            ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-amber-500/20' 
            : 'bg-rose-500/20 border-rose-500/40 text-rose-400 shadow-rose-500/20 animate-pulse'
        }`}>
          {isExpired ? <ShieldAlert className="w-10 h-10" /> : <AlertOctagon className="w-10 h-10" />}
        </div>

        {/* العنوان */}
        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider inline-block mb-3 ${
          isExpired ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30' : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
        }`}>
          {isExpired ? 'انتهت فترة الاشتراك' : 'حساب المدرسة معلق حالياً'}
        </span>

        <h1 className="text-2xl font-black text-white mb-2">
          {schoolName}
        </h1>

        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          {isExpired ? (
            <>
              عفواً، لقد انتهت صلاحية اشتراك المدرسة في منصة <strong>«تعلّم مع موسى»</strong>. يرجى من إدارة المدرسة تجديد الاشتراك لاستئناف الوصول للدروس والاختبارات والألعاب الذكية.
            </>
          ) : (
            <>
              عفواً، تم تعليق وصول حسابات هذه المدرسة مؤقتاً بقرار إداري. يُرجى مراجعة إدارة المدرسة أو التواصل مع الدعم الفني للمنصة لتسوية الحساب واستئناف الخدمات.
            </>
          )}
        </p>

        {/* بطاقة التواصل والدعم */}
        <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 text-xs text-slate-300 space-y-2 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5 font-bold">
              <Mail className="w-3.5 h-3.5 text-indigo-400" /> البريد الإلكتروني:
            </span>
            <span className="font-mono text-indigo-300 select-all">support@mousa-edtech.com</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5 font-bold">
              <PhoneCall className="w-3.5 h-3.5 text-emerald-400" /> هاتف المبيعات والاشتراكات:
            </span>
            <span className="font-mono text-emerald-300" dir="ltr">+971 4 000 0000</span>
          </div>
        </div>

        {/* أزرار الإجراء */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> تسجيل الخروج وتبديل الحساب
            </button>
          )}
          <a
            href="mailto:support@mousa-edtech.com"
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
          >
            طلب تجديد أو تنشيط الحساب 🚀
          </a>
        </div>
      </div>
    </div>
  );
};
export default SuspendedPage;
