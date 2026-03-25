-- =============================================================================
-- SMARTCURRICULUM – Ultimate RLS & Access Fix
-- =============================================================================
-- Run this if you are still getting "403 Forbidden" or "Profile Missing" errors.
-- This script wipes all restrictive policies and opens the tables for 
-- authenticated users (Students and Teachers).
-- =============================================================================

-- ── 1. Nuke any existing policies on users and courses ─────────────────────
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('users', 'courses', 'sessions', 'attendance', 'enrollments')) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ──-- 2. Re-enable RLS ───────────────────────────────────────────────────────
ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- ── 3. Create permissive SELECT policies ────────────────────────────────────
CREATE POLICY "allow_select_users_all"       ON public.users       FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_select_courses_all"     ON public.courses     FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_select_sessions_all"    ON public.sessions    FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_select_enrollments_all" ON public.enrollments FOR SELECT TO authenticated USING (true);

-- Teachers can see all attendance records for their own courses/sessions
-- Students can see their own attendance
CREATE POLICY "allow_select_attendance_all" ON public.attendance FOR SELECT TO authenticated 
USING (
    student_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.sessions s 
        WHERE s.session_id = attendance.session_id AND s.teacher_id = auth.uid()
    )
);

-- ── 4. Create permissive INSERT policies ────────────────────────────────────
CREATE POLICY "allow_insert_users_self" ON public.users FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "allow_insert_courses_teacher" ON public.courses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_insert_sessions_teacher" ON public.sessions FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "allow_insert_enrollments_student" ON public.enrollments FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

-- Students can insert attendance if they are authenticated
-- (Security is handled by the Edge Function token, but for direct insert we allow it)
CREATE POLICY "allow_insert_attendance_student" ON public.attendance FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

-- ── 5. Create permissive UPDATE policies ────────────────────────────────────
CREATE POLICY "allow_update_users_self" ON public.users FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "allow_update_courses_teacher" ON public.courses FOR UPDATE TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "allow_update_sessions_teacher" ON public.sessions FOR UPDATE TO authenticated USING (teacher_id = auth.uid());

-- ── 6. Verification check ──────────────────────────────────────────────────
-- Ensure the slot column is there
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS slot TEXT DEFAULT 'General';

-- =============================================================================
-- IMPORTANT: Paste this into Supabase SQL Editor and click RUN.
-- =============================================================================
