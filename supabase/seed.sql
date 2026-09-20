-- ==========================================================
-- Faculty Availability Tracker - Development Sample Seed Data
-- Version: v0.1.0
-- ==========================================================

-- Insert Sample Faculty
INSERT INTO faculty (id, full_name, email, department, designation, room, is_active)
VALUES 
  ('a1b2c3d4-e5f6-4a1b-8c2d-111111111111', 'Dr. Rahul Sharma', 'rahul.sharma@college.edu', 'Computer Engineering', 'Professor', 'Cabin 12', true),
  ('a1b2c3d4-e5f6-4a1b-8c2d-222222222222', 'Dr. Priya Mehta', 'priya.mehta@college.edu', 'Information Technology', 'Associate Professor', 'Cabin 8', true),
  ('a1b2c3d4-e5f6-4a1b-8c2d-333333333333', 'Prof. Arvind Patel', 'arvind.patel@college.edu', 'Electronics Engineering', 'Assistant Professor', 'Cabin 15', true),
  ('a1b2c3d4-e5f6-4a1b-8c2d-444444444444', 'Dr. Ananya Sen', 'ananya.sen@college.edu', 'Mechanical Engineering', 'Associate Professor', 'Cabin 22', true),
  ('a1b2c3d4-e5f6-4a1b-8c2d-555555555555', 'Prof. Vikram Joshi', 'vikram.joshi@college.edu', 'Computer Engineering', 'Assistant Professor', 'Cabin 05', false)
ON CONFLICT (id) DO NOTHING;

-- Insert Timetable Records
INSERT INTO timetables (faculty_id, day_of_week, start_time, end_time, activity, room, is_active)
VALUES
  -- Dr. Rahul Sharma
  ('a1b2c3d4-e5f6-4a1b-8c2d-111111111111', 'Monday', '09:00', '10:00', 'CS301 - Operating Systems', 'LH-101', true),
  ('a1b2c3d4-e5f6-4a1b-8c2d-111111111111', 'Monday', '10:00', '11:00', 'CS402 - Data Structures Lab', 'Lab 2', true),
  ('a1b2c3d4-e5f6-4a1b-8c2d-111111111111', 'Monday', '14:00', '15:30', 'CS505 - Advanced Algorithms', 'LH-104', true),
  ('a1b2c3d4-e5f6-4a1b-8c2d-111111111111', 'Tuesday', '10:00', '11:30', 'CS301 - Operating Systems Lab', 'Lab 1', true),
  ('a1b2c3d4-e5f6-4a1b-8c2d-111111111111', 'Wednesday', '11:00', '12:00', 'Department Meeting', 'Conference Room A', true),
  ('a1b2c3d4-e5f6-4a1b-8c2d-111111111111', 'Thursday', '09:30', '11:00', 'CS402 - Data Structures', 'LH-102', true),
  ('a1b2c3d4-e5f6-4a1b-8c2d-111111111111', 'Friday', '14:00', '16:00', 'Project Mentorship Sessions', 'Cabin 12', true),

  -- Dr. Priya Mehta
  ('a1b2c3d4-e5f6-4a1b-8c2d-222222222222', 'Monday', '10:30', '12:00', 'IT204 - Database Management Systems', 'LH-201', true),
  ('a1b2c3d4-e5f6-4a1b-8c2d-222222222222', 'Tuesday', '13:00', '15:00', 'IT204 - DBMS Practical Lab', 'IT Lab 3', true),
  ('a1b2c3d4-e5f6-4a1b-8c2d-222222222222', 'Wednesday', '09:00', '10:30', 'IT308 - Web Technologies', 'LH-202', true),
  ('a1b2c3d4-e5f6-4a1b-8c2d-222222222222', 'Thursday', '14:00', '15:00', 'Academic Counseling', 'Cabin 8', true),

  -- Prof. Arvind Patel
  ('a1b2c3d4-e5f6-4a1b-8c2d-333333333333', 'Monday', '11:00', '12:30', 'EC201 - Analog Circuits', 'LH-301', true),
  ('a1b2c3d4-e5f6-4a1b-8c2d-333333333333', 'Wednesday', '14:00', '16:00', 'EC201 - Hardware Lab', 'Circuit Lab 2', true);

-- Insert Current / Manual Availability Statuses
INSERT INTO availability (faculty_id, status, note, updated_at)
VALUES
  ('a1b2c3d4-e5f6-4a1b-8c2d-111111111111', 'available', 'In cabin for student doubt clarification until 3 PM', now()),
  ('a1b2c3d4-e5f6-4a1b-8c2d-222222222222', 'in_meeting', 'Faculty council meeting in Dean office', now()),
  ('a1b2c3d4-e5f6-4a1b-8c2d-333333333333', 'present', 'Working on research paper in cabin', now()),
  ('a1b2c3d4-e5f6-4a1b-8c2d-444444444444', 'unavailable', 'On medical leave today', now())
ON CONFLICT (faculty_id) DO NOTHING;

-- Insert Sample Availability Overrides
INSERT INTO availability_overrides (faculty_id, date, start_time, end_time, status, note)
VALUES
  ('a1b2c3d4-e5f6-4a1b-8c2d-111111111111', CURRENT_DATE, '10:00', '11:00', 'available', 'Lecture rescheduled to next week; available in Cabin 12 for project queries')
ON CONFLICT (id) DO NOTHING;

-- Insert Sample Timetable Imports Log
INSERT INTO timetable_imports (file_name, file_type, uploaded_by, rows_detected, rows_imported, status)
VALUES
  ('Odd_Semester_2026_CS_IT.csv', 'csv', 'admin@college.edu', 42, 42, 'success'),
  ('Mech_Eng_Timetable_Draft.pdf', 'pdf', 'admin@college.edu', 18, 16, 'partial');
