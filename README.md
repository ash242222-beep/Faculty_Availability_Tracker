# Faculty Availability Tracker

> A simple, beginner-friendly college web application that allows students and faculty to quickly determine whether a faculty member is available at a particular date and time.

---

## 1. Project Description
In colleges and universities, students and faculty frequently waste considerable time walking across campus only to find a professor's cabin locked, finding them unexpectedly in class, or waiting outside closed meeting rooms.

The **Faculty Availability Tracker** solves this by establishing a real-time, centralized availability resolver. Students can search any faculty member, view their current live status, or input a specific date and time (e.g. *Tuesday at 2:30 PM*) to instantly see whether that professor is available, in class, in a meeting, or away on leave.

The system supports three user roles:
1. **Student**: Public directory search, date/time availability lookups, weekly timetable view.
2. **Faculty**: Real-time status toggling, schedule overview, and temporary availability overrides.
3. **Administration**: Faculty roster management (add, edit, pause, reactivate), timetable management, CSV and text PDF timetable import wizard with live correction, and audit history.

---

## 2. Key Features

- **Central Availability Resolution Engine**:
  Implements a single reusable function `getFacultyAvailability(facultyId, date, time)` following strict priority rules:
  1. *Inactive Faculty Account* (`is_active = false`) → Paused / Unavailable
  2. *Temporary Override* (`availability_overrides`) → Takes precedence over timetables
  3. *Scheduled Regular Timetable* (`timetables`) → In Class (Activity + Room)
  4. *Manual/Current Status Update* (`availability`) → Latest status posted by faculty
  5. *Default Fallback* → Not Updated

- **Student Portal**:
  - Real-time search across names, departments, cabins, and courses.
  - Department filter dropdown.
  - Specific Date & Time availability lookup calculator.
  - Complete weekly schedule preview modal.

- **Faculty Dashboard**:
  - One-click current status buttons: `Available`, `Present`, `In Meeting`, `Unavailable`.
  - Custom status note broadcast (e.g. *"In cabin for project doubts until 3 PM"*).
  - Today's schedule summary & weekly timetable.
  - Temporary override manager (Date, Start Time, End Time, Status, Note) with Edit/Delete.

- **Admin Portal**:
  - **Faculty Management**: Add, Edit, Pause (soft-delete via `is_active = false`), Reactivate.
  - **Timetable Management**: Create and modify class slots with overlap and time-range validation.
  - **Timetable Importer (CSV & Text PDF)**: Upload files, extract rows, normalize values, validate faculty names, preview with editable inline cells, and confirm before database commit.
  - **Availability Overview**: Campus-wide real-time status and active overrides monitor.
  - **Import History**: Permanent audit trail of file uploads and import statuses.

---

## 3. Technology Stack

- **Frontend**: Plain HTML5, Plain CSS3, Vanilla JavaScript (ES6)
- **Design System**: Accessible, clean neutral college UI (no bulky component frameworks)
- **Backend & Database**: Supabase (PostgreSQL 15, Supabase Auth, Row Level Security)
- **Document Processing**: Browser-native PDF.js (text extraction without server-side OCR)
- **Hosting Target**: Vercel (static web deployment)
- **Version Control**: Git & GitHub

---

## 4. Folder Structure

```text
├── index.html                   # Landing page with architecture and quick portal links
├── login.html                   # Role-based sign in with 1-click test accounts
├── student.html                 # Student directory, lookup calculator & schedule viewer
├── faculty.html                 # Faculty status toggle, schedule & override manager
├── admin.html                   # Admin 5-tab portal (Faculty, TT, Import, Avail, History)
│
├── css/
│   └── style.css                # Plain responsive CSS3 stylesheet
│
├── js/
│   ├── config.js                # App constants, Supabase keys, status definitions
│   ├── supabase-client.js       # Client connection layer & localStorage mock store
│   ├── auth.js                  # Session handling, role guards, route protection
│   ├── utils.js                 # Central getFacultyAvailability() logic & formatters
│   ├── error-boundary.js        # Global uncaught error listener & toast notifications
│   ├── student.js               # Student portal interactive logic & breakdown modal
│   ├── faculty.js               # Faculty dashboard status & override management
│   ├── faculty-service.js       # Faculty CRUD data service layer
│   ├── timetable-service.js     # Timetable CRUD & multi-conflict validation service
│   ├── availability-service.js  # 5-tier central availability resolution service
│   ├── import-service.js        # Timetable import audit logging service
│   ├── admin.js                 # Admin management CRUD & tab controllers
│   └── timetable-import.js      # CSV/PDF parser, validation & staged preview
│
├── supabase/
│   ├── schema.sql               # PostgreSQL tables and index definitions
│   ├── policies.sql             # Row Level Security (RLS) policies for RBAC
│   └── seed.sql                 # Sample college test data (faculty, timetables, etc.)
│
├── docs/
│   ├── PRD.md                   # Product Requirements Document
│   ├── ARCHITECTURE.md          # System architecture and technical design
│   ├── RLS_SECURITY_AUDIT.md    # Row Level Security threat model & audit spec
│   ├── VIVA_PREPARATION.md      # Comprehensive Viva defense guide & 20 Q&As
│   └── VERSION_HISTORY.md       # Full milestone release log
│
├── vercel.json                  # Production Vercel static routing & security headers
├── README.md                    # Complete project manual (this file)
├── VERSION                      # Current semantic version marker (v1.0.0)
└── CHANGELOG.md                 # Detailed version release changes
```

---

## 5. Setup & Running Locally

1. Clone or open the project directory in your terminal or Google AI Studio.
2. Serve the static files using any local web server:
   ```bash
   # Using npx serve or python3
   npx serve .
   # or
   python3 -m http.server 3000
   ```
3. Open your browser to `http://localhost:3000`.

In Google AI Studio, the application is automatically served at port 3000 and visible in the live preview window.

---

## 6. Supabase Configuration

When ready to link to a live Supabase project:

1. Log into your [Supabase Dashboard](https://supabase.com).
2. Create a new project named `faculty-availability-tracker`.
3. Open the **SQL Editor** in Supabase and execute the following in order:
   - `supabase/schema.sql` (Creates tables: `faculty`, `timetables`, `availability`, `availability_overrides`, `timetable_imports`)
   - `supabase/policies.sql` (Configures Row Level Security)
   - `supabase/seed.sql` (Loads sample faculty records)
4. Retrieve your **Project URL** and **anon public key** from *Project Settings > API*.
5. Paste them into `js/config.js`:
   ```javascript
   SUPABASE_URL: 'https://your-project.supabase.co',
   SUPABASE_ANON_KEY: 'your-anon-key'
   ```

*(Note: The application includes a transparent offline LocalStorage fallback, allowing complete evaluation and demonstration even without an active Supabase connection).*

---

## 7. Authentication & Role Permissions

The application implements three access tiers:

| Role | Access Permissions | Permitted Views |
|---|---|---|
| **Student** | Read-only access to active faculty, timetables, and availability. | `student.html` |
| **Faculty** | Read own schedule, update own current status, manage own overrides. | `student.html`, `faculty.html` |
| **Admin** | Full management access: add/edit faculty, timetables, imports, overrides. | `student.html`, `faculty.html`, `admin.html` |

Quick 1-click test credentials are provided directly on `login.html`:
- **Student**: `student@college.edu`
- **Faculty**: `rahul.sharma@college.edu`
- **Admin**: `admin@college.edu`

---

## 8. Deployment (Vercel)

The application includes an optimized `vercel.json` deployment configuration:
1. Push the project repository to GitHub.
2. Import the repository into [Vercel](https://vercel.com).
3. Framework Preset: **Other** / **Static** (or default Vite build if bundling via `npm run build`).
4. Root Directory: `./`
5. Click **Deploy**. Vercel will serve `index.html` as the default landing page with custom security headers and asset caching.

---

## 9. GitHub Workflow & Milestone Roadmap

Releases follow semantic milestone versions:
- `v0.1.0` - Static UI & Architecture (Completed)
- `v0.2.0` - Supabase Authentication & Role Guards (Completed)
- `v0.3.0` - Faculty Database & Search Engine (Completed)
- `v0.4.0` - Timetable Engine & Validation (Completed)
- `v0.5.0` - Central Availability & Overrides Engine (Completed)
- `v0.6.0` - Live CSV Timetable Import & Audit History (Completed)
- `v0.7.0` - Live Text-based PDF Timetable Import (Completed)
- `v0.8.0` - Security Hardening, RLS & Mobile Polish (Completed)
- `v1.0.0` - Final Production Release & Viva Defense Suite (Completed)

---

## 10. Current Version Status

- **Active Version**: `v1.0.0` (Production Release)
- **Milestone Name**: Production Release, Deployment Readiness & Complete Viva Defense Suite
- **Status**: Production Ready, Fully Verified, All Milestones Completed.
- **Viva Documentation**: See `docs/VIVA_PREPARATION.md` for the complete 10-minute presentation walkthrough and 20 examiner Q&As.

