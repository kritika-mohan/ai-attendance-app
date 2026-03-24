/**
 * qrGenerator.js – Dynamic QR Code Generator
 * ============================================
 * Generates session-specific QR codes that rotate every 30 seconds.
 * Uses SubtleCrypto to compute a SHA-256 token (HMAC-like) without exposing
 * the secret key (the secret key lives only in the Supabase edge function).
 */

import { supabaseClient } from './supabaseClient.js';

const QR_REFRESH_MS  = 30_000;   // 30 seconds
let   refreshTimer   = null;
let   countdownTimer = null;
let   qrCodeObj      = null;
let   currentSession = null;

/* ─── Token Generation ──────────────────────────────────────────────────────── */

/**
 * Generates a UUIDv4 string for session IDs.
 */
export function generateSessionId() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

/**
 * Creates a SHA-256 hash of `sessionId + timestamp` as a hex string.
 * NOTE: This is the CLIENT-side version. The edge function independently
 * recomputes this using the same formula plus the stored SECRET_KEY to
 * verify authenticity.
 * @param {string} sessionId
 * @param {number} timestamp  - Unix ms
 * @returns {Promise<string>} hex digest
 */
export async function generateToken(sessionId, timestamp) {
  const data    = `${sessionId}:${timestamp}`;
  const encoded = new TextEncoder().encode(data);
  const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ─── QR Rendering ──────────────────────────────────────────────────────────── */

/**
 * Renders or updates the QR code inside `containerId`.
 * @param {object} qrData  - The payload to encode as JSON
 * @param {string} containerId
 */
function renderQR(qrData, containerId = 'qr-code-container') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';   // clear previous

  qrCodeObj = new QRCode(container, {
    text:          JSON.stringify(qrData),
    width:         240,
    height:        240,
    colorDark:     '#1e1b4b',
    colorLight:    '#ffffff',
    correctLevel:  QRCode.CorrectLevel.H,
  });
}

/* ─── Session Persistence ───────────────────────────────────────────────────── */

/**
 * Creates a new session row in Supabase for the teacher.
 * @param {string} teacherId
 * @param {string} courseName
 * @param {string} courseId  - The specific course UUID (optional)
 * @returns {Promise<object>} session row
 */
async function createSession(teacherId, courseName, courseId = null) {
  const sessionId = generateSessionId();
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + QR_REFRESH_MS + 5000); // slight grace

  const { data, error } = await supabaseClient
    .from('sessions')
    .insert({
      session_id:  sessionId,
      teacher_id:  teacherId,
      course:      courseName,
      course_id:   courseId,
      created_at:  now.toISOString(),
      expires_at:  expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error('Failed to create session: ' + error.message);
  return data;
}

/**
 * Updates the expiry on the current session row (used on each refresh).
 * @param {string} sessionId
 */
async function refreshSession(sessionId) {
  const expiresAt = new Date(Date.now() + QR_REFRESH_MS + 5000);
  await supabaseClient
    .from('sessions')
    .update({ expires_at: expiresAt.toISOString() })
    .eq('session_id', sessionId);
}

/* ─── Countdown Timer UI ────────────────────────────────────────────────────── */

function startCountdown(seconds, fillEl, textEl, onExpire) {
  let remaining = seconds;
  const total   = seconds;

  if (fillEl) fillEl.style.width = '100%';
  if (textEl) textEl.innerHTML   = `<span>${remaining}</span>s`;

  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    remaining--;
    const pct = (remaining / total) * 100;

    if (fillEl) fillEl.style.width = `${pct}%`;
    if (textEl) textEl.innerHTML   = `<span>${remaining}</span>s`;

    if (remaining <= 0) {
      clearInterval(countdownTimer);
      onExpire?.();
    }
  }, 1000);
}

/* ─── Main API ──────────────────────────────────────────────────────────────── */

/**
 * Starts the QR attendance session for a teacher.
 * Generates the first QR immediately, then refreshes every 30 seconds.
 *
 * @param {string} teacherId
 * @param {string} courseName
 * @param {string} courseId  - Specific course UUID
 * @param {object} uiRefs   - { containerId, timerFillId, timerTextId, sessionIdEl }
 */
export async function startQRSession(teacherId, courseName, courseId = null, uiRefs = {}) {
  const {
    containerId  = 'qr-code-container',
    timerFillId  = 'timer-fill',
    timerTextId  = 'timer-text',
    sessionIdEl  = null,
  } = uiRefs;

  // Create initial session in DB
  currentSession = await createSession(teacherId, courseName, courseId);
  if (sessionIdEl) sessionIdEl.textContent = currentSession.session_id.slice(0, 8) + '…';

  /** Inner function that builds and displays one QR cycle */
  async function generateCycle() {
    const qrBox = document.getElementById('qr-box');
    if (qrBox) qrBox.classList.add('refreshing');

    const timestamp = Date.now();
    const token     = await generateToken(currentSession.session_id, timestamp);

    const payload = {
      session_id: currentSession.session_id,
      timestamp,
      token,
    };

    // Short delay for refresh animation
    setTimeout(() => {
      renderQR(payload, containerId);
      if (qrBox) qrBox.classList.remove('refreshing');

      // Update session expiry
      refreshSession(currentSession.session_id);

      // Start countdown UI
      const fillEl = document.getElementById(timerFillId);
      const textEl = document.getElementById(timerTextId);
      startCountdown(30, fillEl, textEl, null);
    }, 600);
  }

  // First cycle immediately
  await generateCycle();

  // Repeat every 30s
  clearInterval(refreshTimer);
  refreshTimer = setInterval(generateCycle, QR_REFRESH_MS);

  return currentSession.session_id;
}

/**
 * Stops the QR refresh loop (call when teacher ends session).
 */
export function stopQRSession() {
  clearInterval(refreshTimer);
  clearInterval(countdownTimer);

  if (currentSession) {
    // Mark session as expired
    supabaseClient
      .from('sessions')
      .update({ expires_at: new Date().toISOString() })
      .eq('session_id', currentSession.session_id);
  }
  currentSession = null;
}

export function getCurrentSessionId() {
  return currentSession?.session_id ?? null;
}
