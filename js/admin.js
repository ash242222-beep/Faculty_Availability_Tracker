/**
 * Faculty Availability Tracker - Administration Dashboard Script
 * Version: v0.1.0
 */

document.addEventListener('DOMContentLoaded', () => {
  // Enforce admin authorization
  Auth.requireRole(['admin']);
  Auth.initHeaderAuth();

  // Navigation tab switcher
  const tabButtons = document.querySelectorAll('.admin-tab-btn');
  const sections = document.querySelectorAll('.admin-section');

  function showSection(sectionId) {
    sections.forEach(sec => {
      sec.style.display = (sec.id === sectionId) ? 'block' : 'none';
    });
    tabButtons.forEach(btn => {
      if (btn.dataset.target === sectionId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      showSection(btn.dataset.target);
    });
  });

  // ==========================================================
  // SECTION 1: FACULTY MANAGEMENT
  // ==========================================================
  const facultyTableBody = document.getElementById('faculty-table-body');
  const facultyModal = document.getElementById('faculty-modal');
  const facultyForm = document.getElementById('faculty-form');
  const btnOpenAddFaculty = document.getElementById('btn-open-add-faculty');
  const btnCloseFacultyModal = document.getElementById('btn-close-faculty-modal');
  const facultyModalTitle = document.getElementById('faculty-modal-title');
  const facultyEditId = document.getElementById('faculty-edit-id');

  function renderFacultyTable() {
    const store = window.DataStore.getStore();
    if (!facultyTableBody) return;

    if (!store.faculty || store.faculty.length === 0) {
      facultyTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No faculty members registered.</td></tr>`;
      return;
    }

    facultyTableBody.innerHTML = store.faculty.map(f => {
      const statusBadge = f.is_active 
        ? `<span class="badge-status badge-available">Active</span>`
        : `<span class="badge-status badge-unavailable">Paused (Inactive)</span>`;

      const pauseActionBtn = f.is_active
        ? `<button class="btn btn-secondary btn-sm" onclick="window.toggleFacultyActive('${f.id}', false)">Pause</button>`
        : `<button class="btn btn-primary btn-sm" onclick="window.toggleFacultyActive('${f.id}', true)">Reactivate</button>`;

      return `
        <tr>
          <td><strong>${f.full_name}</strong></td>
          <td>${f.department}</td>
          <td>${f.designation}</td>
          <td>${f.room}</td>
          <td>${statusBadge}</td>
          <td>
            <div style="display: flex; gap: 0.35rem;">
              <button class="btn btn-secondary btn-sm" onclick="window.editFaculty('${f.id}')">Edit</button>
              ${pauseActionBtn}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Also refresh faculty options in timetable dropdowns
    populateFacultyDropdowns();
  }

  // Open Add Faculty modal
  if (btnOpenAddFaculty) {
    btnOpenAddFaculty.addEventListener('click', () => {
      facultyForm.reset();
      facultyEditId.value = '';
      if (facultyModalTitle) facultyModalTitle.textContent = 'Add New Faculty Member';
      if (facultyModal) facultyModal.style.display = 'flex';
    });
  }

  if (btnCloseFacultyModal) {
    btnCloseFacultyModal.addEventListener('click', () => {
      if (facultyModal) facultyModal.style.display = 'none';
    });
  }

  // Handle Faculty Form Submit (Add / Edit)
  if (facultyForm) {
    facultyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const store = window.DataStore.getStore();
      const editId = facultyEditId.value;

      const name = document.getElementById('faculty-name').value.trim();
      const email = document.getElementById('faculty-email').value.trim();
      const dept = document.getElementById('faculty-dept').value;
      const designation = document.getElementById('faculty-designation').value.trim();
      const room = document.getElementById('faculty-room').value.trim();

      if (!name || !email || !room) {
        alert('Please fill out all required faculty fields.');
        return;
      }

      if (editId) {
        const idx = store.faculty.findIndex(f => f.id === editId);
        if (idx >= 0) {
          store.faculty[idx].full_name = name;
          store.faculty[idx].email = email;
          store.faculty[idx].department = dept;
          store.faculty[idx].designation = designation;
          store.faculty[idx].room = room;
        }
      } else {
        const newFaculty = {
          id: 'f-' + Date.now(),
          full_name: name,
          email: email,
          department: dept,
          designation: designation,
          room: room,
          is_active: true,
          created_at: new Date().toISOString()
        };
        store.faculty.push(newFaculty);
      }

      window.DataStore.saveStore(store);
      facultyModal.style.display = 'none';
      renderFacultyTable();
      alert(editId ? 'Faculty information updated.' : 'New faculty member added successfully.');
    });
  }

  window.editFaculty = function(facultyId) {
    const store = window.DataStore.getStore();
    const f = (store.faculty || []).find(item => item.id === facultyId);
    if (!f) return;

    facultyEditId.value = f.id;
    document.getElementById('faculty-name').value = f.full_name;
    document.getElementById('faculty-email').value = f.email;
    document.getElementById('faculty-dept').value = f.department;
    document.getElementById('faculty-designation').value = f.designation;
    document.getElementById('faculty-room').value = f.room;

    if (facultyModalTitle) facultyModalTitle.textContent = 'Edit Faculty Information';
    if (facultyModal) facultyModal.style.display = 'flex';
  };

  // Pause / Reactivate (Soft-delete via is_active = false)
  window.toggleFacultyActive = function(facultyId, newActiveState) {
    const store = window.DataStore.getStore();
    const f = (store.faculty || []).find(item => item.id === facultyId);
    if (!f) return;

    const actionName = newActiveState ? 'reactivate' : 'pause';
    if (!confirm(`Are you sure you want to ${actionName} the account of ${f.full_name}?`)) return;

    f.is_active = newActiveState;
    window.DataStore.saveStore(store);
    renderFacultyTable();
    alert(`Account for ${f.full_name} has been ${newActiveState ? 'reactivated' : 'paused'}.`);
  };

  function populateFacultyDropdowns() {
    const store = window.DataStore.getStore();
    const facultySelects = [
      document.getElementById('tt-faculty-select'),
      document.getElementById('tt-filter-faculty')
    ];

    facultySelects.forEach(selectEl => {
      if (!selectEl) return;
      const currentVal = selectEl.value;
      const isFilter = selectEl.id === 'tt-filter-faculty';

      let optionsHtml = isFilter ? '<option value="all">All Faculty</option>' : '<option value="">-- Select Faculty --</option>';
      optionsHtml += (store.faculty || []).map(f => `
        <option value="${f.id}">${f.full_name} (${f.department})</option>
      `).join('');

      selectEl.innerHTML = optionsHtml;
      if (currentVal) selectEl.value = currentVal;
    });
  }

  // ==========================================================
  // SECTION 2: TIMETABLE MANAGEMENT
  // ==========================================================
  const timetableTableBody = document.getElementById('timetable-admin-body');
  const timetableForm = document.getElementById('timetable-form');
  const timetableEditId = document.getElementById('tt-edit-id');
  const btnSubmitTimetable = document.getElementById('btn-submit-timetable');
  const btnCancelTimetableEdit = document.getElementById('btn-cancel-tt-edit');
  const filterFacultySelect = document.getElementById('tt-filter-faculty');

  function renderTimetableAdmin() {
    const store = window.DataStore.getStore();
    if (!timetableTableBody) return;

    const selectedFacultyFilter = filterFacultySelect ? filterFacultySelect.value : 'all';
    let records = store.timetables || [];

    if (selectedFacultyFilter !== 'all') {
      records = records.filter(r => r.faculty_id === selectedFacultyFilter);
    }

    if (records.length === 0) {
      timetableTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No timetable entries match filter.</td></tr>`;
      return;
    }

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    records.sort((a, b) => {
      const dDiff = days.indexOf(a.day_of_week) - days.indexOf(b.day_of_week);
      if (dDiff !== 0) return dDiff;
      return window.Utils.compareTime(a.start_time, b.start_time);
    });

    timetableTableBody.innerHTML = records.map(t => {
      const faculty = (store.faculty || []).find(f => f.id === t.faculty_id);
      const facultyName = faculty ? faculty.full_name : 'Unknown Faculty';

      return `
        <tr>
          <td><strong>${facultyName}</strong></td>
          <td>${t.day_of_week}</td>
          <td>${window.Utils.formatTime12Hour(t.start_time)} - ${window.Utils.formatTime12Hour(t.end_time)}</td>
          <td><strong>${t.activity}</strong></td>
          <td>${t.room || '—'}</td>
          <td>
            <div style="display: flex; gap: 0.35rem;">
              <button class="btn btn-secondary btn-sm" onclick="window.editTimetableEntry('${t.id}')">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="window.deleteTimetableEntry('${t.id}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  if (filterFacultySelect) {
    filterFacultySelect.addEventListener('change', renderTimetableAdmin);
  }

  // Timetable Form Submit
  if (timetableForm) {
    timetableForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const store = window.DataStore.getStore();
      const editId = timetableEditId.value;

      const facultyId = document.getElementById('tt-faculty-select').value;
      const day = document.getElementById('tt-day').value;
      const startTime = document.getElementById('tt-start-time').value;
      const endTime = document.getElementById('tt-end-time').value;
      const activity = document.getElementById('tt-activity').value.trim();
      const room = document.getElementById('tt-room').value.trim();

      // Timetable validation: start time < end time
      if (window.Utils.compareTime(startTime, endTime) >= 0) {
        alert('Validation Error: End time must be strictly after start time.');
        return;
      }

      // Check for unintended overlapping entries for the same faculty on the same day
      const existingFacultyEntries = (store.timetables || []).filter(t => 
        t.faculty_id === facultyId && 
        t.day_of_week === day && 
        t.id !== editId &&
        t.is_active !== false
      );

      const hasOverlap = existingFacultyEntries.some(t => {
        return (window.Utils.compareTime(startTime, t.end_time) < 0) &&
               (window.Utils.compareTime(endTime, t.start_time) > 0);
      });

      if (hasOverlap) {
        alert('Validation Error: This timetable slot overlaps with another scheduled class for this faculty member.');
        return;
      }

      if (editId) {
        const idx = store.timetables.findIndex(t => t.id === editId);
        if (idx >= 0) {
          store.timetables[idx] = {
            ...store.timetables[idx],
            faculty_id: facultyId,
            day_of_week: day,
            start_time: startTime,
            end_time: endTime,
            activity: activity,
            room: room
          };
        }
        timetableEditId.value = '';
        btnSubmitTimetable.textContent = 'Add Timetable Record';
        btnCancelTimetableEdit.style.display = 'none';
      } else {
        const newTimetable = {
          id: 't-' + Date.now(),
          faculty_id: facultyId,
          day_of_week: day,
          start_time: startTime,
          end_time: endTime,
          activity: activity,
          room: room,
          is_active: true
        };
        store.timetables.push(newTimetable);
      }

      window.DataStore.saveStore(store);
      timetableForm.reset();
      renderTimetableAdmin();
      alert('Timetable record saved successfully.');
    });
  }

  window.editTimetableEntry = function(ttId) {
    const store = window.DataStore.getStore();
    const t = (store.timetables || []).find(item => item.id === ttId);
    if (!t) return;

    timetableEditId.value = t.id;
    document.getElementById('tt-faculty-select').value = t.faculty_id;
    document.getElementById('tt-day').value = t.day_of_week;
    document.getElementById('tt-start-time').value = t.start_time;
    document.getElementById('tt-end-time').value = t.end_time;
    document.getElementById('tt-activity').value = t.activity;
    document.getElementById('tt-room').value = t.room || '';

    btnSubmitTimetable.textContent = 'Update Timetable Record';
    btnCancelTimetableEdit.style.display = 'inline-block';
    timetableForm.scrollIntoView({ behavior: 'smooth' });
  };

  if (btnCancelTimetableEdit) {
    btnCancelTimetableEdit.addEventListener('click', () => {
      timetableEditId.value = '';
      timetableForm.reset();
      btnSubmitTimetable.textContent = 'Add Timetable Record';
      btnCancelTimetableEdit.style.display = 'none';
    });
  }

  window.deleteTimetableEntry = function(ttId) {
    if (!confirm('Are you sure you want to delete this timetable record?')) return;
    const store = window.DataStore.getStore();
    store.timetables = (store.timetables || []).filter(t => t.id !== ttId);
    window.DataStore.saveStore(store);
    renderTimetableAdmin();
    alert('Timetable record removed.');
  };

  // ==========================================================
  // SECTION 4: AVAILABILITY & OVERRIDES MANAGEMENT
  // ==========================================================
  function renderAvailabilityAdmin() {
    const store = window.DataStore.getStore();
    const availTableBody = document.getElementById('admin-availability-body');
    const overridesTableBody = document.getElementById('admin-overrides-body');

    if (availTableBody) {
      availTableBody.innerHTML = (store.faculty || []).map(f => {
        const cur = (store.availability || []).find(a => a.faculty_id === f.id);
        const status = cur ? cur.status : 'not_updated';
        const note = cur ? cur.note : '';

        return `
          <tr>
            <td><strong>${f.full_name}</strong></td>
            <td>${f.department}</td>
            <td>${f.room}</td>
            <td>${window.Utils.renderStatusBadge(status)}</td>
            <td>${note || '<span style="color: var(--text-muted)">—</span>'}</td>
          </tr>
        `;
      }).join('');
    }

    if (overridesTableBody) {
      if (!store.overrides || store.overrides.length === 0) {
        overridesTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No active overrides.</td></tr>`;
      } else {
        overridesTableBody.innerHTML = store.overrides.map(ov => {
          const f = (store.faculty || []).find(item => item.id === ov.faculty_id);
          return `
            <tr>
              <td><strong>${f ? f.full_name : 'Unknown'}</strong></td>
              <td>${ov.date}</td>
              <td>${window.Utils.formatTime12Hour(ov.start_time)} - ${window.Utils.formatTime12Hour(ov.end_time)}</td>
              <td>${window.Utils.renderStatusBadge(ov.status)}</td>
              <td>${ov.note || '—'}</td>
              <td>
                <button class="btn btn-danger btn-sm" onclick="window.adminDeleteOverride('${ov.id}')">Remove</button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  window.adminDeleteOverride = function(overrideId) {
    if (!confirm('Cancel this override?')) return;
    const store = window.DataStore.getStore();
    store.overrides = (store.overrides || []).filter(o => o.id !== overrideId);
    window.DataStore.saveStore(store);
    renderAvailabilityAdmin();
  };

  // ==========================================================
  // SECTION 5: IMPORT HISTORY
  // ==========================================================
  function renderImportHistory() {
    const store = window.DataStore.getStore();
    const historyBody = document.getElementById('import-history-body');
    if (!historyBody) return;

    if (!store.imports || store.imports.length === 0) {
      historyBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No timetable imports recorded yet.</td></tr>`;
      return;
    }

    historyBody.innerHTML = store.imports.map(imp => {
      let statusBadge = `<span class="badge-status badge-available">${imp.status.toUpperCase()}</span>`;
      if (imp.status === 'partial') statusBadge = `<span class="badge-status badge-in_meeting">PARTIAL</span>`;
      if (imp.status === 'failed') statusBadge = `<span class="badge-status badge-unavailable">FAILED</span>`;

      return `
        <tr>
          <td><strong>${imp.file_name}</strong></td>
          <td><span class="badge-status badge-not_updated">${imp.file_type.toUpperCase()}</span></td>
          <td>${imp.uploaded_by}</td>
          <td>${imp.rows_detected}</td>
          <td><strong>${imp.rows_imported}</strong></td>
          <td>${statusBadge}</td>
          <td>${new Date(imp.created_at).toLocaleDateString()}</td>
        </tr>
      `;
    }).join('');
  }

  // Initial runs
  renderFacultyTable();
  renderTimetableAdmin();
  renderAvailabilityAdmin();
  renderImportHistory();
});
