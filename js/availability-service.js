/**
 * Faculty Availability Tracker - Central Availability & Overrides Service Layer
 * Version: v0.5.0 (Milestone 5 - Central Availability & Overrides Engine)
 * 
 * Provides:
 * - Direct Supabase CRUD on `public.availability` & `public.availability_overrides` with DataStore fallback.
 * - Strict 5-tier availability resolution engine:
 *     1. Inactive Faculty Check
 *     2. Time-Specific Availability Override
 *     3. Regular Timetable Check
 *     4. Current / Manual Availability Status
 *     5. Default / Not Updated
 * - Comprehensive Override Validation & Conflict Detection:
 *     - Start time < End time & HH:MM format checks
 *     - Duration boundaries (min 15m, max 24h)
 *     - Self-Override Overlap Guard (blocks overlapping overrides on same date for same faculty)
 *     - Regular Timetable Advisory (notifies when an override replaces or coincides with a class)
 * - Realtime Supabase Channels & Reactive DOM CustomEvent broadcasting.
 */

(function (window) {
  'use strict';

  let realtimeChannel = null;

  /**
   * Helper: Get current Supabase client or null
   */
  function getClient() {
    return window.SupabaseService ? window.SupabaseService.getClient() : null;
  }

  /**
   * Dispatch local CustomEvents to keep all components & open tabs reactive
   */
  function broadcastAvailabilityChange(action, payload) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('availability-data-changed', {
        detail: { action, payload, timestamp: Date.now() }
      }));
    }
  }

  function broadcastOverrideChange(action, payload) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('override-data-changed', {
        detail: { action, payload, timestamp: Date.now() }
      }));
    }
  }

  /**
   * Initialize Supabase Realtime Channel if available
   */
  function initRealtime() {
    const client = getClient();
    if (!client || realtimeChannel) return;

    try {
      realtimeChannel = client.channel('realtime:availability-overrides')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'availability' }, (payload) => {
          console.info('[Realtime] Availability table changed:', payload.eventType);
          broadcastAvailabilityChange('remote-change', payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_overrides' }, (payload) => {
          console.info('[Realtime] Overrides table changed:', payload.eventType);
          broadcastOverrideChange('remote-change', payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.info('Subscribed to Supabase Realtime for availability & overrides');
          }
        });
    } catch (err) {
      console.warn('Realtime channel subscription notice:', err);
    }
  }

  // Attempt realtime init on load
  if (typeof window !== 'undefined') {
    setTimeout(initRealtime, 800);
  }

  // =========================================================================
  // SECTION 1: OVERRIDE VALIDATION & CONFLICT CHECKING ENGINE
  // =========================================================================

  /**
   * Validates an override payload against timing rules, self-overlap, and timetable schedule.
   * 
   * @param {Object} overrideData { faculty_id, date, start_time, end_time, status, note }
   * @param {string|null} currentEditId ID to exclude during collision checks
   * @returns {Object} { isValid: boolean, errors: string[], warnings: string[] }
   */
  function validateOverride(overrideData, currentEditId = null) {
    const errors = [];
    const warnings = [];

    if (!overrideData.faculty_id) {
      errors.push('Faculty selection is required.');
    }

    if (!overrideData.date) {
      errors.push('Target date is required.');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(overrideData.date)) {
      errors.push('Target date must be in YYYY-MM-DD format.');
    }

    const start = overrideData.start_time;
    const end = overrideData.end_time;

    if (!start || !end) {
      errors.push('Both start time and end time are required.');
    } else {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) {
        errors.push('Time must be in valid HH:MM 24-hour format.');
      } else if (window.Utils.compareTime(start, end) >= 0) {
        errors.push('End time must be strictly after start time.');
      } else {
        // Calculate duration boundaries
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);

        if (durationMinutes < 15) {
          errors.push('Override duration must be at least 15 minutes.');
        } else if (durationMinutes > 24 * 60) {
          errors.push('Override duration cannot exceed 24 hours in a single entry.');
        }
      }
    }

    const validStatuses = ['available', 'present', 'in_meeting', 'unavailable', 'in_class'];
    if (!overrideData.status || !validStatuses.includes(overrideData.status)) {
      errors.push(`Status must be one of: ${validStatuses.join(', ')}.`);
    }

    // If basic structure has errors, return early before deep collision analysis
    if (errors.length > 0) {
      return { isValid: false, errors, warnings };
    }

    const store = window.DataStore ? window.DataStore.getStore() : { overrides: [], timetables: [] };
    const overrides = store.overrides || [];

    // 1. Check for overlapping overrides for the same faculty on the same date
    const existingFacultyOverrides = overrides.filter(o =>
      o.faculty_id === overrideData.faculty_id &&
      o.date === overrideData.date &&
      o.id !== currentEditId
    );

    const conflictingOverride = existingFacultyOverrides.find(o =>
      window.Utils.isTimeOverlap(start, end, o.start_time, o.end_time)
    );

    if (conflictingOverride) {
      const confStatus = window.Utils.getStatusDisplay(conflictingOverride.status).label;
      errors.push(
        `Time Overlap Conflict: An existing override (${confStatus} from ${window.Utils.formatTime12Hour(conflictingOverride.start_time)} to ${window.Utils.formatTime12Hour(conflictingOverride.end_time)}) already covers this time window.`
      );
    }

    // 2. Advisory check against scheduled timetable classes
    const dayName = window.Utils.getDayName(overrideData.date);
    const timetables = store.timetables || [];
    const scheduledClasses = timetables.filter(t =>
      t.faculty_id === overrideData.faculty_id &&
      t.day_of_week === dayName &&
      t.is_active !== false
    );

    const overlappingClasses = scheduledClasses.filter(t =>
      window.Utils.isTimeOverlap(start, end, t.start_time, t.end_time)
    );

    if (overlappingClasses.length > 0) {
      const classNames = overlappingClasses.map(c => `"${c.activity}" (${window.Utils.formatTime12Hour(c.start_time)} - ${window.Utils.formatTime12Hour(c.end_time)})`).join(', ');
      warnings.push(`Notice: This override overlaps with scheduled class ${classNames} and will take precedence in student availability queries.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // =========================================================================
  // SECTION 2: MANUAL / IMMEDIATE AVAILABILITY CRUD
  // =========================================================================

  /**
   * Get current manual availability record for a faculty member
   */
  async function getManualAvailability(facultyId) {
    const client = getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('availability')
          .select('*')
          .eq('faculty_id', facultyId)
          .maybeSingle();

        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn('Supabase getManualAvailability fallback to store:', err);
      }
    }

    const store = window.DataStore ? window.DataStore.getStore() : { availability: [] };
    return (store.availability || []).find(a => a.faculty_id === facultyId) || null;
  }

  /**
   * Get all manual availability records
   */
  async function getAllManualAvailability() {
    const client = getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('availability')
          .select('*');

        if (!error && data) {
          // Sync with local store
          const store = window.DataStore ? window.DataStore.getStore() : { availability: [] };
          store.availability = data;
          window.DataStore.saveStore(store);
          return data;
        }
      } catch (err) {
        console.warn('Supabase getAllManualAvailability fallback:', err);
      }
    }

    const store = window.DataStore ? window.DataStore.getStore() : { availability: [] };
    return store.availability || [];
  }

  /**
   * Update or insert manual status for a faculty member
   */
  async function updateManualStatus(facultyId, status, note = '') {
    if (!facultyId || !status) {
      return { success: false, error: 'Faculty ID and Status are required.' };
    }

    const validStatuses = ['available', 'present', 'in_meeting', 'unavailable', 'not_updated', 'in_class'];
    if (!validStatuses.includes(status)) {
      return { success: false, error: 'Invalid status value.' };
    }

    const client = getClient();
    const timestamp = new Date().toISOString();
    let savedRecord = null;

    if (client) {
      try {
        const { data, error } = await client
          .from('availability')
          .upsert({
            faculty_id: facultyId,
            status: status,
            note: note || '',
            updated_at: timestamp
          }, { onConflict: 'faculty_id' })
          .select()
          .single();

        if (!error && data) {
          savedRecord = data;
        } else if (error) {
          console.warn('Supabase updateManualStatus error:', error.message);
        }
      } catch (err) {
        console.warn('Supabase updateManualStatus exception, falling back:', err);
      }
    }

    // Update in local store
    const store = window.DataStore.getStore();
    if (!store.availability) store.availability = [];
    const idx = store.availability.findIndex(a => a.faculty_id === facultyId);

    const record = savedRecord || {
      id: 'av-' + facultyId,
      faculty_id: facultyId,
      status: status,
      note: note || '',
      updated_at: timestamp
    };

    if (idx >= 0) {
      store.availability[idx] = record;
    } else {
      store.availability.push(record);
    }
    window.DataStore.saveStore(store);

    broadcastAvailabilityChange('status-updated', record);
    return { success: true, data: record };
  }

  // =========================================================================
  // SECTION 3: AVAILABILITY OVERRIDES CRUD
  // =========================================================================

  /**
   * Get all overrides with optional filtering
   * 
   * @param {Object} filters { facultyId, date, status, onlyActiveOrUpcoming }
   */
  async function getAllOverrides(filters = {}) {
    const client = getClient();

    if (client) {
      try {
        let query = client.from('availability_overrides').select('*');

        if (filters.facultyId && filters.facultyId !== 'all') {
          query = query.eq('faculty_id', filters.facultyId);
        }
        if (filters.date) {
          query = query.eq('date', filters.date);
        }
        if (filters.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }

        const { data, error } = await query.order('date', { ascending: true }).order('start_time', { ascending: true });

        if (!error && data) {
          // Sync with local store
          const store = window.DataStore ? window.DataStore.getStore() : { overrides: [] };
          // Merge remote overrides
          if (filters.facultyId === 'all' && !filters.date && !filters.status) {
            store.overrides = data;
            window.DataStore.saveStore(store);
          }
          return filterOverridesList(data, filters);
        }
      } catch (err) {
        console.warn('Supabase getAllOverrides fallback:', err);
      }
    }

    const store = window.DataStore ? window.DataStore.getStore() : { overrides: [] };
    return filterOverridesList(store.overrides || [], filters);
  }

  function filterOverridesList(list, filters) {
    let result = [...list];

    if (filters.facultyId && filters.facultyId !== 'all') {
      result = result.filter(o => o.faculty_id === filters.facultyId);
    }
    if (filters.date) {
      result = result.filter(o => o.date === filters.date);
    }
    if (filters.status && filters.status !== 'all') {
      result = result.filter(o => o.status === filters.status);
    }
    if (filters.onlyActiveOrUpcoming) {
      const today = new Date().toISOString().split('T')[0];
      result = result.filter(o => o.date >= today);
    }

    result.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return window.Utils.compareTime(a.start_time, b.start_time);
    });

    return result;
  }

  /**
   * Get single override by ID
   */
  async function getOverrideById(overrideId) {
    const client = getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('availability_overrides')
          .select('*')
          .eq('id', overrideId)
          .single();

        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase getOverrideById error, falling back:', err);
      }
    }

    const store = window.DataStore.getStore();
    return (store.overrides || []).find(o => o.id === overrideId) || null;
  }

  /**
   * Add a new availability override
   */
  async function addOverride(overrideData) {
    const validation = validateOverride(overrideData, null);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join(' ') };
    }

    const client = getClient();
    let savedRecord = null;
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;

    const payload = {
      faculty_id: overrideData.faculty_id,
      date: overrideData.date,
      start_time: overrideData.start_time,
      end_time: overrideData.end_time,
      status: overrideData.status,
      note: overrideData.note ? overrideData.note.trim() : '',
      created_by: currentUser && currentUser.id ? currentUser.id : null,
      created_at: new Date().toISOString()
    };

    if (client) {
      try {
        const { data, error } = await client
          .from('availability_overrides')
          .insert([payload])
          .select()
          .single();

        if (!error && data) {
          savedRecord = data;
        } else if (error) {
          console.warn('Supabase addOverride error:', error.message);
        }
      } catch (err) {
        console.warn('Supabase addOverride exception:', err);
      }
    }

    // Save to local store
    const store = window.DataStore.getStore();
    if (!store.overrides) store.overrides = [];

    const newEntry = savedRecord || {
      ...payload,
      id: 'ov-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)
    };

    store.overrides.push(newEntry);
    window.DataStore.saveStore(store);

    broadcastOverrideChange('created', newEntry);
    return {
      success: true,
      data: newEntry,
      warnings: validation.warnings
    };
  }

  /**
   * Update an existing availability override
   */
  async function updateOverride(overrideId, overrideData) {
    const validation = validateOverride(overrideData, overrideId);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join(' ') };
    }

    const client = getClient();
    let savedRecord = null;

    const payload = {
      faculty_id: overrideData.faculty_id,
      date: overrideData.date,
      start_time: overrideData.start_time,
      end_time: overrideData.end_time,
      status: overrideData.status,
      note: overrideData.note ? overrideData.note.trim() : ''
    };

    if (client) {
      try {
        const { data, error } = await client
          .from('availability_overrides')
          .update(payload)
          .eq('id', overrideId)
          .select()
          .single();

        if (!error && data) {
          savedRecord = data;
        } else if (error) {
          console.warn('Supabase updateOverride error:', error.message);
        }
      } catch (err) {
        console.warn('Supabase updateOverride exception:', err);
      }
    }

    const store = window.DataStore.getStore();
    if (!store.overrides) store.overrides = [];
    const idx = store.overrides.findIndex(o => o.id === overrideId);

    if (idx >= 0) {
      store.overrides[idx] = savedRecord || {
        ...store.overrides[idx],
        ...payload
      };
      window.DataStore.saveStore(store);
      broadcastOverrideChange('updated', store.overrides[idx]);
      return {
        success: true,
        data: store.overrides[idx],
        warnings: validation.warnings
      };
    }

    return { success: false, error: 'Override record not found.' };
  }

  /**
   * Delete an override
   */
  async function deleteOverride(overrideId) {
    const client = getClient();

    if (client) {
      try {
        const { error } = await client
          .from('availability_overrides')
          .delete()
          .eq('id', overrideId);

        if (error) {
          console.warn('Supabase deleteOverride error:', error.message);
        }
      } catch (err) {
        console.warn('Supabase deleteOverride exception:', err);
      }
    }

    const store = window.DataStore.getStore();
    if (store.overrides) {
      store.overrides = store.overrides.filter(o => o.id !== overrideId);
      window.DataStore.saveStore(store);
    }

    broadcastOverrideChange('deleted', { id: overrideId });
    return { success: true };
  }

  // =========================================================================
  // SECTION 4: CENTRAL MULTI-TIER AVAILABILITY RESOLUTION ENGINE
  // =========================================================================

  /**
   * Synchronous / Cached Availability Resolution
   * Implements strict 5-tier evaluation:
   *   Tier 1: Inactive Account Check
   *   Tier 2: Active Temporary Override Check
   *   Tier 3: Regular Scheduled Timetable Check
   *   Tier 4: Current / Manual Availability Status
   *   Tier 5: Fallback ("not_updated")
   * 
   * @param {string} facultyId
   * @param {string} date YYYY-MM-DD
   * @param {string} time HH:MM (24-hr)
   * @returns {Object} Structured availability resolution
   */
  function resolveFacultyAvailability(facultyId, date, time, facultyObj = null) {
    const store = window.DataStore ? window.DataStore.getStore() : {};
    const facultyList = store.faculty || [];
    const faculty = facultyObj || facultyList.find(f => f.id === facultyId) || {
      id: facultyId,
      full_name: 'Faculty Member',
      department: 'General',
      room: 'Campus Cabin',
      is_active: true
    };

    // Tier 1: Inactive Account Check
    if (faculty.is_active === false) {
      return {
        status: 'unavailable',
        activity: null,
        room: faculty.room,
        note: 'Faculty account currently inactive or on temporary hiatus.',
        source: 'inactive_account',
        ruleSummary: 'Account paused by department administration.'
      };
    }

    // Tier 2: Active Temporary Override Check
    const overrides = (store.overrides || []).filter(ov =>
      ov.faculty_id === facultyId && ov.date === date
    );

    const matchedOverride = overrides.find(ov =>
      window.Utils.isTimeBetween(time, ov.start_time, ov.end_time)
    );

    if (matchedOverride) {
      const windowStr = `${window.Utils.formatTime12Hour(matchedOverride.start_time)} - ${window.Utils.formatTime12Hour(matchedOverride.end_time)}`;
      return {
        status: matchedOverride.status,
        activity: null,
        room: faculty.room,
        note: matchedOverride.note || 'Temporary schedule override in effect',
        source: 'override',
        overrideWindow: windowStr,
        overrideId: matchedOverride.id,
        ruleSummary: `Schedule override in effect for ${windowStr}.`
      };
    }

    // Tier 3: Regular Scheduled Timetable Check
    const dayName = window.Utils.getDayName(date);
    const timetables = (store.timetables || []).filter(t =>
      t.faculty_id === facultyId &&
      t.day_of_week === dayName &&
      t.is_active !== false
    );

    const matchedSchedule = timetables.find(t =>
      window.Utils.isTimeBetween(time, t.start_time, t.end_time)
    );

    if (matchedSchedule) {
      const windowStr = `${window.Utils.formatTime12Hour(matchedSchedule.start_time)} - ${window.Utils.formatTime12Hour(matchedSchedule.end_time)}`;
      return {
        status: 'in_class',
        activity: matchedSchedule.activity,
        room: matchedSchedule.room || faculty.room,
        note: `Class in session: ${matchedSchedule.activity}`,
        source: 'timetable',
        scheduleWindow: windowStr,
        timetableId: matchedSchedule.id,
        ruleSummary: `Scheduled class: ${matchedSchedule.activity} (${windowStr}) in ${matchedSchedule.room || faculty.room}.`
      };
    }

    // Tier 4: Current / Manual Availability Status
    // Relevant for current date query or general current status
    const currentAvailability = (store.availability || []).find(a => a.faculty_id === facultyId);
    if (currentAvailability && currentAvailability.status && currentAvailability.status !== 'not_updated') {
      const updatedDate = currentAvailability.updated_at ? new Date(currentAvailability.updated_at) : null;
      let timeAgo = '';
      if (updatedDate) {
        timeAgo = `Updated at ${window.Utils.formatTime12Hour(updatedDate.toTimeString().slice(0, 5))}`;
      }

      return {
        status: currentAvailability.status,
        activity: null,
        room: faculty.room,
        note: currentAvailability.note || null,
        source: 'manual_status',
        updatedAt: currentAvailability.updated_at,
        timeAgoText: timeAgo,
        ruleSummary: `Manual status: ${window.Utils.getStatusDisplay(currentAvailability.status).label}${currentAvailability.note ? ' - ' + currentAvailability.note : ''}.`
      };
    }

    // Tier 5: Default Fallback
    return {
      status: 'not_updated',
      activity: null,
      room: faculty.room,
      note: 'No active schedule or manual status posted for this time.',
      source: 'not_updated',
      ruleSummary: 'Default fallback: No specific schedule or status entry.'
    };
  }

  /**
   * Batch Availability Resolver:
   * Efficiently resolves availability for an array of faculty objects in a single pass.
   * 
   * @param {Array<Object>} facultyList
   * @param {string} date
   * @param {string} time
   * @returns {Object} Map of facultyId -> resolution
   */
  function getBatchAvailabilityMap(facultyList, date, time) {
    const resultMap = {};
    if (!Array.isArray(facultyList)) return resultMap;

    facultyList.forEach(faculty => {
      resultMap[faculty.id] = resolveFacultyAvailability(faculty.id, date, time);
    });

    return resultMap;
  }

  // Export to window
  window.AvailabilityService = {
    validateOverride,
    getManualAvailability,
    getAllManualAvailability,
    updateManualStatus,
    getAllOverrides,
    getOverrideById,
    addOverride,
    updateOverride,
    deleteOverride,
    resolveFacultyAvailability,
    getBatchAvailabilityMap,
    initRealtime
  };

})(typeof window !== 'undefined' ? window : this);
