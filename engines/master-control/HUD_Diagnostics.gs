/**
 * READ-ONLY diagnostics (Master Plan v3.1, Phase B1 and B3).
 * Nothing here writes to any sheet. Run from the Apps Script editor:
 * pick `diagnoseHudWritePath` in the function dropdown, click Run, then read the Execution log.
 */

function diagnoseHudWritePath() {
  const report = diagnoseHudWritePath_();
  const text = JSON.stringify(report, null, 1);
  // The execution log truncates long entries, so print in chunks.
  for (let i = 0; i < text.length; i += 7000) console.log(text.slice(i, i + 7000));
  return report;
}

function diagnoseHudWritePath_() {
  const spreadsheet = getMasterControlSpreadsheet_();
  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetName: spreadsheet.getName(),
    clients: diag_describeClientValidation_(spreadsheet),
    registry: diag_describeRegistry_(spreadsheet),
    recentFailedWrites: diag_recentFailedWrites_(spreadsheet, 10),
    triggers: diag_listTriggers_()
  };
}

/** Lists installed triggers (read-only) so scheduled registry writers are visible. */
function diag_listTriggers_() {
  try {
    return ScriptApp.getProjectTriggers().map(function (trigger) {
      return {
        handler: trigger.getHandlerFunction(),
        event: String(trigger.getEventType()),
        source: String(trigger.getTriggerSource())
      };
    });
  } catch (error) {
    return { error: String(error && error.message || error) };
  }
}

function diag_ruleSignature_(rule) {
  if (!rule) return 'none';
  const type = String(rule.getCriteriaType());
  const values = rule.getCriteriaValues() || [];
  const shown = values.map(function (value) {
    if (Array.isArray(value)) return value.join(' | ');
    if (value && typeof value.getA1Notation === 'function') return 'range:' + value.getSheet().getName() + '!' + value.getA1Notation();
    return String(value);
  });
  return [
    type,
    'values=[' + shown.join(' ; ') + ']',
    'allowInvalid=' + rule.getAllowInvalid(),
    'help=' + (rule.getHelpText() || '')
  ].join(' :: ');
}

/** Groups consecutive rows that share an identical rule into ranges. */
function diag_columnRuleRanges_(sheet, columnNumber) {
  const lastRow = sheet.getMaxRows();
  if (lastRow < 2) return [];
  const rules = sheet.getRange(2, columnNumber, lastRow - 1, 1).getDataValidations();
  const ranges = [];
  let current = null;
  for (let index = 0; index < rules.length; index += 1) {
    const signature = diag_ruleSignature_(rules[index][0]);
    const row = index + 2;
    if (current && current.signature === signature) {
      current.toRow = row;
    } else {
      current = { fromRow: row, toRow: row, signature: signature };
      ranges.push(current);
    }
  }
  return ranges;
}

function diag_describeClientValidation_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Clients');
  if (!sheet) return { error: 'Clients sheet missing' };
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (value) { return String(value || '').trim(); });
  const idColumn = headers.indexOf('ClientID');
  const phaseColumn = headers.indexOf('AccountPhase');
  const modeColumn = headers.indexOf('AccountPhase_Mode');
  const rows = [];
  for (let index = 1; index < values.length; index += 1) {
    const id = String(values[index][idColumn] || '').trim();
    if (!id) continue;
    const rowNumber = index + 1;
    rows.push({
      row: rowNumber,
      clientId: id,
      phase: String(values[index][phaseColumn] || ''),
      mode: modeColumn === -1 ? '(no column)' : String(values[index][modeColumn] || ''),
      phaseRule: diag_ruleSignature_(sheet.getRange(rowNumber, phaseColumn + 1).getDataValidation()),
      modeRule: modeColumn === -1 ? 'n/a' : diag_ruleSignature_(sheet.getRange(rowNumber, modeColumn + 1).getDataValidation())
    });
  }
  return {
    maxRows: sheet.getMaxRows(),
    lastColumn: sheet.getLastColumn(),
    headers: headers,
    accountPhaseColumn: phaseColumn === -1 ? null : colLetter_(phaseColumn + 1),
    accountPhaseModeColumn: modeColumn === -1 ? null : colLetter_(modeColumn + 1),
    phaseRuleRanges: phaseColumn === -1 ? [] : diag_columnRuleRanges_(sheet, phaseColumn + 1),
    modeRuleRanges: modeColumn === -1 ? [] : diag_columnRuleRanges_(sheet, modeColumn + 1),
    rows: rows
  };
}

function diag_describeRegistry_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Schema_Registry');
  if (!sheet) return { error: 'Schema_Registry sheet missing' };
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (value) { return String(value || '').trim(); });
  const col = function (name) { return headers.indexOf(name); };
  const required = ['Data_Type', 'Data_Class', 'Owner_Persona', 'Allowed_Values'];
  const seen = {};
  const duplicates = {};
  const incomplete = [];
  const accountPhaseRows = [];
  for (let index = 1; index < values.length; index += 1) {
    const row = values[index];
    const tab = String(row[col('Tab')] || '').trim();
    const name = String(row[col('Column_Name')] || '').trim();
    if (!tab && !name) continue;
    const key = String(row[col('Database')] || '').trim() + '|' + tab + '|' + name;
    if (seen[key]) duplicates[key] = (duplicates[key] || 1) + 1;
    seen[key] = true;
    const missing = required.filter(function (field) {
      return col(field) === -1 || !String(row[col(field)] || '').trim();
    });
    // Mirror the HUD contract (apps/command-hud/src/data/contracts.ts SchemaRegistryRowSchema).
    const enumChecks = {
      Data_Type: ['text', 'number', 'date', 'enum', 'id', 'currency', 'boolean', 'json'],
      Data_Class: ['public', 'internal', 'pii', 'secret'],
      Required: ['yes', 'no']
    };
    Object.keys(enumChecks).forEach(function (field) {
      const value = col(field) === -1 ? '' : String(row[col(field)] || '').trim();
      if (value && enumChecks[field].indexOf(value) === -1) missing.push(field + '(bad:' + value + ')');
      if (!value && field === 'Required') missing.push('Required');
    });
    if (missing.length) incomplete.push({ row: index + 1, key: key, missing: missing, registryId: String(row[col('Registry_ID')] || '') });
    if (name === 'AccountPhase' || name === 'AccountPhase_Mode') {
      accountPhaseRows.push({ row: index + 1, key: key, allowedValues: String(row[col('Allowed_Values')] || ''), dataType: String(row[col('Data_Type')] || '') });
    }
  }
  return {
    headers: headers,
    totalRows: values.length - 1,
    uniqueKeys: Object.keys(seen).length,
    duplicateKeys: duplicates,
    incompleteCount: incomplete.length,
    incomplete: incomplete,
    accountPhaseRows: accountPhaseRows
  };
}

function diag_recentFailedWrites_(spreadsheet, limit) {
  const sheet = spreadsheet.getSheetByName('HUD_Audit_Log');
  if (!sheet) return { error: 'HUD_Audit_Log sheet missing' };
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (value) { return String(value || '').trim(); });
  const out = [];
  for (let index = values.length - 1; index >= 1 && out.length < limit; index -= 1) {
    const record = {};
    headers.forEach(function (header, column) { record[header] = String(values[index][column] || ''); });
    if (record.Status !== 'Confirmed') out.push(Object.assign({ row: index + 1 }, record));
  }
  return out;
}

/**
 * Phase G1 (Master Plan v3.1): READ-ONLY. Logs the newest HUD_Audit_Log rows in a compact form so the owner can
 * paste them as evidence for the live write acceptance checks. Writes nothing.
 */
function inspectHudAuditLog() {
  const sheet = getMasterControlSpreadsheet_().getSheetByName('HUD_Audit_Log');
  if (!sheet || sheet.getLastRow() < 2) { console.log('HUD_Audit_Log is empty.'); return []; }
  const rows = diag_auditDigest_(sheet.getDataRange().getValues(), 40);
  const text = rows.join('\n');
  for (let i = 0; i < text.length; i += 7000) console.log(text.slice(i, i + 7000));
  return rows;
}

/** Pure: newest-first one-line digests: time | action | entity | status | before -> after (trimmed) | error. */
function diag_auditDigest_(values, limit) {
  const headers = values[0].map(function (h) { return String(h).trim(); });
  const col = function (name) { return headers.indexOf(name); };
  const cell = function (row, name) {
    const value = col(name) === -1 ? '' : row[col(name)];
    return value instanceof Date ? value.toISOString() : String(value == null ? '' : value);
  };
  return values.slice(1).reverse().slice(0, limit).map(function (row) {
    const short = function (text) { return text.length > 160 ? text.slice(0, 157) + '...' : text; };
    let afterText = cell(row, 'After');
    let timing = '';
    try {
      const parsed = JSON.parse(afterText || '{}');
      if (parsed && parsed._timings) {
        const t = parsed._timings;
        const s = function (ms) { return typeof ms === 'number' ? (ms / 1000).toFixed(1) + 's' : '?'; };
        timing = 'TIMINGS total ' + s(t.totalMs) + ', lock wait ' + s(t.lockMs) + ', audit setup ' + s(t.auditSetupMs - t.lockMs)
          + ', prepare ' + s(t.prepareMs - t.auditSetupMs) + ', apply ' + s(t.applyMs - t.prepareMs)
          + ', police ' + s(t.totalMs - (t.auditConfirmMs || t.readBackMs))
          + (t.policeLedgerMs !== undefined ? ' (ledger ' + s(t.policeLedgerMs) + ', read ' + s(t.policeReadMs) + ', alerts ' + s(t.policeAlertsMs) + ')' : '');
        delete parsed._timings;
        afterText = JSON.stringify(parsed);
      }
    } catch (error) { /* not JSON */ }
    return [cell(row, 'Timestamp').slice(0, 19), cell(row, 'Action'), cell(row, 'Entity'), cell(row, 'Status'),
      short(cell(row, 'Before')) + ' -> ' + short(afterText), timing, cell(row, 'Error')].filter(function (part, index) { return index < 5 || part; }).join(' | ');
  });
}
