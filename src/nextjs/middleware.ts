import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/request';
import { createServerClient } from '@supabase/ssr';

/**
 * Next.js Edge Middleware لمنصة "تعلّم مع موسى"
 * - يتحقق من جلسة المستخدم ومطالبات دور 'super_admin'
 * - لجميع المستخدمين الآخرين: يفحص حالة المدرسة (school.status) وتاريخ انتهاء الاشتراك (subscription_end_date)
 * - يحول المستخدم تلقائياً إلى صفحة /suspended في حال كان الاشتراك معلقاً أو منتهياً
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // المسارات العامة المستثناة من الفحص
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/logo.png') ||
    pathname === '/suspended'
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  // إنشاء عميل Supabase متوافق مع Next.js Cookies
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    // إذا كان المسار محمي كلوحة تحكم السوبر أدمن
    if (pathname.startsWith('/super-admin')) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  // 1. استخراج الملف الشخصي للتحقق من الدور والمدرسة
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, school_id')
    .eq('id', user.id)
    .maybeSingle();

  const userRole = profile?.role || user.app_metadata?.role;
  const schoolId = profile?.school_id || user.app_metadata?.school_id;

  // 2. استثناء المشرف العام (Super Admin) - وصول كامل لكل المسارات
  if (userRole === 'super_admin') {
    return response;
  }

  // منع المستخدمين العاديين من الدخول لمسار السوبر أدمن
  if (pathname.startsWith('/super-admin')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 3. فحص حالة المدرسة للمستخدمين التابعين للمدارس
  if (schoolId) {
    const { data: school, error: schoolErr } = await supabase
      .from('schools')
      .select('status, subscription_end_date, name')
      .eq('id', schoolId)
      .maybeSingle();

    if (!schoolErr && school) {
      const isSuspended = school.status === 'suspended';
      const isExpired = 
        school.status === 'expired' || 
        (school.subscription_end_date && new Date(school.subscription_end_date).getTime() < Date.now());

      if (isSuspended || isExpired) {
        const suspendedUrl = new URL('/suspended', request.url);
        suspendedUrl.searchParams.set('school', school.name || 'مدرستك');
        suspendedUrl.searchParams.set('reason', isSuspended ? 'suspended' : 'expired');
        return NextResponse.redirect(suspendedUrl);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
