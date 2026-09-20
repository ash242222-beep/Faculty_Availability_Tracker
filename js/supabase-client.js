/**
 * Faculty Availability Tracker - Supabase Client & Local Mock Store
 * Version: v0.2.0 (Milestone 2 - Authentication)
 * 
 * Manages Supabase client initialization with seamless fallback to localStorage DataStore.
 */

let _supabaseClientInstance = null;

function initSupabaseClient() {
  const url = (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL) || '';
  const key = (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_ANON_KEY) || '';

  if (url && key) {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        _supabaseClientInstance = window.supabase.createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
        console.info('Supabase client initialized successfully with URL:', url);
        return _supabaseClientInstance;
      } catch (err) {
        console.warn('Failed to initialize Supabase client:', err);
        _supabaseClientInstance = null;
      }
    }
  }
  return null;
}

function getSupabaseClient() {
  if (!_supabaseClientInstance) {
    initSupabaseClient();
  }
  return _supabaseClientInstance;
}

function isSupabaseConfigured() {
  return !!getSupabaseClient();
}

function setSupabaseCredentials(url, key) {
  if (url && key) {
    localStorage.setItem('fat_supabase_url', url.trim());
    localStorage.setItem('fat_supabase_anon_key', key.trim());
    if (window.APP_CONFIG) {
      window.APP_CONFIG.SUPABASE_URL = url.trim();
      window.APP_CONFIG.SUPABASE_ANON_KEY = key.trim();
    }
    _supabaseClientInstance = null;
    return initSupabaseClient();
  } else {
    localStorage.removeItem('fat_supabase_url');
    localStorage.removeItem('fat_supabase_anon_key');
    if (window.APP_CONFIG) {
      window.APP_CONFIG.SUPABASE_URL = '';
      window.APP_CONFIG.SUPABASE_ANON_KEY = '';
    }
    _supabaseClientInstance = null;
    return null;
  }
}

// Try auto-initialization at load time
if (typeof window !== 'undefined') {
  initSupabaseClient();
}

const INITIAL_SAMPLE_DATA = {
  faculty: [
    {
      id: 'f1-rahul-sharma',
      full_name: 'Dr. Rahul Sharma',
      email: 'rahul.sharma@college.edu',
      department: 'Computer Engineering',
      designation: 'Professor',
      room: 'Cabin 12',
      is_active: true,
      created_at: '2026-09-01T09:00:00Z'
    },
    {
      id: 'f2-priya-mehta',
      full_name: 'Dr. Priya Mehta',
      email: 'priya.mehta@college.edu',
      department: 'Information Technology',
      designation: 'Associate Professor',
      room: 'Cabin 8',
      is_active: true,
      created_at: '2026-09-01T09:00:00Z'
    },
    {
      id: 'f3-arvind-patel',
      full_name: 'Prof. Arvind Patel',
      email: 'arvind.patel@college.edu',
      department: 'Electronics Engineering',
      designation: 'Assistant Professor',
      room: 'Cabin 15',
      is_active: true,
      created_at: '2026-09-01T09:00:00Z'
    },
    {
      id: 'f4-ananya-sen',
      full_name: 'Dr. Ananya Sen',
      email: 'ananya.sen@college.edu',
      department: 'Mechanical Engineering',
      designation: 'Associate Professor',
      room: 'Cabin 22',
      is_active: true,
      created_at: '2026-09-01T09:00:00Z'
    },
    {
      id: 'f5-vikram-joshi',
      full_name: 'Prof. Vikram Joshi',
      email: 'vikram.joshi@college.edu',
      department: 'Computer Engineering',
      designation: 'Assistant Professor',
      room: 'Cabin 05',
      is_active: false,
      created_at: '2026-09-01T09:00:00Z'
    }
  ],
  timetables: [
    {
      id: 't1',
      faculty_id: 'f1-rahul-sharma',
      day_of_week: 'Monday',
      start_time: '09:00',
      end_time: '10:00',
      activity: 'CS301 - Operating Systems',
      room: 'LH-101',
      is_active: true
    },
    {
      id: 't2',
      faculty_id: 'f1-rahul-sharma',
      day_of_week: 'Monday',
      start_time: '10:00',
      end_time: '11:00',
      activity: 'CS402 - Data Structures Lab',
      room: 'Lab 2',
      is_active: true
    },
    {
      id: 't3',
      faculty_id: 'f1-rahul-sharma',
      day_of_week: 'Monday',
      start_time: '14:00',
      end_time: '15:30',
      activity: 'CS505 - Advanced Algorithms',
      room: 'LH-104',
      is_active: true
    },
    {
      id: 't4',
      faculty_id: 'f1-rahul-sharma',
      day_of_week: 'Tuesday',
      start_time: '10:00',
      end_time: '11:30',
      activity: 'CS301 - OS Lab',
      room: 'Lab 1',
      is_active: true
    },
    {
      id: 't5',
      faculty_id: 'f1-rahul-sharma',
      day_of_week: 'Wednesday',
      start_time: '11:00',
      end_time: '12:00',
      activity: 'Department Faculty Meeting',
      room: 'Conference Room A',
      is_active: true
    },
    {
      id: 't6',
      faculty_id: 'f2-priya-mehta',
      day_of_week: 'Monday',
      start_time: '10:30',
      end_time: '12:00',
      activity: 'IT204 - Database Management Systems',
      room: 'LH-201',
      is_active: true
    },
    {
      id: 't7',
      faculty_id: 'f2-priya-mehta',
      day_of_week: 'Tuesday',
      start_time: '13:00',
      end_time: '15:00',
      activity: 'IT204 - DBMS Practical Lab',
      room: 'IT Lab 3',
      is_active: true
    }
  ],
  availability: [
    {
      faculty_id: 'f1-rahul-sharma',
      status: 'available',
      note: 'In cabin for student doubt clarification',
      updated_at: new Date().toISOString()
    },
    {
      faculty_id: 'f2-priya-mehta',
      status: 'in_meeting',
      note: 'Faculty council meeting in Dean office',
      updated_at: new Date().toISOString()
    },
    {
      faculty_id: 'f3-arvind-patel',
      status: 'present',
      note: 'Working on research project in cabin',
      updated_at: new Date().toISOString()
    },
    {
      faculty_id: 'f4-ananya-sen',
      status: 'unavailable',
      note: 'On official duty leave',
      updated_at: new Date().toISOString()
    }
  ],
  overrides: [
    {
      id: 'ov-1',
      faculty_id: 'f1-rahul-sharma',
      date: new Date().toISOString().split('T')[0],
      start_time: '10:00',
      end_time: '11:00',
      status: 'available',
      note: 'Lab lecture rescheduled; available in Cabin 12 for student questions',
      created_at: new Date().toISOString()
    }
  ]
};

// Initialize or retrieve localStorage store
function getStore() {
  const stored = localStorage.getItem('fat_store_v1');
  if (!stored) {
    localStorage.setItem('fat_store_v1', JSON.stringify(INITIAL_SAMPLE_DATA));
    return JSON.parse(JSON.stringify(INITIAL_SAMPLE_DATA));
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Error reading store from localStorage, resetting to initial', e);
    localStorage.setItem('fat_store_v1', JSON.stringify(INITIAL_SAMPLE_DATA));
    return JSON.parse(JSON.stringify(INITIAL_SAMPLE_DATA));
  }
}

function saveStore(store) {
  localStorage.setItem('fat_store_v1', JSON.stringify(store));
}

// Reset store to initial state (for testing & viva demonstration)
function resetStoreToDefault() {
  localStorage.setItem('fat_store_v1', JSON.stringify(INITIAL_SAMPLE_DATA));
  return getStore();
}

window.DataStore = {
  getStore,
  saveStore,
  resetStoreToDefault
};

window.SupabaseService = {
  getClient: getSupabaseClient,
  isConfigured: isSupabaseConfigured,
  setCredentials: setSupabaseCredentials,
  init: initSupabaseClient
};
