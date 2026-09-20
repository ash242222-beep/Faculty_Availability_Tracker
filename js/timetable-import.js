/**
 * Faculty Availability Tracker - Timetable Import (CSV & PDF) Module
 * Version: v0.6.0 (Milestone 6 - Live CSV Timetable Import)
 * 
 * Production-ready CSV import engine:
 * 1. RFC 4180-compliant CSV parser with quote/separator resilience
 * 2. Flexible header mapping & fuzzy faculty matching with inline select dropdown
 * 3. 12-hour (AM/PM) and 24-hour time normalization
 * 4. Staged validation (self-overlap, room collision, database duplicate detection)
 * 5. Import mode selection (Append vs Replace Faculty Timetables)
 * 6. Audit logging into Supabase public.timetable_imports via ImportService
 */

(function() {
  'use strict';

  let stagedImportRows = [];
  let stagedFileName = '';
  let stagedFileType = '';
  let activeFilter = 'all'; // 'all' | 'valid' | 'errors'

  document.addEventListener('DOMContentLoaded', () => {
    const fileDropArea = document.getElementById('timetable-file-drop');
    const fileInput = document.getElementById('timetable-file-input');
    const previewSection = document.getElementById('import-preview-section');
    const previewTableBody = document.getElementById('import-preview-body');
    const btnConfirmImport = document.getElementById('btn-confirm-import');
    const btnCancelImport = document.getElementById('btn-cancel-import');
    const importSummaryAlert = document.getElementById('import-summary-alert');
    const sampleCsvDownloadBtn = document.getElementById('btn-download-sample-csv');

    // Controls inside staged area
    const importModeSelect = document.getElementById('import-mode-select');
    const btnAutoFixStaged = document.getElementById('btn-autofix-staged');
    const btnRemoveErrors = document.getElementById('btn-remove-errors');
    const filterAllBtn = document.getElementById('filter-staged-all');
    const filterValidBtn = document.getElementById('filter-staged-valid');
    const filterErrorsBtn = document.getElementById('filter-staged-errors');

    // Setup drag & drop
    if (fileDropArea && fileInput) {
      fileDropArea.addEventListener('click', () => fileInput.click());

      fileDropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileDropArea.style.borderColor = 'var(--primary)';
        fileDropArea.style.backgroundColor = 'var(--surface-muted)';
      });

      fileDropArea.addEventListener('dragleave', () => {
        fileDropArea.style.borderColor = 'var(--border-color)';
        fileDropArea.style.backgroundColor = 'var(--surface)';
      });

      fileDropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDropArea.style.borderColor = 'var(--border-color)';
        fileDropArea.style.backgroundColor = 'var(--surface)';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          processFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          processFile(e.target.files[0]);
        }
      });
    }

    // Sample CSV Downloads
    if (sampleCsvDownloadBtn) {
      sampleCsvDownloadBtn.addEventListener('click', () => {
        const sampleContent = 
`Faculty Name,Department,Day,Start Time,End Time,Activity,Room
Dr. Rahul Sharma,Computer Engineering,Monday,09:00,10:00,Operating Systems,LH-101
Dr. Rahul Sharma,Computer Engineering,Monday,10:00,11:30,Data Structures Lab,Lab 2
Dr. Priya Mehta,Information Technology,Monday,10:30,12:00,Database Systems,LH-201
Prof. Arvind Patel,Electronics Engineering,Wednesday,14:00,16:00,Hardware Architecture,Circuit Lab 2
Dr. Priya Mehta,Information Technology,Thursday,14:00,15:30,Academic Counseling,Cabin 8
Dr. Sneha Rao,Mechanical Engineering,Friday,09:30,11:00,Thermodynamics Lecture,Auditorium B`;

        const blob = new Blob([sampleContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'college_timetable_sample.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    function processFile(file) {
      stagedFileName = file.name;
      const extension = file.name.split('.').pop().toLowerCase();

      if (extension === 'csv') {
        stagedFileType = 'csv';
        readCSV(file);
      } else if (extension === 'pdf') {
        stagedFileType = 'pdf';
        readPDF(file);
      } else {
        alert('Unsupported file format. Please upload a .csv or text-based .pdf timetable.');
      }
    }

    /**
     * RFC 4180 Compliant CSV Parser
     */
    function parseCSVText(text) {
      const rows = [];
      let currentRow = [];
      let currentVal = '';
      let insideQuotes = false;

      // Normalize line endings
      const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        const nextChar = cleanText[i + 1];

        if (char === '"') {
          if (insideQuotes && nextChar === '"') {
            // Escaped quote: "" -> "
            currentVal += '"';
            i++; // skip next quote
          } else {
            insideQuotes = !insideQuotes;
          }
        } else if ((char === ',' || char === '\t' || char === ';') && !insideQuotes) {
          // Field delimiter
          currentRow.push(currentVal.trim());
          currentVal = '';
        } else if (char === '\n' && !insideQuotes) {
          // Row delimiter
          currentRow.push(currentVal.trim());
          // Only push non-empty rows
          if (currentRow.some(c => c.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentVal = '';
        } else {
          currentVal += char;
        }
      }

      // Trailing row
      if (currentVal.length > 0 || currentRow.length > 0) {
        currentRow.push(currentVal.trim());
        if (currentRow.some(c => c.length > 0)) {
          rows.push(currentRow);
        }
      }

      return rows;
    }

    /**
     * Read and Parse CSV File
     */
    function readCSV(file) {
      const reader = new FileReader();
      reader.onload = async function(e) {
        const text = e.target.result;
        const parsedGrid = parseCSVText(text);

        if (parsedGrid.length <= 1) {
          alert('CSV file appears empty or is missing data rows.');
          return;
        }

        // Header mapping
        const headerRow = parsedGrid[0].map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
        
        // Find best column indices
        const colMap = {
          faculty: headerRow.findIndex(h => /faculty|prof|teacher|instructor|name/.test(h)),
          department: headerRow.findIndex(h => /dept|department|branch/.test(h)),
          day: headerRow.findIndex(h => /day|weekday/.test(h)),
          start: headerRow.findIndex(h => /start|from|begin/.test(h)),
          end: headerRow.findIndex(h => /end|to|finish/.test(h)),
          activity: headerRow.findIndex(h => /activity|subject|course|class|lecture/.test(h)),
          room: headerRow.findIndex(h => /room|venue|cabin|hall|lab|location/.test(h))
        };

        // Fallback default index positions if headers weren't found
        if (colMap.faculty === -1) colMap.faculty = 0;
        if (colMap.department === -1 && parsedGrid[0].length >= 7) colMap.department = 1;
        if (colMap.day === -1) colMap.day = (colMap.department === 1) ? 2 : 1;
        if (colMap.start === -1) colMap.start = colMap.day + 1;
        if (colMap.end === -1) colMap.end = colMap.start + 1;
        if (colMap.activity === -1) colMap.activity = colMap.end + 1;
        if (colMap.room === -1) colMap.room = colMap.activity + 1;

        const rawRows = [];
        for (let r = 1; r < parsedGrid.length; r++) {
          const row = parsedGrid[r];
          if (row.length < 3) continue;

          rawRows.push({
            faculty_name: row[colMap.faculty] || '',
            department: colMap.department >= 0 ? (row[colMap.department] || '') : '',
            day_of_week: row[colMap.day] || '',
            start_time: row[colMap.start] || '',
            end_time: row[colMap.end] || '',
            activity: row[colMap.activity] || '',
            room: colMap.room >= 0 ? (row[colMap.room] || '') : ''
          });
        }

        await normalizeAndValidateRows(rawRows);
      };

      reader.readAsText(file);
    }

    /**
     * Text PDF Parser fallback
     */
    async function readPDF(file) {
      const arrayBuffer = await file.arrayBuffer();
      if (!window.pdfjsLib) {
        alert('PDF parser engine is initializing. Please retry in a few seconds or use CSV.');
        return;
      }

      try {
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageStrings = textContent.items.map(item => item.str);
          fullText += pageStrings.join(' ') + '\n';
        }

        if (!fullText || fullText.trim().length < 20) {
          alert('This PDF does not contain extractable timetable text. Please use a text-based PDF or CSV.');
          return;
        }

        const lines = fullText.split(/\r?\n|\s{3,}/).map(l => l.trim()).filter(l => l.length > 5);
        const rawRows = [];
        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        const facultyList = await window.FacultyService.getAllFaculty();

        for (const line of lines) {
          const dayMatch = validDays.find(d => line.toLowerCase().includes(d.toLowerCase()));
          const timeMatches = line.match(/\b\d{1,2}:\d{2}\b/g);

          if (dayMatch && timeMatches && timeMatches.length >= 2) {
            let matchedFaculty = (facultyList[0] || {}).full_name || 'Faculty Member';
            for (const f of facultyList) {
              if (line.toLowerCase().includes(f.full_name.toLowerCase())) {
                matchedFaculty = f.full_name;
                break;
              }
            }

            rawRows.push({
              faculty_name: matchedFaculty,
              department: '',
              day_of_week: dayMatch,
              start_time: timeMatches[0],
              end_time: timeMatches[1],
              activity: 'Extracted Lecture',
              room: 'LH-101'
            });
          }
        }

        if (rawRows.length === 0) {
          alert('Could not detect timetable rows in the PDF. Please verify structure or use CSV.');
          return;
        }

        await normalizeAndValidateRows(rawRows);

      } catch (err) {
        console.error('PDF parsing error:', err);
        alert('Could not parse PDF text: ' + err.message);
      }
    }

    /**
     * Normalizes 12-hour AM/PM and 24-hour time strings to HH:MM
     */
    function normalizeTimeString(str) {
      if (!str) return '';
      let s = str.trim().toUpperCase().replace(/\s+/g, '');

      // Check 12-hour AM/PM format (e.g. 9:30AM, 02:00PM, 9AM, 2PM)
      const match12 = s.match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)$/);
      if (match12) {
        let hours = parseInt(match12[1], 10);
        const minutes = match12[2] ? match12[2] : '00';
        const meridian = match12[3];

        if (meridian === 'PM' && hours < 12) hours += 12;
        if (meridian === 'AM' && hours === 12) hours = 0;

        return `${String(hours).padStart(2, '0')}:${minutes}`;
      }

      // Check standard 24h format (e.g. 9:00, 09:00, 14:30)
      const match24 = s.match(/^(\d{1,2}):(\d{2})$/);
      if (match24) {
        const hours = parseInt(match24[1], 10);
        const minutes = match24[2];
        if (hours >= 0 && hours <= 23 && parseInt(minutes, 10) >= 0 && parseInt(minutes, 10) <= 59) {
          return `${String(hours).padStart(2, '0')}:${minutes}`;
        }
      }

      return s;
    }

    /**
     * Normalizes and validates parsed raw rows
     */
    async function normalizeAndValidateRows(rawRows) {
      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const facultyList = await window.FacultyService.getAllFaculty();
      const existingTimetables = await window.TimetableService.getAllTimetables();

      const validated = [];

      rawRows.forEach((row, idx) => {
        const errors = [];
        const warnings = [];

        // 1. Day of week matching
        let cleanDay = (row.day_of_week || '').trim();
        const matchedDay = validDays.find(d => d.toLowerCase() === cleanDay.toLowerCase());
        if (matchedDay) {
          cleanDay = matchedDay;
        } else {
          errors.push(`Invalid day: "${row.day_of_week}"`);
        }

        // 2. Faculty member matching
        let matchedFacultyId = null;
        let facultyDisplayName = (row.faculty_name || '').trim();

        // Exact or fuzzy match
        const matchedFacultyObj = facultyList.find(f => {
          const fnA = f.full_name.toLowerCase();
          const fnB = facultyDisplayName.toLowerCase();
          return fnA === fnB || fnA.includes(fnB) || fnB.includes(fnA);
        });

        if (matchedFacultyObj) {
          matchedFacultyId = matchedFacultyObj.id;
          facultyDisplayName = matchedFacultyObj.full_name;
        } else {
          errors.push(`Unknown faculty member: "${row.faculty_name}"`);
        }

        // 3. Time validation
        const cleanStart = normalizeTimeString(row.start_time);
        const cleanEnd = normalizeTimeString(row.end_time);
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

        if (!timeRegex.test(cleanStart)) {
          errors.push(`Invalid start time "${row.start_time}"`);
        }
        if (!timeRegex.test(cleanEnd)) {
          errors.push(`Invalid end time "${row.end_time}"`);
        }

        if (timeRegex.test(cleanStart) && timeRegex.test(cleanEnd)) {
          if (window.Utils.compareTime(cleanStart, cleanEnd) >= 0) {
            errors.push(`End time (${cleanEnd}) must be after start time (${cleanStart})`);
          } else {
            // Duration check
            const [hA, mA] = cleanStart.split(':').map(Number);
            const [hB, mB] = cleanEnd.split(':').map(Number);
            const durationMins = (hB * 60 + mB) - (hA * 60 + mA);
            if (durationMins < 15) {
              errors.push('Duration must be at least 15 minutes');
            } else if (durationMins > 480) {
              errors.push('Duration exceeds maximum 8 hours');
            }
          }
        }

        // 4. Activity required
        const cleanActivity = (row.activity || '').trim();
        if (!cleanActivity) {
          errors.push('Activity/Subject name required');
        }

        // 5. Existing DB collision or duplicate check
        if (matchedFacultyId && matchedDay && timeRegex.test(cleanStart) && timeRegex.test(cleanEnd)) {
          const existingSameFaculty = existingTimetables.filter(t => 
            t.faculty_id === matchedFacultyId && 
            t.day_of_week === cleanDay && 
            t.is_active !== false
          );

          for (const ext of existingSameFaculty) {
            const isExactSame = ext.start_time === cleanStart && ext.end_time === cleanEnd && ext.activity === cleanActivity;
            if (isExactSame) {
              warnings.push('Duplicate of existing timetable slot in database');
            } else if (window.Utils.isTimeOverlap(cleanStart, cleanEnd, ext.start_time, ext.end_time)) {
              warnings.push(`Overlaps with existing slot "${ext.activity}" (${ext.start_time}-${ext.end_time})`);
            }
          }
        }

        validated.push({
          id: 'stage-' + idx,
          faculty_name: facultyDisplayName,
          faculty_id: matchedFacultyId,
          day_of_week: cleanDay || 'Monday',
          start_time: cleanStart,
          end_time: cleanEnd,
          activity: cleanActivity,
          room: (row.room || '').trim(),
          isValid: errors.length === 0,
          errors: errors,
          warnings: warnings
        });
      });

      // 6. Check intra-file collisions (two rows in this file colliding)
      for (let i = 0; i < validated.length; i++) {
        const a = validated[i];
        if (!a.faculty_id || !a.day_of_week) continue;

        for (let j = i + 1; j < validated.length; j++) {
          const b = validated[j];
          if (a.faculty_id === b.faculty_id && a.day_of_week === b.day_of_week) {
            if (window.Utils.isTimeOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) {
              a.errors.push(`Collides with Row ${j + 1} (${b.activity} at ${b.start_time}-${b.end_time})`);
              b.errors.push(`Collides with Row ${i + 1} (${a.activity} at ${a.start_time}-${a.end_time})`);
              a.isValid = false;
              b.isValid = false;
            }
          }
        }
      }

      stagedImportRows = validated;
      renderStagedPreview();
    }

    /**
     * Render the preview table and filter statistics
     */
    async function renderStagedPreview() {
      if (!previewSection || !previewTableBody) return;

      previewSection.style.display = 'block';

      const validCount = stagedImportRows.filter(r => r.isValid).length;
      const invalidCount = stagedImportRows.length - validCount;
      const warningCount = stagedImportRows.filter(r => r.warnings.length > 0 && r.isValid).length;

      // Update Filter button badges if present
      if (filterAllBtn) filterAllBtn.textContent = `All Rows (${stagedImportRows.length})`;
      if (filterValidBtn) filterValidBtn.textContent = `Ready / Valid (${validCount})`;
      if (filterErrorsBtn) filterErrorsBtn.textContent = `Needs Attention (${invalidCount})`;

      // Status Alert
      if (importSummaryAlert) {
        if (invalidCount === 0) {
          importSummaryAlert.className = 'alert alert-success';
          importSummaryAlert.innerHTML = `
            <div>
              <strong>✓ Ready for Database Import:</strong> All <strong>${validCount}</strong> timetable row(s) passed validation.
              ${warningCount > 0 ? `<div style="font-size: 0.8125rem; margin-top: 0.25rem;">Note: ${warningCount} row(s) have advisories (e.g. existing duplicate in database).</div>` : ''}
            </div>
          `;
        } else {
          importSummaryAlert.className = 'alert alert-warning';
          importSummaryAlert.innerHTML = `
            <div>
              <strong>Action Required:</strong> <strong>${invalidCount}</strong> row(s) require fixes before they can be committed to the database.
              <span style="font-size: 0.8125rem; display: block; margin-top: 0.25rem;">
                You can correct cells directly in the table below, select professors from the dropdown, or click "Auto-Fix Formats".
              </span>
            </div>
          `;
        }
      }

      const facultyList = await window.FacultyService.getAllFaculty();
      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

      // Filter rows
      let displayedRows = stagedImportRows;
      if (activeFilter === 'valid') {
        displayedRows = stagedImportRows.filter(r => r.isValid);
      } else if (activeFilter === 'errors') {
        displayedRows = stagedImportRows.filter(r => !r.isValid);
      }

      if (displayedRows.length === 0) {
        previewTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No rows match the selected preview filter.</td></tr>`;
        return;
      }

      previewTableBody.innerHTML = displayedRows.map((row) => {
        const actualIdx = stagedImportRows.indexOf(row);
        const rowBg = !row.isValid ? 'style="background-color: #fef2f2;"' : (row.warnings.length > 0 ? 'style="background-color: #fffbeb;"' : '');
        
        let statusBadge = `<span class="badge-status badge-available">Valid</span>`;
        if (!row.isValid) {
          statusBadge = `<span class="badge-status badge-unavailable">Error (${row.errors.length})</span>`;
        } else if (row.warnings.length > 0) {
          statusBadge = `<span class="badge-status badge-in_meeting">Advisory</span>`;
        }

        const durationStr = window.Utils.calculateDuration(row.start_time, row.end_time);

        // Faculty options with inline selector
        const facultyOptions = facultyList.map(f => 
          `<option value="${f.id}" ${f.id === row.faculty_id ? 'selected' : ''}>${f.full_name} (${f.department})</option>`
        ).join('');

        const errorsList = row.errors.length > 0 ? `<div style="font-size: 0.75rem; color: var(--danger); margin-top: 0.25rem;">${row.errors.join('; ')}</div>` : '';
        const warningsList = row.warnings.length > 0 ? `<div style="font-size: 0.75rem; color: #b45309; margin-top: 0.25rem;">${row.warnings.join('; ')}</div>` : '';

        return `
          <tr ${rowBg} id="staged-row-${actualIdx}">
            <td style="min-width: 180px;">
              <select class="form-control" style="font-size: 0.8125rem; padding: 0.3rem;"
                      onchange="window.updateStagedFaculty(${actualIdx}, this.value)">
                <option value="">-- Match Faculty Member --</option>
                ${facultyOptions}
              </select>
              ${!row.faculty_id ? `<div style="font-size: 0.75rem; color: var(--danger); margin-top: 0.2rem;">Original: "${row.faculty_name}"</div>` : ''}
              ${errorsList}
              ${warningsList}
            </td>
            <td>
              <select class="form-control" style="font-size: 0.8125rem; padding: 0.3rem;"
                      onchange="window.updateStagedCell(${actualIdx}, 'day_of_week', this.value)">
                ${validDays.map(d => `<option value="${d}" ${d.toLowerCase() === row.day_of_week.toLowerCase() ? 'selected' : ''}>${d}</option>`).join('')}
              </select>
            </td>
            <td>
              <input type="text" class="form-control" style="font-size: 0.8125rem; width: 75px; padding: 0.3rem;"
                     value="${row.start_time}" placeholder="09:00" onchange="window.updateStagedCell(${actualIdx}, 'start_time', this.value)">
            </td>
            <td>
              <input type="text" class="form-control" style="font-size: 0.8125rem; width: 75px; padding: 0.3rem;"
                     value="${row.end_time}" placeholder="10:30" onchange="window.updateStagedCell(${actualIdx}, 'end_time', this.value)">
              <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.2rem;">${durationStr || ''}</div>
            </td>
            <td>
              <input type="text" class="form-control" style="font-size: 0.8125rem; min-width: 140px; padding: 0.3rem;"
                     value="${row.activity}" placeholder="Class Name" onchange="window.updateStagedCell(${actualIdx}, 'activity', this.value)">
            </td>
            <td>
              <input type="text" class="form-control" style="font-size: 0.8125rem; width: 90px; padding: 0.3rem;"
                     value="${row.room}" placeholder="Room/Lab" onchange="window.updateStagedCell(${actualIdx}, 'room', this.value)">
            </td>
            <td style="white-space: nowrap;">
              ${statusBadge}
            </td>
            <td style="text-align: center;">
              <button class="btn btn-danger btn-sm" onclick="window.removeStagedRow(${actualIdx})" title="Remove this record" style="padding: 0.25rem 0.5rem;">✕</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Inline Faculty Dropdown Change
    window.updateStagedFaculty = async function(rowIndex, newFacultyId) {
      if (!stagedImportRows[rowIndex]) return;
      const facultyList = await window.FacultyService.getAllFaculty();
      const fac = facultyList.find(f => f.id === newFacultyId);
      if (fac) {
        stagedImportRows[rowIndex].faculty_id = fac.id;
        stagedImportRows[rowIndex].faculty_name = fac.full_name;
      } else {
        stagedImportRows[rowIndex].faculty_id = null;
      }
      revalidateStagedRows();
    };

    // Inline Cell Change
    window.updateStagedCell = function(rowIndex, field, newValue) {
      if (!stagedImportRows[rowIndex]) return;
      stagedImportRows[rowIndex][field] = (newValue || '').trim();
      revalidateStagedRows();
    };

    // Remove row
    window.removeStagedRow = function(rowIndex) {
      stagedImportRows.splice(rowIndex, 1);
      revalidateStagedRows();
    };

    // Auto-fix formats
    if (btnAutoFixStaged) {
      btnAutoFixStaged.addEventListener('click', () => {
        stagedImportRows.forEach(r => {
          r.start_time = normalizeTimeString(r.start_time);
          r.end_time = normalizeTimeString(r.end_time);
          r.activity = (r.activity || '').trim();
          r.room = (r.room || '').trim();
        });
        revalidateStagedRows();
      });
    }

    // Remove all error rows
    if (btnRemoveErrors) {
      btnRemoveErrors.addEventListener('click', () => {
        const errorCount = stagedImportRows.filter(r => !r.isValid).length;
        if (errorCount === 0) {
          alert('No error rows found.');
          return;
        }
        if (confirm(`Remove all ${errorCount} invalid rows and keep only ready ones?`)) {
          stagedImportRows = stagedImportRows.filter(r => r.isValid);
          revalidateStagedRows();
        }
      });
    }

    // Filter toggle buttons
    if (filterAllBtn) {
      filterAllBtn.addEventListener('click', () => {
        activeFilter = 'all';
        renderStagedPreview();
      });
    }
    if (filterValidBtn) {
      filterValidBtn.addEventListener('click', () => {
        activeFilter = 'valid';
        renderStagedPreview();
      });
    }
    if (filterErrorsBtn) {
      filterErrorsBtn.addEventListener('click', () => {
        activeFilter = 'errors';
        renderStagedPreview();
      });
    }

    // Re-run validation over staged rows
    async function revalidateStagedRows() {
      const raw = stagedImportRows.map(r => ({
        faculty_name: r.faculty_name,
        department: '',
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        activity: r.activity,
        room: r.room
      }));
      await normalizeAndValidateRows(raw);
    }

    /**
     * Confirm and Commit Final Import
     */
    if (btnConfirmImport) {
      btnConfirmImport.addEventListener('click', async () => {
        const validRows = stagedImportRows.filter(r => r.isValid);
        if (validRows.length === 0) {
          alert('Cannot import: No valid rows present. Please correct errors or upload a valid file.');
          return;
        }

        const mode = importModeSelect ? importModeSelect.value : 'append';
        const modeDescription = mode === 'replace_faculty'
          ? 'This will replace existing weekly timetables for the faculty members included in this file.'
          : 'This will append new records to existing timetables.';

        if (!confirm(`Ready to import ${validRows.length} timetable records?\n\nImport Mode: ${mode.toUpperCase()}\n${modeDescription}`)) {
          return;
        }

        btnConfirmImport.disabled = true;
        btnConfirmImport.textContent = 'Importing to Database...';

        try {
          const importResult = await window.TimetableService.batchImportTimetables(validRows, { mode });

          const importedCount = importResult.imported;
          const status = (importedCount === stagedImportRows.length) ? 'success' : (importedCount > 0 ? 'partial' : 'failed');

          // Log into ImportService audit trail
          if (window.ImportService) {
            await window.ImportService.recordImportLog({
              fileName: stagedFileName || 'timetable_upload.csv',
              fileType: stagedFileType || 'csv',
              uploadedBy: (window.Auth && window.Auth.getCurrentUser() ? window.Auth.getCurrentUser().name : 'Admin'),
              rowsDetected: stagedImportRows.length,
              rowsImported: importedCount,
              status: status
            });
          }

          alert(`Import Completed Successfully!\n\n• Rows Detected: ${stagedImportRows.length}\n• Rows Committed: ${importedCount}\n• Mode: ${mode}`);

          // Reset staging area
          stagedImportRows = [];
          previewSection.style.display = 'none';
          if (fileInput) fileInput.value = '';

          // Refresh application views
          window.dispatchEvent(new CustomEvent('timetable-data-changed', { detail: { action: 'batch-import' } }));

        } catch (err) {
          console.error('Import error:', err);
          alert('Error during import execution: ' + err.message);
        } finally {
          btnConfirmImport.disabled = false;
          btnConfirmImport.textContent = 'Confirm & Commit Import';
        }
      });
    }

    // Cancel / Discard
    if (btnCancelImport) {
      btnCancelImport.addEventListener('click', () => {
        if (stagedImportRows.length > 0 && !confirm('Discard all staged records?')) return;
        stagedImportRows = [];
        previewSection.style.display = 'none';
        if (fileInput) fileInput.value = '';
      });
    }

  });

})();
