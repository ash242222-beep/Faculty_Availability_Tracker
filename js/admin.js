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
  const facultySearchInput = document.getElementById('admin-faculty-search');
  const facultyDeptFilter = document.getElementById('admin-faculty-dept-filter');

  let facultyCache = [];

  async function renderFacultyTable() {
    if (!facultyTableBody) return;

    const query = facultySearchInput ? facultySearchInput.value.trim() : '';
    const selectedDept = facultyDeptFilter ? facultyDeptFilter.value : 'All Departments';

    facultyTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Loading faculty records...</td></tr>`;

    try {
      const facultyList = await window.FacultyService.getAllFaculty({
        department: selectedDept,
        searchQuery: query
      });

      facultyCache = facultyList;

      if (!facultyList || facultyList.length === 0) {
        facultyTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No matching faculty members found.</td></tr>`;
        return;
      }

      facultyTableBody.innerHTML = facultyList.map(f => {
        const statusBadge = f.is_active !== false
          ? `<span class="badge-status badge-available">Active</span>`
          : `<span class="badge-status badge-unavailable">Paused (Inactive)</span>`;

        const pauseActionBtn = f.is_active !== false
          ? `<button class="btn btn-secondary btn-sm" onclick="window.toggleFacultyActive('${f.id}', false)">Pause</button>`
          : `<button class="btn btn-primary btn-sm" onclick="window.toggleFacultyActive('${f.id}', true)">Reactivate</button>`;

        return `
          <tr>
            <td><strong>${f.full_name}</strong><div style="font-size: 0.75rem; color: var(--text-muted);">${f.email}</div></td>
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

      populateFacultyDropdowns();
    } catch (err) {
      console.error('Error loading faculty table:', err);
      facultyTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 1.5rem;">Error loading faculty records.</td></tr>`;
    }
  }

  // Live filter handlers
  let adminSearchTimer = null;
  if (facultySearchInput) {
    facultySearchInput.addEventListener('input', () => {
      clearTimeout(adminSearchTimer);
      adminSearchTimer = setTimeout(renderFacultyTable, 200);
    });
  }

  if (facultyDeptFilter) {
    facultyDeptFilter.addEventListener('change', renderFacultyTable);
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
    facultyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
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

      const submitBtn = facultyForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
      }

      try {
        if (editId) {
          const res = await window.FacultyService.updateFaculty(editId, {
            full_name: name,
            email: email,
            department: dept,
            designation: designation,
            room: room
          });
          if (!res.success) {
            alert('Error updating faculty: ' + res.error);
            return;
          }
        } else {
          const res = await window.FacultyService.addFaculty({
            full_name: name,
            email: email,
            department: dept,
            designation: designation,
            room: room
          });
          if (!res.success) {
            alert('Error adding faculty: ' + res.error);
            return;
          }
        }

        facultyModal.style.display = 'none';
        await renderFacultyTable();
        alert(editId ? 'Faculty information updated successfully.' : 'New faculty member added successfully.');
      } catch (err) {
        alert('Failed to save faculty: ' + err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Save Faculty';
        }
      }
    });
  }

  window.editFaculty = async function(facultyId) {
    let f = facultyCache.find(item => item.id === facultyId);
    if (!f) {
      f = await window.FacultyService.getFacultyById(facultyId);
    }
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
  window.toggleFacultyActive = async function(facultyId, newActiveState) {
    let f = facultyCache.find(item => item.id === facultyId);
    if (!f) {
      f = await window.FacultyService.getFacultyById(facultyId);
    }
    if (!f) return;

    const actionName = newActiveState ? 'reactivate' : 'pause';
    if (!confirm(`Are you sure you want to ${actionName} the account of ${f.full_name}?`)) return;

    try {
      const res = await window.FacultyService.toggleFacultyActive(facultyId, newActiveState);
      if (res.success) {
        await renderFacultyTable();
        alert(`Account for ${f.full_name} has been ${newActiveState ? 'reactivated' : 'paused'}.`);
      } else {
        alert('Failed to update status: ' + res.error);
      }
    } catch (err) {
      alert('Error updating status: ' + err.message);
    }
  };

  async function populateFacultyDropdowns() {
    const facultySelects = [
      document.getElementById('tt-faculty-select'),
      document.getElementById('tt-filter-faculty')
    ];

    try {
      const facultyList = await window.FacultyService.getAllFaculty();
      facultySelects.forEach(selectEl => {
        if (!selectEl) return;
        const currentVal = selectEl.value;
        const isFilter = selectEl.id === 'tt-filter-faculty';

        let optionsHtml = isFilter ? '<option value="all">All Faculty</option>' : '<option value="">-- Select Faculty --</option>';
        optionsHtml += (facultyList || []).map(f => `
          <option value="${f.id}">${f.full_name} (${f.department})</option>
        `).join('');

        selectEl.innerHTML = optionsHtml;
        if (currentVal) selectEl.value = currentVal;
      });
    } catch (e) {
      console.warn('Dropdown populate notice:', e);
    }
  }

  // ==========================================================
  // SECTION 2: TIMETABLE MANAGEMENT (Timetable Engine & Validation)
  // ==========================================================
  const timetableTableBody = document.getElementById('timetable-admin-body');
  const timetableForm = document.getElementById('timetable-form');
  const timetableEditId = document.getElementById('tt-edit-id');
  const btnSubmitTimetable = document.getElementById('btn-submit-timetable');
  const btnCancelTimetableEdit = document.getElementById('btn-cancel-tt-edit');
  const filterFacultySelect = document.getElementById('tt-filter-faculty');
  const filterDaySelect = document.getElementById('tt-filter-day');
  const ttSearchInput = document.getElementById('tt-search-input');
  const ttCountBadge = document.getElementById('tt-count-badge');
  const ttValidationAlert = document.getElementById('tt-validation-alert');
  const ttDurationBadge = document.getElementById('tt-duration-badge');
  const ttFormTitle = document.getElementById('tt-form-title');
  const ttFacultySelect = document.getElementById('tt-faculty-select');
  const ttDay = document.getElementById('tt-day');
  const ttStartTime = document.getElementById('tt-start-time');
  const ttEndTime = document.getElementById('tt-end-time');
  const ttActivity = document.getElementById('tt-activity');
  const ttRoom = document.getElementById('tt-room');
  const ttIsActive = document.getElementById('tt-is-active');

  // Interactive Live Validation Check
  function checkLiveTimetableValidation() {
    if (!ttStartTime || !ttEndTime || !ttValidationAlert) return;

    const startVal = ttStartTime.value;
    const endVal = ttEndTime.value;

    if (ttDurationBadge && startVal && endVal) {
      const dur = window.Utils.calculateDuration(startVal, endVal);
      ttDurationBadge.textContent = dur ? `Duration: ${dur}` : 'Invalid Window';
    }

    const payload = {
      faculty_id: ttFacultySelect ? ttFacultySelect.value : '',
      day_of_week: ttDay ? ttDay.value : 'Monday',
      start_time: startVal,
      end_time: endVal,
      activity: ttActivity ? ttActivity.value.trim() : 'Class',
      room: ttRoom ? ttRoom.value.trim() : '',
      is_active: ttIsActive ? ttIsActive.checked : true
    };

    const currentEditId = timetableEditId ? timetableEditId.value : null;
    const validation = window.TimetableService.validateTimetableEntry(payload, currentEditId);

    if (!validation.isValid) {
      ttValidationAlert.style.display = 'block';
      ttValidationAlert.style.backgroundColor = '#fef2f2';
      ttValidationAlert.style.color = '#991b1b';
      ttValidationAlert.style.border = '1px solid #fecaca';
      ttValidationAlert.innerHTML = `<strong>Validation Notice:</strong> ${validation.errors.join(' ')}`;
    } else if (validation.warnings.length > 0) {
      ttValidationAlert.style.display = 'block';
      ttValidationAlert.style.backgroundColor = '#fffbeb';
      ttValidationAlert.style.color = '#92400e';
      ttValidationAlert.style.border = '1px solid #fde68a';
      ttValidationAlert.innerHTML = `<strong>Advisory:</strong> ${validation.warnings.join(' ')}`;
    } else {
      ttValidationAlert.style.display = 'block';
      ttValidationAlert.style.backgroundColor = '#f0fdf4';
      ttValidationAlert.style.color = '#166534';
      ttValidationAlert.style.border = '1px solid #bbf7d0';
      ttValidationAlert.innerHTML = `<span>&#10003; Slot is valid and conflict-free.</span>`;
    }
  }

  // Attach live validation listeners
  [ttFacultySelect, ttDay, ttStartTime, ttEndTime, ttActivity, ttRoom, ttIsActive].forEach(el => {
    if (el) {
      el.addEventListener('input', checkLiveTimetableValidation);
      el.addEventListener('change', checkLiveTimetableValidation);
    }
  });

  async function renderTimetableAdmin() {
    if (!timetableTableBody) return;

    const facultyFilter = filterFacultySelect ? filterFacultySelect.value : 'all';
    const dayFilter = filterDaySelect ? filterDaySelect.value : 'all';
    const searchQuery = ttSearchInput ? ttSearchInput.value.trim() : '';

    if (ttCountBadge) ttCountBadge.textContent = 'Refreshing...';

    try {
      const records = await window.TimetableService.getAllTimetables({
        facultyId: facultyFilter,
        dayOfWeek: dayFilter,
        searchQuery: searchQuery
      });

      const facultyList = await window.FacultyService.getAllFaculty();
      const facultyMap = (facultyList || []).reduce((acc, f) => {
        acc[f.id] = f;
        return acc;
      }, {});

      if (ttCountBadge) {
        ttCountBadge.textContent = `${records.length} slot${records.length === 1 ? '' : 's'}`;
      }

      if (records.length === 0) {
        timetableTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No timetable entries match filter criteria.</td></tr>`;
        return;
      }

      timetableTableBody.innerHTML = records.map(t => {
        const fac = facultyMap[t.faculty_id];
        const facName = fac ? fac.full_name : 'Unknown Faculty';
        const facDept = fac ? fac.department : '';
        const durationStr = window.Utils.calculateDuration(t.start_time, t.end_time);
        const isActive = t.is_active !== false;

        const statusBadge = isActive
          ? `<span class="badge-status badge-available" style="font-size: 0.75rem;">Active</span>`
          : `<span class="badge-status badge-unavailable" style="font-size: 0.75rem;">Paused</span>`;

        return `
          <tr ${!isActive ? 'style="opacity: 0.75; background: #fafafa;"' : ''}>
            <td>
              <strong>${facName}</strong>
              ${facDept ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${facDept}</div>` : ''}
            </td>
            <td><strong>${t.day_of_week}</strong></td>
            <td>
              <div>${window.Utils.formatTime12Hour(t.start_time)} - ${window.Utils.formatTime12Hour(t.end_time)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${durationStr}</div>
            </td>
            <td><strong>${t.activity}</strong></td>
            <td>${t.room || '—'}</td>
            <td>${statusBadge}</td>
            <td>
              <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                <button class="btn btn-secondary btn-sm" onclick="window.editTimetableEntry('${t.id}')">Edit</button>
                <button class="btn btn-secondary btn-sm" onclick="window.toggleTimetableActive('${t.id}', ${!isActive})">
                  ${isActive ? 'Pause' : 'Activate'}
                </button>
                <button class="btn btn-danger btn-sm" onclick="window.deleteTimetableEntry('${t.id}')">Delete</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error rendering timetable admin:', err);
      timetableTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 1.5rem;">Failed to load timetables: ${err.message}</td></tr>`;
    }
  }

  // Filter Listeners
  if (filterFacultySelect) filterFacultySelect.addEventListener('change', renderTimetableAdmin);
  if (filterDaySelect) filterDaySelect.addEventListener('change', renderTimetableAdmin);
  if (ttSearchInput) ttSearchInput.addEventListener('input', debounce(renderTimetableAdmin, 250));

  // Timetable Form Submit
  if (timetableForm) {
    timetableForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = timetableEditId.value;

      const payload = {
        faculty_id: ttFacultySelect.value,
        day_of_week: ttDay.value,
        start_time: ttStartTime.value,
        end_time: ttEndTime.value,
        activity: ttActivity.value.trim(),
        room: ttRoom.value.trim(),
        is_active: ttIsActive.checked
      };

      btnSubmitTimetable.disabled = true;
      btnSubmitTimetable.textContent = editId ? 'Updating...' : 'Saving...';

      try {
        let res;
        if (editId) {
          res = await window.TimetableService.updateTimetable(editId, payload);
        } else {
          res = await window.TimetableService.addTimetable(payload);
        }

        if (res.success) {
          timetableEditId.value = '';
          timetableForm.reset();
          if (ttIsActive) ttIsActive.checked = true;
          if (ttFormTitle) ttFormTitle.textContent = 'Add Timetable Record';
          btnSubmitTimetable.textContent = 'Add Timetable Record';
          btnCancelTimetableEdit.style.display = 'none';
          if (ttValidationAlert) ttValidationAlert.style.display = 'none';

          await renderTimetableAdmin();
          
          if (res.warnings && res.warnings.length > 0) {
            alert(`Timetable record saved successfully!\n\nAdvisory: ${res.warnings.join('\n')}`);
          } else {
            alert(editId ? 'Timetable record updated successfully.' : 'Timetable record added successfully.');
          }
        } else {
          alert('Validation / Collision Error:\n' + res.error);
          checkLiveTimetableValidation();
        }
      } catch (err) {
        alert('Error saving timetable record: ' + err.message);
      } finally {
        btnSubmitTimetable.disabled = false;
        btnSubmitTimetable.textContent = editId ? 'Update Timetable Record' : 'Add Timetable Record';
      }
    });
  }

  // Edit Timetable Entry
  window.editTimetableEntry = async function(ttId) {
    try {
      const t = await window.TimetableService.getTimetableById(ttId);
      if (!t) {
        alert('Timetable record not found.');
        return;
      }

      timetableEditId.value = t.id;
      if (ttFacultySelect) ttFacultySelect.value = t.faculty_id;
      if (ttDay) ttDay.value = t.day_of_week;
      if (ttStartTime) ttStartTime.value = t.start_time;
      if (ttEndTime) ttEndTime.value = t.end_time;
      if (ttActivity) ttActivity.value = t.activity;
      if (ttRoom) ttRoom.value = t.room || '';
      if (ttIsActive) ttIsActive.checked = t.is_active !== false;

      if (ttFormTitle) ttFormTitle.textContent = 'Edit Timetable Record';
      btnSubmitTimetable.textContent = 'Update Timetable Record';
      btnCancelTimetableEdit.style.display = 'inline-block';
      checkLiveTimetableValidation();
      timetableForm.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      alert('Error loading record: ' + err.message);
    }
  };

  // Cancel Timetable Edit
  if (btnCancelTimetableEdit) {
    btnCancelTimetableEdit.addEventListener('click', () => {
      timetableEditId.value = '';
      timetableForm.reset();
      if (ttIsActive) ttIsActive.checked = true;
      if (ttFormTitle) ttFormTitle.textContent = 'Add Timetable Record';
      btnSubmitTimetable.textContent = 'Add Timetable Record';
      btnCancelTimetableEdit.style.display = 'none';
      if (ttValidationAlert) ttValidationAlert.style.display = 'none';
      if (ttDurationBadge) ttDurationBadge.textContent = 'Duration: 1 hr';
    });
  }

  // Toggle Active State
  window.toggleTimetableActive = async function(ttId, newActiveState) {
    const actionName = newActiveState ? 'activate' : 'pause';
    if (!confirm(`Are you sure you want to ${actionName} this timetable slot?`)) return;

    try {
      const res = await window.TimetableService.toggleTimetableActive(ttId, newActiveState);
      if (res.success) {
        await renderTimetableAdmin();
      } else {
        alert('Error: ' + res.error);
      }
    } catch (err) {
      alert('Error updating slot status: ' + err.message);
    }
  };

  // Delete Timetable Entry
  window.deleteTimetableEntry = async function(ttId) {
    if (!confirm('Are you sure you want to permanently delete this timetable record?')) return;

    try {
      const res = await window.TimetableService.deleteTimetable(ttId);
      if (res.success) {
        await renderTimetableAdmin();
        alert('Timetable record removed.');
      } else {
        alert('Error: ' + res.error);
      }
    } catch (err) {
      alert('Error deleting record: ' + err.message);
    }
  };

  // Global change listener to keep timetable table updated
  window.addEventListener('timetable-data-changed', () => {
    renderTimetableAdmin();
  });

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
