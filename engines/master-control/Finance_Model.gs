/**
 * Vala finance model (Master Plan v3.1 section 3, Phase D1).
 * Finances is the master: each project has one contract row (MilestoneStage = Contract) where
 * TotalContractValue (TCV) is typed once. Invoice amounts, TotalContractDue and Remaining_Balance are computed.
 * Pure functions are prefixed vala_ and take plain records so they can be unit-tested.
 */

var VALA_CONTRACT = 'Contract';
var VALA_MILESTONES = ['Deposit (1/3)', 'Mid-Flight (1/3)', 'Liftoff & QA (1/3)'];
/** SprintStage index that issues each scheduled invoice: 02 deposit, 06 mid-flight, 08 final. */
var VALA_INVOICE_STAGES = [2, 6, 8];
var VALA_ISSUED_STATUSES = ['Sent', 'Paid', 'Overdue'];
/** Additive Finances columns (added to the right, logged in Schema_Change_Log and Schema_Registry). */
var VALA_NEW_COLUMNS = [
  { column: 'TotalContractDue', dataType: 'currency', impact: 'Computed sum of scheduled invoices; never typed. Must equal TCV.' },
  { column: 'Schedule_Deposit', dataType: 'currency', impact: 'Optional negotiated deposit amount (blank = one third).' },
  { column: 'Schedule_MidFlight', dataType: 'currency', impact: 'Optional negotiated stage 06 amount (blank = one third).' },
  { column: 'Schedule_Final', dataType: 'currency', impact: 'Optional negotiated stage 08 amount (blank = remainder).' },
  { column: 'AddendumRef', dataType: 'text', impact: 'Required to change TCV after the first invoice (R10).' },
  { column: 'TCV_At_First_Invoice', dataType: 'currency', impact: 'TCV recorded when the first invoice was issued (R10 baseline).' }
];

/* ---------- pure engine ---------- */

function vala_toCents_(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function vala_fromCents_(cents) { return cents / 100; }

function vala_isBlank_(value) { return value === '' || value === null || value === undefined; }

/** Default schedule: equal thirds with the remainder on the final invoice (in cents, so it always sums to TCV). */
function vala_defaultSchedule_(tcv) {
  const cents = vala_toCents_(tcv);
  const third = Math.floor(cents / 3);
  return [third, third, cents - 2 * third].map(vala_fromCents_);
}

/** Schedule for a contract row: negotiated amounts when all three are filled, otherwise the default. */
function vala_schedule_(contract) {
  const custom = [contract.Schedule_Deposit, contract.Schedule_MidFlight, contract.Schedule_Final];
  if (custom.every(function (value) { return !vala_isBlank_(value); })) return custom.map(Number);
  return vala_defaultSchedule_(contract.TotalContractValue);
}

function vala_sum_(values) {
  return vala_fromCents_(values.reduce(function (sum, value) { return sum + vala_toCents_(value); }, 0));
}

function vala_milestoneIndex_(stage) { return VALA_MILESTONES.indexOf(String(stage || '').trim()); }

function vala_isIssued_(row) { return VALA_ISSUED_STATUSES.indexOf(String(row.InvoiceStatus || '').trim()) !== -1; }

/** INV-<ClientID>-<YY>-<NNN>, NNN = that client's invoice count for the year (mirrors the HUD createInvoiceId). */
function vala_nextInvoiceId_(existingIds, clientId, issuedOn) {
  const prefix = 'INV-' + clientId + '-' + String(issuedOn.getFullYear()).slice(-2) + '-';
  const used = existingIds
    .filter(function (id) { return String(id).indexOf(prefix) === 0; })
    .map(function (id) { return Number(String(id).slice(prefix.length)); })
    .filter(function (value) { return Number.isInteger(value); });
  const next = (used.length ? Math.max.apply(null, used) : 0) + 1;
  return prefix + String(next).padStart(3, '0');
}

/**
 * Pure: the computed-cell updates for the Finances ledger.
 * rows: [{ rowNumber, ...Finances record }]. Returns [{ rowNumber, column, value }] for cells that differ.
 */
function vala_computeLedgerUpdates_(rows) {
  const updates = [];
  const set = function (row, column, value) {
    const current = row[column];
    const same = typeof value === 'number'
      ? !vala_isBlank_(current) && vala_toCents_(current) === vala_toCents_(value)
      : String(current == null ? '' : current) === String(value);
    if (!same) updates.push({ rowNumber: row.rowNumber, column: column, value: value });
  };
  const byProject = {};
  rows.forEach(function (row) {
    const projectId = String(row.ProjectID || '').trim();
    if (!projectId) return;
    (byProject[projectId] = byProject[projectId] || []).push(row);
  });
  Object.keys(byProject).forEach(function (projectId) {
    const group = byProject[projectId];
    const contracts = group.filter(function (row) { return row.MilestoneStage === VALA_CONTRACT; });
    if (contracts.length !== 1) return; // zero: no contract yet; several: R8-style problem, left for Police
    const contract = contracts[0];
    const schedule = vala_schedule_(contract);
    const invoices = group.filter(function (row) { return row.MilestoneStage !== VALA_CONTRACT; });
    set(contract, 'TotalContractDue', vala_sum_(schedule));
    invoices.forEach(function (row) {
      const index = vala_milestoneIndex_(row.MilestoneStage);
      if (index === -1) return; // extra invoice (retainer/addendum): amount stays as typed
      set(row, 'InvoiceAmount', schedule[index]);
      if (index === 0) set(row, 'DepositAmount', schedule[0]);
      if (String(row.InvoiceStatus || '').trim() === 'Paid' && index === 0 && row.DepositPaid !== true) set(row, 'DepositPaid', true);
    });
    const paid = invoices.filter(function (row) { return String(row.InvoiceStatus || '').trim() === 'Paid'; });
    const paidAmounts = paid.map(function (row) {
      const index = vala_milestoneIndex_(row.MilestoneStage);
      return index === -1 ? row.InvoiceAmount : schedule[index];
    });
    set(contract, 'Remaining_Balance', vala_fromCents_(vala_toCents_(contract.TotalContractValue) - vala_toCents_(vala_sum_(paidAmounts))));
    if (vala_isBlank_(contract.TCV_At_First_Invoice) && invoices.some(vala_isIssued_)) {
      set(contract, 'TCV_At_First_Invoice', Number(contract.TotalContractValue));
    }
  });
  return updates;
}

/**
 * Pure: the invoice row to create when a project reaches `stageIndex`, or null.
 * Deposit at 02, mid-flight at 06, final at 08; never duplicates an existing milestone row.
 */
function vala_invoiceForStage_(rows, projectId, clientId, stageIndex, issuedOn) {
  const milestone = VALA_INVOICE_STAGES.indexOf(stageIndex);
  if (milestone === -1) return null;
  const group = rows.filter(function (row) { return String(row.ProjectID || '').trim() === projectId; });
  const contracts = group.filter(function (row) { return row.MilestoneStage === VALA_CONTRACT; });
  if (contracts.length !== 1) return null;
  if (group.some(function (row) { return row.MilestoneStage === VALA_MILESTONES[milestone]; })) return null;
  const schedule = vala_schedule_(contracts[0]);
  const id = vala_nextInvoiceId_(rows.map(function (row) { return row.InvoiceID; }), clientId, issuedOn);
  return {
    InvoiceID: id,
    InvoiceNumber: id,
    ClientID: clientId,
    ProjectID: projectId,
    MilestoneStage: VALA_MILESTONES[milestone],
    InvoiceAmount: schedule[milestone],
    DepositAmount: milestone === 0 ? schedule[0] : '',
    DepositPaid: false,
    InvoiceStatus: 'Draft'
  };
}

/** Pure: the Clients.ContractValue roll-up formula for one row. */
function vala_contractValueFormula_(rowNumber, letters) {
  return '=SUMIFS(Finances!' + letters.tcv + ':' + letters.tcv + ',Finances!' + letters.client + ':' + letters.client
    + ',$' + letters.clientId + rowNumber + ',Finances!' + letters.stage + ':' + letters.stage + ',"' + VALA_CONTRACT + '")';
}

/* ---------- sheet helpers ---------- */

/** Records with their sheet row numbers; skips rows with no input in the key columns. */
function vala_readRecords_(sheet, keyColumns) {
  const values = sheet.getDataRange().getValues();
  if (!values.length) return { headers: [], rows: [] };
  const headers = values[0].map(function (value) { return String(value || '').trim(); });
  const rows = [];
  for (let index = 1; index < values.length; index += 1) {
    const record = { rowNumber: index + 1 };
    headers.forEach(function (header, column) { if (header) record[header] = values[index][column]; });
    const hasKey = keyColumns.some(function (name) { return !vala_isBlank_(record[name]) && String(record[name]).trim() !== ''; });
    if (hasKey) rows.push(record);
  }
  return { headers: headers, rows: rows };
}

/** Writes a record into the first row whose key columns are all blank (never below the formatted area). */
function vala_insertRecord_(sheet, record, keyColumns) {
  const headers = hud_getHeaders_(sheet);
  const maxRows = sheet.getMaxRows();
  const keys = keyColumns.map(function (name) { return headers.indexOf(name); }).filter(function (index) { return index !== -1; });
  const block = maxRows > 1 ? sheet.getRange(2, 1, maxRows - 1, headers.length).getValues() : [];
  let rowNumber = -1;
  for (let index = 0; index < block.length; index += 1) {
    if (keys.every(function (column) { return vala_isBlank_(block[index][column]) || String(block[index][column]).trim() === ''; })) {
      rowNumber = index + 2;
      break;
    }
  }
  if (rowNumber === -1) { sheet.insertRowAfter(maxRows); rowNumber = maxRows + 1; }
  const rules = sheet.getRange(rowNumber, 1, 1, headers.length).getDataValidations()[0];
  const row = headers.map(function (header, column) {
    const isCheckbox = rules[column] && String(rules[column].getCriteriaType()) === 'CHECKBOX';
    if (!Object.prototype.hasOwnProperty.call(record, header)) return isCheckbox ? false : '';
    return isCheckbox ? record[header] === true : record[header];
  });
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
  return rowNumber;
}

/** Adds the additive Finances columns (to the right) and registers them. Idempotent. */
function vala_ensureColumns_(spreadsheet, actor) {
  const sheet = hud_requireSheet_(spreadsheet, 'Finances');
  const added = [];
  VALA_NEW_COLUMNS.forEach(function (definition) {
    let headers = hud_getHeaders_(sheet);
    let index = headers.indexOf(definition.column);
    if (index === -1) {
      const next = headers.length + 1;
      if (sheet.getMaxColumns() < next) sheet.insertColumnAfter(sheet.getMaxColumns());
      sheet.getRange(1, next).setValue(definition.column);
      index = next - 1;
      added.push(definition.column);
    }
    hud_registerSchemaColumn_(spreadsheet, actor, {
      tab: 'Finances', column: definition.column, columnLetter: colLetter_(index + 1),
      dataType: definition.dataType, allowedValues: '*', required: 'no',
      changeType: 'Add column', impact: definition.impact
    });
  });
  return added;
}

/** Applies ledger updates to the Finances sheet. Returns the update list. */
function vala_recomputeFinances_(spreadsheet) {
  const sheet = hud_requireSheet_(spreadsheet, 'Finances');
  const data = vala_readRecords_(sheet, ['InvoiceID', 'ClientID', 'ProjectID']);
  const updates = vala_computeLedgerUpdates_(data.rows);
  updates.forEach(function (update) {
    const column = data.headers.indexOf(update.column);
    if (column === -1) return;
    sheet.getRange(update.rowNumber, column + 1).setValue(update.value);
  });
  return updates;
}

/**
 * Installs the Clients.ContractValue roll-up formula on client rows whose cell is blank or already
 * equals the roll-up. A typed value that differs is left alone so Police R1 can flag it.
 */
function vala_installContractValueFormulas_(spreadsheet) {
  const clients = hud_requireSheet_(spreadsheet, 'Clients');
  const finances = hud_requireSheet_(spreadsheet, 'Finances');
  const clientHeaders = hud_getHeaders_(clients);
  const financeHeaders = hud_getHeaders_(finances);
  const letters = {
    clientId: colLetter_(hud_requireColumn_(clientHeaders, 'ClientID') + 1),
    tcv: colLetter_(hud_requireColumn_(financeHeaders, 'TotalContractValue') + 1),
    client: colLetter_(hud_requireColumn_(financeHeaders, 'ClientID') + 1),
    stage: colLetter_(hud_requireColumn_(financeHeaders, 'MilestoneStage') + 1)
  };
  const valueColumn = hud_requireColumn_(clientHeaders, 'ContractValue') + 1;
  const rollup = vala_contractRollup_(vala_readRecords_(finances, ['InvoiceID', 'ClientID', 'ProjectID']).rows);
  const result = { installed: [], keptTyped: [] };
  vala_readRecords_(clients, ['ClientID']).rows.forEach(function (row) {
    const cell = clients.getRange(row.rowNumber, valueColumn);
    const formula = vala_contractValueFormula_(row.rowNumber, letters);
    if (cell.getFormula() === formula) return;
    const typed = row.ContractValue;
    const expected = rollup[String(row.ClientID).trim()] || 0;
    if (vala_isBlank_(typed) || vala_toCents_(typed) === vala_toCents_(expected)) {
      cell.setFormula(formula);
      result.installed.push(String(row.ClientID));
    } else {
      result.keptTyped.push({ clientId: String(row.ClientID), typed: Number(typed), rollup: expected });
    }
  });
  return result;
}

/**
 * Pure: plan to add `delta` to a project's contract-row TCV (Solar service attach, Phase G).
 * Refuses when there is no single contract row, or when invoicing has started (R10: a TCV change then needs an addendum).
 */
function vala_tcvIncreasePlan_(rows, projectId, delta) {
  const contracts = rows.filter(function (row) {
    return String(row.ProjectID || '').trim() === projectId && row.MilestoneStage === VALA_CONTRACT;
  });
  if (contracts.length === 0) {
    throw createRouterError_(projectId + ' has no Finances contract row yet, so a priced service cannot be added. '
      + 'Vala creates the contract row at stage 02.', 'NO_CONTRACT_ROW', 409);
  }
  if (contracts.length > 1) {
    throw createRouterError_(projectId + ' has more than one Finances contract row; fix that first (Police R8).', 'DUPLICATE_CONTRACT', 409);
  }
  const contract = contracts[0];
  if (!vala_isBlank_(contract.TCV_At_First_Invoice)) {
    throw createRouterError_(projectId + ' has started invoicing, so its contract value can only change through an addendum (Police R10).',
      'CONTRACT_INVOICED', 409);
  }
  const before = vala_isBlank_(contract.TotalContractValue) ? 0 : Number(contract.TotalContractValue);
  return { rowNumber: contract.rowNumber, before: before, after: vala_fromCents_(vala_toCents_(before) + vala_toCents_(delta)) };
}

function vala_planTcvIncrease_(spreadsheet, projectId, delta) {
  const sheet = hud_requireSheet_(spreadsheet, 'Finances');
  const data = vala_readRecords_(sheet, ['InvoiceID', 'ClientID', 'ProjectID']);
  const plan = vala_tcvIncreasePlan_(data.rows, projectId, delta);
  plan.column = hud_requireColumn_(data.headers, 'TotalContractValue') + 1;
  return plan;
}

/** Writes the planned TCV and recomputes the ledger (the Clients.ContractValue roll-up formula follows). Returns a rollback. */
function vala_applyTcvIncrease_(spreadsheet, plan) {
  const cell = hud_requireSheet_(spreadsheet, 'Finances').getRange(plan.rowNumber, plan.column);
  cell.setValue(plan.after);
  vala_recomputeFinances_(spreadsheet);
  return function () {
    cell.setValue(plan.before);
    vala_recomputeFinances_(spreadsheet);
  };
}

/** Pure: ClientID -> sum of that client's contract-row TCVs. */
function vala_contractRollup_(financeRows) {
  const out = {};
  financeRows.forEach(function (row) {
    if (row.MilestoneStage !== VALA_CONTRACT) return;
    const clientId = String(row.ClientID || '').trim();
    if (!clientId) return;
    out[clientId] = vala_sum_([out[clientId] || 0, row.TotalContractValue]);
  });
  return out;
}

/** Called inside an audited SprintStage write: creates the stage's invoice row. Returns a rollback. */
function vala_onStageReached_(spreadsheet, projectId, clientId, stageIndex) {
  const sheet = hud_requireSheet_(spreadsheet, 'Finances');
  const data = vala_readRecords_(sheet, ['InvoiceID', 'ClientID', 'ProjectID']);
  const invoice = vala_invoiceForStage_(data.rows, projectId, clientId, stageIndex, new Date());
  if (!invoice) return { created: null, rollback: function () {} };
  const rowNumber = vala_insertRecord_(sheet, invoice, ['InvoiceID', 'ClientID', 'ProjectID']);
  return {
    created: { rowNumber: rowNumber, invoiceId: invoice.InvoiceID, milestone: invoice.MilestoneStage, amount: invoice.InvoiceAmount },
    rollback: function () { sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).clearContent(); }
  };
}
