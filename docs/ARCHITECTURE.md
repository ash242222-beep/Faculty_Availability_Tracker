# System Architecture & Technical Specifications

## 1. System Overview
```text
Browser Client (Vanilla HTML5 + CSS3 + Vanilla ES6 JS)
    │
    ├── Public Pages: index.html, login.html
    ├── Protected Dashboards: student.html, faculty.html, admin.html
    │
    ├── Shared Modules:
    │     ├── js/config.js           (Environment constants, Supabase keys)
    │     ├── js/supabase-client.js  (Supabase JS Client + Local Demo Store)
    │     ├── js/auth.js             (Auth state, role guards, route protection)
    │     ├── js/utils.js            (Central getFacultyAvailability logic)
    │     ├── js/timetable-import.js (CSV & PDF.js Parser & Validator)
    │     └── css/style.css          (Clean, responsive, vanilla stylesheet)
    │
    ▼
Supabase BaaS / Backend Services
    ├── Supabase Auth (Email/Password JWT authentication)
    ├── PostgreSQL 15 Database (ACID relational storage)
    └── Row Level Security (RLS policies enforcing Role-Based Access Control)
```

## 2. Relational Database Schema
- **`faculty`**:
  - `id`: UUID PRIMARY KEY (Internal identifier, never displayed to students)
  - `full_name`: TEXT NOT NULL
  - `email`: TEXT UNIQUE NOT NULL
  - `department`: TEXT NOT NULL
  - `designation`: TEXT NOT NULL
  - `room`: TEXT NOT NULL (Cabin/Office number)
  - `is_active`: BOOLEAN DEFAULT true (Paused faculty marked false)
  - `created_at`: TIMESTAMPTZ DEFAULT now()
- **`timetables`**:
  - `id`: UUID PRIMARY KEY
  - `faculty_id`: UUID REFERENCES faculty(id) ON DELETE CASCADE
  - `day_of_week`: TEXT (e.g., 'Monday', 'Tuesday', ...)
  - `start_time`: TIME (HH:MM)
  - `end_time`: TIME (HH:MM, must be > start_time)
  - `activity`: TEXT NOT NULL
  - `room`: TEXT
  - `is_active`: BOOLEAN DEFAULT true
  - `created_at`: TIMESTAMPTZ DEFAULT now()
- **`availability`**:
  - `id`: UUID PRIMARY KEY
  - `faculty_id`: UUID UNIQUE REFERENCES faculty(id) ON DELETE CASCADE
  - `status`: TEXT CHECK (status IN ('available', 'in_class', 'in_meeting', 'present', 'unavailable', 'not_updated'))
  - `note`: TEXT
  - `updated_at`: TIMESTAMPTZ DEFAULT now()
- **`availability_overrides`**:
  - `id`: UUID PRIMARY KEY
  - `faculty_id`: UUID REFERENCES faculty(id) ON DELETE CASCADE
  - `date`: DATE NOT NULL (YYYY-MM-DD)
  - `start_time`: TIME NOT NULL
  - `end_time`: TIME NOT NULL (must be > start_time)
  - `status`: TEXT NOT NULL
  - `note`: TEXT
  - `created_by`: UUID REFERENCES auth.users(id)
  - `created_at`: TIMESTAMPTZ DEFAULT now()
- **`timetable_imports`**:
  - `id`: UUID PRIMARY KEY
  - `file_name`: TEXT NOT NULL
  - `file_type`: TEXT NOT NULL ('csv' or 'pdf')
  - `uploaded_by`: TEXT NOT NULL
  - `rows_detected`: INT NOT NULL
  - `rows_imported`: INT NOT NULL
  - `status`: TEXT ('success', 'partial', 'failed')
  - `created_at`: TIMESTAMPTZ DEFAULT now()

## 3. Availability Resolution Hierarchy
The core resolution algorithm is defined in `js/utils.js`:
```js
getFacultyAvailability(facultyId, targetDate, targetTime)
```
1. **Inactive Check**: If `faculty.is_active === false`, returns `{ status: 'unavailable', note: 'Faculty account currently inactive', source: 'account_status' }`.
2. **Override Check**: Looks for any override in `availability_overrides` matching `faculty_id`, `date === targetDate`, and `start_time <= targetTime < end_time`. If present, returns the override status and note.
3. **Timetable Check**: Calculates day of week from `targetDate`, finds matching timetable entry where `day_of_week === targetDay` and `start_time <= targetTime < end_time`. If present, returns `{ status: 'in_class', activity: entry.activity, room: entry.room, source: 'timetable' }`.
4. **Current Status**: If target date/time is currently now, checks `availability` table for the faculty member's manual status.
5. **Fallback**: Returns `{ status: 'not_updated', source: 'default' }`.
