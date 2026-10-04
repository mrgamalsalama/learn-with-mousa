'use client';

import React from 'react';
import { ShieldAlert, AlertTriangle, Clock, PhoneCall, ArrowRight, RefreshCw } from 'lucide-react';

export default function SuspendedPage({
  searchParams,
}: {
  searchParams?: { school?: string; reason?: string };
}) {
  const schoolName = searchParams?.school || 'المدرسة التعليمية';
  const reason = searchParams?.reason || 'suspended';
  const isExpired = reason === 'expired';

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans" dir="rtl">
      <div className="max-w-lg w-full bg-slate-800/90 backdrop-blur-xl border border-rose-500/30 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-6 shadow-inner">
          {isExpired ? (
            <Clock className="w-10 h-10 text-amber-400 animate-pulse" />
          ) : (
            <ShieldAlert className="w-10 h-10 text-rose-400" />
          )}
        </div>

        <span className="inline-block px-3.5 py-1 rounded-full text-xs font-black tracking-wide uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 mb-3">
          {isExpired ? 'انتهت فترة الاشتراك السنوي' : 'حساب المدرسة معلق إدارياً'}
        </span>

        <h1 className="text-2xl font-extrabold text-white mb-2">
          {schoolName}
        </h1>

        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          {isExpired
            ? 'انتهت صلاحية اشتراك مدرستكم في منصة "تعلّم مع موسى". للحفاظ على بيانات الطلاب والتقارير الأكاديمية وإعادة تفعيل الأنشطة الذكية، يرجى من إدارة المدرسة تجديد الاشتراك.'
            : 'تم تعليق وصول مدرستكم إلى منصة "تعلّم مع موسى" مؤقتاً بقرار إداري مركزي. يرجى التواصل مع الدعم الفني أو المشرف العام للمنظومة.'}
        </p>

        <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4 text-xs text-slate-400 text-right space-y-2 mb-6">
          <div className="flex items-center gap-2 font-bold text-slate-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>ماذا يعني هذا الإجراء؟</span>
          </div>
          <p className="leading-normal">
            • تم إيقاف كافة الأنشطة التفاعلية، ألعاب الذكاء الاصطناعي، وتسليمات الاختبارات مؤقتاً لحين تسوية وضع الاشتراك.
          </p>
          <p className="leading-normal">
            • سجلات درجات الطلاب وأوسمتهم محفوظة بأمان تام في السحابة المشفرة.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs transition flex items-center justify-center gap-2 border border-slate-600"
          >
            <RefreshCw className="w-4 h-4" />
            <span>إعادة التحقق من الحالة</span>
          </button>
          <a
            href="mailto:support@mousa-edtech.com?subject=تجديد%20اشتراك%20مدرسة"
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:opacity-95 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20"
          >
            <PhoneCall className="w-4 h-4" />
            <span>تواصل لتجديد الاشتراك</span>
          </a>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-500">
          منصة "تعلّم مع موسى" للتعليم الذكي © {new Date().getFullYear()}
        </div>
      </div>
    </main>
  );
}
