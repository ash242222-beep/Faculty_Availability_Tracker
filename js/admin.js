/**
 * Faculty Availability Tracker - Administration Dashboard Script
 * Version: v0.1.0
 */

document.addEventListener('DOMContentLoaded', () => {
  // Enforce admin authorization
  Auth.requireRole(['admin']);
  Auth.initHeaderAuth();

  // Helper: debounce
  const debounce = (window.Utils && window.Utils.debounce) || function(fn, delay = 250) {
    let timer = null;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  };

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
    if (sectionId === 'section-availability') {
      if (typeof renderFacultyAvailabilityOverview === 'function') {
        renderFacultyAvailabilityOverview();
      }
    }
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
      document.getElementById('tt-filter-faculty'),
      document.getElementById('import-target-faculty')
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
  // SECTION 4: AVAILABILITY OVERVIEW (SIMPLE & INTUITIVE)
  // ==========================================================
  const adminCardsGrid = document.getElementById('admin-faculty-cards-grid');
  const adminAvailEmptyState = document.getElementById('admin-avail-empty-state');
  const adminAvailSearch = document.getElementById('admin-avail-search');
  const adminAvailDept = document.getElementById('admin-avail-dept');
  const adminAvailDate = document.getElementById('admin-avail-date');
  const adminAvailTime = document.getElementById('admin-avail-time');
  const btnAdminAvailNow = document.getElementById('btn-admin-avail-now');
  const btnCheckAdminAvail = document.getElementById('btn-check-admin-avail');
  const btnRefreshAvail = document.getElementById('btn-refresh-availability-admin');

  // Metric stat elements
  const statTotalFaculty = document.getElementById('stat-total-faculty');
  const statAvailCount = document.getElementById('stat-avail-count');
  const statClassCount = document.getElementById('stat-class-count');
  const statBusyCount = document.getElementById('stat-busy-count');
  const adminAvailTimeBanner = document.getElementById('admin-avail-time-banner');

  // Override Form elements (advanced)
  const adminOverridesBody = document.getElementById('admin-overrides-body');
  const adminOvForm = document.getElementById('admin-override-form');
  const adminOvFormTitle = document.getElementById('admin-override-form-title');
  const adminOvEditId = document.getElementById('admin-ov-edit-id');
  const adminOvFaculty = document.getElementById('admin-ov-faculty');
  const adminOvDate = document.getElementById('admin-ov-date');
  const adminOvStart = document.getElementById('admin-ov-start');
  const adminOvEnd = document.getElementById('admin-ov-end');
  const adminOvStatus = document.getElementById('admin-ov-status');
  const adminOvNote = document.getElementById('admin-ov-note');
  const adminOvDurationBadge = document.getElementById('admin-ov-duration-badge');
  const adminOvValidationAlert = document.getElementById('admin-ov-validation-alert');
  const btnSubmitAdminOv = document.getElementById('btn-submit-admin-ov');
  const btnCancelAdminOv = document.getElementById('btn-cancel-admin-ov');

  // Override Filter elements
  const adminOvFilterFaculty = document.getElementById('admin-ov-filter-faculty');
  const adminOvFilterStatus = document.getElementById('admin-ov-filter-status');
  const adminOvFilterTiming = document.getElementById('admin-ov-filter-timing');
  const adminOvCountBadge = document.getElementById('admin-ov-count-badge');

  // Set default date to today and time to current time
  const initNow = new Date();
  const initTodayStr = initNow.toISOString().split('T')[0];
  const initHours = String(initNow.getHours()).padStart(2, '0');
  const initMinutes = String(initNow.getMinutes()).padStart(2, '0');

  if (adminAvailDate && !adminAvailDate.value) adminAvailDate.value = initTodayStr;
  if (adminAvailTime && !adminAvailTime.value) adminAvailTime.value = `${initHours}:${initMinutes}`;
  if (adminOvDate && !adminOvDate.value) adminOvDate.value = initTodayStr;

  // Populate department filter
  if (adminAvailDept && window.APP_CONFIG && Array.isArray(window.APP_CONFIG.DEPARTMENTS)) {
    adminAvailDept.innerHTML = window.APP_CONFIG.DEPARTMENTS.map(dept => 
      `<option value="${dept}">${dept}</option>`
    ).join('');
  }

  // Currently loaded faculty cache
  let currentLoadedFaculty = [];

  // Render Faculty Availability Cards (Simple & Intuitive like Student Portal)
  async function renderFacultyAvailabilityOverview() {
    if (!adminCardsGrid) return;

    try {
      const query = (adminAvailSearch ? adminAvailSearch.value : '').toLowerCase().trim();
      const selectedDept = adminAvailDept ? adminAvailDept.value : 'All Departments';
      const dateVal = (adminAvailDate && adminAvailDate.value) ? adminAvailDate.value : new Date().toISOString().split('T')[0];
      const timeVal = (adminAvailTime && adminAvailTime.value) ? adminAvailTime.value : '10:00';

      // Update banner with formatted date & time
      if (adminAvailTimeBanner) {
        const dObj = new Date(dateVal + 'T' + timeVal);
        const dateFormatted = isNaN(dObj.getTime()) ? dateVal : dObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        adminAvailTimeBanner.textContent = `Status evaluated for ${dateFormatted} at ${window.Utils.formatTime12Hour(timeVal)}`;
      }

      // Fetch all faculty members
      const facultyList = await window.FacultyService.getAllFaculty();
      currentLoadedFaculty = facultyList;

      // Filter by department and search query
      const filtered = facultyList.filter(f => {
        const matchesDept = (selectedDept === 'All Departments') || (f.department === selectedDept);
        if (!matchesDept) return false;

        if (!query) return true;
        const nameMatch = (f.full_name || '').toLowerCase().includes(query);
        const deptMatch = (f.department || '').toLowerCase().includes(query);
        const desigMatch = (f.designation || '').toLowerCase().includes(query);
        const roomMatch = (f.room || '').toLowerCase().includes(query);
        const emailMatch = (f.email || '').toLowerCase().includes(query);
        return nameMatch || deptMatch || desigMatch || roomMatch || emailMatch;
      });

      // Update stat counters
      let countAvail = 0;
      let countClass = 0;
      let countBusy = 0;

      filtered.forEach(f => {
        const avail = window.Utils.getFacultyAvailability(f.id, dateVal, timeVal, f);
        if (avail.status === 'available' || avail.status === 'present') countAvail++;
        else if (avail.status === 'in_class') countClass++;
        else if (avail.status === 'in_meeting' || avail.status === 'unavailable') countBusy++;
      });

      if (statTotalFaculty) statTotalFaculty.textContent = filtered.length;
      if (statAvailCount) statAvailCount.textContent = countAvail;
      if (statClassCount) statClassCount.textContent = countClass;
      if (statBusyCount) statBusyCount.textContent = countBusy;

      if (filtered.length === 0) {
        adminCardsGrid.innerHTML = '';
        if (adminAvailEmptyState) adminAvailEmptyState.style.display = 'block';
        return;
      }

      if (adminAvailEmptyState) adminAvailEmptyState.style.display = 'none';

      // Render cards
      adminCardsGrid.innerHTML = filtered.map(faculty => {
        const avail = window.Utils.getFacultyAvailability(faculty.id, dateVal, timeVal, faculty);
        const statusBadge = window.Utils.renderStatusBadge(avail.status);

        let sourceBadge = '';
        if (avail.source === 'override') {
          sourceBadge = `<span class="badge-status badge-in_meeting" style="font-size: 0.7rem;">Active Override</span>`;
        } else if (avail.source === 'timetable') {
          sourceBadge = `<span class="badge-status badge-in_class" style="font-size: 0.7rem;">Class Timetable</span>`;
        } else if (avail.source === 'manual_status') {
          sourceBadge = `<span class="badge-status badge-present" style="font-size: 0.7rem;">Faculty Check-in</span>`;
        } else if (avail.source === 'inactive_account') {
          sourceBadge = `<span class="badge-status badge-unavailable" style="font-size: 0.7rem;">Account Inactive</span>`;
        } else {
          sourceBadge = `<span class="badge-status badge-not_updated" style="font-size: 0.7rem;">Default</span>`;
        }

        let contextText = '';
        if (avail.source === 'timetable') {
          contextText = `<strong>Class:</strong> ${avail.activity} &bull; Room: <strong>${avail.room || 'TBD'}</strong> (${avail.scheduleWindow || ''})`;
        } else if (avail.source === 'override') {
          contextText = `<strong>Override:</strong> ${avail.note || 'Special schedule posted'} (${avail.overrideWindow || ''})`;
        } else if (avail.note) {
          contextText = `<strong>Note:</strong> "${avail.note}"`;
        } else if (avail.status === 'available' || avail.status === 'present') {
          contextText = `Free and available in cabin for meetings / doubt sessions`;
        } else {
          contextText = `No scheduled classes during this time period`;
        }

        const isPaused = faculty.is_active === false;

        return `
          <div class="faculty-card card" id="admin-card-faculty-${faculty.id}" style="margin-bottom: 0; display: flex; flex-direction: column; justify-content: space-between; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); border: 1px solid var(--border-color); opacity: ${isPaused ? '0.8' : '1'};">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.75rem;">
                <div>
                  <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.2rem; color: var(--text-main);">
                    ${faculty.full_name}
                    ${isPaused ? '<span class="badge-status badge-unavailable" style="font-size: 0.7rem; margin-left: 0.35rem;">Paused</span>' : ''}
                  </h3>
                  <div style="font-size: 0.8125rem; color: var(--text-muted); font-weight: 500;">
                    ${faculty.designation || 'Faculty'} &bull; ${faculty.department || 'General'}
                  </div>
                </div>
                <div>
                  ${statusBadge}
                </div>
              </div>

              <!-- Location & Contact Grid -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: var(--surface-muted); padding: 0.625rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.8125rem; margin-bottom: 0.75rem; border: 1px solid var(--border-color);">
                <div>
                  <span style="color: var(--text-muted); display: block; font-size: 0.7rem; text-transform: uppercase; font-weight: 600;">Office / Cabin</span>
                  <strong style="color: var(--text-main);">${faculty.room || 'Not Assigned'}</strong>
                </div>
                <div>
                  <span style="color: var(--text-muted); display: block; font-size: 0.7rem; text-transform: uppercase; font-weight: 600;">Email</span>
                  <a href="mailto:${faculty.email}" style="color: var(--primary); text-decoration: none; word-break: break-all;">${faculty.email || '—'}</a>
                </div>
              </div>

              <!-- Real-time Status Card -->
              <div style="padding: 0.625rem 0.75rem; background: #fff; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 0.875rem; font-size: 0.8125rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                  <span style="font-size: 0.725rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">
                    Status @ ${window.Utils.formatTime12Hour(timeVal)}
                  </span>
                  ${sourceBadge}
                </div>
                <div style="color: var(--text-main); line-height: 1.4;">
                  ${contextText}
                </div>
              </div>
            </div>

            <!-- Card Action Buttons -->
            <div style="display: flex; gap: 0.5rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
              <button type="button" class="btn btn-secondary btn-sm" style="flex: 1.2; justify-content: center;" onclick="window.adminViewTimetable('${faculty.id}')">
                📅 View Timetable
              </button>
              <button type="button" class="btn btn-secondary btn-sm" style="flex: 1; justify-content: center;" onclick="window.adminQuickCheck('${faculty.id}')">
                🔍 Details
              </button>
            </div>
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error('Error rendering faculty availability overview:', err);
    }
  }

  // Admin View Weekly Timetable Modal
  window.adminViewTimetable = async function(facultyId) {
    const faculty = currentLoadedFaculty.find(f => f.id === facultyId) || { full_name: 'Faculty Member' };
    const modal = document.getElementById('admin-timetable-modal');
    const nameElem = document.getElementById('admin-modal-faculty-name');
    const bodyElem = document.getElementById('admin-modal-timetable-body');

    if (!modal || !bodyElem) return;

    if (nameElem) {
      nameElem.textContent = `${faculty.full_name} (${faculty.department || ''}) — Cabin: ${faculty.room || 'N/A'}`;
    }

    bodyElem.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">Loading weekly timetable...</td></tr>';
    modal.style.display = 'flex';

    try {
      let slots = [];
      if (window.TimetableService && typeof window.TimetableService.getTimetablesByFaculty === 'function') {
        slots = await window.TimetableService.getTimetablesByFaculty(facultyId);
      } else {
        const store = window.DataStore ? window.DataStore.getStore() : { timetables: [] };
        slots = (store.timetables || []).filter(t => t.faculty_id === facultyId);
      }

      if (!slots || slots.length === 0) {
        bodyElem.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">No weekly scheduled classes found for this faculty member.</td></tr>';
        return;
      }

      const dayOrder = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7 };
      slots.sort((a, b) => {
        const dayDiff = (dayOrder[a.day_of_week] || 99) - (dayOrder[b.day_of_week] || 99);
        if (dayDiff !== 0) return dayDiff;
        return (a.start_time || '').localeCompare(b.start_time || '');
      });

      bodyElem.innerHTML = slots.map(slot => `
        <tr>
          <td><strong style="color: var(--text-main);">${slot.day_of_week}</strong></td>
          <td>${slot.start_time} - ${slot.end_time}</td>
          <td><strong style="color: var(--primary);">${slot.subject}</strong></td>
          <td>${slot.room || faculty.room || 'Campus Room'}</td>
        </tr>
      `).join('');
    } catch (err) {
      bodyElem.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--danger); padding: 1.5rem;">Failed to load timetable: ${err.message}</td></tr>`;
    }
  };

  // Admin Quick Check Breakdown Modal
  window.adminQuickCheck = function(facultyId) {
    const faculty = currentLoadedFaculty.find(f => f.id === facultyId) || { full_name: 'Faculty Member' };
    const dateVal = (adminAvailDate && adminAvailDate.value) ? adminAvailDate.value : new Date().toISOString().split('T')[0];
    const timeVal = (adminAvailTime && adminAvailTime.value) ? adminAvailTime.value : '10:00';

    const avail = window.Utils.getFacultyAvailability(facultyId, dateVal, timeVal, faculty);
    const modal = document.getElementById('admin-availability-breakdown-modal');
    const titleElem = document.getElementById('admin-breakdown-faculty-title');
    const contentElem = document.getElementById('admin-breakdown-modal-content');

    if (!modal || !contentElem) return;

    if (titleElem) {
      titleElem.textContent = `${faculty.full_name} (${faculty.department || 'General'})`;
    }

    const statusBadge = window.Utils.renderStatusBadge(avail.status);

    contentElem.innerHTML = `
      <div style="margin-bottom: 1rem; text-align: center;">
        <div style="margin-bottom: 0.5rem;">${statusBadge}</div>
        <div style="font-size: 0.875rem; color: var(--text-muted);">
          Resolution for <strong>${dateVal}</strong> at <strong>${window.Utils.formatTime12Hour(timeVal)}</strong>
        </div>
      </div>

      <div style="background: var(--surface-muted); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 0.85rem; line-height: 1.6;">
        <div><strong>Rule Applied:</strong> Tier ${avail.ruleTier || '—'} (${avail.source || 'default'})</div>
        <div><strong>Office / Cabin:</strong> ${faculty.room || 'Not Assigned'}</div>
        ${avail.activity ? `<div><strong>Scheduled Activity:</strong> ${avail.activity}</div>` : ''}
        ${avail.room ? `<div><strong>Venue:</strong> ${avail.room}</div>` : ''}
        ${avail.note ? `<div><strong>Status Note:</strong> "${avail.note}"</div>` : ''}
        ${avail.overrideWindow ? `<div><strong>Override Window:</strong> ${avail.overrideWindow}</div>` : ''}
        ${avail.scheduleWindow ? `<div><strong>Class Window:</strong> ${avail.scheduleWindow}</div>` : ''}
      </div>
    `;

    modal.style.display = 'flex';
  };

  // Modal close handlers
  const closeAdminTtModal = document.getElementById('close-admin-timetable-modal');
  if (closeAdminTtModal) {
    closeAdminTtModal.addEventListener('click', () => {
      const modal = document.getElementById('admin-timetable-modal');
      if (modal) modal.style.display = 'none';
    });
  }

  const closeAdminBdModal = document.getElementById('close-admin-breakdown-modal');
  if (closeAdminBdModal) {
    closeAdminBdModal.addEventListener('click', () => {
      const modal = document.getElementById('admin-availability-breakdown-modal');
      if (modal) modal.style.display = 'none';
    });
  }

  window.addEventListener('click', (e) => {
    const ttModal = document.getElementById('admin-timetable-modal');
    if (ttModal && e.target === ttModal) ttModal.style.display = 'none';
    const bdModal = document.getElementById('admin-availability-breakdown-modal');
    if (bdModal && e.target === bdModal) bdModal.style.display = 'none';
  });

  // Render Overrides Table
  async function renderOverridesAdmin() {
    if (!adminOverridesBody) return;

    try {
      const selectedFaculty = adminOvFilterFaculty ? adminOvFilterFaculty.value : 'all';
      const selectedStatus = adminOvFilterStatus ? adminOvFilterStatus.value : 'all';
      const timingFilter = adminOvFilterTiming ? adminOvFilterTiming.value : 'active_today';

      const overrides = await window.AvailabilityService.getAllOverrides({
        facultyId: selectedFaculty,
        status: selectedStatus
      });

      const facultyList = await window.FacultyService.getAllFaculty();
      const facultyMap = new Map(facultyList.map(f => [f.id, f]));

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Filter by timing
      let filteredOverrides = overrides.filter(ov => {
        if (timingFilter === 'today') {
          return ov.date === todayStr;
        }
        if (timingFilter === 'active_today') {
          return ov.date >= todayStr;
        }
        if (timingFilter === 'past') {
          return ov.date < todayStr;
        }
        return true; // 'all'
      });

      if (adminOvCountBadge) {
        adminOvCountBadge.textContent = `${filteredOverrides.length} Override${filteredOverrides.length === 1 ? '' : 's'}`;
      }

      if (filteredOverrides.length === 0) {
        adminOverridesBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.75rem;">No overrides matching the current filter.</td></tr>`;
        return;
      }

      adminOverridesBody.innerHTML = filteredOverrides.map(ov => {
        const fac = facultyMap.get(ov.faculty_id);
        const facultyName = fac ? fac.full_name : 'Unknown Faculty';
        const durationText = window.Utils.calculateDuration(ov.start_time, ov.end_time);

        // Calculate timeline status
        let timelineBadge = '';
        if (ov.date === todayStr) {
          if (window.Utils.isTimeBetween(currentTimeStr, ov.start_time, ov.end_time)) {
            timelineBadge = `<span class="badge-status badge-available" style="font-size: 0.7rem; font-weight: 700;">Active Now</span>`;
          } else if (window.Utils.compareTime(currentTimeStr, ov.start_time) < 0) {
            timelineBadge = `<span class="badge-status badge-in_meeting" style="font-size: 0.7rem;">Today Later</span>`;
          } else {
            timelineBadge = `<span class="badge-status badge-not_updated" style="font-size: 0.7rem;">Expired Today</span>`;
          }
        } else if (ov.date > todayStr) {
          timelineBadge = `<span class="badge-status badge-in_class" style="font-size: 0.7rem;">Upcoming</span>`;
        } else {
          timelineBadge = `<span class="badge-status badge-not_updated" style="font-size: 0.7rem;">Past</span>`;
        }

        return `
          <tr>
            <td>
              <strong>${facultyName}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${fac ? fac.department : ''}</div>
            </td>
            <td>
              <strong>${ov.date}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${window.Utils.getDayName(ov.date)}</div>
            </td>
            <td>
              <div>${window.Utils.formatTime12Hour(ov.start_time)} - ${window.Utils.formatTime12Hour(ov.end_time)}</div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${durationText}</span>
            </td>
            <td>${window.Utils.renderStatusBadge(ov.status)}</td>
            <td>${timelineBadge}</td>
            <td>${ov.note || '<span style="color: var(--text-muted)">—</span>'}</td>
            <td>
              <div style="display: flex; gap: 0.35rem;">
                <button class="btn btn-secondary btn-sm" onclick="window.adminEditOverride('${ov.id}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="window.adminDeleteOverride('${ov.id}')">Remove</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error rendering overrides table:', err);
    }
  }

  // Combined render function for availability section
  async function renderAvailabilityAdmin() {
    await populateOverrideFacultySelects();
    await renderFacultyStatusOverview();
    await renderOverridesAdmin();
  }

  // Form submit handler for admin overrides
  if (adminOvForm) {
    adminOvForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = adminOvEditId.value || null;

      const payload = {
        faculty_id: adminOvFaculty.value,
        date: adminOvDate.value,
        start_time: adminOvStart.value,
        end_time: adminOvEnd.value,
        status: adminOvStatus.value,
        note: adminOvNote.value.trim()
      };

      btnSubmitAdminOv.disabled = true;
      btnSubmitAdminOv.textContent = editId ? 'Updating...' : 'Posting...';

      try {
        let res;
        if (editId) {
          res = await window.AvailabilityService.updateOverride(editId, payload);
        } else {
          res = await window.AvailabilityService.addOverride(payload);
        }

        if (res.success) {
          adminOvEditId.value = '';
          adminOvForm.reset();
          if (adminOvDate) adminOvDate.value = new Date().toISOString().split('T')[0];
          if (adminOvFormTitle) adminOvFormTitle.textContent = 'Post Campus Schedule Override';
          btnSubmitAdminOv.textContent = 'Post Override';
          btnCancelAdminOv.style.display = 'none';
          if (adminOvValidationAlert) adminOvValidationAlert.style.display = 'none';

          await renderAvailabilityAdmin();

          if (res.warnings && res.warnings.length > 0) {
            alert(`Override saved successfully!\n\n${res.warnings.join('\n')}`);
          } else {
            alert(editId ? 'Override updated successfully.' : 'Schedule override created successfully.');
          }
        } else {
          alert('Validation Conflict Error:\n' + res.error);
          checkLiveAdminOvValidation();
        }
      } catch (err) {
        alert('Error saving override: ' + err.message);
      } finally {
        btnSubmitAdminOv.disabled = false;
        btnSubmitAdminOv.textContent = editId ? 'Update Override' : 'Post Override';
      }
    });
  }

  // Admin Edit Override
  window.adminEditOverride = async function(overrideId) {
    try {
      const ov = await window.AvailabilityService.getOverrideById(overrideId);
      if (!ov) {
        alert('Override record not found.');
        return;
      }

      adminOvEditId.value = ov.id;
      if (adminOvFaculty) adminOvFaculty.value = ov.faculty_id;
      if (adminOvDate) adminOvDate.value = ov.date;
      if (adminOvStart) adminOvStart.value = ov.start_time;
      if (adminOvEnd) adminOvEnd.value = ov.end_time;
      if (adminOvStatus) adminOvStatus.value = ov.status;
      if (adminOvNote) adminOvNote.value = ov.note || '';

      if (adminOvFormTitle) adminOvFormTitle.textContent = 'Edit Campus Schedule Override';
      btnSubmitAdminOv.textContent = 'Update Override';
      btnCancelAdminOv.style.display = 'inline-block';
      checkLiveAdminOvValidation();
      adminOvForm.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      alert('Error loading override: ' + err.message);
    }
  };

  // Cancel Admin Override Edit
  if (btnCancelAdminOv) {
    btnCancelAdminOv.addEventListener('click', () => {
      adminOvEditId.value = '';
      adminOvForm.reset();
      if (adminOvDate) adminOvDate.value = new Date().toISOString().split('T')[0];
      if (adminOvFormTitle) adminOvFormTitle.textContent = 'Post Campus Schedule Override';
      btnSubmitAdminOv.textContent = 'Post Override';
      btnCancelAdminOv.style.display = 'none';
      if (adminOvValidationAlert) adminOvValidationAlert.style.display = 'none';
      if (adminOvDurationBadge) adminOvDurationBadge.textContent = 'Duration: 1 hr';
    });
  }

  // Admin Delete Override
  window.adminDeleteOverride = async function(overrideId) {
    if (!confirm('Are you sure you want to cancel and remove this schedule override?')) return;

    try {
      const res = await window.AvailabilityService.deleteOverride(overrideId);
      if (res.success) {
        await renderAvailabilityAdmin();
        alert('Override removed successfully.');
      } else {
        alert('Error: ' + res.error);
      }
    } catch (err) {
      alert('Error removing override: ' + err.message);
    }
  };

  // Filter change listeners for availability overview
  if (adminAvailSearch) adminAvailSearch.addEventListener('input', renderFacultyAvailabilityOverview);
  if (adminAvailDept) adminAvailDept.addEventListener('change', renderFacultyAvailabilityOverview);
  if (adminAvailDate) adminAvailDate.addEventListener('change', renderFacultyAvailabilityOverview);
  if (adminAvailTime) adminAvailTime.addEventListener('input', renderFacultyAvailabilityOverview);
  if (btnCheckAdminAvail) btnCheckAdminAvail.addEventListener('click', renderFacultyAvailabilityOverview);

  if (btnAdminAvailNow) {
    btnAdminAvailNow.addEventListener('click', () => {
      const n = new Date();
      if (adminAvailDate) adminAvailDate.value = n.toISOString().split('T')[0];
      if (adminAvailTime) {
        const hh = String(n.getHours()).padStart(2, '0');
        const mm = String(n.getMinutes()).padStart(2, '0');
        adminAvailTime.value = `${hh}:${mm}`;
      }
      renderFacultyAvailabilityOverview();
    });
  }

  // Filter change listeners for overrides
  if (adminOvFilterFaculty) adminOvFilterFaculty.addEventListener('change', renderOverridesAdmin);
  if (adminOvFilterStatus) adminOvFilterStatus.addEventListener('change', renderOverridesAdmin);
  if (adminOvFilterTiming) adminOvFilterTiming.addEventListener('change', renderOverridesAdmin);
  if (btnRefreshAvail) btnRefreshAvail.addEventListener('click', renderAvailabilityAdmin);

  // Global change listeners for real-time reactivity
  window.addEventListener('availability-data-changed', () => {
    renderAvailabilityAdmin();
  });
  window.addEventListener('override-data-changed', () => {
    renderAvailabilityAdmin();
  });

  // Initial runs
  renderFacultyTable();
  renderTimetableAdmin();
  renderAvailabilityAdmin();
});
