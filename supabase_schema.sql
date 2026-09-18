-- ==============================================================================
-- إعداد جداول وقواعد أمان منصة "تعلّم مع موسى" (Supabase SQL Schema)
-- يرجى نسخ هذا الكود ولصقه في SQL Editor داخل لوحة تحكم Supabase والضغط على RUN
-- ==============================================================================

-- 1. جدول المستخدمين والحسابات
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT,
  role TEXT NOT NULL,
  stage TEXT,
  grade TEXT,
  track TEXT,
  student_id TEXT,
  allowed_grades JSONB,
  allowed_tracks JSONB,
  login_count INTEGER DEFAULT 0,
  last_login TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. جدول الأنشطة والاختبارات التفاعلية
CREATE TABLE IF NOT EXISTS public.activities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
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

-- 3. جدول تسليمات ودرجات الطلاب
CREATE TABLE IF NOT EXISTS public.submissions (
  id TEXT PRIMARY KEY,
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

-- مؤشر بحث سريع للأوسمة حسب الطالب
CREATE INDEX IF NOT EXISTS idx_badges_student_id ON public.badges(student_id);

-- ==============================================================================
-- 5. تفعيل سياسات الأمان Row Level Security (RLS) والسماح بالوصول الكامل لدور anon
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

-- إتاحة القراءة والكتابة لدور anon (تطبيق الويب)
DROP POLICY IF EXISTS "Enable all for anon on users" ON public.users;
CREATE POLICY "Enable all for anon on users" ON public.users FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for anon on activities" ON public.activities;
CREATE POLICY "Enable all for anon on activities" ON public.activities FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for anon on submissions" ON public.submissions;
CREATE POLICY "Enable all for anon on submissions" ON public.submissions FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for anon on badges" ON public.badges;
CREATE POLICY "Enable all for anon on badges" ON public.badges FOR ALL TO anon USING (true) WITH CHECK (true);

-- ==============================================================================
-- 6. تفعيل البث اللحظي (Realtime) لجميع الجداول لمزامنة المتصفحات فورياً
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users, public.activities, public.submissions, public.badges;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;
