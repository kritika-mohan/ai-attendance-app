-- =============================================================================
-- SMARTCURRICULUM – Same-Day Duplicate Prevention
-- =============================================================================
-- This script prevents a student from marking attendance more than once per day
-- for the same course, even across different sessions.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_same_day_attendance()
RETURNS TRIGGER AS $$
DECLARE
    new_course_id UUID;
BEGIN
    SELECT course_id INTO new_course_id 
    FROM public.sessions 
    WHERE session_id = NEW.session_id;

    IF EXISTS (
        SELECT 1 
        FROM public.attendance a
        JOIN public.sessions s ON a.session_id = s.session_id
        WHERE a.student_id = NEW.student_id
          AND s.course_id = new_course_id
          AND a.timestamp::date = NEW.timestamp::date
    ) THEN
        RAISE EXCEPTION 'Attendance already marked for this course today.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_same_day_attendance ON public.attendance;
CREATE TRIGGER trg_check_same_day_attendance
BEFORE INSERT ON public.attendance
FOR EACH ROW EXECUTE PROCEDURE public.check_same_day_attendance();
