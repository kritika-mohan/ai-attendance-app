-- =============================================================================
-- SMARTCURRICULUM – Slots & Session Enhancement
-- =============================================================================
-- This script adds "Slot" support to sessions for better scheduling.
-- =============================================================================

-- 1. Add slot column to sessions
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS slot TEXT DEFAULT 'General';

-- 2. Optional: Add common slots check or leave it free-text
-- For now, we'll use free-text so teachers can name them "9 AM", "Period 1", etc.

-- 3. Update the view/indexes if needed
CREATE INDEX IF NOT EXISTS idx_sessions_slot ON public.sessions(slot);

-- =============================================================================
-- IMPORTANT: Run this in the Supabase Dashboard → SQL Editor
-- =============================================================================
