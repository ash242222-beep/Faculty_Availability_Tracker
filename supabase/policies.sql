-- ==========================================================
-- Faculty Availability Tracker - Row Level Security (RLS) Policies
-- Version: v0.1.0
-- ==========================================================

-- Enable RLS on all tables
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_imports ENABLE ROW LEVEL SECURITY;

-- Helper function to check role from auth metadata
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role',
    'student'
  );
$$ LANGUAGE sql STABLE;

-- ----------------------------------------------------------
-- 1. Faculty Table Policies
-- ----------------------------------------------------------
-- Students & Public can view active faculty
CREATE POLICY "Public read active faculty"
ON faculty FOR SELECT
TO authenticated, anon
USING (true);

-- Admin can manage faculty records
CREATE POLICY "Admin manage faculty"
ON faculty FOR ALL
TO authenticated
USING (auth.get_user_role() = 'admin')
WITH CHECK (auth.get_user_role() = 'admin');

-- ----------------------------------------------------------
-- 2. Timetables Table Policies
-- ----------------------------------------------------------
-- Public read timetables
CREATE POLICY "Public read timetables"
ON timetables FOR SELECT
TO authenticated, anon
USING (true);

-- Admin can manage all timetables
CREATE POLICY "Admin manage timetables"
ON timetables FOR ALL
TO authenticated
USING (auth.get_user_role() = 'admin')
WITH CHECK (auth.get_user_role() = 'admin');

-- ----------------------------------------------------------
-- 3. Availability Table Policies
-- ----------------------------------------------------------
-- Public read availability
CREATE POLICY "Public read availability"
ON availability FOR SELECT
TO authenticated, anon
USING (true);

-- Faculty can update their own availability
CREATE POLICY "Faculty update own availability"
ON availability FOR ALL
TO authenticated
USING (
  faculty_id IN (
    SELECT id FROM faculty WHERE email = auth.jwt() ->> 'email'
  ) OR auth.get_user_role() = 'admin'
)
WITH CHECK (
  faculty_id IN (
    SELECT id FROM faculty WHERE email = auth.jwt() ->> 'email'
  ) OR auth.get_user_role() = 'admin'
);

-- ----------------------------------------------------------
-- 4. Availability Overrides Policies
-- ----------------------------------------------------------
-- Public read overrides
CREATE POLICY "Public read overrides"
ON availability_overrides FOR SELECT
TO authenticated, anon
USING (true);

-- Faculty manage their own overrides
CREATE POLICY "Faculty manage own overrides"
ON availability_overrides FOR ALL
TO authenticated
USING (
  faculty_id IN (
    SELECT id FROM faculty WHERE email = auth.jwt() ->> 'email'
  ) OR auth.get_user_role() = 'admin'
)
WITH CHECK (
  faculty_id IN (
    SELECT id FROM faculty WHERE email = auth.jwt() ->> 'email'
  ) OR auth.get_user_role() = 'admin'
);

-- ----------------------------------------------------------
-- 5. Timetable Imports Policies
-- ----------------------------------------------------------
-- Only Admin can view and create import history
CREATE POLICY "Admin manage import logs"
ON timetable_imports FOR ALL
TO authenticated
USING (auth.get_user_role() = 'admin')
WITH CHECK (auth.get_user_role() = 'admin');
