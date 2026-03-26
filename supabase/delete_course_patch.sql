-- =============================================================================
-- SMARTCURRICULUM – Course Deletion Patch
-- =============================================================================

-- 1. Update SESSIONS foreign key to ON DELETE CASCADE
-- This ensures that when a course is deleted, all its sessions are also deleted.
ALTER TABLE IF EXISTS public.sessions 
  DROP CONSTRAINT IF EXISTS sessions_course_id_fkey,
  ADD CONSTRAINT sessions_course_id_fkey 
    FOREIGN KEY (course_id) 
    REFERENCES public.courses(id) 
    ON DELETE CASCADE;

-- 2. Add DELETE policy for courses
-- Allow teachers to delete their own courses.
DROP POLICY IF EXISTS "courses_delete_own" ON public.courses;
CREATE POLICY "courses_delete_own"
  ON public.courses FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

-- 3. (Optional but good) Ensure ENROLLMENTS also allows manual deletion by students (already exists)
-- This patch just ensures the backend is ready for the "Delete" UI.
