-- ==============================================================================
-- إعداد جداول وقواعد أمان ونظام الاشتراكات للمدارس المتعددة (Multi-Tenant SaaS)
-- لمنصة "تعلّم مع موسى" (Musa EdTech) في Supabase PostgreSQL
-- ==============================================================================

-- 1. جدول المدارس مع حقول الاشتراكات والـ AI Kill Switch
CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
  plan_tier TEXT NOT NULL DEFAULT 'trial' CHECK (plan_tier IN ('trial', 'annual')),
  subscription_start_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  subscription_end_date TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + INTERVAL '1 year'),
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  max_students INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- فهرس سريع لـ slug و status
CREATE INDEX IF NOT EXISTS idx_schools_slug ON public.schools(slug);
CREATE INDEX IF NOT EXISTS idx_schools_status ON public.schools(status);

-- إدراج المدرسة التأسيسية الافتراضية
INSERT INTO public.schools (id, name, slug, status, plan_tier, subscription_start_date, subscription_end_date, ai_enabled, max_students)
VALUES (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'مدرسة موسى النموذجية الرائدة',
  'mousa-demo-school',
  'active',
  'annual',
  timezone('utc'::text, now()),
  timezone('utc'::text, now()) + INTERVAL '2 years',
  true,
  1000
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  ai_enabled = EXCLUDED.ai_enabled;

-- 2. التحقق من جدول profiles (المستخدمين) وتحديث الأدوار
DO $$
BEGIN
  -- إنشاء نوع Enum للأدوار إذا لم يكن موجوداً
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
    CREATE TYPE public.user_role_enum AS ENUM (
      'super_admin',
      'school_admin',
      'supervisor',
      'teacher',
      'parent',
      'student'
    );
  END IF;
END $$;

-- إنشاء جدول profiles إن لم يكن موجوداً أو ربطه بـ users
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('super_admin', 'school_admin', 'supervisor', 'hod', 'teacher', 'parent', 'student')),
  stage TEXT,
  grade TEXT,
  track TEXT,
  student_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ضمان وجود الأعمدة في profiles و users
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- مزامنة جدول users مع profiles للتوافق
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS school_id TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ==============================================================================
-- 3. دوال التحقق وسياسات الأمان على مستوى الصفوف (Row Level Security - RLS)
-- ==============================================================================

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- دالة فحص هل المستخدم الحالي super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role' = 'super_admin',
    current_setting('request.jwt.claims', true)::jsonb->'user_metadata'->>'role' = 'super_admin',
    (SELECT role = 'super_admin' FROM public.profiles WHERE id = auth.uid()::text LIMIT 1),
    (SELECT role = 'super_admin' FROM public.users WHERE id = auth.uid()::text LIMIT 1),
    false
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- دالة فحص مدرسة المستخدم الحالية
CREATE OR REPLACE FUNCTION public.get_auth_school_id()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'school_id',
    (SELECT school_id::text FROM public.profiles WHERE id = auth.uid()::text LIMIT 1),
    (SELECT school_id FROM public.users WHERE id = auth.uid()::text LIMIT 1),
    'a0000000-0000-0000-0000-000000000001'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- دالة فحص هل مدرسة المستخدم نشطة وصالحة الاشتراك
CREATE OR REPLACE FUNCTION public.is_current_school_active()
RETURNS BOOLEAN AS $$
DECLARE
  v_school_status TEXT;
  v_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- الـ super_admin يستثنى دائماً ويملك وصولاً كاملاً
  IF public.is_super_admin() THEN
    RETURN true;
  END IF;

  SELECT status, subscription_end_date 
  INTO v_school_status, v_end_date
  FROM public.schools
  WHERE id::text = public.get_auth_school_id();

  IF v_school_status IS NULL THEN
    RETURN false;
  END IF;

  -- فحص حالة التعليق وتاريخ انتهاء الصلاحية
  IF v_school_status = 'suspended' THEN
    RETURN false;
  END IF;

  IF v_end_date IS NOT NULL AND v_end_date < timezone('utc'::text, now()) THEN
    RETURN false;
  END IF;

  RETURN (v_school_status = 'active');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- سياسات جدول المدارس (Schools RLS)
DROP POLICY IF EXISTS "Super admin has full control over schools" ON public.schools;
CREATE POLICY "Super admin has full control over schools" ON public.schools
  FOR ALL TO authenticated, anon
  USING (
    public.is_super_admin()
    OR auth.jwt()->>'role' = 'service_role'
  )
  WITH CHECK (
    public.is_super_admin()
    OR auth.jwt()->>'role' = 'service_role'
  );

DROP POLICY IF EXISTS "Users can view their own active school" ON public.schools;
CREATE POLICY "Users can view their own active school" ON public.schools
  FOR SELECT TO authenticated, anon
  USING (
    id::text = public.get_auth_school_id()
  );

-- سياسات جدول profiles / users
DROP POLICY IF EXISTS "Super admin can manage all profiles" ON public.profiles;
CREATE POLICY "Super admin can manage all profiles" ON public.profiles
  FOR ALL TO authenticated, anon
  USING (public.is_super_admin() OR auth.jwt()->>'role' = 'service_role')
  WITH CHECK (public.is_super_admin() OR auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "Members can view profiles within their active school" ON public.profiles;
CREATE POLICY "Members can view profiles within their active school" ON public.profiles
  FOR SELECT TO authenticated, anon
  USING (
    public.is_current_school_active()
    AND school_id::text = public.get_auth_school_id()
  );

-- سياسات الجداول التعليمية (activities, submissions, exams)
-- تخضع لشرطين: العزل بالمدرسة + التحقق من صلاحية ونشاط المدرسة
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Activities isolated and active school only" ON public.activities;
CREATE POLICY "Activities isolated and active school only" ON public.activities
  FOR ALL TO authenticated, anon
  USING (
    public.is_super_admin()
    OR (
      public.is_current_school_active()
      AND (school_id = public.get_auth_school_id() OR school_id IS NULL)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.is_current_school_active()
      AND (school_id = public.get_auth_school_id() OR school_id IS NULL)
    )
  );

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Submissions isolated and active school only" ON public.submissions;
CREATE POLICY "Submissions isolated and active school only" ON public.submissions
  FOR ALL TO authenticated, anon
  USING (
    public.is_super_admin()
    OR (
      public.is_current_school_active()
      AND (school_id = public.get_auth_school_id() OR school_id IS NULL)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.is_current_school_active()
      AND (school_id = public.get_auth_school_id() OR school_id IS NULL)
    )
  );
