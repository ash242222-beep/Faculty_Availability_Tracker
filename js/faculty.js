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
  async function loadCurrentStatus() {
    let facultyAvail = null;
    if (window.AvailabilityService) {
      facultyAvail = await window.AvailabilityService.getManualAvailability(faculty.id);
    }
    if (!facultyAvail) {
      facultyAvail = (store.availability || []).find(a => a.faculty_id === faculty.id) || {
        status: 'available',
        note: ''
      };
    }

    selectedStatus = facultyAvail.status || 'available';
    if (currentStatusNoteInput) currentStatusNoteInput.value = facultyAvail.note || '';
    highlightSelectedStatus(selectedStatus);
  }

  let selectedStatus = 'available';
  loadCurrentStatus();

  function highlightSelectedStatus(status) {
    statusButtons.forEach(btn => {
      if (btn.dataset.status === status) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }

  statusButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedStatus = btn.dataset.status;
      highlightSelectedStatus(selectedStatus);
    });
  });

  if (btnSaveStatus) {
    btnSaveStatus.addEventListener('click', async () => {
      const note = currentStatusNoteInput ? currentStatusNoteInput.value.trim() : '';

      btnSaveStatus.disabled = true;
      btnSaveStatus.textContent = 'Saving...';

      try {
        let res;
        if (window.AvailabilityService) {
          res = await window.AvailabilityService.updateManualStatus(faculty.id, selectedStatus, note);
        } else {
          res = { success: true };
        }

        if (res.success) {
          if (statusSaveAlert) {
            statusSaveAlert.style.display = 'block';
            statusSaveAlert.className = 'alert alert-success';
            statusSaveAlert.textContent = `Status updated to "${window.Utils.getStatusDisplay(selectedStatus).label}" at ${window.Utils.formatTime12Hour(new Date().toTimeString().slice(0, 5))}.`;

            setTimeout(() => {
              statusSaveAlert.style.display = 'none';
            }, 4000);
          }
        } else {
          alert('Error saving status: ' + (res.error || 'Failed to update'));
        }
      } catch (err) {
        alert('Error saving status: ' + err.message);
      } finally {
        btnSaveStatus.disabled = false;
        btnSaveStatus.textContent = 'Save Status';
      }
    });
  }

  // ==========================================================
  // SECTION 2: TODAY'S SCHEDULE & WEEKLY TIMETABLE
  // ==========================================================
  const todayScheduleContainer = document.getElementById('today-schedule-container');
  const weeklyTimetableBody = document.getElementById('weekly-timetable-body');

  async function renderTimetables() {
    let myTimetables = [];
    try {
      if (window.TimetableService) {
        myTimetables = await window.TimetableService.getTimetablesByFaculty(faculty.id);
      } else {
        const currentStore = window.DataStore.getStore();
        myTimetables = (currentStore.timetables || []).filter(t => t.faculty_id === faculty.id && t.is_active !== false);
      }
    } catch (e) {
      console.warn('Timetable fetch notice in faculty dashboard:', e);
      const currentStore = window.DataStore.getStore();
      myTimetables = (currentStore.timetables || []).filter(t => t.faculty_id === faculty.id && t.is_active !== false);
    }

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
                <div style="text-align: right;">
                  <div style="font-size: 0.875rem; font-weight: 600;">
                    ${window.Utils.formatTime12Hour(c.start_time)} - ${window.Utils.formatTime12Hour(c.end_time)}
                  </div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">
                    ${window.Utils.calculateDuration(c.start_time, c.end_time)}
                  </div>
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
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        myTimetables.sort((a, b) => {
          const dayDiff = days.indexOf(a.day_of_week) - days.indexOf(b.day_of_week);
          if (dayDiff !== 0) return dayDiff;
          return window.Utils.compareTime(a.start_time, b.start_time);
        });

        weeklyTimetableBody.innerHTML = myTimetables.map(t => `
          <tr>
            <td><strong>${t.day_of_week}</strong></td>
            <td>
              <div>${window.Utils.formatTime12Hour(t.start_time)} - ${window.Utils.formatTime12Hour(t.end_time)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${window.Utils.calculateDuration(t.start_time, t.end_time)}</div>
            </td>
            <td><strong>${t.activity}</strong></td>
            <td>${t.room || faculty.room}</td>
          </tr>
        `).join('');
      }
    }
  }

  // Reactive listener for timetable data updates
  window.addEventListener('timetable-data-changed', () => {
    renderTimetables();
  });

  // ==========================================================
  // SECTION 3: TEMPORARY AVAILABILITY OVERRIDES
  // ==========================================================
  const overrideForm = document.getElementById('override-form');
  const overrideFormTitle = document.getElementById('override-form-title');
  const overridesTableBody = document.getElementById('overrides-table-body');
  const overrideEditIdInput = document.getElementById('override-edit-id');
  const overrideDateInput = document.getElementById('override-date');
  const overrideStartInput = document.getElementById('override-start-time');
  const overrideEndInput = document.getElementById('override-end-time');
  const overrideStatusSelect = document.getElementById('override-status');
  const overrideNoteInput = document.getElementById('override-note');
  const btnSubmitOverride = document.getElementById('btn-submit-override');
  const btnCancelOverrideEdit = document.getElementById('btn-cancel-override-edit');
  const facultyOvDurationBadge = document.getElementById('faculty-ov-duration-badge');
  const facultyOvValidationAlert = document.getElementById('faculty-ov-validation-alert');

  // Set default date to today
  if (overrideDateInput) {
    overrideDateInput.value = new Date().toISOString().split('T')[0];
  }

  // Check live validation on faculty override form
  function checkLiveFacultyOvValidation() {
    if (!overrideDateInput || !overrideStartInput || !overrideEndInput) return;

    const start = overrideStartInput.value;
    const end = overrideEndInput.value;
    const date = overrideDateInput.value;
    const editId = overrideEditIdInput ? overrideEditIdInput.value : null;

    if (facultyOvDurationBadge && start && end) {
      facultyOvDurationBadge.textContent = `Duration: ${window.Utils.calculateDuration(start, end)}`;
    }

    if (!facultyOvValidationAlert) return;

    if (!date || !start || !end) {
      facultyOvValidationAlert.style.display = 'none';
      return;
    }

    const valResult = window.AvailabilityService.validateOverride({
      faculty_id: faculty.id,
      date: date,
      start_time: start,
      end_time: end,
      status: overrideStatusSelect ? overrideStatusSelect.value : 'available',
      note: overrideNoteInput ? overrideNoteInput.value : ''
    }, editId);

    if (!valResult.isValid) {
      facultyOvValidationAlert.style.display = 'block';
      facultyOvValidationAlert.style.background = '#fef2f2';
      facultyOvValidationAlert.style.color = '#991b1b';
      facultyOvValidationAlert.style.border = '1px solid #fecaca';
      facultyOvValidationAlert.innerHTML = `<strong>Validation Error:</strong> ${valResult.errors.join('<br>')}`;
    } else if (valResult.warnings.length > 0) {
      facultyOvValidationAlert.style.display = 'block';
      facultyOvValidationAlert.style.background = '#fffbeb';
      facultyOvValidationAlert.style.color = '#92400e';
      facultyOvValidationAlert.style.border = '1px solid #fde68a';
      facultyOvValidationAlert.innerHTML = `<strong>Advisory:</strong> ${valResult.warnings.join('<br>')}`;
    } else {
      facultyOvValidationAlert.style.display = 'block';
      facultyOvValidationAlert.style.background = '#f0fdf4';
      facultyOvValidationAlert.style.color = '#166534';
      facultyOvValidationAlert.style.border = '1px solid #bbf7d0';
      facultyOvValidationAlert.innerHTML = '<strong>Verified:</strong> Timing is clear with no self-override conflicts.';
    }
  }

  if (overrideDateInput) overrideDateInput.addEventListener('change', checkLiveFacultyOvValidation);
  if (overrideStartInput) overrideStartInput.addEventListener('input', checkLiveFacultyOvValidation);
  if (overrideEndInput) overrideEndInput.addEventListener('input', checkLiveFacultyOvValidation);
  if (overrideStatusSelect) overrideStatusSelect.addEventListener('change', checkLiveFacultyOvValidation);

  async function renderOverrides() {
    if (!overridesTableBody) return;

    try {
      let myOverrides = [];
      if (window.AvailabilityService) {
        myOverrides = await window.AvailabilityService.getFacultyOverrides(faculty.id);
      } else {
        const currentStore = window.DataStore.getStore();
        myOverrides = (currentStore.overrides || []).filter(o => o.faculty_id === faculty.id);
      }

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      if (myOverrides.length === 0) {
        overridesTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No temporary overrides currently active.</td></tr>`;
        return;
      }

      overridesTableBody.innerHTML = myOverrides.map(o => {
        const statusBadge = window.Utils.renderStatusBadge(o.status);
        const durationText = window.Utils.calculateDuration(o.start_time, o.end_time);

        // Timeline badge
        let timelineBadge = '';
        if (o.date === todayStr) {
          if (window.Utils.isTimeBetween(currentTimeStr, o.start_time, o.end_time)) {
            timelineBadge = `<span class="badge-status badge-available" style="font-size: 0.7rem; font-weight: 700;">Active Now</span>`;
          } else if (window.Utils.compareTime(currentTimeStr, o.start_time) < 0) {
            timelineBadge = `<span class="badge-status badge-in_meeting" style="font-size: 0.7rem;">Today Later</span>`;
          } else {
            timelineBadge = `<span class="badge-status badge-not_updated" style="font-size: 0.7rem;">Expired Today</span>`;
          }
        } else if (o.date > todayStr) {
          timelineBadge = `<span class="badge-status badge-in_class" style="font-size: 0.7rem;">Upcoming</span>`;
        } else {
          timelineBadge = `<span class="badge-status badge-not_updated" style="font-size: 0.7rem;">Past</span>`;
        }

        return `
          <tr>
            <td>
              <strong>${o.date}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${window.Utils.getDayName(o.date)}</div>
            </td>
            <td>
              <div>${window.Utils.formatTime12Hour(o.start_time)} - ${window.Utils.formatTime12Hour(o.end_time)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${durationText}</div>
            </td>
            <td>${statusBadge}</td>
            <td>${timelineBadge}</td>
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
    } catch (err) {
      console.error('Error rendering faculty overrides:', err);
    }
  }

  // Handle override form submit
  if (overrideForm) {
    overrideForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = overrideEditIdInput.value;

      const date = overrideDateInput.value;
      const start = overrideStartInput.value;
      const end = overrideEndInput.value;
      const status = overrideStatusSelect.value;
      const note = overrideNoteInput.value.trim();

      btnSubmitOverride.disabled = true;
      btnSubmitOverride.textContent = editId ? 'Updating...' : 'Adding...';

      try {
        const payload = {
          faculty_id: faculty.id,
          date,
          start_time: start,
          end_time: end,
          status,
          note
        };

        let res;
        if (editId) {
          res = await window.AvailabilityService.updateOverride(editId, payload);
        } else {
          res = await window.AvailabilityService.addOverride(payload);
        }

        if (res.success) {
          overrideEditIdInput.value = '';
          overrideForm.reset();
          overrideDateInput.value = new Date().toISOString().split('T')[0];
          btnSubmitOverride.textContent = 'Add Override';
          if (overrideFormTitle) overrideFormTitle.textContent = 'Temporary Availability Overrides';
          if (btnCancelOverrideEdit) btnCancelOverrideEdit.style.display = 'none';
          if (facultyOvValidationAlert) facultyOvValidationAlert.style.display = 'none';
          if (facultyOvDurationBadge) facultyOvDurationBadge.textContent = 'Duration: 1 hr';

          await renderOverrides();

          if (res.warnings && res.warnings.length > 0) {
            alert(`Override saved successfully!\n\n${res.warnings.join('\n')}`);
          } else {
            alert(editId ? 'Override updated.' : 'Temporary override registered successfully.');
          }
        } else {
          alert('Validation Error:\n' + res.error);
          checkLiveFacultyOvValidation();
        }
      } catch (err) {
        alert('Error saving override: ' + err.message);
      } finally {
        btnSubmitOverride.disabled = false;
        btnSubmitOverride.textContent = editId ? 'Update Override' : 'Add Override';
      }
    });
  }

  // Global helper for edit override
  window.editOverride = async function(overrideId) {
    try {
      const ov = await window.AvailabilityService.getOverrideById(overrideId);
      if (!ov) return;

      overrideEditIdInput.value = ov.id;
      overrideDateInput.value = ov.date;
      overrideStartInput.value = ov.start_time;
      overrideEndInput.value = ov.end_time;
      overrideStatusSelect.value = ov.status;
      overrideNoteInput.value = ov.note || '';

      if (overrideFormTitle) overrideFormTitle.textContent = 'Edit Availability Override';
      if (btnSubmitOverride) btnSubmitOverride.textContent = 'Update Override';
      if (btnCancelOverrideEdit) btnCancelOverrideEdit.style.display = 'inline-block';
      checkLiveFacultyOvValidation();
      overrideForm.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      alert('Error loading override: ' + err.message);
    }
  };

  // Cancel edit
  if (btnCancelOverrideEdit) {
    btnCancelOverrideEdit.addEventListener('click', () => {
      overrideEditIdInput.value = '';
      overrideForm.reset();
      overrideDateInput.value = new Date().toISOString().split('T')[0];
      if (overrideFormTitle) overrideFormTitle.textContent = 'Temporary Availability Overrides';
      btnSubmitOverride.textContent = 'Add Override';
      btnCancelOverrideEdit.style.display = 'none';
      if (facultyOvValidationAlert) facultyOvValidationAlert.style.display = 'none';
      if (facultyOvDurationBadge) facultyOvDurationBadge.textContent = 'Duration: 1 hr';
    });
  }

  // Delete override
  window.deleteOverride = async function(overrideId) {
    if (!confirm('Are you sure you want to cancel and delete this availability override?')) return;

    try {
      const res = await window.AvailabilityService.deleteOverride(overrideId);
      if (res.success) {
        await renderOverrides();
        alert('Override removed.');
      } else {
        alert('Error removing override: ' + res.error);
      }
    } catch (err) {
      alert('Error removing override: ' + err.message);
    }
  };

  // Reactive listener for override data changes
  window.addEventListener('override-data-changed', () => {
    renderOverrides();
  });

  // Initial render
  renderTimetables();
  renderOverrides();
});
