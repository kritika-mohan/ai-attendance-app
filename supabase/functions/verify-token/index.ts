// =============================================================================
// Supabase Edge Function: verify-token
// Path: supabase/functions/verify-token/index.ts
// =============================================================================
// This Deno function runs on Supabase's edge infrastructure.
// It validates the QR token, checks timestamp, prevents duplicates,
// and inserts the attendance record using the service role key.
//
// Deploy with: supabase functions deploy verify-token
// =============================================================================

import { serve }        from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Environment Variables ────────────────────────────────────────────────────
// Set these in Supabase Dashboard → Edge Functions → Environment Variables
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET_KEY           = Deno.env.get("QR_SECRET_KEY")!;   // NEVER expose this key
const QR_WINDOW_MS         = 35_000; // 35 seconds tolerance

// ── CORS Headers ─────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── SHA-256 Helper ────────────────────────────────────────────────────────────
/**
 * Computes SHA-256 of `sessionId:timestamp:secretKey` and returns hex string.
 * This MUST match the formula used in qrGenerator.js (client side), except
 * here we also include the secret key for authentication.
 */
async function computeExpectedToken(sessionId: string, timestamp: number): Promise<string> {
  const data    = `${sessionId}:${timestamp}:${SECRET_KEY}`;
  const encoded = new TextEncoder().encode(data);
  const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Main Handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond(405, { success: false, message: "Method not allowed." });
  }

  let body: {
    session_id: string;
    timestamp:  number;
    token:      string;
    student_id: string;
    device_id:  string;
  };

  try {
    body = await req.json();
  } catch {
    return respond(400, { success: false, message: "Invalid JSON body." });
  }

  const { session_id, timestamp, token, student_id, device_id } = body;

  // ── 1. Validate all required fields ─────────────────────────────────────────
  if (!session_id || !timestamp || !token || !student_id || !device_id) {
    return respond(400, { success: false, message: "Missing required fields." });
  }

  // ── 2. Timestamp window check (prevent replay attacks) ──────────────────────
  const age = Date.now() - timestamp;
  if (age < 0 || age > QR_WINDOW_MS) {
    return respond(400, {
      success: false,
      message: `QR code expired (age: ${Math.round(age / 1000)}s). Ask your teacher to refresh it.`,
    });
  }

  // ── 3. Token validation ──────────────────────────────────────────────────────
  const expectedToken = await computeExpectedToken(session_id, timestamp);
  if (token !== expectedToken) {
    return respond(401, { success: false, message: "Invalid QR token. Possible forgery attempt." });
  }

  // ── 4. Database operations (using service role key) ──────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 4a. Verify session exists and is still valid
  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("session_id, expires_at, teacher_id")
    .eq("session_id", session_id)
    .single();

  if (sessionErr || !session) {
    return respond(404, { success: false, message: "Session not found." });
  }

  if (new Date(session.expires_at) < new Date()) {
    return respond(400, { success: false, message: "Session has expired." });
  }

  // 4b. Check for duplicate student attendance (same student, same session)
  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("session_id", session_id)
    .eq("student_id", student_id)
    .maybeSingle();

  if (existing) {
    return respond(409, {
      success: false,
      message: "Attendance already recorded for this session.",
    });
  }

  // 4c. Check for device collision (same device marking different student)
  const { data: deviceConflict } = await supabase
    .from("attendance")
    .select("id")
    .eq("session_id", session_id)
    .eq("device_id", device_id)
    .maybeSingle();

  if (deviceConflict) {
    return respond(409, {
      success: false,
      message: "This device has already been used to mark attendance in this session.",
    });
  }

  // 4d. Insert attendance record
  const { error: insertErr } = await supabase
    .from("attendance")
    .insert({
      session_id,
      student_id,
      timestamp: new Date(timestamp).toISOString(),
      device_id,
    });

  if (insertErr) {
    // Handle unique constraint violations gracefully
    if (insertErr.code === "23505") {
      return respond(409, { success: false, message: "Attendance already recorded." });
    }
    console.error("[verify-token] Insert error:", insertErr.message);
    return respond(500, { success: false, message: "Database error. Please try again." });
  }

  return respond(200, { success: true, message: "Attendance recorded successfully!" });
});

// ── Response helper ───────────────────────────────────────────────────────────
function respond(status: number, body: object) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
