# Row Level Security (RLS) & Security Audit Specification

**Version:** `v0.8.0`  
**Milestone:** 8 — Security & Polish  
**System:** Faculty Availability Tracker  
**Database:** PostgreSQL (Supabase)

---

## 1. Executive Summary & Threat Model

The **Faculty Availability Tracker** serves three primary user cohorts within an academic institution:
1. **Public / Students (Anonymous or Student Role)**: Needs instant, fast lookup of faculty schedules, office locations, and live availability without administrative friction. Under no circumstances should students be able to alter faculty profiles, inject false availability statuses, or tamper with department timetables.
2. **Faculty Members (Authenticated Faculty Role)**: Needs autonomous authority to update their own live availability status (e.g., "Available in Cabin", "In Meeting"), post schedule overrides (e.g., medical leave, exam duties), and edit personal cabin/designation metadata. Must be strictly barred from tampering with fellow faculty members' statuses or modifying master departmental timetables.
3. **Institutional Administrators (Authenticated Admin Role)**: Super-user authority to maintain the registered faculty roster, perform bulk timetable CSV/PDF imports, delete or reschedule timetable entries, and inspect audit trails.

---

## 2. Role-Based Access Control (RBAC) Matrix

| Table | Operation | Anonymous / Student | Faculty Member | College Administrator |
|---|---|---|---|---|
| **`faculty`** | `SELECT` | Allowed (Read active roster) | Allowed | Allowed |
| | `INSERT` | Denied | Denied | Allowed |
| | `UPDATE` | Denied | Allowed (Own profile only: `user_id = auth.uid()` or `email`) | Allowed |
| | `DELETE` | Denied | Denied | Allowed |
| **`timetables`** | `SELECT` | Allowed (Weekly schedule view) | Allowed | Allowed |
| | `INSERT` | Denied | Denied | Allowed |
| | `UPDATE` | Denied | Denied | Allowed |
| | `DELETE` | Denied | Denied | Allowed |
| **`availability`** | `SELECT` | Allowed (Live status indicator) | Allowed | Allowed |
| | `INSERT` / `UPDATE` | Denied | Allowed (Own `faculty_id` only) | Allowed |
| | `DELETE` | Denied | Allowed (Own `faculty_id` only) | Allowed |
| **`availability_overrides`** | `SELECT` | Allowed (Temporary status overrides) | Allowed | Allowed |
| | `INSERT` / `UPDATE` | Denied | Allowed (Own `faculty_id` only) | Allowed |
| | `DELETE` | Denied | Allowed (Own `faculty_id` only) | Allowed |
| **`timetable_imports`** | `SELECT` | Denied (Internal audit log) | Denied | Allowed |
| | `INSERT` | Denied | Denied | Allowed (Audit logger) |
| | `DELETE` | Denied | Denied | Allowed |

---

## 3. Policy Implementation Verification

All policies reside in `supabase/policies.sql` and enforce:
1. **Zero Trust Default**: All 5 core tables explicitly enable `ROW LEVEL SECURITY`. If no policy matches an incoming query, PostgreSQL defaults to denying access.
2. **Deterministic Role Resolution**: `public.get_user_role()` safely parses the cryptographic JWT claims (`user_metadata ->> 'role'` and `app_metadata ->> 'role'`), defaulting securely to `'student'` if absent or malformed.
3. **Idempotency**: All policy definitions use `DROP POLICY IF EXISTS` prior to `CREATE POLICY`, preventing migration aborts during CI/CD or SQL editor reruns.

---

## 4. Manual Verification Queries (Supabase SQL Editor)

```sql
-- 1. Check that RLS is active on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('faculty', 'timetables', 'availability', 'availability_overrides', 'timetable_imports');

-- 2. Verify registered policies
SELECT schemaname, tablename, policyname, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Verify function execution permissions
SELECT has_function_privilege('anon', 'public.get_user_role()', 'execute');
SELECT has_function_privilege('authenticated', 'public.get_user_role()', 'execute');
```

---

## 5. Client-Side Defensive Security Layer

In addition to PostgreSQL RLS, the client application implements defensive guards:
- **Route Guarding (`js/auth.js`)**: Non-admin users attempting to access `admin.html` are redirected with descriptive warnings. Non-faculty users attempting to access `faculty.html` are guided to sign in with appropriate credentials.
- **Input Sanitization & Normalization (`js/utils.js` & `js/timetable-import.js`)**: All user inputs (times, names, rooms) are validated against strict regex patterns before any database dispatch.
- **Auditing (`js/import-service.js`)**: File uploads record file names, SHA sizes, and execution timestamps into PostgreSQL for institutional governance.
