-- =============================================================================
-- SMARTCURRICULUM – Auth Trigger for Profile Creation
-- =============================================================================
-- This script ensures every new Supabase Auth user automatically gets a row in
-- `public.users`. This solves the issue where non-authenticated users cannot
-- insert their own profile due to RLS policies.
-- =============================================================================

-- 1. Create a function to handle the new user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role, course)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'New User'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    COALESCE(new.raw_user_meta_data->>'course', 'General')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = CASE WHEN excluded.name != 'New User' THEN excluded.name ELSE public.users.name END,
    role = CASE WHEN excluded.role != 'student' THEN excluded.role ELSE public.users.role END,
    course = CASE WHEN excluded.course != 'General' THEN excluded.course ELSE public.users.course END;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =============================================================================
-- IMPORTANT: Run this in the Supabase Dashboard → SQL Editor
-- =============================================================================
