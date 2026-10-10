-- ==============================================================================
-- إعداد جداول وقواعد أمان منصة "تعلّم مع موسى" (Supabase SQL Schema)
-- Multi-Tenancy SaaS Architecture, Super Admin Control & School-Level RLS
-- يرجى نسخ هذا الكود ولصقه في SQL Editor داخل لوحة تحكم Supabase والضغط على RUN
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- إنشاء أو تحديث enum أدوار المستخدمين
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

-- 0. جدول المدارس والاشتراكات (Schools SaaS Entity)
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

-- ضمان وجود كافة الحقول إذا كان الجدول منشأً سابقاً
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

-- إدراج مدرسة تجريبية معلقة للاختبار والتدقيق الأمني
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

-- 0.1 جدول الفصول الدراسية (Classes)
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

-- 1. جدول المستخدمين والحسابات
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

-- إنشاء منظر profiles متوافق مع Next.js/Supabase auth conventions
CREATE OR REPLACE VIEW public.profiles AS SELECT * FROM public.users;

-- 2. جدول الأنشطة والاختبارات التفاعلية وحزمة الألعاب
CREATE TABLE IF NOT EXISTS public.activities (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'school_demo_mousa' REFERENCES public.schools(id) ON DELETE CASCADE,
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

ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS school_id TEXT NOT NULL DEFAULT 'school_demo_mousa';
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS activity_type TEXT DEFAULT 'worksheet';
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS game_data JSONB;
CREATE INDEX IF NOT EXISTS idx_activities_school_id ON public.activities(school_id);

-- إنشاء منظر quizzes للتوافق مع استعلامات الاختبارات
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

-- 3. جدول تسليمات ودرجات الطلاب
CREATE TABLE IF NOT EXISTS public.submissions (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'school_demo_mousa' REFERENCES public.schools(id) ON DELETE CASCADE,
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

ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS school_id TEXT NOT NULL DEFAULT 'school_demo_mousa';
CREATE INDEX IF NOT EXISTS idx_submissions_school_id ON public.submissions(school_id);

-- 3.1 جدول خطط التعافي والتمكين العلاجي (Remedial Plans)
CREATE TABLE IF NOT EXISTS public.remedial_plans (
  id TEXT PRIMARY KEY DEFAULT ('rem_' || gen_random_uuid()::text),
  school_id TEXT NOT NULL DEFAULT 'school_demo_mousa' REFERENCES public.schools(id) ON DELETE CASCADE,
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

-- 4. جدول الأوسمة والإنجازات (معزول تماماً برقم الطالب student_id)
CREATE TABLE IF NOT EXISTS public.badges (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT,
  earned_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS category TEXT;
CREATE INDEX IF NOT EXISTS idx_badges_student_id ON public.badges(student_id);

-- ==============================================================================
-- 5. تفعيل سياسات الأمان Row Level Security (RLS) وحوكمة عزل المدارس
-- Multi-Tenancy Isolation, Super Admin Bypass & Subscription Suspension Enforcement
-- ==============================================================================
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remedial_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

-- دالة للتحقق من هوية المشرف العام (Super Admin)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- التحقق من دور service_role أو مطالبات JWT أو جدول المستخدمين
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

-- دالة لاستخراج معرّف مدرسة المستخدم الحالي
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

-- دالة للتحقق من صلاحية ونشاط اشتراك المدرسة (Active & Not Expired)
CREATE OR REPLACE FUNCTION public.is_school_active(target_school_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- المشرف العام مستثنى دائماً
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

-- سياسات جدول المدارس (Schools RLS)
DROP POLICY IF EXISTS "Schools access policy" ON public.schools;
DROP POLICY IF EXISTS "Enable all for anon on schools" ON public.schools;
CREATE POLICY "Schools access policy" ON public.schools
  FOR ALL TO anon, authenticated
  USING (
    public.is_super_admin()
    OR (id::text = public.current_user_school_id())
  )
  WITH CHECK (
    public.is_super_admin()
  );

-- سياسات جدول الفصول (Classes RLS)
DROP POLICY IF EXISTS "Enable all for anon on classes" ON public.classes;
CREATE POLICY "Classes access policy" ON public.classes 
  FOR ALL TO anon, authenticated 
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

-- سياسات المستخدمين والملفات الشخصية (Users / Profiles RLS)
DROP POLICY IF EXISTS "Enable all for anon on users" ON public.users;
CREATE POLICY "Users access policy" ON public.users 
  FOR ALL TO anon, authenticated 
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

-- سياسات الأنشطة والاختبارات التفاعلية (Activities / Quizzes RLS)
DROP POLICY IF EXISTS "Enable all for anon on activities" ON public.activities;
CREATE POLICY "Activities access policy" ON public.activities 
  FOR ALL TO anon, authenticated 
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

-- سياسات التسليمات والدرجات (Submissions RLS)
DROP POLICY IF EXISTS "Enable all for anon on submissions" ON public.submissions;
CREATE POLICY "Submissions access policy" ON public.submissions 
  FOR ALL TO anon, authenticated 
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

-- سياسات الخطط العلاجية (Remedial Plans RLS)
DROP POLICY IF EXISTS "Enable all for anon on remedial_plans" ON public.remedial_plans;
CREATE POLICY "Remedial plans access policy" ON public.remedial_plans 
  FOR ALL TO anon, authenticated 
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

DROP POLICY IF EXISTS "Enable all for anon on badges" ON public.badges;
CREATE POLICY "Enable all for anon on badges" ON public.badges FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 5. جدول الاختبارات وجلسات المراقبة الحية (Exams & Live Proctoring Sessions)
-- ==============================================================================

-- جدول الاختبارات والتقييمات
CREATE TABLE IF NOT EXISTS public.exams (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'school_demo_mousa' REFERENCES public.schools(id) ON DELETE CASCADE,
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

-- تحديثات الأعمدة في حال كان الجدول منشأ مسبقاً بنقص في الأعمدة
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS school_id TEXT NOT NULL DEFAULT 'school_demo_mousa';
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS teacher_name TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS target_track TEXT DEFAULT 'arabic-a';
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS show_results_immediately BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS questions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_exams_school_id ON public.exams(school_id);

-- جدول جلسات الاختبار والمراقبة الحية للطلاب
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

CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam ON public.exam_sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_student ON public.exam_sessions(student_id);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for anon on exams" ON public.exams;
CREATE POLICY "Exams access policy" ON public.exams FOR ALL TO anon, authenticated 
USING (
  public.is_super_admin()
  OR (
    school_id = public.current_user_school_id()
    AND public.is_school_active(school_id)
  )
) WITH CHECK (
  public.is_super_admin()
  OR (
    school_id = public.current_user_school_id()
    AND public.is_school_active(school_id)
  )
);

DROP POLICY IF EXISTS "Enable all for anon on exam_sessions" ON public.exam_sessions;
CREATE POLICY "Exam sessions access policy" ON public.exam_sessions FOR ALL TO anon, authenticated 
USING (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.exams 
    WHERE exams.id = exam_sessions.exam_id 
    AND exams.school_id = public.current_user_school_id()
    AND public.is_school_active(exams.school_id)
  )
) WITH CHECK (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.exams 
    WHERE exams.id = exam_sessions.exam_id 
    AND exams.school_id = public.current_user_school_id()
    AND public.is_school_active(exams.school_id)
  )
);

-- ==============================================================================
-- 6. جدول الجدار التفاعلي والمنشورات (Padlet Boards & Posts)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.padlet_boards (
   id TEXT PRIMARY KEY,
   title TEXT NOT NULL,
   description TEXT,
   teacher_id TEXT NOT NULL,
   teacher_name TEXT,
   grade TEXT NOT NULL,
   target_grade TEXT,
   track TEXT DEFAULT 'arabic-a',
   theme TEXT DEFAULT 'corkboard',
   color TEXT DEFAULT 'yellow',
   allow_comments BOOLEAN NOT NULL DEFAULT true,
   require_approval BOOLEAN NOT NULL DEFAULT false,
   is_locked BOOLEAN NOT NULL DEFAULT false,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.padlet_posts (
   id TEXT PRIMARY KEY,
   board_id TEXT NOT NULL,
   author_id TEXT NOT NULL,
   author_name TEXT NOT NULL,
   author_role TEXT NOT NULL DEFAULT 'student',
   content TEXT NOT NULL,
   color TEXT DEFAULT 'yellow',
   audio_url TEXT,
   image_url TEXT,
   content_type TEXT DEFAULT 'text',
   status TEXT NOT NULL DEFAULT 'approved',
   likes_count INTEGER NOT NULL DEFAULT 0,
   liked_by JSONB NOT NULL DEFAULT '[]'::jsonb,
   comments JSONB NOT NULL DEFAULT '[]'::jsonb,
   pinned BOOLEAN NOT NULL DEFAULT false,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- تحديث أعمدة جداول الحائط في حال تم إنشاؤها مسبقاً بنقص في الأعمدة
ALTER TABLE public.padlet_boards ADD COLUMN IF NOT EXISTS target_grade TEXT;
ALTER TABLE public.padlet_boards ADD COLUMN IF NOT EXISTS track TEXT DEFAULT 'arabic-a';
ALTER TABLE public.padlet_boards ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'corkboard';
ALTER TABLE public.padlet_boards ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'yellow';
ALTER TABLE public.padlet_boards ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.padlet_boards ADD COLUMN IF NOT EXISTS require_approval BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.padlet_boards ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.padlet_posts ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'yellow';
ALTER TABLE public.padlet_posts ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE public.padlet_posts ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.padlet_posts ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'text';
ALTER TABLE public.padlet_posts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE public.padlet_posts ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.padlet_posts ADD COLUMN IF NOT EXISTS liked_by JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.padlet_posts ADD COLUMN IF NOT EXISTS comments JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.padlet_posts ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_padlet_posts_board ON public.padlet_posts(board_id);
CREATE INDEX IF NOT EXISTS idx_padlet_boards_grade ON public.padlet_boards(grade);

ALTER TABLE public.padlet_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.padlet_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for anon on padlet_boards" ON public.padlet_boards;
CREATE POLICY "Enable all for anon on padlet_boards" ON public.padlet_boards FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for anon on padlet_posts" ON public.padlet_posts;
CREATE POLICY "Enable all for anon on padlet_posts" ON public.padlet_posts FOR ALL TO anon USING (true) WITH CHECK (true);

-- ==============================================================================
-- 7. جدول تحديات ومسابقات موسى التنافسية الحية (Challenge Quizzes & Rooms)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.challenge_quizzes (
   id TEXT PRIMARY KEY,
   title TEXT NOT NULL,
   description TEXT,
   teacher_id TEXT NOT NULL,
   teacher_name TEXT,
   target_grade TEXT NOT NULL,
   target_track TEXT DEFAULT 'arabic-a',
   questions JSONB NOT NULL DEFAULT '[]'::jsonb,
   is_ai_generated BOOLEAN NOT NULL DEFAULT false,
   topic TEXT,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.challenge_rooms (
   id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
   pin TEXT NOT NULL,
   quiz_id TEXT,
   quiz_title TEXT,
   host_id TEXT NOT NULL,
   host_name TEXT,
   target_grade TEXT,
   status TEXT NOT NULL DEFAULT 'lobby',
   current_question_index INTEGER NOT NULL DEFAULT 0,
   questions JSONB DEFAULT '[]'::jsonb,
   players JSONB NOT NULL DEFAULT '[]'::jsonb,
   answers_received JSONB NOT NULL DEFAULT '[]'::jsonb,
   question_start_time BIGINT,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
   updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- تحديث الأعمدة لضمان التوافق مع الجداول المنشأة سابقاً
ALTER TABLE public.challenge_rooms ADD COLUMN IF NOT EXISTS answers_received JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.challenge_rooms ALTER COLUMN players SET DEFAULT '[]'::jsonb;
ALTER TABLE public.challenge_rooms ALTER COLUMN quiz_id DROP NOT NULL;
ALTER TABLE public.challenge_rooms ALTER COLUMN quiz_title DROP NOT NULL;
ALTER TABLE public.challenge_rooms ALTER COLUMN host_name DROP NOT NULL;
ALTER TABLE public.challenge_rooms ALTER COLUMN target_grade DROP NOT NULL;
ALTER TABLE public.challenge_rooms ALTER COLUMN questions DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_challenge_rooms_pin ON public.challenge_rooms(pin);
CREATE INDEX IF NOT EXISTS idx_challenge_quizzes_grade ON public.challenge_quizzes(target_grade);

ALTER TABLE public.challenge_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for anon on challenge_quizzes" ON public.challenge_quizzes;
CREATE POLICY "Enable all for anon on challenge_quizzes" ON public.challenge_quizzes FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for anon on challenge_rooms" ON public.challenge_rooms;
CREATE POLICY "Enable all for anon on challenge_rooms" ON public.challenge_rooms FOR ALL TO anon USING (true) WITH CHECK (true);

-- ==============================================================================
-- 8. جدول جلسات فصل موسى المباشر وصلاحيات البث (Live Class Sessions & Live Permissions)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.live_class_sessions (
   id TEXT PRIMARY KEY,
   room_name TEXT NOT NULL,
   grade TEXT NOT NULL,
   track TEXT DEFAULT 'arabic-a',
   teacher_id TEXT NOT NULL,
   teacher_name TEXT NOT NULL,
   title TEXT NOT NULL,
   is_active BOOLEAN NOT NULL DEFAULT true,
   started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
   ended_at TIMESTAMP WITH TIME ZONE,
   server_domain TEXT DEFAULT 'framatalk.org',
   permissions JSONB NOT NULL DEFAULT '{"allowChat": false, "allowScreenShare": false}'::jsonb,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.live_class_sessions ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{"allowChat": false, "allowScreenShare": false}'::jsonb;
ALTER TABLE public.live_class_sessions ADD COLUMN IF NOT EXISTS server_domain TEXT DEFAULT 'framatalk.org';

CREATE INDEX IF NOT EXISTS idx_live_class_grade ON public.live_class_sessions(grade);
CREATE INDEX IF NOT EXISTS idx_live_class_teacher ON public.live_class_sessions(teacher_id);

ALTER TABLE public.live_class_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for anon on live_class_sessions" ON public.live_class_sessions;
CREATE POLICY "Enable all for anon on live_class_sessions" ON public.live_class_sessions FOR ALL TO anon USING (true) WITH CHECK (true);

-- ==============================================================================
-- 8.5. أوراق العمل التفاعلية المدرسية (Interactive Worksheets Hub)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.interactive_worksheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  teacher_id UUID,
  class_id UUID,
  target_class_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  grade_level TEXT,
  subject TEXT DEFAULT 'اللغة العربية',
  image_url TEXT,
  background_url TEXT,
  elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  elements_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_points NUMERIC DEFAULT 20,
  is_public BOOLEAN DEFAULT true,
  is_public_link_enabled BOOLEAN DEFAULT true,
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.worksheet_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worksheet_id UUID REFERENCES public.interactive_worksheets(id) ON DELETE CASCADE,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  student_id UUID,
  guest_name TEXT,
  student_name TEXT,
  class_id UUID,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  answers_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC DEFAULT 0,
  total_score NUMERIC DEFAULT 20,
  max_score NUMERIC DEFAULT 20,
  percentage NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'graded',
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_worksheets_school ON public.interactive_worksheets(school_id);
CREATE INDEX IF NOT EXISTS idx_worksheets_teacher ON public.interactive_worksheets(teacher_id);
CREATE INDEX IF NOT EXISTS idx_worksheets_class ON public.interactive_worksheets(class_id);
CREATE INDEX IF NOT EXISTS idx_submissions_worksheet ON public.worksheet_submissions(worksheet_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON public.worksheet_submissions(student_id);

ALTER TABLE public.interactive_worksheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worksheet_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for anon on interactive_worksheets" ON public.interactive_worksheets;
CREATE POLICY "Enable all for anon on interactive_worksheets" ON public.interactive_worksheets FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for authenticated on interactive_worksheets" ON public.interactive_worksheets;
CREATE POLICY "Enable all for authenticated on interactive_worksheets" ON public.interactive_worksheets FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for anon on worksheet_submissions" ON public.worksheet_submissions;
CREATE POLICY "Enable all for anon on worksheet_submissions" ON public.worksheet_submissions FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for authenticated on worksheet_submissions" ON public.worksheet_submissions;
CREATE POLICY "Enable all for authenticated on worksheet_submissions" ON public.worksheet_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 9. تفعيل البث اللحظي (Realtime) لجميع الجداول لمزامنة المتصفحات فورياً
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users, public.activities, public.submissions, public.badges, public.exams, public.exam_sessions, public.padlet_boards, public.padlet_posts, public.challenge_quizzes, public.challenge_rooms, public.live_class_sessions, public.interactive_worksheets, public.worksheet_submissions;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;

