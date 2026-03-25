import { supabaseClient } from './js/supabaseClient.js';

async function diagnose() {
  console.log('--- SMARTCURRICULUM Diagnostic ---');
  
  // 1. Check current user
  const { data: { user } } = await supabaseClient.auth.getUser();
  console.log('Logged in as:', user?.email || 'NOT LOGGED IN');

  // 2. Count students
  const { count: studentCount, error: studentErr } = await supabaseClient
    .from('users').select('id', { count: 'exact', head: true }).eq('role', 'student');
  console.log('Total students visible:', studentCount, studentErr ? `(Error: ${studentErr.message})` : '');

  // 3. Check active sessions
  const { data: sessions, error: sessionErr } = await supabaseClient
    .from('sessions').select('*').order('created_at', { ascending: false }).limit(1);
  console.log('Latest session:', sessions?.[0] || 'NONE', sessionErr ? `(Error: ${sessionErr.message})` : '');

  // 4. Check attendance
  if (sessions?.[0]) {
    const { count: attendCount, error: attendErr } = await supabaseClient
      .from('attendance').select('id', { count: 'exact', head: true }).eq('session_id', sessions[0].session_id);
    console.log(`Attendance for latest session (${sessions[0].session_id}):`, attendCount, attendErr ? `(Error: ${attendErr.message})` : '');
  }
}

diagnose();
