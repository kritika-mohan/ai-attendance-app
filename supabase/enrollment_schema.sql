-- =============================================================================
-- SMARTCURRICULUM – Enrollment System Schema
-- =============================================================================
-- This script adds Google Classroom-like enrollment with Join Codes.
-- =============================================================================

-- 1. Create COURSES table
CREATE TABLE IF NOT EXISTS public.courses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  join_code   TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Create ENROLLMENTS table (links Student to Course)
CREATE TABLE IF NOT EXISTS public.enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, course_id)
);

-- 3. Modify SESSIONS to link to COURSE_ID
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;

-- ── ROW LEVEL SECURITY (RLS) ───────────────────────────────────────────────

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- ── courses policies ──────────────────────────────────────────────────────

-- Anyone authenticated can read courses (needed for joining)
CREATE POLICY "courses_select_authenticated"
  ON public.courses FOR SELECT
  TO authenticated
  USING (true);

-- Teachers can create courses
CREATE POLICY "courses_insert_teacher"
  ON public.courses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'teacher')
  );

-- Teachers can update their own courses
CREATE POLICY "courses_update_own"
  ON public.courses FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid());

-- ── enrollments policies ──────────────────────────────────────────────────

-- Students can enroll themselves
CREATE POLICY "enrollments_insert_student"
  ON public.enrollments FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'student')
  );

-- Students can see their own enrollments
-- Teachers can see who is enrolled in their courses
CREATE POLICY "enrollments_select"
  ON public.enrollments FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = enrollments.course_id
      AND c.teacher_id = auth.uid()
    )
  );

-- Students can unenroll themselves
CREATE POLICY "enrollments_delete_student"
  ON public.enrollments FOR DELETE
  TO authenticated
  USING (student_id = auth.uid());

-- =============================================================================
-- IMPORTANT: Run this in the Supabase Dashboard → SQL Editor
-- =============================================================================
