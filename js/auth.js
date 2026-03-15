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
  const profile = await getUserProfile(session.user.id);
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
    .single();

  if (error) {
    console.error('[auth] getUserProfile error:', error.message);
    return null;
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
  const profile = await getUserProfile(data.user.id);
  if (!profile) throw new Error('User profile not found. Please contact support.');

  // Redirect based on role
  redirectByRole(profile.role);
  return profile;
}

/* ─── Register ──────────────────────────────────────────────────────────────── */

/**
 * Creates a new Supabase auth user and inserts their profile row.
 * @param {object} params
 */
export async function registerUser({ name, email, password, role, course }) {
  // 1. Create auth user
  const { data, error } = await supabaseClient.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { name, role } },
  });

  if (error) throw new Error(error.message);

  const userId = data.user?.id;
  if (!userId) throw new Error('Registration failed – no user ID returned.');

  // 2. Insert into public users table
  const { error: profileError } = await supabaseClient
    .from('users')
    .insert({
      id:     userId,
      name:   name.trim(),
      email:  email.trim().toLowerCase(),
      role:   role.toLowerCase(),
      course: course.trim(),
    });

  if (profileError) throw new Error(profileError.message);

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
