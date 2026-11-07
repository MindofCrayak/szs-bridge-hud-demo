/**
 * ============================================================================
 * SZS MASTER CONTROL CRM & AUTOMATION ENGINE
 * ============================================================================
 */

// CENTRAL CONFIGURATION & IDS
const CONFIG = {
  get MASTER_CONTROL_SHEET_ID() { return PropertiesService.getScriptProperties().getProperty('MASTER_CONTROL_SHEET_ID') || ''; },
  get LEAD_DB_ID() { return PropertiesService.getScriptProperties().getProperty('LEAD_DB_ID') || ''; },
  get ROOT_DRIVE_FOLDER_ID() { return PropertiesService.getScriptProperties().getProperty('ROOT_DRIVE_FOLDER_ID') || ''; },
  get MSA_TEMPLATE_ID() { return PropertiesService.getScriptProperties().getProperty('MSA_TEMPLATE_ID') || ''; },
  get SOW_TEMPLATE_ID() { return PropertiesService.getScriptProperties().getProperty('SOW_TEMPLATE_ID') || ''; },
  get INVOICE_TEMPLATE_ID() { return PropertiesService.getScriptProperties().getProperty('INVOICE_TEMPLATE_ID') || ''; }
};

/**
 * [PHASE 3.2] GET ROUTER
 * Handles incoming GET requests from React HUD:
 * - ?action=hud     -> Returns count of leads where Status == "New"
 * - (default)       -> Returns all records from Master Control 'Clients' tab
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";

    // HUD Top Bar Notification Endpoint
    if (action === "hud") {
      const ssLead = SpreadsheetApp.openById(CONFIG.LEAD_DB_ID);
      const leadSheet = ssLead.getSheetByName("Main_Lead_Log");
      const leadData = leadSheet.getDataRange().getValues();
      const headers = leadData[0];
      
      const statusIdx = headers.indexOf("Status") !== -1 ? headers.indexOf("Status") : 11;
      let newLeadCount = 0;

      for (let i = 1; i < leadData.length; i++) {
        if (leadData[i][statusIdx] === "New") {
          newLeadCount++;
        }
      }

      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        newLeads: newLeadCount 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Default: Return Clients Feed
    const ssMC = SpreadsheetApp.openById(CONFIG.MASTER_CONTROL_SHEET_ID);
    const sheet = ssMC.getSheetByName("Clients");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);

    const clients = rows.map(row => {
      let client = {};
      headers.forEach((header, index) => {
        client[header] = row[index];
      });
      return client;
    });

    return ContentService.createTextOutput(JSON.stringify(clients))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST ROUTER
 * Handles remote macro executions from the HUD.
 */
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    
    // Action 1: Provisioning MSA/SOW
    if (request.action === "RUN_PROVISIONING") {
      const clientData = request.clientData || {};
      const projectData = request.projectData || {};
      
      const generated = provisionClientAndProject(clientData, projectData);
      const ss = SpreadsheetApp.openById(CONFIG.MASTER_CONTROL_SHEET_ID);
      
      // Update Clients tab
      const clientsSheet = ss.getSheetByName("Clients");
      const clientValues = clientsSheet.getDataRange().getValues();
      const clientHeaders = clientValues[0];
      
      const idCol = clientHeaders.indexOf("ClientID");
      const nameCol = clientHeaders.indexOf("ClientName");
      const msaCol = clientHeaders.indexOf("MSA_DocID");
      const driveCol = clientHeaders.indexOf("DriveFolderUrl");
      
      const targetId = clientData.ClientID || clientData.id;
      const targetName = clientData.ClientName || clientData.name;
      
      for (let r = 1; r < clientValues.length; r++) {
        const rowId = clientValues[r][idCol];
        const rowName = clientValues[r][nameCol];
        
        if ((targetId && rowId === targetId) || (targetName && rowName === targetName)) {
          if (msaCol !== -1) clientsSheet.getRange(r + 1, msaCol + 1).setValue(generated.msaDocId);
          if (driveCol !== -1) clientsSheet.getRange(r + 1, driveCol + 1).setValue("https://drive.google.com/drive/folders/" + generated.clientRootFolderId);
          break;
        }
      }
      
      // Append to Projects tab
      const projectsSheet = ss.getSheetByName("Projects");
      const projHeaders = projectsSheet.getRange(1, 1, 1, projectsSheet.getLastColumn()).getValues()[0];
      const newProjectId = "PRJ-" + (targetId ? String(targetId).replace("C-", "") : "102") + "-01";
      
      const newRow = projHeaders.map(header => {
        switch (header) {
          case "ProjectID": return newProjectId;
          case "ClientID": return targetId || "";
          case "ProjectName": return projectData.ProjectName || "Session_Zero_Audit";
          case "KanbanStage": return clientData.PipelineStage || "02: Session Zero";
          case "SOW_DocID": return generated.sowDocId;
          case "MeetingNotes_DriveFolderID": return generated.meetingNotesFolderId;
          case "ChatSpaceURL": return "";
          default: return "";
        }
      });
      projectsSheet.appendRow(newRow);
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: generated }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Action 2: Trigger Lead Graduation via webhook
    if (request.action === "GRADUATE_LEADS") {
      const result = graduateWonLeadsAndInvoice();
      return ContentService.createTextOutput(JSON.stringify({ success: true, summary: result }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unknown action" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * [PHASE 3.1] MASTER CONTROL HANDSHAKE & INVOICE GENERATOR
 * Scans Lead Database for "Won" leads, provisions folders, creates initial invoice,
 * and synchronizes across Clients, Finances (starting Col B), and Projects tabs.
 */
function graduateWonLeadsAndInvoice() {
  const ssMC = SpreadsheetApp.openById(CONFIG.MASTER_CONTROL_SHEET_ID);
  const clientsSheet = ssMC.getSheetByName("Clients");
  const financesSheet = ssMC.getSheetByName("Finances");
  const projectsSheet = ssMC.getSheetByName("Projects");
  
  const ssLead = SpreadsheetApp.openById(CONFIG.LEAD_DB_ID);
  const leadLog = ssLead.getSheetByName("Main_Lead_Log");
  const leadData = leadLog.getDataRange().getValues();
  
  // Find highest ClientID to auto-increment
  const clientsData = clientsSheet.getDataRange().getValues();
  let highestCId = 106;
  for (let i = 1; i < clientsData.length; i++) {
    if (clientsData[i][0] && String(clientsData[i][0]).startsWith("C-")) {
      let num = parseInt(String(clientsData[i][0]).split("-")[1], 10);
      if (!isNaN(num) && num > highestCId) highestCId = num;
    }
  }
  
  let leadsProcessed = 0;
  const currentYear = new Date().getFullYear();
  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy");
  const rootDriveFolder = DriveApp.getFolderById(CONFIG.ROOT_DRIVE_FOLDER_ID);
  
  for (let i = 1; i < leadData.length; i++) {
    let row = leadData[i];
    let leadName = row[2] || "Unnamed Client";
    let leadBusiness = row[3] || leadName;
    let leadEmail = row[6] || "";
    let status = row[11];
    let estValue = parseFloat(row[14]) || 0;
    let migrationStatus = row[15];
    
    // Check for "Won" leads that have not yet migrated
    if (status === "Won" && migrationStatus !== "Migrated") {
      highestCId++;
      const newClientId = `C-${highestCId}`;
      const newProjectId = `PRJ-${highestCId}-01`;
      const invNum = `INV-${currentYear}-${newClientId}-01`;
      const depositAmt = estValue / 2; // Default 50% deposit
      
      // 1. Provision Folder Structure: [Root] -> [Client Folder] -> 00_Legal_and_Admin -> Invoices
      const clientFolder = rootDriveFolder.createFolder(`${leadName} - ${leadBusiness}`);
      const legalFolder = clientFolder.createFolder("00_Legal_and_Admin");
      const invoiceFolder = legalFolder.createFolder("Invoices");
      const clientFolderUrl = clientFolder.getUrl();
      
      // 2. Clone Invoice Sheet Template & Replace Tags
      const invoiceFileName = `${invNum} - ${leadBusiness}`;
      const newInvFile = DriveApp.getFileById(CONFIG.INVOICE_TEMPLATE_ID).makeCopy(invoiceFileName, invoiceFolder);
      const newInvSheet = SpreadsheetApp.openById(newInvFile.getId());
      
      newInvSheet.createTextFinder("{{Client Name}}").replaceAllWith(leadName);
      newInvSheet.createTextFinder("{{Business Name}}").replaceAllWith(leadBusiness);
      newInvSheet.createTextFinder("{{Invoice #}}").replaceAllWith(invNum);
      newInvSheet.createTextFinder("{{Date Submitted}}").replaceAllWith(todayStr);
      newInvSheet.createTextFinder("{{Project Title}}").replaceAllWith("Initial Deposit / Retainer");
      
      // Line Item 1: Deposit
      newInvSheet.createTextFinder("{{Task 1}}").replaceAllWith("Initial Project Deposit");
      newInvSheet.createTextFinder("{{Task 1 Hours}}").replaceAllWith("1");
      newInvSheet.createTextFinder("{{Task 1 Rate}}").replaceAllWith(depositAmt.toString());
      
      // Wipe unused rows
      newInvSheet.createTextFinder("{{Task 2}}").replaceAllWith("");
      newInvSheet.createTextFinder("{{Task 2 Hours}}").replaceAllWith("");
      newInvSheet.createTextFinder("{{Task 2 Rate}}").replaceAllWith("");
      newInvSheet.createTextFinder("{{Task 3}}").replaceAllWith("");
      newInvSheet.createTextFinder("{{Task 3 Hours}}").replaceAllWith("");
      newInvSheet.createTextFinder("{{Task 3 Rate}}").replaceAllWith("");
      
      // 3. Append to 'Clients' Tab (Starts at Column A)
      clientsSheet.appendRow([
        newClientId,          // A: ClientID
        leadName,             // B: ClientName
        leadEmail,            // C: ContactEmail
        "Needs Archetype",    // D: Archetype
        "01: Intake",         // E: PipelineStage
        "",                   // F: ActiveRoadblock
        estValue,             // G: ContractValue
        false,                // H: DepositPaid
        "Awaiting Deposit",   // I: CurrentMilestone
        0,                    // J: CompletedMilestones
        5,                    // K: TotalMilestones
        clientFolderUrl       // L: DriveFolderUrl
      ]);
      
      // 4. Append to 'Finances' Tab (Shifted: Starts at Column B)
      financesSheet.appendRow([
        "",                   // A: Spacer / Margin Column
        newClientId,          // B: ClientID
        newProjectId,         // C: ProjectID
        invNum,               // D: InvoiceNumber
        estValue,             // E: TotalContractValue
        depositAmt,           // F: DepositAmount
        false,                // G: DepositPaid
        estValue,             // H: RemainingBalance
        "Draft",              // I: InvoiceStatus
        "",                   // J: PaymentDate
        estValue * 0.25,      // K: EstimatedQuarterlyTax
        0,                    // L: OverheadCosts
        ""                    // M: NetMargin
      ]);
      
      // 5. Append to 'Projects' Tab (Starts at Column A)
      projectsSheet.appendRow([
        newProjectId,         // A: ProjectID
        newClientId,          // B: ClientID
        "Initial Project",    // C: ProjectName
        "02: Session Zero",   // D: KanbanStage
        "",                   // E: SOW_DocID
        "",                   // F: MeetingNotes_DriveFolderID
        ""                    // G: ChatSpaceURL
      ]);
      
      // 6. Tag Lead as Migrated (Column P / index 15)
      leadLog.getRange(i + 1, 16).setValue("Migrated");
      leadsProcessed++;
      
      Logger.log(`Migrated ${leadName} -> ${newClientId}. Invoice created: ${newInvFile.getUrl()}`);
    }
  }
  
  const summary = `Processed ${leadsProcessed} won lead(s).`;
  Logger.log(summary);
  return summary;
}

/**
 * Onboarding Provisioner: creates folder tree and replaces tags in MSA/SOW Google Docs.
 */
function provisionClientAndProject(clientData, projectData) {
  const parentFolder = DriveApp.getFolderById(CONFIG.ROOT_DRIVE_FOLDER_ID);

  const clientFolder = parentFolder.createFolder(clientData.ClientName);
  const legalFolder = clientFolder.createFolder("00 Legal and Admin");
  const projectFolder = clientFolder.createFolder("PRJ_01_" + projectData.ProjectName);
  const meetingNotesFolder = projectFolder.createFolder("Meeting Notes"); 

  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM dd, yyyy");

  // Populate MSA
  const msaFile = DriveApp.getFileById(CONFIG.MSA_TEMPLATE_ID).makeCopy(clientData.ClientName + " - MSA", legalFolder);
  const msaDoc = DocumentApp.openById(msaFile.getId());
  const msaBody = msaDoc.getBody();
  
  msaBody.replaceText("\\$\\{today's date\\}", todayStr);
  msaBody.replaceText("\\$\\{Client Business name\\}", clientData.ClientName || "");
  msaBody.replaceText("\\$\\{Client Business Address\\}", clientData.Address || "");
  msaBody.replaceText("\\$\\{Business Owners name\\}", clientData.OwnerName || "");
  msaBody.replaceText("\\$\\{Business Owners Title\\}", clientData.OwnerTitle || "");
  msaDoc.saveAndClose();

  // Populate SOW
  const sowFile = DriveApp.getFileById(CONFIG.SOW_TEMPLATE_ID).makeCopy(clientData.ClientName + " - SOW 01", projectFolder);
  const sowDoc = DocumentApp.openById(sowFile.getId());
  const sowBody = sowDoc.getBody();
  
  sowBody.replaceText("\\$\\{today's date\\}", todayStr);
  sowBody.replaceText("\\$\\{Client Business name\\}", clientData.ClientName || "");
  sowBody.replaceText("\\$\\{Client Business Address\\}", clientData.Address || "");
  sowBody.replaceText("\\$\\{Project Overview\\}", projectData.Overview || "");
  sowBody.replaceText("\\$\\{Project Services\\}", projectData.Services || "");
  sowBody.replaceText("\\$\\{Project Start Date\\}", projectData.StartDate || "");
  sowBody.replaceText("\\$\\{Project End Date\\}", projectData.EndDate || "");
  sowBody.replaceText("\\$\\{Project Total\\}", projectData.Total || "");
  sowBody.replaceText("\\$\\{Deposit\\}", projectData.Deposit || "");
  sowBody.replaceText("\\$\\{Business Owners name\\}", clientData.OwnerName || "");
  sowBody.replaceText("\\$\\{Business Owners Title\\}", clientData.OwnerTitle || "");
  sowDoc.saveAndClose();

  return {
    clientRootFolderId: clientFolder.getId(),
    msaDocId: msaFile.getId(),
    sowDocId: sowFile.getId(),
    meetingNotesFolderId: meetingNotesFolder.getId()
  };
}

/**
 * Generates an automated invoice from the Master Template for existing clients.
 * Adjusted for Finances tab starting in Column B.
 */
function generateClientInvoice(clientId, projectId) {
  const ss = SpreadsheetApp.openById(CONFIG.MASTER_CONTROL_SHEET_ID);
  
  const clientsData = ss.getSheetByName("Clients").getDataRange().getValues();
  const financeSheet = ss.getSheetByName("Finances");
  const financeData = financeSheet.getDataRange().getValues();
  
  let clientRow = clientsData.find(r => r[0] === clientId);
  // Finances tab has ClientID in Column B (index 1) and ProjectID in Column C (index 2)
  let financeRowIdx = financeData.findIndex(r => r[1] === clientId && r[2] === projectId);
  
  if (!clientRow || financeRowIdx === -1) {
    return { success: false, error: "Client or Project not found in Finances sheet." };
  }
  
  let fRow = financeData[financeRowIdx];
  const currentYear = new Date().getFullYear();
  // InvoiceNumber is Column D (index 3)
  let clientInvoices = financeData.filter(r => r[1] === clientId && String(r[3]).startsWith(`INV-${currentYear}`));
  let sequence = clientInvoices.length + 1;
  let newInvoiceNumber = `INV-${currentYear}-${clientId}-${String(sequence).padStart(2, '0')}`;
  
  // Resolve Folder
  const clientDriveUrl = clientRow[11];
  const rootFolderId = clientDriveUrl.split("/folders/")[1];
  const rootFolder = DriveApp.getFolderById(rootFolderId);
  
  let legalFolder = rootFolder.getFoldersByName("00_Legal_and_Admin").hasNext() ? 
                    rootFolder.getFoldersByName("00_Legal_and_Admin").next() : 
                    rootFolder.createFolder("00_Legal_and_Admin");
                    
  let invoicesFolder = legalFolder.getFoldersByName("Invoices").hasNext() ? 
                       legalFolder.getFoldersByName("Invoices").next() : 
                       legalFolder.createFolder("Invoices");

  // Clone template & substitute
  const newInvoiceName = `${newInvoiceNumber} - ${clientRow[1]}`;
  const newInvoice = DriveApp.getFileById(CONFIG.INVOICE_TEMPLATE_ID).makeCopy(newInvoiceName, invoicesFolder);
  
  try {
    const doc = DocumentApp.openById(newInvoice.getId());
    const body = doc.getBody();
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy");
    
    body.replaceText("{{Invoice_Number}}", newInvoiceNumber);
    body.replaceText("{{Date}}", today);
    body.replaceText("{{Client_Name}}", clientRow[1]);
    body.replaceText("{{Client_Email}}", clientRow[2]);
    body.replaceText("{{Total_Due}}", `$${fRow[7]}`);      // Col H: RemainingBalance
    body.replaceText("{{Deposit_Amount}}", `$${fRow[5]}`); // Col F: DepositAmount
    doc.saveAndClose();
  } catch(e) {
    const sheetFile = SpreadsheetApp.openById(newInvoice.getId());
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy");
    sheetFile.createTextFinder("{{Invoice #}}").replaceAllWith(newInvoiceNumber);
    sheetFile.createTextFinder("{{Date Submitted}}").replaceAllWith(today);
    sheetFile.createTextFinder("{{Client Name}}").replaceAllWith(clientRow[1]);
  }
  
  // Write Invoice Number to Column D (4) and Status to Column I (9)
  financeSheet.getRange(financeRowIdx + 1, 4).setValue(newInvoiceNumber);
  financeSheet.getRange(financeRowIdx + 1, 9).setValue("Draft");
  
  return { success: true, invoiceUrl: newInvoice.getUrl(), invoiceNumber: newInvoiceNumber };
}

/**
 * Quick Test Harness for Local Execution
 */
function testProvisioning() {
  const mockClient = {
    ClientName: "Marco Vance",
    Address: "123 Developer Way, San Francisco, CA",
    OwnerName: "Marco Vance",
    OwnerTitle: "Lead Developer"
  };
  
  const mockProject = {
    ProjectName: "Session_Zero_Audit",
    Overview: "A complete digital infrastructure audit for the game studio.",
    Services: "- Brand Assessment\n- Workspace Security Audit\n- Workflow Mapping",
    StartDate: "November 1, 2026",
    EndDate: "November 15, 2026",
    Total: "$12,500",
    Deposit: "$6,250"
  };
  
  Logger.log("Starting provisioning test...");
  const result = provisionClientAndProject(mockClient, mockProject);
  Logger.log("Test Complete:\n" + JSON.stringify(result, null, 2));
}

/**
 * TEST HARNESS: SEED & GRADUATE LEAD
 * Simulates a form submission directly into Main_Lead_Log and triggers graduation.
 */
function testLeadGraduation() {
  const ssLead = SpreadsheetApp.openById(CONFIG.LEAD_DB_ID);
  const leadLog = ssLead.getSheetByName("Main_Lead_Log");
  
  // Generate a distinct timestamp so you can run this repeatedly without collisions
  const seed = new Date().getTime().toString().slice(-4);
  const mockLeadName = `Test Founder ${seed}`;
  const mockBusiness = `Quantum Lab ${seed}`;
  const mockEmail = `alex.${seed}@quantumlab.io`;
  const mockDealValue = 12000;
  
  // Construct a dummy 16-column row matching your Lead Log schema
  const dummyRow = new Array(16).fill("");
  dummyRow[0] = `LEAD-${seed}`;              // A: LeadID
  dummyRow[1] = new Date();                  // B: Date Added
  dummyRow[2] = mockLeadName;                // C: Lead Name
  dummyRow[3] = mockBusiness;                // D: Business Name
  dummyRow[4] = "Founder";                   // E: Role
  dummyRow[5] = "555-0142";                  // F: Phone
  dummyRow[6] = mockEmail;                   // G: Email
  dummyRow[11] = "Won";                      // L: Status (Index 11)
  dummyRow[14] = mockDealValue;              // O: Est. Value (Index 14)
  dummyRow[15] = "";                         // P: Migration Flag (Index 15, blank so it gets picked up)

  Logger.log(`1. Seeding mock 'Won' lead into Lead DB: ${mockLeadName} (${mockBusiness})...`);
  leadLog.appendRow(dummyRow);
  
  Logger.log("2. Firing graduateWonLeadsAndInvoice()...");
  const result = graduateWonLeadsAndInvoice();
  
  Logger.log("3. Done! Output: " + result);
}