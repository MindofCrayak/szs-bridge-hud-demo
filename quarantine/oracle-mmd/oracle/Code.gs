/**
 * Oracle: Sourcebook Reports
 * Google Apps Script Full-Stack Backend (Code.gs)
 * 
 * Option A: 3-Tier Command Layout (6 Competitors + 1 Client = 7 Entities)
 */

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
var SPREADSHEET_NAME = "Session Zero Operations";
var DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
var GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

// Production Master Slide Template ID
var MASTER_TEMPLATE_ID = "1FwitnLA6m9Le-fpbuQRtKq9bnyH6tLBa9N6-3LP422I";

var PALETTE = {
  BG_DARK: "#0F172A",
  PANEL_BG: "#1E293B",
  BORDER_SLATE: "#334155",
  ACCENT_CYAN: "#38BDF8",
  ACCENT_EMERALD: "#34D399",
  ACCENT_AMBER: "#FBBF24",
  TEXT_WHITE: "#F8FAFC",
  TEXT_MUTED: "#94A3B8"
};

// ==========================================
// 1. WEB APP ENTRY POINT
// ==========================================
function doGet(e) {
  var template = HtmlService.createTemplateFromFile("Index");
  return template.evaluate()
    .setTitle("Oracle | Sourcebook Reports")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ==========================================
// 2. GOOGLE SPREADSHEET DATABASE ENGINE
// ==========================================
function initDatabase() {
  try {
    var files = DriveApp.getFilesByName(SPREADSHEET_NAME);
    var ss = files.hasNext() ? SpreadsheetApp.open(files.next()) : SpreadsheetApp.create(SPREADSHEET_NAME);
    ensureSheetsExist(ss);
    PropertiesService.getUserProperties().setProperty("SESSION_ZERO_SHEET_ID", ss.getId());
    return { success: true, sheetId: ss.getId(), sheetUrl: ss.getUrl() };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function getDatabaseSpreadsheet() {
  var props = PropertiesService.getUserProperties();
  var sheetId = props.getProperty("SESSION_ZERO_SHEET_ID");
  if (sheetId) {
    try { return SpreadsheetApp.openById(sheetId); } catch (e) {}
  }
  var files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) {
    var ss = SpreadsheetApp.open(files.next());
    props.setProperty("SESSION_ZERO_SHEET_ID", ss.getId());
    return ss;
  }
  var initRes = initDatabase();
  return SpreadsheetApp.openById(initRes.sheetId);
}

function ensureSheetsExist(ss) {
  var sheets = ["Clients", "Audits", "Milestones"];
  var existing = ss.getSheets().map(function(s) { return s.getName(); });
  
  sheets.forEach(function(name) {
    if (existing.indexOf(name) === -1) {
      var s = ss.insertSheet(name);
      if (name === "Clients") {
        s.appendRow(["Client ID", "Company Name", "Operational Track", "Maturity Tier", "Primary Horizon", "Weekly Hours", "Monthly Budget", "Website URL", "Status", "Created Date"]);
      } else if (name === "Audits") {
        s.appendRow(["Client ID", "Date", "Thought Leadership Score", "Full Audit JSON", "Google Slides Deck URL"]);
      } else if (name === "Milestones") {
        s.appendRow(["Client ID", "Milestone ID", "Phase", "Milestone Description", "Target Month", "Completion Status", "Notes"]);
      }
      formatHeaderRow(s);
    }
  });

  var defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }
}

function formatHeaderRow(sheet) {
  var headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange.setBackground(PALETTE.BG_DARK)
             .setFontColor(PALETTE.TEXT_WHITE)
             .setFontWeight("bold")
             .setFontFamily("Arial");
  sheet.setFrozenRows(1);
}

// ==========================================
// 3. CLIENT CRM DATA OPERATIONS
// ==========================================
function getClients() {
  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName("Clients");
    var rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return [];

    var clients = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r[0]) continue;
      clients.push({
        id: String(r[0]), name: String(r[1]), track: String(r[2]),
        maturityTier: Number(r[3]), primaryHorizon: String(r[4]),
        weeklyHours: Number(r[5]), monthlyBudget: Number(r[6]),
        websiteUrl: String(r[7]), status: String(r[8]), createdDate: String(r[9])
      });
    }
    return clients;
  } catch (err) {
    return [];
  }
}

function saveClient(clientData) {
  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName("Clients");
    var rows = sheet.getDataRange().getValues();
    var foundIndex = -1;

    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] == clientData.id) { foundIndex = i + 1; break; }
    }

    var record = [
      clientData.id, clientData.name, clientData.track, clientData.maturityTier,
      clientData.primaryHorizon, clientData.weeklyHours, clientData.monthlyBudget,
      clientData.websiteUrl, clientData.status || "Intake",
      clientData.createdDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd")
    ];

    if (foundIndex > 0) {
      sheet.getRange(foundIndex, 1, 1, record.length).setValues([record]);
    } else {
      sheet.appendRow(record);
    }
    return { success: true, clientId: clientData.id };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function getAudits(clientId) {
  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName("Audits");
    var rows = sheet.getDataRange().getValues();
    var audits = [];
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] == clientId) {
        audits.push({
          clientId: String(rows[i][0]), date: String(rows[i][1]), thoughtLeadershipScore: Number(rows[i][2]),
          auditJson: JSON.parse(rows[i][3]), slidesUrl: String(rows[i][4])
        });
      }
    }
    return audits;
  } catch (err) { return []; }
}

function saveAuditRecord(clientId, score, auditJson, slidesUrl) {
  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName("Audits");
    var dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    sheet.appendRow([clientId, dateStr, score, JSON.stringify(auditJson), slidesUrl || ""]);
    
    var clientsSheet = ss.getSheetByName("Clients");
    var rows = clientsSheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] == clientId) {
        clientsSheet.getRange(i + 1, 9).setValue("Audited");
        break;
      }
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function getMilestones(clientId) {
  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName("Milestones");
    var rows = sheet.getDataRange().getValues();
    var milestones = [];
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] == clientId) {
        milestones.push({
          clientId: String(rows[i][0]), id: String(rows[i][1]), phase: Number(rows[i][2]),
          description: String(rows[i][3]), targetMonth: Number(rows[i][4]),
          completed: Boolean(rows[i][5]), notes: String(rows[i][6] || "")
        });
      }
    }
    return milestones;
  } catch (err) { return []; }
}

function saveMilestones(clientId, milestonesList) {
  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName("Milestones");
    var rows = sheet.getDataRange().getValues();
    for (var i = rows.length - 1; i >= 1; i--) {
      if (rows[i][0] == clientId) sheet.deleteRow(i + 1);
    }
    milestonesList.forEach(function(m) {
      sheet.appendRow([clientId, m.id, m.phase, m.description, m.targetMonth, m.completed ? true : false, m.notes || ""]);
    });
    return { success: true, count: milestonesList.length };
  } catch (err) { return { success: false, error: err.toString() }; }
}

function updateMilestoneStatus(clientId, milestoneId, completed) {
  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName("Milestones");
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] == clientId && rows[i][1] == milestoneId) {
        sheet.getRange(i + 1, 6).setValue(completed);
        return { success: true };
      }
    }
    return { success: false, error: "Milestone not found" };
  } catch (err) { return { success: false, error: err.toString() }; }
}

function getGlobalDashboard() {
  try {
    var clients = getClients();
    var ss = getDatabaseSpreadsheet();
    var milestonesSheet = ss.getSheetByName("Milestones");
    var mRows = milestonesSheet.getDataRange().getValues();

    var tradeCount = 0, ttrpgCount = 0, auditedCount = 0, inExecutionCount = 0;
    clients.forEach(function(c) {
      if (c.track === "trade_contractor") tradeCount++;
      if (c.track === "ttrpg_indie") ttrpgCount++;
      if (c.status === "Audited") auditedCount++;
      if (c.status === "In Execution") inExecutionCount++;
    });

    var upcomingMilestones = [];
    for (var i = 1; i < mRows.length; i++) {
      var r = mRows[i];
      if (!r[0]) continue;
      upcomingMilestones.push({
        clientId: String(r[0]), id: String(r[1]), phase: Number(r[2]),
        description: String(r[3]), targetMonth: Number(r[4]), completed: Boolean(r[5]), notes: String(r[6] || "")
      });
    }

    return {
      success: true,
      stats: { totalClients: clients.length, activeAudits: auditedCount + inExecutionCount, tradeBreakdown: tradeCount, ttrpgBreakdown: ttrpgCount },
      clients: clients, upcomingMilestones: upcomingMilestones
    };
  } catch (err) { return { success: false, error: err.toString() }; }
}

// ==========================================
// 4. AI INTELLIGENCE ENGINE (6 Competitors + 1 Client = 7 Entities)
// ==========================================
function getApiKey(customApiKey) {
  if (customApiKey && customApiKey.trim().length > 5) return customApiKey.trim();
  var scriptProps = PropertiesService.getScriptProperties();
  var userProps = PropertiesService.getUserProperties();
  return userProps.getProperty("GEMINI_API_KEY") || scriptProps.getProperty("GEMINI_API_KEY") || "";
}

function saveUserApiKey(apiKey, preferredModel) {
  var props = PropertiesService.getUserProperties();
  if (apiKey) props.setProperty("GEMINI_API_KEY", apiKey.trim());
  if (preferredModel) props.setProperty("PREFERRED_GEMINI_MODEL", preferredModel.trim());
  return { success: true };
}

function getPreferredModel(customModel) {
  if (customModel && customModel.trim().length > 3) return customModel.trim();
  var userProps = PropertiesService.getUserProperties();
  return userProps.getProperty("PREFERRED_GEMINI_MODEL") || DEFAULT_GEMINI_MODEL;
}

function runGeminiAudit(clientData, customApiKey, customModel) {
  try {
    var apiKey = getApiKey(customApiKey);
    if (!apiKey) throw new Error("Missing Gemini API Key. Please provide one in Settings.");

    var model = getPreferredModel(customModel);
    var url = GEMINI_API_BASE + model + ":generateContent?key=" + apiKey;

    var trackPromptDirective = "";
    if (clientData.track === "trade_contractor") {
      trackPromptDirective = 
        "TRACK: TRADE & LOCAL SERVICE BUSINESSES (Contractors / SBOs)\n" +
        "- Authority (1-10): Scored strictly on Google Business Profile health, local 3-pack ranking, verified review velocity, before/after proof assets.\n" +
        "- Battleground: Local search visibility, direct trade referral ecosystems, localized service-radius SEO.\n" +
        "- Roadmap: 4 seasonal demand shifts and recurring commercial preventative maintenance cycles.\n" +
        "- SCALE CEILING: Never benchmark against national monopolies like Angi, HomeAdvisor, Roto-Rooter corporate. Must be regional rivals with 4-30 trucks.";
    } else {
      trackPromptDirective = 
        "TRACK: TTRPG & INDIE CREATIVES (Game Designers / Publishers)\n" +
        "- Authority (1-10): Scored on original mechanics/worldbuilding prestige, devlogs, playtest engagement, and itch.io / DriveThruRPG presence.\n" +
        "- Battleground: Community ownership (Discord), Kickstarter/BackerKit pre-launch follower velocity, Actual Play (AP) coverage.\n" +
        "- Roadmap: 4-phase launch run-up (Playtesting & Community -> Pre-Launch -> Live Campaign Sprint -> Fulfillment & Retail).\n" +
        "- SCALE CEILING: Never benchmark against Hasbro, Wizards of the Coast, Paizo. Benchmarks must be mid-tier boutique contenders.";
    }

    var seedInfo = "";
    if (clientData.seedCompetitors && clientData.seedCompetitors.length > 0) {
      seedInfo = "Seed Rivals provided by user: " + clientData.seedCompetitors.join(", ") + ".\n" +
        "CRITICAL CALIBRATION DIRECTIVE: Audit these Seed Rivals first as the empirical baseline. " +
        "Use their traction to discover 2 Aspirational Leaders (who outperform them by 2-3x) and 2 Lateral Contenders (who contend directly with them). " +
        "Output all 6 competitors plus the client (7 entities total).";
    } else {
      seedInfo = "No seed rivals provided. Identify 2 Aspirational Leaders, 2 Direct Peer Anchors, and 2 Lateral Contenders (6 competitors total + client = 7 entities).";
    }

    var systemInstruction = 
      "You are Oracle, an internal research and reporting tool.\n" +
      "Generate a grounded 10-slide Sourcebook Report as a strategy JSON payload.\n\n" +
      "CORE DIRECTIVES:\n" +
      "1. CANDID TONE: Direct, data-backed consulting tone. Pinpoint positioning failures and identify immediate whitespace.\n" +
      "2. GROUNDED SEARCH MANDATE: Use live web search to identify active domains, verified reviews, and real market dynamics.\n" +
      "3. RESOURCE CHECK: Calibrate against client weekly hours (" + clientData.weeklyHours + " hrs/wk) and monthly spend ($" + clientData.monthlyBudget + "/mo).\n" +
      "4. 3-TIER 6-COMPETITOR BRACKET: You must evaluate exactly 6 competitors plus 1 client (7 entities total):\n" +
      "   - Tier 1 (Aspirational): 2 Aspirational Leaders (role: 'aspirational_1', 'aspirational_2')\n" +
      "   - Tier 2 (Immediate Battleground): Seed Rival 1 ('seed_1'), Client ('client'), Seed Rival 2 ('seed_2')\n" +
      "   - Tier 3 (Lateral Contenders): 2 Lateral / Fast-Follower Contenders ('lateral_1', 'lateral_2')\n" +
      "5. OUTPUT: Return ONLY a valid JSON code block.";

    var prompt = 
      "Generate the complete 10-slide Sourcebook Report for this client:\n" +
      "Client Name: " + clientData.name + "\n" +
      "Track: " + clientData.track + "\n" +
      "Maturity Tier: " + clientData.maturityTier + "\n" +
      "Primary 12-Month Horizon: " + clientData.primaryHorizon + "\n" +
      "Weekly Dedicated Hours: " + clientData.weeklyHours + "\n" +
      "Monthly Growth Budget: $" + clientData.monthlyBudget + "\n" +
      "Website / URL: " + (clientData.websiteUrl || "None provided") + "\n" +
      seedInfo + "\n\n" +
      trackPromptDirective + "\n\n" +
      "You MUST output a valid JSON object matching exactly this schema top-level keys:\n" +
      "- clientId: string\n" +
      "- clientName: string\n" +
      "- track: string\n" +
      "- maturityTier: number\n" +
      "- generatedDate: string\n" +
      "- modelUsed: string\n" +
      "- thoughtLeadershipScore: number (1 to 10)\n" +
      "- slide1_TitleScope: { scopeSummary, speakerNotes }\n" +
      "- slide2_StrategicBaseline: { maturityLabel, capacityVerdict, constraintRealityCheck, speakerNotes }\n" +
      "- slide3_Bracket: { entities: Array of 7 objects with [name, role, roleLabel, websiteOrHandle, authorityScore, audienceScale, primaryBattleground, coreStrength, criticalVulnerabilityOrGap, evidenceBadge], strategicTakeaway, speakerNotes }\n" +
      "- slide4_DeepDive: { channels: [{channel, clientStatus, aspirationalBenchmark, lateralBenchmark, strategicAssessment}], speakerNotes }\n" +
      "- slide5_GapMatrix: { diagnostic: { doingWell: [], doingBetter: [], needToAddWhitespace: [] }, speakerNotes }\n" +
      "- slide6_ICP: { icp: { personaName, corePainPoints: [], buyingOrBackingTriggers: [], primaryHangoutsAndChannels: [], antiPersona }, speakerNotes }\n" +
      "- slide7_Positioning: { positioning: { categoryAnchor, tenSecondElevatorPitch, contrastWedgeAgainstRivals, uniqueValueProposition }, speakerNotes }\n" +
      "- slide8_Roadmap: { phases: [{phase, name, monthRange, focus, keyMilestones: []}], speakerNotes }\n" +
      "- slide9_ChannelWaterfall: { waterfall: { tier1Primary: {channel, cadence, objective}, tier2Secondary: {channel, cadence, objective}, hoursRealityCheck: {totalRequiredHours, mitigationStrategy} }, speakerNotes }\n" +
      "- slide10_AlliesEcosystem: { allies: { nonCompetingPartners: [{partnerType, exampleTargets, referralMechanism}], ecosystemHubs: [{hubName, accessMethod, expectedYield}], referralLoopDesign }, speakerNotes }\n" +
      "- milestones: array of 12 roadmap milestone objects (id, phase, phaseName, targetMonth, description, completed, notes)";

    var payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.2, topP: 0.95, responseMimeType: "application/json" }
    };

    var options = { method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true };
    var response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() !== 200) throw new Error("Gemini API Error: " + response.getContentText());

    var jsonRes = JSON.parse(response.getContentText());
    var rawText = jsonRes.candidates[0].content.parts.map(function(p){ return p.text || ""; }).join("");

    rawText = rawText.trim();
    if (rawText.indexOf("```json") === 0) rawText = rawText.substring(7);
    else if (rawText.indexOf("```") === 0) rawText = rawText.substring(3);
    if (rawText.lastIndexOf("```") === rawText.length - 3) rawText = rawText.substring(0, rawText.length - 3);
    
    var auditData = JSON.parse(rawText.trim());
    auditData.clientId = clientData.id;
    auditData.generatedDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

    if (auditData.milestones && auditData.milestones.length > 0) {
      saveMilestones(clientData.id, auditData.milestones);
    }
    saveAuditRecord(clientData.id, auditData.thoughtLeadershipScore || 5.0, auditData, "");

    return { success: true, audit: auditData };

  } catch (err) {
    Logger.log("Error in runGeminiAudit: " + err);
    return { success: false, error: err.toString() };
  }
}

// ==========================================
// 5. SLIDES GENERATOR (Path B: Template Clone)
// ==========================================
function createSourcebookSlides(clientData, auditJson) {
  try {
    var props = PropertiesService.getUserProperties();
    var templateId = props.getProperty("SESSION_ZERO_TEMPLATE_ID") || MASTER_TEMPLATE_ID;
    
    if (!templateId) {
      throw new Error("Master Template ID is missing.");
    }

    var templateFile = DriveApp.getFileById(templateId);
    var deckTitle = clientData.name + " - Oracle Sourcebook Report";
    
    var newFile = templateFile.makeCopy(deckTitle);
    var presentation = SlidesApp.openById(newFile.getId());

    var tokenMap = buildTokenMap(clientData, auditJson);
    for (var token in tokenMap) {
      presentation.replaceAllText(token, String(tokenMap[token] || ""));
    }
    
    presentation.saveAndClose();

    var folderName = "Session Zero - " + clientData.name;
    var folders = DriveApp.getFoldersByName(folderName);
    var clientFolder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    
    clientFolder.addFile(newFile);
    DriveApp.getRootFolder().removeFile(newFile);
    
    var editUrl = newFile.getUrl();
    saveAuditRecord(clientData.id, auditJson.thoughtLeadershipScore || 5.0, auditJson, editUrl);

    return {
      success: true,
      presentationId: newFile.getId(),
      slidesUrl: editUrl
    };

  } catch (err) {
    Logger.log("Error cloning slides: " + err);
    return { success: false, error: err.toString() };
  }
}

/**
 * Maps the 7-entity audit data to the Slide Tokens.
 */
function buildTokenMap(clientData, auditJson) {
  function joinArr(arr) {
    if (!arr || !Array.isArray(arr)) return String(arr || "");
    return "• " + arr.map(function(item) { 
      if (typeof item === 'object') {
         var vals = [];
         for (var k in item) vals.push(item[k]);
         return vals.join(" - ");
      }
      return item; 
    }).join("\n• ");
  }

  function formatObj(obj) {
    if (!obj) return "";
    if (typeof obj === "string") return obj;
    var lines = [];
    for (var key in obj) lines.push(obj[key]);
    return lines.join("\n");
  }

  var s2 = auditJson.slide2_StrategicBaseline || {};
  var s3 = auditJson.slide3_Bracket || { entities: [] };
  var s4 = auditJson.slide4_DeepDive || { channels: [] };
  var s5 = (auditJson.slide5_GapMatrix && auditJson.slide5_GapMatrix.diagnostic) || {};
  var s6 = (auditJson.slide6_ICP && auditJson.slide6_ICP.icp) || {};
  var s7 = (auditJson.slide7_Positioning && auditJson.slide7_Positioning.positioning) || {};
  var s8 = auditJson.slide8_Roadmap || { phases: [] };
  var s9 = (auditJson.slide9_ChannelWaterfall && auditJson.slide9_ChannelWaterfall.waterfall) || {};
  var s10 = (auditJson.slide10_AlliesEcosystem && auditJson.slide10_AlliesEcosystem.allies) || {};

  // Extract entities by role or fallback by index
  var ents = s3.entities || [];
  var asp1 = ents.find(function(e){ return e.role === 'aspirational_1'; }) || ents[0] || {};
  var asp2 = ents.find(function(e){ return e.role === 'aspirational_2'; }) || ents[1] || {};
  var seed1 = ents.find(function(e){ return e.role === 'seed_1'; }) || ents[2] || {};
  var clientEnt = ents.find(function(e){ return e.role === 'client'; }) || ents[3] || {};
  var seed2 = ents.find(function(e){ return e.role === 'seed_2'; }) || ents[4] || {};
  var lat1 = ents.find(function(e){ return e.role === 'lateral_1'; }) || ents[5] || {};
  var lat2 = ents.find(function(e){ return e.role === 'lateral_2'; }) || ents[6] || {};

  return {
    // Slide 1
    '{{CLIENT_NAME}}': clientData.name || "Client",
    '{{OPERATIONAL_TRACK}}': clientData.track === 'trade_contractor' ? "Trade Contractor & SBO" : "TTRPG & Indie Game Studio",
    '{{MATURITY_TIER}}': "Tier " + clientData.maturityTier,
    '{{PRIMARY_GOAL}}': clientData.primaryHorizon || "",
    '{{DATE}}': Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy'),

    // Slide 2
    '{{AUTHORITY_SCORE}}': auditJson.thoughtLeadershipScore || "5",
    '{{CURRENT_ASSETS}}': clientData.websiteUrl || "Provided URL",
    '{{PRIMARY_BOTTLENECK}}': s2.constraintRealityCheck || "Lack of conversion assets",
    '{{WEEKLY_HOURS}}': clientData.weeklyHours || "0",
    '{{MONTHLY_BUDGET}}': "$" + clientData.monthlyBudget,
    '{{STRATEGIC_DIRECTIVE}}': s2.capacityVerdict || "Focus on core strengths",

    // Slide 3: 7-Entity Spread
    '{{ASPIRATIONAL_1_NAME}}': asp1.name || "Aspirational Leader 1",
    '{{ASPIRATIONAL_1_CHANNELS}}': asp1.primaryBattleground || "",
    '{{ASPIRATIONAL_1_SCORE}}': asp1.authorityScore || "",
    '{{ASPIRATIONAL_2_NAME}}': asp2.name || "Aspirational Leader 2",
    '{{ASPIRATIONAL_2_CHANNELS}}': asp2.primaryBattleground || "",
    '{{ASPIRATIONAL_2_SCORE}}': asp2.authorityScore || "",
    
    '{{SEED_1_NAME}}': seed1.name || "Seed Peer 1",
    '{{SEED_1_CHANNELS}}': seed1.primaryBattleground || "",
    '{{SEED_1_SCORE}}': seed1.authorityScore || "",

    '{{CLIENT_CHANNELS}}': clientEnt.primaryBattleground || clientData.websiteUrl || "Primary channels",
    
    '{{SEED_2_NAME}}': seed2.name || "Seed Peer 2",
    '{{SEED_2_CHANNELS}}': seed2.primaryBattleground || "",
    '{{SEED_2_SCORE}}': seed2.authorityScore || "",

    '{{LATERAL_1_NAME}}': lat1.name || "Lateral Contender 1",
    '{{LATERAL_1_CHANNELS}}': lat1.primaryBattleground || "",
    '{{LATERAL_1_SCORE}}': lat1.authorityScore || "",
    '{{LATERAL_2_NAME}}': lat2.name || "Lateral Contender 2",
    '{{LATERAL_2_CHANNELS}}': lat2.primaryBattleground || "",
    '{{LATERAL_2_SCORE}}': lat2.authorityScore || "",

    // Slide 4
    '{{ASP_1_OWNED}}': s4.channels[0] ? s4.channels[0].aspirationalBenchmark : "",
    '{{ASP_1_COMMUNITY}}': s4.channels[1] ? s4.channels[1].aspirationalBenchmark : "",
    '{{ASP_1_EARNED}}': s4.channels[2] ? s4.channels[2].aspirationalBenchmark : "",
    '{{ASP_2_OWNED}}': s4.channels[0] ? s4.channels[0].aspirationalBenchmark : "",
    '{{ASP_2_COMMUNITY}}': s4.channels[1] ? s4.channels[1].aspirationalBenchmark : "",
    '{{ASP_2_EARNED}}': s4.channels[2] ? s4.channels[2].aspirationalBenchmark : "",
    '{{LAT_1_OWNED}}': s4.channels[0] ? s4.channels[0].lateralBenchmark : "",
    '{{LAT_1_COMMUNITY}}': s4.channels[1] ? s4.channels[1].lateralBenchmark : "",
    '{{LAT_1_EARNED}}': s4.channels[2] ? s4.channels[2].lateralBenchmark : "",
    '{{LAT_2_OWNED}}': s4.channels[0] ? s4.channels[0].lateralBenchmark : "",
    '{{LAT_2_COMMUNITY}}': s4.channels[1] ? s4.channels[1].lateralBenchmark : "",
    '{{LAT_2_EARNED}}': s4.channels[2] ? s4.channels[2].lateralBenchmark : "",

    // Slide 5
    '{{GAP_DOING_WELL}}': joinArr(s5.doingWell),
    '{{GAP_DOING_BETTER}}': joinArr(s5.doingBetter),
    '{{GAP_WHITESPACE}}': joinArr(s5.needToAddWhitespace),

    // Slide 6
    '{{ICP_1_TITLE}}': s6.personaName || "Primary Target",
    '{{ICP_1_PAIN}}': joinArr(s6.corePainPoints),
    '{{ICP_1_TRIGGER}}': joinArr(s6.buyingOrBackingTriggers),
    '{{ICP_1_HUBS}}': joinArr(s6.primaryHangoutsAndChannels),
    '{{ICP_2_TITLE}}': "Anti-Persona (Do Not Pursue)",
    '{{ICP_2_PAIN}}': "Misaligned expectations.",
    '{{ICP_2_TRIGGER}}': "Price-shopping / demanding free support.",
    '{{ICP_2_HUBS}}': s6.antiPersona || "Low-value generalized forums.",

    // Slide 7
    '{{PITCH_CORE}}': s7.tenSecondElevatorPitch || "",
    '{{PITCH_COUNTER}}': s7.contrastWedgeAgainstRivals || "",
    '{{PITCH_VALUE}}': s7.uniqueValueProposition || "",

    // Slide 8
    '{{P1_OBJECTIVE}}': s8.phases[0] ? s8.phases[0].focus : "",
    '{{P1_MILESTONES}}': joinArr(s8.phases[0] ? s8.phases[0].keyMilestones : []),
    '{{P2_OBJECTIVE}}': s8.phases[1] ? s8.phases[1].focus : "",
    '{{P2_MILESTONES}}': joinArr(s8.phases[1] ? s8.phases[1].keyMilestones : []),
    '{{P3_OBJECTIVE}}': s8.phases[2] ? s8.phases[2].focus : "",
    '{{P3_MILESTONES}}': joinArr(s8.phases[2] ? s8.phases[2].keyMilestones : []),
    '{{P4_OBJECTIVE}}': s8.phases[3] ? s8.phases[3].focus : "",
    '{{P4_MILESTONES}}': joinArr(s8.phases[3] ? s8.phases[3].keyMilestones : []),

    // Slide 9
    '{{CONTENT_ANCHOR_PLAN}}': formatObj(s9.tier1Primary),
    '{{CONTENT_CASCADE_PLAN}}': formatObj(s9.tier2Secondary),
    '{{CHANNELS_TO_IGNORE}}': s9.hoursRealityCheck ? s9.hoursRealityCheck.mitigationStrategy : "Ignore vanity platforms until Tier 2 maturity.",

    // Slide 10
    '{{ALLIES_PARTNERS}}': joinArr(s10.nonCompetingPartners),
    '{{ALLIES_MEDIA}}': joinArr(s10.ecosystemHubs),
    '{{ALLIES_EVENTS}}': s10.referralLoopDesign || ""
  };
}

// ==========================================
// 6. ONE-TIME TEMPLATE SYNC FOR 7 ENTITIES
// ==========================================
/**
 * Updates Slide 3 of your existing Master Slide Deck to the 8-row table
 * (1 Header + 2 Aspirational + 2 Seed + 1 Client + 2 Lateral = 7 Entities).
 */
function syncMasterTemplateFor7Entities() {
  var preso = SlidesApp.openById(MASTER_TEMPLATE_ID);
  var slides = preso.getSlides();
  if (slides.length < 3) {
    throw new Error("Master template has less than 3 slides.");
  }

  var s3 = slides[2]; // Slide 3
  
  // Remove existing tables or shapes in content area of Slide 3
  var shapes = s3.getShapes();
  shapes.forEach(function(sh) {
    if (sh.getTop() > 90) sh.remove();
  });
  var tables = s3.getTables();
  tables.forEach(function(t) { t.remove(); });

  // Insert 8-row, 4-column Table
  var t3 = s3.insertTable(8, 4, 40, 95, 640, 260);
  var t3Headers = ["Entity", "Role in Bracket", "Primary Distribution", "Authority (1-10)"];
  var t3Rows = [
    ["{{ASPIRATIONAL_1_NAME}}", "Aspirational Leader", "{{ASPIRATIONAL_1_CHANNELS}}", "{{ASPIRATIONAL_1_SCORE}}"],
    ["{{ASPIRATIONAL_2_NAME}}", "Aspirational Leader", "{{ASPIRATIONAL_2_CHANNELS}}", "{{ASPIRATIONAL_2_SCORE}}"],
    ["{{SEED_1_NAME}}", "Seed Benchmark #1", "{{SEED_1_CHANNELS}}", "{{SEED_1_SCORE}}"],
    ["{{CLIENT_NAME}}", "Center Anchor (Client)", "{{CLIENT_CHANNELS}}", "{{AUTHORITY_SCORE}}"],
    ["{{SEED_2_NAME}}", "Seed Benchmark #2", "{{SEED_2_CHANNELS}}", "{{SEED_2_SCORE}}"],
    ["{{LATERAL_1_NAME}}", "Lateral Contender", "{{LATERAL_1_CHANNELS}}", "{{LATERAL_1_SCORE}}"],
    ["{{LATERAL_2_NAME}}", "Lateral Contender", "{{LATERAL_2_CHANNELS}}", "{{LATERAL_2_SCORE}}"]
  ];

  // Format Header
  for (var c = 0; c < 4; c++) {
    var cell = t3.getCell(0, c);
    cell.getText().setText(t3Headers[c]);
    cell.getFill().setSolidFill(PALETTE.PANEL_BG);
    cell.getText().getTextStyle().setFontSize(9).setBold(true).setForegroundColor(PALETTE.ACCENT_CYAN);
  }

  // Format Data Rows
  for (var r = 0; r < 7; r++) {
    var isClient = (r === 3);
    for (var col = 0; col < 4; col++) {
      var dCell = t3.getCell(r + 1, col);
      dCell.getText().setText(t3Rows[r][col]);
      var style = dCell.getText().getTextStyle();
      style.setFontSize(8);
      if (isClient) {
        style.setBold(true).setForegroundColor(PALETTE.ACCENT_CYAN);
        dCell.getFill().setSolidFill("#0C4A6E");
      } else {
        style.setForegroundColor(PALETTE.TEXT_WHITE);
      }
    }
  }

  preso.saveAndClose();
  Logger.log("Slide 3 of Master Template successfully updated for 7 entities!");
}