/**
 * dashboard.js – Analytics Dashboard
 * =====================================
 * Renders Chart.js charts and the attendance table for the teacher dashboard.
 * Also handles CSV export and real-time session subscription.
 */

import { supabaseClient }         from './supabaseClient.js';
import { getTeacherAttendanceSummary, exportCSV } from './attendance.js';
import { generateInsights }       from './aiInsights.js';

let barChart      = null;
let doughnutChart = null;
let tableRows     = [];
let realtimeSub   = null;

/* ─── Chart Defaults ────────────────────────────────────────────────────────── */

const CHART_DEFAULTS = {
  font:        { family: 'Inter', size: 13 },
  gridColor:   'rgba(255,255,255,0.06)',
  tickColor:   '#64748b',
};

/* ─── Main Init ─────────────────────────────────────────────────────────────── */

/**
 * Initialises the dashboard for a teacher.
 * @param {string} teacherId
 * @param {string} latestSessionId  - The most recently started session
 * @param {string} courseId         - Filter by a specific course (optional)
 */
export async function initDashboard(teacherId, latestSessionId, courseId = null) {
  showLoading(true);

  const summary = await getTeacherAttendanceSummary(teacherId, courseId);
  tableRows = summary;

  renderStatCards(summary);
  renderBarChart(summary);
  renderDoughnutChart(summary);
  renderTable(summary);

  if (latestSessionId) {
    subscribeRealtime(teacherId, latestSessionId);
  }

  showLoading(false);

  // Wire up buttons
  document.getElementById('export-csv-btn')?.addEventListener('click', () => {
    exportCSV(tableRows, 'smartcurriculum_attendance.csv');
  });

  document.getElementById('ai-insights-btn')?.addEventListener('click', async () => {
    await runAiInsights(summary);
  });
}

/* ─── Stat Cards ────────────────────────────────────────────────────────────── */

function renderStatCards(summary) {
  const total   = summary.length;
  const present = summary.filter(s => s.present > 0).length;
  const absent  = total - present;
  const avgPct  = total > 0 ? Math.round(summary.reduce((a, s) => a + s.pct, 0) / total) : 0;

  setText('stat-total',   total);
  setText('stat-present', present);
  setText('stat-absent',  absent);
  setText('stat-avg-pct', avgPct + '%');
}

/* ─── Bar Chart – Attendance % per Student ──────────────────────────────────── */

function renderBarChart(summary) {
  const canvas = document.getElementById('bar-chart');
  if (!canvas) return;

  if (barChart) barChart.destroy();

  const labels = summary.map(s => s.name.split(' ')[0]);  // first name only
  const data   = summary.map(s => s.pct);
  const colors = data.map(pct =>
    pct >= 75 ? 'rgba(16,185,129,0.75)' : 'rgba(239,68,68,0.75)'
  );

  barChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label:           'Attendance %',
        data,
        backgroundColor: colors,
        borderColor:     colors.map(c => c.replace('0.75', '1')),
        borderWidth:     1,
        borderRadius:    6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.parsed.y}% attendance`,
            afterLabel: ctx => {
              const s = summary[ctx.dataIndex];
              return `${s.present}/${s.total} sessions`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks:  { color: CHART_DEFAULTS.tickColor, font: CHART_DEFAULTS.font },
          grid:   { color: CHART_DEFAULTS.gridColor },
        },
        y: {
          beginAtZero: true,
          max:         100,
          ticks: {
            color:    CHART_DEFAULTS.tickColor,
            font:     CHART_DEFAULTS.font,
            callback: v => v + '%',
          },
          grid: { color: CHART_DEFAULTS.gridColor },
        },
      },
    },
  });
}

/* ─── Doughnut Chart – Present vs Absent ────────────────────────────────────── */

function renderDoughnutChart(summary) {
  const canvas = document.getElementById('doughnut-chart');
  if (!canvas) return;

  if (doughnutChart) doughnutChart.destroy();

  const present = summary.filter(s => s.present > 0).length;
  const absent  = summary.length - present;

  doughnutChart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels:   ['Present', 'Absent'],
      datasets: [{
        data:            [present, absent],
        backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(239,68,68,0.8)'],
        borderColor:     ['#10b981', '#ef4444'],
        borderWidth:     2,
        hoverOffset:     6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels:   { color: CHART_DEFAULTS.tickColor, padding: 16, font: CHART_DEFAULTS.font },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} students`,
          },
        },
      },
    },
  });
}

/* ─── Attendance Table ──────────────────────────────────────────────────────── */

function renderTable(summary) {
  const tbody = document.getElementById('attendance-tbody');
  if (!tbody) return;

  if (!summary.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">No attendance data yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = summary.map(s => `
    <tr>
      <td><strong>${escHtml(s.name)}</strong></td>
      <td>${escHtml(s.email)}</td>
      <td>${escHtml(s.course)}</td>
      <td>${s.present}/${s.total}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="progress-bar" style="flex:1">
            <div class="progress-fill ${s.pct < 75 ? 'danger' : ''}" style="width:${s.pct}%"></div>
          </div>
          <span class="badge ${s.pct >= 75 ? 'badge-success' : 'badge-danger'}">${s.pct}%</span>
        </div>
      </td>
    </tr>
  `).join('');
}

/* ─── Realtime Subscription ─────────────────────────────────────────────────── */

/**
 * Subscribes to real-time INSERT events on the attendance table for the
 * current session. Updates the "Present" stat card live without page reload.
 * @param {string} teacherId
 * @param {string} sessionId
 */
function subscribeRealtime(teacherId, sessionId) {
  if (realtimeSub) {
    supabaseClient.removeChannel(realtimeSub);
  }

  realtimeSub = supabaseClient
    .channel(`attendance:${sessionId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'attendance', filter: `session_id=eq.${sessionId}` },
      async () => {
        // Refresh the full summary
        const summary = await getTeacherAttendanceSummary(teacherId, courseId);
        tableRows = summary;
        renderStatCards(summary);
        renderBarChart(summary);
        renderDoughnutChart(summary);
        renderTable(summary);
      }
    )
    .subscribe();
}

/* ─── AI Insights ────────────────────────────────────────────────────────────── */

async function runAiInsights(summary) {
  const btn     = document.getElementById('ai-insights-btn');
  const content = document.getElementById('ai-content');
  if (!content) return;

  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Generating…'; }
  content.className = 'ai-content ai-typing';
  content.textContent = '';

  try {
    const insights = await generateInsights(summary);
    content.className = 'ai-content';
    content.textContent = insights;
  } catch (err) {
    content.className = 'ai-content empty';
    content.textContent = 'Failed to generate insights. Check your OPENROUTER_API_KEY in config.js.';
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '✨ Generate Insights'; }
  }
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showLoading(on) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.toggle('hidden', !on);
}
