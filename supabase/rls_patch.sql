-- =============================================================================
-- SMARTCURRICULUM – RLS Patch
-- =============================================================================
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- This patches the attendance insert policy so students can mark themselves
-- directly (instead of via an Edge Function which hasn't been deployed).
-- =============================================================================

-- Drop the old service_role-only policy
DROP POLICY IF EXISTS "attendance_insert_service_role" ON public.attendance;

-- Allow authenticated students to insert their OWN attendance record only
CREATE POLICY "attendance_insert_student"
  ON public.attendance FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

-- Allow students to also read their own records (in case not already covered)
-- (The existing attendance_select policy already handles this, but just in case)
