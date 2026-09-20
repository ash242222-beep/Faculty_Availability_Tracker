/**
 * Faculty Availability Tracker - Faculty Dashboard Script
 * Version: v0.1.0
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check auth - allows faculty & admin
  Auth.requireRole(['faculty', 'admin']);
  Auth.initHeaderAuth();

  const user = Auth.getCurrentUser();
  const store = window.DataStore.getStore();

  // Find faculty profile (defaults to Dr. Rahul Sharma for demo if not mapped)
  let faculty = (store.faculty || []).find(f => f.email.toLowerCase() === user.email.toLowerCase()) ||
                (store.faculty || []).find(f => f.id === user.faculty_id) ||
                store.faculty[0];

  // Faculty profile card
  const profileNameEl = document.getElementById('faculty-profile-name');
  const profileDeptEl = document.getElementById('faculty-profile-dept');
  const profileRoomEl = document.getElementById('faculty-profile-room');
  const profileEmailEl = document.getElementById('faculty-profile-email');

  if (profileNameEl) profileNameEl.textContent = faculty.full_name;
  if (profileDeptEl) profileDeptEl.textContent = faculty.department + ' — ' + faculty.designation;
  if (profileRoomEl) profileRoomEl.textContent = faculty.room;
  if (profileEmailEl) profileEmailEl.textContent = faculty.email;

  // Current status buttons
  const statusButtons = document.querySelectorAll('.status-pill-btn');
  const currentStatusNoteInput = document.getElementById('current-status-note');
  const btnSaveStatus = document.getElementById('btn-save-status');
  const statusSaveAlert = document.getElementById('status-save-alert');

  // Load faculty's current status
  const facultyAvail = (store.availability || []).find(a => a.faculty_id === faculty.id) || {
    status: 'available',
    note: ''
  };

  let selectedStatus = facultyAvail.status || 'available';
  if (currentStatusNoteInput) currentStatusNoteInput.value = facultyAvail.note || '';

  function highlightSelectedStatus(status) {
    statusButtons.forEach(btn => {
      if (btn.dataset.status === status) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }
  highlightSelectedStatus(selectedStatus);

  statusButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedStatus = btn.dataset.status;
      highlightSelectedStatus(selectedStatus);
    });
  });

  if (btnSaveStatus) {
    btnSaveStatus.addEventListener('click', () => {
      const currentStore = window.DataStore.getStore();
      const existingIdx = (currentStore.availability || []).findIndex(a => a.faculty_id === faculty.id);
      
      const newRecord = {
        faculty_id: faculty.id,
        status: selectedStatus,
        note: currentStatusNoteInput ? currentStatusNoteInput.value.trim() : '',
        updated_at: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        currentStore.availability[existingIdx] = newRecord;
      } else {
        if (!currentStore.availability) currentStore.availability = [];
        currentStore.availability.push(newRecord);
      }

      window.DataStore.saveStore(currentStore);

      if (statusSaveAlert) {
        statusSaveAlert.style.display = 'block';
        statusSaveAlert.className = 'alert alert-success';
        statusSaveAlert.textContent = `Status saved as "${window.Utils.getStatusDisplay(selectedStatus).label}" at ${new Date().toLocaleTimeString()}.`;
        setTimeout(() => {
          statusSaveAlert.style.display = 'none';
        }, 4000);
      }
    });
  }

  // Today's schedule & Weekly timetable
  function renderTimetables() {
    const currentStore = window.DataStore.getStore();
    const todayName = window.Utils.getDayName(new Date().toISOString().split('T')[0]);
    const facultyTimetables = (currentStore.timetables || []).filter(t => t.faculty_id === faculty.id && t.is_active !== false);

    // Today's schedule
    const todayTableBody = document.getElementById('today-schedule-body');
    const todayClasses = facultyTimetables.filter(t => t.day_of_week === todayName);
    todayClasses.sort((a, b) => window.Utils.compareTime(a.start_time, b.start_time));

    if (todayTableBody) {
      if (todayClasses.length === 0) {
        todayTableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No classes scheduled for today (${todayName}).</td></tr>`;
      } else {
        todayTableBody.innerHTML = todayClasses.map(c => `
          <tr>
            <td><strong>${window.Utils.formatTime12Hour(c.start_time)} - ${window.Utils.formatTime12Hour(c.end_time)}</strong></td>
            <td><strong>${c.activity}</strong></td>
            <td>${c.room || faculty.room}</td>
          </tr>
        `).join('');
      }
    }

    // Weekly schedule
    const weeklyTableBody = document.getElementById('weekly-schedule-body');
    if (weeklyTableBody) {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      facultyTimetables.sort((a, b) => {
        const dDiff = days.indexOf(a.day_of_week) - days.indexOf(b.day_of_week);
        if (dDiff !== 0) return dDiff;
        return window.Utils.compareTime(a.start_time, b.start_time);
      });

      if (facultyTimetables.length === 0) {
        weeklyTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No regular timetable assigned yet.</td></tr>`;
      } else {
        weeklyTableBody.innerHTML = facultyTimetables.map(t => `
          <tr>
            <td><strong>${t.day_of_week}</strong></td>
            <td>${window.Utils.formatTime12Hour(t.start_time)} - ${window.Utils.formatTime12Hour(t.end_time)}</td>
            <td>${t.activity}</td>
            <td>${t.room || faculty.room}</td>
          </tr>
        `).join('');
      }
    }
  }

  // Overrides management
  const overridesTableBody = document.getElementById('overrides-table-body');
  const overrideForm = document.getElementById('override-form');
  const overrideDateInput = document.getElementById('override-date');
  const overrideStartInput = document.getElementById('override-start-time');
  const overrideEndInput = document.getElementById('override-end-time');
  const overrideStatusSelect = document.getElementById('override-status');
  const overrideNoteInput = document.getElementById('override-note');
  const overrideEditIdInput = document.getElementById('override-edit-id');
  const btnCancelOverrideEdit = document.getElementById('btn-cancel-override-edit');
  const btnSubmitOverride = document.getElementById('btn-submit-override');

  // Set default override date to today
  if (overrideDateInput) overrideDateInput.value = new Date().toISOString().split('T')[0];

  function renderOverrides() {
    const currentStore = window.DataStore.getStore();
    const facultyOverrides = (currentStore.overrides || []).filter(ov => ov.faculty_id === faculty.id);

    if (overridesTableBody) {
      if (facultyOverrides.length === 0) {
        overridesTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No temporary availability overrides active.</td></tr>`;
        return;
      }

      overridesTableBody.innerHTML = facultyOverrides.map(ov => `
        <tr>
          <td><strong>${ov.date}</strong></td>
          <td>${window.Utils.formatTime12Hour(ov.start_time)} - ${window.Utils.formatTime12Hour(ov.end_time)}</td>
          <td>${window.Utils.renderStatusBadge(ov.status)}</td>
          <td>${ov.note || '<span style="color: var(--text-muted)">—</span>'}</td>
          <td>
            <div style="display: flex; gap: 0.35rem;">
              <button class="btn btn-secondary btn-sm" onclick="window.editOverride('${ov.id}')">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="window.deleteOverride('${ov.id}')">Delete</button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }

  // Handle override form submit
  if (overrideForm) {
    overrideForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const dateVal = overrideDateInput.value;
      const startVal = overrideStartInput.value;
      const endVal = overrideEndInput.value;
      const statusVal = overrideStatusSelect.value;
      const noteVal = overrideNoteInput.value.trim();
      const editId = overrideEditIdInput.value;

      // Validation: start time < end time
      if (window.Utils.compareTime(startVal, endVal) >= 0) {
        alert('Validation Error: End time must be strictly after start time.');
        return;
      }

      const currentStore = window.DataStore.getStore();
      if (!currentStore.overrides) currentStore.overrides = [];

      if (editId) {
        // Edit existing
        const idx = currentStore.overrides.findIndex(o => o.id === editId);
        if (idx >= 0) {
          currentStore.overrides[idx] = {
            ...currentStore.overrides[idx],
            date: dateVal,
            start_time: startVal,
            end_time: endVal,
            status: statusVal,
            note: noteVal,
            updated_at: new Date().toISOString()
          };
        }
        overrideEditIdInput.value = '';
        if (btnSubmitOverride) btnSubmitOverride.textContent = 'Add Override';
        if (btnCancelOverrideEdit) btnCancelOverrideEdit.style.display = 'none';
      } else {
        // Add new
        const newOverride = {
          id: 'ov-' + Date.now(),
          faculty_id: faculty.id,
          date: dateVal,
          start_time: startVal,
          end_time: endVal,
          status: statusVal,
          note: noteVal,
          created_at: new Date().toISOString()
        };
        currentStore.overrides.push(newOverride);
      }

      window.DataStore.saveStore(currentStore);
      overrideForm.reset();
      overrideDateInput.value = new Date().toISOString().split('T')[0];
      renderOverrides();
      alert('Availability override saved successfully.');
    });
  }

  // Edit override
  window.editOverride = function(overrideId) {
    const currentStore = window.DataStore.getStore();
    const ov = (currentStore.overrides || []).find(o => o.id === overrideId);
    if (!ov) return;

    overrideEditIdInput.value = ov.id;
    overrideDateInput.value = ov.date;
    overrideStartInput.value = ov.start_time;
    overrideEndInput.value = ov.end_time;
    overrideStatusSelect.value = ov.status;
    overrideNoteInput.value = ov.note || '';

    if (btnSubmitOverride) btnSubmitOverride.textContent = 'Update Override';
    if (btnCancelOverrideEdit) btnCancelOverrideEdit.style.display = 'inline-block';
    overrideForm.scrollIntoView({ behavior: 'smooth' });
  };

  // Cancel edit
  if (btnCancelOverrideEdit) {
    btnCancelOverrideEdit.addEventListener('click', () => {
      overrideEditIdInput.value = '';
      overrideForm.reset();
      overrideDateInput.value = new Date().toISOString().split('T')[0];
      btnSubmitOverride.textContent = 'Add Override';
      btnCancelOverrideEdit.style.display = 'none';
    });
  }

  // Delete override
  window.deleteOverride = function(overrideId) {
    if (!confirm('Are you sure you want to cancel and delete this availability override?')) return;
    const currentStore = window.DataStore.getStore();
    currentStore.overrides = (currentStore.overrides || []).filter(o => o.id !== overrideId);
    window.DataStore.saveStore(currentStore);
    renderOverrides();
    alert('Override removed.');
  };

  // Initial render
  renderTimetables();
  renderOverrides();
});
