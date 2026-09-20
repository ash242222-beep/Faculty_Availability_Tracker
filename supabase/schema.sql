-- ==========================================================
-- Faculty Availability Tracker - Database Schema (PostgreSQL / Supabase)
-- Version: v0.2.0 (Milestone 2 - Authentication)
-- ==========================================================

-- Enable pgcrypto / uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Faculty Directory Table
CREATE TABLE IF NOT EXISTS faculty (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    room TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Timetables Table
CREATE TABLE IF NOT EXISTS timetables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    activity TEXT NOT NULL,
    room TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT valid_time_window CHECK (start_time < end_time)
);

-- 3. Faculty Current / Manual Availability Table
CREATE TABLE IF NOT EXISTS availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    faculty_id UUID UNIQUE NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('available', 'in_class', 'in_meeting', 'present', 'unavailable', 'not_updated')) DEFAULT 'not_updated',
    note TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Temporary Availability Overrides Table
CREATE TABLE IF NOT EXISTS availability_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('available', 'in_class', 'in_meeting', 'present', 'unavailable')),
    note TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT valid_override_time_window CHECK (start_time < end_time)
);

-- 5. Timetable Import Audit History Table
CREATE TABLE IF NOT EXISTS timetable_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'pdf')),
    uploaded_by TEXT NOT NULL,
    rows_detected INTEGER NOT NULL DEFAULT 0,
    rows_imported INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indices for rapid availability queries and auth linking
CREATE INDEX IF NOT EXISTS idx_faculty_user_id ON faculty(user_id);
CREATE INDEX IF NOT EXISTS idx_faculty_email ON faculty(email);
CREATE INDEX IF NOT EXISTS idx_faculty_department ON faculty(department);
CREATE INDEX IF NOT EXISTS idx_timetables_faculty_day ON timetables(faculty_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_overrides_faculty_date ON availability_overrides(faculty_id, date);

-- Optional Database Trigger: When a new user registers via Supabase Auth with role = 'faculty',
-- ensure a corresponding row in public.faculty and public.availability is automatically initialized.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role TEXT;
  full_name_val TEXT;
  dept_val TEXT;
  room_val TEXT;
  desig_val TEXT;
  new_fac_id UUID;
BEGIN
  assigned_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  full_name_val := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  dept_val := COALESCE(NEW.raw_user_meta_data->>'department', 'Computer Engineering');
  desig_val := COALESCE(NEW.raw_user_meta_data->>'designation', 'Assistant Professor');
  room_val := COALESCE(NEW.raw_user_meta_data->>'room', 'Cabin 10');

  IF assigned_role = 'faculty' THEN
    -- Check if record already exists by email
    SELECT id INTO new_fac_id FROM public.faculty WHERE email = NEW.email;
    IF new_fac_id IS NULL THEN
      INSERT INTO public.faculty (user_id, full_name, email, department, designation, room, is_active)
      VALUES (NEW.id, full_name_val, NEW.email, dept_val, desig_val, room_val, true)
      RETURNING id INTO new_fac_id;
    ELSE
      UPDATE public.faculty SET user_id = NEW.id WHERE id = new_fac_id;
    END IF;

    -- Initialize availability row
    INSERT INTO public.availability (faculty_id, status, note, updated_at)
    VALUES (new_fac_id, 'available', 'Account initialized', now())
    ON CONFLICT (faculty_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition on auth.users (runs on Supabase after signup)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user();

