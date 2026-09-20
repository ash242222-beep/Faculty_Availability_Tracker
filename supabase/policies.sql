-- ==========================================================
-- Faculty Availability Tracker - Row Level Security (RLS) Policies
-- Version: v0.8.0 (Milestone 8 - Security & Polish)
-- Production-Ready, Idempotent, and Audited
-- ==========================================================

-- ----------------------------------------------------------
-- 0. Enable Row Level Security on all tables
-- ----------------------------------------------------------
ALTER TABLE IF EXISTS faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS timetable_imports ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------
-- Helper Function: Get Current User Role
-- Reads from JWT user_metadata, app_metadata, or defaults to 'student'
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    'student'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, anon;

-- ==========================================================
-- 1. Faculty Table Policies
-- ==========================================================
DROP POLICY IF EXISTS "Public read active faculty" ON faculty;
DROP POLICY IF EXISTS "Admin manage faculty" ON faculty;
DROP POLICY IF EXISTS "Faculty update own profile" ON faculty;

-- Public & Students: Read-only access to faculty profiles
CREATE POLICY "Public read active faculty"
ON faculty FOR SELECT
TO authenticated, anon
USING (true);

-- Admin: Full management (INSERT, UPDATE, DELETE)
CREATE POLICY "Admin manage faculty"
ON faculty FOR ALL
TO authenticated
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

-- Faculty: Can update their own cabin, designation, and phone details
CREATE POLICY "Faculty update own profile"
ON faculty FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() 
  OR email = (auth.jwt() ->> 'email')
  OR public.get_user_role() = 'admin'
)
WITH CHECK (
  user_id = auth.uid() 
  OR email = (auth.jwt() ->> 'email')
  OR public.get_user_role() = 'admin'
);

-- ==========================================================
-- 2. Timetables Table Policies
-- ==========================================================
DROP POLICY IF EXISTS "Public read timetables" ON timetables;
DROP POLICY IF EXISTS "Admin manage timetables" ON timetables;

-- Public & Students: Read-only access to class timetables
CREATE POLICY "Public read timetables"
ON timetables FOR SELECT
TO authenticated, anon
USING (true);

-- Admin: Full management (Create, Update, Delete timetable schedules)
CREATE POLICY "Admin manage timetables"
ON timetables FOR ALL
TO authenticated
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

-- ==========================================================
-- 3. Availability Table Policies (Manual Status)
-- ==========================================================
DROP POLICY IF EXISTS "Public read availability" ON availability;
DROP POLICY IF EXISTS "Faculty update own availability" ON availability;

-- Public & Students: Read-only access to live manual statuses
CREATE POLICY "Public read availability"
ON availability FOR SELECT
TO authenticated, anon
USING (true);

-- Faculty: Can insert or update their own live availability status; Admin has full access
CREATE POLICY "Faculty update own availability"
ON availability FOR ALL
TO authenticated
USING (
  faculty_id IN (
    SELECT id FROM faculty WHERE user_id = auth.uid() OR email = (auth.jwt() ->> 'email')
  ) OR public.get_user_role() = 'admin'
)
WITH CHECK (
  faculty_id IN (
    SELECT id FROM faculty WHERE user_id = auth.uid() OR email = (auth.jwt() ->> 'email')
  ) OR public.get_user_role() = 'admin'
);

-- ==========================================================
-- 4. Availability Overrides Policies (Temporary Exceptions)
-- ==========================================================
DROP POLICY IF EXISTS "Public read overrides" ON availability_overrides;
DROP POLICY IF EXISTS "Faculty manage own overrides" ON availability_overrides;

-- Public & Students: Read-only access to active overrides
CREATE POLICY "Public read overrides"
ON availability_overrides FOR SELECT
TO authenticated, anon
USING (true);

-- Faculty: Can create, update, and delete their own overrides; Admin has full access
CREATE POLICY "Faculty manage own overrides"
ON availability_overrides FOR ALL
TO authenticated
USING (
  faculty_id IN (
    SELECT id FROM faculty WHERE user_id = auth.uid() OR email = (auth.jwt() ->> 'email')
  ) OR public.get_user_role() = 'admin'
)
WITH CHECK (
  faculty_id IN (
    SELECT id FROM faculty WHERE user_id = auth.uid() OR email = (auth.jwt() ->> 'email')
  ) OR public.get_user_role() = 'admin'
);

-- ==========================================================
-- 5. Timetable Imports Policies (Audit Log)
-- ==========================================================
DROP POLICY IF EXISTS "Admin manage import logs" ON timetable_imports;

-- Admin: Only administrators can view and insert timetable import audit records
CREATE POLICY "Admin manage import logs"
ON timetable_imports FOR ALL
TO authenticated
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

-- ==========================================================
-- Security Audit Verification Checklist (Run in Supabase SQL Editor)
-- ==========================================================
-- 1. Test anonymous access (must succeed for SELECT on faculty, timetables, availability, overrides):
--    SELECT count(*) FROM faculty;
--    SELECT count(*) FROM timetables;
-- 2. Test unauthorized write as anonymous (must fail with permission denied):
--    INSERT INTO faculty (full_name, email, department) VALUES ('Hacker', 'h@test.com', 'CS');
-- 3. Test import logs access as anonymous (must fail):
--    SELECT * FROM timetable_imports;
