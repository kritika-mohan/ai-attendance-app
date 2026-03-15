/**
 * attendance.js – Attendance Recording & Retrieval
 * =================================================
 * Submits attendance to the Supabase Edge Function for server-side
 * token validation, and fetches attendance records for dashboards.
 */

import { supabaseClient } from './supabaseClient.js';

/* ─── Submit Attendance ─────────────────────────────────────────────────────── */

/**
 * Calls the `verify-token` Supabase Edge Function.
 * The edge function validates the token + timestamp + device uniqueness
 * and inserts the attendance record if everything passes.
 *
 * @param {object} params
 * @param {string} params.sessionId
 * @param {number} params.timestamp
 * @param {string} params.token
 * @param {string} params.studentId
 * @param {string} params.deviceId
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function submitAttendance({ sessionId, timestamp, token, studentId, deviceId }) {
  try {
    // Get current session JWT for authorization headers
    const { data: { session } } = await supabaseClient.auth.getSession();

    const response = await supabaseClient.functions.invoke('verify-token', {
      body: { session_id: sessionId, timestamp, token, student_id: studentId, device_id: deviceId },
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    });

    if (response.error) {
      return { success: false, message: response.error.message };
    }

    const body = response.data;
    return {
      success: body?.success === true,
      message: body?.message || 'Unknown response from server.',
    };
  } catch (err) {
    console.error('[attendance] submitAttendance error:', err);
    return { success: false, message: 'Network error. Please try again.' };
  }
}

/* ─── Teacher: Session Attendance ───────────────────────────────────────────── */

/**
 * Fetches all attendance records for a specific session, joined with user info.
 * @param {string} sessionId
 * @returns {Promise<Array>}
 */
export async function getSessionAttendance(sessionId) {
  const { data, error } = await supabaseClient
    .from('attendance')
    .select(`
      id,
      timestamp,
      device_id,
      student_id,
      users:student_id ( name, email, course )
    `)
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('[attendance] getSessionAttendance:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Fetches all sessions created by a teacher, with attendance counts.
 * @param {string} teacherId
 * @returns {Promise<Array>}
 */
export async function getTeacherSessions(teacherId) {
  const { data, error } = await supabaseClient
    .from('sessions')
    .select(`
      session_id,
      course,
      created_at,
      expires_at
    `)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[attendance] getTeacherSessions:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Gets all attendance across all sessions for a teacher's students,
 * grouped by student. Used for the dashboard analytics.
 * @param {string} teacherId
 * @returns {Promise<Array>}
 */
export async function getTeacherAttendanceSummary(teacherId) {
  // Get all sessions for this teacher
  const sessions = await getTeacherSessions(teacherId);
  if (!sessions.length) return [];

  const sessionIds = sessions.map(s => s.session_id);

  // Get all attendance rows for those sessions
  const { data: records, error } = await supabaseClient
    .from('attendance')
    .select(`
      session_id,
      student_id,
      timestamp,
      users:student_id ( name, email, course )
    `)
    .in('session_id', sessionIds);

  if (error) {
    console.error('[attendance] getTeacherAttendanceSummary:', error.message);
    return [];
  }

  // Get all enrolled students (same course)
  const { data: allStudents } = await supabaseClient
    .from('users')
    .select('id, name, email, course')
    .eq('role', 'student');

  // Build summary map
  const totalSessions = sessions.length;
  const studentMap    = {};

  (allStudents ?? []).forEach(s => {
    studentMap[s.id] = {
      id:        s.id,
      name:      s.name,
      email:     s.email,
      course:    s.course,
      present:   0,
      total:     totalSessions,
      pct:       0,
    };
  });

  (records ?? []).forEach(r => {
    if (studentMap[r.student_id]) {
      studentMap[r.student_id].present++;
    }
  });

  return Object.values(studentMap).map(s => ({
    ...s,
    pct: totalSessions > 0 ? Math.round((s.present / totalSessions) * 100) : 0,
  }));
}

/* ─── Student: Attendance History ───────────────────────────────────────────── */

/**
 * Fetches all attendance records for a specific student.
 * @param {string} studentId
 * @returns {Promise<Array>}
 */
export async function getStudentAttendance(studentId) {
  const { data, error } = await supabaseClient
    .from('attendance')
    .select(`
      id,
      timestamp,
      session_id,
      sessions:session_id ( course, created_at )
    `)
    .eq('student_id', studentId)
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('[attendance] getStudentAttendance:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Calculates attendance percentage for a student across all sessions.
 * @param {string} studentId
 * @returns {Promise<{present: number, total: number, pct: number}>}
 */
export async function getStudentAttendanceStats(studentId) {
  // Total sessions ever created
  const { count: totalSessions } = await supabaseClient
    .from('sessions')
    .select('session_id', { count: 'exact', head: true });

  const records = await getStudentAttendance(studentId);

  const present = records.length;
  const total   = totalSessions ?? 0;
  const pct     = total > 0 ? Math.round((present / total) * 100) : 0;

  return { present, total, pct };
}

/* ─── Export CSV ────────────────────────────────────────────────────────────── */

/**
 * Converts an array of attendance rows into a CSV string and triggers download.
 * @param {Array}  rows
 * @param {string} filename
 */
export function exportCSV(rows, filename = 'attendance.csv') {
  if (!rows.length) return;

  const headers = ['Student Name', 'Email', 'Course', 'Present Sessions', 'Total Sessions', 'Attendance %'];
  const csvRows = [
    headers.join(','),
    ...rows.map(r =>
      [r.name, r.email, r.course, r.present, r.total, r.pct + '%'].join(',')
    ),
  ];

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
