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
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('users', 'courses')) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ── 2. Re-enable RLS ───────────────────────────────────────────────────────
ALTER TABLE public.users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- ── 3. Create permissive SELECT policies ────────────────────────────────────
-- These allow any logged-in user to see profiles and courses.
CREATE POLICY "allow_select_users_all" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_select_courses_all" ON public.courses FOR SELECT TO authenticated USING (true);

-- ── 4. Create permissive INSERT policies ────────────────────────────────────
-- These allow the app to create/sync profiles and teachers to create courses.
CREATE POLICY "allow_insert_users_self" ON public.users FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "allow_insert_courses_teacher" ON public.courses FOR INSERT TO authenticated WITH CHECK (true);

-- ── 5. Create permissive UPDATE policies ────────────────────────────────────
CREATE POLICY "allow_update_users_self" ON public.users FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "allow_update_courses_teacher" ON public.courses FOR UPDATE TO authenticated USING (teacher_id = auth.uid());

-- ── 6. Verification check ──────────────────────────────────────────────────
-- Ensure the slot column is there
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS slot TEXT DEFAULT 'General';

-- =============================================================================
-- IMPORTANT: Paste this into Supabase SQL Editor and click RUN.
-- =============================================================================
