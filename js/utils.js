/**
 * Faculty Availability Tracker - Central Utilities & Availability Logic
 * Version: v0.1.0
 * 
 * Contains the MANDATORY single central resolver:
 * getFacultyAvailability(facultyId, date, time)
 */

/**
 * Returns the day of the week from a YYYY-MM-DD date string (e.g. 'Monday')
 */
function getDayName(dateStr) {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const dateObj = new Date(year, month, day);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dateObj.getDay()];
}

/**
 * Compares two HH:MM time strings.
 * Returns -1 if timeA < timeB, 0 if equal, 1 if timeA > timeB
 */
function compareTime(timeA, timeB) {
  const [hA, mA] = timeA.split(':').map(Number);
  const [hB, mB] = timeB.split(':').map(Number);
  if (hA < hB) return -1;
  if (hA > hB) return 1;
  if (mA < mB) return -1;
  if (mA > mB) return 1;
  return 0;
}

/**
 * Checks if targetTime falls within [startTime, endTime)
 */
function isTimeBetween(targetTime, startTime, endTime) {
  return compareTime(targetTime, startTime) >= 0 && compareTime(targetTime, endTime) < 0;
}

/**
 * Formats HH:MM to 12-hour AM/PM format (e.g., "14:30" -> "2:30 PM")
 */
function formatTime12Hour(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  const minute = m < 10 ? '0' + m : m;
  return `${hour}:${minute} ${period}`;
}

/**
 * Calculates human-readable duration between two HH:MM times (e.g., "1 hr 30 mins")
 */
function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return '';
  const [hA, mA] = startTime.split(':').map(Number);
  const [hB, mB] = endTime.split(':').map(Number);
  let totalMinutes = (hB * 60 + mB) - (hA * 60 + mA);
  if (totalMinutes <= 0) return '0 mins';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours} hr ${mins} mins`;
  if (hours > 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
  return `${mins} mins`;
}

/**
 * Checks if two time intervals [startA, endA) and [startB, endB) overlap
 */
function isTimeOverlap(startA, endA, startB, endB) {
  return compareTime(startA, endB) < 0 && compareTime(endA, startB) > 0;
}

/**
 * CENTRAL REUSABLE FUNCTION:
 * getFacultyAvailability(facultyId, date, time)
 * 
 * Strict priority order:
 * 1. Inactive faculty account
 * 2. Time-specific availability override
 * 3. Regular timetable
 * 4. Current/manual availability
 * 5. Not updated
 * 
 * Returns structured object:
 * {
 *   status: "available" | "in_class" | "in_meeting" | "present" | "unavailable" | "not_updated",
 *   activity: string | null,
 *   room: string | null,
 *   note: string | null,
 *   source: "inactive_account" | "override" | "timetable" | "manual_status" | "not_updated"
 * }
 */
function getFacultyAvailability(facultyId, date, time, facultyObj = null) {
  if (window.AvailabilityService && typeof window.AvailabilityService.resolveFacultyAvailability === 'function') {
    return window.AvailabilityService.resolveFacultyAvailability(facultyId, date, time, facultyObj);
  }

  const store = window.DataStore.getStore();
  
  // 1. Inactive faculty account check
  const faculty = facultyObj || (store.faculty || []).find(f => f.id === facultyId);
  if (!faculty) {
    return {
      status: 'not_updated',
      activity: null,
      room: null,
      note: 'Faculty not found',
      source: 'not_updated'
    };
  }

  if (faculty.is_active === false) {
    return {
      status: 'unavailable',
      activity: null,
      room: faculty.room,
      note: 'Faculty account currently inactive/paused',
      source: 'inactive_account'
    };
  }

  // 2. Time-specific availability override
  // Filter overrides for this faculty on this date where start_time <= time < end_time
  const overrides = (store.overrides || []).filter(ov => 
    ov.faculty_id === facultyId && ov.date === date
  );

  const matchedOverride = overrides.find(ov => 
    isTimeBetween(time, ov.start_time, ov.end_time)
  );

  if (matchedOverride) {
    return {
      status: matchedOverride.status,
      activity: null,
      room: faculty.room,
      note: matchedOverride.note || 'Temporary schedule override in effect',
      source: 'override',
      overrideWindow: `${formatTime12Hour(matchedOverride.start_time)} - ${formatTime12Hour(matchedOverride.end_time)}`
    };
  }

  // 3. Regular timetable check
  const dayName = getDayName(date);
  const timetables = (store.timetables || []).filter(t => 
    t.faculty_id === facultyId && 
    t.day_of_week === dayName && 
    t.is_active !== false
  );

  const matchedSchedule = timetables.find(t => 
    isTimeBetween(time, t.start_time, t.end_time)
  );

  if (matchedSchedule) {
    return {
      status: 'in_class',
      activity: matchedSchedule.activity,
      room: matchedSchedule.room || faculty.room,
      note: `Class in session: ${matchedSchedule.activity}`,
      source: 'timetable',
      scheduleWindow: `${formatTime12Hour(matchedSchedule.start_time)} - ${formatTime12Hour(matchedSchedule.end_time)}`
    };
  }

  // 4. Current / manual availability check
  // Applies when querying for the current day or general availability
  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = (date === todayStr);

  const currentAvailability = (store.availability || []).find(a => a.faculty_id === facultyId);
  if (currentAvailability && currentAvailability.status && currentAvailability.status !== 'not_updated') {
    return {
      status: currentAvailability.status,
      activity: null,
      room: faculty.room,
      note: currentAvailability.note || (isToday ? 'Latest status posted by faculty' : null),
      source: 'manual_status'
    };
  }

  // 5. Default fallback: Not updated
  return {
    status: 'not_updated',
    activity: null,
    room: faculty.room,
    note: 'No schedule or status recorded for this time',
    source: 'not_updated'
  };
}

/**
 * Returns human-readable label and CSS class for a given status
 */
function getStatusDisplay(statusKey) {
  const statuses = window.APP_CONFIG.STATUSES;
  if (statuses && statuses[statusKey]) {
    return statuses[statusKey];
  }
  return { label: 'Not Updated', badgeClass: 'badge-not_updated' };
}

/**
 * Renders an HTML status badge string
 */
function renderStatusBadge(statusKey) {
  const display = getStatusDisplay(statusKey);
  return `<span class="badge-status ${display.badgeClass}">${display.label}</span>`;
}

/**
 * Toast / Alert Notification Helper
 */
function showNotification(message, type = 'info', containerId = 'notification-container') {
  const container = document.getElementById(containerId);
  if (!container) {
    if (window.ErrorBoundary && typeof window.ErrorBoundary.showToast === 'function') {
      window.ErrorBoundary.showToast(message, type);
    }
    return;
  }

  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.innerHTML = `<span>${message}</span>`;

  container.innerHTML = '';
  container.appendChild(alertDiv);

  setTimeout(() => {
    if (alertDiv.parentNode === container) {
      container.removeChild(alertDiv);
    }
  }, 4000);
}

window.Utils = {
  getDayName,
  compareTime,
  isTimeBetween,
  formatTime12Hour,
  calculateDuration,
  isTimeOverlap,
  getFacultyAvailability,
  getStatusDisplay,
  renderStatusBadge,
  showNotification
};
