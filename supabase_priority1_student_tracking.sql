-- =========================================================================
-- منصة تعلم مع موسى | ترحيل جداول التتبع الفردي للطالب للسحابة (الأولوية القصوى)
-- Learn with Mousa - Priority 1: Student Individual Tracking Migration
-- =========================================================================

-- 1. جدول جلسات الطلاقة الشفهية (Reading Fluency / ORF Sessions)
CREATE TABLE IF NOT EXISTS public.reading_fluency_sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_name TEXT,
  school_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  grade TEXT,
  track TEXT,
  passage_id TEXT,
  passage_title TEXT NOT NULL,
  passage_text TEXT,
  total_words INTEGER DEFAULT 0,
  duration_seconds NUMERIC DEFAULT 0,
  words_read INTEGER DEFAULT 0,
  words_correct INTEGER DEFAULT 0,
  wcpm NUMERIC DEFAULT 0, -- عدد الكلمات الصحيحة في الدقيقة (Words Correct Per Minute)
  accuracy_rate NUMERIC DEFAULT 0, -- نسبة دقة القراءة المئوية
  prosody_score NUMERIC DEFAULT 3, -- مقياس جودة التعبير والتنغيم الصوتي (1 - 4)
  assessor_role TEXT DEFAULT 'student_self', -- 'student_self' | 'teacher_evaluated'
  assessor_name TEXT,
  date TEXT,
  error_breakdown JSONB DEFAULT '{"omission": 0, "substitution": 0, "insertion": 0, "hesitation": 0, "repetition": 0}'::jsonb,
  annotations JSONB DEFAULT '[]'::jsonb,
  grade_benchmark_level TEXT DEFAULT 'proficient', -- 'below_basic' | 'basic' | 'proficient' | 'advanced'
  certificate_number TEXT,
  spoken_transcript TEXT,
  ai_diagnostic_note TEXT,
  audio_url TEXT, -- رابط التسجيل الصوتي أو بيانات الصوت Base64
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_orf_student_id ON public.reading_fluency_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_orf_school_id ON public.reading_fluency_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_orf_created_at ON public.reading_fluency_sessions(created_at DESC);

-- 2. جدول إتقان مهارات شجرة المعرفة (Skill Mastery / Knowledge Tree)
CREATE TABLE IF NOT EXISTS public.skill_mastery (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  school_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  status TEXT NOT NULL DEFAULT 'locked', -- 'locked' | 'unlocked' | 'practicing' | 'mastered_gold' | 'needs_polish'
  mastery_score INTEGER DEFAULT 0, -- من 0 إلى 100
  crowns INTEGER DEFAULT 0, -- تيجان الإتقان من 0 إلى 5
  retention_strength NUMERIC DEFAULT 1, -- قوة الذاكرة ومقياس التكرار المتباعد
  decay_percentage NUMERIC DEFAULT 0, -- مؤشر اضمحلال المهارة لجدولة المراجعة
  last_practiced_date TEXT,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_student_skill_node UNIQUE (student_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_mastery_student_id ON public.skill_mastery(student_id);
CREATE INDEX IF NOT EXISTS idx_skill_mastery_node_id ON public.skill_mastery(node_id);
CREATE INDEX IF NOT EXISTS idx_skill_mastery_school_id ON public.skill_mastery(school_id);

-- 3. جدول الخطط والتوصيات العلاجية (Remedial Plans)
CREATE TABLE IF NOT EXISTS public.remedial_plans (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_name TEXT,
  teacher_id TEXT NOT NULL,
  school_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  target_skill TEXT NOT NULL,
  weak_letters JSONB DEFAULT '[]'::jsonb,
  recommended_game_type TEXT,
  prescribed_activities JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'in_progress' | 'mastered'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_remedial_plans_student_id ON public.remedial_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_remedial_plans_school_id ON public.remedial_plans(school_id);
CREATE INDEX IF NOT EXISTS idx_remedial_plans_teacher_id ON public.remedial_plans(teacher_id);
CREATE INDEX IF NOT EXISTS idx_remedial_plans_created_at ON public.remedial_plans(created_at DESC);

-- =========================================================================
-- تفعيل سياسات الأمان (Row Level Security - RLS) الكاملة
-- =========================================================================

ALTER TABLE public.reading_fluency_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remedial_plans ENABLE ROW LEVEL SECURITY;

-- حذف أي سياسات سابقة لتفادي التكرار
DROP POLICY IF EXISTS "Allow all operations on reading_fluency_sessions" ON public.reading_fluency_sessions;
DROP POLICY IF EXISTS "Allow all operations on skill_mastery" ON public.skill_mastery;
DROP POLICY IF EXISTS "Allow all operations on remedial_plans" ON public.remedial_plans;

-- 1. سياسة جدول جلسات الطلاقة الشفهية
CREATE POLICY "Allow all operations on reading_fluency_sessions"
ON public.reading_fluency_sessions
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 2. سياسة جدول إتقان مهارات شجرة المعرفة
CREATE POLICY "Allow all operations on skill_mastery"
ON public.skill_mastery
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 3. سياسة جدول الخطط العلاجية
CREATE POLICY "Allow all operations on remedial_plans"
ON public.remedial_plans
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
