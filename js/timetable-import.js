/**
 * Faculty Availability Tracker - Timetable Import (CSV & Text PDF) Module
 * Version: v0.1.0
 * 
 * Implements strict workflow:
 * Upload -> Extract -> Normalize -> Validate -> Preview -> Inline Correction -> Confirm Import
 */

let stagedImportRows = []; // In-memory staging table for rows before commit
let stagedFileName = '';
let stagedFileType = '';

document.addEventListener('DOMContentLoaded', () => {
  const fileDropArea = document.getElementById('timetable-file-drop');
  const fileInput = document.getElementById('timetable-file-input');
  const previewSection = document.getElementById('import-preview-section');
  const previewTableBody = document.getElementById('import-preview-body');
  const btnConfirmImport = document.getElementById('btn-confirm-import');
  const btnCancelImport = document.getElementById('btn-cancel-import');
  const importSummaryAlert = document.getElementById('import-summary-alert');
  const sampleCsvDownloadBtn = document.getElementById('btn-download-sample-csv');

  if (fileDropArea && fileInput) {
    fileDropArea.addEventListener('click', () => fileInput.click());

    fileDropArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileDropArea.style.borderColor = 'var(--primary)';
      fileDropArea.style.backgroundColor = 'var(--primary-light)';
    });

    fileDropArea.addEventListener('dragleave', () => {
      fileDropArea.style.borderColor = 'var(--border-color)';
      fileDropArea.style.backgroundColor = 'var(--surface-color)';
    });

    fileDropArea.addEventListener('drop', (e) => {
      e.preventDefault();
      fileDropArea.style.borderColor = 'var(--border-color)';
      fileDropArea.style.backgroundColor = 'var(--surface-color)';
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

  // Sample CSV generator for easy testing
  if (sampleCsvDownloadBtn) {
    sampleCsvDownloadBtn.addEventListener('click', () => {
      const sampleContent = 
`Faculty Name,Department,Day,Start Time,End Time,Activity,Room
Dr. Rahul Sharma,Computer Engineering,Monday,09:00,10:00,Operating Systems,LH-101
Dr. Rahul Sharma,Computer Engineering,Monday,10:00,11:00,Data Structures Lab,Lab 2
Dr. Priya Mehta,Information Technology,Monday,10:30,12:00,Database Systems,LH-201
Prof. Arvind Patel,Electronics Engineering,Wednesday,14:00,16:00,Hardware Lab,Circuit Lab 2
Dr. Priya Mehta,Information Technology,Thursday,14:00,15:00,Academic Counseling,Cabin 8`;

      const blob = new Blob([sampleContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sample_college_timetable.csv';
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
      alert('Unsupported file format. Please upload a CSV or text-based PDF timetable.');
    }
  }

  // 1. CSV Parser
  function readCSV(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

      if (lines.length <= 1) {
        alert('CSV file appears empty or missing data rows.');
        return;
      }

      // Header parsing
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const rawRows = [];

      for (let i = 1; i < lines.length; i++) {
        // Simple comma split handling quotes if needed
        const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        if (values.length < 5) continue;

        const rowObj = {
          faculty_name: values[0] || '',
          department: values[1] || '',
          day_of_week: values[2] || '',
          start_time: values[3] || '',
          end_time: values[4] || '',
          activity: values[5] || '',
          room: values[6] || ''
        };
        rawRows.push(rowObj);
      }

      normalizeAndValidateRows(rawRows);
    };
    reader.readAsText(file);
  }

  // 2. Text PDF Parser (using browser PDF.js)
  async function readPDF(file) {
    const arrayBuffer = await file.arrayBuffer();

    // Check if pdfjsLib is available in window
    if (!window.pdfjsLib) {
      alert('PDF parser engine is loading. Please retry in a moment or test with CSV.');
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

      // Check if usable text extracted
      if (!fullText || fullText.trim().length < 20) {
        alert('This PDF does not contain extractable timetable text. Please use a text-based PDF or CSV.');
        return;
      }

      // Extract rows from text pattern
      const parsedRows = parseTextTimetable(fullText);
      if (parsedRows.length === 0) {
        alert('This PDF does not contain recognizable timetable structure. Please verify formatting or use CSV.');
        return;
      }

      normalizeAndValidateRows(parsedRows);

    } catch (err) {
      console.error('PDF parsing error:', err);
      alert('This PDF does not contain extractable timetable text. Please use a text-based PDF or CSV.');
    }
  }

  // Regex/token extraction for text PDF content
  function parseTextTimetable(text) {
    const lines = text.split(/\r?\n|\s{3,}/).map(l => l.trim()).filter(l => l.length > 5);
    const rows = [];
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Search for line containing Day and Time tokens
    for (const line of lines) {
      const dayMatch = validDays.find(d => line.toLowerCase().includes(d.toLowerCase()));
      const timeMatches = line.match(/\b\d{1,2}:\d{2}\b/g);

      if (dayMatch && timeMatches && timeMatches.length >= 2) {
        // Find best match for faculty name in known list
        const store = window.DataStore.getStore();
        let matchedFaculty = (store.faculty || [])[0].full_name;

        for (const f of store.faculty) {
          if (line.toLowerCase().includes(f.full_name.toLowerCase()) || 
              line.toLowerCase().includes(f.full_name.split(' ').pop().toLowerCase())) {
            matchedFaculty = f.full_name;
            break;
          }
        }

        rows.push({
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

    return rows;
  }

  // 3. Normalization and Comprehensive Validation
  function normalizeAndValidateRows(rawRows) {
    const store = window.DataStore.getStore();
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const validated = [];

    rawRows.forEach((row, idx) => {
      const errors = [];

      // Clean day
      let cleanDay = row.day_of_week.trim();
      const matchedDay = validDays.find(d => d.toLowerCase() === cleanDay.toLowerCase());
      if (matchedDay) {
        cleanDay = matchedDay;
      } else {
        errors.push(`Invalid day: "${row.day_of_week}"`);
      }

      // Match faculty
      let matchedFacultyId = null;
      let facultyDisplayName = row.faculty_name.trim();

      const matchedFacultyObj = (store.faculty || []).find(f => 
        f.full_name.toLowerCase().includes(facultyDisplayName.toLowerCase()) ||
        facultyDisplayName.toLowerCase().includes(f.full_name.toLowerCase())
      );

      if (matchedFacultyObj) {
        matchedFacultyId = matchedFacultyObj.id;
        facultyDisplayName = matchedFacultyObj.full_name;
      } else {
        errors.push(`Unknown faculty member: "${row.faculty_name}"`);
      }

      // Time format checks
      const timeRegex = /^\d{1,2}:\d{2}$/;
      let cleanStart = row.start_time.trim();
      let cleanEnd = row.end_time.trim();

      if (!timeRegex.test(cleanStart)) errors.push(`Invalid start time: "${cleanStart}"`);
      if (!timeRegex.test(cleanEnd)) errors.push(`Invalid end time: "${cleanEnd}"`);

      // Compare start vs end
      if (timeRegex.test(cleanStart) && timeRegex.test(cleanEnd)) {
        if (window.Utils.compareTime(cleanStart, cleanEnd) >= 0) {
          errors.push(`End time (${cleanEnd}) must be after start time (${cleanStart})`);
        }
      }

      // Activity required
      const cleanActivity = (row.activity || '').trim();
      if (!cleanActivity) {
        errors.push('Activity name cannot be empty');
      }

      validated.push({
        id: 'stage-' + idx,
        faculty_name: facultyDisplayName,
        faculty_id: matchedFacultyId,
        day_of_week: cleanDay,
        start_time: cleanStart,
        end_time: cleanEnd,
        activity: cleanActivity,
        room: (row.room || '').trim(),
        isValid: errors.length === 0,
        errors: errors
      });
    });

    stagedImportRows = validated;
    renderStagedPreview();
  }

  // 4. Render Preview with inline corrections
  function renderStagedPreview() {
    if (!previewSection || !previewTableBody) return;

    previewSection.style.display = 'block';

    const validCount = stagedImportRows.filter(r => r.isValid).length;
    const invalidCount = stagedImportRows.length - validCount;

    if (importSummaryAlert) {
      if (invalidCount === 0) {
        importSummaryAlert.className = 'alert alert-success';
        importSummaryAlert.innerHTML = `<strong>Ready to import:</strong> All ${validCount} timetable rows passed validation.`;
      } else {
        importSummaryAlert.className = 'alert alert-warning';
        importSummaryAlert.innerHTML = `<strong>Attention Required:</strong> ${invalidCount} row(s) have errors. You can edit cells directly below to correct them before confirming.`;
      }
    }

    const store = window.DataStore.getStore();

    previewTableBody.innerHTML = stagedImportRows.map((row, idx) => {
      const rowBg = row.isValid ? '' : 'style="background-color: #fef2f2;"';
      const statusBadge = row.isValid 
        ? `<span class="badge-status badge-available">Valid</span>`
        : `<span class="badge-status badge-unavailable">Needs Fix</span>`;

      const errorHelp = row.errors.length > 0 
        ? `<div style="font-size: 0.75rem; color: var(--danger); margin-top: 0.25rem;">${row.errors.join('; ')}</div>` 
        : '';

      return `
        <tr ${rowBg}>
          <td>
            <input type="text" class="form-control" style="font-size: 0.8125rem; padding: 0.25rem 0.5rem;" 
                   value="${row.faculty_name}" onchange="window.updateStagedCell(${idx}, 'faculty_name', this.value)">
            ${errorHelp}
          </td>
          <td>
            <select class="form-control" style="font-size: 0.8125rem; padding: 0.25rem 0.5rem;" 
                    onchange="window.updateStagedCell(${idx}, 'day_of_week', this.value)">
              ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => 
                `<option value="${d}" ${d.toLowerCase() === row.day_of_week.toLowerCase() ? 'selected' : ''}>${d}</option>`
              ).join('')}
            </select>
          </td>
          <td>
            <input type="text" class="form-control" style="font-size: 0.8125rem; width: 80px; padding: 0.25rem 0.5rem;" 
                   value="${row.start_time}" onchange="window.updateStagedCell(${idx}, 'start_time', this.value)">
          </td>
          <td>
            <input type="text" class="form-control" style="font-size: 0.8125rem; width: 80px; padding: 0.25rem 0.5rem;" 
                   value="${row.end_time}" onchange="window.updateStagedCell(${idx}, 'end_time', this.value)">
          </td>
          <td>
            <input type="text" class="form-control" style="font-size: 0.8125rem; padding: 0.25rem 0.5rem;" 
                   value="${row.activity}" onchange="window.updateStagedCell(${idx}, 'activity', this.value)">
          </td>
          <td>
            <input type="text" class="form-control" style="font-size: 0.8125rem; width: 90px; padding: 0.25rem 0.5rem;" 
                   value="${row.room}" onchange="window.updateStagedCell(${idx}, 'room', this.value)">
          </td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="window.removeStagedRow(${idx})">✕</button>
          </td>
        </tr>
      `;
    }).join('');

    previewSection.scrollIntoView({ behavior: 'smooth' });
  }

  // Inline correction handler
  window.updateStagedCell = function(rowIndex, field, newValue) {
    if (!stagedImportRows[rowIndex]) return;
    stagedImportRows[rowIndex][field] = newValue.trim();

    // Re-run normalization & validation on current set
    const rechecked = [];
    const store = window.DataStore.getStore();
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    stagedImportRows.forEach(r => {
      const errs = [];
      const matchedDay = validDays.find(d => d.toLowerCase() === r.day_of_week.toLowerCase());
      if (!matchedDay) errs.push('Invalid day');

      const matchedFacultyObj = (store.faculty || []).find(f => 
        f.full_name.toLowerCase().includes(r.faculty_name.toLowerCase())
      );
      if (matchedFacultyObj) {
        r.faculty_id = matchedFacultyObj.id;
      } else {
        errs.push('Unknown faculty');
      }

      if (!/^\d{1,2}:\d{2}$/.test(r.start_time) || !/^\d{1,2}:\d{2}$/.test(r.end_time)) {
        errs.push('Invalid time format');
      } else if (window.Utils.compareTime(r.start_time, r.end_time) >= 0) {
        errs.push('End time must be after start');
      }

      if (!r.activity) errs.push('Missing activity');

      r.isValid = (errs.length === 0);
      r.errors = errs;
    });

    renderStagedPreview();
  };

  window.removeStagedRow = function(rowIndex) {
    stagedImportRows.splice(rowIndex, 1);
    renderStagedPreview();
  };

  // 5. Confirm Final Import
  if (btnConfirmImport) {
    btnConfirmImport.addEventListener('click', () => {
      const validRows = stagedImportRows.filter(r => r.isValid);
      if (validRows.length === 0) {
        alert('Cannot import: No valid rows present. Please correct errors or upload a valid file.');
        return;
      }

      const store = window.DataStore.getStore();
      if (!store.timetables) store.timetables = [];

      // Add each valid row to timetables
      validRows.forEach(row => {
        store.timetables.push({
          id: 'imp-tt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          faculty_id: row.faculty_id,
          day_of_week: row.day_of_week,
          start_time: row.start_time,
          end_time: row.end_time,
          activity: row.activity,
          room: row.room,
          is_active: true
        });
      });

      // Record audit history entry in timetable_imports
      if (!store.imports) store.imports = [];
      store.imports.unshift({
        id: 'imp-' + Date.now(),
        file_name: stagedFileName || 'timetable_upload.csv',
        file_type: stagedFileType || 'csv',
        uploaded_by: (Auth.getCurrentUser() || {}).name || 'Admin',
        rows_detected: stagedImportRows.length,
        rows_imported: validRows.length,
        status: (validRows.length === stagedImportRows.length) ? 'success' : 'partial',
        created_at: new Date().toISOString()
      });

      window.DataStore.saveStore(store);

      alert(`Successfully imported ${validRows.length} timetable records into the database!`);
      stagedImportRows = [];
      previewSection.style.display = 'none';

      // Refresh admin tables if available
      window.location.reload();
    });
  }

  // Cancel import
  if (btnCancelImport) {
    btnCancelImport.addEventListener('click', () => {
      stagedImportRows = [];
      previewSection.style.display = 'none';
      if (fileInput) fileInput.value = '';
    });
  }
});
