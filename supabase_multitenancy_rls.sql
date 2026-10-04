-- ==============================================================================
-- إعداد جداول وقواعد أمان العزل المدرسي لمنصة "تعلّم مع موسى" (Musa EdTech Multi-Tenancy & RLS)
-- يرجى نسخ هذا الملف وتنفيذه في SQL Editor داخل لوحة تحكم Supabase
-- ==============================================================================

-- 1. جدول المدارس (Schools Entity)
CREATE TABLE IF NOT EXISTS public.schools (
  id TEXT PRIMARY KEY DEFAULT ('school_' || gen_random_uuid()::text),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- إدراج المدرسة النموذجية الافتراضية ليوم العرض (Demo Day School)
INSERT INTO public.schools (id, name, code, is_active)
VALUES ('school_demo_mousa', 'مدرسة موسى النموذجية الرائدة', 'MOUSA_DEMO', true)
ON CONFLICT (id) DO NOTHING;

-- 2. جدول الفصول الدراسية (Classes)
CREATE TABLE IF NOT EXISTS public.classes (
  id TEXT PRIMARY KEY DEFAULT ('cls_' || gen_random_uuid()::text),
  school_id TEXT NOT NULL DEFAULT 'school_demo_mousa' REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'primary',
  grade TEXT NOT NULL DEFAULT 'grade-1',
  track TEXT NOT NULL DEFAULT 'arabic-a',
  teacher_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_classes_school_id ON public.classes(school_id);

-- 3. جدول الملفات الشخصية والمستخدمين (Profiles / Users)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'school_demo_mousa' REFERENCES public.schools(id) ON DELETE CASCADE,
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
  avatar TEXT,
  email TEXT,
  timezone TEXT DEFAULT 'Africa/Cairo',
  preferences JSONB DEFAULT '{"soundEffects": true, "voiceSpeed": 1.0, "anonymousInLeaderboard": false}'::jsonb,
  ai_access_status TEXT DEFAULT 'inherit',
  delegated_admin_permissions JSONB DEFAULT '{"can_manage_teacher_grades": false, "can_manage_teacher_tasks": false, "can_control_ai_governance": false, "can_create_hod": false}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ضمان وجود عمود school_id في جدول users إذا كان موجوداً مسبقاً
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS school_id TEXT NOT NULL DEFAULT 'school_demo_mousa';
CREATE INDEX IF NOT EXISTS idx_users_school_id ON public.users(school_id);

-- إنشاء منظر أو alias باسم profiles لتوافق متطلبات المنظومة
CREATE OR REPLACE VIEW public.profiles AS SELECT * FROM public.users;

-- 4. جدول الأنشطة والاختبارات التفاعلية وحزمة الألعاب (Activities / Quizzes)
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
CREATE INDEX IF NOT EXISTS idx_activities_school_id ON public.activities(school_id);

-- إنشاء منظر quizzes متوافق مع جدول activities
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

-- 5. جدول تسليمات ودرجات الطلاب (Submissions)
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
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON public.submissions(student_id);

-- 6. جدول خطط التعافي والتمكين العلاجي (Remedial Plans)
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
CREATE INDEX IF NOT EXISTS idx_remedial_plans_student_id ON public.remedial_plans(student_id);

-- 7. جدول الاختبارات الرسمية (Exams)
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

ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS school_id TEXT NOT NULL DEFAULT 'school_demo_mousa';
CREATE INDEX IF NOT EXISTS idx_exams_school_id ON public.exams(school_id);

-- 8. جدول جلسات الاختبار والمراقبة (Exam Sessions)
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
-- تضمن العزل التام للمدارس (School-level Multi-Tenant Isolation)
-- ==============================================================================

-- تفعيل RLS على كافة الجداول
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remedial_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

-- دوال مساعدة لاستخراج هوية ومدرسة المستخدم الحالي
CREATE OR REPLACE FUNCTION public.current_user_school_id() 
RETURNS TEXT AS $$
BEGIN
  -- استرجاع معرف مدرسة المستخدم الحالي من مطالبات JWT أو من جدول users
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'school_id',
    (SELECT school_id FROM public.users WHERE id = auth.uid()::text LIMIT 1),
    'school_demo_mousa' -- المدرسة الافتراضية
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- سياسات جدول المدارس (Schools Policies)
DROP POLICY IF EXISTS "Schools viewable by authenticated users" ON public.schools;
CREATE POLICY "Schools viewable by authenticated users" ON public.schools
  FOR SELECT TO authenticated, anon
  USING (is_active = true);

-- سياسات جدول الفصول (Classes RLS)
DROP POLICY IF EXISTS "Classes isolated by school" ON public.classes;
CREATE POLICY "Classes isolated by school" ON public.classes
  FOR ALL TO authenticated, anon
  USING (school_id = public.current_user_school_id())
  WITH CHECK (school_id = public.current_user_school_id());

-- سياسات جدول المستخدمين (Users / Profiles RLS)
-- لا يمكن لمستخدم أو معلم استعراض مستخدمي مدرسة أخرى
DROP POLICY IF EXISTS "Users isolated by school" ON public.users;
CREATE POLICY "Users isolated by school" ON public.users
  FOR ALL TO authenticated, anon
  USING (
    school_id = public.current_user_school_id()
    OR auth.jwt()->>'role' = 'service_role'
  )
  WITH CHECK (
    school_id = public.current_user_school_id()
    OR auth.jwt()->>'role' = 'service_role'
  );

-- سياسات جدول الأنشطة والاختبارات (Activities / Quizzes RLS)
-- تضمن بقاء أسئلة وقصص وأنشطة كل مدرسة معزولة داخل نطاقها
DROP POLICY IF EXISTS "Activities isolated by school" ON public.activities;
CREATE POLICY "Activities isolated by school" ON public.activities
  FOR ALL TO authenticated, anon
  USING (
    school_id = public.current_user_school_id()
    OR auth.jwt()->>'role' = 'service_role'
  )
  WITH CHECK (
    school_id = public.current_user_school_id()
    OR auth.jwt()->>'role' = 'service_role'
  );

-- سياسات جدول التسليمات والدرجات (Submissions RLS)
-- تحمي بيانات درجات الطلاب من الظهور لمعلمي أو طلاب مدارس أخرى
DROP POLICY IF EXISTS "Submissions isolated by school" ON public.submissions;
CREATE POLICY "Submissions isolated by school" ON public.submissions
  FOR ALL TO authenticated, anon
  USING (
    school_id = public.current_user_school_id()
    OR auth.jwt()->>'role' = 'service_role'
  )
  WITH CHECK (
    school_id = public.current_user_school_id()
    OR auth.jwt()->>'role' = 'service_role'
  );

-- سياسات جدول الخطط العلاجية (Remedial Plans RLS)
DROP POLICY IF EXISTS "Remedial plans isolated by school" ON public.remedial_plans;
CREATE POLICY "Remedial plans isolated by school" ON public.remedial_plans
  FOR ALL TO authenticated, anon
  USING (
    school_id = public.current_user_school_id()
    OR auth.jwt()->>'role' = 'service_role'
  )
  WITH CHECK (
    school_id = public.current_user_school_id()
    OR auth.jwt()->>'role' = 'service_role'
  );

-- سياسات جدول الاختبارات المدرسية (Exams RLS)
DROP POLICY IF EXISTS "Exams isolated by school" ON public.exams;
CREATE POLICY "Exams isolated by school" ON public.exams
  FOR ALL TO authenticated, anon
  USING (
    school_id = public.current_user_school_id()
    OR auth.jwt()->>'role' = 'service_role'
  )
  WITH CHECK (
    school_id = public.current_user_school_id()
    OR auth.jwt()->>'role' = 'service_role'
  );

-- سياسات جلسات الاختبار (Exam Sessions RLS)
DROP POLICY IF EXISTS "Exam sessions access control" ON public.exam_sessions;
CREATE POLICY "Exam sessions access control" ON public.exam_sessions
  FOR ALL TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.exams 
      WHERE exams.id = exam_sessions.exam_id 
      AND exams.school_id = public.current_user_school_id()
    )
    OR auth.jwt()->>'role' = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exams 
      WHERE exams.id = exam_sessions.exam_id 
      AND exams.school_id = public.current_user_school_id()
    )
    OR auth.jwt()->>'role' = 'service_role'
  );

-- ==============================================================================
-- 10. بذر بيانات العرض النموذجي التأسيسية المعتمدة (Clean Demo Seed)
-- ==============================================================================

-- التأكد من وجود مستخدمي العرض النموذجي وربطهم بمدرسة العرض school_demo_mousa
INSERT INTO public.users (id, school_id, name, username, password, role, allowed_stages, allowed_grades, allowed_tracks, login_count)
VALUES 
  ('usr_admin', 'school_demo_mousa', 'المشرف العام', 'admin', '123', 'super_admin', '["primary", "middle", "high"]'::jsonb, '["grade-1", "grade-2", "grade-3"]'::jsonb, '["arabic-a", "arabic-b"]'::jsonb, 10),
  ('usr_hod', 'school_demo_mousa', 'د. أحمد المنصوري (رئيس القسم)', 'hod', '123', 'hod', '["primary"]'::jsonb, '["grade-1", "grade-2", "grade-3", "grade-4"]'::jsonb, '["arabic-a", "arabic-b"]'::jsonb, 12),
  ('usr_teacher', 'school_demo_mousa', 'الأستاذة فاطمة الزهراء', 'teacher', '123', 'teacher', '["primary"]'::jsonb, '["grade-1", "grade-2"]'::jsonb, '["arabic-a", "arabic-b"]'::jsonb, 18),
  ('usr_student_mousa', 'school_demo_mousa', 'موسى البطل 🌟', 'student', '123', 'student', '["primary"]'::jsonb, '["grade-1"]'::jsonb, '["arabic-a"]'::jsonb, 25),
  ('usr_parent', 'school_demo_mousa', 'الأستاذ عمر (ولي أمر موسى)', 'parent', '123', 'parent', '["primary"]'::jsonb, '["grade-1"]'::jsonb, '["arabic-a"]'::jsonb, 8)
ON CONFLICT (id) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  name = EXCLUDED.name,
  role = EXCLUDED.role;

-- ربط الطالب بولي الأمر
UPDATE public.users SET student_id = 'usr_student_mousa' WHERE id = 'usr_parent';
UPDATE public.users SET stage = 'primary', grade = 'grade-1', track = 'arabic-a' WHERE id = 'usr_student_mousa';

-- تسجيل فصول العرض النموذجية
INSERT INTO public.classes (id, school_id, name, stage, grade, track, teacher_id)
VALUES 
  ('cls_grade1_a', 'school_demo_mousa', 'الصف الأول (أ) - براعم الفصحى', 'primary', 'grade-1', 'arabic-a', 'usr_teacher'),
  ('cls_grade2_a', 'school_demo_mousa', 'الصف الثاني (أ) - رواد المعرفة', 'primary', 'grade-2', 'arabic-a', 'usr_teacher')
ON CONFLICT (id) DO NOTHING;

-- تسجيل خطة علاجية نموذجية للطالب موسى
INSERT INTO public.remedial_plans (id, school_id, student_id, student_name, teacher_id, target_skill, weak_letters, recommended_game_type, status, notes)
VALUES (
  'rem_demo_mousa_1',
  'school_demo_mousa',
  'usr_student_mousa',
  'موسى البطل 🌟',
  'usr_teacher',
  'التمييز بين الحركات القصيرة والمدود الطويلة',
  '["ص", "ض", "ط"]'::jsonb,
  'vowel_train',
  'in_progress',
  'تم إسناد جولة قطار الحركات والمدود لمدة 3 دقائق يومياً لتعزيز الوعي الصوتي.'
) ON CONFLICT (id) DO NOTHING;
