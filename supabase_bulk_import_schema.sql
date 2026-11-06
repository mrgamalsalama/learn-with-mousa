-- ==============================================================================
-- 🏫 SUPABASE (POSTGRESQL) BULK IMPORT MIGRATION & RELATIONAL SCHEMA
-- Platform: تعلَّم مع مُوسَى (Learn with Mousa) Educational Platform
-- Purpose: Schema, Staging, Validation, and Bulk Ingestion for Schools Onboarding
-- Entities: Classes/Grades, Teachers, Students, Staff/Admin
-- ==============================================================================

-- 1. EXTENSIONS & PREREQUISITES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ==============================================================================
-- 2. DOMAIN ENUM TYPES (STANDARDIZED LOOKUPS)
-- ==============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'school_stage_enum') THEN
        CREATE TYPE school_stage_enum AS ENUM ('kindergarten', 'primary', 'middle', 'high');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'arabic_track_enum') THEN
        CREATE TYPE arabic_track_enum AS ENUM ('arabic-a', 'arabic-b');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_enum') THEN
        CREATE TYPE gender_enum AS ENUM ('male', 'female');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_status_enum') THEN
        CREATE TYPE student_status_enum AS ENUM ('active', 'transferred', 'graduated', 'suspended');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employment_status_enum') THEN
        CREATE TYPE employment_status_enum AS ENUM ('active', 'on_leave', 'resigned');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role_enum') THEN
        CREATE TYPE staff_role_enum AS ENUM (
            'super_admin',
            'school_admin',
            'academic_coordinator',
            'accountant',
            'supervisor',
            'hod'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permissions_group_enum') THEN
        CREATE TYPE permissions_group_enum AS ENUM (
            'full_admin',
            'academic_supervision',
            'finance_readonly',
            'student_affairs'
        );
    END IF;
END $$;

-- ==============================================================================
-- 3. CORE RELATIONAL TABLES
-- ==============================================================================

-- 3.1 SCHOOLS (MULTI-TENANCY ROOT)
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
    plan_tier VARCHAR(50) DEFAULT 'annual' CHECK (plan_tier IN ('trial', 'annual')),
    max_students INT DEFAULT 500,
    ai_enabled BOOLEAN DEFAULT true,
    subscription_start_date TIMESTAMPTZ DEFAULT NOW(),
    subscription_end_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure demo school exists
INSERT INTO public.schools (id, name, slug, status, plan_tier, max_students)
VALUES ('00000000-0000-0000-0000-000000000001', 'مدرسة موسى النموذجية الرائدة', 'mousa-demo', 'active', 'annual', 500)
ON CONFLICT (id) DO NOTHING;

-- 3.2 CLASSES & GRADES (المراحل والفصول)
CREATE TABLE IF NOT EXISTS public.classes_grades (
    class_id VARCHAR(50) PRIMARY KEY, -- e.g. 'CLS-G1-A'
    school_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.schools(id) ON DELETE CASCADE,
    section_code VARCHAR(50) NOT NULL, -- e.g. 'G1-A'
    class_name_ar VARCHAR(255) NOT NULL,
    stage school_stage_enum NOT NULL DEFAULT 'primary',
    grade_level VARCHAR(50) NOT NULL, -- e.g. 'Grade 1', 'KG2'
    track arabic_track_enum NOT NULL DEFAULT 'arabic-a',
    room_number VARCHAR(50),
    max_capacity INT DEFAULT 30 CHECK (max_capacity > 0),
    academic_year VARCHAR(20) DEFAULT '2026-2027',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_school_section UNIQUE (school_id, section_code, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_classes_school ON public.classes_grades(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_grade_track ON public.classes_grades(grade_level, track);

-- 3.3 TEACHERS (المعلمون)
CREATE TABLE IF NOT EXISTS public.teachers (
    teacher_id VARCHAR(50) PRIMARY KEY, -- e.g. 'TCH-1001'
    school_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.schools(id) ON DELETE CASCADE,
    national_id VARCHAR(50),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    full_name_ar VARCHAR(255) NOT NULL,
    full_name_en VARCHAR(255),
    email CITEXT NOT NULL,
    phone_number VARCHAR(50),
    gender gender_enum NOT NULL DEFAULT 'male',
    department VARCHAR(100) DEFAULT 'Arabic Language',
    subject_specialization VARCHAR(150),
    assigned_classes TEXT, -- Comma-separated class_ids e.g. 'CLS-G1-A, CLS-G1-B'
    employment_status employment_status_enum NOT NULL DEFAULT 'active',
    hire_date DATE DEFAULT CURRENT_DATE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_teacher_email_school UNIQUE (school_id, email)
);

CREATE INDEX IF NOT EXISTS idx_teachers_school ON public.teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_teachers_email ON public.teachers(email);

-- 3.4 STUDENTS (الطلاب)
CREATE TABLE IF NOT EXISTS public.students (
    student_id VARCHAR(50) PRIMARY KEY, -- Academic ID e.g. 'STU-2026-001'
    school_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.schools(id) ON DELETE CASCADE,
    national_id VARCHAR(50),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    full_name_ar VARCHAR(255) NOT NULL,
    gender gender_enum NOT NULL DEFAULT 'male',
    birth_date DATE NOT NULL,
    grade_level VARCHAR(50) NOT NULL, -- e.g. 'Grade 1'
    section_code VARCHAR(50) NOT NULL, -- e.g. 'G1-A'
    class_id VARCHAR(50) REFERENCES public.classes_grades(class_id) ON DELETE RESTRICT,
    track arabic_track_enum NOT NULL DEFAULT 'arabic-a',
    guardian_name VARCHAR(255) NOT NULL,
    guardian_relation VARCHAR(50) DEFAULT 'father',
    guardian_phone VARCHAR(50) NOT NULL,
    guardian_email CITEXT,
    address TEXT,
    status student_status_enum NOT NULL DEFAULT 'active',
    enrollment_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_student_national_school UNIQUE (school_id, national_id)
);

CREATE INDEX IF NOT EXISTS idx_students_school ON public.students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_grade ON public.students(grade_level);

-- 3.5 STAFF & ADMIN (الإدارة والمشرفون)
CREATE TABLE IF NOT EXISTS public.staff_admin (
    staff_id VARCHAR(50) PRIMARY KEY, -- e.g. 'STF-001'
    school_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.schools(id) ON DELETE CASCADE,
    national_id VARCHAR(50),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email CITEXT NOT NULL,
    role staff_role_enum NOT NULL DEFAULT 'school_admin',
    department VARCHAR(100),
    job_title VARCHAR(150),
    phone_number VARCHAR(50),
    permissions_group permissions_group_enum NOT NULL DEFAULT 'full_admin',
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    hire_date DATE DEFAULT CURRENT_DATE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_staff_email_school UNIQUE (school_id, email)
);

CREATE INDEX IF NOT EXISTS idx_staff_school ON public.staff_admin(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON public.staff_admin(email);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.classes_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_admin ENABLE ROW LEVEL SECURITY;

-- Allow anon & authenticated access for school operations with fallback
DO $$ BEGIN
    CREATE POLICY "Allow read access to classes" ON public.classes_grades FOR SELECT USING (true);
    CREATE POLICY "Allow read access to teachers" ON public.teachers FOR SELECT USING (true);
    CREATE POLICY "Allow read access to students" ON public.students FOR SELECT USING (true);
    CREATE POLICY "Allow read access to staff" ON public.staff_admin FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================================================
-- 5. STAGING TABLES (FOR DIRECT RAW CSV/EXCEL IMPORTS & DATA CLEANING)
-- ==============================================================================

-- Staging tables accept loose text types to avoid import aborts on dirty formatting.
-- Once imported into staging, the stored procedure validates and casts into production tables.

CREATE TABLE IF NOT EXISTS public.staging_classes_grades (
    import_batch_id UUID DEFAULT gen_random_uuid(),
    school_id UUID DEFAULT '00000000-0000-0000-0000-000000000001',
    class_id TEXT,
    section_code TEXT,
    class_name_ar TEXT,
    stage TEXT,
    grade_level TEXT,
    track TEXT,
    room_number TEXT,
    max_capacity TEXT,
    academic_year TEXT,
    is_active TEXT,
    imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staging_teachers (
    import_batch_id UUID DEFAULT gen_random_uuid(),
    school_id UUID DEFAULT '00000000-0000-0000-0000-000000000001',
    teacher_id TEXT,
    national_id TEXT,
    first_name TEXT,
    last_name TEXT,
    full_name_ar TEXT,
    full_name_en TEXT,
    email TEXT,
    phone_number TEXT,
    gender TEXT,
    department TEXT,
    subject_specialization TEXT,
    assigned_classes TEXT,
    employment_status TEXT,
    hire_date TEXT,
    imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staging_students (
    import_batch_id UUID DEFAULT gen_random_uuid(),
    school_id UUID DEFAULT '00000000-0000-0000-0000-000000000001',
    student_id TEXT,
    national_id TEXT,
    first_name TEXT,
    last_name TEXT,
    full_name_ar TEXT,
    gender TEXT,
    birth_date TEXT,
    grade_level TEXT,
    section_code TEXT,
    class_id TEXT,
    track TEXT,
    guardian_name TEXT,
    guardian_relation TEXT,
    guardian_phone TEXT,
    guardian_email TEXT,
    address TEXT,
    status TEXT,
    enrollment_date TEXT,
    imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staging_staff_admin (
    import_batch_id UUID DEFAULT gen_random_uuid(),
    school_id UUID DEFAULT '00000000-0000-0000-0000-000000000001',
    staff_id TEXT,
    national_id TEXT,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    email TEXT,
    role TEXT,
    department TEXT,
    job_title TEXT,
    phone_number TEXT,
    permissions_group TEXT,
    status TEXT,
    hire_date TEXT,
    imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. STORED PROCEDURES FOR VALIDATION & ATOMIC BULK INGESTION
-- ==============================================================================

-- 6.1 PROCEDURE: INGEST STAGING CLASSES INTO PRODUCTION
CREATE OR REPLACE FUNCTION public.fn_process_staging_classes(target_school_id UUID)
RETURNS TABLE (inserted_count INT, updated_count INT) LANGUAGE plpgsql AS $$
DECLARE
    v_ins INT := 0;
    v_upd INT := 0;
BEGIN
    INSERT INTO public.classes_grades (
        class_id, school_id, section_code, class_name_ar, stage,
        grade_level, track, room_number, max_capacity, academic_year, is_active
    )
    SELECT
        TRIM(class_id),
        target_school_id,
        TRIM(section_code),
        TRIM(class_name_ar),
        COALESCE(NULLIF(LOWER(TRIM(stage)), '')::school_stage_enum, 'primary'),
        TRIM(grade_level),
        COALESCE(NULLIF(LOWER(TRIM(track)), '')::arabic_track_enum, 'arabic-a'),
        TRIM(room_number),
        COALESCE(NULLIF(TRIM(max_capacity), '')::INT, 25),
        COALESCE(NULLIF(TRIM(academic_year), ''), '2026-2027'),
        COALESCE(NULLIF(LOWER(TRIM(is_active)), '')::BOOLEAN, true)
    FROM public.staging_classes_grades
    WHERE NULLIF(TRIM(class_id), '') IS NOT NULL
    ON CONFLICT (class_id) DO UPDATE SET
        class_name_ar = EXCLUDED.class_name_ar,
        room_number = EXCLUDED.room_number,
        max_capacity = EXCLUDED.max_capacity,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();

    GET DIAGNOSTICS v_ins = ROW_COUNT;
    RETURN QUERY SELECT v_ins, v_upd;
END;
$$;

-- 6.2 PROCEDURE: INGEST STAGING TEACHERS INTO PRODUCTION
CREATE OR REPLACE FUNCTION public.fn_process_staging_teachers(target_school_id UUID)
RETURNS TABLE (processed_count INT) LANGUAGE plpgsql AS $$
DECLARE
    v_count INT := 0;
BEGIN
    INSERT INTO public.teachers (
        teacher_id, school_id, national_id, first_name, last_name,
        full_name_ar, full_name_en, email, phone_number, gender,
        department, subject_specialization, assigned_classes,
        employment_status, hire_date
    )
    SELECT
        TRIM(teacher_id),
        target_school_id,
        TRIM(national_id),
        TRIM(first_name),
        TRIM(last_name),
        TRIM(full_name_ar),
        TRIM(full_name_en),
        LOWER(TRIM(email))::CITEXT,
        TRIM(phone_number),
        COALESCE(NULLIF(LOWER(TRIM(gender)), '')::gender_enum, 'male'),
        COALESCE(NULLIF(TRIM(department), ''), 'Arabic Language'),
        TRIM(subject_specialization),
        TRIM(assigned_classes),
        COALESCE(NULLIF(LOWER(TRIM(employment_status)), '')::employment_status_enum, 'active'),
        COALESCE(NULLIF(TRIM(hire_date), '')::DATE, CURRENT_DATE)
    FROM public.staging_teachers
    WHERE NULLIF(TRIM(teacher_id), '') IS NOT NULL
      AND NULLIF(TRIM(email), '') IS NOT NULL
    ON CONFLICT (teacher_id) DO UPDATE SET
        full_name_ar = EXCLUDED.full_name_ar,
        email = EXCLUDED.email,
        phone_number = EXCLUDED.phone_number,
        department = EXCLUDED.department,
        assigned_classes = EXCLUDED.assigned_classes,
        employment_status = EXCLUDED.employment_status,
        updated_at = NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT v_count;
END;
$$;

-- 6.3 PROCEDURE: INGEST STAGING STUDENTS INTO PRODUCTION (WITH FK VERIFICATION)
CREATE OR REPLACE FUNCTION public.fn_process_staging_students(target_school_id UUID)
RETURNS TABLE (processed_count INT) LANGUAGE plpgsql AS $$
DECLARE
    v_count INT := 0;
BEGIN
    -- Ensure any missing class_ids in staging exist in classes_grades first
    INSERT INTO public.classes_grades (class_id, school_id, section_code, class_name_ar, stage, grade_level, track)
    SELECT DISTINCT
        TRIM(s.class_id),
        target_school_id,
        COALESCE(NULLIF(TRIM(s.section_code), ''), 'G1-A'),
        'فصل ' || COALESCE(NULLIF(TRIM(s.section_code), ''), 'G1-A'),
        'primary',
        COALESCE(NULLIF(TRIM(s.grade_level), ''), 'Grade 1'),
        'arabic-a'
    FROM public.staging_students s
    WHERE NULLIF(TRIM(s.class_id), '') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.classes_grades c WHERE c.class_id = TRIM(s.class_id))
    ON CONFLICT (class_id) DO NOTHING;

    INSERT INTO public.students (
        student_id, school_id, national_id, first_name, last_name,
        full_name_ar, gender, birth_date, grade_level, section_code,
        class_id, track, guardian_name, guardian_relation,
        guardian_phone, guardian_email, address, status, enrollment_date
    )
    SELECT
        TRIM(student_id),
        target_school_id,
        TRIM(national_id),
        TRIM(first_name),
        TRIM(last_name),
        TRIM(full_name_ar),
        COALESCE(NULLIF(LOWER(TRIM(gender)), '')::gender_enum, 'male'),
        COALESCE(NULLIF(TRIM(birth_date), '')::DATE, '2019-01-01'::DATE),
        TRIM(grade_level),
        TRIM(section_code),
        TRIM(class_id),
        COALESCE(NULLIF(LOWER(TRIM(track)), '')::arabic_track_enum, 'arabic-a'),
        TRIM(guardian_name),
        COALESCE(NULLIF(TRIM(guardian_relation), ''), 'father'),
        TRIM(guardian_phone),
        LOWER(TRIM(guardian_email))::CITEXT,
        TRIM(address),
        COALESCE(NULLIF(LOWER(TRIM(status)), '')::student_status_enum, 'active'),
        COALESCE(NULLIF(TRIM(enrollment_date), '')::DATE, CURRENT_DATE)
    FROM public.staging_students
    WHERE NULLIF(TRIM(student_id), '') IS NOT NULL
    ON CONFLICT (student_id) DO UPDATE SET
        full_name_ar = EXCLUDED.full_name_ar,
        class_id = EXCLUDED.class_id,
        grade_level = EXCLUDED.grade_level,
        guardian_phone = EXCLUDED.guardian_phone,
        status = EXCLUDED.status,
        updated_at = NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT v_count;
END;
$$;

-- 6.4 PROCEDURE: INGEST STAGING STAFF INTO PRODUCTION
CREATE OR REPLACE FUNCTION public.fn_process_staging_staff(target_school_id UUID)
RETURNS TABLE (processed_count INT) LANGUAGE plpgsql AS $$
DECLARE
    v_count INT := 0;
BEGIN
    INSERT INTO public.staff_admin (
        staff_id, school_id, national_id, first_name, last_name,
        full_name, email, role, department, job_title,
        phone_number, permissions_group, status, hire_date
    )
    SELECT
        TRIM(staff_id),
        target_school_id,
        TRIM(national_id),
        TRIM(first_name),
        TRIM(last_name),
        TRIM(full_name),
        LOWER(TRIM(email))::CITEXT,
        COALESCE(NULLIF(LOWER(TRIM(role)), '')::staff_role_enum, 'school_admin'),
        TRIM(department),
        TRIM(job_title),
        TRIM(phone_number),
        COALESCE(NULLIF(LOWER(TRIM(permissions_group)), '')::permissions_group_enum, 'full_admin'),
        COALESCE(NULLIF(LOWER(TRIM(status)), ''), 'active'),
        COALESCE(NULLIF(TRIM(hire_date), '')::DATE, CURRENT_DATE)
    FROM public.staging_staff_admin
    WHERE NULLIF(TRIM(staff_id), '') IS NOT NULL
      AND NULLIF(TRIM(email), '') IS NOT NULL
    ON CONFLICT (staff_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        permissions_group = EXCLUDED.permissions_group,
        status = EXCLUDED.status,
        updated_at = NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT v_count;
END;
$$;

-- ==============================================================================
-- 7. DIRECT COPY / IMPORT EXAMPLES (FOR PSQL & SUPABASE STUDIO)
-- ==============================================================================

/*
-- [Method A: Direct PSQL \copy from CSV files]
-- Note: Must be executed in the exact order shown to preserve Foreign Key integrity:

\copy public.classes_grades (class_id, section_code, class_name_ar, stage, grade_level, track, room_number, max_capacity, academic_year, is_active) FROM 'classes_grades.csv' WITH (FORMAT csv, HEADER true);

\copy public.teachers (teacher_id, national_id, first_name, last_name, full_name_ar, full_name_en, email, phone_number, gender, department, subject_specialization, assigned_classes, employment_status, hire_date) FROM 'teachers.csv' WITH (FORMAT csv, HEADER true);

\copy public.students (student_id, national_id, first_name, last_name, full_name_ar, gender, birth_date, grade_level, section_code, class_id, track, guardian_name, guardian_relation, guardian_phone, guardian_email, address, status, enrollment_date) FROM 'students.csv' WITH (FORMAT csv, HEADER true);

\copy public.staff_admin (staff_id, national_id, first_name, last_name, full_name, email, role, department, job_title, phone_number, permissions_group, status, hire_date) FROM 'staff_admin.csv' WITH (FORMAT csv, HEADER true);


-- [Method B: Two-Step Staging Import via Supabase Studio UI]
-- 1. In Supabase Dashboard -> Table Editor -> select staging_* table -> click 'Insert' -> 'Import data from CSV'.
-- 2. Execute the validation and processing functions:
SELECT * FROM public.fn_process_staging_classes('00000000-0000-0000-0000-000000000001');
SELECT * FROM public.fn_process_staging_teachers('00000000-0000-0000-0000-000000000001');
SELECT * FROM public.fn_process_staging_students('00000000-0000-0000-0000-000000000001');
SELECT * FROM public.fn_process_staging_staff('00000000-0000-0000-0000-000000000001');

-- 3. Clean up staging tables:
TRUNCATE TABLE public.staging_classes_grades, public.staging_teachers, public.staging_students, public.staging_staff_admin;
*/
