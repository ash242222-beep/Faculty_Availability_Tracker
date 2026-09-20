/**
 * Faculty Availability Tracker - Configuration Module
 * Version: v0.2.0 (Milestone 2 - Authentication)
 */

const APP_CONFIG = {
  VERSION: 'v0.2.0',
  APP_NAME: 'Faculty Availability Tracker',
  
  // Supabase Configuration
  // Checked first from localStorage so credentials can be set live in preview or deployed environments
  SUPABASE_URL: (typeof localStorage !== 'undefined' && localStorage.getItem('fat_supabase_url')) || '',
  SUPABASE_ANON_KEY: (typeof localStorage !== 'undefined' && localStorage.getItem('fat_supabase_anon_key')) || '',
  
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
