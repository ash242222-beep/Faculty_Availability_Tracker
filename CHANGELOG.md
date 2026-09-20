# Changelog

All notable changes to the **Faculty Availability Tracker** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to Semantic Versioning.

---

## [v0.8.0] - 2026-09-20 - Milestone 8: Security & Polish

### Added
- **Production Row Level Security (RLS) Policies (`supabase/policies.sql`)**:
  - Hardened policies for `faculty`, `timetables`, `availability`, `availability_overrides`, and `timetable_imports`.
  - Implemented `public.get_user_role()` with defensive fallback parsing JWT `user_metadata` and `app_metadata`.
  - Added idempotent `DROP POLICY IF EXISTS` directives to allow zero-error migrations in the Supabase SQL editor.
  - Authored comprehensive security specification and threat model in `docs/RLS_SECURITY_AUDIT.md`.
- **Global Error Boundary & Toast Notification Engine (`js/error-boundary.js`)**:
  - Global uncaught error listener (`window.addEventListener('error')`) and unhandled promise rejection listener (`window.addEventListener('unhandledrejection')`) to prevent silent failures.
  - Benign platform message filtering (suppresses normal DevTools and WebSocket connection warnings).
  - Accessible, styled toast notification engine with auto-dismiss timers, status icons, close buttons, and ARIA attributes (`aria-live="polite"`).
  - Wired into all 5 application pages (`index.html`, `student.html`, `faculty.html`, `admin.html`, `login.html`).
- **Mobile Optimization & Touch Target Compliance (`css/style.css`)**:
  - Enforced minimum 44px touch targets across all mobile buttons, navigation links, form controls, selects, and status selectors per WCAG mobile accessibility guidelines.
  - Mobile bottom-sheet layout for modals on viewports `< 640px` with full-width primary actions and enlarged close targets.
  - iOS zoom prevention (`font-size: 16px` on input focus) and safe-area insets (`env(safe-area-inset-bottom)`).
  - Fluid mobile navigation bar with centered, wrap-friendly tap targets.

---

## [v0.7.0] - 2026-09-20 - Milestone 7: Live Text-based PDF Timetable Import

### Added
- **Spatial PDF Coordinate Reconstruction Engine (`js/timetable-import.js`)**:
  - Implemented multi-page text item grouping by vertical baseline ($Y$-coordinate within $\pm 4.5$ points) to prevent PDF.js token shuffling across multi-column tables.
  - Horizontal ordering ($X$-coordinate ascending) with adaptive spacing detection based on text item bounding boxes and kerning.
  - Handles table header discarding, professor section headings (`Faculty: Dr. Name` propagating to child class rows), pipe/tab-delimited records, and space-separated tabular schedules.
- **Academic Entity Extractors**:
  - **Day Parser**: Recognizes standard and abbreviated weekdays (`Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`, `Sunday`).
  - **Time Range Regex**: Parses hyphenated/dash/word ranges (`09:00 - 10:30`, `09:00 to 10:30`, `9:00 AM - 10:30 AM`, `14:00 16:00`).
  - **Room & Venue Extractor**: Detects standard college venues including `LH-101`, `Lab 2`, `Circuit Lab 2`, `Cabin 8`, `Auditorium B`, `CR-3`.
  - **Faculty Matcher**: Matches against registered faculty roster with academic honorific detection (`Dr.`, `Prof.`, `Mr.`, `Ms.`) and fallback to inline staging selector.
- **Client-Side Sample PDF Timetable Generator (`admin.html` & `js/timetable-import.js`)**:
  - Integrated `jsPDF` CDN to generate real text-based institutional timetable PDFs with 1 click (`Download Sample PDF`).
  - Creates a styled landscape timetable containing 8 verified college class sessions for instant end-to-end import testing without external files.
- **Unified Import & Audit Pipeline**:
  - Seamlessly stages parsed PDF rows into the interactive pre-commit correction table with duration pills, validation alerts, inline cell editing, and `append`/`replace_faculty` commit modes.
  - Automatically records PDF import runs into Supabase `public.timetable_imports` with row counts and status badges.

---

## [v0.6.0] - 2026-09-20 - Milestone 6: Live CSV Timetable Import

### Added
- **Centralized Import Service Layer (`js/import-service.js`)**:
  - Direct integration with Supabase `public.timetable_imports` with transparent offline fallback to `window.DataStore`.
  - Methods: `recordImportLog()`, `getImportHistory()`, `deleteImportLog()`, `clearAllImportHistory()`.
  - Dispatches `import-history-changed` event to synchronize UI components across tabs without manual page reload.
- **Production-Grade RFC 4180 CSV Engine (`js/timetable-import.js`)**:
  - Resilient parser supporting quoted cells containing commas, escaped quotes (`""`), tabs, semicolons, and diverse newline separators (`\r\n`, `\r`, `\n`).
  - **Fuzzy Header Mapping**: Dynamically binds columns regardless of order or naming variants (`faculty_name`, `professor`, `teacher`, `instructor`, `activity`, `subject`, `course`, `lecture`, `start_time`, `from`, `end_time`, `to`, `room`, `venue`, `cabin`, `lab`).
  - **12-Hour & 24-Hour Normalization**: Automatically converts formats like `9:00 AM`, `9am`, `02:30 PM`, `2pm` into standardized `HH:MM` 24-hour time.
  - **Fuzzy Faculty Matching & Quick-Select Dropdown**: Matches faculty names against registered directory; unknown names render an inline `<select>` containing all current faculty for 1-click administrative resolution.
  - **Intra-File & Database Overlap Detection**: Detects self-overlap collisions between rows in the same CSV as well as conflicts with existing database records.
- **Staging Table & Pre-Commit Correction Toolbar (`admin.html`)**:
  - **Commit Modes**: Toggle between **Append** (keeps existing timetables) and **Replace Faculty** (cleans existing weekly schedules for professors present in the uploaded file before insertion).
  - **Filter Statistics Buttons**: Filter staged rows by *All Rows*, *Ready / Valid*, and *Needs Attention*.
  - **Action Tools**: "Auto-Fix Formats" (trims whitespace, formats times) and "Remove Errors" (purges unresolvable entries to permit immediate commit).
  - Calculated duration pills displayed live for each staged entry.
- **Timetable Import Audit History Upgrade (`admin.html` & `js/admin.js`)**:
  - Dynamic filter panel: filter logs by File Type (All / CSV / PDF), Status (Success / Partial / Failed), and debounced search query.
  - Formatted timestamps, row statistics, and individual deletion or full log clearing capabilities.
- **Timetable Service Bulk Insert Upgrade (`js/timetable-service.js`)**:
  - Enhanced `batchImportTimetables(records, options)` with support for `replace_faculty` mode and PostgreSQL bulk array insertion with error fallback.

---

## [v0.5.0] - 2026-09-20 - Milestone 5: Central Availability & Overrides Engine

### Added
- **Centralized Availability Service Layer (`js/availability-service.js`)**:
  - Full CRUD operations for manual faculty status and temporary schedule overrides (`availability` and `availability_overrides` tables) with live Supabase client querying and offline local storage fallback.
  - **Authoritative 5-Tier Precedence Engine**:
    - **Tier 1 (Inactive Profile Guard)**: Flags de-activated accounts as paused and unavailable campus-wide.
    - **Tier 2 (Date-Specific Schedule Overrides)**: Resolves active overrides on the target date within the `[start_time, end_time)` window with absolute priority.
    - **Tier 3 (Weekly Timetables)**: Resolves scheduled recurring lectures, classes, or labs for the matching day of week.
    - **Tier 4 (Manual Faculty Status)**: Resolves the professor's last posted explicit status (`available`, `present`, `in_meeting`, `unavailable`) with relative timestamp calculations (e.g. "Updated 10m ago").
    - **Tier 5 (Default Fallback)**: Returns default available/standby status when no other condition applies.
  - **Override Collision Engine & Validation Guard**:
    - **Positive Window Constraint**: Enforces `end_time > start_time` with standard 24h `HH:MM` format.
    - **Duration Sanity Bounds**: Checks minimum (15m) and maximum (12h) duration constraints with interactive duration badge calculations.
    - **Self-Override Overlap Prevention**: Prevents duplicate or overlapping overrides for the same faculty member on the same calendar day.
    - **Timetable Collision Advisory**: Detects whether an override replaces or conflicts with a regular scheduled timetable class and provides an advisory warning for the faculty/admin.
  - **Real-Time Supabase Synchronization**:
    - Channels subscribed to `availability` and `availability_overrides` with live broadcast and local `window.dispatchEvent` fallback.
- **Admin Dashboard Availability & Overrides Management (`admin.html` & `js/admin.js`)**:
  - **Live Campus-Wide Status Table**: Real-time overview of all faculty with source indicators (`Override`, `Class`, `Manual`, `Paused`), active notes, and instant text search.
  - **Campus Override Creation & Editing Form**: Admin override authoring with live duration badge, validation alerts, and full CRUD.
  - **Filter Bar & Timeline Badges**: Filter overrides by faculty, status, and timeline (*Active Now*, *Today & Upcoming*, *Today Only*, *Past*).
- **Faculty Dashboard Integration (`faculty.html` & `js/faculty.js`)**:
  - Manual status switcher integrated with `AvailabilityService.updateManualStatus()` with real-time feedback and last-updated timestamp.
  - Override management upgraded with live collision checking, duration metrics, and timeline badges.
- **Student Dashboard Integration (`student.html` & `js/student.js`)**:
  - Faculty cards show resolved status with priority source tags (`[Override]`, `[Timetable]`, `[Manual]`, `[Inactive]`).
  - **Availability Status Breakdown Modal**: Dedicated dialog revealing the exact rule applied, location, notes, and time window for any specified date and time query.
  - Bound to reactive `availability-data-changed` and `override-data-changed` events.

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
