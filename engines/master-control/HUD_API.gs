const HUD_SCHEMA_VERSION = '1.0';

function hud_getSnapshot() {
  getAuthorizedMasterControlUser_();
  // Read-only: no script lock, so audited writes never queue behind the HUD's 60-second refresh (owner 2026-11-05).
  return (function () {
    const spreadsheet = getMasterControlSpreadsheet_();
    const requiredTabs = ['Clients', 'Projects', 'Finances', 'Services_Rates', 'Alfred_Alerts'];
    const missingRequiredTabs = requiredTabs.filter(name => !spreadsheet.getSheetByName(name));
    if (missingRequiredTabs.length) {
      throw new Error('Required Master Control tabs are missing: ' + missingRequiredTabs.join(', '));
    }
    const optionalTabs = ['Schema_Registry', 'Schema_Change_Log'];
    const missingOptionalTabs = optionalTabs.filter(name => !spreadsheet.getSheetByName(name));
    return {
      clients: hud_getSheetRows_(spreadsheet, 'Clients'),
      projects: hud_getSheetRows_(spreadsheet, 'Projects'),
      finances: hud_getSheetRows_(spreadsheet, 'Finances'),
      servicesRates: hud_getSheetRows_(spreadsheet, 'Services_Rates'),
      alerts: hud_getSheetRows_(spreadsheet, 'Alfred_Alerts'),
      schemaRegistry: hud_getSheetRows_(spreadsheet, 'Schema_Registry'),
      schemaChangeLog: hud_getSheetRows_(spreadsheet, 'Schema_Change_Log'),
      schemaVersion: HUD_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      warnings: missingOptionalTabs.map(name => name + ' is not present in the working copy.')
    };
  })();
}

function hud_getProjectTasks(projectId) {
  getAuthorizedMasterControlUser_();
  const targetProjectId = String(projectId == null ? '' : projectId).trim();
  if (!targetProjectId) {
    throw new Error('A project ID is required to read Google Tasks.');
  }
  if (typeof Tasks === 'undefined' || !Tasks.Tasklists || !Tasks.Tasks) {
    throw new Error('The Google Tasks advanced service is not available.');
  }

  const project = (function () { // read-only: no script lock (see hud_getSnapshot)
    const spreadsheet = getMasterControlSpreadsheet_();
    const projects = hud_getSheetRows_(spreadsheet, 'Projects');
    const matches = projects.filter(project => String(project.ProjectID || '').trim() === targetProjectId);
    if (matches.length !== 1) {
      throw new Error(matches.length
        ? 'Master Control contains duplicate records for this project.'
        : 'The requested project was not found.');
    }
    return matches[0];
  })();
  const taskListId = String(project.Google_Tasklist_ID || '').trim();
  if (!taskListId) {
    throw new Error('This project does not have a Google Tasks list configured.');
  }

  const tasks = [];
  let pageToken;
  do {
    const options = { maxResults: 100, showCompleted: true, showHidden: true };
    if (pageToken) options.pageToken = pageToken;
    const page = Tasks.Tasks.list(taskListId, options);
    if (Array.isArray(page.items)) tasks.push.apply(tasks, page.items);
    pageToken = page.nextPageToken || '';
  } while (pageToken);

  return { projectId: targetProjectId, tasks, milestoneKeys: hud_milestoneKeys_(project) };
}

/**
 * Phase F: template Keys marked Is_Milestone for this project's tabs (Planet fires milestone.done on completion).
 * Cached 10 minutes per project so task reads do not reopen the template repository each time.
 */
function hud_milestoneKeys_(project) {
  const cacheKey = 'hud-milestones:' + String(project.ProjectID || '').trim();
  try {
    const cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (error) { /* cache is optional */ }
  try {
    const keys = Object.keys(deck_milestoneKeys_(project, SpreadsheetApp.openById(DOLORES_TEMPLATE_REPO_ID)));
    try { CacheService.getScriptCache().put(cacheKey, JSON.stringify(keys), 600); } catch (error) { /* optional */ }
    return keys;
  } catch (error) {
    console.warn('Milestone keys unavailable: ' + (error && error.message));
    return [];
  }
}

/**
 * Read-only (owner 2026-11-06): the Apps Script API sometimes answers "Internal error encountered" although the
 * write finished. The HUD then asks for the write's audit row by request ID instead of reporting a failure.
 * Returns { requestId, found, status ('Pending' | 'Confirmed' | 'Failed'), before, after, error }.
 */
function hud_getWriteStatus(requestId) {
  getAuthorizedMasterControlUser_();
  const key = String(requestId == null ? '' : requestId).trim();
  if (!key) throw new Error('A request ID is required.');
  const sheet = getMasterControlSpreadsheet_().getSheetByName('HUD_Audit_Log');
  const empty = { requestId: key, found: false, status: '', before: {}, after: {}, error: '' };
  if (!sheet || sheet.getLastRow() < 2) return empty;
  const headers = hud_getHeaders_(sheet);
  const requestColumn = hud_requireColumn_(headers, 'Request_ID');
  const lastRow = sheet.getLastRow();
  const ids = sheet.getRange(2, requestColumn + 1, lastRow - 1, 1).getValues();
  for (let index = ids.length - 1; index >= 0; index -= 1) {
    if (String(ids[index][0] || '').trim() !== key) continue;
    const row = sheet.getRange(index + 2, 1, 1, headers.length).getValues()[0];
    const cell = function (name) { return row[headers.indexOf(name)]; };
    const parse = function (text) { try { return JSON.parse(String(text || '{}')); } catch (error) { return {}; } };
    const after = parse(cell('After'));
    delete after._timings;
    return { requestId: key, found: true, status: String(cell('Status') || ''), before: parse(cell('Before')), after: after, error: String(cell('Error') || '') };
  }
  return empty;
}

function authorizeHudScopes() {
  getAuthorizedMasterControlUser_();
  const spreadsheetName = withLock_(function () {
    return getMasterControlSpreadsheet_().getName();
  });
  const driveName = DriveApp.getRootFolder().getName();
  if (typeof Tasks === 'undefined' || !Tasks.Tasklists) {
    throw new Error('Enable the Google Tasks advanced service before authorizing HUD scopes.');
  }
  const taskLists = Tasks.Tasklists.list({ maxResults: 1 });
  return {
    authorized: true,
    spreadsheetAvailable: Boolean(spreadsheetName),
    driveAvailable: Boolean(driveName),
    tasksAvailable: Boolean(taskLists)
  };
}

function hud_getSheetRows_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(header => String(header == null ? '' : header).trim());
  return values.slice(1)
    .filter(row => row.some(value => value !== '' && value !== null))
    .map(row => {
      const record = {};
      headers.forEach((header, index) => {
        if (!header) return;
        const value = sheetName === 'Alfred_Alerts'
          && ['Message', 'Trigger_Condition', 'Prescribed_Action', 'Action_URL'].indexOf(header) !== -1
          ? sanitizeAlertText_(row[index])
          : row[index];
        record[header] = hud_serializeValue_(value);
      });
      return record;
    });
}

function hud_serializeValue_(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(hud_serializeValue_);
  if (value && typeof value === 'object') {
    const result = {};
    Object.keys(value).forEach(key => {
      result[key] = hud_serializeValue_(value[key]);
    });
    return result;
  }
  return value;
}
