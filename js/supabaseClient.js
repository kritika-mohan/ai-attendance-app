/**
 * supabaseClient.js – Supabase JS v2 Client Singleton
 * =====================================================
 * Exports a single shared Supabase client instance used across all modules.
 */

import { CONFIG } from '../config.js';

// Use the CDN-loaded Supabase global (loaded via script tag in each HTML page)
const { createClient } = supabase;

if (!CONFIG.SUPABASE_URL || CONFIG.SUPABASE_URL === 'YOUR_SUPABASE_URL') {
  console.error(
    '[SMARTCURRICULUM] ⚠️  Supabase URL not configured. ' +
    'Please edit config.js and add your SUPABASE_URL.'
  );
}

/**
 * The shared Supabase client.
 * All database queries, auth calls, and realtime subscriptions use this instance.
 */
export const supabaseClient = createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession:   true,
      detectSessionInUrl: true,
    },
  }
);
