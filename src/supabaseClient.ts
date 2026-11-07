import { createClient } from '@supabase/supabase-js';
import { SchoolClass, UserProfile } from './types';

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
 * تحويل الحروف العربية والأسماء الشائعة إلى حروف لاتينية مقروءة وموجزة
 * مثال: "موسى" -> "musa"، "فرقان" -> "furqan"، "جمال" -> "gamal"
 */
export function transliterateArabicToLatin(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();

  // قاموس لأشهر الأسماء العربية الشائعة لإنتاج مخرجات فائقة الدقة والمطابقة
  const commonWords: Record<string, string> = {
    'موسى': 'musa',
    'محمد': 'mohamed',
    'احمد': 'ahmed',
    'أحمد': 'ahmed',
    'علي': 'ali',
    'عمر': 'omar',
    'يوسف': 'youssef',
    'خالد': 'khaled',
    'سارة': 'sara',
    'فاطمة': 'fatima',
    'مريم': 'maryam',
    'نور': 'nour',
    'حسن': 'hassan',
    'حسين': 'hussein',
    'طارق': 'tariq',
    'عبدالله': 'abdullah',
    'زياد': 'ziad',
    'ياسين': 'yassin',
    'ابراهيم': 'ibrahim',
    'إبراهيم': 'ibrahim',
    'فرقان': 'furqan',
    'الفرقان': 'furqan',
    'دار الفرقان': 'furqan',
    'جمال': 'gamal',
    'كريم': 'karim',
    'ماجد': 'majed',
    'سالم': 'salem',
    'سلطان': 'sultan',
    'فيصل': 'faisal',
    'سعود': 'saud',
    'بدر': 'bader',
    'راشد': 'rashed',
    'حمد': 'hamad',
    'زايد': 'zayed',
    'منصور': 'mansoor',
    'سعيد': 'saeed',
    'ناصر': 'nasser',
    'وليد': 'waleed',
    'يحيى': 'yahya',
    'حمزة': 'hamza'
  };

  const lower = trimmed.toLowerCase();
  if (commonWords[lower]) {
    return commonWords[lower];
  }

  // خريطة الحروف الفونيمية الدقيقة
  const charMap: Record<string, string> = {
    'أ': 'a', 'إ': 'e', 'آ': 'a', 'ا': 'a', 'ء': 'a',
    'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'g',
    'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh',
    'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
    'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
    'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
    'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'و': 'u', 'ؤ': 'o', 'ي': 'y',
    'ى': 'a', 'ئ': 'e', 'ة': 'a',
    'پ': 'p', 'چ': 'ch', 'ڤ': 'v', 'گ': 'g'
  };

  return trimmed
    .split('')
    .map(ch => charMap[ch] !== undefined ? charMap[ch] : ch)
    .join('');
}

/**
 * توليد اسم مستخدم قياسي وقصير وسهل القراءة للطلاب والمعلمين:
 * النمط القياسي: {slug}_{firstname}_{random3Digits}
 * أمثلة: furqan_musa_241 أو musa_g_102
 *
 * الميزات:
 * 1. دعم التخصيص اليدوي: إذا قام المستخدم بإدخال اسم مخصص، يتم اعتماده مباشرة ما لم يتعارض في قاعدة البيانات.
 * 2. الحفاظ على شرط التحقق الصارم من عدم التكرار (Unique Check).
 * 3. استبدال الطوابع الميلي ثانية الطويلة بـ 3 أرقام عشوائية أنيقة (100 - 999).
 */
export function generateUniqueUsername(
  baseUsername?: string | null,
  schoolSlug?: string | null,
  role?: string,
  existingUsernames?: Set<string> | string[],
  options?: {
    isManual?: boolean;
    randomDigits?: number;
  }
): string {
  // 1. استخراج وتنظيف slug المدرسة (أول 8-10 أحرف لضمان القصر والأناقة)
  const cleanSlug = transliterateArabicToLatin(schoolSlug || 'school')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10) || 'sch';

  const nameSet = existingUsernames
    ? (existingUsernames instanceof Set ? existingUsernames : new Set(existingUsernames))
    : new Set<string>();

  // 2. إذا كان إدخالاً يدوياً مخصصاً (Manual / Custom Username):
  if (options?.isManual && baseUsername && baseUsername.trim()) {
    const sanitizedManual = transliterateArabicToLatin(baseUsername.trim())
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24);

    if (sanitizedManual) {
      // إذا كان الاسم المخصص فريداً ولا يوجد تعارض، نحتفظ به كما أدخله المستخدم تماماً دون فرض أي تغيير
      if (!nameSet.has(sanitizedManual)) {
        return sanitizedManual;
      }

      // إذا وُجد تعارض فعلي في قاعدة البيانات، نضيف لاحقة أرقام عشوائية ثلاثية لحل التعارض مع صون الاسم المختار
      let attempt = 0;
      while (attempt < 50) {
        const rand3 = Math.floor(100 + Math.random() * 900);
        const resolved = `${sanitizedManual}_${rand3}`;
        if (!nameSet.has(resolved)) {
          return resolved;
        }
        attempt++;
      }
    }
  }

  // 3. الاستخراج التلقائي للاسم الأول (First Name)
  let rawInput = (baseUsername || '').trim();
  // إذا كان اسماً كاملاً بمسافات، نأخذ الاسم الأول
  if (rawInput.includes(' ')) {
    rawInput = rawInput.split(/\s+/)[0];
  }

  let firstName = transliterateArabicToLatin(rawInput)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '')
    .slice(0, 10);

  // إذا لم يتوفر اسم، نستعين بدور المستخدم كاختصار قصير وسهل
  if (!firstName) {
    if (role === 'school_admin' || role === 'admin') firstName = 'admin';
    else if (role === 'teacher' || role === 'hod') firstName = 'tch';
    else firstName = 'stu';
  }

  // تفادي تكرار بادئة المدرسة إذا كان الاسم الأول يبدأ بها (مثل furqan_furqan)
  if (firstName.startsWith(cleanSlug) && firstName.length > cleanSlug.length) {
    firstName = firstName.slice(cleanSlug.length).replace(/^_+/, '');
  }

  // 4. توليد الصيغة القياسية: {slug}_{firstname}_{random3Digits}
  let candidate = '';
  let attempts = 0;
  do {
    const rand3 = Math.floor(100 + Math.random() * 900); // 100 - 999
    if (cleanSlug === firstName) {
      candidate = `${cleanSlug}_${rand3}`;
    } else {
      candidate = `${cleanSlug}_${firstName}_${rand3}`;
    }
    attempts++;
  } while (nameSet.has(candidate) && attempts < 100);

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
    class_id?: string | null;
    className?: string | null;
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
  if (user.class_id !== undefined) {
    userData.class_id = user.class_id || null;
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
      const optionalCols = ['avatar', 'timezone', 'preferences', 'email', 'delegated_admin_permissions', 'class_id'];
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
      console.warn('[Supabase users upsert] تم رصد تعارض في users_username_key، جارٍ الحل الذكي والتوليد برقم عشوائي...');

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

      // 2. توليد اسم مستخدم فريد وموجز: {slug}_{name}_{random3Digits}
      const parts = userData.username.split('_');
      const basePrefix = parts[0] || 'sch';
      const namePart = parts.length > 1 ? parts[1] : 'user';
      const rand3 = Math.floor(100 + Math.random() * 900);
      const freshUnique = `${basePrefix}_${namePart}_${rand3}`;
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

    // في حال نجاح حفظ مستخدم بدور طالب، نزامن سجله تلقائياً في جدول students
    if (user.role === 'student') {
      syncStudentToSupabase(user as any).catch(syncErr => console.warn('[Supabase students sync]:', syncErr));
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

/**
 * دالة مزامنة الطالب في جدول public.students في Supabase
 */
export async function syncStudentToSupabase(student: any): Promise<{ data: any; error: any }> {
  try {
    const parts = (student.name || '').trim().split(/\s+/);
    const firstName = parts[0] || 'طالب';
    const lastName = parts.slice(1).join(' ') || 'المدرسة';
    const stageEnum = student.stage === 'kg' ? 'kindergarten' : (student.stage || 'primary');

    const studentPayload: Record<string, any> = {
      student_id: student.id,
      school_id: student.school_id || '00000000-0000-0000-0000-000000000001',
      first_name: firstName,
      last_name: lastName,
      full_name_ar: student.name,
      gender: 'male',
      birth_date: '2018-01-01',
      grade_level: student.grade || 'grade-1',
      section_code: student.className || 'General',
      class_id: student.class_id || null,
      track: student.track || 'arabic-a',
      guardian_name: 'ولي أمر ' + student.name,
      guardian_phone: '0500000000',
      status: 'active',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('students')
      .upsert(studentPayload, { onConflict: 'student_id' })
      .select();

    if (error) {
      console.warn('[Supabase students upsert error]:', error.message);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err: any) {
    console.warn('[Supabase students exception]:', err);
    return { data: null, error: err };
  }
}

/**
 * دالة حفظ ومزامنة الفصل الدراسي في جدول public.classes_grades و public.classes
 */
export async function syncClassToSupabase(cls: SchoolClass): Promise<{ data: any; error: any }> {
  let primaryError: any = null;
  let savedData: any = null;

  // 1. الحفظ في جدول classes_grades
  try {
    const stageEnum = cls.stage === 'kg' ? 'kindergarten' : cls.stage;
    const cleanSectionCode = cls.name.replace(/[^a-zA-Z0-9_\u0621-\u064A-]/g, '').slice(0, 30) || `SEC-${cls.id.slice(-6)}`;

    const classesGradesPayload = {
      class_id: cls.id,
      school_id: cls.school_id || '00000000-0000-0000-0000-000000000001',
      section_code: cleanSectionCode,
      class_name_ar: cls.name,
      stage: stageEnum,
      grade_level: cls.grade,
      track: cls.track || 'arabic-a',
      academic_year: '2026-2027',
      is_active: true,
      updated_at: new Date().toISOString()
    };

    const res1 = await supabase
      .from('classes_grades')
      .upsert(classesGradesPayload, { onConflict: 'class_id' })
      .select();

    if (!res1.error) {
      savedData = res1.data;
      console.log('[Supabase classes_grades] تم الحفظ بنجاح:', cls.name);
    } else {
      primaryError = res1.error;
      console.warn('[Supabase classes_grades upsert warning]:', res1.error.message);
    }
  } catch (err) {
    primaryError = err;
  }

  // 2. الحفظ الاحتياطي في جدول classes إن وُجد
  try {
    const classesPayload = {
      id: cls.id,
      school_id: cls.school_id || '00000000-0000-0000-0000-000000000001',
      name: cls.name,
      stage: cls.stage,
      grade: cls.grade,
      track: cls.track || 'arabic-a',
      created_at: cls.created_at || new Date().toISOString()
    };

    const res2 = await supabase
      .from('classes')
      .upsert(classesPayload, { onConflict: 'id' })
      .select();

    if (!res2.error && !savedData) {
      savedData = res2.data;
    }
  } catch (err) {
    // optional fallback
  }

  return { data: savedData, error: primaryError };
}

/**
 * دالة حذف الفصل الدراسي من Supabase
 */
export async function deleteClassFromSupabase(classId: string): Promise<void> {
  try {
    await supabase.from('classes_grades').delete().eq('class_id', classId);
  } catch (e) {}
  try {
    await supabase.from('classes').delete().eq('id', classId);
  } catch (e) {}
}

/**
 * دالة جلب الفصول المحدثة من Supabase
 */
export async function fetchClassesFromSupabase(schoolId?: string): Promise<SchoolClass[]> {
  const loadedClasses: SchoolClass[] = [];

  try {
    // 1. محاولة القراءة من classes_grades
    let query = supabase.from('classes_grades').select('*');
    if (schoolId) {
      query = query.eq('school_id', schoolId);
    }
    const { data: cgData, error: cgError } = await query;

    if (!cgError && Array.isArray(cgData) && cgData.length > 0) {
      cgData.forEach(row => {
        const rawStage = String(row.stage || 'primary');
        const stage = (rawStage === 'kindergarten' ? 'kg' : rawStage) as any;
        loadedClasses.push({
          id: row.class_id,
          school_id: row.school_id,
          name: row.class_name_ar || row.section_code,
          stage,
          grade: row.grade_level,
          track: row.track,
          created_at: row.created_at
        });
      });
      return loadedClasses;
    }
  } catch (e) {
    console.warn('[Supabase fetch classes_grades]:', e);
  }

  try {
    // 2. محاولة القراءة من classes
    let query2 = supabase.from('classes').select('*');
    if (schoolId) {
      query2 = query2.eq('school_id', schoolId);
    }
    const { data: cData, error: cError } = await query2;

    if (!cError && Array.isArray(cData) && cData.length > 0) {
      cData.forEach(row => {
        const rawStage = String(row.stage || 'primary');
        const stage = (rawStage === 'kindergarten' ? 'kg' : rawStage) as any;
        loadedClasses.push({
          id: row.id,
          school_id: row.school_id,
          name: row.name,
          stage,
          grade: row.grade,
          track: row.track,
          created_at: row.created_at
        });
      });
      return loadedClasses;
    }
  } catch (e) {
    console.warn('[Supabase fetch classes]:', e);
  }

  return loadedClasses;
}

