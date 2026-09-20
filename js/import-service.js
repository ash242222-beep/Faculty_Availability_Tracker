/**
 * Faculty Availability Tracker - Import Service Layer
 * Version: v0.6.0 (Milestone 6 - Live CSV Timetable Import)
 * 
 * Provides unified interface for recording, querying, and managing
 * timetable batch import logs in Supabase (public.timetable_imports)
 * with transparent offline fallback to window.DataStore.
 */

(function() {
  'use strict';

  /**
   * Log an import execution into Supabase or local DataStore
   * @param {Object} logData - { fileName, fileType, uploadedBy, rowsDetected, rowsImported, status }
   * @returns {Promise<Object>} Saved log entry
   */
  async function recordImportLog({ fileName, fileType, uploadedBy, rowsDetected, rowsImported, status }) {
    const client = window.SupabaseService && window.SupabaseService.getClient();
    let savedLog = null;

    const payload = {
      file_name: fileName || 'timetable_upload.csv',
      file_type: (fileType || 'csv').toLowerCase(),
      uploaded_by: uploadedBy || (window.Auth && window.Auth.getCurrentUser() ? window.Auth.getCurrentUser().name : 'Admin'),
      rows_detected: Number(rowsDetected) || 0,
      rows_imported: Number(rowsImported) || 0,
      status: status || 'success'
    };

    if (client) {
      try {
        const { data, error } = await client
          .from('timetable_imports')
          .insert([payload])
          .select()
          .single();

        if (error) {
          console.warn('Supabase recordImportLog notice, falling back to local storage:', error.message);
        } else if (data) {
          savedLog = data;
        }
      } catch (err) {
        console.warn('Supabase recordImportLog error, using local fallback:', err);
      }
    }

    if (!savedLog) {
      savedLog = {
        id: 'imp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        ...payload,
        created_at: new Date().toISOString()
      };
    }

    // Always update local DataStore cache
    const store = window.DataStore ? window.DataStore.getStore() : { imports: [] };
    store.imports = store.imports || [];
    store.imports.unshift(savedLog);
    if (window.DataStore) window.DataStore.saveStore(store);

    // Notify listeners
    window.dispatchEvent(new CustomEvent('import-history-changed', { detail: { action: 'record', log: savedLog } }));

    return savedLog;
  }

  /**
   * Retrieve all import audit history logs
   * @param {Object} filters - Optional filters { fileType, status, searchQuery }
   * @returns {Promise<Array>} Array of import logs sorted newest first
   */
  async function getImportHistory(filters = {}) {
    const client = window.SupabaseService && window.SupabaseService.getClient();
    let logs = [];

    if (client) {
      try {
        let query = client
          .from('timetable_imports')
          .select('*')
          .order('created_at', { ascending: false });

        if (filters.fileType && filters.fileType !== 'all') {
          query = query.eq('file_type', filters.fileType.toLowerCase());
        }
        if (filters.status && filters.status !== 'all') {
          query = query.eq('status', filters.status.toLowerCase());
        }

        const { data, error } = await query;
        if (error) {
          console.warn('Supabase getImportHistory notice, using local store:', error.message);
        } else if (data) {
          logs = data;
        }
      } catch (err) {
        console.warn('Supabase getImportHistory error, using local fallback:', err);
      }
    }

    // Fallback to local DataStore
    if (logs.length === 0) {
      const store = window.DataStore ? window.DataStore.getStore() : { imports: [] };
      logs = [...(store.imports || [])];
    }

    // Apply local in-memory filters
    if (filters.fileType && filters.fileType !== 'all') {
      logs = logs.filter(l => (l.file_type || '').toLowerCase() === filters.fileType.toLowerCase());
    }
    if (filters.status && filters.status !== 'all') {
      logs = logs.filter(l => (l.status || '').toLowerCase() === filters.status.toLowerCase());
    }
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase().trim();
      logs = logs.filter(l => 
        (l.file_name && l.file_name.toLowerCase().includes(q)) ||
        (l.uploaded_by && l.uploaded_by.toLowerCase().includes(q))
      );
    }

    // Sort descending by created_at
    logs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    return logs;
  }

  /**
   * Delete an import audit log entry
   * @param {string} id - Import log record ID
   * @returns {Promise<Object>} { success: boolean, error?: string }
   */
  async function deleteImportLog(id) {
    if (!id) return { success: false, error: 'Import ID required' };

    const client = window.SupabaseService && window.SupabaseService.getClient();
    if (client) {
      try {
        const { error } = await client
          .from('timetable_imports')
          .delete()
          .eq('id', id);

        if (error) {
          console.warn('Supabase deleteImportLog notice:', error.message);
        }
      } catch (err) {
        console.warn('Supabase deleteImportLog error:', err);
      }
    }

    const store = window.DataStore ? window.DataStore.getStore() : { imports: [] };
    store.imports = (store.imports || []).filter(l => l.id !== id);
    if (window.DataStore) window.DataStore.saveStore(store);

    window.dispatchEvent(new CustomEvent('import-history-changed', { detail: { action: 'delete', id } }));
    return { success: true };
  }

  /**
   * Clear all import history logs (Admin maintenance)
   * @returns {Promise<Object>} { success: boolean }
   */
  async function clearAllImportHistory() {
    const client = window.SupabaseService && window.SupabaseService.getClient();
    if (client) {
      try {
        await client.from('timetable_imports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (err) {
        console.warn('Supabase clearAllImportHistory notice:', err);
      }
    }

    const store = window.DataStore ? window.DataStore.getStore() : { imports: [] };
    store.imports = [];
    if (window.DataStore) window.DataStore.saveStore(store);

    window.dispatchEvent(new CustomEvent('import-history-changed', { detail: { action: 'clear' } }));
    return { success: true };
  }

  // Export globally
  window.ImportService = {
    recordImportLog,
    getImportHistory,
    deleteImportLog,
    clearAllImportHistory
  };

})();
