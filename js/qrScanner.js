/**
 * qrScanner.js – QR Code Camera Scanner
 * =======================================
 * Uses html5-qrcode library to access the device camera and decode QR codes.
 * Designed for the student attendance page.
 */

import { submitAttendance } from './attendance.js';
import { showToast }        from './utils.js';

let scanner    = null;
let isScanning = false;
let studentId  = null;

/* ─── Device Fingerprint ────────────────────────────────────────────────────── */

/**
 * Generates a stable pseudo-device ID stored in localStorage.
 * Used for anti-proxy duplicate detection.
 */
function getDeviceId() {
  let id = localStorage.getItem('sc_device_id');
  if (!id) {
    id = 'dev_' + crypto.randomUUID();
    localStorage.setItem('sc_device_id', id);
  }
  return id;
}

/* ─── Scanner Lifecycle ─────────────────────────────────────────────────────── */

/**
 * Initialises the html5-qrcode scanner and starts the camera.
 * @param {string} scanRegionId  - ID of the div to render the video feed into
 * @param {string} sid           - Logged-in student's user ID
 */
export function startScanner(scanRegionId = 'qr-reader', sid) {
  if (isScanning) return;
  studentId = sid;

  scanner = new Html5Qrcode(scanRegionId, { verbose: false });

  const config = {
    fps:            10,
    qrbox:          { width: 250, height: 250 },
    aspectRatio:    1.0,
    disableFlip:    false,
  };

  scanner
    .start(
      { facingMode: 'environment' },  // rear camera preferred
      config,
      onScanSuccess,
      onScanFailure
    )
    .then(() => {
      isScanning = true;
      updateScanBtn(true);
    })
    .catch(err => {
      console.error('[qrScanner] Camera start error:', err);
      // Fallback: try front camera
      scanner.start({ facingMode: 'user' }, config, onScanSuccess, onScanFailure)
        .catch(() => showToast('error', 'Could not access camera. Please allow camera permissions.'));
    });
}

/**
 * Stops the scanner and releases the camera.
 */
export function stopScanner() {
  if (!scanner || !isScanning) return;
  scanner.stop().then(() => {
    isScanning = false;
    updateScanBtn(false);
    document.getElementById('qr-reader').innerHTML = '';
  }).catch(console.error);
}

/* ─── Scan Callbacks ────────────────────────────────────────────────────────── */

/**
 * Called when a valid QR code is decoded.
 */
async function onScanSuccess(decodedText) {
  // Pause scanning to prevent duplicate reads
  stopScanner();

  let payload;
  try {
    payload = JSON.parse(decodedText);
  } catch {
    showScanResult('error', '❌', 'Invalid QR code format.');
    return;
  }

  // Validate required fields
  if (!payload.session_id || !payload.timestamp || !payload.token) {
    showScanResult('error', '❌', 'QR code is malformed.');
    return;
  }

  // Client-side freshness check (< 35 s old)
  const age = Date.now() - payload.timestamp;
  if (age > 35_000) {
    showScanResult('error', '⏱️', 'QR code has expired. Ask your teacher to refresh it.');
    return;
  }

  // Attempt to record attendance
  showScanResult('loading', '⏳', 'Verifying attendance…');

  const result = await submitAttendance({
    sessionId:  payload.session_id,
    timestamp:  payload.timestamp,
    token:      payload.token,
    studentId:  studentId,
    deviceId:   getDeviceId(),
  });

  if (result.success) {
    showScanResult('success', '✅', 'Attendance marked successfully!');
    updateAttendanceStats();
  } else {
    showScanResult('error', '❌', result.message || 'Attendance could not be recorded.');
  }
}

/**
 * Called on each failed frame decode (expected, not an error state).
 */
function onScanFailure(/* err */) {
  // Intentionally silent – occurs on every non-QR frame
}

/* ─── UI Helpers ────────────────────────────────────────────────────────────── */

function updateScanBtn(scanning) {
  const btn = document.getElementById('scan-btn');
  if (!btn) return;
  btn.textContent = scanning ? '⏹ Stop Scanner' : '📷 Scan QR Code';
  btn.classList.toggle('btn-danger',   scanning);
  btn.classList.toggle('btn-primary',  !scanning);
}

function showScanResult(type, icon, message) {
  const el = document.getElementById('scan-result');
  if (!el) return;
  el.className = 'scan-result'; // reset

  el.innerHTML = `
    <div class="scan-result-icon">${icon}</div>
    <div class="scan-result-msg">${message}</div>
  `;

  if (type === 'success') el.classList.add('success');
  if (type === 'error')   el.classList.add('error');
  if (type === 'loading') {
    el.style.display = 'block';
    el.style.background = 'rgba(99,102,241,0.08)';
    el.style.border = '1.5px solid rgba(99,102,241,0.3)';
    el.style.display = 'block';
  }
  el.style.display = 'block';
}

/**
 * Re-fetches and renders updated attendance % for the student.
 * Calls the function defined in student.html's inline script.
 */
function updateAttendanceStats() {
  if (typeof window.refreshStudentStats === 'function') {
    window.refreshStudentStats();
  }
}

export function isScannerActive() { return isScanning; }
