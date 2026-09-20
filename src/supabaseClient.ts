import { createClient } from '@supabase/supabase-js';

// إعدادات الربط السحابي مع Supabase لمنصة تعلّم مع موسى
export const SUPABASE_URL_RAW = import.meta.env.VITE_SUPABASE_URL || 'https://zlopmqrmfhkifhpfefew.supabase.co/rest/v1/';
export const SUPABASE_URL = SUPABASE_URL_RAW.replace(/\/rest\/v1\/?$/, '');
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsb3BtcXJtZmhraWZocGZlZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNzMyOTcsImV4cCI6MjEwNDY0OTI5N30.JYdgZPLwUsclBDHfPk5ctZAJ1lwSddOVvGj4GruIlc4';

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
 * دالة حفظ/مزامنة المستخدم في جدول users السحابي في Supabase مع مطابقة الأعمدة والتحقق الصارم من الأخطاء
 */
export async function upsertUserInSupabase(user: {
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
}): Promise<{ data: any; error: any }> {
  // 1. ضمان وجود معرّف سليم (نصي أو UUID)
  const safeId = user.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'usr_' + Date.now());

  // 2. تصفية الحقول لتطابق تماماً أعمدة جدول users في قاعدة بيانات Supabase
  // الأعمدة المعتمدة في الجدول: id, name, username, password, role, stage, grade, track, student_id, allowed_grades, allowed_tracks, login_count, last_login, ai_access_status
  const userData: Record<string, any> = {
    id: safeId,
    name: user.name,
    username: user.username.trim().toLowerCase(),
    role: user.role,
  };

  if (user.password !== undefined) {
    userData.password = user.password;
  }
  if (user.ai_access_status !== undefined) {
    userData.ai_access_status = user.ai_access_status;
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

  try {
    const { data, error } = await supabase
      .from('users')
      .upsert(userData, { onConflict: 'id' })
      .select();

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

