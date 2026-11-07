import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseMasterControlTables, parseSnapshotCsvFiles, SnapshotCsvFiles } from './snapshotData';

const emptyFiles: SnapshotCsvFiles = {
  'clients.csv': 'ClientID,First_Name,Last_Name,Company_Name,ContactEmail,GoogleGroupEmail,Archetype,AccountPhase,ActiveRoadblock,ContractValue,DepositPaid,CurrentMilestone,CompletedMilestones,TotalMilestones,DriveFolderUrl,ChatSpaceUrl,NotesDocUrl,MSA_DocID,Tech_Stack,MCC_Subscriber_ID,Oracle_Baseline_ID',
  'projects.csv': 'ProjectID,ClientID,ProjectName,SprintStage,AssignedRateTier,SOW_DocID,Project_Brief_DocID,Project_Outline_DocID,COMS_Sheet_URL,Google_Tasklist_ID,MeetingNotes_DriveFolderID,ChatSpaceURL,ChatSpace_Internal_URL,Est_Hours,Actual_Hours,ParentProjectID,AddendumRef,ActiveComponents',
  'finances.csv': 'InvoiceID,ClientID,ProjectID,InvoiceNumber,MilestoneStage,TotalContractValue,DepositAmount,InvoiceAmount,DepositPaid,Remaining_Balance,InvoiceStatus,PaymentDate,Est_Hours_Allocation,Actual_Hours_Worked,EffectiveHourlyRate,EstimatedQuarterlyTax,OverheadCosts,NetMargin',
  'alerts.csv': 'Alert_ID,Timestamp,ClientID,Priority,Category,Message,Action_URL,Dismissed_Status,Created_At,Source_Module,Department,Client_ID,Project_ID,Entity_Reference,Severity,Trigger_Condition,Prescribed_Action,Due_SLA,Assigned_Lead,Action_Status,Resolved_At',
  'services_rates.csv': 'Rate_Tier,Hourly_Rate,Service_Category,Task_Item_Name,SOW_Invoice_Description,Default_Hours_Est,Package_Price',
};

test('live Master Control tables use the same mapping and validation as CSV snapshots', () => {
  const parsed = parseMasterControlTables({
    clients: [{
      ClientID: 'CSV',
      Company_Name: 'Sample Client',
      AccountPhase: '03: Active Sprints',
      ContractValue: 3200,
      DepositPaid: true,
      TotalMilestones: 5,
      CompletedMilestones: 2,
    }],
    projects: [{
      ProjectID: 'CSV-01',
      ClientID: 'CSV',
      SprintStage: '05: Architecture & Builds',
      AssignedRateTier: 'Normal ($85)',
      ProjectName: 'Build project',
    }],
    finances: [{
      InvoiceID: 'INV-TMP-26-001',
      ClientID: 'CSV',
      Amount: 1200,
      Status: 'Paid',
      PaidDate: '2026-10-31T12:00:00.000Z',
    }],
    servicesRates: [{ ServiceID: 'service-demo', Rate: 120 }],
    alerts: [{
      Alert_ID: 'ALT-01',
      Timestamp: '2026-10-31T12:00:00.000Z',
      Source_Module: 'FinanceGate',
      ClientID: 'CSV',
      Priority: 'Blocker',
      Category: 'Finance',
      Message: 'Deposit is overdue',
      Action_URL: 'Review the finance record',
      Dismissed_Status: false,
    }],
  });

  assert.equal(parsed.snapshot.clients[0]?.ContractValue, 3200);
  assert.equal(parsed.snapshot.projects[0]?.MilestonesTotal, 5);
  assert.equal(parsed.snapshot.projects[0]?.SprintStage, '05: Architecture & Builds');
  assert.equal(parsed.snapshot.financeRows[0]?.PaidDate, '2026-10-31T12:00:00.000Z');
  assert.equal(parsed.alerts[0]?.Department, 'Vala');
  assert.equal(parsed.alerts[0]?.Action_Status, 'Open');
  assert.deepEqual(parsed.fileCounts['services_rates.csv'], { loaded: 1, rejected: 0, ignored: 0 });
  assert.equal(parsed.rejectedRows.length, 0);
});

test('snapshot CSV mapping normalizes header casing and separators', () => {
  const parsed = parseSnapshotCsvFiles({
    ...emptyFiles,
    'clients.csv': [
      'client id,Company Name,Account Phase,contract value,Deposit Paid,Primary Contact',
      'ABC,Example Company,03: Active Sprints,"$1,250.00",Yes,Ada Example',
    ].join('\n'),
    'projects.csv': [
      'Project ID,Client ID,Stage,Total Milestones,Completed Milestones,Rate Tier,Project Name',
      'ABC-01,ABC,05: Architecture & Builds,4,2,Premium,Build project',
    ].join('\n'),
    'finances.csv': [
      'Invoice Number,Client ID,Invoice Amount,Payment Status,Due Date',
      'INV-ABC-26-001,ABC,"$1,250.00",Paid,2026-10-31',
    ].join('\n'),
    'alerts.csv': [
      'Alert ID,Timestamp,Source Module,Department,Client ID,Project ID,Priority,Message,Action URL,Assigned Lead,Status',
      'ALT-01,2026-10-31T12:00:00Z,FinanceGate,Vala,ABC,ABC-01,Blocker,Deposit required,Review invoice,Vala,Open',
    ].join('\n'),
    'services_rates.csv': 'Service ID,Service Name,Rate Tier,Rate\ncomp_demo,Demo Service,Normal,120',
  });

  assert.equal(parsed.snapshot.clients.length, 1);
  assert.equal(parsed.snapshot.clients[0].Company_Name, 'Example Company');
  assert.equal(parsed.snapshot.clients[0].ContractValue, 1250);
  assert.equal(parsed.snapshot.clients[0].AccountPhase, '03: Active Sprints');
  assert.equal(parsed.snapshot.projects[0].SprintStage, '05: Architecture & Builds');
  assert.equal(parsed.snapshot.financeRows[0].Amount, 1250);
  assert.equal(parsed.alerts[0].Severity, 'BLOCK');
  assert.equal(parsed.alerts[0].Prescribed_Action, 'Review invoice');
  assert.deepEqual(parsed.fileCounts['services_rates.csv'], { loaded: 1, rejected: 0, ignored: 0 });
  assert.deepEqual(parsed.unmappedColumns['clients.csv'], []);
  assert.deepEqual(parsed.unmappedColumns['projects.csv'], []);
  assert.deepEqual(parsed.unmappedColumns['finances.csv'], []);
  assert.deepEqual(parsed.unmappedColumns['alerts.csv'], []);
  assert.equal(parsed.rejectedRows.length, 0);
});

test('snapshot mapping preserves manual phase mode and rejects unsupported values', () => {
  const parsed = parseSnapshotCsvFiles({
    ...emptyFiles,
    'clients.csv': [
      'ClientID,Company_Name,AccountPhase,ContractValue,DepositPaid,AccountPhase_Mode',
      'ABC,Manual Client,02: Session Zero,100,true,manual',
      'ABD,Invalid Client,01: Intake,0,false,forced',
    ].join('\n'),
  });

  assert.equal(parsed.snapshot.clients[0]?.AccountPhase_Mode, 'manual');
  assert.equal(parsed.fileCounts['clients.csv'].loaded, 1);
  assert.equal(parsed.fileCounts['clients.csv'].rejected, 1);
  assert.match(parsed.rejectedRows[0]?.reason ?? '', /AccountPhase_Mode must be/);
});

test('invalid CSV rows are skipped and include a readable Zod reason', () => {
  const parsed = parseSnapshotCsvFiles({
    ...emptyFiles,
    'clients.csv': [
      'ClientID,Company_Name,AccountPhase,ContractValue,DepositPaid',
      'bad-id,,unknown,not-a-number,maybe',
    ].join('\n'),
    'finances.csv': 'InvoiceID,ClientID,Amount,Status\nINV-EXA-26-001,,100,Draft',
  });

  assert.equal(parsed.snapshot.clients.length, 0);
  assert.deepEqual(parsed.fileCounts['clients.csv'], { loaded: 0, rejected: 1, ignored: 0 });
  assert.equal(parsed.rejectedRows[0].fileName, 'clients.csv');
  assert.equal(parsed.rejectedRows[0].rowNumber, 2);
  assert.match(parsed.rejectedRows[0].reason, /ClientID|Company_Name|ContractValue|DepositPaid/);
  assert.match(parsed.rejectedRows.find((row) => row.fileName === 'finances.csv')?.reason ?? '', /missing ClientID/);
});

test('empty CSV files do not crash and report zero loaded and rejected rows', () => {
  const parsed = parseSnapshotCsvFiles({
    'clients.csv': '',
    'projects.csv': '',
    'finances.csv': '',
    'alerts.csv': '',
    'services_rates.csv': '',
  });

  assert.deepEqual(parsed.snapshot, { clients: [], projects: [], financeRows: [] });
  assert.deepEqual(parsed.alerts, []);
  assert.equal(parsed.rejectedRows.length, 0);
  assert.deepEqual(parsed.fileCounts['clients.csv'], { loaded: 0, rejected: 0, ignored: 0 });
});

test('realistic Master Control client and project IDs pass row validation', () => {
  const parsed = parseSnapshotCsvFiles({
    ...emptyFiles,
    'clients.csv': [
      'ClientID,Company_Name,AccountPhase,ContractValue,DepositPaid',
      'CSV,Sample Client,03: Active Sprints,3200,TRUE',
    ].join('\n'),
    'projects.csv': [
      'ProjectID,ClientID,SprintStage,MilestonesTotal,MilestonesDone,AssignedRateTier',
      'CSV-01,CSV,05: Architecture & Builds,10,2,Normal',
    ].join('\n'),
    'finances.csv': [
      'InvoiceID,ClientID,Amount,Status',
      'INV-TMP-26-001,CSV,100,Draft',
    ].join('\n'),
  });

  assert.equal(parsed.snapshot.clients[0]?.ClientID, 'CSV');
  assert.equal(parsed.snapshot.projects[0]?.ProjectID, 'CSV-01');
  assert.equal(parsed.snapshot.financeRows[0]?.InvoiceID, 'INV-TMP-26-001');
  assert.equal(parsed.rejectedRows.length, 0);
});

test('Master Control alert category and dismissed status map to HUD alert fields', () => {
  const parsed = parseSnapshotCsvFiles({
    ...emptyFiles,
    'alerts.csv': [
      'Alert_ID,Timestamp,Source_Module,ClientID,Priority,Category,Message,Action_URL,Dismissed_Status',
      'ALT-01,2026-10-31T12:00:00Z,FinanceGate,CSV,Blocker,Finance,Deposit is overdue,Review the finance record,FALSE',
      'ALT-02,2026-10-31T13:00:00Z,AlfredScheduler,,Info,Alfred,Reminder sent,Review status,TRUE',
    ].join('\n'),
  });

  assert.equal(parsed.alerts.length, 2);
  assert.equal(parsed.alerts[0].Department, 'Vala');
  assert.equal(parsed.alerts[0].Action_Status, 'Open');
  assert.equal(parsed.alerts[1].Department, 'Housekeeping');
  assert.equal(parsed.alerts[1].Action_Status, 'Resolved');
  assert.equal(parsed.rejectedRows.length, 0);
});

test('real export columns use legacy alert fallbacks and client milestones', () => {
  const parsed = parseSnapshotCsvFiles({
    ...emptyFiles,
    'clients.csv': [
      'ClientID,First_Name,Last_Name,Company_Name,ContactEmail,GoogleGroupEmail,Archetype,AccountPhase,ActiveRoadblock,ContractValue,DepositPaid,CurrentMilestone,CompletedMilestones,TotalMilestones,DriveFolderUrl,ChatSpaceUrl,NotesDocUrl,MSA_DocID,Tech_Stack,MCC_Subscriber_ID,Oracle_Baseline_ID',
      'ABX,Example,Client,,client@example.com,group@example.com,Delivery,02: Inception,Needs review,1200,TRUE,Delivery,2,4,,,,,Apps Script,sub-123,base-123',
    ].join('\n'),
    'projects.csv': [
      'ProjectID,ClientID,ProjectName,SprintStage,AssignedRateTier,SOW_DocID,Project_Brief_DocID,Project_Outline_DocID,COMS_Sheet_URL,Google_Tasklist_ID,MeetingNotes_DriveFolderID,ChatSpaceURL,ChatSpace_Internal_URL,Est_Hours,Actual_Hours,ParentProjectID,AddendumRef,ActiveComponents',
      'ABX-12,ABX,Example project,04: Session Zero Kickoff,Normal ($85),,,,,,,https://chat.example.com,,,,,,comp-example',
    ].join('\n'),
    'finances.csv': [
      'InvoiceID,ClientID,ProjectID,InvoiceNumber,MilestoneStage,TotalContractValue,DepositAmount,InvoiceAmount,DepositPaid,Remaining_Balance,InvoiceStatus,PaymentDate,Est_Hours_Allocation,Actual_Hours_Worked,EffectiveHourlyRate,EstimatedQuarterlyTax,OverheadCosts,NetMargin',
      'INV-EXA-26-001,ABX,ABX-12,EX-100,Deposit (1/3),1200,400,100,TRUE,1100,Draft,2026-10-31,10,2,50,100,20,80',
    ].join('\n'),
    'alerts.csv': [
      'Alert_ID,Timestamp,ClientID,Priority,Category,Message,Action_URL,Dismissed_Status,Created_At,Source_Module,Department,Client_ID,Project_ID,Severity,Trigger_Condition,Prescribed_Action,Assigned_Lead,Action_Status',
      'ALT-01,2026-10-31T12:00:00Z,ABX,CRITICAL,Graduation,Example alert,Review,FALSE,,,,,,,,,,',
    ].join('\n'),
  });

  assert.equal(parsed.snapshot.clients[0]?.Company_Name, 'Example Client');
  assert.equal(parsed.snapshot.clients[0]?.AccountPhase, '02: Session Zero');
  assert.equal(parsed.snapshot.clients[0]?.GoogleGroupEmail, 'group@example.com');
  assert.equal(parsed.snapshot.clients[0]?.Tech_Stack, 'Apps Script');
  assert.equal(parsed.snapshot.clients[0]?.PrimaryContact, 'Example Client');
  assert.equal(parsed.snapshot.projects[0]?.MilestonesTotal, 4);
  assert.equal(parsed.snapshot.projects[0]?.MilestonesDone, 2);
  assert.equal(parsed.snapshot.projects[0]?.AssignedRateTier, 'Normal');
  assert.equal(parsed.snapshot.projects[0]?.ChatSpace_URL, 'https://chat.example.com');
  assert.equal(parsed.snapshot.financeRows.length, 1);
  assert.equal(parsed.snapshot.financeRows[0]?.InvoiceID, 'INV-EXA-26-001');
  assert.equal(parsed.snapshot.financeRows[0]?.ProjectID, 'ABX-12');
  assert.equal(parsed.snapshot.financeRows[0]?.InvoiceNumber, 'EX-100');
  assert.equal(parsed.snapshot.financeRows[0]?.DepositAmount, 400);
  assert.equal(parsed.snapshot.financeRows[0]?.InvoiceAmount, 100);
  assert.equal(parsed.snapshot.financeRows[0]?.InvoiceStatus, 'Draft');
  assert.equal(parsed.snapshot.financeRows[0]?.PaymentDate, '2026-10-31');
  assert.equal(parsed.snapshot.financeRows[0]?.Remaining_Balance, 1100);
  assert.equal(parsed.snapshot.financeRows[0]?.Amount, 100);
  assert.equal(parsed.snapshot.financeRows[0]?.Status, 'Draft');
  assert.equal(parsed.alerts[0]?.Department, 'Daisy');
  assert.equal(parsed.alerts[0]?.Severity, 'BLOCK');
  assert.equal(parsed.alerts[0]?.Trigger_Condition, 'Example alert');
  assert.equal(parsed.alerts[0]?.Action_Status, 'Open');
  assert.deepEqual(parsed.unmappedColumns['clients.csv'], []);
  assert.deepEqual(parsed.unmappedColumns['projects.csv'], []);
  assert.deepEqual(parsed.unmappedColumns['finances.csv'], []);
  assert.deepEqual(parsed.unmappedColumns['alerts.csv'], []);
  assert.equal(parsed.rejectedRows.length, 0);
});

test('populated canonical alert columns override legacy fallbacks', () => {
  const headers = [
    'Alert_ID', 'Timestamp', 'ClientID', 'Priority', 'Category', 'Message', 'Action_URL',
    'Dismissed_Status', 'Created_At', 'Source_Module', 'Department', 'Client_ID', 'Project_ID',
    'Entity_Reference', 'Severity', 'Trigger_Condition', 'Prescribed_Action', 'Due_SLA',
    'Assigned_Lead', 'Action_Status', 'Resolved_At',
  ];
  const values = [
    'ALT-01', '2026-10-30T12:00:00Z', 'CSV', 'INFO', 'Graduation', 'Legacy message',
    'Legacy action', 'FALSE', '2026-10-31T12:00:00Z', 'FinanceGate', 'Vala', 'ABX', '',
    '', 'BLOCK', 'Canonical condition', 'Canonical action', '', 'Vala', 'Resolved', '',
  ];
  const parsed = parseSnapshotCsvFiles({
    ...emptyFiles,
    'alerts.csv': `${headers.join(',')}\n${values.join(',')}`,
  });

  assert.equal(parsed.alerts[0]?.Created_At, '2026-10-31T12:00:00.000Z');
  assert.equal(parsed.alerts[0]?.Department, 'Vala');
  assert.equal(parsed.alerts[0]?.Client_ID, 'ABX');
  assert.equal(parsed.alerts[0]?.Severity, 'BLOCK');
  assert.equal(parsed.alerts[0]?.Trigger_Condition, 'Canonical condition');
  assert.equal(parsed.alerts[0]?.Prescribed_Action, 'Canonical action');
  assert.equal(parsed.alerts[0]?.Action_Status, 'Resolved');
  assert.equal(parsed.rejectedRows.length, 0);
});

test('formula-only blank client and finance rows are ignored, not rejected', () => {
  const parsed = parseSnapshotCsvFiles({
    ...emptyFiles,
    'clients.csv': [
      'ClientID,Company_Name,AccountPhase,ContractValue,DepositPaid',
      'CSV,Example Co,03: Active Sprints,1000,TRUE',
      ',,,,FALSE',
    ].join('\n'),
    'finances.csv': [
      'InvoiceID,ClientID,Amount,Status,DepositPaid',
      'INV-TMP-26-001,CSV,100,Draft,FALSE',
      ',,,,FALSE',
    ].join('\n'),
  });

  assert.deepEqual(parsed.fileCounts['clients.csv'], { loaded: 1, rejected: 0, ignored: 1 });
  assert.deepEqual(parsed.fileCounts['finances.csv'], { loaded: 1, rejected: 0, ignored: 1 });
});

test('multiline quoted cells count as one CSV data row', async () => {
  const { countCsvDataRows } = await import('./snapshotData');
  assert.equal(countCsvDataRows('Name,Notes\nExample,"first line\nsecond line"\nNext,short\n'), 2);
});

test('finance contract rows load without an InvoiceID; only the malformed invoice is rejected', () => {
  const parsed = parseSnapshotCsvFiles({
    'clients.csv': 'ClientID,Company_Name,AccountPhase,ContractValue,DepositPaid\nPAC,[TEST] Prime Auto Collision,03: Active Sprints,12000,TRUE',
    'projects.csv': 'ProjectID,ClientID,SprintStage,AssignedRateTier\nPAC-01,PAC,06: Mid-Flight Review,Premium ($115)',
    'finances.csv': [
      'InvoiceID,ClientID,ProjectID,MilestoneStage,TotalContractValue,InvoiceAmount,InvoiceStatus',
      ',PAC,PAC-01,Contract,9000,,',
      'INV-PAC-26-001,PAC,PAC-01,Deposit (1/3),,3000,Paid',
      'INV-PAC-1,PAC,PAC-01,Retainer / Maintenance,,250,Draft',
    ].join('\n'),
    'alerts.csv': '',
    'services_rates.csv': '',
  });
  const rows = parsed.snapshot.financeRows;
  assert.equal(rows.length, 2);
  const contract = rows.find((row) => row.MilestoneStage === 'Contract');
  assert.equal(contract?.Amount, 9000);
  assert.equal(contract?.Status, 'Contract');
  assert.equal(parsed.rejectedRows.filter((row) => row.fileName === 'finances.csv').length, 1);
});
