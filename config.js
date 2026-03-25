/**
 * config.js – SMARTCURRICULUM Configuration
 * ==========================================
 * Fill in your API keys before running the application.
 * NEVER commit real keys to version control.
 */

export const CONFIG = {
  // ── Supabase ────────────────────────────────────────────────────────────────
  // Get these from: https://supabase.com → Project Settings → API
  SUPABASE_URL: "https://dlniwkemnkfirgvhjhty.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsbml3a2VtbmtmaXJndmhqaHR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NTA2MjMsImV4cCI6MjA4OTEyNjYyM30.tNxkc2hAIdNnEFWK-_yotGo1WAe3eoLWVLJP1GCDak8",

  // ── AI Insights (Secure) ──────────────────────────────────────────────────
  // The API key is now hidden in Vercel environment variables.
  // The frontend calls a local API route which proxies the request.
  INSIGHTS_ENDPOINT: "/api/insights",

  // ── QR Session ──────────────────────────────────────────────────────────────
  QR_REFRESH_SECONDS: 30,   // how often the QR code rotates (seconds)
  QR_WINDOW_SECONDS: 35,   // grace window for token validation

  // ── App ─────────────────────────────────────────────────────────────────────
  APP_NAME: "SMARTCURRICULUM",
  LOW_ATTENDANCE_PCT: 75,  // warn students below this percentage
};
