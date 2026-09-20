/**
 * Faculty Availability Tracker - Student Dashboard Script
 * Version: v0.3.0 (Milestone 3 - Faculty Management)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check auth - allows student, faculty, admin to browse
  Auth.requireRole(['student', 'faculty', 'admin']);
  Auth.initHeaderAuth();

  const searchInput = document.getElementById('search-input');
  const departmentFilter = document.getElementById('department-filter');
  const facultyCardsGrid = document.getElementById('faculty-cards-grid');
  const emptyState = document.getElementById('empty-state');
  
  // Date & Time quick lookup controls
  const checkDateInput = document.getElementById('check-date');
  const checkTimeInput = document.getElementById('check-time');
  const checkAvailabilityBtn = document.getElementById('btn-check-availability');
  const checkResultBanner = document.getElementById('check-result-banner');

  // Timetable preview modal elements
  const modalOverlay = document.getElementById('timetable-modal');
  const modalFacultyName = document.getElementById('modal-faculty-name');
  const modalTimetableBody = document.getElementById('modal-timetable-body');
  const closeModalBtn = document.getElementById('close-timetable-modal');

  // Set default date to today and time to current time
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');

  if (checkDateInput) checkDateInput.value = todayStr;
  if (checkTimeInput) checkTimeInput.value = `${currentHours}:${currentMinutes}`;

  // Populate department filter options from config
  if (departmentFilter && window.APP_CONFIG) {
    departmentFilter.innerHTML = window.APP_CONFIG.DEPARTMENTS.map(dept => 
      `<option value="${dept}">${dept}</option>`
    ).join('');
  }

  // In-memory cache of currently loaded faculty
  let currentLoadedFaculty = [];

  // Load and render faculty cards asynchronously
  async function renderFacultyList() {
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const selectedDept = departmentFilter ? departmentFilter.value : 'All Departments';

    try {
      if (facultyCardsGrid && currentLoadedFaculty.length === 0) {
        facultyCardsGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">Loading faculty directory...</div>`;
      }

      const facultyList = await window.FacultyService.getAllFaculty({
        department: selectedDept,
        searchQuery: query
      });

      currentLoadedFaculty = facultyList;

      if (!facultyList || facultyList.length === 0) {
        facultyCardsGrid.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';

      const queryDate = checkDateInput ? checkDateInput.value : todayStr;
      const queryTime = checkTimeInput ? checkTimeInput.value : `${currentHours}:${currentMinutes}`;

      facultyCardsGrid.innerHTML = facultyList.map(faculty => {
        // Calculate current real-time availability for target date & time
        const avail = window.Utils.getFacultyAvailability(faculty.id, queryDate, queryTime);
        const statusBadge = window.Utils.renderStatusBadge(avail.status);

        let contextNote = '';
        if (avail.activity) {
          contextNote = `<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">Class: <strong>${avail.activity}</strong></div>`;
        } else if (avail.note) {
          contextNote = `<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">Note: <em>"${avail.note}"</em></div>`;
        }

        const isPaused = faculty.is_active === false;
        const pausedBanner = isPaused ? `<span class="badge-status badge-unavailable" style="font-size: 0.7rem; margin-left: 0.5rem;">Paused</span>` : '';

        return `
          <div class="card" id="card-${faculty.id}" style="display: flex; flex-direction: column; justify-content: space-between; opacity: ${isPaused ? '0.75' : '1'};">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.5rem;">
                <div>
                  <h3 style="font-size: 1.1rem; font-weight: 700;">${faculty.full_name} ${pausedBanner}</h3>
                  <div style="font-size: 0.875rem; color: var(--text-muted);">${faculty.designation}</div>
                </div>
                <div>${statusBadge}</div>
              </div>

              <div style="font-size: 0.875rem; margin-bottom: 0.75rem;">
                <div><strong>Department:</strong> ${faculty.department}</div>
                <div><strong>Office:</strong> ${faculty.room}</div>
                <div><strong>Email:</strong> ${faculty.email}</div>
              </div>

              <div style="background: var(--surface-muted); padding: 0.6rem 0.75rem; border-radius: var(--radius-sm); margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                  <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: var(--text-muted);">
                    Status at ${window.Utils.formatTime12Hour(queryTime)}:
                  </span>
                  ${avail.source === 'override' ? '<span class="badge-status badge-in_meeting" style="font-size: 0.6875rem;">Override</span>' : ''}
                  ${avail.source === 'timetable' ? '<span class="badge-status badge-in_class" style="font-size: 0.6875rem;">Timetable</span>' : ''}
                  ${avail.source === 'manual_status' ? '<span class="badge-status badge-present" style="font-size: 0.6875rem;">Manual</span>' : ''}
                  ${avail.source === 'inactive_account' ? '<span class="badge-status badge-unavailable" style="font-size: 0.6875rem;">Inactive</span>' : ''}
                </div>
                <div style="margin-top: 0.2rem; display: flex; align-items: center; gap: 0.5rem;">
                  ${statusBadge}
                </div>
                ${contextNote}
              </div>
            </div>

            <div style="display: flex; gap: 0.5rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
              <button class="btn btn-secondary btn-sm" onclick="window.viewTimetable('${faculty.id}')" style="flex: 1;">
                View Weekly Timetable
              </button>
              <button class="btn btn-primary btn-sm" onclick="window.quickCheck('${faculty.id}')">
                Check Time
              </button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Error rendering faculty list:', err);
    }
  }

  // Handle live search with debounce
  let debounceTimeout = null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(renderFacultyList, 200);
    });
  }

  if (departmentFilter) {
    departmentFilter.addEventListener('change', renderFacultyList);
  }

  // Listen for changes from Admin or other tabs
  window.addEventListener('faculty-data-changed', () => {
    renderFacultyList();
  });

  window.addEventListener('timetable-data-changed', () => {
    renderFacultyList();
  });

  // Check Availability Button Action
  if (checkAvailabilityBtn) {
    checkAvailabilityBtn.addEventListener('click', () => {
      renderFacultyList();
      const targetDate = checkDateInput.value;
      const targetTime = checkTimeInput.value;
      
      if (checkResultBanner) {
        checkResultBanner.style.display = 'block';
        checkResultBanner.className = 'alert alert-info';
        checkResultBanner.innerHTML = `
          <div>
            <strong>Availability filter updated:</strong> Showing all faculty statuses resolved for 
            <strong>${targetDate}</strong> (${window.Utils.getDayName(targetDate)}) at <strong>${window.Utils.formatTime12Hour(targetTime)}</strong>.
          </div>
        `;
      }
    });
  }

  // Global helper to view weekly timetable modal
  window.viewTimetable = async function(facultyId) {
    let faculty = currentLoadedFaculty.find(f => f.id === facultyId);
    if (!faculty) {
      faculty = await window.FacultyService.getFacultyById(facultyId);
    }
    if (!faculty) return;

    if (modalFacultyName) {
      modalFacultyName.textContent = `${faculty.full_name} (${faculty.department}) - Cabin: ${faculty.room}`;
    }

    let timetables = [];
    try {
      if (window.TimetableService) {
        timetables = await window.TimetableService.getTimetablesByFaculty(facultyId);
      } else {
        const store = window.DataStore ? window.DataStore.getStore() : { timetables: [] };
        timetables = (store.timetables || []).filter(t => t.faculty_id === facultyId && t.is_active !== false);
      }
    } catch (e) {
      console.warn('Student timetable modal fetch fallback:', e);
      const store = window.DataStore ? window.DataStore.getStore() : { timetables: [] };
      timetables = (store.timetables || []).filter(t => t.faculty_id === facultyId && t.is_active !== false);
    }

    // Days order
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    if (modalTimetableBody) {
      if (timetables.length === 0) {
        modalTimetableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No regular timetable records registered for this faculty member.</td></tr>`;
      } else {
        // Sort by day and start time
        timetables.sort((a, b) => {
          const dayDiff = days.indexOf(a.day_of_week) - days.indexOf(b.day_of_week);
          if (dayDiff !== 0) return dayDiff;
          return window.Utils.compareTime(a.start_time, b.start_time);
        });

        modalTimetableBody.innerHTML = timetables.map(item => `
          <tr>
            <td><strong>${item.day_of_week}</strong></td>
            <td>
              <div>${window.Utils.formatTime12Hour(item.start_time)} - ${window.Utils.formatTime12Hour(item.end_time)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${window.Utils.calculateDuration(item.start_time, item.end_time)}</div>
            </td>
            <td><strong>${item.activity}</strong></td>
            <td>${item.room || faculty.room}</td>
          </tr>
        `).join('');
      }
    }

    if (modalOverlay) modalOverlay.style.display = 'flex';
  };

  // Availability Breakdown Modal elements
  const breakdownModal = document.getElementById('availability-breakdown-modal');
  const breakdownTitle = document.getElementById('breakdown-faculty-title');
  const breakdownContent = document.getElementById('breakdown-modal-content');
  const closeBreakdownBtn = document.getElementById('close-breakdown-modal');

  if (closeBreakdownBtn && breakdownModal) {
    closeBreakdownBtn.addEventListener('click', () => {
      breakdownModal.style.display = 'none';
    });
  }
  if (breakdownModal) {
    breakdownModal.addEventListener('click', (e) => {
      if (e.target === breakdownModal) {
        breakdownModal.style.display = 'none';
      }
    });
  }

  // Quick check opens rich 5-tier resolution breakdown modal
  window.quickCheck = async function(facultyId) {
    let faculty = currentLoadedFaculty.find(f => f.id === facultyId);
    if (!faculty) {
      faculty = await window.FacultyService.getFacultyById(facultyId);
    }
    if (!faculty) return;
    
    const targetDate = checkDateInput.value;
    const targetTime = checkTimeInput.value;
    const avail = window.Utils.getFacultyAvailability(faculty.id, targetDate, targetTime);
    
    if (breakdownTitle) {
      breakdownTitle.textContent = `${faculty.full_name} • ${faculty.department} (Cabin: ${faculty.room})`;
    }

    if (breakdownContent) {
      const dayName = window.Utils.getDayName(targetDate);
      const timeFormatted = window.Utils.formatTime12Hour(targetTime);

      let sourceBadgeClass = 'badge-not_updated';
      let sourceTitle = 'Default / Standby';
      if (avail.source === 'override') {
        sourceBadgeClass = 'badge-in_meeting';
        sourceTitle = 'Priority 2: Schedule Override';
      } else if (avail.source === 'timetable') {
        sourceBadgeClass = 'badge-in_class';
        sourceTitle = 'Priority 3: Weekly Timetable';
      } else if (avail.source === 'manual_status') {
        sourceBadgeClass = 'badge-present';
        sourceTitle = 'Priority 4: Manual Faculty Status';
      } else if (avail.source === 'inactive_account') {
        sourceBadgeClass = 'badge-unavailable';
        sourceTitle = 'Priority 1: Inactive Profile';
      }

      breakdownContent.innerHTML = `
        <div style="margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; background: var(--surface-muted); padding: 0.85rem; border-radius: var(--radius-sm);">
          <div>
            <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Evaluated Time & Date</div>
            <div style="font-size: 1rem; font-weight: 700; color: var(--text-main); margin-top: 0.2rem;">${targetDate} (${dayName}) at ${timeFormatted}</div>
          </div>
          <div>
            ${window.Utils.renderStatusBadge(avail.status)}
          </div>
        </div>

        <div style="margin-bottom: 1rem;">
          <div style="font-size: 0.8125rem; font-weight: 600; margin-bottom: 0.35rem; color: var(--text-muted);">Active Resolution Rule:</div>
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <span class="badge-status ${sourceBadgeClass}">${sourceTitle}</span>
          </div>
          <p style="font-size: 0.875rem; line-height: 1.5; color: var(--text-main); margin: 0; background: var(--surface); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            ${avail.reason}
          </p>
        </div>

        <div style="font-size: 0.8125rem; color: var(--text-muted); border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
          <div><strong>Expected Location:</strong> ${avail.room || faculty.room || 'Department Cabin'}</div>
          ${avail.note ? `<div style="margin-top: 0.25rem;"><strong>Faculty Note:</strong> "${avail.note}"</div>` : ''}
          ${avail.overrideWindow ? `<div style="margin-top: 0.25rem;"><strong>Override Active Window:</strong> ${avail.overrideWindow}</div>` : ''}
          ${avail.scheduleWindow ? `<div style="margin-top: 0.25rem;"><strong>Timetable Class Period:</strong> ${avail.scheduleWindow}</div>` : ''}
        </div>
      `;
    }

    if (breakdownModal) breakdownModal.style.display = 'flex';
  };

  // Close modal
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      if (modalOverlay) modalOverlay.style.display = 'none';
    });
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        modalOverlay.style.display = 'none';
      }
    });
  }

  // Reactive listeners for real-time updates
  window.addEventListener('availability-data-changed', () => {
    renderFacultyList();
  });

  window.addEventListener('override-data-changed', () => {
    renderFacultyList();
  });

  // Initial render
  renderFacultyList();
});
