# Product Requirements Document (PRD)

## 1. Executive Summary
The **Faculty Availability Tracker** is a streamlined college web utility that allows students to instantly determine whether a faculty member is available, in class, in a meeting, present in their cabin, or unavailable at any designated date and time. It replaces chaotic communication and physical door-checking with a clean, centralized system.

## 2. Target Users & Roles
1. **Students**: Want immediate answers to "Is Dr. X available right now or on Tuesday at 2:30 PM?" without editing privileges.
2. **Faculty**: Want to publish real-time status updates (e.g., "Available in Cabin 12", "In Meeting") and post temporary overrides when classes are cancelled or rescheduled.
3. **Administration**: Maintain official faculty rosters, manage college timetables, bulk import schedules from CSV or text-based PDFs, and monitor availability.

## 3. Key Functional Modules
- **Central Availability Resolution Engine**:
  Priority order:
  1. Inactive faculty account (`is_active = false`) → `unavailable` (Account Inactive)
  2. Time-specific availability override (`availability_overrides`)
  3. Scheduled regular timetable entry (`timetables`)
  4. Manual/current status update (`availability`)
  5. Default fallback (`not_updated`)
- **Student Portal**:
  - Instant faculty directory search and department filter.
  - Live status indicator (text + color pill).
  - Date & Time availability lookup calculator.
  - Weekly schedule viewer.
- **Faculty Portal**:
  - One-click current status buttons (`Available`, `Present`, `In Meeting`, `Unavailable`).
  - Personal schedule overview (Today + Weekly).
  - Temporary override manager with custom date, time window, status, and note.
- **Admin Portal**:
  - Faculty directory management with safe pause/reactivate (`is_active`).
  - Timetable CRUD with overlap & format validation.
  - Timetable import wizard (CSV & text PDF) with preview, correction table, and audit log.
  - Import history log.

## 4. Design & Usability Standards
- Clean, accessible light neutral college aesthetic (no distracting gradients, glassmorphism, or dark UI).
- Mobile-first responsive layout (smartphones, tablets, laptops, widescreen monitors).
- Clear, descriptive status badges with text labels (never relying purely on color).
- Explicit error handling and user feedback notifications.
