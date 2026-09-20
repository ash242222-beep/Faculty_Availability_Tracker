/**
 * Faculty Availability Tracker - Authentication Module
 * Version: v0.2.0 (Milestone 2 - Authentication)
 * 
 * Manages Supabase Auth, local session synchronization,
 * role-based route protection, and 1-click demo test accounts.
 */

const AUTH_STORAGE_KEY = 'fat_current_user_v1';

// Preset demo accounts for quick role-testing
const DEMO_USERS = {
  student: {
    id: 'demo-student-id',
    email: 'student@college.edu',
    name: 'Aman Verma',
    role: 'student'
  },
  faculty: {
    id: 'demo-faculty-id',
    faculty_id: 'f1-rahul-sharma',
    email: 'rahul.sharma@college.edu',
    name: 'Dr. Rahul Sharma',
    role: 'faculty',
    department: 'Computer Engineering',
    room: 'Cabin 12'
  },
  admin: {
    id: 'demo-admin-id',
    email: 'admin@college.edu',
    name: 'College Administration',
    role: 'admin'
  }
};

/**
 * Returns currently stored authenticated user or null
 */
function getCurrentUser() {
  const userJson = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch (e) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

/**
 * Persists user session in local storage
 */
function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

/**
 * Register a new user account (Student or Faculty) via Supabase Auth or local store
 */
async function signUpUser(email, password, profileData = {}) {
  const role = profileData.role || 'student';
  const fullName = profileData.fullName || email.split('@')[0];
  const department = profileData.department || 'Computer Engineering';
  const designation = profileData.designation || (role === 'faculty' ? 'Assistant Professor' : '');
  const room = profileData.room || (role === 'faculty' ? 'Cabin 10' : '');

  const client = window.SupabaseService && window.SupabaseService.getClient();

  if (client) {
    try {
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            role: role,
            full_name: fullName,
            department: department,
            designation: designation,
            room: room
          }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const authUser = data.user;
      let facultyId = null;

      // If registered as faculty, insert into public.faculty table
      if (role === 'faculty' && authUser) {
        try {
          const { data: facultyRows, error: facErr } = await client
            .from('faculty')
            .insert([
              {
                full_name: fullName,
                email: email.trim(),
                department: department,
                designation: designation,
                room: room,
                is_active: true
              }
            ])
            .select();

          if (!facErr && facultyRows && facultyRows.length > 0) {
            facultyId = facultyRows[0].id;
            // Create default availability row
            await client.from('availability').upsert({
              faculty_id: facultyId,
              status: 'available',
              note: 'Account initialized'
            });
          }
        } catch (dbErr) {
          console.warn('Faculty table insert notice:', dbErr);
        }
      }

      const userObject = {
        id: authUser ? authUser.id : 'user-' + Date.now(),
        email: email.trim(),
        name: fullName,
        role: role,
        faculty_id: facultyId,
        department: department,
        room: room
      };

      setCurrentUser(userObject);
      return { 
        success: true, 
        user: userObject, 
        session: data.session,
        message: data.session ? 'Account created and signed in!' : 'Account registered. Please verify your email if confirmation is enabled, or sign in.'
      };
    } catch (ex) {
      return { success: false, error: ex.message || 'Registration failed.' };
    }
  }

  // Fallback to local store
  const store = window.DataStore ? window.DataStore.getStore() : null;
  let localFacultyId = null;

  if (role === 'faculty' && store) {
    localFacultyId = 'f-' + Date.now();
    const newFaculty = {
      id: localFacultyId,
      full_name: fullName,
      email: email.trim(),
      department: department,
      designation: designation,
      room: room,
      is_active: true,
      created_at: new Date().toISOString()
    };
    store.faculty = store.faculty || [];
    store.faculty.push(newFaculty);

    store.availability = store.availability || [];
    store.availability.push({
      faculty_id: localFacultyId,
      status: 'available',
      note: 'Account initialized',
      updated_at: new Date().toISOString()
    });

    window.DataStore.saveStore(store);
  }

  const localUser = {
    id: 'user-' + Date.now(),
    email: email.trim(),
    name: fullName,
    role: role,
    faculty_id: localFacultyId,
    department: department,
    room: room
  };

  setCurrentUser(localUser);
  return { success: true, user: localUser, message: 'Account created successfully in local demo mode.' };
}

/**
 * Sign in a user by role, credentials, or 1-click demo accounts
 */
async function loginUser(email, password, role, isDemoClick = false) {
  // If explicitly a demo button click or matches quick demo presets
  if (isDemoClick && role && DEMO_USERS[role]) {
    const user = DEMO_USERS[role];
    setCurrentUser(user);
    return { success: true, user };
  }

  const client = window.SupabaseService && window.SupabaseService.getClient();

  // If Supabase client is connected and real login was attempted
  if (client && email && password && !isDemoClick) {
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) {
        // If Supabase returns error, check if user is attempting demo credentials
        for (const key of Object.keys(DEMO_USERS)) {
          if (DEMO_USERS[key].email.toLowerCase() === email.trim().toLowerCase()) {
            const user = DEMO_USERS[key];
            setCurrentUser(user);
            return { success: true, user };
          }
        }
        return { success: false, error: error.message };
      }

      const authUser = data.user;
      const metadata = authUser.user_metadata || {};
      let detectedRole = metadata.role || role || 'student';
      let facultyId = metadata.faculty_id || null;
      let department = metadata.department || '';
      let room = metadata.room || '';

      // If user is faculty, fetch matching faculty record id
      if (detectedRole === 'faculty') {
        try {
          const { data: facultyRows } = await client
            .from('faculty')
            .select('*')
            .eq('email', email.trim())
            .limit(1);

          if (facultyRows && facultyRows.length > 0) {
            facultyId = facultyRows[0].id;
            department = facultyRows[0].department;
            room = facultyRows[0].room;
          }
        } catch (fetchErr) {
          console.warn('Faculty fetch warning:', fetchErr);
        }
      }

      const user = {
        id: authUser.id,
        email: authUser.email,
        name: metadata.full_name || email.split('@')[0],
        role: detectedRole,
        faculty_id: facultyId,
        department: department,
        room: room
      };

      setCurrentUser(user);
      return { success: true, user, session: data.session };
    } catch (err) {
      console.warn('Supabase auth network error, trying local fallback:', err);
    }
  }

  // Local / Demo credentials check
  for (const key of Object.keys(DEMO_USERS)) {
    if (DEMO_USERS[key].email.toLowerCase() === email.trim().toLowerCase()) {
      const user = DEMO_USERS[key];
      setCurrentUser(user);
      return { success: true, user };
    }
  }

  // General fallback for testing any valid email
  let detectedRole = role || 'student';
  if (email.includes('admin')) detectedRole = 'admin';
  else if (email.includes('faculty') || email.includes('prof') || email.includes('dr')) detectedRole = 'faculty';

  // Check if faculty exists in local store
  let facultyId = null;
  let department = '';
  let room = '';
  if (detectedRole === 'faculty' && window.DataStore) {
    const store = window.DataStore.getStore();
    const fac = (store.faculty || []).find(f => f.email.toLowerCase() === email.trim().toLowerCase()) || store.faculty[0];
    if (fac) {
      facultyId = fac.id;
      department = fac.department;
      room = fac.room;
    }
  }

  const user = {
    id: 'user-' + Date.now(),
    email: email.trim(),
    name: email.split('@')[0].replace('.', ' ').replace(/^./, str => str.toUpperCase()),
    role: detectedRole,
    faculty_id: facultyId,
    department: department,
    room: room
  };

  setCurrentUser(user);
  return { success: true, user };
}

/**
 * Log out current user and redirect to login page
 */
async function logoutUser() {
  const client = window.SupabaseService && window.SupabaseService.getClient();
  if (client) {
    try {
      await client.auth.signOut();
    } catch (e) {
      console.warn('Supabase sign out notice:', e);
    }
  }
  setCurrentUser(null);
  window.location.href = 'login.html';
}

/**
 * Get profile metadata of current user
 */
function getUserProfile() {
  return getCurrentUser();
}

/**
 * Protects a page based on required role.
 * If not authenticated, redirects to login.html.
 * If user lacks required role, redirects to their assigned dashboard.
 */
function requireRole(allowedRoles = ['student', 'faculty', 'admin']) {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
    return false;
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect to permitted home
    if (user.role === 'admin') window.location.href = 'admin.html';
    else if (user.role === 'faculty') window.location.href = 'faculty.html';
    else window.location.href = 'student.html';
    return false;
  }

  return true;
}

/**
 * Updates UI headers with user name & logout button
 */
function initHeaderAuth() {
  const user = getCurrentUser();
  const userDisplayEl = document.getElementById('header-user-info');
  const logoutBtn = document.getElementById('header-logout-btn');

  if (userDisplayEl) {
    if (user) {
      const roleLabel = user.role.toUpperCase();
      userDisplayEl.innerHTML = `<span class="auth-user-tag">${user.name} (${roleLabel})</span>`;
    } else {
      userDisplayEl.innerHTML = `<a href="login.html" class="btn btn-sm btn-secondary">Sign In</a>`;
    }
  }

  if (logoutBtn) {
    if (user) {
      logoutBtn.style.display = 'inline-flex';
      logoutBtn.onclick = () => logoutUser();
    } else {
      logoutBtn.style.display = 'none';
    }
  }
}

/**
 * Listen for Supabase auth state changes
 */
function initAuthListener() {
  const client = window.SupabaseService && window.SupabaseService.getClient();
  if (client) {
    try {
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          initHeaderAuth();
        } else if (event === 'SIGNED_IN' && session && session.user) {
          const u = getCurrentUser();
          if (!u || u.id !== session.user.id) {
            const meta = session.user.user_metadata || {};
            const restoredUser = {
              id: session.user.id,
              email: session.user.email,
              name: meta.full_name || session.user.email.split('@')[0],
              role: meta.role || 'student',
              faculty_id: meta.faculty_id || null
            };
            setCurrentUser(restoredUser);
            initHeaderAuth();
          }
        }
      });
    } catch (e) {
      console.warn('Auth state change listener notice:', e);
    }
  }
}

// Auto-initialize header and listener on document ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initHeaderAuth();
    initAuthListener();
  });
}

window.Auth = {
  getCurrentUser,
  setCurrentUser,
  signUpUser,
  loginUser,
  logoutUser,
  getUserProfile,
  requireRole,
  initHeaderAuth,
  DEMO_USERS
};

