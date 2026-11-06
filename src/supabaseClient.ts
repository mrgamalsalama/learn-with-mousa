import { createClient } from '@supabase/supabase-js';

// إعدادات الربط السحابي مع Supabase لمنصة تعلّم مع موسى
const metaEnv = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};
const procEnv = typeof process !== 'undefined' && process.env ? process.env : {};

export const SUPABASE_URL_RAW = metaEnv.VITE_SUPABASE_URL || procEnv.VITE_SUPABASE_URL || 'https://zlopmqrmfhkifhpfefew.supabase.co/rest/v1/';
export const SUPABASE_URL = SUPABASE_URL_RAW.replace(/\/rest\/v1\/?$/, '');
export const SUPABASE_ANON_KEY = metaEnv.VITE_SUPABASE_ANON_KEY || procEnv.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsb3BtcXJtZmhraWZocGZlZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNzMyOTcsImV4cCI6MjEwNDY0OTI5N30.JYdgZPLwUsclBDHfPk5ctZAJ1lwSddOVvGj4GruIlc4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * توليد اسم مستخدم فريد تماماً بربطه بكود المدرسة لمنع أي تعارض في Supabase
 * النمط المتبع: ${schoolSlug}_${baseName}_${randomDigits} أو ${schoolSlug}_admin_${timestamp}
 */
export function generateUniqueUsername(
  baseUsername?: string | null,
  schoolSlug?: string | null,
  role?: string,
  existingUsernames?: Set<string> | string[]
): string {
  // تنظيف slug المدرسة وجعله صالحاً كاسم مستخدم
  const cleanSlug = (schoolSlug || 'school')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || 'school';

  let raw = (baseUsername || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '');

  // إذا لم يُعطَ اسم أساسي، نستعين بالدور الوظيفي (admin, teacher, student)
  if (!raw) {
    const defaultBase = role === 'school_admin' || role === 'admin' ? 'admin' : (role || 'user');
    raw = defaultBase.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }

  // إذا كان الاسم يبدأ بالفعل بـ slug المدرسة، نزيله لتفادي تكراره (مثل school_school_admin)
  if (raw.startsWith(`${cleanSlug}_`)) {
    raw = raw.slice(cleanSlug.length + 1);
  }

  // استخدام Date.now() مباشرة لضمان عدم التعارض أبداً: ${school.slug}_admin_${Date.now()}
  const timestamp = Date.now();
  let candidate = `${cleanSlug}_${raw}_${timestamp}`;

  // إذا تم توفير قائمة الأسماء الموجودة محلياً أو سحابياً، نضمن عدم التصادم
  if (existingUsernames) {
    const nameSet = existingUsernames instanceof Set ? existingUsernames : new Set(existingUsernames);
    let attempts = 0;
    while (nameSet.has(candidate) && attempts < 20) {
      candidate = `${cleanSlug}_${raw}_${Date.now()}_${attempts + 1}`;
      attempts++;
    }
  }

  return candidate;
}

/**
 * دالة حفظ/مزامنة المستخدم في جدول users السحابي في Supabase مع مطابقة الأعمدة والتحقق الصارم من الأخطاء
 * مع دعم تحديد عمود الدمج onConflict ('id' أو 'username') والحل التلقائي لأخطاء users_username_key
 */
export async function upsertUserInSupabase(
  user: {
    id: string;
    name: string;
    username: string;
    password?: string;
    role: string;
    stage?: string | null;
    grade?: string | null;
    track?: string | null;
    studentId?: string | null;
    allowedGrades?: string[];
    allowedTracks?: string[];
    loginCount?: number;
    lastLogin?: string | null;
    ai_access_status?: 'inherit' | 'allowed' | 'blocked';
    delegated_admin_permissions?: any;
    avatar?: string;
    email?: string;
    timezone?: string;
    preferences?: any;
    school_id?: string;
  },
  options?: {
    onConflict?: 'id' | 'username';
  }
): Promise<{ data: any; error: any }> {
  // 1. ضمان وجود معرّف سليم (UUID قياسي عند الإنشاء الجديد)
  const safeId = user.id && user.id.trim() ? user.id.trim() : generateValidUUID();

  // 2. ضمان عدم فراغ اسم المستخدم وتوليد اسم فريد مرتبط بالمدرسة إذا كان فارغاً
  let cleanUsername = (user.username || '').trim().toLowerCase();
  if (!cleanUsername) {
    cleanUsername = generateUniqueUsername('', user.school_id, user.role);
  }

  // 3. تصفية الحقول لتطابق تماماً أعمدة جدول users في قاعدة بيانات Supabase
  const userData: Record<string, any> = {
    id: safeId,
    name: user.name || cleanUsername,
    username: cleanUsername,
    role: user.role || 'student',
    school_id: user.school_id || '00000000-0000-0000-0000-000000000001',
  };

  if (user.password !== undefined) {
    userData.password = user.password;
  }
  if (user.email !== undefined) {
    userData.email = user.email;
  }
  if (user.avatar !== undefined) {
    userData.avatar = user.avatar;
  }
  if (user.timezone !== undefined) {
    userData.timezone = user.timezone;
  }
  if (user.preferences !== undefined) {
    userData.preferences = user.preferences;
  }
  if (user.ai_access_status !== undefined) {
    userData.ai_access_status = user.ai_access_status;
  }
  if (user.delegated_admin_permissions !== undefined) {
    userData.delegated_admin_permissions = user.delegated_admin_permissions;
  }
  if (user.stage !== undefined) {
    userData.stage = user.stage || null;
  }
  if (user.grade !== undefined) {
    userData.grade = user.grade || null;
  }
  if (user.track !== undefined) {
    userData.track = user.track || null;
  }
  if (user.studentId !== undefined) {
    userData.student_id = user.studentId || null;
  }
  if (Array.isArray(user.allowedGrades)) {
    userData.allowed_grades = user.allowedGrades;
  }
  if (Array.isArray(user.allowedTracks)) {
    userData.allowed_tracks = user.allowedTracks;
  }
  if (user.loginCount !== undefined) {
    userData.login_count = user.loginCount;
  }
  if (user.lastLogin !== undefined) {
    userData.last_login = user.lastLogin || null;
  }

  // 4. تحديد عمود الدمج الصريح (الافتراضي هو 'username' لمنع التعارض تماماً)
  const conflictTarget = options?.onConflict || 'username';

  try {
    // التحقق المسبق عند استخدام username كعمود دمج لتفادي تصادم الـ primary key (id)
    if (conflictTarget === 'username') {
      try {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, username')
          .eq('username', userData.username)
          .maybeSingle();

        if (existingUser && existingUser.id) {
          userData.id = existingUser.id;
        }
      } catch (checkErr) {
        console.warn('[Supabase users] تخطي فحص المستخدم المسبق:', checkErr);
      }
    }

    let { data, error } = await supabase
      .from('users')
      .upsert(userData, { onConflict: conflictTarget })
      .select();

    // في حال عدم وجود بعض الأعمدة الإضافية في جدول users سحابياً (كود 42703)، نعيد المحاولة تدريجياً
    if (error && error.code === '42703') {
      const copy = { ...userData };
      // فحص الأعمدة غير الأساسية وإزالتها في حال غيابها في قاعدة البيانات القديمة
      const optionalCols = ['avatar', 'timezone', 'preferences', 'email', 'delegated_admin_permissions'];
      for (const col of optionalCols) {
        delete copy[col];
      }
      const retry = await supabase
        .from('users')
        .upsert(copy, { onConflict: conflictTarget })
        .select();
      data = retry.data;
      error = retry.error;
    }

    // معالجة تعارض القيد الفريد لاسم المستخدم (users_username_key / code 23505)
    if (error && (error.code === '23505' || error.message?.includes('users_username_key'))) {
      console.warn('[Supabase users upsert] تم رصد تعارض في users_username_key، جارٍ الحل الذكي والتوليد بـ Date.now()...');

      // 1. محاولة التحديث المباشر بناء على اسم المستخدم
      const updateRes = await supabase
        .from('users')
        .update(userData)
        .eq('username', userData.username)
        .select();
      if (!updateRes.error) {
        console.log('[Supabase users] تم تحديث المستخدم بنجاح وفق username:', userData.username);
        return { data: updateRes.data, error: null };
      }

      // 2. توليد اسم مستخدم فريد حتماً بربطه بالوقت الحالي Date.now()
      const basePrefix = userData.username.split('_')[0] || 'admin';
      const freshUnique = `${basePrefix}_${Date.now()}`;
      userData.username = freshUnique;

      const retryUnique = await supabase
        .from('users')
        .upsert(userData, { onConflict: 'username' })
        .select();

      if (!retryUnique.error) {
        console.log('[Supabase users] تم حل تعارض اسم المستخدم بنجاح وحفظ الحساب بالاسم الفريد:', userData.username);
        return { data: retryUnique.data, error: null };
      }

      error = retryUnique.error;
    }

    if (error) {
      console.error('Supabase users upsert error:', error.message, error.details, error.hint);
      return { data: null, error };
    }

    console.log('تم حفظ المستخدم في Supabase بنجاح:', userData.username);
    return { data, error: null };
  } catch (err: any) {
    console.error('Supabase users upsert exception:', err);
    return { data: null, error: err };
  }
}

/**
 * دالة توليد UUID v4 قياسي صالح لقواعد بيانات PostgreSQL
 */
export function generateValidUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * دالة إدراج أو مزامنة مدرسة جديدة فعلياً في جدول public.schools في Supabase مع التحقق الكامل
 */
export async function insertSchoolInSupabase(school: {
  id?: string;
  name: string;
  slug: string;
  status?: string;
  plan_tier?: string;
  subscription_start_date?: string;
  subscription_end_date?: string;
  ai_enabled?: boolean;
  max_students?: number;
}): Promise<{ data: any; error: any }> {
  // التحقق من صحة الـ UUID
  const isValidUUID = school.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(school.id);
  const safeId = isValidUUID ? school.id! : generateValidUUID();

  const schoolData: Record<string, any> = {
    id: safeId,
    name: school.name.trim(),
    slug: (school.slug || school.name).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
    status: school.status || 'active',
    plan_tier: school.plan_tier || 'annual',
    subscription_start_date: school.subscription_start_date || new Date().toISOString(),
    subscription_end_date: school.subscription_end_date || new Date(Date.now() + 365 * 86400000).toISOString(),
    ai_enabled: school.ai_enabled !== false,
    max_students: Number(school.max_students) || 500,
  };

  try {
    // نستخدم upsert على id لضمان عدم حدوث تعارض إذا أعيد الإدراج
    const { data, error } = await supabase
      .from('schools')
      .upsert(schoolData, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (error) {
      console.error('[Supabase schools upsert error]:', error.message, error.details, error.code, error.hint);
      return { data: null, error };
    }

    console.log('[Supabase schools upsert success]:', data);
    return { data, error: null };
  } catch (err: any) {
    console.error('[Supabase schools insert exception]:', err);
    return { data: null, error: err };
  }
}

/**
 * دالة تحديث بيانات مدرسة موجودة في جدول public.schools في Supabase
 */
export async function updateSchoolInSupabase(
  schoolId: string,
  updates: Record<string, any>
): Promise<{ data: any; error: any }> {
  try {
    const { data, error } = await supabase
      .from('schools')
      .update(updates)
      .eq('id', schoolId)
      .select()
      .single();

    if (error) {
      console.error('[Supabase schools update error]:', error.message, error.details, error.code);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error('[Supabase schools update exception]:', err);
    return { data: null, error: err };
  }
}

