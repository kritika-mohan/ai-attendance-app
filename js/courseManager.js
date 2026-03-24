/**
 * courseManager.js – Course Enrollment & Management
 * ==================================================
 * Handles creating courses (for teachers) and joining courses via
 * codes (for students).
 */

import { supabaseClient } from './supabaseClient.js';

/* ─── Join Code Generation ─────────────────────────────────────────────────── */

/**
 * Generates a random, unique alphanumeric join code.
 * (e.g., "A1B2C3")
 */
function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars 0, O, 1, I, S, 5
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/* ─── Teacher: Course Management ───────────────────────────────────────────── */

/**
 * Creates a new course and generates a join code.
 * @param {string} teacherId
 * @param {string} courseName
 * @param {string} slot        - Time slot for this course
 * @returns {Promise<object>} Course record
 */
export async function createCourse(teacherId, courseName, slot = 'General') {
  const joinCode = generateJoinCode();

  const { data, error } = await supabaseClient
    .from('courses')
    .insert({
      teacher_id: teacherId,
      name:       courseName.trim(),
      slot:       slot.trim(),
      join_code:  joinCode,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // Unique constraint violation (code collision)
      return createCourse(teacherId, courseName); // Recurse once
    }
    throw new Error('Failed to create course: ' + error.message);
  }
  return data;
}

/**
 * Fetches all courses created by a teacher.
 * @param {string} teacherId
 */
export async function getTeacherCourses(teacherId) {
  const { data, error } = await supabaseClient
    .from('courses')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/* ─── Student: Enrollment ──────────────────────────────────────────────────── */

/**
 * Enrolls a student in a course using its Join Code.
 * @param {string} studentId
 * @param {string} joinCode
 */
export async function joinCourseByCode(studentId, joinCode) {
  const code = joinCode.trim().toUpperCase();

  // 1. Find the course
  const { data: course, error: findError } = await supabaseClient
    .from('courses')
    .select('id, name')
    .eq('join_code', code)
    .single();

  if (findError || !course) {
    throw new Error('Invalid Join Code. Please check and try again.');
  }

  // 2. Create the enrollment
  const { error: enrollError } = await supabaseClient
    .from('enrollments')
    .insert({
      student_id: studentId,
      course_id:  course.id,
    });

  if (enrollError) {
    if (enrollError.code === '23505') {
       throw new Error('You are already enrolled in this course.');
    }
    throw new Error('Failed to join course: ' + enrollError.message);
  }

  return course;
}

/**
 * Fetches all courses a student is enrolled in.
 * @param {string} studentId
 */
export async function getStudentEnrollments(studentId) {
  const { data, error } = await supabaseClient
    .from('enrollments')
    .select(`
      id,
      enrolled_at,
      courses:course_id (
        id,
        name,
        slot,
        join_code,
        teacher:teacher_id ( name )
      )
    `)
    .eq('student_id', studentId)
    .order('enrolled_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
