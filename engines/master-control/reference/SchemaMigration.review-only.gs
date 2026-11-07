/**
 * SZS CRM DATABASE SCHEMA SYNCHRONIZER & MIGRATION ENGINE
 * Author: Drake Austin / Session Zero Solutions
 */

const SCHEMA_MIGRATION_CONFIG = {
  get MASTER_CONTROL_ID() { return PropertiesService.getScriptProperties().getProperty('MASTER_CONTROL_ID') || ''; },
  get LEAD_DB_ID() { return PropertiesService.getScriptProperties().getProperty('LEAD_DB_ID') || ''; },
  get ORACLE_DB_ID() { return PropertiesService.getScriptProperties().getProperty('ORACLE_DB_ID') || ''; }
};

function runFullDatabaseSchemaMigration() {
  Logger.log('>>> Starting Full Database Schema Migration across ALL tabs...');

  // 1. MASTER CONTROL
  const mcSpreadsheet = SCHEMA_MIGRATION_CONFIG.MASTER_CONTROL_ID 
    ? SpreadsheetApp.openById(SCHEMA_MIGRATION_CONFIG.MASTER_CONTROL_ID) 
    : SpreadsheetApp.getActiveSpreadsheet();

  if (mcSpreadsheet) {
    Logger.log('--- Processing Master Control Tabs ---');
    migrateMasterControlClients(mcSpreadsheet);
    migrateMasterControlProjects(mcSpreadsheet);
    migrateMasterControlFinances(mcSpreadsheet);
    createServicesRatesTab(mcSpreadsheet);
    createAlfredAlertsTab(mcSpreadsheet);
  }

  // 2. LEAD DATABASE (Main_Lead_Log + Calc_Metrics)
  if (SCHEMA_MIGRATION_CONFIG.LEAD_DB_ID) {
    Logger.log('--- Processing Lead Database Tabs ---');
    const leadSpreadsheet = SpreadsheetApp.openById(SCHEMA_MIGRATION_CONFIG.LEAD_DB_ID);
    migrateLeadDatabase(leadSpreadsheet);
    migrateLeadDbCalcMetrics(leadSpreadsheet);
  } else {
    Logger.log('SKIPPED: LEAD_DB_ID not defined.');
  }

  // 3. ORACLE MARKETING DATABASE (Tabs 1 through 5)
  if (SCHEMA_MIGRATION_CONFIG.ORACLE_DB_ID) {
    Logger.log('--- Processing Oracle Database Tabs 1-5 ---');
    const oracleSpreadsheet = SpreadsheetApp.openById(SCHEMA_MIGRATION_CONFIG.ORACLE_DB_ID);
    migrateOracleTab1Baseline(oracleSpreadsheet);
    migrateOracleTab2FootprintFinder(oracleSpreadsheet);
    migrateOracleTab3FootprintTracker(oracleSpreadsheet);
    migrateOracleTab4ModularAudits(oracleSpreadsheet);
    migrateOracleTab5SourcebookGen(oracleSpreadsheet);
  } else {
    Logger.log('SKIPPED: ORACLE_DB_ID not defined.');
  }

  Logger.log('>>> ALL TABS ACROSS ALL DATABASES SYNCHRONIZED SUCCESSFULLY.');
}

// ============================================================================
// LEAD DATABASE MIGRATIONS
// ============================================================================

function migrateLeadDatabase(ss) {
  const sheet = findSheetFlexible(ss, ['Main_Lead_Log', 'Main Lead Log', 'Leads']);
  if (!sheet) return;

  const targetHeaders = [
    'Lead_ID', 'Date', 'First_Name', 'Last_Name', 'Company_Name', 
    'Email', 'Phone', 'Lead_Source', 'Details', 'GBP_Status', 
    'Tech_Stack_Current', 'Inboxes_Needed', 'Status', 'Priority', 
    'Owner', 'Est_Value', 'Graduated_At'
  ];

  const sourceData = getSheetDataAsObjects(sheet);
  const newData = sourceData.map(row => {
    let firstName = row['First_Name'] || '';
    let lastName = row['Last_Name'] || '';
    if (!firstName && row['Name']) {
      const parts = String(row['Name']).trim().split(' ');
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    return [
      row['Lead ID'] || row['Lead_ID'] || '',
      row['Date'] || '',
      firstName,
      lastName,
      row['Company'] || row['Company_Name'] || '',
      row['Email'] || '',
      row['Phone'] || '',
      row['Lead Source'] || row['Lead_Source'] || '',
      row['Details'] || '',
      row['Google Business Profile Status'] || row['GBP_Status'] || '',
      row['What software and Services are you currently paying for? '] || row['Tech_Stack_Current'] || '',
      row['Number of Inboxes Needed'] || row['Inboxes_Needed'] || '',
      row['Status'] || 'New',
      row['Priority'] || 'Medium',
      row['Owner'] || 'Drake Austin',
      row['Est. Value'] || row['Est_Value'] || 0,
      row['Graduated_At'] || ''
    ];
  });

  writeHeadersAndData(sheet, targetHeaders, newData);
  Logger.log('✓ Migrated Lead DB: Main_Lead_Log');
}

function migrateLeadDbCalcMetrics(ss) {
  const sheet = findSheetFlexible(ss, ['Calc_Metrics', 'Calc Metrics', 'Metrics', 'Calculator']);
  if (!sheet) return;

  // Format Top KPI Table Header (Row 1)
  sheet.getRange(1, 1, 1, 2).setValues([['KPI_Metric', 'Value']]);
  formatRangeTerminal(sheet.getRange(1, 1, 1, 2));

  // Find and format secondary table header (Row 11 / Lead Source)
  const lastRow = sheet.getLastRow();
  for (let r = 2; r <= lastRow; r++) {
    const val = String(sheet.getRange(r, 1).getValue()).trim().toLowerCase();
    if (val.includes('lead source') || val.includes('lead_source')) {
      const headers2 = ['Lead_Source', 'Lead_Count', 'Total_Value', 'Pipeline_Stage', 'Stage_Count', 'Stage_Value'];
      sheet.getRange(r, 1, 1, headers2.length).setValues([headers2]);
      formatRangeTerminal(sheet.getRange(r, 1, 1, headers2.length));
      break;
    }
  }
  sheet.setFrozenRows(1);
  Logger.log('✓ Formatted Lead DB: Calc_Metrics');
}

// ============================================================================
// ORACLE MASTER MARKETING DATABASE MIGRATIONS (TABS 1 - 5)
// ============================================================================

function migrateOracleTab1Baseline(ss) {
  const sheet = findSheetFlexible(ss, ['1_Client_Baseline', 'Client Baseline', 'Baseline']);
  if (!sheet) return;
  
  const targetHeaders = [
    'Timestamp', 'Client_ID', 'Brand_Name', 'Owner_Name', 'Primary_Domain', 
    'Primary_Product_Service', 'Short_Business_Summary', 'Tech_Stack_Intake', 
    'Industry_Track', 'Maturity_Tier', 'Weekly_Hours_Capacity', 'Monthly_Growth_Budget', 
    'Goal_1', 'Goal_2', 'Goal_3', 'Brand_Voice_Tone', 'Core_Elevator_Pitch', 
    'Primary_Wedge_Differentiator', 'Competitor_1_Name', 'Competitor_1_URL', 
    'Competitor_2_Name', 'Competitor_2_URL', 'Competitor_3_Name', 'Competitor_3_URL', 
    'Persona_1_Name', 'Persona_1_Demographics', 'Persona_1_Obstacle', 'Persona_1_Solution_Need', 'Persona_1_Social_Platforms', 
    'Persona_2_Name', 'Persona_2_Demographics', 'Persona_2_Obstacle', 'Persona_2_Solution_Need', 'Persona_2_Social_Platforms', 
    'Persona_3_Name', 'Persona_3_Demographics', 'Persona_3_Obstacle', 'Persona_3_Solution_Need', 'Persona_3_Social_Platforms'
  ];

  migrateFlexibleTab(sheet, targetHeaders, {
    'Client_ID': ['Client ID', 'Client_ID', 'ClientID'],
    'Brand_Name': ['Brand Name', 'Brand_Name'],
    'Owner_Name': ['Owner Name', 'Owner_Name'],
    'Primary_Domain': ['Primary Domain', 'Primary_Domain'],
    'Primary_Product_Service': ['Primary Product/Service', 'Primary_Product_Service'],
    'Short_Business_Summary': ['Short Business Summary', 'Short_Business_Summary'],
    'Industry_Track': ['Industry Track', 'Industry_Track'],
    'Maturity_Tier': ['Maturity Tier', 'Maturity_Tier'],
    'Weekly_Hours_Capacity': ['Weekly Hours Capacity', 'Weekly_Hours_Capacity'],
    'Monthly_Growth_Budget': ['Monthly Growth Budget', 'Monthly_Growth_Budget'],
    'Core_Elevator_Pitch': ['Core Elevator Pitch', 'Core_Elevator_Pitch']
  });
  Logger.log('✓ Migrated Oracle Tab 1: 1_Client_Baseline');
}

function migrateOracleTab2FootprintFinder(ss) {
  const sheet = findSheetFlexible(ss, ['2_Footprint_Finder', 'Footprint Finder', 'Finder']);
  if (!sheet) return;

  const targetHeaders = [
    'Client_ID', 'Target_ID', 'Competitor_Name', 'Bracket_Role', 'Status', 
    'Primary_Domain', 'GBP_URL', 'LinkedIn_URL', 'Instagram_Handle', 
    'Other_Socials', 'Location_HQ', 'Oracle_Confidence_Score'
  ];

  migrateFlexibleTab(sheet, targetHeaders, {
    'Client_ID': ['Client ID', 'Client_ID', 'ClientID'],
    'Target_ID': ['Target ID', 'Target_ID', 'TargetID'],
    'Competitor_Name': ['Competitor Name', 'Competitor_Name'],
    'Bracket_Role': ['Bracket Role', 'Bracket_Role'],
    'Status': ['Status (Candidate/Review/Verified)', 'Status'],
    'Primary_Domain': ['Primary Domain', 'Primary_Domain'],
    'GBP_URL': ['Google Business Profile URL', 'GBP_URL', 'GBP URL'],
    'LinkedIn_URL': ['LinkedIn URL', 'LinkedIn_URL'],
    'Instagram_Handle': ['Instagram Handle', 'Instagram_Handle'],
    'Other_Socials': ['Other Socials', 'Other_Socials'],
    'Location_HQ': ['Location / HQ', 'Location_HQ', 'Location'],
    'Oracle_Confidence_Score': ['Oracle Confidence Score', 'Oracle_Confidence_Score']
  });
  Logger.log('✓ Migrated Oracle Tab 2: 2_Footprint_Finder');
}

function migrateOracleTab3FootprintTracker(ss) {
  const sheet = findSheetFlexible(ss, ['3_Footprint_Tracker', 'Footprint Tracker', 'Tracker']);
  if (!sheet) return;

  const targetHeaders = [
    'Target_ID', 'Competitor_Name', 'Posting_Cadence', 'Estimated_Audience_Scale', 
    'Review_Count_Velocity', 'Brand_Tone_Voice', 'Core_Keywords', 
    'Primary_Battleground', 'Critical_Vulnerability'
  ];

  migrateFlexibleTab(sheet, targetHeaders, {
    'Target_ID': ['Target ID', 'Target_ID', 'TargetID'],
    'Competitor_Name': ['Competitor Name', 'Competitor_Name'],
    'Posting_Cadence': ['Posting Cadence', 'Posting_Cadence'],
    'Estimated_Audience_Scale': ['Estimated Audience Scale', 'Estimated_Audience_Scale'],
    'Review_Count_Velocity': ['Review Count & Velocity', 'Review_Count_Velocity'],
    'Brand_Tone_Voice': ['Brand Tone / Voice', 'Brand_Tone_Voice'],
    'Core_Keywords': ['Core Keywords', 'Core_Keywords'],
    'Primary_Battleground': ['Primary Battleground', 'Primary_Battleground'],
    'Critical_Vulnerability': ['Critical Vulnerability', 'Critical_Vulnerability']
  });
  Logger.log('✓ Migrated Oracle Tab 3: 3_Footprint_Tracker');
}

function migrateOracleTab4ModularAudits(ss) {
  const sheet = findSheetFlexible(ss, ['4_Modular_Audits', 'Modular Audits', 'Audits']);
  if (!sheet) return;

  const targetHeaders = [
    'Target_ID', 'Competitor_Name', 'GBP_Local_3Pack_Score', 
    'Associates_Network_Map', 'Identify_Wedge_Contrast_Matrix', 'Last_Audited_Date'
  ];

  migrateFlexibleTab(sheet, targetHeaders, {
    'Target_ID': ['Target ID', 'Target_ID', 'TargetID'],
    'Competitor_Name': ['Competitor Name', 'Competitor_Name'],
    'GBP_Local_3Pack_Score': ['GBP Local 3-Pack Score', 'GBP_Local_3Pack_Score'],
    'Associates_Network_Map': ['Associates / Network Map', 'Associates_Network_Map'],
    'Identify_Wedge_Contrast_Matrix': ['Identify Wedge (Contrast Matrix)', 'Identify_Wedge_Contrast_Matrix'],
    'Last_Audited_Date': ['Last Audited Date', 'Last_Audited_Date']
  });
  Logger.log('✓ Migrated Oracle Tab 4: 4_Modular_Audits');
}

function migrateOracleTab5SourcebookGen(ss) {
  const sheet = findSheetFlexible(ss, ['5_Sourcebook_Generation', 'Sourcebook Generation', 'Sourcebook']);
  if (!sheet) return;

  const targetHeaders = [
    'Client_ID', 'Brand_Name', 'Thought_Leadership_Score', 'Generated_Date', 
    'Client_Drive_Folder_URL', 'Case_File_JSON_Link', 'Sourcebook_Deck_Link'
  ];

  migrateFlexibleTab(sheet, targetHeaders, {
    'Client_ID': ['Client ID', 'Client_ID', 'ClientID'],
    'Brand_Name': ['Brand Name', 'Brand_Name'],
    'Thought_Leadership_Score': ['Thought Leadership Score', 'Thought_Leadership_Score'],
    'Generated_Date': ['Generated Date', 'Generated_Date'],
    'Client_Drive_Folder_URL': ['Client Drive Folder URL', 'Client_Drive_Folder_URL'],
    'Case_File_JSON_Link': ['Case File JSON Link', 'Case_File_JSON_Link'],
    'Sourcebook_Deck_Link': ['Sourcebook Deck Link', 'Sourcebook_Deck_Link']
  });
  Logger.log('✓ Migrated Oracle Tab 5: 5_Sourcebook_Generation');
}

// ============================================================================
// MASTER CONTROL MIGRATIONS (RETAINED)
// ============================================================================

function migrateMasterControlClients(ss) {
  const sheet = findSheetFlexible(ss, ['Clients']);
  if (!sheet) return;

  const targetHeaders = [
    'ClientID', 'First_Name', 'Last_Name', 'Company_Name', 'ContactEmail', 
    'GoogleGroupEmail', 'Archetype', 'PipelineStage', 'ActiveRoadblock', 
    'ContractValue', 'DepositPaid', 'CurrentMilestone', 'CompletedMilestones', 
    'TotalMilestones', 'DriveFolderUrl', 'ChatSpaceUrl', 'NotesDocUrl', 
    'MSA_DocID', 'Tech_Stack', 'MCC_Subscriber_ID', 'Oracle_Baseline_ID'
  ];

  const sourceData = getSheetDataAsObjects(sheet);
  const newData = sourceData.map(row => {
    let firstName = row['First_Name'] || '';
    let lastName = row['Last_Name'] || '';
    if (!firstName && row['ClientName']) {
      const parts = String(row['ClientName']).trim().split(' ');
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    return [
      row['ClientID'] || '', firstName, lastName,
      row['Company_Name'] || row['CompanyName'] || '',
      row['ContactEmail'] || '', row['GoogleGroupEmail'] || '',
      row['Archetype'] || '', row['PipelineStage'] || '02: Session Zero',
      row['ActiveRoadblock'] || '', row['ContractValue'] || 0,
      row['DepositPaid'] === 'TRUE' || row['DepositPaid'] === true,
      row['CurrentMilestone'] || '', row['CompletedMilestones'] || 0,
      row['TotalMilestones'] || 5, row['DriveFolderUrl'] || '',
      row['ChatSpaceUrl'] || '', row['NotesDocUrl'] || '',
      row['MSA_DocID'] || '', row['Tech_Stack'] || '',
      row['MCC_Subscriber_ID'] || '', row['Oracle_Baseline_ID'] || ''
    ];
  });

  writeHeadersAndData(sheet, targetHeaders, newData);
  Logger.log('✓ Migrated Master Control: Clients');
}

function migrateMasterControlProjects(ss) {
  const sheet = findSheetFlexible(ss, ['Projects']);
  if (!sheet) return;

  const targetHeaders = [
    'ProjectID', 'ClientID', 'ProjectName', 'KanbanStage', 'AssignedRateTier', 
    'SOW_DocID', 'Project_Brief_DocID', 'Project_Outline_DocID', 'COMS_Sheet_URL', 
    'Google_Tasklist_ID', 'MeetingNotes_DriveFolderID', 'ChatSpaceURL', 
    'ChatSpace_Internal_URL', 'Est_Hours', 'Actual_Hours'
  ];

  const sourceData = getSheetDataAsObjects(sheet);
  const newData = sourceData.map(row => [
    row['ProjectID'] || '', row['ClientID'] || '', row['ProjectName'] || 'Initial Project',
    row['KanbanStage'] || '02: Session Zero', row['AssignedRateTier'] || 'Normal ($85)',
    row['SOW_DocID'] || '', row['Project_Brief_DocID'] || '', row['Project_Outline_DocID'] || '',
    row['COMS_Sheet_URL'] || '', row['Google_Tasklist_ID'] || '', row['MeetingNotes_DriveFolderID'] || '',
    row['ChatSpaceURL'] || '', row['ChatSpace_Internal_URL'] || '',
    row['Est_Hours'] || 0, row['Actual_Hours'] || 0
  ]);

  writeHeadersAndData(sheet, targetHeaders, newData);
  Logger.log('✓ Migrated Master Control: Projects');
}

function migrateMasterControlFinances(ss) {
  const sheet = findSheetFlexible(ss, ['Finances']);
  if (!sheet) return;

  const targetHeaders = [
    'InvoiceID', 'ClientID', 'ProjectID', 'InvoiceNumber', 'MilestoneStage', 
    'TotalContractValue', 'DepositAmount', 'InvoiceAmount', 'DepositPaid', 
    'Remaining_Balance', 'InvoiceStatus', 'PaymentDate', 'Est_Hours_Allocation', 
    'Actual_Hours_Worked', 'EffectiveHourlyRate', 'EstimatedQuarterlyTax', 
    'OverheadCosts', 'NetMargin'
  ];

  const sourceData = getSheetDataAsObjects(sheet);
  const newData = sourceData.map(row => {
    const totalVal = Number(row['TotalContractValue'] || 0);
    const depositAmt = row['DepositAmount'] ? Number(row['DepositAmount']) : Math.round(totalVal / 3);

    return [
      row['InvoiceID'] || ('INV-' + (row['ClientID'] || 'TEMP') + '-01'),
      row['ClientID'] || '', row['ProjectID'] || '', row['InvoiceNumber'] || '',
      row['MilestoneStage'] || 'Deposit (1/3)', totalVal, depositAmt,
      row['InvoiceAmount'] || depositAmt,
      row['DepositPaid'] === 'TRUE' || row['DepositPaid'] === true,
      row['RemainingBalance'] || row['Remaining_Balance'] || (totalVal - depositAmt),
      row['InvoiceStatus'] || 'Draft', row['PaymentDate'] || '',
      row['Est_Hours_Allocation'] || 0, row['Actual_Hours_Worked'] || 0,
      row['EffectiveHourlyRate'] || 0,
      row['EstimatedQuarterlyTax'] || (depositAmt * 0.25),
      row['OverheadCosts'] || 0, row['NetMargin'] || '67%'
    ];
  });

  writeHeadersAndData(sheet, targetHeaders, newData);
  Logger.log('✓ Migrated Master Control: Finances');
}

function createServicesRatesTab(ss) {
  let sheet = findSheetFlexible(ss, ['Services_Rates', 'Services Rates']);
  if (!sheet) sheet = ss.insertSheet('Services_Rates');

  const headers = [
    'Rate_Tier', 'Hourly_Rate', 'Service_Category', 'Task_Item_Name', 
    'SOW_Invoice_Description', 'Default_Hours_Est', 'Package_Price'
  ];

  const defaultRates = [
    ['Normal', 85.00, 'Core Setups', 'Google Workspace Tenant & DNS Security', 'Core setups, domain configuration, Workspace migrations, DNS/MX/SPF/DKIM security protocols.', 8.0, 680.00],
    ['Premium', 115.00, 'Custom Automations', 'Custom Google Apps Script & API Webhooks', 'Custom Google Apps Script, mass automations, studio infrastructure, complex API integrations.', 12.0, 1380.00],
    ['Reduced', 65.00, 'Maintenance', 'Legacy Maintenance & Field Updates', 'Minor sheet adjustments, template text tweaks, basic administrative maintenance.', 4.0, 260.00]
  ];

  if (sheet.getLastRow() <= 1) {
    writeHeadersAndData(sheet, headers, defaultRates);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    formatSheetHeader(sheet, headers.length);
  }
  Logger.log('✓ Verified Master Control: Services_Rates');
}

function createAlfredAlertsTab(ss) {
  let sheet = findSheetFlexible(ss, ['Alfred_Alerts', 'Alfred Alerts']);
  if (!sheet) sheet = ss.insertSheet('Alfred_Alerts');

  const headers = ['Alert_ID', 'Timestamp', 'ClientID', 'Priority', 'Category', 'Message', 'Action_URL', 'Dismissed_Status'];
  const sampleAlert = [['ALT-1001', new Date().toISOString(), 'SYSTEM', 'INFO', 'System Initialization', 'Alfred HUD telemetry engine initialized.', '', false]];

  if (sheet.getLastRow() <= 1) {
    writeHeadersAndData(sheet, headers, sampleAlert);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    formatSheetHeader(sheet, headers.length);
  }
  Logger.log('✓ Verified Master Control: Alfred_Alerts');
}

// ============================================================================
// HELPER UTILITIES
// ============================================================================

function migrateFlexibleTab(sheet, targetHeaders, fieldMap) {
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  
  let sourceData = [];
  if (lastCol > 1 && lastRow > 1) {
    sourceData = getSheetDataAsObjects(sheet);
  }

  sheet.clear();
  sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
  formatSheetHeader(sheet, targetHeaders.length);

  if (sourceData.length > 0) {
    const newData = sourceData.map(row => {
      return targetHeaders.map(th => {
        const sourceKeys = fieldMap[th];
        if (Array.isArray(sourceKeys)) {
          for (let k of sourceKeys) {
            if (row[k] !== undefined && row[k] !== '') return row[k];
          }
          return '';
        }
        return (sourceKeys && row[sourceKeys] !== undefined) ? row[sourceKeys] : (row[th] || '');
      });
    });
    sheet.getRange(2, 1, newData.length, targetHeaders.length).setValues(newData);
  }
}

function findSheetFlexible(ss, possibleNames) {
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

function getSheetDataAsObjects(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const raw = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = raw[0].map(h => String(h).trim());
  const rows = raw.slice(1);

  return rows.map(r => {
    const obj = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = r[idx];
    });
    return obj;
  });
}

function writeHeadersAndData(sheet, headers, dataRows) {
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatSheetHeader(sheet, headers.length);

  if (dataRows && dataRows.length > 0) {
    sheet.getRange(2, 1, dataRows.length, headers.length).setValues(dataRows);
  }
}

function formatSheetHeader(sheet, numCols) {
  const range = sheet.getRange(1, 1, 1, numCols);
  formatRangeTerminal(range);
  sheet.setRowHeight(1, 32);
  sheet.setFrozenRows(1);
  for (let c = 1; c <= Math.min(numCols, 25); c++) {
    sheet.autoResizeColumn(c);
  }
}

function formatRangeTerminal(range) {
  range
    .setBackground('#1E1E1E')
    .setFontColor('#00FF66')
    .setFontWeight('bold')
    .setFontFamily('Consolas')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
}