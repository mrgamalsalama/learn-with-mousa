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
  allowed_stages JSONB,
  allowed_tracks JSONB,
  login_count INTEGER DEFAULT 0,
  last_login TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. جدول الأنشطة والاختبارات التفاعلية وحزمة الألعاب
CREATE TABLE IF NOT EXISTS public.activities (
  id TEXT PRIMARY KEY,
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

-- تحديث الأعمدة في حال كانت الجداول منشأة مسبقاً
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS activity_type TEXT DEFAULT 'worksheet';
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS game_data JSONB;
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS category TEXT;

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
-- 5. جدول الاختبارات وجلسات المراقبة الحية (Exams & Live Proctoring Sessions)
-- ==============================================================================

-- جدول الاختبارات والتقييمات
CREATE TABLE IF NOT EXISTS public.exams (
  id TEXT PRIMARY KEY,
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

-- تحديثات الأعمدة في حال كان الجدول منشأ مسبقاً
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMP WITH TIME ZONE;

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
CREATE POLICY "Enable all for anon on exams" ON public.exams FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for anon on exam_sessions" ON public.exam_sessions;
CREATE POLICY "Enable all for anon on exam_sessions" ON public.exam_sessions FOR ALL TO anon USING (true) WITH CHECK (true);

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
   track TEXT DEFAULT 'arabic-a',
   theme TEXT DEFAULT 'corkboard',
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

CREATE INDEX IF NOT EXISTS idx_padlet_posts_board ON public.padlet_posts(board_id);
CREATE INDEX IF NOT EXISTS idx_padlet_boards_grade ON public.padlet_boards(grade);

ALTER TABLE public.padlet_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.padlet_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for anon on padlet_boards" ON public.padlet_boards;
CREATE POLICY "Enable all for anon on padlet_boards" ON public.padlet_boards FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for anon on padlet_posts" ON public.padlet_posts;
CREATE POLICY "Enable all for anon on padlet_posts" ON public.padlet_posts FOR ALL TO anon USING (true) WITH CHECK (true);

-- ==============================================================================
-- 7. تفعيل البث اللحظي (Realtime) لجميع الجداول لمزامنة المتصفحات فورياً
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users, public.activities, public.submissions, public.badges, public.exams, public.exam_sessions, public.padlet_boards, public.padlet_posts;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;
