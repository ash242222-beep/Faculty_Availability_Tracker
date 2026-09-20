# Changelog

All notable changes to the **Faculty Availability Tracker** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to Semantic Versioning.

---

## [v0.4.0] - 2026-09-20 - Milestone 4: Timetable Engine & Validation

### Added
- **Centralized Timetable Service Layer (`js/timetable-service.js`)**:
  - Full CRUD operations supporting live Supabase REST table operations on `public.timetables` with seamless offline fallback to `window.DataStore`.
  - Comprehensive multi-faceted collision engine:
    - **Self Overlap Detection**: Blocks overlapping classes for the same faculty member on the same day (`[start, end)` time intervals).
    - **Identical Duplicate Guard**: Identifies and prevents duplicate identical entries.
    - **Venue / Room Collision Advisory**: Detects room scheduling conflicts when multiple faculty members are scheduled in the same room at overlapping times and returns an advisory warning.
    - **Time Window Verification**: Strict checks for start < end time, valid 24h format (`HH:MM`), and realistic class durations (minimum 15 mins, maximum 8 hours).
  - Time utilities in `js/utils.js`: `calculateDuration(start, end)` with human-readable string formats (e.g. "1 hr 30 mins"), and `isTimeOverlap(startA, endA, startB, endB)`.
  - Batch import helper `batchImportTimetables(entries)` with automated validation and rollback/error reporting.
  - Reactive global event dispatcher: emits `timetable-data-changed` CustomEvents on creations, modifications, deletions, and imports.
- **Admin Timetable Interface Upgrade (`admin.html` & `js/admin.js`)**:
  - Dynamic filter panel: filter timetables by Faculty member, Day of the Week, and live debounced keyword search (activity, room, faculty name).
  - Real-time interactive validation preview: displays calculated duration pill and live conflict status banner (green checkmark for clear, red warning for overlap, orange advisory for room collisions) directly as the user types.
  - Slot status management: 1-click **Pause / Activate** toggle allowing administrators to soft-disable timetable slots without deleting them.
  - Duration pill in timetable list rows displaying exact duration alongside formatted 12-hour start and end times.
- **Faculty Dashboard Integration (`faculty.html` & `js/faculty.js`)**:
  - Today's schedule card and full weekly timetable table updated to query `TimetableService.getTimetablesByFaculty()`.
  - Real-time reactive updates: automatically updates timetable cards when modified from admin or import without page reload via `timetable-data-changed` listener.
  - Duration badges rendered for all weekly scheduled slots.
- **Student Dashboard Integration (`student.html` & `js/student.js`)**:
  - Weekly Timetable modal connects directly to `TimetableService.getTimetablesByFaculty()` with duration badges and corrected time-sorting.
  - Auto-updates student availability calculations whenever timetable slots are modified via reactive event listener.
- **Import Engine Integration (`js/timetable-import.js`)**:
  - Final commit stage now utilizes `TimetableService.batchImportTimetables()` and dispatches `timetable-data-changed` event to automatically refresh all open tabs.

---

## [v0.3.0] - 2026-09-20 - Milestone 3: Faculty Management

### Added
- **Centralized Faculty Service Layer (`js/faculty-service.js`)**:
  - Full CRUD abstraction supporting both live Supabase REST table operations and synchronous `DataStore` offline fallback.
  - Multi-condition querying with department filtering, case-insensitive substring searching across name, designation, cabin, and email.
  - Atomic state toggling (`toggleFacultyActive`) to soft-pause or reactivate faculty accounts without deleting timetables or historical records.
  - Cross-tab & component reactivity: emits `faculty-data-changed` CustomEvents to trigger automatic UI refreshes across dashboards.
- **Admin Faculty Management Refactor (`admin.html` & `js/admin.js`)**:
  - Live debounced search bar and department filter dropdown directly above the faculty roster table.
  - Asynchronous loading states and error handling during faculty fetch and mutations.
  - Unified Add/Edit modal integrated with `FacultyService.addFaculty` and `FacultyService.updateFaculty`.
  - Pause/Reactivate actions updating state directly in Supabase or local storage.
  - Dynamic timetable faculty dropdown population fetching active faculty members.
- **Student Dashboard Integration (`student.html` & `js/student.js`)**:
  - Asynchronous faculty directory rendering directly consuming `FacultyService.getAllFaculty()`.
  - Live debounced search input and reactive department filtering with real-time availability resolution.
  - Paused/Inactive faculty state indicator badge on cards.
  - Dynamic timetable preview and quick-check modals resolving directly from the faculty service.
- **Faculty Dashboard Self-Management (`faculty.html` & `js/faculty.js`)**:
  - Integrated "Edit Cabin / Designation" modal allowing faculty members to self-update their office cabin, designation, and display name.
  - Asynchronous profile initialization resolving by authenticated user's `faculty_id` or `email`.

---

## [v0.2.0] - 2026-09-20 - Milestone 2: Authentication

### Added
- **Supabase Authentication Engine (`js/auth.js`)**:
  - Direct integration with Supabase Auth (`signUp`, `signInWithPassword`, `signOut`, `getSession`, `onAuthStateChange`).
  - Automatic profile linking: maps authenticated `auth.users` accounts to `public.faculty` and initial `public.availability` status.
  - Multi-tab session synchronization: listens to `onAuthStateChange` to keep active user credentials and header indicators updated.
- **Enhanced Authentication Interface (`login.html`)**:
  - Interactive dual-mode tabs: **Sign In** and **Create Account (Sign Up)**.
  - Dynamic faculty registration fields: Department, Designation, and Cabin/Room.
  - Live connection indicator dot displaying real-time Supabase Auth connectivity vs interactive college demo mode.
  - Built-in Supabase Credentials settings panel to configure/switch Project URL and Anon Public Key directly in the browser.
  - Preserved 1-click quick testing accounts for Student, Faculty, and Admin.
- **Role-Based Access Control (RBAC) & Route Protection**:
  - `requireRole(['student', 'faculty', 'admin'])` guard enforcing strict separation of permissions.
  - Unauthenticated redirects retain `?redirect=` parameter to bring users directly to their intended dashboard after login.
  - Unauthorized role navigation blocked with automated redirection.
- **Database Schema & Row Level Security Enhancements**:
  - Updated `supabase/schema.sql` with `user_id UUID REFERENCES auth.users(id)` and `handle_new_auth_user()` database trigger.
  - Updated `supabase/policies.sql` with `auth.uid()` and `auth.jwt()` evaluation rules for faculty profile, availability, and overrides self-management.

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
