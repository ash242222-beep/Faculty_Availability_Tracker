# Changelog

All notable changes to the **Faculty Availability Tracker** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to Semantic Versioning.

---

## [v0.1.0] - 2026-09-20 - Milestone 1: Static UI

### Added
- **Landing Page (`index.html`)**: Clean overview of the system, quick access buttons to Student, Faculty, and Admin portals, system architecture summary, and interactive demo preview.
- **Login UI (`login.html`)**: Role-based access selector (Student, Faculty, Admin), credentials input, demo role shortcuts for immediate testing.
- **Student Dashboard (`student.html`)**:
  - Live faculty search and department filtering.
  - Real-time current status display with color/text status badges.
  - Specific Date & Time availability checker with interactive resolution.
  - Detailed weekly timetable preview modal/drawer.
- **Faculty Dashboard (`faculty.html`)**:
  - Profile card showing full name, department, designation, and room/cabin.
  - Current status quick toggle (`Available`, `Present`, `In Meeting`, `Unavailable`).
  - Today's schedule card and complete weekly timetable list.
  - Temporary availability override management: Form with date, start time, end time, status, and optional note, plus active override table with edit/delete actions.
- **Admin Dashboard (`admin.html`)**:
  - Section 1: Faculty Management (Add, Edit, Pause `is_active = false`, Reactivate).
  - Section 2: Timetable Management (Add entry, filter by faculty, edit, delete, conflict detection).
  - Section 3: Timetable Import (CSV and text-based PDF upload with extraction, normalization, preview, correction, and import confirmation).
  - Section 4: Availability Management (Central override & status monitor).
  - Section 5: Import History (List past imports with status badges and rows imported).
- **Core Stylesheet (`css/style.css`)**:
  - Clean, beginner-friendly CSS3 layout (light neutral background, accessible contrast, responsive cards, clean typography, status badges, data tables).
  - Mobile, tablet, laptop, and desktop responsive breakpoints.
- **Client Logic (`js/`)**:
  - `config.js`: Application settings, Supabase connection variables, demo mode defaults.
  - `supabase-client.js`: Database client connector with safe fallback to local demo store.
  - `auth.js`: Session management, role detection, route guards, quick demo sign-in.
  - `utils.js`: Central `getFacultyAvailability(facultyId, date, time)` resolver implementing the 5-tier priority rules: Inactive account → Override → Timetable → Manual status → Not updated.
  - `student.js`: Student search, filter, and date-time query handlers.
  - `faculty.js`: Faculty status switcher and override manager.
  - `admin.js`: Admin CRUD for faculty & timetables, and tabbed view switching.
  - `timetable-import.js`: CSV & PDF parser, validation engine, table preview with editable cells, and import commit logic.
- **Database Specifications (`supabase/`)**:
  - `schema.sql`: PostgreSQL schema definitions for `faculty`, `timetables`, `availability`, `availability_overrides`, and `timetable_imports`.
  - `policies.sql`: Complete Row Level Security (RLS) policies for Student, Faculty, and Admin roles.
  - `seed.sql`: Safe sample college faculty, timetables, and override data for development and testing.
- **Documentation (`docs/`)**:
  - `docs/PRD.md`: Product Requirements Document.
  - `docs/ARCHITECTURE.md`: Technical and architectural specifications.
  - `docs/VERSION_HISTORY.md`: Milestone roadmap and release tracking.
  - `README.md`: Beginner-friendly setup and operational manual.
