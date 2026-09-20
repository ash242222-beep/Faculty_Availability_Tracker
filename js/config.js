/**
 * Faculty Availability Tracker - Configuration Module
 * Version: v0.1.0
 */

const APP_CONFIG = {
  VERSION: 'v0.1.0',
  APP_NAME: 'Faculty Availability Tracker',
  
  // Supabase Configuration (Will be filled when connecting Supabase in v0.2.0)
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  
  // Status definitions & human readable labels
  STATUSES: {
    available: { label: 'Available', badgeClass: 'badge-available' },
    in_class: { label: 'In Class', badgeClass: 'badge-in_class' },
    in_meeting: { label: 'In Meeting', badgeClass: 'badge-in_meeting' },
    present: { label: 'Present', badgeClass: 'badge-present' },
    unavailable: { label: 'Unavailable', badgeClass: 'badge-unavailable' },
    not_updated: { label: 'Not Updated', badgeClass: 'badge-not_updated' }
  },

  // Standard College Departments
  DEPARTMENTS: [
    'All Departments',
    'Computer Engineering',
    'Information Technology',
    'Electronics Engineering',
    'Mechanical Engineering',
    'Civil Engineering'
  ]
};

window.APP_CONFIG = APP_CONFIG;
