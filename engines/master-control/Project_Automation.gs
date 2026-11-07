/**
 * Phase E2-E3 (Master Plan v3.1): template repository fields, per-project assets
 * (Google Group, Brief, Outline, internal + client Chat Spaces) and the Google Tasks list.
 * Owner decisions 2026-11-04: Groups live in sessionzero.solutions (same Workspace);
 * a project's tasks = base lifecycle tab + tabs mapped from ActiveComponents + tabs named in
 * Projects.Task_Templates + Offboarding_Sunset_Archive.
 */

var DOLORES_TEMPLATE_REPO_ID = '1dMtaK5PT7UxXeeccQuk3rMmM_gu21DVZW4j5Ht0Kuto';
var DOLORES_BRIEF_TEMPLATE_ID = '117A7YKF-bb4dqt6_J2KfWro7FbQNJwK3jBwxftwa2Xs';
var DOLORES_OUTLINE_TEMPLATE_ID = '1Rbp5ZlNC-kAZOk1SoeLCrZfDB0v8kNV8RCGlFoF8iLY';
var DOLORES_BASE_TAB = 'Project_Lifecycle_Base';
var DOLORES_OFFBOARDING_TAB = 'Offboarding_Sunset_Archive';
var DOLORES_TEMPLATE_HEADERS = ['Sprint Phase', 'Task Name', 'Description & Execution Standard', 'Est. Time', 'Assignee', 'Status'];
var DOLORES_NEW_TEMPLATE_COLUMNS = ['Offset_Days', 'Duration_Days', 'Audience', 'Is_Milestone'];
var DOLORES_NOT_TASK_TABS = ['Repository_Dashboard', 'Client_Work_Log_Template'];
/** HUD service component -> template tab (E1 inventory; the rest are listed in the catalog check). */
var DOLORES_COMPONENT_TABS = {
  comp_dns_shield: 'DNS_Security_Protocols',
  comp_mcc_engine: 'MCC_Newsletter_Engine_Setup',
  comp_oracle_deepscan: 'Oracle_OSINT_Recon',
  // Catalog decision 2026-11-05 (E7): one HUD component per template tab; must match serviceRegistry.ts templateTab.
  comp_workspace_tenant: 'Workspace_Tenant_Setup',
  comp_apps_script_build: 'Custom_Apps_Script_Build',
  comp_local_seo_gbp: 'Local_SEO_and_GBP_PowerUp',
  comp_saas_debt: 'SaaS_Debt_Consolidation_Sprint',
  comp_citadel_portal: 'Digital_Citadel_Client_Portal',
  comp_indie_storefront: 'Indie_Studio_Storefront_and_Launch_Prep',
  comp_content_waterfall: 'Omnichannel_Content_Waterfall',
  comp_coms_calendar: 'COMS_Editorial_Content_Calendar',
  comp_gmail_approvals: 'Gmail_Actionable_Approval_Engine',
  comp_looker_war_room: 'Looker_Studio_Executive_War_Room',
  comp_appsheet_field_ops: 'AppSheet_Field_Ops_Mobile_App'
};
var DOLORES_NEW_PROJECT_COLUMNS = [
  { column: 'Task_Templates', dataType: 'text', impact: 'Extra template tabs (comma-separated) for this project task list.' },
  { column: 'Kickoff_Date', dataType: 'date', impact: 'Day 0 of the 45-day cadence (task due dates, Gantt axis).' },
  { column: 'Dashboard_Sheet_ID', dataType: 'id', impact: 'Client task dashboard sheet (Phase E4).' }
];
var DOLORES_GROUP_DOMAIN = 'sessionzero.solutions';
/** Projects at these SprintStage indexes get assets (02 contract) and a task list (03+); 09 is sunset. */
var DOLORES_ASSET_MIN_STAGE = 2;
var DOLORES_LIST_MIN_STAGE = 3;
var DOLORES_MAX_STAGE = 8;

/** Base lifecycle tasks (one or two per SprintStage) along the 45-day cadence. Owner reviews these. */
var DOLORES_BASE_TASKS = [
  ['00: Discovery', 'Discovery call', 'Confirm goals, constraints, budget range and decision makers.', 0, 1, 'client', false],
  ['00: Discovery', 'File discovery notes', 'Write the discovery notes into the client Meeting Notes folder.', 1, 1, 'internal', false],
  ['01: Vibecheck', 'Vibecheck call', 'Fit check: scope, working style, timeline. Decide whether to propose.', 3, 1, 'client', false],
  ['02: Contract & Inception', 'Sign MSA and SOW', 'Client reviews and signs the Master Services Agreement and SOW.', 5, 2, 'client', true],
  ['02: Contract & Inception', 'Pay deposit invoice', 'Deposit (one third) is paid; Vala marks DepositPaid.', 7, 2, 'client', false],
  ['03: Deep Intelligence', 'Complete intake vitals form', 'Client fills in the onboarding vitals check form.', 9, 2, 'client', false],
  ['03: Deep Intelligence', 'Research brief', 'Compile the research brief and Project Outline from intake data.', 10, 3, 'internal', false],
  ['04: Session Zero Kickoff', 'Session Zero kickoff call', 'Walk through the Project Brief, plan and access needs.', 14, 1, 'client', true],
  ['04: Session Zero Kickoff', 'Provide system access', 'Client grants the domain, Workspace and tool access listed in the Brief.', 15, 2, 'client', false],
  ['05: Architecture & Builds', 'Build sprint', 'Deliver the scoped builds; log hours in the work log.', 17, 10, 'internal', false],
  ['06: Mid-Flight Review', 'Mid-flight review call', 'Demo progress, confirm scope and remaining work.', 27, 1, 'client', true],
  ['06: Mid-Flight Review', 'Pay mid-flight invoice', 'Second third is paid.', 29, 2, 'client', false],
  ['07: Final Staging & QA', 'Final QA walkthrough', 'Client tests the staged deliverables and signs off QA.', 36, 3, 'client', false],
  ['08: Liftoff & Handover', 'Handover acceptance', 'Client accepts the handover dossier and credentials.', 42, 1, 'client', true],
  ['08: Liftoff & Handover', 'Pay final invoice', 'Final invoice (remainder) is paid.', 43, 2, 'client', false],
  ['09: Sunset / Retainer', 'Retainer decision', 'Client chooses a retainer or sunset.', 45, 1, 'client', false]
];

/* ---------- pure helpers ---------- */

function dolores_slug_(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

/** Stable task key: <tab>::<task-name-slug> (used for idempotent sync). */
function dolores_taskKey_(tab, taskName) { return tab + '::' + dolores_slug_(taskName); }

/** "30 min" / "60 min" / "2 hrs" -> whole working days (minimum 1). */
function dolores_estimateDays_(estimate) {
  const text = String(estimate || '').toLowerCase();
  const number = parseFloat(text) || 0;
  const hours = /min/.test(text) ? number / 60 : number;
  return Math.max(1, Math.ceil(hours / 4));
}

var DOLORES_CLIENT_HINT = /\b(walkthrough|training|guide|handover|hand-over|sign[- ]?off|delegated access|client (reviews|provides|signs|approves))\b/i;

/** Defaults for the four new columns on one template tab (rows = data rows, header excluded). */
function dolores_defaultTemplateFields_(rows) {
  const phaseNumber = function (phase) { return parseInt(String(phase).trim(), 10) || 1; };
  return rows.map(function (row, index) {
    const text = String(row[1] || '') + ' ' + String(row[2] || '');
    return {
      Offset_Days: (phaseNumber(row[0]) - 1) * 2,
      Duration_Days: dolores_estimateDays_(row[3]),
      Audience: DOLORES_CLIENT_HINT.test(text) ? 'client' : 'internal',
      Is_Milestone: index === rows.length - 1
    };
  });
}

/** Pure: ActiveComponents as IDs; accepts a comma list or a JSON array (both are written by the router). */
function dolores_componentIds_(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return [];
  if (text.charAt(0) === '[') {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(function (id) { return String(id).trim(); }).filter(Boolean);
    } catch (error) { /* fall through to the comma split */ }
  }
  return text.replace(/^\[|\]$/g, '').split(',').map(function (id) { return id.replace(/["']/g, '').trim(); }).filter(Boolean);
}

/** Which template tabs a project uses (owner decision: combination). */
function dolores_projectTabs_(project, availableTabs) {
  const tabs = [DOLORES_BASE_TAB];
  dolores_componentIds_(project.ActiveComponents).forEach(function (id) {
    if (DOLORES_COMPONENT_TABS[id]) tabs.push(DOLORES_COMPONENT_TABS[id]);
  });
  String(project.Task_Templates || '').split(',').map(function (tab) { return tab.trim(); }).forEach(function (tab) {
    if (tab) tabs.push(tab);
  });
  tabs.push(DOLORES_OFFBOARDING_TAB);
  const unique = tabs.filter(function (tab, index) { return tabs.indexOf(tab) === index; });
  return {
    tabs: unique.filter(function (tab) { return availableTabs.indexOf(tab) !== -1; }),
    unknown: unique.filter(function (tab) { return availableTabs.indexOf(tab) === -1; })
  };
}

function dolores_isoDate_(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function dolores_addDays_(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + Number(days || 0));
  return next;
}

/** Notes block: Audience / Start / Key lines first (section 3 Tasks conventions), then the description. */
function dolores_taskNotes_(audience, start, key, description) {
  return 'Audience: ' + (audience === 'client' ? 'client' : 'internal') + '\nStart: ' + dolores_isoDate_(start)
    + '\nKey: ' + key + (description ? '\n\n' + description : '');
}

/** Reads a key back out of task notes (null when absent). */
function dolores_noteKey_(notes) {
  const match = String(notes || '').match(/^Key:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Pure: the task plan for a project. templates = [{ tab, title, tasks: [{ name, description, offset, duration, audience, milestone }] }].
 * Returns [{ parent: { title, key }, children: [{ title, notes, due, key, milestone, audience }] }].
 */
function dolores_buildTaskPlan_(templates, kickoff) {
  return templates.map(function (template, templateIndex) {
    // Component and extra tabs run in parallel after kickoff; offboarding starts at day 45.
    const base = template.tab === DOLORES_OFFBOARDING_TAB ? 45 : (template.tab === DOLORES_BASE_TAB ? 0 : 17);
    return {
      parent: { title: template.title, key: dolores_taskKey_(template.tab, '__parent__') },
      children: template.tasks.map(function (task) {
        const start = dolores_addDays_(kickoff, base + Number(task.offset || 0));
        const due = dolores_addDays_(start, Math.max(0, Number(task.duration || 1) - 1));
        const key = dolores_taskKey_(template.tab, task.name);
        return {
          title: task.name, key: key, due: due, start: start, milestone: task.milestone === true, audience: task.audience,
          notes: dolores_taskNotes_(task.audience, start, key, task.description)
        };
      })
    };
  });
}

/** Pure: what a project still needs before its task list can be created (Plan E3). */
function dolores_listReadiness_(project) {
  const missing = [];
  ['Project_Brief_DocID', 'Project_Outline_DocID', 'ChatSpaceURL', 'ChatSpace_Internal_URL', 'AssignedRateTier'].forEach(function (name) {
    if (!String(project[name] || '').trim()) missing.push(name);
  });
  return missing;
}

/** Pure: names for project assets (section 3 naming). */
function dolores_assetNames_(clientId, projectName) {
  const project = String(projectName || 'Project').trim();
  return {
    brief: clientId + ' - ' + project + ' - Project Brief',
    outline: clientId + ' - ' + project + ' - Project Outline',
    clientSpace: clientId + ' - ' + project + ' - Client',
    internalSpace: clientId + ' - ' + project + ' - Internal',
    projectFolder: clientId + ' - ' + project,
    dashboard: clientId + ' - ' + project + ' - Command Deck'
  };
}

function dolores_groupEmail_(clientId) { return 'client-' + String(clientId).toLowerCase() + '@' + DOLORES_GROUP_DOMAIN; }

/** Chat Space resource name -> web URL, and back. */
function dolores_spaceUrl_(spaceName) { return 'https://mail.google.com/chat/u/0/#chat/space/' + String(spaceName).replace(/^spaces\//, ''); }
function dolores_spaceName_(url) {
  const match = String(url || '').match(/(?:space\/|spaces\/)([A-Za-z0-9_-]{6,})/);
  return match ? 'spaces/' + match[1] : null;
}

/* ---------- E2: template repository ---------- */

/** Adds the 4 columns to each task tab (defaults only where blank) and creates the base lifecycle tab. Idempotent. */
function dolores_setupTemplateRepository_(dryRun) {
  const repo = SpreadsheetApp.openById(DOLORES_TEMPLATE_REPO_ID);
  const report = { tabs: [], base: null };
  repo.getSheets().forEach(function (sheet) {
    const tab = sheet.getName();
    if (DOLORES_NOT_TASK_TABS.indexOf(tab) !== -1) return;
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow < 2) return;
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (h) { return String(h).trim(); });
    if (DOLORES_TEMPLATE_HEADERS.some(function (h, i) { return headers[i] !== h; })) {
      report.tabs.push({ tab: tab, skipped: 'unexpected header row' });
      return;
    }
    const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    const defaults = dolores_defaultTemplateFields_(rows);
    const columns = DOLORES_NEW_TEMPLATE_COLUMNS.map(function (name) {
      let index = headers.indexOf(name);
      if (index === -1) { index = headers.length; headers.push(name); if (!dryRun) sheet.getRange(1, index + 1).setValue(name).setFontWeight('bold'); }
      return index;
    });
    let filled = 0;
    const existing = sheet.getRange(2, 1, lastRow - 1, Math.max(headers.length, lastColumn)).getValues();
    rows.forEach(function (row, r) {
      DOLORES_NEW_TEMPLATE_COLUMNS.forEach(function (name, c) {
        const current = existing[r][columns[c]];
        if (current !== '' && current !== null && current !== undefined) return;
        filled += 1;
        if (!dryRun) sheet.getRange(r + 2, columns[c] + 1).setValue(defaults[r][name]);
      });
    });
    report.tabs.push({
      tab: tab, tasks: rows.length, cellsFilled: filled,
      review: rows.map(function (row, r) {
        return [String(row[1]), defaults[r].Offset_Days, defaults[r].Duration_Days, defaults[r].Audience, defaults[r].Is_Milestone].join(' | ');
      })
    });
  });
  let base = repo.getSheetByName(DOLORES_BASE_TAB);
  if (!base) {
    report.base = { created: !dryRun, tasks: DOLORES_BASE_TASKS.length };
    if (!dryRun) {
      base = repo.insertSheet(DOLORES_BASE_TAB);
      const header = DOLORES_TEMPLATE_HEADERS.concat(DOLORES_NEW_TEMPLATE_COLUMNS);
      const values = DOLORES_BASE_TASKS.map(function (t) { return [t[0], t[1], t[2], t[4] + ' day', 'Dolores', '[ ]', t[3], t[4], t[5], t[6]]; });
      base.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
      base.getRange(2, 1, values.length, header.length).setValues(values);
      base.setFrozenRows(1);
    }
  } else {
    report.base = { created: false, exists: true };
  }
  return report;
}

/** Reads template tabs into { tab, title, tasks } (title = tab name with spaces). */
function dolores_readTemplates_(repo, tabs) {
  return tabs.map(function (tab) {
    const sheet = repo.getSheetByName(tab);
    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(function (h) { return String(h).trim(); });
    const col = function (name) { return headers.indexOf(name); };
    const tasks = values.slice(1).filter(function (row) { return String(row[col('Task Name')] || '').trim(); }).map(function (row) {
      return {
        name: String(row[col('Task Name')]).trim(),
        description: String(row[col('Description & Execution Standard')] || '').trim(),
        offset: col('Offset_Days') === -1 ? 0 : Number(row[col('Offset_Days')] || 0),
        duration: col('Duration_Days') === -1 ? 1 : Number(row[col('Duration_Days')] || 1),
        audience: col('Audience') === -1 ? 'internal' : String(row[col('Audience')] || 'internal').trim().toLowerCase(),
        milestone: col('Is_Milestone') !== -1 && (row[col('Is_Milestone')] === true || String(row[col('Is_Milestone')]).toUpperCase() === 'TRUE')
      };
    });
    return { tab: tab, title: tab.replace(/_/g, ' '), tasks: tasks };
  });
}

/* ---------- E3: per-project assets and task list ---------- */

/** Owner entry points. */
function runPhaseESetupDryRun() { return dolores_report_(dolores_setup_(true)); }
function runPhaseESetup() { return dolores_report_(dolores_setup_(false)); }
function runPhaseEAutomationDryRun() { return dolores_report_(dolores_runProjectAutomation_({ dryRun: true })); }

function dolores_report_(report) {
  const text = JSON.stringify(report, null, 1);
  for (let i = 0; i < text.length; i += 7000) console.log(text.slice(i, i + 7000));
  return report;
}

function dolores_setup_(dryRun) {
  const report = { dryRun: dryRun };
  try {
    const spreadsheet = hud_assertWorkingCopy_();
    const actor = getAuthorizedMasterControlUser_();
    report.templateRepository = dolores_setupTemplateRepository_(dryRun);
    if (!dryRun) {
      report.projectColumns = dolores_ensureProjectColumns_(spreadsheet, actor);
    }
    report.ok = true;
  } catch (error) {
    report.ok = false;
    report.error = String(error && error.message || error);
  }
  return report;
}

function dolores_ensureProjectColumns_(spreadsheet, actor) {
  const sheet = hud_requireSheet_(spreadsheet, 'Projects');
  const added = [];
  DOLORES_NEW_PROJECT_COLUMNS.forEach(function (definition) {
    const headers = hud_getHeaders_(sheet);
    let index = headers.indexOf(definition.column);
    if (index === -1) {
      index = headers.length;
      if (sheet.getMaxColumns() < index + 1) sheet.insertColumnAfter(sheet.getMaxColumns());
      sheet.getRange(1, index + 1).setValue(definition.column);
      added.push(definition.column);
    }
    hud_registerSchemaColumn_(spreadsheet, actor, {
      tab: 'Projects', column: definition.column, columnLetter: colLetter_(index + 1), dataType: definition.dataType,
      allowedValues: '*', required: 'no', changeType: 'Add column', impact: definition.impact,
      reason: 'Add Projects.' + definition.column + ' for Plan v3.1 Phase E.'
    });
  });
  return added;
}

/** Runs asset + list automation over projects. opts: { only: [ProjectID], extraMembers: { ClientID: [emails] }, dryRun }. */
function dolores_runProjectAutomation_(opts) {
  opts = opts || {};
  const report = { dryRun: Boolean(opts.dryRun), projects: [] };
  try {
    const spreadsheet = hud_assertWorkingCopy_();
    const projectsSheet = hud_requireSheet_(spreadsheet, 'Projects');
    const clientsSheet = hud_requireSheet_(spreadsheet, 'Clients');
    const repo = SpreadsheetApp.openById(DOLORES_TEMPLATE_REPO_ID);
    const availableTabs = repo.getSheets().map(function (sheet) { return sheet.getName(); });
    const projects = vala_readRecords_(projectsSheet, ['ProjectID']).rows;
    projects.forEach(function (project) {
      const projectId = String(project.ProjectID).trim();
      if (opts.only && opts.only.indexOf(projectId) === -1) return;
      const stage = HUD_WRITE_SPRINT_STAGES.indexOf(String(project.SprintStage).trim());
      const entry = { projectId: projectId, stage: stage, actions: [], errors: [] };
      report.projects.push(entry);
      if (stage < DOLORES_ASSET_MIN_STAGE || stage > DOLORES_MAX_STAGE) { entry.skipped = 'stage outside 02-08'; return; }
      const client = hud_findUniqueRecord_(clientsSheet, 'ClientID', String(project.ClientID).trim());
      const step = function (name, fn) {
        try { const result = fn(); if (result) entry.actions.push(name + ': ' + result); }
        catch (error) { entry.errors.push(name + ': ' + String(error && error.message || error)); }
      };
      step('group', function () { return dolores_ensureGroup_(clientsSheet, client, (opts.extraMembers || {})[client.record.ClientID] || [], opts.dryRun); });
      step('docs', function () { return dolores_ensureDocs_(projectsSheet, project, client.record, opts.dryRun); });
      step('chat', function () { return dolores_ensureSpaces_(projectsSheet, clientsSheet, project, client, opts.dryRun); });
      if (stage >= DOLORES_LIST_MIN_STAGE) {
        step('tasks', function () {
          const fresh = hud_findUniqueRecord_(projectsSheet, 'ProjectID', projectId).record;
          return dolores_ensureTaskList_(projectsSheet, fresh, repo, availableTabs, opts.dryRun);
        });
        step('dashboard', function () {
          const fresh = hud_findUniqueRecord_(projectsSheet, 'ProjectID', projectId).record;
          const freshClient = hud_findUniqueRecord_(clientsSheet, 'ClientID', String(project.ClientID).trim());
          return dashboard_ensure_(projectsSheet, fresh, freshClient, opts.dryRun);
        });
      }
    });
    report.ok = report.projects.every(function (p) { return !p.errors.length; });
  } catch (error) {
    report.ok = false;
    report.error = String(error && error.message || error);
  }
  return report;
}

function dolores_setProjectCell_(sheet, projectId, column, value) {
  const record = hud_findUniqueRecord_(sheet, 'ProjectID', projectId);
  sheet.getRange(record.rowNumber, hud_requireColumn_(record.headers, column) + 1).setValue(value);
}

/** Google Group client-<id>@sessionzero.solutions with the client contact (and test extras) as members. */
function dolores_ensureGroup_(clientsSheet, client, extraMembers, dryRun) {
  const record = client.record;
  const email = String(record.GoogleGroupEmail || '').trim() || dolores_groupEmail_(record.ClientID);
  if (dryRun) return 'would ensure ' + email + ' with members ' + [record.ContactEmail].concat(extraMembers).filter(Boolean).join(', ');
  let created = false;
  try {
    AdminDirectory.Groups.get(email);
  } catch (error) {
    AdminDirectory.Groups.insert({ email: email, name: String(record.Company_Name) + ' (client)', description: 'SZS client group for ' + record.ClientID });
    created = true;
  }
  // A new group takes a few seconds to become addressable; retry "not found" before giving up.
  dolores_retryNotFound_(function () {
    AdminGroupsSettings.Groups.patch({ allowExternalMembers: 'true', whoCanJoin: 'INVITED_CAN_JOIN' }, email);
  });
  const added = [];
  [record.ContactEmail].concat(extraMembers).filter(Boolean).forEach(function (member) {
    try {
      dolores_retryNotFound_(function () { AdminDirectory.Members.insert({ email: String(member).trim().toLowerCase(), role: 'MEMBER' }, email); });
      added.push(member);
    } catch (error) { if (!/duplicate|already exists|Member already/i.test(String(error && error.message))) throw error; }
  });
  if (!String(record.GoogleGroupEmail || '').trim()) {
    clientsSheet.getRange(client.rowNumber, hud_requireColumn_(client.headers, 'GoogleGroupEmail') + 1).setValue(email);
  }
  return (created ? 'created ' : 'exists ') + email + (added.length ? '; added ' + added.join(', ') : '');
}

/** Runs fn, retrying up to 6 times (5s apart) while Google reports the resource as not found yet. */
function dolores_retryNotFound_(fn) {
  for (let attempt = 1; ; attempt++) {
    try { return fn(); }
    catch (error) {
      if (attempt >= 6 || !/not found|notFound|404/i.test(String(error && error.message))) throw error;
      Utilities.sleep(5000);
    }
  }
}

/** Project folder inside the client root (find or create). */
function dolores_projectFolder_(clientRecord, names) {
  const match = String(clientRecord.DriveFolderUrl || '').match(/\/folders\/([A-Za-z0-9_-]{10,})/);
  if (!match) throw new Error('client has no Drive folder (DriveFolderUrl)');
  const root = DriveApp.getFolderById(match[1]);
  const existing = root.getFoldersByName(names.projectFolder);
  return existing.hasNext() ? existing.next() : root.createFolder(names.projectFolder);
}

/** Brief and Outline copies, with {{...}} tags filled from Master Control (unknown tags stay visible). */
function dolores_ensureDocs_(projectsSheet, project, clientRecord, dryRun) {
  const names = dolores_assetNames_(clientRecord.ClientID, project.ProjectName);
  const todo = [];
  if (!String(project.Project_Brief_DocID || '').trim()) todo.push(['Project_Brief_DocID', DOLORES_BRIEF_TEMPLATE_ID, names.brief]);
  if (!String(project.Project_Outline_DocID || '').trim()) todo.push(['Project_Outline_DocID', DOLORES_OUTLINE_TEMPLATE_ID, names.outline]);
  if (!todo.length) return '';
  if (dryRun) return 'would create ' + todo.map(function (t) { return t[2]; }).join(' and ');
  const folder = dolores_projectFolder_(clientRecord, names);
  const tags = {
    '{{ProjectName}}': project.ProjectName, '{{ProjectID}}': project.ProjectID, '{{ClientID}}': clientRecord.ClientID,
    '{{Client_First_Name}}': clientRecord.First_Name, '{{Client_Last_Name}}': clientRecord.Last_Name,
    '{{ContactEmail}}': clientRecord.ContactEmail, '{{DriveFolderUrl}}': clientRecord.DriveFolderUrl,
    '{{SOW_DocUrl}}': project.SOW_DocID && String(project.SOW_DocID).indexOf('TEST-PLACEHOLDER') !== 0 ? 'https://docs.google.com/document/d/' + project.SOW_DocID + '/edit' : '',
    '{{MeetingNotes_DriveFolderUrl}}': project.MeetingNotes_DriveFolderID ? 'https://drive.google.com/drive/folders/' + project.MeetingNotes_DriveFolderID : '',
    '{{ProjectManager}}': 'Drake', '{{Industry_Track}}': clientRecord.Archetype, '{{Stakeholder_Group}}': clientRecord.GoogleGroupEmail
  };
  return todo.map(function (item) {
    const copy = DriveApp.getFileById(item[1]).makeCopy(item[2], folder);
    populateDocPlaceholders_(copy.getId(), tags);
    dolores_setProjectCell_(projectsSheet, project.ProjectID, item[0], copy.getId());
    return item[2];
  }).join(', ');
}

/** Internal and client Chat Spaces; the client space admits external users and gets the client Group as a member. */
function dolores_ensureSpaces_(projectsSheet, clientsSheet, project, client, dryRun) {
  const names = dolores_assetNames_(client.record.ClientID, project.ProjectName);
  const todo = [];
  if (!String(project.ChatSpace_Internal_URL || '').trim()) todo.push(['ChatSpace_Internal_URL', names.internalSpace, false]);
  if (!String(project.ChatSpaceURL || '').trim()) todo.push(['ChatSpaceURL', names.clientSpace, true]);
  if (!todo.length) return '';
  if (dryRun) return 'would create spaces ' + todo.map(function (t) { return t[1]; }).join(' and ');
  return todo.map(function (item) {
    const space = Chat.Spaces.create({ displayName: item[1], spaceType: 'SPACE', externalUserAllowed: item[2] });
    if (item[2]) {
      const groupEmail = String(client.record.GoogleGroupEmail || '').trim() || dolores_groupEmail_(client.record.ClientID);
      const group = dolores_retryNotFound_(function () { return AdminDirectory.Groups.get(groupEmail); });
      Chat.Spaces.Members.create({ groupMember: { name: 'groups/' + group.id } }, space.name);
    }
    const url = dolores_spaceUrl_(space.name);
    dolores_setProjectCell_(projectsSheet, project.ProjectID, item[0], url);
    if (item[2] && !String(client.record.ChatSpaceUrl || '').trim()) {
      clientsSheet.getRange(client.rowNumber, hud_requireColumn_(client.headers, 'ChatSpaceUrl') + 1).setValue(url);
    }
    return item[1] + ' (' + space.name + ')';
  }).join(', ');
}

/** Creates the task list when the project is ready; "sync missing" adds only tasks whose Key is absent. */
function dolores_ensureTaskList_(projectsSheet, project, repo, availableTabs, dryRun) {
  const missing = dolores_listReadiness_(project);
  if (missing.length) return 'not ready (missing ' + missing.join(', ') + ')';
  const selection = dolores_projectTabs_(project, availableTabs);
  const kickoff = project.Kickoff_Date instanceof Date ? project.Kickoff_Date : new Date();
  const plan = dolores_buildTaskPlan_(dolores_readTemplates_(repo, selection.tabs), kickoff);
  const total = plan.reduce(function (sum, group) { return sum + group.children.length; }, 0);
  if (dryRun) return 'would create list ' + project.ProjectID + ' with ' + total + ' tasks from ' + selection.tabs.join(', ') + (selection.unknown.length ? ' (unknown tabs: ' + selection.unknown.join(', ') + ')' : '');
  let listId = String(project.Google_Tasklist_ID || '').trim();
  let created = false;
  if (!listId) {
    listId = Tasks.Tasklists.insert({ title: String(project.ProjectID) }).id;
    dolores_setProjectCell_(projectsSheet, project.ProjectID, 'Google_Tasklist_ID', listId);
    if (!(project.Kickoff_Date instanceof Date)) dolores_setProjectCell_(projectsSheet, project.ProjectID, 'Kickoff_Date', kickoff);
    created = true;
  }
  const existing = dolores_listTasks_(listId);
  const haveKeys = {};
  existing.forEach(function (task) { const key = dolores_noteKey_(task.notes); if (key) haveKeys[key] = task.id; });
  let added = 0;
  plan.forEach(function (group) {
    let parentId = haveKeys[group.parent.key];
    if (!parentId) {
      parentId = Tasks.Tasks.insert({ title: group.parent.title, notes: 'Audience: internal\nKey: ' + group.parent.key }, listId).id;
      added += 1;
    }
    group.children.forEach(function (child) {
      if (haveKeys[child.key]) return;
      Tasks.Tasks.insert({ title: child.title, notes: child.notes, due: child.due.toISOString() }, listId, { parent: parentId });
      added += 1;
    });
  });
  return (created ? 'created list ' : 'synced list ') + listId + '; added ' + added + ' tasks' + (selection.unknown.length ? '; unknown tabs ' + selection.unknown.join(', ') : '');
}

function dolores_listTasks_(listId) {
  const out = [];
  let pageToken;
  do {
    const page = Tasks.Tasks.list(listId, { maxResults: 100, showCompleted: true, showHidden: true, pageToken: pageToken });
    (page.items || []).forEach(function (task) { out.push(task); });
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

/**
 * After a Solar component attach: add the component's tab tasks to the project's existing list (missing Keys only).
 * A project without a list is left alone; its list picks the tab up when it is created (stage 03+).
 */
function dolores_syncAfterAttach_(projectsSheet, projectId) {
  const project = hud_findUniqueRecord_(projectsSheet, 'ProjectID', projectId).record;
  if (!String(project.Google_Tasklist_ID || '').trim()) return { added: 0, message: projectId + ' has no task list yet; tasks are added when it is created.' };
  const repo = SpreadsheetApp.openById(DOLORES_TEMPLATE_REPO_ID);
  const message = dolores_ensureTaskList_(projectsSheet, project, repo, repo.getSheets().map(function (s) { return s.getName(); }), false);
  const match = String(message).match(/added (\d+) tasks/);
  return { added: match ? Number(match[1]) : 0, message: String(message) };
}

/** Owner action: add only the tasks whose Key is missing (e.g. after editing templates). */
function syncMissingTasks(projectId) {
  const spreadsheet = hud_assertWorkingCopy_();
  const projectsSheet = hud_requireSheet_(spreadsheet, 'Projects');
  const repo = SpreadsheetApp.openById(DOLORES_TEMPLATE_REPO_ID);
  const project = hud_findUniqueRecord_(projectsSheet, 'ProjectID', String(projectId)).record;
  return dolores_report_({ projectId: projectId, result: dolores_ensureTaskList_(projectsSheet, project, repo, repo.getSheets().map(function (s) { return s.getName(); }), false) });
}
