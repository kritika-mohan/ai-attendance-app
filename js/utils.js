/**
 * utils.js – Shared UI Utilities
 * ================================
 * Toast notifications, loading states, and helper functions
 * used across all pages.
 */

/* ─── Toast Notifications ───────────────────────────────────────────────────── */

/**
 * Displays a toast notification.
 * @param {'success'|'error'|'info'} type
 * @param {string} message
 * @param {number} duration  - ms before auto-dismiss (default 4000)
 */
export function showToast(type, message, duration = 4000) {
  ensureToastContainer();
  const container = document.getElementById('toast-container');

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  const toast    = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-msg">${message}</span>
    <span class="toast-close" onclick="this.parentElement.remove()">✕</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

function ensureToastContainer() {
  if (!document.getElementById('toast-container')) {
    const el       = document.createElement('div');
    el.id          = 'toast-container';
    document.body.appendChild(el);
  }
}

/* ─── Theme Toggle ──────────────────────────────────────────────────────────── */

/**
 * Initialises the dark/light theme toggle button.
 * @param {string} btnId  - ID of the toggle button element
 */
export function initThemeToggle(btnId = 'theme-toggle') {
  const saved = localStorage.getItem('sc_theme') || 'dark';
  applyTheme(saved);

  const btn = document.getElementById(btnId);
  if (!btn) return;

  btn.textContent = saved === 'dark' ? '☀️' : '🌙';
  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next    = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    btn.textContent = next === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('sc_theme', next);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/* ─── Loading State ─────────────────────────────────────────────────────────── */

/**
 * Shows or hides the full-page loading overlay.
 * @param {boolean} on
 * @param {string}  message
 */
export function setLoading(on, message = 'Loading…') {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay && on) {
    overlay = document.createElement('div');
    overlay.id        = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loader"></div>
      <p class="loading-text" id="loading-text">${message}</p>
    `;
    document.body.appendChild(overlay);
  }
  if (overlay) {
    overlay.classList.toggle('hidden', !on);
    const txt = overlay.querySelector('#loading-text');
    if (txt) txt.textContent = message;
  }
}

/* ─── Date Formatting ───────────────────────────────────────────────────────── */

/**
 * Formats an ISO timestamp into a human-readable string.
 * @param {string|number} ts
 * @returns {string}
 */
export function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a date to just the date part.
 * @param {string|number} ts
 */
export function formatDateShort(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/* ─── HTML Escape ───────────────────────────────────────────────────────────── */

export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─── Debounce ──────────────────────────────────────────────────────────────── */

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
