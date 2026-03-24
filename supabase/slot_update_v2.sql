-- =============================================================================
-- SMARTCURRICULUM – Course Slots & RLS Fix
-- =============================================================================
-- 1. Move "slot" from session to course definition.
-- 2. Fix 403 Forbidden errors by ensuring users are correctly synced.
-- =============================================================================

-- ── 1. Update courses table ────────────────────────────────────────────────
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS slot TEXT DEFAULT 'General';

-- ── 2. Massive RLS fix for access issues ───────────────────────────────────

-- Re-enable RLS firmly
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- DROP old restrictive policies
DROP POLICY IF EXISTS "courses_select_authenticated" ON public.courses;
DROP POLICY IF EXISTS "users_select_authenticated"   ON public.users;

-- Ensure anyone AUTHENTICATED can read profiles and courses
-- (Crucial for join codes and enrollment checks)
CREATE POLICY "courses_select_permissive"
  ON public.courses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users_select_permissive"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

-- Ensure users can INSERT their own profile if the trigger fails
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_permissive"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ── 3. Handle legacy sessions ──────────────────────────────────────────────
-- (Optional) If you already had sessions with slot info, it will still be there.
-- New sessions will now use the course's slot instead.

-- =============================================================================
-- IMPORTANT: Run this in the Supabase Dashboard → SQL Editor
-- =============================================================================
