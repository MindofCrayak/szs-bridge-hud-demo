/**
 * Police reconciliation rules R1-R10 (Master Plan v3.1 section 3, Phase D2).
 * Each finding becomes one deduplicated Alfred_Alerts row (Alert_ID = POL-<rule>-<entity>) naming both
 * cells and both values, a severity and a prescribed action. Findings that clear are auto-resolved.
 */

var POLICE_ID_PATTERNS = {
  ClientID: /^[A-Z]{3}\d{0,2}$/,
  ProjectID: /^[A-Z]{3}\d{0,2}-\d{2,3}$/,
  InvoiceID: /^INV-[A-Z]{3}\d{0,2}-\d{2}-\d{3,}$/
};
var POLICE_R9_COLUMNS = ['Project_Brief_DocID', 'Project_Outline_DocID', 'ChatSpaceURL', 'ChatSpace_Internal_URL', 'Google_Tasklist_ID', 'Dashboard_Sheet_ID'];
var POLICE_SOURCE = 'Police';

function police_text_(value) { return String(value == null ? '' : value).trim(); }
function police_money_(value) {
  return '$' + Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function police_stageIndex_(stage) { return HUD_WRITE_SPRINT_STAGES.indexOf(police_text_(stage)); }
function police_isTrue_(value) { return value === true || /^(true|yes|y|1)$/i.test(police_text_(value)); }

/**
 * Pure. data = { clients, projects, finances } (records with rowNumber) and letters = { Clients: {col: 'J'}, ... }.
 * Returns findings: { id, rule, severity, department, clientId, projectId, cells, condition, action, resolvable }.
 */
function police_reconcile_(data, letters) {
  const findings = [];
  const cell = function (tab, column, row) {
    const letter = letters[tab] && letters[tab][column];
    return tab + '!' + (letter || column) + row;
  };
  const add = function (finding) { findings.push(finding); };
  const clients = data.clients || [];
  const projects = data.projects || [];
  const finances = data.finances || [];
  const projectIds = {};
  projects.forEach(function (p) { projectIds[police_text_(p.ProjectID)] = p; });
  const rollup = vala_contractRollup_(finances);

  // R1: Clients.ContractValue vs sum of project TCVs.
  clients.forEach(function (c) {
    const id = police_text_(c.ClientID);
    if (!id) return;
    const contracts = finances.filter(function (f) { return police_text_(f.ClientID) === id && f.MilestoneStage === VALA_CONTRACT; });
    if (!contracts.length && vala_isBlank_(c.ContractValue)) return;
    const expected = rollup[id] || 0;
    if (vala_toCents_(c.ContractValue) === vala_toCents_(expected)) return;
    add({
      id: 'POL-R1-' + id, rule: 'R1', severity: 'BLOCK', department: 'Vala', clientId: id, projectId: '',
      cells: [cell('Clients', 'ContractValue', c.rowNumber)].concat(contracts.map(function (f) { return cell('Finances', 'TotalContractValue', f.rowNumber); })),
      condition: 'Clients ContractValue ' + cell('Clients', 'ContractValue', c.rowNumber) + ' = ' + police_money_(c.ContractValue)
        + ', but the Finances contract rows (' + contracts.map(function (f) { return cell('Finances', 'TotalContractValue', f.rowNumber); }).join(', ')
        + ') sum to ' + police_money_(expected) + '.',
      action: 'Use the Finances value (restores the roll-up formula), or use the Clients value if the contract total changed.',
      resolvable: { kind: 'contractValue', clientId: id, financesValue: expected, clientsValue: Number(c.ContractValue || 0), contractRows: contracts.length }
    });
  });

  finances.forEach(function (f) {
    const invoiceId = police_text_(f.InvoiceID);
    const label = invoiceId || ('contract ' + police_text_(f.ProjectID) || ('row ' + f.rowNumber));
    // R2: no ClientID, or ProjectID not in Projects.
    if (!police_text_(f.ClientID)) {
      add({ id: 'POL-R2-ROW' + f.rowNumber, rule: 'R2', severity: 'BLOCK', department: 'Vala', clientId: '', projectId: police_text_(f.ProjectID),
        cells: [cell('Finances', 'ClientID', f.rowNumber)],
        condition: 'Finances row ' + f.rowNumber + ' (' + label + ') has no ClientID.',
        action: 'Fill in the ClientID on this Finances row, or remove the row.' });
    }
    if (police_text_(f.ProjectID) && !projectIds[police_text_(f.ProjectID)]) {
      add({ id: 'POL-R2-' + (invoiceId || 'ROW' + f.rowNumber), rule: 'R2', severity: 'BLOCK', department: 'Vala',
        clientId: police_text_(f.ClientID), projectId: police_text_(f.ProjectID),
        cells: [cell('Finances', 'ProjectID', f.rowNumber)],
        condition: 'Finances ' + cell('Finances', 'ProjectID', f.rowNumber) + ' = ' + police_text_(f.ProjectID) + ', which is not in Projects.',
        action: 'Correct the ProjectID or add the project to Projects.' });
    }
  });

  // Per project: R3, R4, R5, R10.
  const byProject = {};
  finances.forEach(function (f) { const p = police_text_(f.ProjectID); if (p) (byProject[p] = byProject[p] || []).push(f); });
  Object.keys(byProject).forEach(function (projectId) {
    const group = byProject[projectId];
    const contract = group.filter(function (f) { return f.MilestoneStage === VALA_CONTRACT; })[0];
    if (!contract) return;
    const clientId = police_text_(contract.ClientID);
    const tcv = Number(contract.TotalContractValue || 0);
    const invoices = group.filter(function (f) { return f.MilestoneStage !== VALA_CONTRACT; });
    // R3
    if (!vala_isBlank_(contract.TotalContractDue) && vala_toCents_(contract.TotalContractDue) !== vala_toCents_(tcv)) {
      add({ id: 'POL-R3-' + projectId, rule: 'R3', severity: 'BLOCK', department: 'Vala', clientId: clientId, projectId: projectId,
        cells: [cell('Finances', 'TotalContractDue', contract.rowNumber), cell('Finances', 'TotalContractValue', contract.rowNumber)],
        condition: projectId + ' TotalContractDue ' + police_money_(contract.TotalContractDue) + ' differs from TCV ' + police_money_(tcv) + '.',
        action: 'Fix the schedule columns on the contract row so the three amounts add up to the TCV.' });
    }
    // R4
    const issued = invoices.filter(vala_isIssued_);
    const issuedSum = vala_sum_(issued.map(function (f) { return f.InvoiceAmount; }));
    if (vala_toCents_(issuedSum) > vala_toCents_(tcv)) {
      add({ id: 'POL-R4-' + projectId, rule: 'R4', severity: 'BLOCK', department: 'Vala', clientId: clientId, projectId: projectId,
        cells: issued.map(function (f) { return cell('Finances', 'InvoiceAmount', f.rowNumber); }).concat([cell('Finances', 'TotalContractValue', contract.rowNumber)]),
        condition: projectId + ' issued invoices total ' + police_money_(issuedSum) + ', more than TCV ' + police_money_(tcv) + '.',
        action: 'Void the extra invoice or record an addendum that raises the TCV.' });
    }
    // R5
    invoices.filter(function (f) { return vala_milestoneIndex_(f.MilestoneStage) === 0; }).forEach(function (f) {
      const paid = police_text_(f.InvoiceStatus) === 'Paid';
      if (paid === police_isTrue_(f.DepositPaid)) return;
      add({ id: 'POL-R5-' + (police_text_(f.InvoiceID) || projectId), rule: 'R5', severity: 'WARN', department: 'Vala', clientId: clientId, projectId: projectId,
        cells: [cell('Finances', 'DepositPaid', f.rowNumber), cell('Finances', 'InvoiceStatus', f.rowNumber)],
        condition: 'Deposit ' + police_text_(f.InvoiceID) + ': DepositPaid is ' + police_isTrue_(f.DepositPaid) + ' but InvoiceStatus is "' + police_text_(f.InvoiceStatus) + '".',
        action: 'Make DepositPaid match the invoice status.' });
    });
    // R10
    if (!vala_isBlank_(contract.TCV_At_First_Invoice) && vala_toCents_(contract.TCV_At_First_Invoice) !== vala_toCents_(tcv)
        && !police_text_(contract.AddendumRef)) {
      add({ id: 'POL-R10-' + projectId, rule: 'R10', severity: 'BLOCK', department: 'Vala', clientId: clientId, projectId: projectId,
        cells: [cell('Finances', 'TotalContractValue', contract.rowNumber), cell('Finances', 'TCV_At_First_Invoice', contract.rowNumber)],
        condition: projectId + ' TCV changed from ' + police_money_(contract.TCV_At_First_Invoice) + ' to ' + police_money_(tcv)
          + ' after the first invoice, with no AddendumRef.',
        action: 'Fill in AddendumRef on the contract row, or restore the original TCV.' });
    }
  });

  // R6, R7, R9 per project/client.
  clients.forEach(function (c) {
    const id = police_text_(c.ClientID);
    if (!id || police_text_(c.AccountPhase_Mode).toLowerCase() !== 'auto') return;
    const own = projects.filter(function (p) { return police_text_(p.ClientID) === id; });
    if (!own.length) return;
    let derived = '';
    try { derived = hud_deriveAccountPhase_(own, id, police_text_(c.AccountPhase)); } catch (error) { return; }
    if (derived === police_text_(c.AccountPhase)) return;
    add({ id: 'POL-R6-' + id, rule: 'R6', severity: 'INFO', department: 'Pamela', clientId: id, projectId: '',
      cells: [cell('Clients', 'AccountPhase', c.rowNumber)],
      condition: id + ' AccountPhase is "' + police_text_(c.AccountPhase) + '" but its projects derive "' + derived + '".',
      action: 'Use Reset to auto in the HUD, or switch the client to manual.' });
  });
  projects.forEach(function (p) {
    const projectId = police_text_(p.ProjectID);
    const clientId = police_text_(p.ClientID);
    const stage = police_stageIndex_(p.SprintStage);
    const client = clients.filter(function (c) { return police_text_(c.ClientID) === clientId; })[0];
    if (stage >= 4) {
      const missing = [];
      const depositPaid = finances.some(function (f) { return police_text_(f.ClientID) === clientId && police_isTrue_(f.DepositPaid); });
      if (!depositPaid) missing.push('DepositPaid');
      if (!client || !police_text_(client.MSA_DocID)) missing.push('MSA_DocID');
      if (!police_text_(p.SOW_DocID)) missing.push('SOW_DocID');
      if (missing.length) {
        add({ id: 'POL-R7-' + projectId, rule: 'R7', severity: 'BLOCK', department: 'Pamela', clientId: clientId, projectId: projectId,
          cells: [cell('Projects', 'SprintStage', p.rowNumber)],
          condition: projectId + ' is at ' + police_text_(p.SprintStage) + ' without ' + missing.join(', ') + '.',
          action: 'Record the missing items, or move the project back before stage 04.' });
      }
    }
    if (stage > 3) {
      const absent = POLICE_R9_COLUMNS.filter(function (name) { return Object.prototype.hasOwnProperty.call(p, name) && !police_text_(p[name]); });
      if (absent.length) {
        add({ id: 'POL-R9-' + projectId, rule: 'R9', severity: 'WARN', department: 'Dolores', clientId: clientId, projectId: projectId,
          cells: absent.map(function (name) { return cell('Projects', name, p.rowNumber); }),
          condition: projectId + ' is past stage 03 but is missing: ' + absent.join(', ') + '.',
          action: 'Create the missing Brief/Outline docs, Chat Spaces, task list, or dashboard.' });
      }
    }
  });

  // R8: malformed (WARN) or duplicate (BLOCK) IDs.
  [['Clients', clients, 'ClientID'], ['Projects', projects, 'ProjectID'], ['Finances', finances, 'InvoiceID']].forEach(function (spec) {
    const seen = {};
    spec[1].forEach(function (row) {
      const value = police_text_(row[spec[2]]);
      if (!value) return; // contract rows have no InvoiceID by design; blank ClientIDs are R2
      if (!POLICE_ID_PATTERNS[spec[2]].test(value)) {
        add({ id: 'POL-R8-' + value, rule: 'R8', severity: 'WARN', department: 'Housekeeping', clientId: police_text_(row.ClientID), projectId: police_text_(row.ProjectID),
          cells: [cell(spec[0], spec[2], row.rowNumber)],
          condition: spec[0] + ' ' + cell(spec[0], spec[2], row.rowNumber) + ' "' + value + '" is not a valid ' + spec[2] + '.',
          action: 'Correct the ID to the standard format (section 3).' });
      }
      (seen[value] = seen[value] || []).push(row.rowNumber);
    });
    Object.keys(seen).forEach(function (value) {
      if (seen[value].length < 2) return;
      add({ id: 'POL-R8-DUP-' + value, rule: 'R8', severity: 'BLOCK', department: 'Housekeeping', clientId: '', projectId: '',
        cells: seen[value].map(function (row) { return cell(spec[0], spec[2], row); }),
        condition: spec[2] + ' "' + value + '" appears on ' + seen[value].length + ' rows.',
        action: 'Keep one row and correct or remove the others.' });
    });
  });

  return findings;
}

/* ---------- alert upsert ---------- */

/** Pure: the Alfred_Alerts record for a finding. */
function police_alertRecord_(finding, now) {
  const message = '[' + finding.rule + '] ' + finding.condition;
  return {
    Alert_ID: finding.id, Timestamp: now, Created_At: now, Source_Module: POLICE_SOURCE, Department: finding.department,
    ClientID: finding.clientId, Client_ID: finding.clientId, Project_ID: finding.projectId,
    Entity_Reference: finding.cells.join(', '), Severity: finding.severity, Priority: finding.severity,
    Category: 'Police ' + finding.rule, Message: message, Trigger_Condition: message, Prescribed_Action: finding.action,
    Assigned_Lead: finding.department, Action_Status: 'Open', Dismissed_Status: false, Resolved_At: ''
  };
}

/** Writes findings as deduplicated alerts and resolves Police alerts whose condition cleared. */
function police_syncAlerts_(spreadsheet, findings) {
  const sheet = hud_requireSheet_(spreadsheet, 'Alfred_Alerts');
  const headers = hud_getHeaders_(sheet);
  const data = vala_readRecords_(sheet, ['Alert_ID']);
  const byId = {};
  data.rows.forEach(function (row) { byId[police_text_(row.Alert_ID)] = row; });
  const now = new Date().toISOString();
  const result = { created: [], updated: [], reopened: [], resolved: [] };
  const write = function (rowNumber, record) {
    Object.keys(record).forEach(function (name) {
      const column = headers.indexOf(name);
      if (column !== -1) sheet.getRange(rowNumber, column + 1).setValue(record[name]);
    });
  };
  const active = {};
  findings.forEach(function (finding) {
    active[finding.id] = true;
    const record = police_alertRecord_(finding, now);
    const existing = byId[finding.id];
    if (!existing) {
      vala_insertRecord_(sheet, record, ['Alert_ID']);
      result.created.push(finding.id);
      return;
    }
    const changes = {};
    ['Trigger_Condition', 'Message', 'Entity_Reference', 'Severity', 'Priority', 'Prescribed_Action'].forEach(function (name) {
      if (police_text_(existing[name]) !== police_text_(record[name])) changes[name] = record[name];
    });
    if (police_text_(existing.Action_Status) === 'Resolved') {
      changes.Action_Status = 'Open'; changes.Dismissed_Status = false; changes.Resolved_At = '';
      result.reopened.push(finding.id);
    } else if (Object.keys(changes).length) {
      result.updated.push(finding.id);
    }
    if (Object.keys(changes).length) write(existing.rowNumber, changes);
  });
  data.rows.forEach(function (row) {
    const id = police_text_(row.Alert_ID);
    if (id.indexOf('POL-') !== 0 || active[id] || police_text_(row.Action_Status) === 'Resolved') return;
    write(row.rowNumber, { Action_Status: 'Resolved', Dismissed_Status: true, Resolved_At: now });
    result.resolved.push(id);
  });
  return result;
}

/** Column letters per tab, for naming cells in findings. */
function police_letters_(spreadsheet) {
  const out = {};
  ['Clients', 'Projects', 'Finances'].forEach(function (tab) {
    out[tab] = {};
    hud_getHeaders_(hud_requireSheet_(spreadsheet, tab)).forEach(function (header, index) { if (header) out[tab][header] = colLetter_(index + 1); });
  });
  return out;
}

/** Full reconciliation: recompute the ledger, evaluate R1-R10, sync alerts. Caller holds the lock. */
function police_runReconciliation_(spreadsheet, timings) {
  const t0 = Date.now();
  const ledger = vala_recomputeFinances_(spreadsheet);
  SpreadsheetApp.flush();
  if (timings) timings.policeLedgerMs = Date.now() - t0;
  const data = {
    clients: vala_readRecords_(hud_requireSheet_(spreadsheet, 'Clients'), ['ClientID']).rows,
    projects: vala_readRecords_(hud_requireSheet_(spreadsheet, 'Projects'), ['ProjectID', 'ClientID']).rows,
    finances: vala_readRecords_(hud_requireSheet_(spreadsheet, 'Finances'), ['InvoiceID', 'ClientID', 'ProjectID']).rows
  };
  const findings = police_reconcile_(data, police_letters_(spreadsheet));
  if (timings) timings.policeReadMs = Date.now() - t0 - timings.policeLedgerMs;
  const alerts = police_syncAlerts_(spreadsheet, findings);
  if (timings) timings.policeAlertsMs = Date.now() - t0 - timings.policeLedgerMs - timings.policeReadMs;
  return { ledgerUpdates: ledger.length, findings: findings.map(function (f) { return f.id + ' ' + f.severity; }), alerts: alerts };
}
