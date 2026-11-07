/**
 * Schema registry and change log (Police housekeeping), plus the small shared helpers every file uses
 * (colLetter_, withLock_, nextChangeId_). 2026-11-06 cleanup: merged from Schema_Control.js and the reusable part of
 * HUD_Repairs.gs; the one-off Phase B repairs, the write self-test and the SCH-0001..0014 seeding are gone.
 *
 * Owner tools (also in the SZS Tools menu):
 *   snapshotLiveSchemaToRegistry()  adds any live column the registry does not list yet (append-only)
 *   runSchemaConformanceCheck()     READ-ONLY: compares live headers with the registry
 */

var SCHEMA = {
  REGISTRY_TAB: 'Schema_Registry',
  LOG_TAB: 'Schema_Change_Log',
  REGISTRY_HEADERS: [
    'Registry_ID', 'Database', 'Tab', 'Column_Letter', 'Column_Name', 'Data_Type',
    'Allowed_Values', 'Data_Class', 'Owner_Persona', 'Required', 'Schema_Version',
    'Last_Verified', 'Notes'
  ],
  LOG_HEADERS: [
    'Change_ID', 'Logged_At', 'Requested_By', 'Target_Database', 'Target_Tab', 'Target_Column',
    'Change_Type', 'Reason', 'Impact', 'Severity', 'Status', 'Approved_By',
    'Applied_Version', 'Police_Check_Result', 'Rollback_Note', 'Source'
  ],
  STATUSES: ['Noted', 'Requested', 'Approved', 'Applied', 'Verified', 'Rejected'],
  SEVERITIES: ['INFO', 'WARN', 'BLOCK'],
  CHANGE_TYPES: [
    'Add column', 'Rename column', 'Remove column', 'Add allowed value',
    'Change type', 'New tab', 'ID format', 'Process', 'Other'
  ],
  DATABASE_NAME: 'Master Control',
  BASELINE_TABS: ['Clients', 'Projects', 'Finances', 'Services_Rates', 'Alfred_Alerts'],
  MONEY_TABS: ['Finances', 'Services_Rates'],
  ALERT_TARGET_HEADERS: [
    'Alert_ID', 'Created_At', 'Source_Module', 'Department', 'Client_ID', 'Project_ID',
    'Entity_Reference', 'Severity', 'Trigger_Condition', 'Prescribed_Action', 'Due_SLA',
    'Assigned_Lead', 'Action_Status', 'Resolved_At'
  ]
};

/* ---------- helpers ---------- */

function getMasterSheet_() {
  return getMasterControlSpreadsheet_();
}

function colLetter_(n) {
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function ensureTab_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else {
    var existing = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    for (var i = 0; i < headers.length; i++) {
      if (String(existing[i]).trim() !== headers[i]) {
        Logger.log('WARNING: ' + name + ' header ' + (i + 1) + ' is "' + existing[i] +
                   '" but expected "' + headers[i] + '". Left untouched.');
      }
    }
  }
  return sh;
}

function nextChangeId_(sh) {
  var last = sh.getLastRow();
  var max = 0;
  if (last > 1) {
    var ids = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      var m = /^SCH-(\d+)$/.exec(String(ids[i][0]));
      if (m) { max = Math.max(max, parseInt(m[1], 10)); }
    }
  }
  return 'SCH-' + ('0000' + (max + 1)).slice(-4);
}

function appendLogRow_(sh, entry) {
  var row = SCHEMA.LOG_HEADERS.map(function (h) {
    return entry[h] === undefined ? '' : entry[h];
  });
  sh.appendRow(row);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------- 1. create the tabs (idempotent) ---------- */

/* ---------- 2. baseline the live headers into the registry (idempotent) ---------- */

function snapshotLiveSchemaToRegistry() {
  return withLock_(function () {
    var ss = getMasterSheet_();
    var reg = ensureTab_(ss, SCHEMA.REGISTRY_TAB, SCHEMA.REGISTRY_HEADERS);
    var last = reg.getLastRow();
    var seen = {};
    if (last > 1) {
      var data = reg.getRange(2, 1, last - 1, SCHEMA.REGISTRY_HEADERS.length).getValues();
      for (var i = 0; i < data.length; i++) {
        seen[data[i][1] + '|' + data[i][2] + '|' + data[i][4]] = true;
      }
    }
    var added = 0;
    var now = new Date();
    SCHEMA.BASELINE_TABS.forEach(function (tab) {
      var sh = ss.getSheetByName(tab);
      if (!sh) { Logger.log('Tab not found, skipped: ' + tab); return; }
      var width = sh.getLastColumn();
      if (width === 0) { return; }
      var headers = sh.getRange(1, 1, 1, width).getValues()[0];
      headers.forEach(function (h, idx) {
        var name = String(h).trim();
        if (!name) { return; }
        var key = SCHEMA.DATABASE_NAME + '|' + tab + '|' + name;
        if (seen[key]) { return; }
        var letter = colLetter_(idx + 1);
        // Fill valid defaults so new baseline rows pass the HUD registry contract (Plan v3.1 B3).
        var defaults = typeof hud_completeRegistryFields_ === 'function'
          ? hud_completeRegistryFields_({ Tab: tab, Column_Name: name })
          : {};
        reg.appendRow([
          'REG-' + tab + '-' + letter, SCHEMA.DATABASE_NAME, tab, letter, name,
          defaults.Data_Type || '', defaults.Allowed_Values || '', defaults.Data_Class || '',
          defaults.Owner_Persona || '', defaults.Required || '', '0.1-baseline', now,
          'Baseline captured from live header. Owner review needed.'
        ]);
        seen[key] = true;
        added++;
      });
    });
    Logger.log('Registry baseline rows added: ' + added);
    return added;
  });
}

/* ---------- 3. seed the known gaps (idempotent by Change_ID) ---------- */

/* ---------- 4. read-only conformance check (Police calls this) ---------- */

function runSchemaConformanceCheck() {
  return runSchemaConformanceCheck_({ alreadyLocked: false });
}

function runSchemaConformanceCheck_(opts) {
  var run = function () {
    var ss = getMasterSheet_();
    var reg = ss.getSheetByName(SCHEMA.REGISTRY_TAB);
    var log = ss.getSheetByName(SCHEMA.LOG_TAB);
    if (!reg || !log) { Logger.log('Schema tabs missing. Run setupSchemaTabs().'); return -1; }

    // registry columns by tab (Master Control only)
    var regRows = reg.getLastRow() > 1
      ? reg.getRange(2, 1, reg.getLastRow() - 1, SCHEMA.REGISTRY_HEADERS.length).getValues() : [];
    var registered = {};
    regRows.forEach(function (r) {
      if (r[1] !== SCHEMA.DATABASE_NAME) { return; }
      if (!registered[r[2]]) { registered[r[2]] = {}; }
      registered[r[2]][r[4]] = r[3];
    });

    // open findings, to avoid duplicates
    var logRows = log.getLastRow() > 1
      ? log.getRange(2, 1, log.getLastRow() - 1, SCHEMA.LOG_HEADERS.length).getValues() : [];
    var openKeys = {};
    logRows.forEach(function (r) {
      var status = r[10];
      if (r[15] === 'police.schema' && status !== 'Verified' && status !== 'Rejected') {
        openKeys[r[4] + '|' + r[5] + '|' + r[6]] = true;
      }
    });

    var findings = [];
    SCHEMA.BASELINE_TABS.forEach(function (tab) {
      if (!registered[tab]) { return; } // not baselined yet: skip quietly
      var sh = ss.getSheetByName(tab);
      if (!sh) { findings.push([tab, '(tab)', 'New tab', 'Registered tab is missing from the live sheet']); return; }
      var width = sh.getLastColumn();
      var live = width > 0 ? sh.getRange(1, 1, 1, width).getValues()[0] : [];
      var liveMap = {};
      live.forEach(function (h, idx) {
        var name = String(h).trim();
        if (name) { liveMap[name] = colLetter_(idx + 1); }
      });
      Object.keys(liveMap).forEach(function (name) {
        if (registered[tab][name] === undefined) {
          findings.push([tab, name, 'Add column', 'Unregistered column found in live sheet']);
        } else if (registered[tab][name] !== liveMap[name]) {
          findings.push([tab, name, 'Other', 'Column moved: registry ' + registered[tab][name] + ', live ' + liveMap[name]]);
        }
      });
      Object.keys(registered[tab]).forEach(function (name) {
        if (liveMap[name] === undefined) {
          findings.push([tab, name, 'Remove column', 'Registered column missing from live sheet']);
        }
      });
    });

    var now = new Date();
    var added = 0;
    findings.forEach(function (f) {
      var key = f[0] + '|' + f[1] + '|' + f[2];
      if (openKeys[key]) { return; }
      var isMoney = SCHEMA.MONEY_TABS.indexOf(f[0]) !== -1;
      appendLogRow_(log, {
        Change_ID: nextChangeId_(log), Logged_At: now, Requested_By: 'Police Engine',
        Target_Database: SCHEMA.DATABASE_NAME, Target_Tab: f[0], Target_Column: f[1],
        Change_Type: f[2], Reason: f[3],
        Impact: 'Unreviewed schema drift', Severity: isMoney ? 'BLOCK' : 'WARN',
        Status: 'Noted', Police_Check_Result: 'FAIL', Source: 'police.schema'
      });
      openKeys[key] = true;
      added++;
    });
    Logger.log('Conformance check done. New findings logged: ' + added);
    return added;
  };
  return (opts && opts.alreadyLocked) ? run() : withLock_(run);
}

/* ---------- 5. Alfred_Alerts header gap report (read-only) ---------- */

/* ---------- Police hook (owner pastes ONE line into runSystemPoliceAudit) ----------
 *
 *   try { runSchemaConformanceCheck_({ alreadyLocked: true }); }
 *   catch (e) { Logger.log('Schema check failed: ' + e); }
 *
 * Use alreadyLocked:true ONLY if runSystemPoliceAudit already holds the script lock.
 * If it does not, call runSchemaConformanceCheck_({ alreadyLocked: false }) instead.
 */

/* ---------- registry field defaults and audited maintenance logging ---------- */

var HUD_REGISTRY_TYPE_ALIASES = {
  string: 'text', url: 'text', email: 'text', integer: 'number', int: 'number', float: 'number',
  percentage: 'number', percent: 'number', timestamp: 'date', datetime: 'date', checkbox: 'boolean',
  bool: 'boolean', money: 'currency', dropdown: 'enum', list: 'enum'
};

var HUD_REGISTRY_VALID = {
  Data_Type: ['text', 'number', 'date', 'enum', 'id', 'currency', 'boolean', 'json'],
  Data_Class: ['public', 'internal', 'pii', 'secret'],
  Required: ['yes', 'no']
};

var HUD_REGISTRY_TAB_OWNERS = {
  Clients: 'Pamela', Projects: 'Dolores', Finances: 'Vala', Services_Rates: 'Vala',
  Alfred_Alerts: 'Alfred', HUD_Audit_Log: 'Alfred', Edit_Log: 'Alfred'
};

var HUD_REGISTRY_ID_PATTERNS = {
  ClientID: '^[A-Z]{3}\\d{0,2}$',
  Client_ID: '^[A-Z]{3}\\d{0,2}$',
  ProjectID: '^[A-Z]{3}\\d{0,2}-\\d{2,3}$',
  Project_ID: '^[A-Z]{3}\\d{0,2}-\\d{2,3}$',
  InvoiceID: '^INV-[A-Z]{3}\\d{0,2}-\\d{2}-\\d{3,}$'
};

// A function, not a top-level value, so it never depends on which file Apps Script loads first.
function hud_registryAuthoritativeEnums_() {
  return {
    'Clients|AccountPhase': HUD_WRITE_ACCOUNT_PHASES.join(', '),
    'Clients|AccountPhase_Mode': 'auto,manual',
    'Projects|SprintStage': HUD_WRITE_SPRINT_STAGES.join(', ')
  };
}

var HUD_REGISTRY_PII = ['First_Name', 'Last_Name', 'ContactEmail', 'GoogleGroupEmail', 'PrimaryContact', 'User'];

var HUD_REGISTRY_REQUIRED = {
  Clients: ['ClientID', 'Company_Name', 'AccountPhase', 'AccountPhase_Mode'],
  Projects: ['ProjectID', 'ClientID', 'ProjectName', 'SprintStage'],
  Finances: ['InvoiceID', 'ClientID', 'ProjectID'],
  Alfred_Alerts: ['Alert_ID']
};

/* ---------- B2: AccountPhase validation ---------- */

/* ---------- B3: Schema_Registry completion ---------- */

/** Pure: returns the corrected registry fields for one row (only fixes blank or invalid fields). */
function hud_completeRegistryFields_(row) {
  const tab = String(row.Tab || '').trim();
  const column = String(row.Column_Name || '').trim();
  const out = {};
  const authoritative = hud_registryAuthoritativeEnums_()[tab + '|' + column];

  let type = String(row.Data_Type || '').trim().toLowerCase();
  if (HUD_REGISTRY_TYPE_ALIASES[type]) type = HUD_REGISTRY_TYPE_ALIASES[type];
  if (HUD_REGISTRY_ID_PATTERNS[column]) type = 'id';
  if (authoritative) type = 'enum';
  if (HUD_REGISTRY_VALID.Data_Type.indexOf(type) === -1) type = 'text';
  if (type !== row.Data_Type) out.Data_Type = type;

  let allowed = String(row.Allowed_Values == null ? '' : row.Allowed_Values).trim();
  if (authoritative) allowed = authoritative;
  else if (HUD_REGISTRY_ID_PATTERNS[column]) allowed = HUD_REGISTRY_ID_PATTERNS[column];
  else if (!allowed) allowed = '*';
  if (allowed !== row.Allowed_Values) out.Allowed_Values = allowed;

  let dataClass = String(row.Data_Class || '').trim().toLowerCase();
  if (HUD_REGISTRY_VALID.Data_Class.indexOf(dataClass) === -1) {
    dataClass = HUD_REGISTRY_PII.indexOf(column) !== -1 ? 'pii' : 'internal';
  }
  if (dataClass !== row.Data_Class) out.Data_Class = dataClass;

  const owner = String(row.Owner_Persona || '').trim() || HUD_REGISTRY_TAB_OWNERS[tab] || 'Alfred';
  if (owner !== row.Owner_Persona) out.Owner_Persona = owner;

  let required = String(row.Required || '').trim().toLowerCase();
  if (HUD_REGISTRY_VALID.Required.indexOf(required) === -1) {
    required = (HUD_REGISTRY_REQUIRED[tab] || []).indexOf(column) !== -1 ? 'yes' : 'no';
  }
  if (required !== row.Required) out.Required = required;

  const version = String(row.Schema_Version == null ? '' : row.Schema_Version).trim();
  if (!version) out.Schema_Version = '0.1-baseline';
  else if (typeof row.Schema_Version !== 'string') out.Schema_Version = version;

  return out;
}

/* ---------- B2: write-path self-test on a fake ZZZ client ---------- */

/* ---------- helpers ---------- */

function hud_logRepair_(spreadsheet, actor, entry) {
  const audit = hud_ensureAuditLog_(spreadsheet, actor);
  audit.sheet.appendRow(hud_objectRow_(audit.headers, {
    Timestamp: new Date().toISOString(),
    User: actor,
    Action: entry.action,
    Entity: entry.entity,
    Before: JSON.stringify(entry.before),
    After: JSON.stringify(entry.after),
    Request_ID: 'repair-' + Utilities.getUuid(),
    Status: 'Confirmed',
    Error: ''
  }));
}

function hud_registerSchemaChangeOnce_(spreadsheet, actor, definition) {
  const log = hud_ensureSchemaSheet_(spreadsheet, SCHEMA.LOG_TAB, SCHEMA.LOG_HEADERS);
  const headers = hud_getHeaders_(log);
  const reasonColumn = hud_requireColumn_(headers, 'Reason');
  const exists = log.getDataRange().getValues().slice(1).some(function (row) {
    return String(row[reasonColumn] || '').trim() === definition.reason;
  });
  if (exists) return;
  log.appendRow(hud_objectRow_(headers, {
    Change_ID: nextChangeId_(log),
    Logged_At: new Date().toISOString(),
    Requested_By: actor,
    Target_Database: 'Master Control',
    Target_Tab: definition.tab,
    Target_Column: definition.column,
    Change_Type: definition.changeType,
    Reason: definition.reason,
    Impact: definition.impact,
    Severity: 'INFO',
    Status: 'Applied',
    Approved_By: actor,
    Applied_Version: '',
    Police_Check_Result: '',
    Rollback_Note: 'Re-apply the prior list with setColumnDropdown if rollback is required.',
    Source: 'manual'
  }));
}
