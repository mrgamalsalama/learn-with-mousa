import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// تهيئة عميل Supabase للـ Middleware
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://zlopmqrmfhkifhpfefew.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Next.js Edge Middleware لمطابقة صلاحيات اشتراك المدارس المتعددة (Multi-tenant SaaS)
 * 1. يستثني دور super_admin من أي فحص أو حظر.
 * 2. يفحص حالة مدرسة المستخدم (status) وتاريخ انتهاء الاشتراك (subscription_end_date).
 * 3. يحول فوراً إلى صفحة /suspended في حال التعليق أو انتهاء الصلاحية.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // استثناء المسارات العامة ومسار التعليق والملفات الثابتة
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/suspended') ||
    pathname.startsWith('/login') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // استخراج الـ Token أو هوية المستخدم من الـ Cookies أو الـ Headers
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || request.cookies.get('sb-access-token')?.value;

  if (!token) {
    // إذا كان المسار محمي كـ /super-admin يحول للدخول
    if (pathname.startsWith('/super-admin')) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.next();
    }

    // استخراج بيانات الملف الشخصي والمدرسة
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, school_id')
      .eq('id', user.id)
      .maybeSingle();

    // 1. استثناء الـ super_admin: يملك وصولاً كاملاً وغير مقيد لكافة المسارات
    if (profile?.role === 'super_admin') {
      return NextResponse.next();
    }

    // منع غير الـ super_admin من دخول مسارات لوحة المشرف العام
    if (pathname.startsWith('/super-admin')) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // 2. فحص المدرسة والاشتراك لبقية المستخدمين (teachers, students, parents, school_admins)
    if (profile?.school_id) {
      const { data: school } = await supabase
        .from('schools')
        .select('status, subscription_end_date, name')
        .eq('id', profile.school_id)
        .maybeSingle();

      if (school) {
        const isSuspended = school.status === 'suspended';
        const isExpired = 
          school.status === 'expired' || 
          (school.subscription_end_date && new Date(school.subscription_end_date) < new Date());

        if (isSuspended || isExpired) {
          const reason = isSuspended ? 'suspended' : 'expired';
          const suspendedUrl = new URL('/suspended', request.url);
          suspendedUrl.searchParams.set('reason', reason);
          suspendedUrl.searchParams.set('school', school.name || '');
          return NextResponse.redirect(suspendedUrl);
        }
      }
    }
  } catch (err) {
    console.warn('Middleware school verification warning:', err);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
