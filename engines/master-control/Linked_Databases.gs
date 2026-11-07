/**
 * Phase H (owner 2026-11-05): point the Working Copy at the MCC and Oracle "working master" databases listed in the
 * template registry. Setting ORACLE_DB_ID / MCC_DB_ID turns on the 15-minute Police sync, which writes the Master
 * Control owner name into Oracle's baseline and the Master Control email into MCC's Subscribers, where a ClientID
 * already matches. So: preview first (read-only), then apply.
 *   previewLinkedDatabases()   READ-ONLY: tabs, headers, and every change the sync would make.
 *   applyLinkedDatabases()     sets the two Script Properties (only if blank or already these IDs).
 * No Oracle internals are read beyond the baseline columns the existing sync already uses.
 */

var LINKED_DATABASES = {
  ORACLE_DB_ID: { id: '1iz-cWvW8SHu9dLyBoI-ATQ8p0sHiZeCt3ndYJyF2hwE', name: 'Oracle Master Marketing Database', tabs: ['1_Client_Baseline', 'Client Baseline', '1. Client Baseline', 'Baseline'] },
  MCC_DB_ID: { id: '1Dsnn9UG_4BFqA1FlE6N9LNgoEadlfWZpDka2kZxYCFo', name: 'Mail Command Center', tabs: ['Subscribers', 'Subscriber_List'] }
};

/** Pure: the sync's planned changes. Mirrors runSystemPoliceAuditBody_ (Oracle col B id / col D owner; MCC col H id / col B email). */
function linked_planChanges_(clientRows, oracleRows, mccRows) {
  const out = { oracle: [], mcc: [] };
  clientRows.forEach(function (row) {
    const id = String(row[0] || '').trim();
    if (!id) return;
    const owner = (String(row[1] || '') + ' ' + String(row[2] || '')).trim();
    const email = String(row[4] || '').trim().toLowerCase();
    const o = oracleRows.findIndex(function (r) { return String(r[1] || '').trim() === id; });
    if (o !== -1 && String(oracleRows[o][3] || '').trim() !== owner) out.oracle.push({ clientId: id, row: o + 2, from: String(oracleRows[o][3] || ''), to: owner });
    const m = mccRows.findIndex(function (r) { return String(r[7] || '').trim().toUpperCase() === id.toUpperCase(); });
    if (email && m !== -1 && String(mccRows[m][1] || '').trim().toLowerCase() !== email) out.mcc.push({ clientId: id, row: m + 2, from: String(mccRows[m][1] || ''), to: email });
  });
  return out;
}

function linked_inspect_(key) {
  const def = LINKED_DATABASES[key];
  const ss = SpreadsheetApp.openById(def.id);
  const sheet = findSheetFlexible_(ss, def.tabs);
  const info = { name: ss.getName(), tabs: ss.getSheets().map(function (s) { return s.getName(); }), syncTab: sheet ? sheet.getName() : '(none found)' };
  if (sheet) {
    const lastColumn = Math.max(8, sheet.getLastColumn());
    info.headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
    info.rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues() : [];
    info.dataRows = info.rows.length;
  }
  return info;
}

/** Owner entry point. READ-ONLY. */
function previewLinkedDatabases() {
  const clients = getMasterControlSpreadsheet_().getSheetByName('Clients');
  const clientRows = clients.getLastRow() > 1 ? clients.getRange(2, 1, clients.getLastRow() - 1, 6).getValues() : [];
  const report = { readOnly: true, clientsHeaders: clients.getRange(1, 1, 1, 6).getDisplayValues()[0], current: {} };
  Object.keys(LINKED_DATABASES).forEach(function (key) {
    report.current[key] = PropertiesService.getScriptProperties().getProperty(key) || '(not set)';
    try { report[key] = linked_inspect_(key); } catch (error) { report[key] = { error: String(error && error.message || error) }; }
  });
  const plan = linked_planChanges_(clientRows, (report.ORACLE_DB_ID.rows || []), (report.MCC_DB_ID.rows || []));
  ['ORACLE_DB_ID', 'MCC_DB_ID'].forEach(function (key) { if (report[key]) delete report[key].rows; });
  report.syncWouldChange = plan;
  report.note = 'Column check: the sync expects Clients A=ClientID B=First C=Last E=ContactEmail; Oracle B=Client_ID D=Owner_Name; MCC B=email H=external_id. Compare with the headers above before applying.';
  return dolores_report_(report);
}

/** Owner entry point: sets ORACLE_DB_ID and MCC_DB_ID (refuses to overwrite a different existing value). */
function applyLinkedDatabases() {
  const props = PropertiesService.getScriptProperties();
  const out = {};
  Object.keys(LINKED_DATABASES).forEach(function (key) {
    const current = props.getProperty(key) || '';
    const wanted = LINKED_DATABASES[key].id;
    if (current && current !== wanted) { out[key] = 'kept existing ' + current + ' (differs; not overwritten)'; return; }
    SpreadsheetApp.openById(wanted); // fails loudly if not readable
    props.setProperty(key, wanted);
    out[key] = current ? 'already set' : 'set to ' + wanted;
  });
  return dolores_report_(out);
}
