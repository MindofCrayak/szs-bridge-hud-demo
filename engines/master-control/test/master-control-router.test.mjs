import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({
  console,
  Utilities: { getUuid: () => 'test-uuid' },
  Session: { getActiveUser: () => ({ getEmail: () => 'operator@example.com' }) },
});

const sourceFiles = [
  '../src/Master_Control_Auth.gs',
  '../src/Pipeline_Phase_Gate.gs',
  '../src/Central_Router.gs',
  '../Schema_Registry.gs',
    '../HUD_API.gs',
  '../HUD_Writes.gs',
];
for (const sourceFile of sourceFiles) {
  vm.runInContext(readFileSync(new URL(sourceFile, import.meta.url), 'utf8'), context);
}

const headers = [
  'ClientID',
  'PipelineStage',
  'MSA_DocID',
  'CompanyName',
];

function createHarness({
  client = ['CLIENT-01', '02: Session Zero', '', 'Example Co'],
  depositPaid = false,
  sowDocId = '',
  projectClientId = 'CLIENT-01',
  financeClientId = 'CLIENT-01',
  authorizedUsers = 'operator@example.com',
  overrideUsers = '',
  masterControlSheetId = '',
  includeAlertSheet = true,
  auditFails = false,
} = {}) {
  context.Tasks = undefined;
  const clientRow = [...client];
  const alertRows = [];
  const stageHistoryRows = [];
  const calls = [];
  const projectSheet = {
    getDataRange: () => ({ getValues: () => [['ClientID', 'SOW_DocID'], [projectClientId, sowDocId]] }),
  };
  const financesSheet = {
    getDataRange: () => ({ getValues: () => [['ClientID', 'DepositPaid'], [financeClientId, depositPaid]] }),
  };
  const clientsSheet = {
    getDataRange: () => ({ getValues: () => [headers, clientRow] }),
    getRange: (row, column) => ({
      setValue: (value) => {
        calls.push('mutate');
        clientRow[column - 1] = value;
      },
    }),
  };
  const alertsSheet = {
    getLastColumn: () => 8,
    getRange: () => ({ getValues: () => [[
      'Alert_ID', 'Timestamp', 'ClientID', 'Priority', 'Category', 'Message', 'Action_URL', 'Dismissed_Status',
    ]] }),
    appendRow: (row) => {
      calls.push('audit');
      if (auditFails) throw new Error('audit write failed');
      alertRows.push(row);
    },
  };
  const stageHistorySheet = {
    appendRow: row => stageHistoryRows.push(row),
  };
  const spreadsheet = {
    getSheetByName: (name) => {
      if (name === 'Clients') return clientsSheet;
      if (name === 'Projects') return projectSheet;
      if (name === 'Finances') return financesSheet;
      if (name === 'Alfred_Alerts' && includeAlertSheet) return alertsSheet;
      if (name === 'Stage_History') return stageHistoryRows.length ? stageHistorySheet : null;
      return null;
    },
    insertSheet: name => {
      assert.equal(name, 'Stage_History');
      return stageHistorySheet;
    },
    getSheets: () => [clientsSheet, projectSheet, financesSheet, alertsSheet, stageHistorySheet],
  };
  const lockState = { waits: 0, releases: 0 };
  context.SpreadsheetApp = { getActiveSpreadsheet: () => spreadsheet };
  context.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (name) => ({
        AUTHORIZED_USER_EMAILS: authorizedUsers,
        PIPELINE_OVERRIDE_EMAILS: overrideUsers,
        MASTER_CONTROL_SHEET_ID: masterControlSheetId,
      })[name] || '',
    }),
  };
  context.LockService = {
    getScriptLock: () => ({
      waitLock: (timeout) => {
        assert.equal(timeout, 30000);
        lockState.waits += 1;
      },
      releaseLock: () => { lockState.releases += 1; },
    }),
  };
  context.ContentService = {
    MimeType: { JSON: 'application/json' },
    createTextOutput: (text) => ({
      text,
      setMimeType: () => ({ text }),
    }),
  };
  return { clientRow, alertRows, stageHistoryRows, calls, lockState };
}

function createWriteHarness({
  depositPaid = true,
  authorizedUsers = 'operator@example.com',
  failMidPhaseWrite = false,
  mismatchPhaseReadBack = false,
} = {}) {
  const calls = [];
  const sheets = new Map();
  const makeSheet = (name, initialHeaders = [], initialRows = []) => {
    const headers = [...initialHeaders];
    const rows = initialRows.map(row => [...row]);
    const ensureRow = (rowNumber) => {
      while (rows.length < rowNumber - 1) rows.push([]);
      return rows[rowNumber - 2];
    };
    const sheet = {
      getName: () => name,
      getLastRow: () => headers.length ? rows.length + 1 : 0,
      getLastColumn: () => headers.length,
      getDataRange: () => ({
        getValues: () => {
          if (!headers.length) return [];
          const values = [headers.slice(), ...rows.map(row =>
            Array.from({ length: headers.length }, (_, index) => row[index] ?? ''))];
          if (mismatchPhaseReadBack
            && name === 'Clients'
            && rows[0]?.[1] === '02: Session Zero') {
            values[1][1] = '03: Active Sprints';
          }
          return values;
        },
      }),
      getRange: (rowNumber, columnNumber, rowCount = 1, columnCount = 1) => ({
        getValues: () => Array.from({ length: rowCount }, (_, rowOffset) =>
          Array.from({ length: columnCount }, (_, columnOffset) => {
            const row = rowNumber + rowOffset;
            const column = columnNumber + columnOffset;
            if (row === 1) return headers[column - 1] ?? '';
            return rows[row - 2]?.[column - 1] ?? '';
          })),
        setValue: value => {
          if (failMidPhaseWrite
            && name === 'Clients'
            && rowNumber === 2
            && columnNumber === 4
            && rows[0]?.[1] === '02: Session Zero') {
            throw new Error('Simulated AccountPhase_Mode write failure.');
          }
          if (rowNumber === 1) {
            while (headers.length < columnNumber) headers.push('');
            headers[columnNumber - 1] = value;
          } else {
            const row = ensureRow(rowNumber);
            while (row.length < columnNumber) row.push('');
            row[columnNumber - 1] = value;
          }
          calls.push({ type: 'setValue', sheet: name, row: rowNumber, column: columnNumber, value });
        },
        setValues: values => values.forEach((valueRow, rowOffset) =>
          valueRow.forEach((value, columnOffset) => {
            const rowNumberToSet = rowNumber + rowOffset;
            const columnNumberToSet = columnNumber + columnOffset;
            if (rowNumberToSet === 1) {
              while (headers.length < columnNumberToSet) headers.push('');
              headers[columnNumberToSet - 1] = value;
            } else {
              const row = ensureRow(rowNumberToSet);
              while (row.length < columnNumberToSet) row.push('');
              row[columnNumberToSet - 1] = value;
            }
          })),
      }),
      appendRow: row => {
        rows.push([...row]);
        calls.push({ type: 'appendRow', sheet: name, row: [...row] });
      },
      deleteRow: rowNumber => rows.splice(rowNumber - 2, 1),
    };
    sheets.set(name, sheet);
    return sheet;
  };

  const clientSheet = makeSheet('Clients', [
    'ClientID', 'AccountPhase', 'MSA_DocID',
  ], [['ZZZ', '01: Intake', 'msa-test']]);
  const projectSheet = makeSheet('Projects', [
    'ProjectID', 'ClientID', 'SprintStage', 'SOW_DocID',
  ], [['ZZZ-01', 'ZZZ', '03: Deep Intelligence', 'sow-test']]);
  const financeSheet = makeSheet('Finances', [
    'ClientID', 'DepositPaid',
  ], [['ZZZ', depositPaid]]);
  const alertHeaders = [
    'Alert_ID', 'Timestamp', 'ClientID', 'Priority', 'Category', 'Message',
    'Action_URL', 'Dismissed_Status', 'Created_At', 'Source_Module', 'Department',
    'Client_ID', 'Project_ID', 'Entity_Reference', 'Severity', 'Trigger_Condition',
    'Prescribed_Action', 'Due_SLA', 'Assigned_Lead', 'Action_Status', 'Resolved_At',
  ];
  const alertSheet = makeSheet('Alfred_Alerts', alertHeaders, [[
    'ALT-ZZZ-01', '2026-10-31T12:00:00.000Z', 'ZZZ', 'WARN', 'Test', 'Test alert',
    '', false, '2026-10-31T12:00:00.000Z', 'Test', 'Alfred', 'ZZZ', 'ZZZ-01',
    'ZZZ-01', 'WARN', 'Test condition', 'Test action', '', 'Alfred', 'Open', '',
  ]]);
  const schemaRegistry = makeSheet('Schema_Registry', [
    'Registry_ID', 'Database', 'Tab', 'Column_Letter', 'Column_Name', 'Data_Type',
    'Allowed_Values', 'Data_Class', 'Owner_Persona', 'Required', 'Schema_Version',
    'Last_Verified', 'Notes',
  ]);
  const schemaChangeLog = makeSheet('Schema_Change_Log', [
    'Change_ID', 'Logged_At', 'Requested_By', 'Target_Database', 'Target_Tab',
    'Target_Column', 'Change_Type', 'Reason', 'Impact', 'Severity', 'Status',
    'Approved_By', 'Applied_Version', 'Police_Check_Result', 'Rollback_Note', 'Source',
  ]);
  const lockState = { waits: 0, releases: 0 };
  const spreadsheet = {
    getSheetByName: name => sheets.get(name) || null,
    insertSheet: name => makeSheet(name),
  };
  context.SpreadsheetApp = {
    getActiveSpreadsheet: () => spreadsheet,
    flush: () => calls.push({ type: 'flush' }),
  };
  context.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: name => name === 'AUTHORIZED_USER_EMAILS' ? authorizedUsers : '',
    }),
  };
  context.LockService = {
    getScriptLock: () => ({
      waitLock: timeout => {
        assert.equal(timeout, 30000);
        lockState.waits += 1;
      },
      releaseLock: () => { lockState.releases += 1; },
    }),
  };
  let uuid = 0;
  context.Utilities = { getUuid: () => `write-${++uuid}` };
  context.Tasks = undefined;

  return {
    calls,
    lockState,
    clientSheet,
    projectSheet,
    financeSheet,
    alertSheet,
    schemaRegistry,
    schemaChangeLog,
    getSheet: name => sheets.get(name) || null,
  };
}

function createServiceHarness({
  clientValue = 12000,
  activeComponents = '',
  includeActiveComponents = true,
  projectRows,
  authorizedUsers = 'operator@example.com',
  tasksAvailable = true,
  masterControlSheetId = '',
} = {}) {
  const harness = createHarness({ authorizedUsers, masterControlSheetId });
  const clientHeaders = [
    'ClientID', 'First_Name', 'Last_Name', 'Company_Name', 'ContactEmail',
    'GoogleGroupEmail', 'Archetype', 'AccountPhase', 'ActiveRoadblock',
    'ContractValue', 'DepositPaid', 'CurrentMilestone', 'CompletedMilestones',
    'TotalMilestones', 'DriveFolderUrl', 'ChatSpaceUrl', 'NotesDocUrl',
    'MSA_DocID', 'Tech_Stack', 'MCC_Subscriber_ID', 'Oracle_Baseline_ID',
  ];
  const projectHeaders = [
    'ProjectID', 'ClientID', 'ProjectName', 'SprintStage', 'AssignedRateTier',
    'SOW_DocID', 'Project_Brief_DocID', 'Project_Outline_DocID',
    'COMS_Sheet_URL', 'Google_Tasklist_ID', 'MeetingNotes_DriveFolderID',
    'ChatSpaceURL', 'ChatSpace_Internal_URL', 'Est_Hours', 'Actual_Hours',
    'ParentProjectID', 'AddendumRef',
  ];
  if (includeActiveComponents) projectHeaders.push('ActiveComponents');

  const clientRow = [
    'CLIENT-01', 'Test', 'Operator', 'Test Client', '', '', '',
    '02: Session Zero', '', clientValue, false, '', 0, 5, '', '', '',
    '', '', '', '',
  ];
  const projectRow = [
    'PROJECT-01', 'CLIENT-01', 'Test Project', '03: Active Sprints',
    'Tier 1', 'sow-id', 'brief-id', 'outline-id', '', '', '', '', '',
    100, 0, '', '',
  ];
  if (includeActiveComponents) projectRow.push(activeComponents);

  const rows = {
    clients: [clientRow],
    projects: projectRows || [projectRow],
  };
  const writes = [];
  const makeSheet = (name, headers) => ({
    getDataRange: () => ({ getValues: () => [headers, ...rows[name]] }),
    getRange: (row, column) => ({
      setValue: value => {
        writes.push({ sheet: name, row, column, value });
        rows[name][row - 2][column - 1] = value;
      },
    }),
  });
  const clientsSheet = makeSheet('clients', clientHeaders);
  const projectsSheet = makeSheet('projects', projectHeaders);
  const spreadsheet = {
    getSheetByName: name => ({
      Clients: clientsSheet,
      Projects: projectsSheet,
    })[name] || null,
  };
  const openedSpreadsheetIds = [];
  let activeSpreadsheetLookups = 0;
  context.SpreadsheetApp = {
    getActiveSpreadsheet: () => {
      activeSpreadsheetLookups += 1;
      return spreadsheet;
    },
    openById: id => {
      openedSpreadsheetIds.push(id);
      return spreadsheet;
    },
  };

  const insertedTasks = [];
  let taskListLookups = 0;
  if (tasksAvailable) {
    context.Tasks = {
      Tasklists: {
        list: () => ({
          getItems: () => {
            taskListLookups += 1;
            return [{ getId: () => 'test-task-list' }];
          },
        }),
      },
      Tasks: {
        insert: (task, listId) => insertedTasks.push({ task, listId }),
      },
    };
  }

  // Catalog decision 2026-11-05: tasks come from the component's template tab via the Project_Automation sync.
  const syncCalls = [];
  const syncLockReleases = [];
  context.dolores_syncAfterAttach_ = (_sheet, projectId) => {
    syncCalls.push(projectId);
    syncLockReleases.push(harness.lockState.releases);
    return { added: 5, message: 'synced list L; added 5 tasks' };
  };
  if (context.SpreadsheetApp && !context.SpreadsheetApp.flush) context.SpreadsheetApp.flush = () => {};
  // Phase G: price goes to the Finances contract-row TCV (Finance_Model), never to Clients.ContractValue.
  const financeCalls = [];
  context.vala_planTcvIncrease_ = (_spreadsheet, projectId, delta) => {
    financeCalls.push(['plan', projectId, delta]);
    return { rowNumber: 2, column: 5, before: 12000, after: 12000 + delta };
  };
  context.vala_applyTcvIncrease_ = (_spreadsheet, plan) => {
    financeCalls.push(['apply', plan.after]);
    return () => financeCalls.push(['rollback']);
  };

  return {
    ...harness,
    clientRow,
    projectRow,
    rows,
    writes,
    insertedTasks,
    syncCalls,
    syncLockReleases,
    financeCalls,
    openedSpreadsheetIds,
    getActiveSpreadsheetLookups: () => activeSpreadsheetLookups,
    getTaskListLookups: () => taskListLookups,
  };
}

test('persists service components and contract value by header while holding the lock', () => {
  const harness = createServiceHarness();
  const result = context.attachClientServiceNode({
    clientId: 'CLIENT-01',
    serviceId: 'comp_mcc_engine',
    priceDelta: 3200,
    tasks: ['Create the welcome sequence', 'Configure follow-up automation'],
  });

  assert.equal(result.success, true);
  assert.equal(result.alreadyAttached, false);
  assert.equal(result.updatedValue, 15200);
  assert.deepEqual(Array.from(result.activeComponents), ['comp_mcc_engine']);
  assert.equal(result.tasksCreated, 5);
  assert.equal(result.tasksFailed, 0);
  assert.equal(harness.clientRow[9], 12000, 'Clients.ContractValue (the roll-up formula) is never written');
  assert.deepEqual(harness.financeCalls, [['plan', 'PROJECT-01', 3200], ['apply', 15200]]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.tcv)), { before: 12000, after: 15200 });
  assert.equal(harness.projectRow[4], 'Tier 1');
  assert.equal(harness.projectRow[7], 'outline-id');
  assert.equal(harness.projectRow[17], 'comp_mcc_engine');
  assert.deepEqual(harness.insertedTasks, [], 'payload task titles never go to the first Google Tasks list');
  assert.deepEqual(harness.syncCalls, ['PROJECT-01'], 'the project list is synced from the mapped template tab');
  assert.deepEqual(harness.syncLockReleases, [1], 'the task sync runs after the script lock is released');
  assert.equal(harness.lockState.waits, 1);
  assert.equal(harness.lockState.releases, 1);
});

test('configured Master Control sheet ID takes precedence over the active spreadsheet', () => {
  const harness = createServiceHarness({ masterControlSheetId: 'disposable-master-control' });
  const result = context.attachClientServiceNode({
    clientId: 'CLIENT-01',
    serviceId: 'comp_mcc_engine',
    priceDelta: 3200,
    tasks: [],
  });

  assert.equal(result.updatedValue, 15200);
  assert.deepEqual(harness.openedSpreadsheetIds, ['disposable-master-control']);
  assert.equal(harness.getActiveSpreadsheetLookups(), 0);
});

test('service attachment through doPost does not acquire a nested lock', () => {
  const harness = createServiceHarness();
  const response = context.doPost({
    postData: {
      contents: JSON.stringify({
        action: 'attachClientServiceNode',
        clientId: 'CLIENT-01',
        serviceId: 'comp_mcc_engine',
        priceDelta: 3200,
        tasks: [],
      }),
    },
  });

  assert.equal(JSON.parse(response.text).status, 200);
  assert.equal(harness.lockState.waits, 1);
  assert.equal(harness.lockState.releases, 1);
});

test('retries do not charge or create tasks for an already attached service', () => {
  const harness = createServiceHarness({
    clientValue: 15200,
    activeComponents: 'comp_mcc_engine',
  });
  const result = context.attachClientServiceNode({
    clientId: 'CLIENT-01',
    serviceId: 'comp_mcc_engine',
    priceDelta: 3200,
    tasks: ['Create the welcome sequence'],
  });

  assert.equal(result.success, true);
  assert.equal(result.alreadyAttached, true);
  assert.equal(result.updatedValue, 15200);
  assert.equal(harness.clientRow[9], 15200);
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.insertedTasks.length, 0);
  assert.equal(harness.getTaskListLookups(), 0);
  assert.equal(harness.lockState.releases, 1);
});

test('service attachment fails closed when the schema is missing ActiveComponents', () => {
  const harness = createServiceHarness({ includeActiveComponents: false });
  assert.throws(
    () => context.attachClientServiceNode({
      clientId: 'CLIENT-01',
      serviceId: 'comp_mcc_engine',
      priceDelta: 3200,
      tasks: [],
    }),
    /Projects\.ActiveComponents are required/,
  );
  assert.equal(harness.clientRow[9], 12000);
  assert.equal(harness.projectRow[4], 'Tier 1');
  assert.equal(harness.projectRow[7], 'outline-id');
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.lockState.releases, 1);
});

test('service attachment rejects ambiguous project rows without writing', () => {
  const projectHeaders = [
    'ProjectID', 'ClientID', 'ProjectName', 'SprintStage', 'AssignedRateTier',
    'SOW_DocID', 'Project_Brief_DocID', 'Project_Outline_DocID',
    'COMS_Sheet_URL', 'Google_Tasklist_ID', 'MeetingNotes_DriveFolderID',
    'ChatSpaceURL', 'ChatSpace_Internal_URL', 'Est_Hours', 'Actual_Hours',
    'ParentProjectID', 'AddendumRef', 'ActiveComponents',
  ];
  const firstProject = [
    'PROJECT-01', 'CLIENT-01', 'Project One', '03: Active Sprints',
    'Tier 1', '', '', 'outline-one', '', '', '', '', '', 100, 0, '', '', '',
  ];
  const secondProject = [
    'PROJECT-02', 'CLIENT-01', 'Project Two', '03: Active Sprints',
    'Tier 2', '', '', 'outline-two', '', '', '', '', '', 100, 0, '', '', '',
  ];
  const harness = createServiceHarness({ projectRows: [firstProject, secondProject] });

  assert.throws(
    () => context.attachClientServiceNode({
      clientId: 'CLIENT-01',
      serviceId: 'comp_mcc_engine',
      priceDelta: 3200,
      tasks: [],
    }),
    error => error.code === 'AMBIGUOUS_PROJECT' && error.statusCode === 409,
  );
  assert.equal(harness.clientRow[9], 12000);
  assert.equal(harness.writes.length, 0);

  // Phase G: with the Solar project ID the attach goes to that project only.
  const result = context.attachClientServiceNode({
    clientId: 'CLIENT-01',
    projectId: 'PROJECT-02',
    serviceId: 'comp_mcc_engine',
    priceDelta: 3200,
    tasks: [],
  });
  assert.equal(result.projectId, 'PROJECT-02');
  assert.equal(secondProject[17], 'comp_mcc_engine');
  assert.equal(firstProject[17], '');
  assert.deepEqual(harness.financeCalls[0], ['plan', 'PROJECT-02', 3200]);
  assert.throws(
    () => context.attachClientServiceNode({ clientId: 'CLIENT-01', projectId: 'NOPE', serviceId: 'comp_dns_shield', priceDelta: 0, tasks: [] }),
    error => error.code === 'PROJECT_NOT_FOUND',
  );
});

test('service attachment rejects unauthorized direct executions before locking', () => {
  const harness = createServiceHarness({ authorizedUsers: 'different@example.com' });
  assert.throws(
    () => context.attachClientServiceNode({
      clientId: 'CLIENT-01',
      serviceId: 'comp_mcc_engine',
      priceDelta: 3200,
      tasks: [],
    }),
    error => error.code === 'UNAUTHORIZED',
  );
  assert.equal(harness.lockState.waits, 0);
  assert.equal(harness.writes.length, 0);
});

test('redacts sensitive values from alert text exposed to the HUD', () => {
  const message = context.sanitizeAlertText_(
    'token=example-token https://drive.google.com/drive/folders/example-id abcdefghijklmnopqrstuvwxyz123',
  );
  assert.equal(message, 'token=[REDACTED] [REDACTED_URL] [REDACTED_ID]');
});

test('HUD snapshot reads required tables and returns schema metadata without writes', () => {
  const harness = createHarness();
  const reads = [];
  const table = (name, headers, rows) => ({
    getDataRange: () => ({
      getValues: () => {
        reads.push(name);
        return [headers, ...rows];
      },
    }),
  });
  const sheets = {
    Clients: table('Clients', ['ClientID', 'Company_Name'], [['CLIENT-01', 'Example Co']]),
    Projects: table('Projects', ['ProjectID', 'ClientID'], [['PROJECT-01', 'CLIENT-01']]),
    Finances: table('Finances', ['InvoiceID', 'ClientID'], [['INV-01', 'CLIENT-01']]),
    Services_Rates: table('Services_Rates', ['ServiceID'], [['SERVICE-01']]),
    Alfred_Alerts: table('Alfred_Alerts', ['Alert_ID', 'Message'], [
      ['ALT-01', 'token=example-token https://example.com/record'],
    ]),
    Schema_Registry: table('Schema_Registry', ['Registry_ID'], [['REG-01']]),
    Schema_Change_Log: table('Schema_Change_Log', ['Change_ID'], [['SCH-01']]),
  };
  context.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({ getSheetByName: name => sheets[name] || null }),
  };

  const snapshot = context.hud_getSnapshot();
  assert.deepEqual(Array.from(snapshot.clients, row => row.ClientID), ['CLIENT-01']);
  assert.deepEqual(Array.from(snapshot.projects, row => row.ProjectID), ['PROJECT-01']);
  assert.deepEqual(Array.from(snapshot.finances, row => row.InvoiceID), ['INV-01']);
  assert.deepEqual(Array.from(snapshot.servicesRates, row => row.ServiceID), ['SERVICE-01']);
  assert.deepEqual(Array.from(snapshot.alerts, row => row.Alert_ID), ['ALT-01']);
  assert.equal(snapshot.alerts[0].Message, 'token=[REDACTED] [REDACTED_URL]');
  assert.equal(snapshot.schemaVersion, '1.0');
  assert.match(snapshot.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(Array.from(snapshot.warnings), []);
  assert.equal(reads.length, 7);
  // Owner 2026-11-05: read-only snapshot takes no script lock, so writes never queue behind the 60 s refresh.
  assert.equal(harness.lockState.waits, 0);
  assert.equal(harness.lockState.releases, 0);
});

test('HUD snapshot rejects unauthorized users before reading sheets', () => {
  createHarness({ authorizedUsers: 'different@example.com' });
  let spreadsheetLookups = 0;
  context.SpreadsheetApp = {
    getActiveSpreadsheet: () => {
      spreadsheetLookups += 1;
      return null;
    },
  };

  assert.throws(() => context.hud_getSnapshot(), error => error.code === 'UNAUTHORIZED');
  assert.equal(spreadsheetLookups, 0);
});

test('Master Control spreadsheet lookup fails closed when no target is configured', () => {
  const originalProperties = context.PropertiesService;
  const originalSpreadsheetApp = context.SpreadsheetApp;
  let openByIdCalls = 0;
  context.PropertiesService = {
    getScriptProperties: () => ({ getProperty: () => '' }),
  };
  context.SpreadsheetApp = {
    getActiveSpreadsheet: () => null,
    openById: () => {
      openByIdCalls += 1;
      throw new Error('Unexpected spreadsheet fallback.');
    },
  };

  try {
    assert.throws(
      () => context.getMasterControlSpreadsheet_(),
      /MASTER_CONTROL_SHEET_ID is required/,
    );
    assert.equal(openByIdCalls, 0);
  } finally {
    context.PropertiesService = originalProperties;
    context.SpreadsheetApp = originalSpreadsheetApp;
  }
});

test('project task reads use the configured list and follow every page', () => {
  const harness = createHarness();
  const projectSheet = {
    getDataRange: () => ({
      getValues: () => [
        ['ProjectID', 'Google_Tasklist_ID'],
        ['PROJECT-01', 'test-task-list'],
      ],
    }),
  };
  context.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({ getSheetByName: name => name === 'Projects' ? projectSheet : null }),
  };
  const calls = [];
  context.Tasks = {
    Tasklists: {},
    Tasks: {
      list: (taskListId, options) => {
        calls.push({ taskListId, options });
        return options.pageToken
          ? { items: [{ id: 'task-2' }] }
          : { items: [{ id: 'task-1' }], nextPageToken: 'next-page' };
      },
    },
  };

  const result = context.hud_getProjectTasks('PROJECT-01');
  assert.equal(result.projectId, 'PROJECT-01');
  assert.deepEqual(Array.from(result.tasks, task => task.id), ['task-1', 'task-2']);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].taskListId, 'test-task-list');
  assert.equal(calls[1].options.pageToken, 'next-page');
  assert.equal(harness.lockState.waits, 0, 'task reads take no script lock');
  assert.equal(harness.lockState.releases, 0);
});

test('client ID minting uses a 3-letter abbreviation and appends a digit on collision', () => {
  const existingIds = ['PAC', 'PAC2'];
  const sheet = {
    getLastRow: () => existingIds.length + 1,
    getRange: () => ({ getValues: () => existingIds.map(id => [id]) }),
  };
  const pattern = /^[A-Z]{3}\d{0,2}$/;

  assert.equal(context.mintClientID_(sheet, 'Prime Auto Collision'), 'PAC3');
  assert.equal(context.mintClientID_(sheet, 'SolarPulse Energy'), 'SEN');
  assert.equal(context.mintClientID_(sheet, 'Zenith'), 'ZEN');
  assert.equal(context.mintClientID_(sheet, 'Zenith EdTech Solutions'), 'ZES');
  assert.equal(context.mintClientID_(null, 'X'), 'XXX');
  assert.equal(context.mintClientID_(null, ''), 'CLT');
  for (const name of ['Prime Auto Collision', 'SolarPulse Energy', 'Zenith', 'A B', 'Mo']) {
    assert.match(context.mintClientID_(sheet, name), pattern);
  }
});

test('HUD writes add the phase mode column, audit read-back, and reject duplicate request IDs', () => {
  const harness = createWriteHarness();
  const result = context.hud_write('setAccountPhase', {
    clientId: 'ZZZ',
    phase: '02: Session Zero',
    mode: 'manual',
  }, 'request-phase-1');

  assert.equal(result.ok, true);
  assert.equal(result.before.AccountPhase, '01: Intake');
  assert.equal(result.after.AccountPhase, '02: Session Zero');
  assert.equal(result.after.AccountPhase_Mode, 'manual');
  const clients = harness.clientSheet.getDataRange().getValues();
  assert.equal(clients[0][clients[0].length - 1], 'AccountPhase_Mode');
  assert.equal(clients[1][clients[0].length - 1], 'manual');

  const audit = harness.getSheet('HUD_Audit_Log').getDataRange().getValues();
  const auditHeaders = audit[0];
  assert.equal(audit[1][auditHeaders.indexOf('Status')], 'Confirmed');
  assert.equal(audit[1][auditHeaders.indexOf('Request_ID')], 'request-phase-1');
  assert.match(audit[1][auditHeaders.indexOf('After')], /02: Session Zero/);

  // Lost-reply recovery: the HUD can read a write's outcome back by request ID.
  const status = context.hud_getWriteStatus('request-phase-1');
  assert.equal(status.found, true);
  assert.equal(status.status, 'Confirmed');
  assert.equal(status.after.AccountPhase, '02: Session Zero');
  assert.equal(status.after._timings, undefined);
  assert.equal(context.hud_getWriteStatus('no-such-request').found, false);

  const schemaChanges = harness.schemaChangeLog.getDataRange().getValues();
  assert.equal(schemaChanges.filter(row => row[10] === 'Approved').length, 2);
  const registry = harness.schemaRegistry.getDataRange().getValues();
  const registryHeaders = registry[0];
  const auditUserSchema = registry.find(row =>
    row[registryHeaders.indexOf('Tab')] === 'HUD_Audit_Log'
      && row[registryHeaders.indexOf('Column_Name')] === 'User');
  assert.equal(auditUserSchema[registryHeaders.indexOf('Data_Class')], 'pii');
  assert.throws(
    () => context.hud_write('setAccountPhase', {
      clientId: 'ZZZ',
      phase: '03: Active Sprints',
      mode: 'manual',
    }, 'request-phase-1'),
    error => error.code === 'DUPLICATE_REQUEST',
  );
  assert.equal(harness.clientSheet.getDataRange().getValues()[1][1], '02: Session Zero');
  assert.equal(harness.lockState.waits, 2);
  assert.equal(harness.lockState.releases, 2);
});

test('HUD stage writes enforce the deposit gate and derive AccountPhase in auto mode', () => {
  const blocked = createWriteHarness({ depositPaid: false });

  assert.throws(
    () => context.hud_write('setSprintStage', {
      projectId: 'ZZZ-01',
      stage: '04: Session Zero Kickoff',
    }, 'request-stage-blocked'),
    error => error.code === 'PHASE_GATE_REQUIREMENTS_MISSING',
  );
  assert.equal(blocked.projectSheet.getDataRange().getValues()[1][2], '03: Deep Intelligence');

  const harness = createWriteHarness();
  const result = context.hud_write('setSprintStage', {
    projectId: 'ZZZ-01',
    stage: '05: Architecture & Builds',
  }, 'request-stage-1');
  assert.equal(result.ok, true);
  assert.equal(result.after.SprintStage, '05: Architecture & Builds');
  assert.equal(result.after.AccountPhase, '03: Active Sprints');
  assert.equal(result.after.AccountPhase_Mode, 'auto');
  assert.equal(harness.projectSheet.getDataRange().getValues()[1][2], '05: Architecture & Builds');
  assert.equal(harness.clientSheet.getDataRange().getValues()[1][1], '03: Active Sprints');
  assert.equal(harness.lockState.waits, 1);
  assert.equal(harness.lockState.releases, 1);
});

test('resetting a manual account phase derives it from the current project stages', () => {
  const harness = createWriteHarness();
  context.hud_write('setAccountPhase', {
    clientId: 'ZZZ',
    phase: '04: Liftoff',
    mode: 'manual',
  }, 'request-phase-manual');
  const result = context.hud_write('setAccountPhase', {
    clientId: 'ZZZ',
    mode: 'auto',
  }, 'request-phase-auto');

  assert.equal(result.after.AccountPhase, '02: Session Zero');
  assert.equal(result.after.AccountPhase_Mode, 'auto');
  assert.equal(harness.clientSheet.getDataRange().getValues()[1][1], '02: Session Zero');
  assert.equal(harness.clientSheet.getDataRange().getValues()[1][3], 'auto');
});

test('HUD alert writes resolve and reopen with matching dismissal timestamps', () => {
  const harness = createWriteHarness();
  const resolved = context.hud_write('resolveAlert', {
    alertId: 'ALT-ZZZ-01',
    status: 'Resolved',
  }, 'request-alert-1');
  assert.equal(resolved.after.Action_Status, 'Resolved');
  assert.equal(resolved.after.Dismissed_Status, true);
  assert.ok(resolved.after.Resolved_At);

  const reopened = context.hud_write('resolveAlert', {
    alertId: 'ALT-ZZZ-01',
    status: 'Open',
  }, 'request-alert-2');
  assert.equal(reopened.after.Action_Status, 'Open');
  assert.equal(reopened.after.Dismissed_Status, false);
  assert.equal(reopened.after.Resolved_At, '');
  assert.equal(harness.lockState.waits, 2);
  assert.equal(harness.lockState.releases, 2);
});

test('moving a client to Sunset adds a Daisy request and confirms it on read-back', () => {
  const harness = createWriteHarness();
  const result = context.hud_write('setAccountPhase', {
    clientId: 'ZZZ',
    phase: '06: Archived/Sunset',
    mode: 'manual',
  }, 'request-sunset-1');

  assert.equal(result.after.AccountPhase, '06: Archived/Sunset');
  assert.equal(result.after.sunsetAlertStatus, 'Requested');
  assert.equal(result.after.sunsetAlertDepartment, 'Daisy');
  const alertRows = harness.alertSheet.getDataRange().getValues();
  const alertHeaders = alertRows[0];
  const sunset = alertRows.find(row => row[alertHeaders.indexOf('Alert_ID')] === result.after.sunsetAlertId);
  assert.equal(sunset[alertHeaders.indexOf('Message')], 'Sunset requested');
  assert.equal(sunset[alertHeaders.indexOf('Action_Status')], 'Requested');
});

test('HUD writes reject unauthorized users before acquiring the mutation lock', () => {
  const harness = createWriteHarness({ authorizedUsers: 'different@example.com' });
  assert.throws(
    () => context.hud_write('setAccountPhase', {
      clientId: 'ZZZ',
      phase: '02: Session Zero',
      mode: 'manual',
    }, 'request-unauthorized'),
    error => error.code === 'UNAUTHORIZED',
  );
  assert.equal(harness.lockState.waits, 0);
  assert.equal(harness.clientSheet.getDataRange().getValues()[1][1], '01: Intake');
});

test('HUD writes roll back earlier field mutations and mark the audit row failed', () => {
  const harness = createWriteHarness({ failMidPhaseWrite: true });

  assert.throws(
    () => context.hud_write('setAccountPhase', {
      clientId: 'ZZZ',
      phase: '02: Session Zero',
      mode: 'manual',
    }, 'request-phase-rollback'),
    /Simulated AccountPhase_Mode write failure/,
  );
  const clientRows = harness.clientSheet.getDataRange().getValues();
  assert.equal(clientRows[1][1], '01: Intake');
  assert.equal(clientRows[1][3], 'auto');

  const audit = harness.getSheet('HUD_Audit_Log').getDataRange().getValues();
  const auditHeaders = audit[0];
  assert.equal(audit[1][auditHeaders.indexOf('Status')], 'Failed');
  assert.match(audit[1][auditHeaders.indexOf('Error')], /Simulated AccountPhase_Mode write failure/);
  assert.equal(harness.lockState.waits, 1);
  assert.equal(harness.lockState.releases, 1);
});

test('HUD writes roll back when the read-back does not match the requested value', () => {
  const harness = createWriteHarness({ mismatchPhaseReadBack: true });

  assert.throws(
    () => context.hud_write('setAccountPhase', {
      clientId: 'ZZZ',
      phase: '02: Session Zero',
      mode: 'manual',
    }, 'request-phase-mismatch'),
    /did not confirm the requested values on read-back/,
  );
  const clientRows = harness.clientSheet.getDataRange().getValues();
  assert.equal(clientRows[1][1], '01: Intake');
  assert.equal(clientRows[1][3], 'auto');

  const audit = harness.getSheet('HUD_Audit_Log').getDataRange().getValues();
  const auditHeaders = audit[0];
  assert.equal(audit[1][auditHeaders.indexOf('Status')], 'Failed');
});
