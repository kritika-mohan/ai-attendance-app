-- =============================================================================
-- SMARTCURRICULUM – Supabase Database Schema
-- =============================================================================
-- Run this SQL in your Supabase project's SQL Editor.
-- Navigate to: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- =============================================================================

-- ── Enable UUID extension (needed for gen_random_uuid) ─────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLE: users
-- Stores teacher and student profiles linked to Supabase Auth users.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name      TEXT        NOT NULL,
  email     TEXT        NOT NULL UNIQUE,
  role      TEXT        NOT NULL CHECK (role IN ('teacher', 'student')),
  course    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- =============================================================================
-- TABLE: sessions
-- Each teacher "Start Attendance" click creates one row.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sessions (
  session_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course      TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_teacher  ON public.sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires  ON public.sessions(expires_at);

-- =============================================================================
-- TABLE: attendance
-- One row per (session, student). Duplicate prevention via UNIQUE constraint.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES public.sessions(session_id) ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_id   TEXT        NOT NULL,

  -- Anti-proxy: one mark per student per session
  CONSTRAINT unique_student_session UNIQUE (session_id, student_id),
  -- Anti-proxy: one device per session (same device cannot mark multiple students)
  CONSTRAINT unique_device_session  UNIQUE (session_id, device_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_session ON public.attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance(student_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ── users table policies ───────────────────────────────────────────────────

-- Any authenticated user can read profiles (needed for joins)
CREATE POLICY "users_select_authenticated"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

-- Users can only insert/update their own profile
CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── sessions table policies ────────────────────────────────────────────────

-- Teachers can create sessions
CREATE POLICY "sessions_insert_teacher"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'teacher')
  );

-- All authenticated users can read sessions (students need this to verify)
CREATE POLICY "sessions_select_authenticated"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (true);

-- Teachers can update (refresh expiry on) their own sessions
CREATE POLICY "sessions_update_own_teacher"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid());

-- ── attendance table policies ──────────────────────────────────────────────

-- Authenticated users can read attendance (teachers see all, students see own)
CREATE POLICY "attendance_select"
  ON public.attendance FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.users u ON u.id = auth.uid()
      WHERE s.session_id = attendance.session_id
      AND   u.role = 'teacher'
    )
  );

-- Only the Edge Function (service role) inserts attendance records
-- Students do not insert directly; the edge function validates and inserts.
-- We allow service_role (used by edge functions) to insert:
CREATE POLICY "attendance_insert_service_role"
  ON public.attendance FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =============================================================================
-- REALTIME
-- Enable realtime replication for live dashboard updates
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;

-- =============================================================================
-- SAMPLE DATA (optional – remove before production)
-- =============================================================================
-- Uncomment to insert test data after creating auth users manually:
--
-- INSERT INTO public.users (id, name, email, role, course) VALUES
--   ('<teacher-uuid>', 'Prof. Smith',    'teacher@demo.com', 'teacher', 'Computer Science'),
--   ('<student1-uuid>','Alice Johnson',  'alice@demo.com',   'student', 'Computer Science'),
--   ('<student2-uuid>','Bob Williams',   'bob@demo.com',     'student', 'Computer Science');
