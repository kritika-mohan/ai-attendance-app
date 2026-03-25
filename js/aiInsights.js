/**
 * aiInsights.js – OpenRouter AI Integration
 * ==========================================
 * Sends attendance data to OpenRouter (gpt-3.5-turbo) and returns
 * rich, actionable insights for the teacher dashboard.
 */

import { CONFIG } from '../config.js';

/* ─── Main Export ───────────────────────────────────────────────────────────── */

/**
 * Generates AI-powered attendance insights using OpenRouter API.
 *
 * @param {Array} attendanceSummary  - Array of { name, email, course, present, total, pct }
 * @returns {Promise<string>}        - Plain-text insights from the model
 */
export async function generateInsights(attendanceSummary) {
  const prompt = buildPrompt(attendanceSummary);

  const response = await fetch(CONFIG.INSIGHTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: `You are an intelligent academic analytics assistant for ${CONFIG.APP_NAME}.
Your job is to analyze student attendance data and provide concise, actionable insights.
DO NOT use markdown formatting like **bold** or ## headers.
Format your response in plain text with clear numbered sections:
1. 📊 Overview – Brief summary of overall attendance health
2. ⚠️ At-Risk Students – Students below 75% with specific recommendations
3. 📈 Trends & Observations – Notable patterns in the data
4. 💡 Recommendations – Concrete actions for the teacher
Keep your response under 400 words and use emojis to make it scannable.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`AI Service error ${response.status}: ${errBody}`);
  }

  const data    = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) throw new Error('Empty response from AI model.');
  return content;
}

/* ─── Prompt Builder ────────────────────────────────────────────────────────── */

/**
 * Constructs the user prompt from the attendance summary array.
 */
function buildPrompt(summary) {
  if (!summary.length) {
    return 'There is no attendance data yet. Please advise the teacher on how to get started.';
  }

  const total    = summary.length;
  const atRisk   = summary.filter(s => s.pct < 75);
  const perfect  = summary.filter(s => s.pct === 100);
  const avgPct   = Math.round(summary.reduce((a, s) => a + s.pct, 0) / total);

  const rows = summary
    .sort((a, b) => a.pct - b.pct)
    .map(s => `  - ${s.name} (${s.course}): ${s.present}/${s.total} sessions = ${s.pct}%`)
    .join('\n');

  return `
Analyze this attendance dataset and identify at-risk students:

**Class Summary:**
- Total Students:      ${total}
- Average Attendance:  ${avgPct}%
- At-Risk (< 75%):     ${atRisk.length} students
- Perfect Attendance:  ${perfect.length} students

**Individual Records:**
${rows}

Provide insights, identify at-risk students, and suggest interventions.
  `.trim();
}
