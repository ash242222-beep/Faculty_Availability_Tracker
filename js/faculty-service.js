/**
 * Faculty Availability Tracker - Faculty Service
 * Version: v0.3.0 (Milestone 3 - Faculty Management)
 * 
 * Manages faculty roster CRUD operations, live PostgreSQL synchronization via Supabase,
 * search, department filtering, and active/paused state toggling with local fallback.
 */

(function () {
  'use strict';

  /**
   * Normalize search text
   */
  function normalize(str) {
    return (str || '').toLowerCase().trim();
  }

  /**
   * Fetch all faculty members with optional filters
   * @param {Object} options - { department, searchQuery, isActiveOnly }
   * @returns {Promise<Array>} Array of faculty objects
   */
  async function getAllFaculty(options = {}) {
    const { department, searchQuery, isActiveOnly } = options;
    const client = window.SupabaseService && window.SupabaseService.getClient();

    if (client) {
      try {
        let query = client.from('faculty').select('*').order('full_name', { ascending: true });

        if (department && department !== 'All Departments') {
          query = query.eq('department', department);
        }

        if (isActiveOnly) {
          query = query.eq('is_active', true);
        }

        const { data, error } = await query;
        if (error) {
          console.warn('Supabase getAllFaculty notice, falling back to local store:', error.message);
        } else if (data) {
          // If search query is provided, filter in-memory
          let result = data;
          if (searchQuery) {
            const q = normalize(searchQuery);
            result = result.filter(f =>
              normalize(f.full_name).includes(q) ||
              normalize(f.department).includes(q) ||
              normalize(f.designation).includes(q) ||
              normalize(f.room).includes(q) ||
              normalize(f.email).includes(q)
            );
          }
          return result;
        }
      } catch (err) {
        console.warn('Supabase faculty fetch error, using local fallback:', err);
      }
    }

    // Local DataStore fallback
    const store = window.DataStore ? window.DataStore.getStore() : { faculty: [] };
    let facultyList = store.faculty || [];

    if (department && department !== 'All Departments') {
      facultyList = facultyList.filter(f => f.department === department);
    }

    if (isActiveOnly) {
      facultyList = facultyList.filter(f => f.is_active !== false);
    }

    if (searchQuery) {
      const q = normalize(searchQuery);
      facultyList = facultyList.filter(f =>
        normalize(f.full_name).includes(q) ||
        normalize(f.department).includes(q) ||
        normalize(f.designation).includes(q) ||
        normalize(f.room).includes(q) ||
        normalize(f.email).includes(q)
      );
    }

    return facultyList;
  }

  /**
   * Get single faculty by ID
   * @param {string} id 
   * @returns {Promise<Object|null>}
   */
  async function getFacultyById(id) {
    if (!id) return null;
    const client = window.SupabaseService && window.SupabaseService.getClient();

    if (client) {
      try {
        const { data, error } = await client.from('faculty').select('*').eq('id', id).single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase getFacultyById error, using local fallback:', err);
      }
    }

    const store = window.DataStore ? window.DataStore.getStore() : { faculty: [] };
    return (store.faculty || []).find(f => f.id === id) || null;
  }

  /**
   * Add a new faculty member
   * @param {Object} facultyData - { full_name, email, department, designation, room }
   * @returns {Promise<{ success: boolean, faculty?: Object, error?: string }>}
   */
  async function addFaculty(facultyData) {
    const { full_name, email, department, designation, room } = facultyData;

    if (!full_name || !email || !department) {
      return { success: false, error: 'Full Name, Email, and Department are required.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const client = window.SupabaseService && window.SupabaseService.getClient();

    if (client) {
      try {
        // Check for duplicate email
        const { data: existing } = await client.from('faculty').select('id').eq('email', cleanEmail);
        if (existing && existing.length > 0) {
          return { success: false, error: 'A faculty member with this email address already exists.' };
        }

        const newRow = {
          full_name: full_name.trim(),
          email: cleanEmail,
          department: department.trim(),
          designation: (designation || 'Assistant Professor').trim(),
          room: (room || 'Cabin').trim(),
          is_active: true
        };

        const { data, error } = await client.from('faculty').insert([newRow]).select();
        if (error) return { success: false, error: error.message };

        const createdFaculty = data[0];

        // Initialize default availability
        await client.from('availability').upsert({
          faculty_id: createdFaculty.id,
          status: 'available',
          note: 'Profile created by admin',
          updated_at: new Date().toISOString()
        });

        // Also keep local DataStore in sync for hybrid mode
        if (window.DataStore) {
          const store = window.DataStore.getStore();
          store.faculty = store.faculty || [];
          store.faculty.push(createdFaculty);
          window.DataStore.saveStore(store);
        }

        window.dispatchEvent(new CustomEvent('faculty-data-changed', { detail: { action: 'add', faculty: createdFaculty } }));
        return { success: true, faculty: createdFaculty };
      } catch (err) {
        return { success: false, error: err.message || 'Failed to add faculty to database.' };
      }
    }

    // Local DataStore
    const store = window.DataStore ? window.DataStore.getStore() : { faculty: [] };
    const existing = (store.faculty || []).find(f => f.email.toLowerCase() === cleanEmail);
    if (existing) {
      return { success: false, error: 'A faculty member with this email address already exists.' };
    }

    const newFaculty = {
      id: 'f-' + Date.now(),
      full_name: full_name.trim(),
      email: cleanEmail,
      department: department.trim(),
      designation: (designation || 'Assistant Professor').trim(),
      room: (room || 'Cabin').trim(),
      is_active: true,
      created_at: new Date().toISOString()
    };

    store.faculty = store.faculty || [];
    store.faculty.push(newFaculty);

    store.availability = store.availability || [];
    store.availability.push({
      faculty_id: newFaculty.id,
      status: 'available',
      note: 'Profile created by admin',
      updated_at: new Date().toISOString()
    });

    window.DataStore.saveStore(store);
    window.dispatchEvent(new CustomEvent('faculty-data-changed', { detail: { action: 'add', faculty: newFaculty } }));
    return { success: true, faculty: newFaculty };
  }

  /**
   * Update an existing faculty member
   * @param {string} id 
   * @param {Object} updateFields 
   * @returns {Promise<{ success: boolean, faculty?: Object, error?: string }>}
   */
  async function updateFaculty(id, updateFields) {
    if (!id) return { success: false, error: 'Faculty ID required' };
    const client = window.SupabaseService && window.SupabaseService.getClient();

    if (client) {
      try {
        const { data, error } = await client.from('faculty').update(updateFields).eq('id', id).select();
        if (error) return { success: false, error: error.message };

        // Keep local store synchronized
        if (window.DataStore) {
          const store = window.DataStore.getStore();
          const idx = (store.faculty || []).findIndex(f => f.id === id);
          if (idx !== -1) {
            store.faculty[idx] = { ...store.faculty[idx], ...updateFields };
            window.DataStore.saveStore(store);
          }
        }

        window.dispatchEvent(new CustomEvent('faculty-data-changed', { detail: { action: 'update', id, updateFields } }));
        return { success: true, faculty: data[0] };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    // Local DataStore
    const store = window.DataStore ? window.DataStore.getStore() : { faculty: [] };
    const idx = (store.faculty || []).findIndex(f => f.id === id);
    if (idx === -1) return { success: false, error: 'Faculty record not found' };

    store.faculty[idx] = { ...store.faculty[idx], ...updateFields };
    window.DataStore.saveStore(store);
    window.dispatchEvent(new CustomEvent('faculty-data-changed', { detail: { action: 'update', id, updateFields } }));
    return { success: true, faculty: store.faculty[idx] };
  }

  /**
   * Toggle faculty active/paused status
   * @param {string} id 
   * @param {boolean} isActive 
   */
  async function toggleFacultyActive(id, isActive) {
    return updateFaculty(id, { is_active: isActive });
  }

  /**
   * Delete a faculty member
   * @param {string} id 
   */
  async function deleteFaculty(id) {
    if (!id) return { success: false, error: 'Faculty ID required' };
    const client = window.SupabaseService && window.SupabaseService.getClient();

    if (client) {
      try {
        const { error } = await client.from('faculty').delete().eq('id', id);
        if (error) return { success: false, error: error.message };

        if (window.DataStore) {
          const store = window.DataStore.getStore();
          store.faculty = (store.faculty || []).filter(f => f.id !== id);
          window.DataStore.saveStore(store);
        }

        window.dispatchEvent(new CustomEvent('faculty-data-changed', { detail: { action: 'delete', id } }));
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    // Local DataStore
    const store = window.DataStore ? window.DataStore.getStore() : { faculty: [] };
    store.faculty = (store.faculty || []).filter(f => f.id !== id);
    store.timetables = (store.timetables || []).filter(t => t.faculty_id !== id);
    store.availability = (store.availability || []).filter(a => a.faculty_id !== id);
    store.overrides = (store.overrides || []).filter(o => o.faculty_id !== id);
    window.DataStore.saveStore(store);

    window.dispatchEvent(new CustomEvent('faculty-data-changed', { detail: { action: 'delete', id } }));
    return { success: true };
  }

  // Export to window
  window.FacultyService = {
    getAllFaculty,
    getFacultyById,
    addFaculty,
    updateFaculty,
    toggleFacultyActive,
    deleteFaculty
  };
})();
