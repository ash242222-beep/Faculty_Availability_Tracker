/**
 * Faculty Availability Tracker - Authentication Module
 * Version: v0.1.0
 * 
 * Handles user authentication state, role-based page protection,
 * and quick-login helpers for demo / viva testing.
 */

const AUTH_STORAGE_KEY = 'fat_current_user_v1';

// Preset demo accounts for quick role-testing in v0.1.0
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
 * Returns current authenticated user or null
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
 * Log in a user by role or email/password
 */
function loginUser(email, password, role) {
  // If role is specified from demo shortcut
  if (role && DEMO_USERS[role]) {
    const user = DEMO_USERS[role];
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return { success: true, user };
  }

  // Check against known demo emails
  for (const key of Object.keys(DEMO_USERS)) {
    if (DEMO_USERS[key].email.toLowerCase() === email.toLowerCase()) {
      const user = DEMO_USERS[key];
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      return { success: true, user };
    }
  }

  // Fallback: If email has 'admin', grant admin; if 'faculty', grant faculty; else student
  let detectedRole = 'student';
  if (email.includes('admin')) detectedRole = 'admin';
  else if (email.includes('faculty') || email.includes('prof') || email.includes('dr')) detectedRole = 'faculty';

  const user = {
    id: 'user-' + Date.now(),
    email: email,
    name: email.split('@')[0].replace('.', ' ').toUpperCase(),
    role: detectedRole,
    faculty_id: detectedRole === 'faculty' ? 'f1-rahul-sharma' : null
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  return { success: true, user };
}

/**
 * Log out current user and redirect to login page
 */
function logoutUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
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
 * Updates UI headers with user name & logout button if present
 */
function initHeaderAuth() {
  const user = getCurrentUser();
  const userDisplayEl = document.getElementById('header-user-info');
  const logoutBtn = document.getElementById('header-logout-btn');

  if (userDisplayEl) {
    if (user) {
      userDisplayEl.innerHTML = `<span class="auth-user-tag">${user.name} (${user.role.toUpperCase()})</span>`;
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

window.Auth = {
  getCurrentUser,
  loginUser,
  logoutUser,
  getUserProfile,
  requireRole,
  initHeaderAuth,
  DEMO_USERS
};
