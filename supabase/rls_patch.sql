-- =============================================================================
-- SMARTCURRICULUM – Attendance RLS Fix
-- =============================================================================
-- This script allows students to record their own attendance.
-- It also ensures they can ONLY mark attendance for courses they are enrolled in.
-- =============================================================================

-- 1. Remove old restrictive policies
DROP POLICY IF EXISTS "attendance_insert_service_role" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert_student" ON public.attendance;

-- 2. Create a smart policy for students
-- Rules:
-- - Must be logged in (authenticated)
-- - student_id in the table must match the logged-in user (auth.uid())
-- - Must be enrolled in the course that the session belongs to
CREATE POLICY "attendance_insert_student"
  ON public.attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.session_id = attendance.session_id
      AND (
        s.course_id IS NULL OR -- Allow legacy sessions
        EXISTS (
          SELECT 1 FROM public.enrollments e 
          WHERE e.course_id = s.course_id AND e.student_id = auth.uid()
        )
      )
    )
  );

-- 3. Ensure students can read their own attendance records
DROP POLICY IF EXISTS "attendance_select" ON public.attendance;
CREATE POLICY "attendance_select"
  ON public.attendance FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.courses c ON c.id = s.course_id
      WHERE s.session_id = attendance.session_id
      AND c.teacher_id = auth.uid()
    )
  );

-- =============================================================================
-- IMPORTANT: Run this in the Supabase Dashboard → SQL Editor
-- =============================================================================
