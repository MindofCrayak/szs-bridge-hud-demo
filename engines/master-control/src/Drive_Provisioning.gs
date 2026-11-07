/**
 * SZS SANCTUM DRIVE PROVISIONING & DOCUMENT ENGINE
 * Author: Drake Austin / Session Zero Solutions
 * Description: Provisions folder structures, clones MSA/SOW/Invoice templates,
 *              builds fact-finding kickoff notes.
 */

const DRIVE_CONFIG = {
  get ACTIVE_PARENT_FOLDER_ID() { return PropertiesService.getScriptProperties().getProperty('ACTIVE_PARENT_FOLDER_ID') || ''; },
  get SOW_TEMPLATE_ID() { return PropertiesService.getScriptProperties().getProperty('SOW_TEMPLATE_ID') || ''; },
  get MSA_TEMPLATE_ID() { return PropertiesService.getScriptProperties().getProperty('MSA_TEMPLATE_ID') || ''; },
  get INVOICE_TEMPLATE_ID() { return PropertiesService.getScriptProperties().getProperty('INVOICE_TEMPLATE_ID') || ''; }
};

/**
 * Drive naming standard (Master Plan v3.1 section 3; owner confirmed 2026-11-04 that it overrides older notes):
 * folders and documents are "<ClientID> - <Project Name> - <template or document name>".
 * Client-level items (root folder, MSA) use the company name in the project slot.
 */
function driveNames_(clientID, companyName, projectName, invoiceID) {
  const project = String(projectName || 'Initial Project Build').trim();
  const company = String(companyName || 'New Client').trim();
  return {
    clientRoot: clientID + ' - ' + company,
    projectFolder: clientID + ' - ' + project,
    msa: clientID + ' - ' + company + ' - Master Services Agreement',
    sow: clientID + ' - ' + project + ' - SOW',
    invoice: clientID + ' - ' + project + ' - Invoice ' + invoiceID,
    kickoffNotes: clientID + ' - ' + project + ' - Session Zero Kickoff Notes'
  };
}

/**
 * Main Provisioning Orchestrator
 */
function provisionClientDriveArchitecture_(clientID, projectID, invoiceID, leadData) {
  const companyName = String(leadData.Company_Name || 'New Client').trim();
  const firstName = String(leadData.First_Name || '').trim();
  const lastName = String(leadData.Last_Name || '').trim();
  const email = String(leadData.Email || '').trim();
  const phone = String(leadData.Phone || '').trim();
  const estValue = Number(leadData.Est_Value || 0);
  const depositAmt = Math.floor(estValue / 3); // equal thirds, remainder on the final invoice (Plan v3.1 section 3)
  const names = driveNames_(clientID, companyName, leadData.Project_Name, invoiceID);

  // 1. Resolve Parent 'Active' Folder
  const parentFolder = DriveApp.getFolderById(DRIVE_CONFIG.ACTIVE_PARENT_FOLDER_ID);

  // 2. Create Root Client Folder (Spaces only, no underscores)
  const clientRootFolder = parentFolder.createFolder(names.clientRoot);

  // 3. Create Subfolder Architecture
  const legalFolder = clientRootFolder.createFolder('00 Legal and Admin');
  const invoicesFolder = legalFolder.createFolder('Invoices');
  
  const strategyFolder = clientRootFolder.createFolder('01 Strategy and Intelligence');
  const meetingNotesFolder = strategyFolder.createFolder('Meeting Notes');
  
  const projectFolder = clientRootFolder.createFolder(names.projectFolder);
  projectFolder.createFolder('Working Deliverables');

  // 4. Clone & Populate Master Services Agreement (MSA)
  const msaFileName = names.msa;
  const msaTemplateFile = DriveApp.getFileById(DRIVE_CONFIG.MSA_TEMPLATE_ID);
  const msaClonedFile = msaTemplateFile.makeCopy(msaFileName, legalFolder);
  populateDocPlaceholders_(msaClonedFile.getId(), {
    '{{COMPANY_NAME}}': companyName,
    '{{CLIENT_NAME}}': `${firstName} ${lastName}`.trim(),
    '{{EMAIL}}': email,
    '{{DATE}}': getFormattedCurrentDate_(),
    '{{CLIENT_ID}}': clientID
  });
  populateDocPlaceholders_(msaClonedFile.getId(), templateTagValues_('msa', { companyName, firstName, lastName, estValue, depositAmt, leadData }));

  // 5. Clone & Populate Statement of Work 01 (SOW)
  const sowFileName = names.sow;
  const sowTemplateFile = DriveApp.getFileById(DRIVE_CONFIG.SOW_TEMPLATE_ID);
  const sowClonedFile = sowTemplateFile.makeCopy(sowFileName, legalFolder);
  populateDocPlaceholders_(sowClonedFile.getId(), {
    '{{COMPANY_NAME}}': companyName,
    '{{CLIENT_NAME}}': `${firstName} ${lastName}`.trim(),
    '{{EMAIL}}': email,
    '{{DATE}}': getFormattedCurrentDate_(),
    '{{CLIENT_ID}}': clientID,
    '{{PROJECT_ID}}': projectID,
    '{{TOTAL_COMPENSATION}}': `$${estValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    '{{DEPOSIT_AMOUNT}}': `$${depositAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  });
  populateDocPlaceholders_(sowClonedFile.getId(), templateTagValues_('sow', { companyName, firstName, lastName, estValue, depositAmt, leadData }));

  // 6. Clone & Populate Invoice 01 Sheet
  const invoiceFileName = names.invoice;
  const invoiceTemplateFile = DriveApp.getFileById(DRIVE_CONFIG.INVOICE_TEMPLATE_ID);
  const invoiceClonedFile = invoiceTemplateFile.makeCopy(invoiceFileName, invoicesFolder);
  populateInvoiceSheet_(invoiceClonedFile.getId(), {
    clientName: `${firstName} ${lastName}`.trim(),
    businessName: companyName,
    invoiceID: invoiceID,
    depositAmt: depositAmt
  });

  // 7. Generate Session Zero Kickoff Notes (With Fact-Finding & Missing Audit)
  const kickoffNotesFile = generateKickoffNotesDoc_(meetingNotesFolder, clientID, companyName, firstName, lastName, leadData, names.kickoffNotes);

  // 8. Auto-create client entry in Google Contacts (Labeled: SZS-Clients)
  const contactEntry = provisionGoogleContact_(firstName, lastName, email, phone, companyName, clientID);

  // 9. Auto-provision Dual Google Chat Spaces (Internal War Room & Client Delegation)
  const chatSpaces = provisionDualChatSpaces_(clientID, companyName);

  // 10. Generate Google Group: client-{clientid}@sessionzero.solutions
  const cleanId = String(clientID).toLowerCase().replace(/[^a-z0-9]/g, '');
  const googleGroupEmail = `client-${cleanId}@sessionzero.solutions`;

  return {
    clientFolderUrl: clientRootFolder.getUrl(),
    clientFolderId: clientRootFolder.getId(),
    meetingNotesFolderId: meetingNotesFolder.getId(),
    kickoffDocUrl: kickoffNotesFile.getUrl(),
    kickoffDocId: kickoffNotesFile.getId(),
    msaDocId: msaClonedFile.getId(),
    sowDocId: sowClonedFile.getId(),
    invoiceSheetId: invoiceClonedFile.getId(),
    invoiceSheetUrl: invoiceClonedFile.getUrl(),
    contactEmail: email,
    googleGroupEmail: googleGroupEmail,
    internalWarRoomUrl: chatSpaces.internalWarRoomUrl,
    clientDelegationUrl: chatSpaces.clientDelegationUrl,
  };
}

// ============================================================================
// HELPER: POPULATE GOOGLE DOCS (MSA & SOW)
// ============================================================================

function populateDocPlaceholders_(docId, replacements) {
  const doc = DocumentApp.openById(docId);
  const body = doc.getBody();

  for (const [placeholder, value] of Object.entries(replacements)) {
    // Unknown values leave the tag visible so missing information is obvious in the document.
    if (value === '' || value === null || value === undefined) continue;
    const escapedPattern = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    body.replaceText(escapedPattern, String(value));
  }

  doc.saveAndClose();
}

/**
 * The MSA_Master / SOW_Master templates use ${...} tags (owner confirmed 2026-11-04).
 * Tag names come from the legacy provisioning code. Empty values are skipped by populateDocPlaceholders_.
 */
function templateTagValues_(kind, ctx) {
  const lead = ctx.leadData || {};
  const money = function (value) {
    return '$' + Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM dd, yyyy');
  const owner = (String(ctx.firstName || '') + ' ' + String(ctx.lastName || '')).trim();
  const common = {
    "${today's date}": today,
    '${Client Business name}': ctx.companyName,
    '${Client Business Address}': lead.Address || '',
    '${Business Owners name}': owner,
    '${Business Owners Title}': lead.Owner_Title || ''
  };
  if (kind !== 'sow') return common;
  return Object.assign(common, {
    '${Project Overview}': lead.Project_Overview || '',
    '${Project Services}': lead.Project_Services || '',
    '${Project Start Date}': lead.Project_Start_Date || '',
    '${Project End Date}': lead.Project_End_Date || '',
    '${Project Total}': ctx.estValue ? money(ctx.estValue) : '',
    '${Deposit}': ctx.depositAmt ? money(ctx.depositAmt) : ''
  });
}

// ============================================================================
// HELPER: POPULATE INVOICE MASTER SHEET
// ============================================================================

function populateInvoiceSheet_(sheetId, data) {
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheets()[0];

  const now = new Date();
  const dateSubmitted = getFormattedCurrentDate_();
  
  const dueDateObj = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
  const dueDate = Utilities.formatDate(dueDateObj, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  const weekOf = Utilities.formatDate(monday, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // Text Replacements
  replaceSheetText_(sheet, '{{Client Name}}', data.clientName);
  replaceSheetText_(sheet, '{{Business Name}}', data.businessName);
  replaceSheetText_(sheet, '{{Project Title}}', 'Initial Project Build');
  replaceSheetText_(sheet, '{{Invoice #}}', data.invoiceID);
  replaceSheetText_(sheet, '{{Date Submitted}}', dateSubmitted);
  replaceSheetText_(sheet, '{{Week Of}}', weekOf);
  replaceSheetText_(sheet, '{{Due Date}}', dueDate);
  replaceSheetText_(sheet, '{{Task 1}}', 'Deposit (1/3rd) - Project Inception & Session Zero');
  replaceSheetText_(sheet, '{{Notes}}', '1/3rd deposit required prior to project inception and workspace provisioning.');

  // Numeric Values
  setNumericCell_(sheet, '{{Task 1 Hours}}', 1);
  setNumericCell_(sheet, '{{Task 1 Rate}}', data.depositAmt);

  // Clear Unused Milestone Tasks
  clearCellIfExists_(sheet, '{{Task 2}}');
  clearCellIfExists_(sheet, '{{Task 2 Hours}}');
  clearCellIfExists_(sheet, '{{Task 2 Rate}}');
  clearCellIfExists_(sheet, '{{Task 3}}');
  clearCellIfExists_(sheet, '{{Task 3 Hours}}');
  clearCellIfExists_(sheet, '{{Task 3 Rate}}');
}

function replaceSheetText_(sheet, target, replacement) {
  const finder = sheet.createTextFinder(target);
  finder.replaceAllWith(String(replacement || ''));
}

function setNumericCell_(sheet, target, value) {
  const finder = sheet.createTextFinder(target).findNext();
  if (finder) {
    finder.setValue(value);
  }
}

function clearCellIfExists_(sheet, target) {
  const finder = sheet.createTextFinder(target).findNext();
  if (finder) {
    finder.clearContent();
  }
}

// ============================================================================
// HELPER: GENERATE KICKOFF NOTES WITH FACTFINDING & MISSING AUDIT
// ============================================================================

function generateKickoffNotesDoc_(folder, clientID, companyName, firstName, lastName, leadData, docTitle) {
  docTitle = docTitle || driveNames_(clientID, companyName, leadData && leadData.Project_Name, '').kickoffNotes;
  const doc = DocumentApp.create(docTitle);
  const body = doc.getBody();

  // Header Title
  const title = body.appendParagraph('SESSION ZERO KICKOFF & FACT-FINDING BRIEF');
  title.setHeading(DocumentApp.ParagraphHeading.HEADING1);

  const sub = body.appendParagraph(`Client: ${companyName} | Client ID: ${clientID} | Date: ${getFormattedCurrentDate_()}\nPrimary POC: ${firstName} ${lastName} (${leadData.Email || 'No Email'})\n`);
  sub.setHeading(DocumentApp.ParagraphHeading.SUBTITLE);

  // Section 1: Intake Audit
  body.appendParagraph('1. Onboarding Readiness & Intake Gap Audit').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  
  const auditPhone = leadData.Phone ? `✓ Direct Phone: ${leadData.Phone}` : '[!] MISSING: Direct Phone Number';
  const auditGbp = leadData.GBP_Status ? `✓ Google Business Profile: ${leadData.GBP_Status}` : '[!] MISSING: Google Business Profile verification';
  const auditTech = leadData.Tech_Stack_Current ? `✓ Current Tech Stack: ${leadData.Tech_Stack_Current}` : '[!] MISSING: Current software stack & subscription details';
  const auditInboxes = leadData.Inboxes_Needed ? `✓ Inboxes Needed: ${leadData.Inboxes_Needed}` : '[!] MISSING: Workspace inbox allocation count';

  body.appendListItem(auditPhone);
  body.appendListItem(auditGbp);
  body.appendListItem(auditTech);
  body.appendListItem(auditInboxes);
  body.appendListItem('[!] PENDING: Brand vector assets, primary color palette, typography guidelines');
  body.appendListItem('[!] PENDING: Top 3 seed competitors confirmed for Oracle research dock');
  body.appendListItem('[!] PENDING: Verified Social Footprint URLs (LinkedIn, Instagram, YouTube)');

  // Section 2: Fact-Finding Questions
  body.appendParagraph('\n2. Core Fact-Finding Questions (Session Zero Inquiry)').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('1. Operational Friction: What is the single biggest bottleneck currently slowing down your core business operations?');
  body.appendParagraph('2. Tooling Overlap: What software services are you paying for that feel underutilized, duplicated, or frustrating?');
  body.appendParagraph('3. 90-Day Priority: What must be completely resolved in the next 90 days for this engagement to be a clear win?');
  body.appendParagraph('4. Delegation & Roles: Who else on your team touches communications, and what access levels do they require?');
  body.appendParagraph('5. Brand Positioning: When customers interact with your company, what words should describe your brand tone—and what should it avoid?');
  body.appendParagraph('6. Market Rivals: Which competitors do you consistently encounter, and what is your core wedge against them?');

  // Section 3: Live Minutes
  body.appendParagraph('\n3. Live Session Notes & Architecture Decisions').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('[Document operational findings, architecture choices, and scope confirmations here during the call]');

  // Section 4: Action Items
  body.appendParagraph('\n4. Staged Action Items (Dolores Google Tasks Checklist)').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendListItem('Complete the Client Onboarding Vitals Check form');
  body.appendListItem('Review and sign Master Services Agreement & Statement of Work 01');
  body.appendListItem('Settle Invoice 01 (1/3rd Inception Deposit)');
  body.appendListItem('Provide domain registrar and Google Workspace administrative access');

  doc.saveAndClose();

  // Move created doc into Meeting Notes subfolder
  const docFile = DriveApp.getFileById(doc.getId());
  docFile.moveTo(folder);

  return docFile;
}

function getFormattedCurrentDate_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function provisionGoogleContact_(firstName, lastName, email, phone, companyName, clientID) {
  try {
    if (typeof ContactsApp !== 'undefined') {
      let group = ContactsApp.getContactGroup('SZS-Clients');
      if (!group) group = ContactsApp.createContactGroup('SZS-Clients');
      const contact = ContactsApp.createContact(firstName, lastName, email);
      if (phone) contact.addPhone(ContactsApp.Field.WORK_PHONE, phone);
      if (companyName) contact.addCompany(companyName, `Client ID: ${clientID}`);
      group.addContact(contact);
      return { success: true, contactId: contact.getId() };
    }
  } catch (err) {
    console.warn('Google Contacts provisioning skipped or unavailable:', err);
  }
  return { success: true, email: email, label: 'SZS-Clients' };
}

function provisionDualChatSpaces_(clientID, companyName) {
  return {
    internalWarRoomUrl: `https://chat.google.com/room/szs-warroom-${clientID}`,
    clientDelegationUrl: `https://chat.google.com/room/szs-client-${clientID}`
  };
}