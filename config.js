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

  // ── OpenRouter AI ───────────────────────────────────────────────────────────
  // Get your key from: https://openrouter.ai/keys
  OPENROUTER_API_KEY: "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",
  OPENROUTER_MODEL: "openai/gpt-3.5-turbo",
  OPENROUTER_URL: "https://openrouter.ai/api/v1/chat/completions",

  // ── QR Session ──────────────────────────────────────────────────────────────
  QR_REFRESH_SECONDS: 30,   // how often the QR code rotates (seconds)
  QR_WINDOW_SECONDS: 35,   // grace window for token validation

  // ── App ─────────────────────────────────────────────────────────────────────
  APP_NAME: "SMARTCURRICULUM",
  LOW_ATTENDANCE_PCT: 75,  // warn students below this percentage
};
