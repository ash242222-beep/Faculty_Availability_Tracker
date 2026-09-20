/**
 * Faculty Availability Tracker - Timetable Service Layer
 * Version: v0.4.0 (Milestone 4 - Timetable Engine & Validation)
 * 
 * Centralized CRUD service for college timetable slots in Supabase PostgreSQL,
 * with real-time overlap collision detection, duplicate checking, room conflict detection,
 * and resilient local DataStore caching.
 */

(function () {
  'use strict';

  const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  /**
   * Normalize 24-hour time to HH:MM format
   */
  function normalizeTime(timeStr) {
    if (!timeStr) return '';
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return timeStr.trim();
    const h = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    return `${h}:${m}`;
  }

  /**
   * Sort timetable records chronologically by day of week then start time
   */
  function sortTimetableList(list) {
    return list.slice().sort((a, b) => {
      const dayA = DAYS_OF_WEEK.indexOf(a.day_of_week);
      const dayB = DAYS_OF_WEEK.indexOf(b.day_of_week);
      if (dayA !== dayB) return dayA - dayB;
      return window.Utils.compareTime(normalizeTime(a.start_time), normalizeTime(b.start_time));
    });
  }

  /**
   * Fetch all timetable records with optional filtering
   * @param {Object} options - { facultyId, dayOfWeek, isActiveOnly, searchQuery, room }
   * @returns {Promise<Array>} Array of timetable entries
   */
  async function getAllTimetables(options = {}) {
    const { facultyId, dayOfWeek, isActiveOnly, searchQuery, room } = options;
    const client = window.SupabaseService && window.SupabaseService.getClient();

    let records = [];

    if (client) {
      try {
        let query = client.from('timetables').select('*');

        if (facultyId && facultyId !== 'all') {
          query = query.eq('faculty_id', facultyId);
        }

        if (dayOfWeek && dayOfWeek !== 'all') {
          query = query.eq('day_of_week', dayOfWeek);
        }

        if (isActiveOnly) {
          query = query.eq('is_active', true);
        }

        if (room) {
          query = query.eq('room', room);
        }

        const { data, error } = await query;
        if (error) {
          console.warn('Supabase getAllTimetables notice, using local store:', error.message);
        } else if (data) {
          records = data.map(r => ({
            ...r,
            start_time: normalizeTime(r.start_time),
            end_time: normalizeTime(r.end_time)
          }));

          // Sync into local DataStore cache so synchronous lookups like Utils.getFacultyAvailability remain fast
          const store = window.DataStore ? window.DataStore.getStore() : null;
          if (store) {
            store.timetables = records;
            window.DataStore.saveStore(store);
          }
        }
      } catch (err) {
        console.warn('Supabase timetable fetch error, falling back to local store:', err);
      }
    }

    // Local fallback if Supabase client not connected or failed
    if (records.length === 0) {
      const store = window.DataStore ? window.DataStore.getStore() : { timetables: [] };
      records = (store.timetables || []).map(r => ({
        ...r,
        start_time: normalizeTime(r.start_time),
        end_time: normalizeTime(r.end_time)
      }));

      if (facultyId && facultyId !== 'all') {
        records = records.filter(r => r.faculty_id === facultyId);
      }

      if (dayOfWeek && dayOfWeek !== 'all') {
        records = records.filter(r => r.day_of_week === dayOfWeek);
      }

      if (isActiveOnly) {
        records = records.filter(r => r.is_active !== false);
      }

      if (room) {
        records = records.filter(r => (r.room || '').toLowerCase() === room.toLowerCase());
      }
    }

    // Apply text search query across activity, room, day
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const store = window.DataStore ? window.DataStore.getStore() : { faculty: [] };
      const facultyMap = (store.faculty || []).reduce((acc, f) => {
        acc[f.id] = f.full_name.toLowerCase();
        return acc;
      }, {});

      records = records.filter(r => {
        const actMatch = (r.activity || '').toLowerCase().includes(q);
        const roomMatch = (r.room || '').toLowerCase().includes(q);
        const dayMatch = (r.day_of_week || '').toLowerCase().includes(q);
        const facMatch = facultyMap[r.faculty_id] ? facultyMap[r.faculty_id].includes(q) : false;
        return actMatch || roomMatch || dayMatch || facMatch;
      });
    }

    return sortTimetableList(records);
  }

  /**
   * Get single timetable entry by ID
   */
  async function getTimetableById(id) {
    const client = window.SupabaseService && window.SupabaseService.getClient();
    if (client) {
      try {
        const { data, error } = await client.from('timetables').select('*').eq('id', id).single();
        if (!error && data) {
          return {
            ...data,
            start_time: normalizeTime(data.start_time),
            end_time: normalizeTime(data.end_time)
          };
        }
      } catch (e) {
        console.warn('Timetable get by ID fallback:', e);
      }
    }

    const store = window.DataStore ? window.DataStore.getStore() : { timetables: [] };
    const found = (store.timetables || []).find(t => t.id === id);
    if (found) {
      return {
        ...found,
        start_time: normalizeTime(found.start_time),
        end_time: normalizeTime(found.end_time)
      };
    }
    return null;
  }

  /**
   * Get active timetables for a specific faculty member
   */
  async function getTimetablesByFaculty(facultyId, dayOfWeek = null) {
    const options = { facultyId, isActiveOnly: true };
    if (dayOfWeek) options.dayOfWeek = dayOfWeek;
    return getAllTimetables(options);
  }

  /**
   * Comprehensive validation for timetable entries
   * 
   * Validates:
   * 1. Required fields: faculty_id, day_of_week, start_time, end_time, activity
   * 2. Day of week validity
   * 3. Time format validity (HH:MM 24hr)
   * 4. Time ordering: start_time < end_time
   * 5. Minimum and maximum duration (at least 15 mins, at most 8 hours)
   * 6. Overlap detection for same faculty on same day:
   *    (startA < endB) && (endA > startB)
   * 7. Duplicate slot detection
   * 8. Room collision detection (generates advisory warning)
   * 
   * @param {Object} entry - Timetable payload
   * @param {string|null} currentEditId - ID of entry being updated (if editing)
   * @returns {Object} { isValid: boolean, errors: string[], warnings: string[], conflictSlot: Object|null }
   */
  function validateTimetableEntry(entry, currentEditId = null) {
    const errors = [];
    const warnings = [];
    let conflictSlot = null;

    if (!entry) {
      return { isValid: false, errors: ['No timetable data provided.'], warnings: [], conflictSlot: null };
    }

    // 1. Required fields
    if (!entry.faculty_id) errors.push('Faculty member must be selected.');
    if (!entry.day_of_week) errors.push('Day of the week is required.');
    if (!entry.start_time) errors.push('Start time is required.');
    if (!entry.end_time) errors.push('End time is required.');
    if (!entry.activity || !entry.activity.trim()) errors.push('Class / activity name is required.');

    // 2. Day of week check
    if (entry.day_of_week && !DAYS_OF_WEEK.includes(entry.day_of_week)) {
      errors.push(`Invalid day of week "${entry.day_of_week}". Must be one of: ${DAYS_OF_WEEK.join(', ')}.`);
    }

    // 3. Time format checks (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
    const cleanStart = normalizeTime(entry.start_time);
    const cleanEnd = normalizeTime(entry.end_time);

    if (entry.start_time && !timeRegex.test(entry.start_time.trim())) {
      errors.push(`Start time "${entry.start_time}" must be in valid HH:MM 24-hour format.`);
    }
    if (entry.end_time && !timeRegex.test(entry.end_time.trim())) {
      errors.push(`End time "${entry.end_time}" must be in valid HH:MM 24-hour format.`);
    }

    // 4. Time ordering check
    if (cleanStart && cleanEnd && timeRegex.test(cleanStart) && timeRegex.test(cleanEnd)) {
      const cmp = window.Utils.compareTime(cleanStart, cleanEnd);
      if (cmp >= 0) {
        errors.push(`End time (${cleanEnd}) must be strictly after start time (${cleanStart}).`);
      } else {
        // 5. Duration check
        const [hA, mA] = cleanStart.split(':').map(Number);
        const [hB, mB] = cleanEnd.split(':').map(Number);
        const durationMins = (hB * 60 + mB) - (hA * 60 + mA);

        if (durationMins < 15) {
          errors.push('Class duration must be at least 15 minutes.');
        } else if (durationMins > 480) {
          errors.push('Class duration cannot exceed 8 hours in a single session.');
        }
      }
    }

    // If basic format errors exist, return early before collision checks
    if (errors.length > 0) {
      return { isValid: false, errors, warnings, conflictSlot: null };
    }

    // 6. Overlap & Duplicate check against existing timetable store
    const store = window.DataStore ? window.DataStore.getStore() : { timetables: [], faculty: [] };
    const allTimetables = (store.timetables || []).map(t => ({
      ...t,
      start_time: normalizeTime(t.start_time),
      end_time: normalizeTime(t.end_time)
    }));

    // Active entries for the same faculty on the same day (excluding the record currently being edited)
    const facultyDayEntries = allTimetables.filter(t => 
      t.faculty_id === entry.faculty_id &&
      t.day_of_week === entry.day_of_week &&
      t.id !== currentEditId &&
      t.is_active !== false
    );

    // Overlap collision
    const overlap = facultyDayEntries.find(t => 
      window.Utils.isTimeOverlap(cleanStart, cleanEnd, t.start_time, t.end_time)
    );

    if (overlap) {
      conflictSlot = overlap;
      const formattedOverlapStart = window.Utils.formatTime12Hour(overlap.start_time);
      const formattedOverlapEnd = window.Utils.formatTime12Hour(overlap.end_time);
      errors.push(
        `Schedule Collision: This slot overlaps with existing class "${overlap.activity}" (${formattedOverlapStart} - ${formattedOverlapEnd}) for this faculty member on ${overlap.day_of_week}.`
      );
    }

    // Exact duplicate check
    const duplicate = facultyDayEntries.find(t =>
      t.start_time === cleanStart &&
      t.end_time === cleanEnd &&
      t.activity.toLowerCase() === entry.activity.trim().toLowerCase()
    );

    if (duplicate) {
      errors.push(`Duplicate Record: An identical schedule for "${duplicate.activity}" at this time already exists.`);
    }

    // 8. Room conflict advisory check (warning if different faculty is booked in same room at same time)
    const cleanRoom = (entry.room || '').trim();
    if (cleanRoom) {
      const roomEntries = allTimetables.filter(t =>
        (t.room || '').trim().toLowerCase() === cleanRoom.toLowerCase() &&
        t.day_of_week === entry.day_of_week &&
        t.faculty_id !== entry.faculty_id &&
        t.id !== currentEditId &&
        t.is_active !== false &&
        window.Utils.isTimeOverlap(cleanStart, cleanEnd, t.start_time, t.end_time)
      );

      if (roomEntries.length > 0) {
        const conflict = roomEntries[0];
        const conflictFaculty = (store.faculty || []).find(f => f.id === conflict.faculty_id);
        const conflictName = conflictFaculty ? conflictFaculty.full_name : 'another faculty member';
        warnings.push(
          `Room Booking Notice: Room "${cleanRoom}" is also assigned to ${conflictName} for "${conflict.activity}" (${window.Utils.formatTime12Hour(conflict.start_time)} - ${window.Utils.formatTime12Hour(conflict.end_time)}).`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      conflictSlot
    };
  }

  /**
   * Add a new timetable entry
   */
  async function addTimetable(entry) {
    const cleanEntry = {
      ...entry,
      start_time: normalizeTime(entry.start_time),
      end_time: normalizeTime(entry.end_time),
      activity: (entry.activity || '').trim(),
      room: (entry.room || '').trim(),
      is_active: entry.is_active !== false
    };

    const validation = validateTimetableEntry(cleanEntry);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors[0],
        errors: validation.errors,
        warnings: validation.warnings,
        conflictSlot: validation.conflictSlot
      };
    }

    const client = window.SupabaseService && window.SupabaseService.getClient();
    let savedEntry = null;

    if (client) {
      try {
        const payload = {
          faculty_id: cleanEntry.faculty_id,
          day_of_week: cleanEntry.day_of_week,
          start_time: cleanEntry.start_time,
          end_time: cleanEntry.end_time,
          activity: cleanEntry.activity,
          room: cleanEntry.room,
          is_active: cleanEntry.is_active
        };

        const { data, error } = await client.from('timetables').insert([payload]).select().single();
        if (error) {
          console.warn('Supabase addTimetable insert notice, falling back to local store:', error.message);
        } else if (data) {
          savedEntry = {
            ...data,
            start_time: normalizeTime(data.start_time),
            end_time: normalizeTime(data.end_time)
          };
        }
      } catch (err) {
        console.warn('Supabase addTimetable error, using local fallback:', err);
      }
    }

    if (!savedEntry) {
      savedEntry = {
        ...cleanEntry,
        id: 't-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        created_at: new Date().toISOString()
      };
    }

    // Always update local DataStore cache
    const store = window.DataStore ? window.DataStore.getStore() : { timetables: [] };
    store.timetables = store.timetables || [];
    // Remove if already present, then push
    store.timetables = store.timetables.filter(t => t.id !== savedEntry.id);
    store.timetables.push(savedEntry);
    if (window.DataStore) window.DataStore.saveStore(store);

    // Notify application of state change
    window.dispatchEvent(new CustomEvent('timetable-data-changed', { detail: { action: 'add', item: savedEntry } }));

    return {
      success: true,
      data: savedEntry,
      warnings: validation.warnings
    };
  }

  /**
   * Update an existing timetable entry
   */
  async function updateTimetable(id, updates) {
    if (!id) return { success: false, error: 'Timetable ID is required for updating.' };

    const store = window.DataStore ? window.DataStore.getStore() : { timetables: [] };
    const existing = (store.timetables || []).find(t => t.id === id);

    const merged = {
      ...(existing || {}),
      ...updates,
      start_time: normalizeTime(updates.start_time || (existing ? existing.start_time : '')),
      end_time: normalizeTime(updates.end_time || (existing ? existing.end_time : '')),
      activity: (updates.activity !== undefined ? updates.activity : (existing ? existing.activity : '')).trim(),
      room: (updates.room !== undefined ? updates.room : (existing ? existing.room : '')).trim()
    };

    const validation = validateTimetableEntry(merged, id);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors[0],
        errors: validation.errors,
        warnings: validation.warnings,
        conflictSlot: validation.conflictSlot
      };
    }

    const client = window.SupabaseService && window.SupabaseService.getClient();
    let updatedEntry = null;

    if (client) {
      try {
        const payload = {
          faculty_id: merged.faculty_id,
          day_of_week: merged.day_of_week,
          start_time: merged.start_time,
          end_time: merged.end_time,
          activity: merged.activity,
          room: merged.room,
          is_active: merged.is_active !== false
        };

        const { data, error } = await client.from('timetables').update(payload).eq('id', id).select().single();
        if (error) {
          console.warn('Supabase updateTimetable notice, updating local store:', error.message);
        } else if (data) {
          updatedEntry = {
            ...data,
            start_time: normalizeTime(data.start_time),
            end_time: normalizeTime(data.end_time)
          };
        }
      } catch (err) {
        console.warn('Supabase updateTimetable error, using local fallback:', err);
      }
    }

    if (!updatedEntry) {
      updatedEntry = { ...merged, id };
    }

    // Update local cache
    const idx = (store.timetables || []).findIndex(t => t.id === id);
    if (idx >= 0) {
      store.timetables[idx] = updatedEntry;
    } else {
      store.timetables.push(updatedEntry);
    }
    if (window.DataStore) window.DataStore.saveStore(store);

    // Notify listeners
    window.dispatchEvent(new CustomEvent('timetable-data-changed', { detail: { action: 'update', item: updatedEntry } }));

    return {
      success: true,
      data: updatedEntry,
      warnings: validation.warnings
    };
  }

  /**
   * Delete a timetable entry
   */
  async function deleteTimetable(id) {
    if (!id) return { success: false, error: 'Timetable ID is required for deletion.' };

    const client = window.SupabaseService && window.SupabaseService.getClient();
    if (client) {
      try {
        const { error } = await client.from('timetables').delete().eq('id', id);
        if (error) {
          console.warn('Supabase deleteTimetable notice, deleting from local store:', error.message);
        }
      } catch (err) {
        console.warn('Supabase deleteTimetable error:', err);
      }
    }

    // Remove from local cache
    const store = window.DataStore ? window.DataStore.getStore() : { timetables: [] };
    store.timetables = (store.timetables || []).filter(t => t.id !== id);
    if (window.DataStore) window.DataStore.saveStore(store);

    window.dispatchEvent(new CustomEvent('timetable-data-changed', { detail: { action: 'delete', id } }));
    return { success: true };
  }

  /**
   * Toggle active state of timetable entry
   */
  async function toggleTimetableActive(id, newActiveState) {
    return updateTimetable(id, { is_active: newActiveState });
  }

  /**
   * Batch insert timetable records (used by CSV/PDF import)
   * Supports import modes:
   *  - 'append' (default): appends valid entries
   *  - 'replace_faculty': wipes existing timetables for faculty present in the batch, then inserts new rows
   * 
   * @param {Array<Object>} records - Timetable records to import
   * @param {Object} options - { mode: 'append'|'replace_faculty' }
   * @returns {Promise<Object>} { imported: number, failed: number, errors: string[] }
   */
  async function batchImportTimetables(records, options = {}) {
    const mode = options.mode || 'append';
    const results = {
      imported: 0,
      failed: 0,
      errors: []
    };

    if (!records || records.length === 0) {
      return results;
    }

    const client = window.SupabaseService && window.SupabaseService.getClient();

    // If replace_faculty mode: collect distinct faculty IDs and delete old slots
    if (mode === 'replace_faculty') {
      const distinctFacultyIds = [...new Set(records.map(r => r.faculty_id).filter(Boolean))];
      if (distinctFacultyIds.length > 0) {
        if (client) {
          try {
            await client.from('timetables').delete().in('faculty_id', distinctFacultyIds);
          } catch (err) {
            console.warn('Supabase bulk delete for replace_faculty warning:', err);
          }
        }
        // Update local DataStore cache
        const store = window.DataStore ? window.DataStore.getStore() : { timetables: [] };
        store.timetables = (store.timetables || []).filter(t => !distinctFacultyIds.includes(t.faculty_id));
        if (window.DataStore) window.DataStore.saveStore(store);
      }
    }

    // Prepare payloads
    const validPayloads = [];
    for (const record of records) {
      const cleanStart = normalizeTime(record.start_time);
      const cleanEnd = normalizeTime(record.end_time);

      if (!record.faculty_id || !record.day_of_week || !cleanStart || !cleanEnd || !record.activity) {
        results.failed++;
        results.errors.push(`Incomplete row: "${record.activity || 'Unknown'}"`);
        continue;
      }

      validPayloads.push({
        faculty_id: record.faculty_id,
        day_of_week: record.day_of_week,
        start_time: cleanStart,
        end_time: cleanEnd,
        activity: (record.activity || '').trim(),
        room: (record.room || '').trim(),
        is_active: record.is_active !== false
      });
    }

    // Perform bulk insertion via Supabase if available
    let bulkSucceeded = false;
    let insertedRows = [];

    if (client && validPayloads.length > 0) {
      try {
        const { data, error } = await client
          .from('timetables')
          .insert(validPayloads)
          .select();

        if (error) {
          console.warn('Supabase bulk insert notice, falling back to individual inserts:', error.message);
        } else if (data) {
          bulkSucceeded = true;
          insertedRows = data.map(d => ({
            ...d,
            start_time: normalizeTime(d.start_time),
            end_time: normalizeTime(d.end_time)
          }));
          results.imported = insertedRows.length;
        }
      } catch (err) {
        console.warn('Supabase bulk insert error:', err);
      }
    }

    // Fallback or local insertion
    if (!bulkSucceeded && validPayloads.length > 0) {
      const store = window.DataStore ? window.DataStore.getStore() : { timetables: [] };
      store.timetables = store.timetables || [];

      for (const payload of validPayloads) {
        const localEntry = {
          ...payload,
          id: 'imp-tt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          created_at: new Date().toISOString()
        };
        store.timetables.push(localEntry);
        insertedRows.push(localEntry);
        results.imported++;
      }

      if (window.DataStore) window.DataStore.saveStore(store);
    } else if (bulkSucceeded && insertedRows.length > 0) {
      // Sync into local DataStore cache
      const store = window.DataStore ? window.DataStore.getStore() : { timetables: [] };
      store.timetables = store.timetables || [];
      const newIds = new Set(insertedRows.map(r => r.id));
      store.timetables = store.timetables.filter(t => !newIds.has(t.id)).concat(insertedRows);
      if (window.DataStore) window.DataStore.saveStore(store);
    }

    window.dispatchEvent(new CustomEvent('timetable-data-changed', {
      detail: { action: 'batch-import', imported: results.imported, mode }
    }));

    return results;
  }

  // Export globally
  window.TimetableService = {
    DAYS_OF_WEEK,
    normalizeTime,
    getAllTimetables,
    getTimetableById,
    getTimetablesByFaculty,
    validateTimetableEntry,
    addTimetable,
    updateTimetable,
    deleteTimetable,
    toggleTimetableActive,
    batchImportTimetables
  };

})();
