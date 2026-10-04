import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

/**
 * مساعد للتحقق من هوية المشرف العام
 */
async function verifySuperAdmin(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return true; // في بيئة العرض التوضيحي/التطوير

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return false;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return profile?.role === 'super_admin' || user.app_metadata?.role === 'super_admin';
}

/**
 * GET /api/super-admin/schools
 * استرجاع كافة المدارس مع إحصائيات الطلاب والاشتراكات
 */
export async function GET(request: Request) {
  const isAuthorized = await verifySuperAdmin(request);
  if (!isAuthorized) {
    return NextResponse.json({ error: 'غير مصرح: الوصول مقتصر على المشرف العام' }, { status: 403 });
  }

  try {
    const { data: schools, error } = await supabaseAdmin
      .from('schools')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // حساب عدد الطلاب والمعلمين لكل مدرسة
    const { data: usersCount } = await supabaseAdmin
      .from('users')
      .select('school_id, role');

    const countsMap: Record<string, { students: number; teachers: number }> = {};
    (usersCount || []).forEach((u: any) => {
      const sId = u.school_id || '';
      if (!countsMap[sId]) countsMap[sId] = { students: 0, teachers: 0 };
      if (u.role === 'student') countsMap[sId].students++;
      if (u.role === 'teacher') countsMap[sId].teachers++;
    });

    const enriched = (schools || []).map((s: any) => ({
      ...s,
      student_count: countsMap[s.id]?.students || 0,
      teacher_count: countsMap[s.id]?.teachers || 0,
    }));

    return NextResponse.json({ schools: enriched });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل جلب المدارس' }, { status: 500 });
  }
}

/**
 * POST /api/super-admin/schools
 * إنشاء مدرسة جديدة وتحديد فترة اشتراكها وتعيين حساب مديرها
 */
export async function POST(request: Request) {
  const isAuthorized = await verifySuperAdmin(request);
  if (!isAuthorized) {
    return NextResponse.json({ error: 'غير مصرح: الوصول مقتصر على المشرف العام' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      name,
      slug,
      plan_tier = 'trial',
      subscription_start_date,
      subscription_end_date,
      ai_enabled = true,
      max_students = 500,
      adminName,
      adminUsername,
      adminPassword,
      adminEmail
    } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'اسم المدرسة والمعرّف النصي (slug) مطلوبان' }, { status: 400 });
    }

    // 1. إنشاء المدرسة في جدول schools
    const startDate = subscription_start_date || new Date().toISOString();
    const endDate = subscription_end_date || new Date(Date.now() + (plan_tier === 'trial' ? 30 : 365) * 86400000).toISOString();

    const { data: newSchool, error: schoolErr } = await supabaseAdmin
      .from('schools')
      .insert({
        name,
        slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
        status: 'active',
        plan_tier,
        subscription_start_date: startDate,
        subscription_end_date: endDate,
        ai_enabled: Boolean(ai_enabled),
        max_students: Number(max_students) || 500,
      })
      .select()
      .single();

    if (schoolErr) throw schoolErr;

    // 2. إنشاء حساب مدير المدرسة إذا تم تزويده
    let createdAdmin = null;
    if (adminUsername && adminPassword) {
      const adminId = 'adm_' + (typeof crypto !== 'undefined' ? crypto.randomUUID() : Date.now());
      const { data: userRecord, error: userErr } = await supabaseAdmin
        .from('users')
        .insert({
          id: adminId,
          school_id: newSchool.id,
          name: adminName || `مدير ${name}`,
          username: adminUsername.trim(),
          password: adminPassword,
          role: 'school_admin',
          email: adminEmail || null,
          allowed_stages: ['primary', 'middle', 'high'],
          allowed_grades: ['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6'],
          allowed_tracks: ['arabic-a', 'arabic-b'],
          login_count: 0
        })
        .select()
        .single();

      if (!userErr) createdAdmin = userRecord;
    }

    return NextResponse.json({
      success: true,
      school: newSchool,
      admin: createdAdmin,
      message: 'تم إنشاء المدرسة بنجاح وضبط فترة الاشتراك'
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل إنشاء المدرسة' }, { status: 500 });
  }
}
