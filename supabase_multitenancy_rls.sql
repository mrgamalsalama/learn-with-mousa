-- ==============================================================================
-- إعداد جداول وقواعد أمان العزل المدرسي لمنصة "تعلّم مع موسى" (Musa EdTech Multi-Tenancy & RLS)
-- Multi-Tenancy SaaS Architecture, Super Admin Control & School-Level Row Level Security
-- يرجى نسخ هذا الملف وتنفيذه في SQL Editor داخل لوحة تحكم Supabase والضغط على RUN
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- إنشاء أو تحديث enum أدوار المستخدمين في المنظومة
DO $$ BEGIN
  CREATE TYPE user_role_enum AS ENUM (
    'super_admin',
    'school_admin',
    'supervisor',
    'hod',
    'teacher',
    'parent',
    'student'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 1. جدول المدارس والاشتراكات (Schools SaaS Entity)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
  plan_tier TEXT NOT NULL DEFAULT 'trial' CHECK (plan_tier IN ('trial', 'annual')),
  subscription_start_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  subscription_end_date TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + interval '365 days'),
  ai_enabled BOOLEAN NOT NULL DEFAULT true, -- مفتاح الـ AI Kill Switch الخاص بالمدرسة
  max_students INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS max_students INTEGER NOT NULL DEFAULT 500;
CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_slug ON public.schools(slug);

-- إدراج المدرسة النموذجية الافتراضية ليوم العرض (Demo Day School)
INSERT INTO public.schools (id, name, slug, status, plan_tier, subscription_start_date, subscription_end_date, ai_enabled, max_students)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid, 
  'مدرسة موسى النموذجية الرائدة', 
  'mousa-demo', 
  'active', 
  'annual', 
  timezone('utc'::text, now()), 
  timezone('utc'::text, now() + interval '365 days'), 
  true, 
  500
)
ON CONFLICT (slug) DO UPDATE SET
  status = 'active',
  ai_enabled = true;

-- إدراج مدرسة تجريبية معلقة لاختبار سيناريو انتهاء الاشتراك والتعليق (Suspended School Demo)
INSERT INTO public.schools (id, name, slug, status, plan_tier, subscription_start_date, subscription_end_date, ai_enabled, max_students)
VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid, 
  'مدرسة النور التجريبية (معلقة للاختبار)', 
  'al-noor-suspended', 
  'suspended', 
  'trial', 
  timezone('utc'::text, now() - interval '60 days'), 
  timezone('utc'::text, now() - interval '10 days'), 
  false, 
  100
)
ON CONFLICT (slug) DO NOTHING;

-- ==============================================================================
-- 2. جدول الفصول الدراسية (Classes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.classes (
  id TEXT PRIMARY KEY DEFAULT ('cls_' || gen_random_uuid()::text),
  school_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  name TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'primary',
  grade TEXT NOT NULL DEFAULT 'grade-1',
  track TEXT NOT NULL DEFAULT 'arabic-a',
  teacher_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_classes_school_id ON public.classes(school_id);

-- ==============================================================================
-- 3. جدول الملفات الشخصية والمستخدمين (Profiles / Users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT,
  role TEXT NOT NULL DEFAULT 'student',
  stage TEXT,
  grade TEXT,
  track TEXT,
  student_id TEXT,
  allowed_grades JSONB,
  allowed_stages JSONB,
  allowed_tracks JSONB,
  login_count INTEGER DEFAULT 0,
  last_login TEXT,
  avatar TEXT,
  email TEXT,
  timezone TEXT DEFAULT 'Africa/Cairo',
  preferences JSONB DEFAULT '{"soundEffects": true, "voiceSpeed": 1.0, "anonymousInLeaderboard": false}'::jsonb,
  ai_access_status TEXT DEFAULT 'inherit',
  delegated_admin_permissions JSONB DEFAULT '{"can_manage_teacher_grades": false, "can_manage_teacher_tasks": false, "can_control_ai_governance": false, "can_create_hod": false}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS school_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Cairo';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferences JSONB;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ai_access_status TEXT DEFAULT 'inherit';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS delegated_admin_permissions JSONB;
CREATE INDEX IF NOT EXISTS idx_users_school_id ON public.users(school_id);

CREATE OR REPLACE VIEW public.profiles AS SELECT * FROM public.users;

-- ==============================================================================
-- 4. جدول الأنشطة والاختبارات التفاعلية وحزمة الألعاب (Activities / Quizzes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.activities (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  title TEXT NOT NULL,
  activity_type TEXT DEFAULT 'worksheet',
  game_data JSONB,
  description TEXT,
  passage TEXT,
  teacher_id TEXT NOT NULL,
  teacher_name TEXT NOT NULL,
  stage TEXT,
  grade TEXT,
  track TEXT,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TEXT
);

ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS school_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_activities_school_id ON public.activities(school_id);

CREATE OR REPLACE VIEW public.quizzes AS 
SELECT 
  id,
  school_id,
  title,
  description,
  teacher_id,
  stage,
  grade,
  track,
  questions,
  created_at
FROM public.activities;

-- ==============================================================================
-- 5. جدول تسليمات ودرجات الطلاب (Submissions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.submissions (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  activity_id TEXT NOT NULL,
  activity_title TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  grade TEXT,
  track TEXT,
  score INTEGER NOT NULL,
  total_points INTEGER NOT NULL,
  submitted_at TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS school_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_submissions_school_id ON public.submissions(school_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON public.submissions(student_id);

-- ==============================================================================
-- 6. جدول خطط التعافي والتمكين العلاجي (Remedial Plans)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.remedial_plans (
  id TEXT PRIMARY KEY DEFAULT ('rem_' || gen_random_uuid()::text),
  school_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  student_id TEXT NOT NULL,
  student_name TEXT,
  teacher_id TEXT NOT NULL,
  target_skill TEXT NOT NULL,
  weak_letters JSONB DEFAULT '[]'::jsonb,
  recommended_game_type TEXT,
  prescribed_activities JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_remedial_plans_school_id ON public.remedial_plans(school_id);
CREATE INDEX IF NOT EXISTS idx_remedial_plans_student_id ON public.remedial_plans(student_id);

-- ==============================================================================
-- 7. جدول الاختبارات الرسمية (Exams)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.exams (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  title TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  teacher_name TEXT,
  target_grade TEXT NOT NULL,
  target_track TEXT DEFAULT 'arabic-a',
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  show_results_immediately BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  is_scheduled BOOLEAN NOT NULL DEFAULT false,
  scheduled_start TIMESTAMP WITH TIME ZONE,
  scheduled_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS school_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_exams_school_id ON public.exams(school_id);

-- ==============================================================================
-- 8. جدول جلسات الاختبار والمراقبة (Exam Sessions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  start_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  end_time TIMESTAMP WITH TIME ZONE,
  score NUMERIC DEFAULT 0,
  total_marks NUMERIC DEFAULT 0,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  tab_switch_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 9. كتابة وتفعيل سياسات الأمان على مستوى الصفوف (Row Level Security - RLS)
-- تضمن العزل التام للمدارس، استثناء المشرف العام (Super Admin)، ومنع المدارس المعلقة
-- ==============================================================================

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remedial_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

-- 9.1 دالة التحقق من صلاحية المشرف العام (Super Admin Bypass)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN
    RETURN true;
  END IF;

  IF current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role' = 'super_admin' THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()::text
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 9.2 دالة استخراج معرف مدرسة المستخدم الحالي
CREATE OR REPLACE FUNCTION public.current_user_school_id() 
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'school_id',
    (SELECT school_id FROM public.users WHERE id = auth.uid()::text LIMIT 1),
    '00000000-0000-0000-0000-000000000001'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 9.3 دالة فحص نشاط اشتراك المدرسة (Active & Not Expired)
CREATE OR REPLACE FUNCTION public.is_school_active(target_school_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF public.is_super_admin() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.schools
    WHERE (id::text = target_school_id OR slug = target_school_id)
    AND status = 'active'
    AND (subscription_end_date IS NULL OR subscription_end_date >= timezone('utc'::text, now()))
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 9.4 سياسات جدول المدارس (Schools Policies)
DROP POLICY IF EXISTS "Schools access policy" ON public.schools;
CREATE POLICY "Schools access policy" ON public.schools
  FOR ALL TO anon, authenticated
  USING (
    public.is_super_admin()
    OR (id::text = public.current_user_school_id())
  )
  WITH CHECK (
    public.is_super_admin()
  );

-- 9.5 سياسات جدول الفصول (Classes RLS)
DROP POLICY IF EXISTS "Classes access policy" ON public.classes;
CREATE POLICY "Classes access policy" ON public.classes
  FOR ALL TO authenticated, anon
  USING (
    public.is_super_admin()
    OR (
      school_id = public.current_user_school_id()
      AND public.is_school_active(school_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      school_id = public.current_user_school_id()
      AND public.is_school_active(school_id)
    )
  );

-- 9.6 سياسات جدول المستخدمين (Users / Profiles RLS)
DROP POLICY IF EXISTS "Users access policy" ON public.users;
CREATE POLICY "Users access policy" ON public.users
  FOR ALL TO authenticated, anon
  USING (
    public.is_super_admin()
    OR (
      school_id = public.current_user_school_id()
      AND public.is_school_active(school_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      school_id = public.current_user_school_id()
      AND public.is_school_active(school_id)
    )
  );

-- 9.7 سياسات جدول الأنشطة والاختبارات (Activities / Quizzes RLS)
DROP POLICY IF EXISTS "Activities access policy" ON public.activities;
CREATE POLICY "Activities access policy" ON public.activities
  FOR ALL TO authenticated, anon
  USING (
    public.is_super_admin()
    OR (
      school_id = public.current_user_school_id()
      AND public.is_school_active(school_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      school_id = public.current_user_school_id()
      AND public.is_school_active(school_id)
    )
  );

-- 9.8 سياسات جدول التسليمات والدرجات (Submissions RLS)
DROP POLICY IF EXISTS "Submissions access policy" ON public.submissions;
CREATE POLICY "Submissions access policy" ON public.submissions
  FOR ALL TO authenticated, anon
  USING (
    public.is_super_admin()
    OR (
      school_id = public.current_user_school_id()
      AND public.is_school_active(school_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      school_id = public.current_user_school_id()
      AND public.is_school_active(school_id)
    )
  );

-- 9.9 سياسات جدول الخطط العلاجية (Remedial Plans RLS)
DROP POLICY IF EXISTS "Remedial plans access policy" ON public.remedial_plans;
CREATE POLICY "Remedial plans access policy" ON public.remedial_plans
  FOR ALL TO authenticated, anon
  USING (
    public.is_super_admin()
    OR (
      school_id = public.current_user_school_id()
      AND public.is_school_active(school_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      school_id = public.current_user_school_id()
      AND public.is_school_active(school_id)
    )
  );

-- 9.10 سياسات جدول الاختبارات المدرسية (Exams RLS)
DROP POLICY IF EXISTS "Exams access policy" ON public.exams;
CREATE POLICY "Exams access policy" ON public.exams
  FOR ALL TO authenticated, anon
  USING (
    public.is_super_admin()
    OR (
      school_id = public.current_user_school_id()
      AND public.is_school_active(school_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      school_id = public.current_user_school_id()
      AND public.is_school_active(school_id)
    )
  );

-- 9.11 سياسات جلسات الاختبار (Exam Sessions RLS)
DROP POLICY IF EXISTS "Exam sessions access policy" ON public.exam_sessions;
CREATE POLICY "Exam sessions access policy" ON public.exam_sessions
  FOR ALL TO authenticated, anon
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.exams 
      WHERE exams.id = exam_sessions.exam_id 
      AND exams.school_id = public.current_user_school_id()
      AND public.is_school_active(exams.school_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.exams 
      WHERE exams.id = exam_sessions.exam_id 
      AND exams.school_id = public.current_user_school_id()
      AND public.is_school_active(exams.school_id)
    )
  );

-- ==============================================================================
-- 10. بذر بيانات العرض النموذجي التأسيسية المعتمدة (Clean Demo Seed)
-- ==============================================================================
INSERT INTO public.users (id, school_id, name, username, password, role, allowed_stages, allowed_grades, allowed_tracks, login_count)
VALUES 
  ('usr_admin', '00000000-0000-0000-0000-000000000001', 'المشرف العام (Super Admin)', 'admin', '123', 'super_admin', '["primary", "middle", "high"]'::jsonb, '["grade-1", "grade-2", "grade-3"]'::jsonb, '["arabic-a", "arabic-b"]'::jsonb, 10),
  ('usr_hod', '00000000-0000-0000-0000-000000000001', 'د. أحمد المنصوري (رئيس القسم)', 'hod', '123', 'hod', '["primary"]'::jsonb, '["grade-1", "grade-2", "grade-3", "grade-4"]'::jsonb, '["arabic-a", "arabic-b"]'::jsonb, 12),
  ('usr_teacher', '00000000-0000-0000-0000-000000000001', 'الأستاذة فاطمة الزهراء', 'teacher', '123', 'teacher', '["primary"]'::jsonb, '["grade-1", "grade-2"]'::jsonb, '["arabic-a", "arabic-b"]'::jsonb, 18),
  ('usr_student_mousa', '00000000-0000-0000-0000-000000000001', 'موسى البطل 🌟', 'student', '123', 'student', '["primary"]'::jsonb, '["grade-1"]'::jsonb, '["arabic-a"]'::jsonb, 25),
  ('usr_parent', '00000000-0000-0000-0000-000000000001', 'الأستاذ عمر (ولي أمر موسى)', 'parent', '123', 'parent', '["primary"]'::jsonb, '["grade-1"]'::jsonb, '["arabic-a"]'::jsonb, 8)
ON CONFLICT (id) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  name = EXCLUDED.name,
  role = EXCLUDED.role;

UPDATE public.users SET student_id = 'usr_student_mousa' WHERE id = 'usr_parent';
UPDATE public.users SET stage = 'primary', grade = 'grade-1', track = 'arabic-a' WHERE id = 'usr_student_mousa';

INSERT INTO public.classes (id, school_id, name, stage, grade, track, teacher_id)
VALUES 
  ('cls_grade1_a', '00000000-0000-0000-0000-000000000001', 'الصف الأول (أ) - براعم الفصحى', 'primary', 'grade-1', 'arabic-a', 'usr_teacher'),
  ('cls_grade2_a', '00000000-0000-0000-0000-000000000001', 'الصف الثاني (أ) - رواد المعرفة', 'primary', 'grade-2', 'arabic-a', 'usr_teacher')
ON CONFLICT (id) DO NOTHING;
