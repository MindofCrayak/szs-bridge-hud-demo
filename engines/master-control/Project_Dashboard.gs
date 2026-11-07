/**
 * Phase E4 (Master Plan v3.1): the client Command Deck, one per project.
 * Owner decision 2026-11-05: the client task dashboard lives inside the owner's Command Deck template
 * (MASTER - SZS - Client_Command_Deck Template); the template itself is never edited, each project gets a copy
 * "<ClientID> - <Project Name> - Command Deck" in its project folder, shared with the client Group.
 *
 * The copy is realigned to Master Control:
 *  - System_Data_SSOT (label in column A, value in column B) is filled from Clients, Projects, Finances and the
 *    project's Tasks list by label, every 5 minutes. Legacy phase/stage dropdowns are replaced by the MC lists.
 *  - The deliverable launchpad links point at the SSOT URLs; sample tickets and retention rows are cleared.
 *  - A Project_Tasks tab holds the client-audience tasks: Title | Due | Notes | Done | TaskID (hidden) | Synced (hidden).
 *  - Every tab is protected; the client can edit only Project_Tasks Done.
 *
 * Task sync is state-based, which is also the loop guard: the hidden Synced column holds the Done value both sides
 * last agreed on. A sheet value that differs from Synced was changed in the sheet (push to Tasks); otherwise a
 * task status that differs from Synced was changed in Tasks (pull into the sheet). Script writes never fire
 * onEdit, and a just-ticked box is never overwritten because the sheet side wins.
 */

var COMMAND_DECK_TEMPLATE_ID = '1Jnb8ZPCGBEBYiZutG2io8SL3GPkNUS93SBm0YxrhFtY';
var DECK_MAIN_TAB = 'Client_Command_Deck';
var DECK_SSOT_TAB = 'System_Data_SSOT';
var DASHBOARD_TAB = 'Project_Tasks';
var DASHBOARD_HEADERS = ['Title', 'Due', 'Notes', 'Done', 'TaskID', 'Synced'];
var DASHBOARD_DONE_COLUMN = 4;
var DASHBOARD_MAX_ROWS = 500;
var DASHBOARD_EDIT_HANDLER = 'dashboard_onEdit';
var DASHBOARD_SYNC_HANDLER = 'dashboard_scheduledSync';
/** Apps Script allows 20 triggers per user per script; keep headroom for the Phase D triggers. */
var DASHBOARD_TRIGGER_BUDGET = 18;
/** Launchpad rows on the deck tab (matched by their title in column B) -> SSOT label holding the URL. */
var DECK_LAUNCHPAD = [
  { match: /Master Services Agreement/i, label: 'MSA_DocID', linkText: 'Open Doc ↗' },
  { match: /Statement of Work/i, label: 'SOW_DocID', linkText: 'Open Doc ↗' },
  { match: /Operational Brief|Project Brief/i, label: 'Project_Brief_DocID', linkText: 'Open Brief ↗' },
  { match: /Project Charter|Project Outline/i, label: 'Project_Outline_DocID', linkText: 'Open Outline ↗', title: 'Project Outline' },
  { match: /SaaS Debt/i, label: 'SaaSDebtTracker_SheetID', linkText: 'Launch Sheet ↗' },
  { match: /Sourcebook/i, label: 'Sourcebook_Deck_URL', linkText: 'View Slides ↗' },
  { match: /Content Operating System|COMS/i, label: 'COMS_Sheet_URL', linkText: 'Launch OS ↗' },
  { match: /Video|Walkthrough Archive/i, label: 'VideoArchive_FolderURL', linkText: 'Open Vault ↗' }
];
var DECK_RENAMED_LABELS = { RootDriveFolderID: 'RootDriveFolderUrl' };
var DECK_HANDOVER_KEY = 'Project_Lifecycle_Base::handover-acceptance';

/* ---------- pure helpers ---------- */

function dashboard_audience_(notes) {
  const match = String(notes || '').match(/^Audience:\s*(\w+)/m);
  return match ? match[1].toLowerCase() : 'internal';
}

/** Task notes without the Audience/Start/Key header block. */
function dashboard_description_(notes) {
  const text = String(notes || '');
  const split = text.indexOf('\n\n');
  return split === -1 ? (/^(Audience|Start|Key):/m.test(text) ? '' : text) : text.slice(split + 2).trim();
}

/** Client-audience child tasks (parents are skipped), sorted by due date then title. */
function dashboard_clientTasks_(tasks) {
  return (tasks || [])
    .filter(function (task) { return task.parent && dashboard_audience_(task.notes) === 'client' && !task.deleted; })
    .map(function (task) {
      return {
        id: task.id, title: String(task.title || ''), due: String(task.due || '').slice(0, 10),
        notes: dashboard_description_(task.notes), done: task.status === 'completed'
      };
    })
    .sort(function (a, b) { return a.due === b.due ? a.title.localeCompare(b.title) : (a.due < b.due ? -1 : 1); });
}

function dashboard_row_(task) { return [task.title, task.due, task.notes, task.done, task.id, task.done]; }

/** 'push' (sheet changed -> Tasks), 'pull' (Tasks changed -> sheet) or 'none'. */
function dashboard_reconcile_(sheetDone, synced, taskDone) {
  if (sheetDone !== synced) return 'push';
  if (taskDone !== synced) return 'pull';
  return 'none';
}

/**
 * Pure sync plan. sheetRows = [[Title, Due, Notes, Done, TaskID, Synced], ...] (data rows only).
 * Returns { push: [{ row, taskId, done }], pull: [{ row, done }], append: [row values], orphaned: [taskId] }.
 * row is the 0-based data-row index.
 */
function dashboard_syncPlan_(sheetRows, tasks) {
  const byId = {};
  dashboard_clientTasks_(tasks).forEach(function (task) { byId[task.id] = task; });
  const seen = {};
  const plan = { push: [], pull: [], append: [], orphaned: [] };
  (sheetRows || []).forEach(function (row, index) {
    const taskId = String(row[4] || '').trim();
    if (!taskId) return;
    seen[taskId] = true;
    const task = byId[taskId];
    if (!task) { plan.orphaned.push(taskId); return; }
    const sheetDone = row[3] === true;
    const synced = row[5] === true;
    const action = dashboard_reconcile_(sheetDone, synced, task.done);
    if (action === 'push') plan.push.push({ row: index, taskId: taskId, done: sheetDone });
    if (action === 'pull') plan.pull.push({ row: index, done: task.done });
  });
  Object.keys(byId).forEach(function (id) { if (!seen[id]) plan.append.push(dashboard_row_(byId[id])); });
  return plan;
}

function deck_text_(value) { return String(value == null ? '' : value).trim(); }

/** A Master Control ID or URL -> openable URL ('' for blanks and seed placeholders). */
function deck_url_(value, kind) {
  const text = deck_text_(value);
  if (!text || text.indexOf('TEST-PLACEHOLDER') === 0) return '';
  if (/^https?:\/\//i.test(text)) return text;
  if (kind === 'folder') return 'https://drive.google.com/drive/folders/' + text;
  if (kind === 'sheet') return 'https://docs.google.com/spreadsheets/d/' + text + '/edit';
  return 'https://docs.google.com/document/d/' + text + '/edit';
}

function deck_date_(value) {
  if (value instanceof Date) return value;
  const text = deck_text_(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? new Date(text.slice(0, 10) + 'T12:00:00') : null;
}

/**
 * Pure: SSOT label -> value, plus the retention row (L2:P2), from Master Control records.
 * input = { client, project, contract, invoices, tasks, milestoneKeys, tickets }
 *   tickets = SSOT D:J rows [Ticket_ID, Timestamp, Category, Description, Priority, Status, Resolution_Notes]
 */
function deck_ssotValues_(input) {
  const client = input.client || {};
  const project = input.project || {};
  const contract = input.contract || {};
  const invoices = (input.invoices || []).slice().sort(function (a, b) {
    return VALA_MILESTONES.indexOf(deck_text_(a.MilestoneStage)) - VALA_MILESTONES.indexOf(deck_text_(b.MilestoneStage));
  });
  const keys = input.milestoneKeys || {};
  const milestones = (input.tasks || [])
    .filter(function (task) { return task.parent && keys[dolores_noteKey_(task.notes)]; })
    .sort(function (a, b) { return String(a.due || '') < String(b.due || '') ? -1 : 1; });
  const completed = milestones.filter(function (task) { return task.status === 'completed'; }).length;
  const current = milestones.filter(function (task) { return task.status !== 'completed'; })[0];
  const openRoadblock = (input.tickets || []).filter(function (t) {
    return deck_text_(t[2]) === 'Roadblock' && ['Closed', 'Resolved'].indexOf(deck_text_(t[5])) === -1 && deck_text_(t[3]);
  })[0];
  const issued = invoices.filter(function (row) { return VALA_ISSUED_STATUSES.indexOf(deck_text_(row.InvoiceStatus)) !== -1; });
  const deposit = invoices.filter(function (row) { return deck_text_(row.MilestoneStage) === VALA_MILESTONES[0]; })[0];
  const stage = deck_text_(project.SprintStage);
  const sunset = HUD_WRITE_SPRINT_STAGES.indexOf(stage) >= 9;
  const handoverTask = (input.tasks || []).filter(function (task) { return dolores_noteKey_(task.notes) === DECK_HANDOVER_KEY; })[0];
  const kickoff = deck_date_(project.Kickoff_Date);
  const handover = handoverTask && handoverTask.due ? deck_date_(handoverTask.due) : (kickoff ? dolores_addDays_(kickoff, 42) : '');
  const tcv = Number(contract.TotalContractValue || 0);
  const labels = {
    ClientID: deck_text_(client.ClientID),
    Company_Name: deck_text_(client.Company_Name),
    PrimaryContact: [deck_text_(client.First_Name), deck_text_(client.Last_Name)].filter(Boolean).join(' '),
    ContactEmail: deck_text_(client.ContactEmail),
    GoogleGroupEmail: deck_text_(client.GoogleGroupEmail) || dolores_groupEmail_(client.ClientID),
    AccountPhase: deck_text_(client.AccountPhase),
    SprintStage: stage,
    ActiveRoadblock: openRoadblock ? deck_text_(openRoadblock[3]) : 'None',
    RootDriveFolderUrl: deck_url_(client.DriveFolderUrl, 'folder'),
    ChatSpaceUrl: deck_text_(project.ChatSpaceURL) || deck_text_(client.ChatSpaceUrl),
    NotesDocUrl: deck_url_(client.NotesDocUrl, 'doc'),
    GoogleGroupAccess: sunset ? 'Read-only (sunset)' : 'Active (tick tasks in Project_Tasks)',
    ProjectID: deck_text_(project.ProjectID),
    ProjectName: deck_text_(project.ProjectName),
    CurrentMilestone: current ? deck_text_(current.title) : (milestones.length ? 'All milestones delivered' : 'Not scheduled yet'),
    CompletedMilestones: completed,
    TotalMilestones: milestones.length,
    ContractValue: tcv,
    DepositPaid: Boolean(deposit && (deposit.DepositPaid === true || deck_text_(deposit.InvoiceStatus) === 'Paid')),
    RemainingBalance: deck_text_(contract.Remaining_Balance) === '' ? tcv : Number(contract.Remaining_Balance),
    InvoiceStatus: issued.length ? deck_text_(issued[issued.length - 1].InvoiceStatus) : 'Not issued',
    MSA_DocID: deck_url_(client.MSA_DocID, 'doc'),
    SOW_DocID: deck_url_(project.SOW_DocID, 'doc'),
    Project_Brief_DocID: deck_url_(project.Project_Brief_DocID, 'doc'),
    Project_Outline_DocID: deck_url_(project.Project_Outline_DocID, 'doc'),
    COMS_Sheet_URL: deck_url_(project.COMS_Sheet_URL, 'sheet'),
    VideoArchive_FolderURL: deck_url_(project.MeetingNotes_DriveFolderID, 'folder')
  };
  const retention = [handover || '', sunset ? 'Vault Archive' : 'Active Sanctum', sunset, 'Day 30',
    handover ? dolores_addDays_(handover, 30) : ''];
  return { labels: labels, retention: retention };
}

/** Pure: which SSOT rows to write. column A labels (as read) -> [{ row (1-based), value }]; formula rows are skipped. */
function deck_ssotWrites_(columnA, formulasB, labels) {
  const writes = [];
  columnA.forEach(function (label, index) {
    const name = DECK_RENAMED_LABELS[deck_text_(label)] || deck_text_(label);
    if (!Object.prototype.hasOwnProperty.call(labels, name)) return;
    if (deck_text_(formulasB[index])) return;
    writes.push({ row: index + 1, value: labels[name] });
  });
  return writes;
}

/* ---------- live: creation ---------- */

/** Creates the deck for a project with a task list (skips when Dashboard_Sheet_ID is filled). */
function dashboard_ensure_(projectsSheet, project, client, dryRun) {
  const listId = deck_text_(project.Google_Tasklist_ID);
  if (!listId) return 'not ready (no task list yet)';
  if (deck_text_(project.Dashboard_Sheet_ID)) return '';
  const names = dolores_assetNames_(client.record.ClientID, project.ProjectName);
  const groupEmail = deck_text_(client.record.GoogleGroupEmail) || dolores_groupEmail_(client.record.ClientID);
  if (dryRun) return 'would copy the Command Deck template to ' + names.dashboard + ' shared with ' + groupEmail;

  const file = DriveApp.getFileById(COMMAND_DECK_TEMPLATE_ID).makeCopy(names.dashboard, dolores_projectFolder_(client.record, names));
  const deck = SpreadsheetApp.openById(file.getId());
  deck_realign_(deck);
  const tasks = dashboard_clientTasks_(dolores_listTasks_(listId));
  dashboard_layout_(deck, tasks.map(dashboard_row_));
  dolores_setProjectCell_(projectsSheet, project.ProjectID, 'Dashboard_Sheet_ID', file.getId());
  const refreshed = deck_refresh_({ projectId: deck_text_(project.ProjectID), listId: listId, dashboardId: file.getId() });
  deck_protect_(deck);
  const shared = dashboard_share_(file.getId(), groupEmail);
  const triggers = dashboard_ensureTriggers_(file.getId());
  return 'created ' + names.dashboard + ' (' + file.getId() + ') with ' + tasks.length + ' client tasks and '
    + refreshed.fields + ' SSOT fields; shared with ' + shared + '; ' + triggers;
}

/** One-time changes to a fresh copy so it reads from Master Control (the template is untouched). */
function deck_realign_(deck) {
  const ssot = deck.getSheetByName(DECK_SSOT_TAB);
  const main = deck.getSheetByName(DECK_MAIN_TAB);
  if (!ssot || !main) throw new Error('Command Deck template is missing ' + DECK_MAIN_TAB + ' or ' + DECK_SSOT_TAB);
  const lastRow = Math.max(ssot.getLastRow(), 2);
  // Labels: RootDriveFolderID holds a URL in this deck (it feeds HYPERLINK), so it is renamed to say so.
  const labels = ssot.getRange(1, 1, lastRow, 1).getValues();
  labels.forEach(function (row, index) {
    const renamed = DECK_RENAMED_LABELS[deck_text_(row[0])];
    if (renamed) ssot.getRange(index + 1, 1).setValue(renamed);
  });
  // Column B is filled by Master Control: drop the legacy dropdowns (old phase/stage/invoice lists), clear samples.
  ssot.getRange(1, 2, lastRow, 1).clearDataValidations();
  const formulasB = ssot.getRange(1, 2, lastRow, 1).getFormulas();
  formulasB.forEach(function (row, index) {
    if (!row[0]) ssot.getRange(index + 1, 2).clearContent();
  });
  // MilestonePercent = Completed / Total, safe when a project has no milestones yet.
  const labelRow = function (name) { return labels.map(function (r) { return deck_text_(r[0]); }).indexOf(name) + 1; };
  const percentRow = labelRow('MilestonePercent');
  const doneRow = labelRow('CompletedMilestones');
  const totalRow = labelRow('TotalMilestones');
  if (percentRow && doneRow && totalRow) ssot.getRange(percentRow, 2).setFormula('=IFERROR(B' + doneRow + '/B' + totalRow + ', 0)');
  // Sample tickets (D:J) and retention rows (L:P) belong to the template's demo client.
  ssot.getRange(2, 4, Math.max(lastRow, 50) - 1, 7).clearContent();
  ssot.getRange(2, 12, Math.max(lastRow, 50) - 1, 5).clearContent();
  // Launchpad: link each deliverable row to its SSOT URL.
  const ssotRowOf = function (label) {
    const index = ssot.getRange(1, 1, lastRow, 1).getValues().map(function (r) { return deck_text_(r[0]); }).indexOf(label);
    return index === -1 ? 0 : index + 1;
  };
  const mainRows = Math.max(main.getLastRow(), 1);
  const titles = main.getRange(1, 2, mainRows, 1).getDisplayValues();
  DECK_LAUNCHPAD.forEach(function (item) {
    const index = titles.map(function (r) { return r[0]; }).findIndex(function (t) { return item.match.test(t); });
    const source = ssotRowOf(item.label);
    if (index === -1 || !source) return;
    const ref = DECK_SSOT_TAB + '!B' + source;
    if (item.title) main.getRange(index + 1, 2).setValue(item.title);
    main.getRange(index + 1, 7).setFormula('=IF(' + ref + '="", "Not issued yet", "Available")');
    main.getRange(index + 1, 8).setFormula('=IF(' + ref + '="", "—", HYPERLINK(' + ref + ', "' + item.linkText + '"))');
  });
  // The fourth KPI sparkline was a fixed 25%; show client task completion instead.
  main.getRange('L10').setFormula('=SPARKLINE(IFERROR(COUNTIF(' + DASHBOARD_TAB + '!D2:D, TRUE)/COUNTA(' + DASHBOARD_TAB + '!E2:E), 0), {"charttype", "bar"; "max", 1; "color1", "#8B5CF6"})');
}

function dashboard_layout_(deck, rows) {
  const sheet = deck.getSheetByName(DASHBOARD_TAB) || deck.insertSheet(DASHBOARD_TAB, 1);
  sheet.getRange(1, 1, 1, DASHBOARD_HEADERS.length).setValues([DASHBOARD_HEADERS])
    .setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#1E293B');
  if (rows.length) sheet.getRange(2, 1, rows.length, DASHBOARD_HEADERS.length).setValues(rows);
  sheet.getRange(2, DASHBOARD_DONE_COLUMN, DASHBOARD_MAX_ROWS, 1).insertCheckboxes();
  sheet.getRange(2, 6, DASHBOARD_MAX_ROWS, 1).insertCheckboxes();
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 260);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 420);
  sheet.setColumnWidth(4, 60);
  sheet.getRange(2, 3, DASHBOARD_MAX_ROWS, 1).setWrap(true);
  sheet.hideColumns(5, 2);
  return sheet;
}

/** Every tab protected; only Project_Tasks Done stays editable. Only the script owner edits the rest. */
function deck_protect_(deck) {
  const me = Session.getEffectiveUser();
  deck.getSheets().forEach(function (sheet) {
    const protection = sheet.protect().setDescription('Managed by Master Control.');
    if (sheet.getName() === DASHBOARD_TAB) {
      protection.setDescription('Only the Done column is editable.');
      protection.setUnprotectedRanges([sheet.getRange(2, DASHBOARD_DONE_COLUMN, DASHBOARD_MAX_ROWS, 1)]);
    }
    protection.addEditor(me);
    protection.removeEditors(protection.getEditors().filter(function (user) { return user.getEmail() !== me.getEmail(); }));
    if (protection.canDomainEdit()) protection.setDomainEdit(false);
  });
}

/** Shares with the Group (no notification email); falls back to the Group's member emails if that is refused. */
function dashboard_share_(fileId, groupEmail) {
  try {
    Drive.Permissions.create({ role: 'writer', type: 'group', emailAddress: groupEmail }, fileId, { sendNotificationEmail: false });
    return groupEmail;
  } catch (groupError) {
    console.warn('Group share refused for ' + groupEmail + ': ' + (groupError && groupError.message) + ' — falling back to member emails.');
    const members = (AdminDirectory.Members.list(groupEmail).members || []).map(function (m) { return m.email; });
    members.forEach(function (email) {
      Drive.Permissions.create({ role: 'writer', type: 'user', emailAddress: email }, fileId, { sendNotificationEmail: false });
    });
    return 'members ' + members.join(', ') + ' (group share refused: ' + (groupError && groupError.message) + ')';
  }
}

/** One on-edit trigger per deck (within budget) plus a single 5-minute sync for all decks. */
function dashboard_ensureTriggers_(spreadsheetId) {
  const triggers = ScriptApp.getProjectTriggers();
  const notes = [];
  if (!triggers.some(function (t) { return t.getHandlerFunction() === DASHBOARD_SYNC_HANDLER; })) {
    ScriptApp.newTrigger(DASHBOARD_SYNC_HANDLER).timeBased().everyMinutes(5).create();
    notes.push('5-minute sync installed');
  }
  const hasEdit = triggers.some(function (t) { return t.getHandlerFunction() === DASHBOARD_EDIT_HANDLER && t.getTriggerSourceId() === spreadsheetId; });
  if (!hasEdit) {
    if (ScriptApp.getProjectTriggers().length >= DASHBOARD_TRIGGER_BUDGET) {
      notes.push('on-edit trigger skipped (trigger budget reached; the 5-minute sync still pushes ticks)');
    } else {
      ScriptApp.newTrigger(DASHBOARD_EDIT_HANDLER).forSpreadsheet(spreadsheetId).onEdit().create();
      notes.push('on-edit trigger installed');
    }
  }
  return notes.join(', ') || 'triggers already installed';
}

/* ---------- live: refresh and sync ---------- */

/** Projects that have a deck: [{ projectId, listId, dashboardId }]. */
function dashboard_projects_() {
  const spreadsheet = hud_assertWorkingCopy_();
  return vala_readRecords_(hud_requireSheet_(spreadsheet, 'Projects'), ['ProjectID']).rows
    .filter(function (p) { return deck_text_(p.Dashboard_Sheet_ID) && deck_text_(p.Google_Tasklist_ID); })
    .map(function (p) { return { projectId: deck_text_(p.ProjectID), listId: deck_text_(p.Google_Tasklist_ID), dashboardId: deck_text_(p.Dashboard_Sheet_ID) }; });
}

/** Milestone task keys for a project, from the template repository's Is_Milestone column. */
function deck_milestoneKeys_(project, repo) {
  const tabs = dolores_projectTabs_(project, repo.getSheets().map(function (s) { return s.getName(); })).tabs;
  const keys = {};
  dolores_readTemplates_(repo, tabs).forEach(function (template) {
    template.tasks.forEach(function (task) { if (task.milestone) keys[dolores_taskKey_(template.tab, task.name)] = true; });
  });
  return keys;
}

/** Writes the SSOT tab of one deck from Master Control. Returns { fields }. */
function deck_refresh_(entry, cache) {
  cache = cache || {};
  const spreadsheet = hud_assertWorkingCopy_();
  const read = function (tab, key) {
    if (!cache[tab]) cache[tab] = vala_readRecords_(hud_requireSheet_(spreadsheet, tab), [key]).rows;
    return cache[tab];
  };
  const project = read('Projects', 'ProjectID').filter(function (p) { return deck_text_(p.ProjectID) === entry.projectId; })[0];
  if (!project) throw new Error(entry.projectId + ' not found in Projects');
  const client = read('Clients', 'ClientID').filter(function (c) { return deck_text_(c.ClientID) === deck_text_(project.ClientID); })[0] || {};
  const finances = read('Finances', 'ProjectID').filter(function (f) { return deck_text_(f.ProjectID) === entry.projectId; });
  if (!cache.repo) cache.repo = SpreadsheetApp.openById(DOLORES_TEMPLATE_REPO_ID);
  const deck = SpreadsheetApp.openById(entry.dashboardId);
  const ssot = deck.getSheetByName(DECK_SSOT_TAB);
  if (!ssot) throw new Error('deck tab "' + DECK_SSOT_TAB + '" missing');
  const lastRow = Math.max(ssot.getLastRow(), 2);
  const tickets = ssot.getRange(2, 4, Math.max(lastRow, 50) - 1, 7).getValues();
  const values = deck_ssotValues_({
    client: client, project: project,
    contract: finances.filter(function (f) { return deck_text_(f.MilestoneStage) === VALA_CONTRACT; })[0],
    invoices: finances.filter(function (f) { return deck_text_(f.MilestoneStage) !== VALA_CONTRACT; }),
    tasks: entry.tasks || dolores_listTasks_(entry.listId),
    milestoneKeys: deck_milestoneKeys_(project, cache.repo),
    tickets: tickets
  });
  const writes = deck_ssotWrites_(
    ssot.getRange(1, 1, lastRow, 1).getValues().map(function (r) { return r[0]; }),
    ssot.getRange(1, 2, lastRow, 1).getFormulas().map(function (r) { return r[0]; }),
    values.labels);
  writes.forEach(function (w) { ssot.getRange(w.row, 2).setValue(w.value); });
  ssot.getRange(2, 12, 1, values.retention.length).setValues([values.retention]);
  return { fields: writes.length };
}

function dashboard_setTaskDone_(listId, taskId, done) {
  Tasks.Tasks.patch(done ? { status: 'completed' } : { status: 'needsAction', completed: null }, listId, taskId);
}

/** Audit trail in the Working Copy Edit_Log (who ticked what, on which deck). */
function dashboard_log_(projectId, rowNumber, title, done, user) {
  try {
    editLog_ensureTab_(hud_assertWorkingCopy_()).appendRow([
      new Date().toISOString(), user || 'unknown', 'Deck:' + projectId, 'D' + rowNumber, 'Done', title, String(!done), String(done)
    ]);
  } catch (error) {
    console.warn('Deck log failed: ' + (error && error.message));
  }
}

/** Installable on-edit trigger on each deck: a Done tick completes or reopens the task right away. */
function dashboard_onEdit(e) {
  if (!e || !e.range || e.range.getColumn() > DASHBOARD_DONE_COLUMN || e.range.getLastColumn() < DASHBOARD_DONE_COLUMN) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== DASHBOARD_TAB) return;
  const spreadsheetId = e.source.getId();
  const project = dashboard_projects_().filter(function (p) { return p.dashboardId === spreadsheetId; })[0];
  if (!project) return;
  if (!deck_tryMutex_(project.projectId)) return; // a sync of this deck is running; the 5-minute sync picks the tick up
  try {
    const first = Math.max(2, e.range.getRow());
    const last = e.range.getLastRow();
    if (last < first) return;
    const values = sheet.getRange(first, 1, last - first + 1, DASHBOARD_HEADERS.length).getValues();
    const user = (Session.getActiveUser() && Session.getActiveUser().getEmail()) || '';
    values.forEach(function (row, offset) {
      const taskId = deck_text_(row[4]);
      const done = row[3] === true;
      if (!taskId || done === (row[5] === true)) return;
      dashboard_setTaskDone_(project.listId, taskId, done);
      sheet.getRange(first + offset, 6).setValue(done);
      dashboard_log_(project.projectId, first + offset, row[0], done, user);
    });
  } finally {
    deck_releaseMutex_(project.projectId);
  }
}

/**
 * Per-deck guard (owner feedback 2026-11-05: HUD saves took 30-45 s). Deck syncs no longer hold the script lock that
 * every audited HUD write needs; they only must not overlap with themselves or the deck's own on-edit handler.
 * The Synced column keeps a repeated or skipped run harmless.
 */
function deck_tryMutex_(projectId) {
  const cache = CacheService.getScriptCache();
  const key = 'deck-sync:' + projectId;
  if (cache.get(key)) return false;
  cache.put(key, String(Date.now()), 120);
  return true;
}

function deck_releaseMutex_(projectId) {
  try { CacheService.getScriptCache().remove('deck-sync:' + projectId); } catch (error) { /* expires in 120 s anyway */ }
}

/** Time-driven, every 5 minutes: two-way task sync and SSOT refresh for every deck. */
function dashboard_scheduledSync() {
  const cache = {};
  dashboard_projects_().forEach(function (project) {
    if (!deck_tryMutex_(project.projectId)) return;
    try { dashboard_syncOne_(project, cache); }
    catch (error) { console.warn('Deck sync failed for ' + project.projectId + ': ' + (error && error.message)); }
    finally { deck_releaseMutex_(project.projectId); }
  });
}

function dashboard_syncOne_(project, cache) {
  const sheet = SpreadsheetApp.openById(project.dashboardId).getSheetByName(DASHBOARD_TAB);
  if (!sheet) throw new Error('deck tab "' + DASHBOARD_TAB + '" missing');
  const lastRow = Math.max(1, sheet.getLastRow());
  const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, DASHBOARD_HEADERS.length).getValues() : [];
  const tasks = dolores_listTasks_(project.listId);
  const plan = dashboard_syncPlan_(rows, tasks);
  plan.push.forEach(function (item) {
    dashboard_setTaskDone_(project.listId, item.taskId, item.done);
    sheet.getRange(item.row + 2, 6).setValue(item.done);
    dashboard_log_(project.projectId, item.row + 2, rows[item.row][0], item.done, 'deck (5-minute sync)');
  });
  plan.pull.forEach(function (item) {
    sheet.getRange(item.row + 2, DASHBOARD_DONE_COLUMN, 1, 1).setValue(item.done);
    sheet.getRange(item.row + 2, 6).setValue(item.done);
  });
  if (plan.append.length) {
    const used = rows.filter(function (r) { return deck_text_(r[4]) || deck_text_(r[0]); }).length;
    sheet.getRange(used + 2, 1, plan.append.length, DASHBOARD_HEADERS.length).setValues(plan.append);
  }
  // Pushed ticks change task status; re-read so milestone counts include them.
  const refreshed = deck_refresh_({ projectId: project.projectId, listId: project.listId, dashboardId: project.dashboardId,
    tasks: plan.push.length ? dolores_listTasks_(project.listId) : tasks }, cache);
  return { projectId: project.projectId, pushed: plan.push.length, pulled: plan.pull.length, appended: plan.append.length,
    orphaned: plan.orphaned.length, ssotFields: refreshed.fields };
}

/** Owner check: run the sync once now and print what changed. */
function runDashboardSyncNow() {
  const cache = {};
  const out = dashboard_projects_().map(function (project) {
    try { return dashboard_syncOne_(project, cache); } catch (error) { return { projectId: project.projectId, error: String(error && error.message || error) }; }
  });
  return dolores_report_({ synced: out, triggers: ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }) });
}
