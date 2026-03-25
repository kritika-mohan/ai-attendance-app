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
    // 1. Client-side freshness check (35-second window)
    const age = Date.now() - timestamp;
    if (age > 35_000) {
      return { success: false, message: 'QR code has expired. Ask your teacher to refresh it.' };
    }

    // 2. Verify the session exists and is not expired
    const { data: session, error: sessErr } = await supabaseClient
      .from('sessions')
      .select('session_id, expires_at, course_id')
      .eq('session_id', sessionId)
      .single();

    if (sessErr || !session) {
      return { success: false, message: 'Session not found. Ask your teacher to restart.' };
    }
    if (new Date(session.expires_at) < new Date()) {
      return { success: false, message: 'This session has expired. Ask your teacher to start a new one.' };
    }

    // 2.5 Check enrollment if it's a course-specific session
    if (session.course_id) {
      const { data: enrollment, error: enrollErr } = await supabaseClient
        .from('enrollments')
        .select('id')
        .eq('course_id', session.course_id)
        .eq('student_id', studentId)
        .maybeSingle();

      if (enrollErr || !enrollment) {
        return { 
          success: false, 
          message: 'You are not enrolled in this course. Please join the course using the code provided by your teacher first.' 
        };
      }
    }

    // 3. Insert attendance record (DB UNIQUE constraint prevents duplicates)
    const { error: insertErr } = await supabaseClient
      .from('attendance')
      .insert({
        session_id: sessionId,
        student_id: studentId,
        device_id:  deviceId,
        timestamp:  new Date().toISOString(),
      });

    if (insertErr) {
      // Unique constraint violation = already marked
      if (insertErr.code === '23505') {
        return { success: false, message: 'Attendance already marked for this session.' };
      }
      return { success: false, message: insertErr.message };
    }

    return { success: true, message: 'Attendance recorded successfully!' };
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
 * optionally filtered by a specific course.
 * @param {string} teacherId
 * @param {string} courseId  - Specific course UUID (optional)
 * @returns {Promise<Array>}
 */
export async function getTeacherAttendanceSummary(teacherId, courseId = null) {
  // Get all sessions for this teacher/course
  let query = supabaseClient.from('sessions').select('session_id').eq('teacher_id', teacherId);
  if (courseId) query = query.eq('course_id', courseId);

  const { data: sessions, error: sessErr } = await query;
  if (sessErr || !sessions.length) return [];

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

  // Get all enrolled students for this course (or all if none)
  let allStudents = [];
  let studentQuery = supabaseClient.from('users').select('id, name, email, course').eq('role', 'student');
  if (courseId) {
    const { data: enrolledStudents } = await supabaseClient
      .from('enrollments')
      .select('student_id, users:student_id ( id, name, email, course )')
      .eq('course_id', courseId);
    allStudents = (enrolledStudents ?? []).map(e => e.users);
  } else {
    const { data: all } = await studentQuery;
    allStudents = all ?? [];
  }

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
 * Calculates attendance percentage for a student, optionally filtered by course.
 * @param {string} studentId
 * @param {string} courseId  - Specific course UUID (optional)
 * @returns {Promise<{present: number, total: number, pct: number}>}
 */
export async function getStudentAttendanceStats(studentId, courseId = null) {
  // Total sessions created
  let totalQuery = supabaseClient.from('sessions').select('session_id', { count: 'exact', head: true });
  if (courseId) totalQuery = totalQuery.eq('course_id', courseId);
  const { count: totalSessions } = await totalQuery;

  const records = await getStudentAttendance(studentId);

  const present = records.length;
  const total   = totalSessions ?? 0;
  const pct     = total > 0 ? Math.round((present / total) * 100) : 0;

  return { present, total, pct };
}

/**
 * Generates a matrix of [Student] x [Session Date/Slot] for a detailed report.
 * Returns { sessions: Array, students: Array }
 * @param {string} courseId
 */
export async function getDetailedAttendanceReport(courseId) {
  // 1. Get all sessions for this course
  const { data: sessions, error: sessErr } = await supabaseClient
    .from('sessions')
    .select('session_id, created_at, slot')
    .eq('course_id', courseId)
    .order('created_at', { ascending: true });

  if (sessErr) throw sessErr;
  if (!sessions?.length) return { sessions: [], students: [] };

  // 2. Get all enrolled students
  const { data: enrolledStudents, error: enrollErr } = await supabaseClient
    .from('enrollments')
    .select('student_id, users:student_id ( id, name, email )')
    .eq('course_id', courseId);

  if (enrollErr) throw enrollErr;

  const students = (enrolledStudents ?? []).map(e => e.users);

  // 3. Get all attendance for these sessions
  const sessionIds = sessions.map(s => s.session_id);
  const { data: attendance, error: attErr } = await supabaseClient
    .from('attendance')
    .select('session_id, student_id')
    .in('session_id', sessionIds);

  if (attErr) throw attErr;

  // 4. Build lookup map
  const attendanceMap = {}; // "studentId:sessionId" -> true
  (attendance ?? []).forEach(a => {
    attendanceMap[`${a.student_id}:${a.session_id}`] = true;
  });

  // 5. Structure the rows
  const rows = students.map(s => {
    const sessionStatus = sessions.map(sess => ({
      sessionId: sess.session_id,
      present:   !!attendanceMap[`${s.id}:${sess.session_id}`]
    }));
    return {
      id:      s.id,
      name:    s.name,
      email:   s.email,
      history: sessionStatus
    };
  });

  return { sessions, students: rows };
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
