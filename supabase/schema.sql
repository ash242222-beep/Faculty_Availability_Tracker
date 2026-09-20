-- ==========================================================
-- Faculty Availability Tracker - Database Schema (PostgreSQL / Supabase)
-- Version: v0.1.0
-- ==========================================================

-- Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Faculty Directory Table
CREATE TABLE IF NOT EXISTS faculty (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Indices for rapid availability queries
CREATE INDEX IF NOT EXISTS idx_faculty_department ON faculty(department);
CREATE INDEX IF NOT EXISTS idx_timetables_faculty_day ON timetables(faculty_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_overrides_faculty_date ON availability_overrides(faculty_id, date);
