/**
 * auth.js – Authentication Module
 * ================================
 * Handles Supabase Auth sign-in, sign-up, sign-out, and route guards.
 */

import { supabaseClient } from './supabaseClient.js';
import { showToast } from './utils.js';

/* ─── Route Guards ──────────────────────────────────────────────────────────── */

/**
 * Verifies the user is logged in; if not, redirects to login.html.
 * @returns {Promise<{user, profile}>} The authenticated user and their profile.
 */
export async function requireAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }

  let profile = await getUserProfile(session.user.id);

  // Fallback: If profile row is missing, use auth metadata
  if (!profile) {
    console.warn('[auth] Profile missing in requireAuth. Using metadata fallback.');
    const meta = session.user.user_metadata || {};
    profile = {
      id:     session.user.id,
      name:   meta.name || 'User',
      role:   meta.role || 'student',
      course: meta.course || 'General'
    };
  }

  return { user: session.user, profile };
}

/**
 * Verifies the user has a specific role; redirects otherwise.
 * @param {string} requiredRole - 'teacher' or 'student'
 */
export async function requireRole(requiredRole) {
  const auth = await requireAuth();
  if (!auth) return null;

  if (auth.profile?.role !== requiredRole) {
    // Wrong role – send to their own page
    window.location.href = auth.profile?.role === 'teacher'
      ? 'teacher.html'
      : 'student.html';
    return null;
  }
  return auth;
}

/* ─── User Profile ──────────────────────────────────────────────────────────── */

/**
 * Fetches the user's profile row from the `users` table.
 * @param {string} userId
 */
export async function getUserProfile(userId) {
  const { data, error } = await supabaseClient
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle(); // Returns null safely if 0 rows found

  if (error) {
    console.error('[auth] getUserProfile error:', error.message);
    throw error;
  }
  return data;
}

/* ─── Login ─────────────────────────────────────────────────────────────────── */

/**
 * Signs in an existing user and redirects based on their role.
 * @param {string} email
 * @param {string} password
 */
export async function loginUser(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw new Error(error.message);

  // Fetch profile to determine role
  let profile = null;
  try {
    profile = await getUserProfile(data.user.id);
  } catch (err) {
    console.warn('[auth] Soft error fetching profile:', err.message);
  }

  // Fallback: If profile row is missing, check auth metadata and attempt to create it
  if (!profile) {
    console.info('[auth] Profile missing for user. Restoring from metadata...');
    const meta = data.user.user_metadata || {};
    profile = {
      id:     data.user.id,
      name:   meta.name || 'User',
      role:   meta.role || 'student',
      course: meta.course || 'General'
    };

    // Attempt to re-insert/update profile if it's missing (failsafe)
    // We use .upsert() + ignore errors to ensure the user can still get in
    try {
      const { error: upsError } = await supabaseClient.from('users').upsert(profile);
      if (upsError) console.error('[auth] Upsert failsafe failed:', upsError.message);
      else console.log('[auth] Profile restored/verified successfully.');
    } catch (e) {
      console.error('[auth] Upsert fatal error:', e);
    }
  }

  // Redirect based on role
  redirectByRole(profile.role);
  return profile;
}

/* ─── Register ──────────────────────────────────────────────────────────────── */

/**
 * Creates a new Supabase auth user.
 * Note: Profile creation is handled by a database trigger (auth_trigger.sql).
 * @param {object} params
 */
export async function registerUser({ name, email, password, role, course }) {
  // 1. Create auth user with metadata (metadata is used by the database trigger)
  const { data, error } = await supabaseClient.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { name, role, course }
    },
  });

  if (error) throw new Error(error.message);

  // Return data.user even if session is null (due to email confirmation)
  return data.user;
}

/* ─── Logout ────────────────────────────────────────────────────────────────── */

/**
 * Signs the current user out and redirects to login.
 */
export async function logoutUser() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

function redirectByRole(role) {
  if (role === 'teacher') {
    window.location.href = 'teacher.html';
  } else {
    window.location.href = 'student.html';
  }
}
