/**
 * SZS CENTRAL ROUTER & POLICE ENGINE (Master Control)
 * Author: Drake Austin / Session Zero Solutions
 * Description: The authoritative API and synchronization engine for the SZS ecosystem.
 */

const SYSTEM_CONFIG = {
  get ACTIVE_DRIVE_FOLDER_ID() {
    return PropertiesService.getScriptProperties().getProperty('ACTIVE_DRIVE_FOLDER_ID') || '';
  },
  get ORACLE_DB_ID() {
    return PropertiesService.getScriptProperties().getProperty('ORACLE_DB_ID') || '';
  },
  get MCC_DB_ID() {
    return PropertiesService.getScriptProperties().getProperty('MCC_DB_ID') || '';
  },
  get MASTER_CONTROL_SHEET_ID() {
    return PropertiesService.getScriptProperties().getProperty('MASTER_CONTROL_SHEET_ID') || '';
  }
};

function getMasterControlSpreadsheet_() {
  const configuredId = PropertiesService.getScriptProperties().getProperty('MASTER_CONTROL_SHEET_ID');
  if (configuredId) return SpreadsheetApp.openById(configuredId);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('MASTER_CONTROL_SHEET_ID is required when the script is not bound to a spreadsheet.');
}

// ============================================================================
// 1. THE WEBHOOK ROUTER (doPost)
// ============================================================================

function doPost(e) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    getAuthorizedMasterControlUser_();
    if (!e || !e.postData || typeof e.postData.contents !== 'string') {
      return buildResponse_(400, 'A JSON request body is required.');
    }
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch {
      throw createRouterError_('The request body is not valid JSON.', 'INVALID_JSON', 400);
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return buildResponse_(400, 'The request body must be a JSON object.');
    }

    lock.waitLock(30000);
    lockAcquired = true;

    let responseData = {};

    switch (payload.action) {
      case 'graduateLead':
        return buildResponse_(501, 'Lead graduation is disabled until its idempotency and provisioning controls are verified.');
      // 2026-11-06: 'updateKanban' removed. It changed stages without an audit row; the HUD uses hud_write setSprintStage.
      case 'attachClientServiceNode':
        responseData = attachClientServiceNode_(payload);
        break;

      default:
        return buildResponse_(400, 'Unknown action.');
    }

    return buildResponse_(200, 'Success', responseData);

  } catch (error) {
    console.error('Central Router Error:', error);
    if (!error || (error.code !== 'UNAUTHORIZED' && (!error.statusCode || error.statusCode >= 500))) {
      try {
        logAlfredAlert_('SYSTEM', 'CRITICAL', 'Webhook Router Error', error.message);
      } catch (alertError) {
        console.error('Failed to persist router error alert:', alertError);
      }
    }
    const status = error && error.statusCode ? error.statusCode : 500;
    const message = error && error.statusCode ? error.message : 'Internal Server Error';
    return buildResponse_(status, message, {
      code: error && error.code ? error.code : 'ROUTER_ERROR',
      details: error && error.details ? error.details : undefined
    });
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}

function buildResponse_(code, message, data = {}) {
  return ContentService.createTextOutput(JSON.stringify({
    status: code,
    message: message,
    data: data
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// BULLETPROOF: MINT CLIENT ID
// ============================================================================

function mintClientID_(sheet, rawName) {
  // Master Plan v3.1 section 3: 3-letter company abbreviation; on collision append a digit, no hyphen (PAC, PAC2).
  const baseID = clientIdBase_(rawName);

  const lastRow = sheet ? sheet.getLastRow() : 0;
  let existingIDs = [];
  if (lastRow > 1) {
    existingIDs = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat()
      .map(id => String(id).trim().toUpperCase());
  }

  if (!existingIDs.includes(baseID)) return baseID;
  for (let counter = 2; counter <= 99; counter++) {
    const candidate = baseID + counter;
    if (!existingIDs.includes(candidate)) return candidate;
  }
  throw new Error('No free ClientID remains for ' + baseID + '.');
}

function clientIdBase_(rawName) {
  const words = String(rawName || '').toUpperCase().match(/[A-Z]+/g) || [];
  if (!words.length) return 'CLT';
  if (words.length >= 3) return words.slice(0, 3).map(word => word[0]).join('');
  let base = words.map(word => word[0]).join('');
  const filler = words[words.length - 1].slice(1) + words[0].slice(1);
  for (let index = 0; base.length < 3 && index < filler.length; index++) base += filler[index];
  while (base.length < 3) base += 'X';
  return base;
}

// ============================================================================
// BULLETPROOF: EXECUTE LEAD GRADUATION
// ============================================================================

// Parked until Phase Q (Lead DB overhaul): not called; graduateLead returns 501. Known bugs listed in docs/archive/PROGRESS_v3.1.md (Phase D1).
function executeLeadGraduation_(leadData) {
  const ss = getMasterControlSpreadsheet_();
  const clientsSheet = findSheetFlexible_(ss, ['Clients']);
  const projectsSheet = findSheetFlexible_(ss, ['Projects']);
  const financesSheet = findSheetFlexible_(ss, ['Finances']);

  if (!clientsSheet || !projectsSheet || !financesSheet) {
    throw new Error('Could not locate Clients, Projects, or Finances tab in Master Control.');
  }

  // Support both Company_Name and Company headers
  const company = leadData.Company_Name || leadData.Company || 'New Client';
  const firstName = leadData.First_Name || '';
  const lastName = leadData.Last_Name || '';
  const email = leadData.Email || '';
  const techStack = leadData.Tech_Stack_Current || leadData.Tech_Stack || '';
  const estValue = Number(leadData.Est_Value || leadData['Est._Value'] || 0);
  const depositAmt = Math.round(estValue / 3);

  // 1. Mint Smart Client ID
  const clientID = mintClientID_(clientsSheet, company);
  const projectID = `${clientID}-01`;
  const invoiceID = `INV-${clientID}-01`;
  const groupEmail = `client-${clientID.toLowerCase()}@sessionzero.solutions`;

  // 2. Provision Complete Drive Architecture & Documents
  let artifacts = null;
  try {
    artifacts = provisionClientDriveArchitecture_(clientID, projectID, invoiceID, {
      Company_Name: company,
      First_Name: firstName,
      Last_Name: lastName,
      Email: email,
      Phone: leadData.Phone || '',
      Est_Value: estValue,
      Tech_Stack_Current: techStack,
      Lead_Source: leadData.Lead_Source || '',
      GBP_Status: leadData.GBP_Status || '',
      Inboxes_Needed: leadData.Inboxes_Needed || ''
    });
  } catch (err) {
    console.error('Drive Provisioning Error:', err);
    logAlfredAlert_(clientID, 'CRITICAL', 'Drive Provisioning Failed', err.message);
  }

  const driveUrl = artifacts ? artifacts.clientFolderUrl : 'PROVISIONING_FAILED';
  const kickoffNotesUrl = artifacts ? artifacts.kickoffDocUrl : '';
  const msaId = artifacts ? artifacts.msaDocId : '';
  const sowId = artifacts ? artifacts.sowDocId : '';
  const notesFolderId = artifacts ? artifacts.meetingNotesFolderId : '';

  // 3. Write to Master Control: Clients
  clientsSheet.appendRow([
    clientID, firstName, lastName, company, email,
    groupEmail, '', '02: Session Zero', '', estValue, false, 'Session Zero Audit', 
    0, 5, driveUrl, '', kickoffNotesUrl, msaId, techStack, '', ''
  ]);

  // 4. Write to Master Control: Projects
  projectsSheet.appendRow([
    projectID, clientID, 'Initial Project Build', '02: Session Zero', 'Normal ($85)',
    sowId, '', '', '', '', notesFolderId, '', '', 0, 0
  ]);

  // 5. Write to Master Control: Finances
  financesSheet.appendRow([
    invoiceID, clientID, projectID, invoiceID, 'Deposit (1/3)', estValue, depositAmt, depositAmt,
    false, (estValue - depositAmt), 'Draft', '', 0, 0, 0, (depositAmt * 0.25), 0, '67%'
  ]);

  // 6. Push to Oracle Baseline
  pushToOracleBaseline_(clientID, {
    Company_Name: company,
    First_Name: firstName,
    Last_Name: lastName,
    Tech_Stack_Current: techStack
  });

  // 7. Push to Mail Command Center (MCC)
  const mccSubId = pushToMailCommandCenter_(clientID, {
    Email: email,
    First_Name: firstName,
    Last_Name: lastName
  });

  // 8. Update MCC_Subscriber_ID in Master Control: Clients
  if (mccSubId) {
    const clientsLastRow = clientsSheet.getLastRow();
    clientsSheet.getRange(clientsLastRow, 20).setValue(mccSubId); // Col T: MCC_Subscriber_ID
  }

  logAlfredAlert_(clientID, 'INFO', 'Graduation', `Lead ${company} graduated. ID: ${clientID}. Provisioned across Drive, Oracle, and MCC.`);

  return { 
    clientID: clientID, 
    projectID: projectID, 
    folderUrl: driveUrl 
  };
}

// ============================================================================
// UPDATED: ORACLE HANDSHAKE (FEEDS TAB 1 & TAB 5)
// ============================================================================

function pushToOracleBaseline_(clientID, leadData) {
  if (!SYSTEM_CONFIG.ORACLE_DB_ID) return;
  
  try {
    const oracleSS = SpreadsheetApp.openById(SYSTEM_CONFIG.ORACLE_DB_ID);
    
    // 1. Seed Tab 1: Baseline
    const baselineSheet = findSheetFlexible_(oracleSS, ['1_Client_Baseline', 'Client Baseline', 'Baseline']);
    if (baselineSheet) {
      baselineSheet.appendRow([
        new Date().toISOString(), clientID, leadData.Company_Name, 
        `${leadData.First_Name} ${leadData.Last_Name}`.trim(), '', '', '', 
        leadData.Tech_Stack_Current || ''
      ]);
    }

    // 2. Seed Tab 5: Sourcebook Generation
    const sourcebookSheet = findSheetFlexible_(oracleSS, ['5_Sourcebook_Generation', 'Sourcebook Generation', 'Sourcebook']);
    if (sourcebookSheet) {
      sourcebookSheet.appendRow([
        clientID, 
        leadData.Company_Name, 
        0, // Initial Thought Leadership Score
        getFormattedCurrentDate_(), 
        '', 
        '', 
        '' // Sourcebook Deck link staged for Phase 3
      ]);
    }
  } catch (e) {
    logAlfredAlert_(clientID, 'WARNING', 'Oracle Sync Failed', e.message);
  }
}

// ============================================================================
// 4. THE POLICE ENGINE (RESILIENT AUDIT)
// ============================================================================
function runSystemPoliceAudit() {
  getAuthorizedPoliceAuditUser_();
  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  try {
    lock.waitLock(30000);
    lockAcquired = true;
    runSystemPoliceAuditBody_();
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}

function runSystemPoliceAuditBody_() {
  console.log('Running Master Control Police Audit...');
  const ss = getMasterControlSpreadsheet_();
  const clientsSheet = findSheetFlexible_(ss, ['Clients']);
 
  if (!clientsSheet) {
    console.error('Clients tab not found in Master Control.');
    return;
  }
  const lastRow = clientsSheet.getLastRow();
  if (lastRow < 2) {
    console.log('No client rows to audit in Master Control.');
    return;
  }
 
  const clientData = clientsSheet.getRange(2, 1, lastRow - 1, 6).getValues();
  // Indexes: 0=ClientID, 1=First, 2=Last, 3=Company, 4=ContactEmail, 5=GroupEmail

  // 1. Audit Oracle Sync
  if (SYSTEM_CONFIG.ORACLE_DB_ID) {
    try {
      const oracleSS = SpreadsheetApp.openById(SYSTEM_CONFIG.ORACLE_DB_ID);
      const baselineSheet = findSheetFlexible_(oracleSS, [
        '1_Client_Baseline', 'Client Baseline', '1. Client Baseline', 'Baseline'
      ]);
     
      if (!baselineSheet) {
        logAlfredAlert_('SYSTEM', 'WARNING', 'Police Engine', 'Oracle Baseline tab not found. Check tab names.');
      } else {
        const oracleLastRow = baselineSheet.getLastRow();
        if (oracleLastRow >= 2) {
          const oracleData = baselineSheet.getRange(2, 1, oracleLastRow - 1, 5).getValues();
          // Index 1 is Client_ID, Index 3 is Owner_Name
          clientData.forEach(mcRow => {
            const mcID = String(mcRow[0]).trim();
            const mcOwner = `${mcRow[1]} ${mcRow[2]}`.trim();
           
            if (!mcID) return;
            const oracleRowIndex = oracleData.findIndex(oRow => String(oRow[1]).trim() === mcID);
            if (oracleRowIndex !== -1 && String(oracleData[oracleRowIndex][3]).trim() !== mcOwner) {
              // Master Control wins: overwrite Oracle's Owner Name
              baselineSheet.getRange(oracleRowIndex + 2, 4).setValue(mcOwner);
              logAlfredAlert_(mcID, 'INFO', 'Police Engine', `Force-synced Owner Name to Oracle for ${mcID}`);
            }
          });
        }
      }
    } catch (err) {
      console.error('Oracle audit check failed:', err.message);
      logAlfredAlert_('SYSTEM', 'WARNING', 'Police Engine Error', err.message);
    }
  }

  // 2. Audit MCC Email Sync (Master Control wins via external_id)
  if (SYSTEM_CONFIG.MCC_DB_ID) {
    try {
      const mccSS = SpreadsheetApp.openById(SYSTEM_CONFIG.MCC_DB_ID);
      const subSheet = findSheetFlexible_(mccSS, ['Subscribers', 'Subscriber_List']);
     
      if (subSheet && subSheet.getLastRow() > 1) {
        const subData = subSheet.getRange(2, 1, subSheet.getLastRow() - 1, 8).getValues();
        clientData.forEach(mcRow => {
          const mcID = String(mcRow[0]).trim().toUpperCase();
          const mcEmail = String(mcRow[4]).trim().toLowerCase();
          
          if (!mcID || !mcEmail) return;
          
          const subIndex = subData.findIndex(sRow => String(sRow[7]).trim().toUpperCase() === mcID);
          if (subIndex !== -1) {
            const currentMccEmail = String(subData[subIndex][1]).trim().toLowerCase();
            if (currentMccEmail !== mcEmail) {
              subSheet.getRange(subIndex + 2, 2).setValue(mcEmail); // Force-update Col B (email)
              logAlfredAlert_(mcID, 'INFO', 'Police Engine', `Force-synced email to MCC for ${mcID}`);
            }
          }
        });
      }
    } catch (err) {
      console.error('MCC police audit check failed:', err.message);
    }
  }



  console.log('Police Audit completed successfully.');
}
// ============================================================================
// HELPER: FUZZY TAB FINDER
// ============================================================================

function findSheetFlexible_(ss, possibleNames) {
  for (let name of possibleNames) {
    let s = ss.getSheetByName(name);
    if (s) return s;
  }
  const sheets = ss.getSheets();
  for (let s of sheets) {
    const sClean = s.getName().toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let name of possibleNames) {
      const targetClean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (sClean.includes(targetClean) || targetClean.includes(sClean)) {
        return s;
      }
    }
  }
  return null;
}

// ============================================================================
// 5. ALFRED TELEMETRY LOGGING
// ============================================================================

function logAlfredAlert_(clientID, priority, category, message) {
  appendAlertRecord_({
    Alert_ID: `ALT-${Utilities.getUuid()}`,
    Timestamp: new Date().toISOString(),
    ClientID: clientID,
    Priority: priority,
    Category: category,
    Message: sanitizeAlertText_(message),
    Action_URL: '',
    Dismissed_Status: false
  });
}

function appendAlertRecord_(alert) {
  const ss = getMasterControlSpreadsheet_();
  const alertSheet = ss.getSheetByName('Alfred_Alerts');
  if (!alertSheet) throw new Error('The Alfred_Alerts sheet is unavailable.');

  const lastColumn = alertSheet.getLastColumn();
  if (lastColumn < 1) throw new Error('The Alfred_Alerts sheet has no header row.');
  const headers = alertSheet.getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(value => String(value).trim());
  const requiredHeaders = [
    'Alert_ID', 'Timestamp', 'ClientID', 'Priority',
    'Category', 'Message', 'Action_URL', 'Dismissed_Status'
  ];
  if (requiredHeaders.some(header => !headers.includes(header))) {
    throw new Error('The Alfred_Alerts sheet does not match the required alert schema.');
  }

  alertSheet.appendRow(headers.map(header =>
    Object.prototype.hasOwnProperty.call(alert, header) ? alert[header] : ''
  ));
}

// ============================================================================
// 6. THE HUD DATA FEED (doGet)
// ============================================================================

// ============================================================================
// HELPER: BUILD HUD PAYLOAD & CALCULATE TELEMETRY
// ============================================================================

function sanitizeAlertText_(value) {
  return String(value == null ? '' : value)
    .replace(/\b(api[_-]?key|secret|token|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/https?:\/\/\S+/gi, '[REDACTED_URL]')
    .replace(/\b[A-Za-z0-9_-]{25,}\b/g, '[REDACTED_ID]');
}

// ============================================================================
// 7. PATHWAY 3: MAIL COMMAND CENTER (MCC) SUBSCRIBER SYNC (NATIVE SCHEMA)
// ============================================================================

function pushToMailCommandCenter_(clientID, leadData) {
  if (!SYSTEM_CONFIG.MCC_DB_ID) {
    console.log('MCC Sync skipped: MCC_DB_ID not configured.');
    return null;
  }
  // ... rest of the function

  try {
    const mccSS = SpreadsheetApp.openById(SYSTEM_CONFIG.MCC_DB_ID);
    const subSheet = findSheetFlexible_(mccSS, ['Subscribers', 'Subscriber_List', 'MCC_Subscribers']);
    
    if (!subSheet) {
      logAlfredAlert_(clientID, 'WARNING', 'MCC Sync', 'Subscribers tab not found in MCC database.');
      return null;
    }

    const email = String(leadData.Email || '').trim().toLowerCase();
    const firstName = String(leadData.First_Name || '').trim();
    const lastName = String(leadData.Last_Name || '').trim();
    const subscriberID = `sub_${clientID.toLowerCase()}_${Math.random().toString(36).substring(2, 7)}`;
    const defaultNewsletter = 'sz_newsletter';

    const lastRow = subSheet.getLastRow();
    let existingRowIndex = -1;
    
    if (lastRow > 1) {
      // Col B (Index 1) is email, Col H (Index 7) is external_id
      const data = subSheet.getRange(2, 1, lastRow - 1, 8).getValues();
      existingRowIndex = data.findIndex(row => 
        String(row[1]).trim().toLowerCase() === email || 
        String(row[7]).trim().toUpperCase() === clientID.toUpperCase()
      );
    }

    if (existingRowIndex === -1) {
      // Matches MCC native schema:
      // [subscriber_id, email, first_name, last_name, subscribed_newsletters, status, source, external_id, created_at]
      subSheet.appendRow([
        subscriberID,
        email,
        firstName,
        lastName,
        defaultNewsletter,
        'active',
        'master_control',
        clientID, // external_id foreign key
        new Date().toISOString()
      ]);
      console.log(`Enrolled ${clientID} (${email}) into MCC.`);
      return subscriberID;
    } else {
      // Record exists: update status, source, and link external_id
      const targetRow = existingRowIndex + 2;
      subSheet.getRange(targetRow, 6).setValue('active');         // Col F: status
      subSheet.getRange(targetRow, 7).setValue('master_control');  // Col G: source
      subSheet.getRange(targetRow, 8).setValue(clientID);          // Col H: external_id
      console.log(`Linked existing MCC record for ${clientID} at row ${targetRow}.`);
      return subSheet.getRange(targetRow, 1).getValue();           // Col A: subscriber_id
    }

  } catch (error) {
    console.error('MCC Sync Failed:', error);
    logAlfredAlert_(clientID, 'WARNING', 'MCC Sync Failed', error.message);
    return null;
  }
}



function attachClientServiceNode(payload) {
  getAuthorizedMasterControlUser_();
  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  let result = null;

  try {
    lock.waitLock(30000);
    lockAcquired = true;
    result = attachClientServiceNode_(payload, { deferTaskSync: true });
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
  // Owner 2026-11-05 (lock timeouts): the template task sync (one Tasks call per task) runs after the lock is
  // released, so other saves do not wait 30+ s behind it. It touches only the project's Google Tasks list.
  if (result && result.pendingTaskSyncProjectId) {
    const projectId = result.pendingTaskSyncProjectId;
    const projectsSheet = result.pendingTaskSyncSheet;
    delete result.pendingTaskSyncProjectId;
    delete result.pendingTaskSyncSheet;
    try {
      const sync = dolores_syncAfterAttach_(projectsSheet, projectId);
      result.tasksCreated = sync.added;
      result.taskSync = sync.message;
    } catch (taskError) {
      result.tasksFailed = 1;
      result.taskSync = 'Task sync failed: ' + (taskError && taskError.message ? taskError.message : String(taskError));
      console.error('Task sync after attach failed.', taskError);
    }
  }
  return result;
}

function attachClientServiceNode_(payload, options) {
  const deferTaskSync = Boolean(options && options.deferTaskSync);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createRouterError_('A service attachment object is required.', 'INVALID_REQUEST', 400);
  }
  const clientId = String(payload.clientId == null ? '' : payload.clientId).trim();
  const serviceId = String(payload.serviceId == null ? '' : payload.serviceId).trim();
  const priceDelta = Number(payload.priceDelta);
  // Catalog decision 2026-11-05: new components start unpriced, so 0 is allowed (no money change).
  if (!clientId || !serviceId || !Number.isFinite(priceDelta) || priceDelta < 0) {
    throw createRouterError_('ClientID, serviceId, and a priceDelta of 0 or more are required.', 'INVALID_REQUEST', 400);
  }

  const taskTitles = payload.tasks == null ? [] : payload.tasks;
  if (!Array.isArray(taskTitles) || taskTitles.some(task => typeof task !== 'string' || !task.trim())) {
    throw createRouterError_('tasks must be an array of non-empty task titles.', 'INVALID_REQUEST', 400);
  }

  const spreadsheet = getMasterControlSpreadsheet_();
  const clientsSheet = spreadsheet.getSheetByName('Clients');
  const projectsSheet = spreadsheet.getSheetByName('Projects');
  if (!clientsSheet || !projectsSheet) {
    throw new Error('The Clients and Projects sheets are required for service attachment.');
  }

  const clientValues = clientsSheet.getDataRange().getValues();
  const projectValues = projectsSheet.getDataRange().getValues();
  if (clientValues.length < 2 || projectValues.length < 2) {
    throw createRouterError_('A matching client and project record are required.', 'CLIENT_NOT_FOUND', 404);
  }

  const clientHeaders = clientValues[0].map(value => String(value).trim());
  const projectHeaders = projectValues[0].map(value => String(value).trim());
  const clientIdColumn = clientHeaders.indexOf('ClientID');
  const contractValueColumn = clientHeaders.indexOf('ContractValue');
  const projectClientIdColumn = projectHeaders.indexOf('ClientID');
  const activeComponentsColumn = projectHeaders.indexOf('ActiveComponents');
  if (clientIdColumn === -1 || contractValueColumn === -1
      || projectClientIdColumn === -1 || activeComponentsColumn === -1) {
    throw new Error('Clients.ClientID, Clients.ContractValue, Projects.ClientID, and Projects.ActiveComponents are required.');
  }

  const matchingClients = clientValues.slice(1)
    .map((row, index) => ({ row, sheetRow: index + 2 }))
    .filter(item => String(item.row[clientIdColumn]).trim() === clientId);
  if (matchingClients.length === 0) {
    throw createRouterError_('The requested client was not found.', 'CLIENT_NOT_FOUND', 404);
  }
  if (matchingClients.length > 1) {
    throw createRouterError_('Master Control contains duplicate ClientID records.', 'DUPLICATE_CLIENT', 409);
  }

  // Phase G: the HUD sends the Solar project (payload.projectId), so clients with several projects can attach.
  const requestedProjectId = String(payload.projectId == null ? '' : payload.projectId).trim();
  const projectIdHeader = projectHeaders.indexOf('ProjectID');
  const matchingProjects = projectValues.slice(1)
    .map((row, index) => ({ row, sheetRow: index + 2 }))
    .filter(item => String(item.row[projectClientIdColumn]).trim() === clientId)
    .filter(item => !requestedProjectId || String(item.row[projectIdHeader]).trim() === requestedProjectId);
  if (matchingProjects.length === 0) {
    throw createRouterError_(requestedProjectId
      ? 'Project ' + requestedProjectId + ' was not found for the requested client.'
      : 'No project record is associated with the requested client.', 'PROJECT_NOT_FOUND', 404);
  }
  if (matchingProjects.length > 1) {
    throw createRouterError_(requestedProjectId
      ? 'Master Control contains duplicate records for project ' + requestedProjectId + '.'
      : 'This client has several projects; open the project in Solar and drop the service there.', 'AMBIGUOUS_PROJECT', 409);
  }

  const clientRecord = matchingClients[0];
  const projectRecord = matchingProjects[0];
  const currentValueRaw = clientRecord.row[contractValueColumn];
  const currentValue = currentValueRaw == null || currentValueRaw === '' ? 0 : Number(currentValueRaw);
  if (!Number.isFinite(currentValue)) {
    throw new Error('Clients.ContractValue must contain a finite number.');
  }

  const currentComponents = parseActiveComponents_(projectRecord.row[activeComponentsColumn]);
  if (currentComponents.includes(serviceId)) {
    return {
      success: true,
      alreadyAttached: true,
      updatedValue: currentValue,
      activeComponents: currentComponents,
      tasksCreated: 0,
      tasksFailed: 0
    };
  }

  // Phase G (parked fix): money goes to the project's Finances contract-row TCV, never to Clients.ContractValue,
  // which is the Finances roll-up formula (Phase D). Planned before any write, so a refusal changes nothing.
  const attachProjectId = String(projectRecord.row[projectIdHeader]).trim();
  const tcvPlan = priceDelta > 0 ? vala_planTcvIncrease_(spreadsheet, attachProjectId, priceDelta) : null;
  const updatedValue = currentValue + priceDelta;
  const updatedComponents = [...currentComponents, serviceId];
  const projectCell = projectsSheet.getRange(projectRecord.sheetRow, activeComponentsColumn + 1);
  const previousComponents = projectRecord.row[activeComponentsColumn] || '';
  let projectWriteAttempted = false;
  let financeRollback = null;
  try {
    projectWriteAttempted = true;
    projectCell.setValue(updatedComponents.join(','));
    if (tcvPlan) financeRollback = vala_applyTcvIncrease_(spreadsheet, tcvPlan);
  } catch (writeError) {
    if (projectWriteAttempted) {
      try {
        if (financeRollback) financeRollback();
        projectCell.setValue(previousComponents);
      } catch (rollbackError) {
        console.error('Service attachment rollback failed; inspect Master Control before retrying.', rollbackError);
        throw createRouterError_(
          'Service attachment could not be completed or rolled back; inspect Master Control before retrying.',
          'PARTIAL_SERVICE_WRITE',
          500
        );
      }
    }
    throw writeError;
  }

  // Catalog decision 2026-11-05: template tabs are the only task source. The payload's task titles are ignored;
  // the component's mapped tab is added to the project's own list (only missing Keys), if the list exists yet.
  let tasksCreated = 0;
  let tasksFailed = 0;
  let taskSync = '';
  try {
    SpreadsheetApp.flush();
    if (deferTaskSync) {
      taskSync = 'deferred';
    } else {
      const sync = dolores_syncAfterAttach_(projectsSheet, attachProjectId);
      tasksCreated = sync.added;
      taskSync = sync.message;
    }
  } catch (taskError) {
    tasksFailed = 1;
    taskSync = 'Task sync failed: ' + (taskError && taskError.message ? taskError.message : String(taskError));
    console.error(`Task sync after attaching ${serviceId} failed.`, taskError);
  }

  return {
    success: true,
    alreadyAttached: false,
    updatedValue,
    activeComponents: updatedComponents,
    projectId: attachProjectId,
    ...(deferTaskSync ? { pendingTaskSyncProjectId: attachProjectId, pendingTaskSyncSheet: projectsSheet } : {}),
    tcv: tcvPlan ? { before: tcvPlan.before, after: tcvPlan.after } : null,
    tasksCreated,
    tasksFailed,
    taskSync
  };
}

function parseActiveComponents_(value) {
  if (Array.isArray(value)) {
    return value.map(component => String(component).trim()).filter(Boolean);
  }
  const text = String(value == null ? '' : value).trim();
  if (!text) return [];
  if (text.charAt(0) === '[') {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Projects.ActiveComponents contains invalid JSON.');
    }
    if (!Array.isArray(parsed)) {
      throw new Error('Projects.ActiveComponents must be a JSON array or comma-separated list.');
    }
    return parsed.map(component => String(component).trim()).filter(Boolean);
  }
  return text.split(',').map(component => component.trim()).filter(Boolean);
}
