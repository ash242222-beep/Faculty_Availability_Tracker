/**
 * Faculty Availability Tracker - Faculty Dashboard Script
 * Version: v0.3.0 (Milestone 3 - Faculty Management)
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth - allows faculty & admin
  Auth.requireRole(['faculty', 'admin']);
  Auth.initHeaderAuth();

  const user = Auth.getCurrentUser();
  const store = window.DataStore ? window.DataStore.getStore() : { faculty: [], timetables: [], availability: [], overrides: [] };

  // Faculty profile card elements
  const profileNameEl = document.getElementById('faculty-profile-name');
  const profileDeptEl = document.getElementById('faculty-profile-dept');
  const profileRoomEl = document.getElementById('faculty-profile-room');
  const profileEmailEl = document.getElementById('faculty-profile-email');

  // Edit Profile Modal elements
  const btnOpenEditProfile = document.getElementById('btn-open-edit-profile');
  const profileModal = document.getElementById('faculty-profile-modal');
  const btnCloseProfileModal = document.getElementById('btn-close-profile-modal');
  const btnCancelProfileModal = document.getElementById('btn-cancel-profile-modal');
  const profileForm = document.getElementById('faculty-profile-form');
  const editProfileName = document.getElementById('edit-profile-name');
  const editProfileDesignation = document.getElementById('edit-profile-designation');
  const editProfileRoom = document.getElementById('edit-profile-room');

  // Find faculty profile from FacultyService
  let faculty = null;
  try {
    if (user.faculty_id) {
      faculty = await window.FacultyService.getFacultyById(user.faculty_id);
    }
    if (!faculty && user.email) {
      const list = await window.FacultyService.getAllFaculty();
      faculty = (list || []).find(f => f.email.toLowerCase() === user.email.toLowerCase());
    }
    if (!faculty) {
      // Fallback to demo default
      const list = await window.FacultyService.getAllFaculty();
      faculty = list && list.length > 0 ? list[0] : null;
    }
  } catch (err) {
    console.warn('Faculty fetch notice:', err);
  }

  if (!faculty) {
    faculty = {
      id: user.faculty_id || 'f1-rahul-sharma',
      full_name: user.name || 'Dr. Rahul Sharma',
      department: user.department || 'Computer Engineering',
      designation: 'Associate Professor',
      room: user.room || 'Cabin 12',
      email: user.email || 'rahul.sharma@college.edu'
    };
  }

  function updateProfileUI() {
    if (profileNameEl) profileNameEl.textContent = faculty.full_name;
    if (profileDeptEl) profileDeptEl.textContent = faculty.department + ' — ' + (faculty.designation || 'Faculty Member');
    if (profileRoomEl) profileRoomEl.textContent = faculty.room;
    if (profileEmailEl) profileEmailEl.textContent = faculty.email;
  }
  updateProfileUI();

  // Edit Profile Modal Handlers
  if (btnOpenEditProfile) {
    btnOpenEditProfile.addEventListener('click', () => {
      if (editProfileName) editProfileName.value = faculty.full_name;
      if (editProfileDesignation) editProfileDesignation.value = faculty.designation || '';
      if (editProfileRoom) editProfileRoom.value = faculty.room || '';
      if (profileModal) profileModal.style.display = 'flex';
    });
  }

  function closeProfileModal() {
    if (profileModal) profileModal.style.display = 'none';
  }

  if (btnCloseProfileModal) btnCloseProfileModal.addEventListener('click', closeProfileModal);
  if (btnCancelProfileModal) btnCancelProfileModal.addEventListener('click', closeProfileModal);

  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newName = editProfileName.value.trim();
      const newDesig = editProfileDesignation.value.trim();
      const newRoom = editProfileRoom.value.trim();

      if (!newName || !newRoom) {
        alert('Name and Room are required.');
        return;
      }

      try {
        const updateRes = await window.FacultyService.updateFaculty(faculty.id, {
          full_name: newName,
          designation: newDesig,
          room: newRoom
        });

        if (updateRes.success) {
          faculty.full_name = newName;
          faculty.designation = newDesig;
          faculty.room = newRoom;
          updateProfileUI();
          closeProfileModal();
          alert('Profile updated successfully.');
        } else {
          alert('Failed to update profile: ' + updateRes.error);
        }
      } catch (err) {
        alert('Error updating profile: ' + err.message);
      }
    });
  }

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
        currentStore.availability.push(newRecord);
      }

      window.DataStore.saveStore(currentStore);

      // Show alert confirmation
      if (statusSaveAlert) {
        statusSaveAlert.style.display = 'block';
        statusSaveAlert.className = 'alert alert-success';
        statusSaveAlert.textContent = `Status updated to "${window.Utils.getStatusDisplay(selectedStatus).label}" at ${window.Utils.formatTime12Hour(new Date().toTimeString().slice(0, 5))}.`;

        setTimeout(() => {
          statusSaveAlert.style.display = 'none';
        }, 4000);
      }
    });
  }

  // ==========================================================
  // SECTION 2: TODAY'S SCHEDULE & WEEKLY TIMETABLE
  // ==========================================================
  const todayScheduleContainer = document.getElementById('today-schedule-container');
  const weeklyTimetableBody = document.getElementById('weekly-timetable-body');

  function renderTimetables() {
    const currentStore = window.DataStore.getStore();
    const myTimetables = (currentStore.timetables || []).filter(t => t.faculty_id === faculty.id && t.is_active !== false);

    const todayDayName = window.Utils.getDayName(new Date().toISOString().split('T')[0]);
    const todayClasses = myTimetables.filter(t => t.day_of_week === todayDayName);
    todayClasses.sort((a, b) => window.Utils.compareTime(a.start_time, b.start_time));

    // Render Today's Schedule Card
    if (todayScheduleContainer) {
      if (todayClasses.length === 0) {
        todayScheduleContainer.innerHTML = `
          <div style="text-align: center; padding: 1.5rem; color: var(--text-muted);">
            No scheduled classes or labs for today (${todayDayName}).
          </div>
        `;
      } else {
        todayScheduleContainer.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 0.6rem;">
            ${todayClasses.map(c => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.8rem; background: var(--surface-muted); border-radius: var(--radius-sm);">
                <div>
                  <strong>${c.activity}</strong>
                  <div style="font-size: 0.8125rem; color: var(--text-muted);">${c.room || faculty.room}</div>
                </div>
                <div style="font-size: 0.875rem; font-weight: 600;">
                  ${window.Utils.formatTime12Hour(c.start_time)} - ${window.Utils.formatTime12Hour(c.end_time)}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
    }

    // Render Full Weekly Timetable Table
    if (weeklyTimetableBody) {
      if (myTimetables.length === 0) {
        weeklyTimetableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No regular timetable registered for your account.</td></tr>`;
      } else {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        myTimetables.sort((a, b) => {
          const dayDiff = days.indexOf(a.day_of_week) - days.indexOf(b.day_of_week);
          if (dayDiff !== 0) return dayDiff;
          return window.Utils.compareTime(a.start_time, b.start_time);
        });

        weeklyTimetableBody.innerHTML = myTimetables.map(t => `
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

  // ==========================================================
  // SECTION 3: TEMPORARY AVAILABILITY OVERRIDES
  // ==========================================================
  const overrideForm = document.getElementById('override-form');
  const overridesTableBody = document.getElementById('overrides-table-body');
  const overrideEditIdInput = document.getElementById('override-edit-id');
  const overrideDateInput = document.getElementById('override-date');
  const overrideStartInput = document.getElementById('override-start-time');
  const overrideEndInput = document.getElementById('override-end-time');
  const overrideStatusSelect = document.getElementById('override-status');
  const overrideNoteInput = document.getElementById('override-note');
  const btnSubmitOverride = document.getElementById('btn-submit-override');
  const btnCancelOverrideEdit = document.getElementById('btn-cancel-override-edit');

  // Set default date to today
  if (overrideDateInput) {
    overrideDateInput.value = new Date().toISOString().split('T')[0];
  }

  function renderOverrides() {
    const currentStore = window.DataStore.getStore();
    const myOverrides = (currentStore.overrides || []).filter(o => o.faculty_id === faculty.id);

    // Sort by date then start_time
    myOverrides.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return window.Utils.compareTime(a.start_time, b.start_time);
    });

    if (!overridesTableBody) return;

    if (myOverrides.length === 0) {
      overridesTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No temporary overrides currently active.</td></tr>`;
      return;
    }

    overridesTableBody.innerHTML = myOverrides.map(o => {
      const statusBadge = window.Utils.renderStatusBadge(o.status);
      return `
        <tr>
          <td><strong>${o.date}</strong> (${window.Utils.getDayName(o.date)})</td>
          <td>${window.Utils.formatTime12Hour(o.start_time)} - ${window.Utils.formatTime12Hour(o.end_time)}</td>
          <td>${statusBadge}</td>
          <td>${o.note || '<span style="color: var(--text-muted);">None</span>'}</td>
          <td>
            <div style="display: flex; gap: 0.35rem;">
              <button class="btn btn-secondary btn-sm" onclick="window.editOverride('${o.id}')">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="window.deleteOverride('${o.id}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Handle override form submit
  if (overrideForm) {
    overrideForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const currentStore = window.DataStore.getStore();
      const editId = overrideEditIdInput.value;

      const date = overrideDateInput.value;
      const start = overrideStartInput.value;
      const end = overrideEndInput.value;
      const status = overrideStatusSelect.value;
      const note = overrideNoteInput.value.trim();

      // Validate time window
      if (window.Utils.compareTime(start, end) >= 0) {
        alert('Validation Error: End time must be after start time.');
        return;
      }

      if (editId) {
        const idx = (currentStore.overrides || []).findIndex(o => o.id === editId);
        if (idx >= 0) {
          currentStore.overrides[idx] = {
            ...currentStore.overrides[idx],
            date,
            start_time: start,
            end_time: end,
            status,
            note
          };
        }
        btnSubmitOverride.textContent = 'Add Override';
        if (btnCancelOverrideEdit) btnCancelOverrideEdit.style.display = 'none';
      } else {
        const newOverride = {
          id: 'ov-' + Date.now(),
          faculty_id: faculty.id,
          date,
          start_time: start,
          end_time: end,
          status,
          note,
          created_at: new Date().toISOString()
        };
        currentStore.overrides = currentStore.overrides || [];
        currentStore.overrides.push(newOverride);
      }

      window.DataStore.saveStore(currentStore);
      overrideEditIdInput.value = '';
      overrideForm.reset();
      overrideDateInput.value = new Date().toISOString().split('T')[0];
      renderOverrides();
      alert(editId ? 'Override updated.' : 'Temporary override registered successfully.');
    });
  }

  // Global helper for edit override
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
