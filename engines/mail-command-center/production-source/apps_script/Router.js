/**
 * @file Router.js
 * @description Web App Entry Points, HTTP Routing, Open/Click Tracking Engine, and API Router.
 * Handles HTTP GET/POST endpoints, redirect tracking, Preference Center rendering, and RPC methods.
 * 
 * Features:
 * - doGet(e):
 *   - ?action=track_open: Serves 1x1 transparent tracking pixel and logs open event.
 *   - ?action=track_click: Logs click event and redirects to destination URL.
 *   - ?action=unsubscribe: Serves responsive PreferenceCenter.html.
 *   - ?action=view_browser: Web archive campaign viewer.
 *   - ?action=ping: System health check.
 *   - Default: Serves modern Index.html dashboard.
 * - doPost(e): Validates and dispatches JSON API actions with standardized responses and error handling.
 * - RPC Methods: Direct server-side bindings for the frontend UI via `google.script.run`.
 */

// 1x1 Transparent GIF base64 string
var TRANSPARENT_1X1_GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * Standardized JSON API Response Helper for HTTP POST.
 * 
 * @param {boolean} success True if operation succeeded.
 * @param {any} data Response payload or null.
 * @param {string} [errorMessage] Error description if success is false.
 * @param {string} [errorCode] Machine-readable error code.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON TextOutput with appropriate MIME type.
 */
function createJsonResponse(success, data, errorMessage, errorCode) {
  var responsePayload = {
    success: Boolean(success),
    timestamp: new Date().toISOString(),
    data: data || null,
    error: errorMessage || null,
    code: errorCode || (success ? 'OK' : 'SERVER_ERROR')
  };

  return ContentService.createTextOutput(JSON.stringify(responsePayload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Web App HTTP GET Handler.
 * Routes between tracking pixel, click redirects, preference center, archive view, and UI.
 * 
 * @param {GoogleAppsScript.Events.DoGet} e Event object from Apps Script HTTP GET.
 * @returns {GoogleAppsScript.HTML.HtmlOutput | GoogleAppsScript.Content.TextOutput}
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = (params.action || '').trim().toLowerCase();

    // -------------------------------------------------------------
    // ROUTE 1: TRACKING PIXEL (track_open)
    // -------------------------------------------------------------
    if (action === 'track_open') {
      var email = params.email || params.s_id;
      var campaignId = params.c_id || params.campaign_id || params.campaign_or_drip_id || 'unknown_campaign';
      var stepNumber = params.step_number || params.s_num || '0';
      var variant = params.variant || 'A';

      if (email && email.indexOf('@') !== -1) {
        try {
          // Log open event to Delivery_Logs in Google Sheets
          logDelivery({
            email: email,
            campaign_or_drip_id: campaignId,
            step_number: stepNumber,
            variant_sent: variant,
            status: 'opened',
            timestamp: new Date().toISOString(),
            prevent_duplicates: false
          });
          Logger.log('[Router] Open tracked: ' + email + ' for ' + campaignId);
        } catch (logErr) {
          Logger.log('[Router] Tracking pixel logging warning: ' + logErr.message);
        }
      }

      // Return 1x1 transparent GIF
      var gifBytes = Utilities.base64Decode(TRANSPARENT_1X1_GIF_BASE64);
      var byteString = '';
      for (var b = 0; b < gifBytes.length; b++) {
        var byteVal = gifBytes[b];
        if (byteVal < 0) byteVal += 256;
        byteString += String.fromCharCode(byteVal);
      }

      if (params.render === 'html') {
        return HtmlService.createHtmlOutput(
          '<!DOCTYPE html><html><head><meta name="robots" content="noindex"></head><body style="margin:0;padding:0;background:transparent;">' +
          '<img src="data:image/gif;base64,' + TRANSPARENT_1X1_GIF_BASE64 + '" width="1" height="1" alt="" />' +
          '</body></html>'
        ).setTitle('Tracking Pixel');
      }

      return ContentService.createTextOutput(byteString)
        .setMimeType(ContentService.MimeType.TEXT);
    }

    // -------------------------------------------------------------
    // ROUTE 2: CLICK REDIRECT (track_click)
    // -------------------------------------------------------------
    if (action === 'track_click') {
      var targetUrl = params.url ? decodeURIComponent(params.url) : '';
      var clickEmail = params.email || params.s_id || '';
      var clickCampaignId = params.c_id || params.campaign_id || '';

      if (clickEmail && clickEmail.indexOf('@') !== -1 && clickCampaignId) {
        try {
          logDelivery({
            email: clickEmail,
            campaign_or_drip_id: clickCampaignId,
            step_number: params.step_number || '0',
            variant_sent: params.variant || 'A',
            status: 'opened',
            timestamp: new Date().toISOString(),
            prevent_duplicates: false
          });
        } catch (e) {
          Logger.log('[Router] Click logging notice: ' + e.message);
        }
      }

      if (!targetUrl || targetUrl.indexOf('http') !== 0) {
        targetUrl = 'https://google.com';
      }

      return HtmlService.createHtmlOutput(
        '<!DOCTYPE html><html><head>' +
        '<meta http-equiv="refresh" content="0;url=' + targetUrl + '">' +
        '<script>window.location.replace("' + targetUrl + '");</script>' +
        '</head><body style="font-family:sans-serif;padding:24px;text-align:center;color:#64748b;">' +
        '<p>Redirecting to <a href="' + targetUrl + '">' + targetUrl + '</a>...</p>' +
        '</body></html>'
      ).setTitle('Redirecting...');
    }

    // -------------------------------------------------------------
    // ROUTE 3: PREFERENCE CENTER & UNSUBSCRIBE
    // -------------------------------------------------------------
    if (action === 'unsubscribe' || action === 'preferences') {
      return HtmlService.createHtmlOutputFromFile('PreferenceCenter')
        .setTitle('Manage Email Preferences')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // -------------------------------------------------------------
    // ROUTE 4: VIEW IN BROWSER ARCHIVE
    // -------------------------------------------------------------
    if (action === 'view_browser') {
      var archiveCampId = params.c_id || params.campaign_id;
      if (archiveCampId) {
        var camps = getRows('Campaigns');
        var camp = camps.find(function(c) { return String(c.campaign_id).trim() === String(archiveCampId).trim(); });
        if (camp) {
          var newsletters = getRows('Newsletters');
          var nlt = newsletters.find(function(n) { return n.newsletter_id === camp.newsletter_id; }) || {};
          var raw = fetchCampaignRawContent(camp, nlt);
          var rendered = compileEmailContent(raw, { email: 'subscriber@sessionzero.solutions', first_name: 'Friend', last_name: '' }, camp, nlt, 'A');
          return HtmlService.createHtmlOutput(rendered.html)
            .setTitle(camp.subject_line_a || camp.name)
            .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
        }
      }
      return HtmlService.createHtmlOutput('<p>Campaign not found.</p>');
    }

    // -------------------------------------------------------------
    // ROUTE 5: HEALTH CHECK PING
    // -------------------------------------------------------------
    if (action === 'ping') {
      var settings = getSystemSettings();
      return createJsonResponse(true, {
        status: 'online',
        kill_switch: isGlobalKillSwitchActive(),
        settings: settings
      });
    }

    // -------------------------------------------------------------
    // ROUTE 6: DEFAULT - SERVE INDEX WEB APP DASHBOARD
    // -------------------------------------------------------------
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Mailchimp Clone - Google Apps Script Console')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (error) {
    Logger.log('[Router] doGet critical error: ' + error.message);
    return HtmlService.createHtmlOutput(
      '<div style="font-family:sans-serif;padding:24px;color:#b91c1c;">' +
      '<h3>Application Launch Error</h3><p>' + error.message + '</p>' +
      '<p>Please verify that the active spreadsheet has the required schema and tabs.</p>' +
      '</div>'
    );
  }
}

/**
 * Web App HTTP POST Handler.
 * Internal REST API router for incoming JSON payloads.
 * 
 * @param {GoogleAppsScript.Events.DoPost} e Event object from Apps Script HTTP POST.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse(false, null, 'Malformed request: Missing POST body payload.', 'EMPTY_BODY');
    }

    var request;
    try {
      request = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return createJsonResponse(false, null, 'Invalid JSON format in request body.', 'INVALID_JSON');
    }

    var action = (request.action || '').trim();
    var payload = request.payload || {};

    if (!action) {
      return createJsonResponse(false, null, 'Missing required parameter: "action".', 'MISSING_ACTION');
    }

    switch (action) {

      // --- SENDING ENGINE ACTIONS ---
      case 'send_test_email':
        if (!payload.campaign_id || !payload.test_email) {
          return createJsonResponse(false, null, 'Validation error: "campaign_id" and "test_email" are required.', 'VALIDATION_ERROR');
        }
        return createJsonResponse(true, sendTestEmail(payload.campaign_id, payload.test_email));

      case 'execute_campaign':
        if (!payload.campaign_id) {
          return createJsonResponse(false, null, 'Validation error: "campaign_id" is required.', 'VALIDATION_ERROR');
        }
        return createJsonResponse(true, executeCampaign(payload.campaign_id, payload.start_index));

      case 'resume_campaign':
        return createJsonResponse(true, resumeCampaignExecution());

      // --- DRIP & BOUNCE ENGINES ---
      case 'run_drip_sequences':
        return createJsonResponse(true, runDripSequences());

      case 'process_bounces':
        return createJsonResponse(true, processBounces(payload.max_threads));

      // --- PREFERENCE CENTER ---
      case 'save_preferences':
        if (!payload.email) return createJsonResponse(false, null, 'Missing email', 'VALIDATION_ERROR');
        return createJsonResponse(true, rpcSavePreferences(payload.email, payload.selected_newsletters));

      case 'unsubscribe_all':
        if (!payload.email) return createJsonResponse(false, null, 'Missing email', 'VALIDATION_ERROR');
        return createJsonResponse(true, rpcUnsubscribeAll(payload.email));

      // --- SUBSCRIBER MANAGEMENT ---
      case 'add_or_update_subscriber':
        if (!payload.email) {
          return createJsonResponse(false, null, 'Validation error: "email" is required.', 'VALIDATION_ERROR');
        }
        return createJsonResponse(true, addOrUpdateSubscriber(payload));

      case 'get_subscribers':
        var subscribers = getRows('Subscribers');
        return createJsonResponse(true, { count: subscribers.length, subscribers: subscribers });

      // --- CAMPAIGN MANAGEMENT ---
      case 'create_campaign':
        return createJsonResponse(true, handleCreateCampaign(payload));

      case 'get_campaigns':
        var campaigns = getRows('Campaigns');
        return createJsonResponse(true, { count: campaigns.length, campaigns: campaigns });

      // --- DELIVERY LOGGING ---
      case 'log_delivery':
        if (!payload.email || (!payload.campaign_id && !payload.campaign_or_drip_id)) {
          return createJsonResponse(false, null, 'Validation error: "email" and "campaign_id" required.', 'VALIDATION_ERROR');
        }
        return createJsonResponse(true, logDelivery(payload));

      case 'get_delivery_logs':
        var logs = getRows('Delivery_Logs');
        return createJsonResponse(true, { count: logs.length, logs: logs });

      // --- SYSTEM & CONFIGURATION ---
      case 'get_system_settings':
        return createJsonResponse(true, getSystemSettings(Boolean(payload.refresh)));

      case 'check_quota':
        return createJsonResponse(true, checkEmailQuota());

      case 'set_kill_switch':
        var active = Boolean(payload.active);
        setSystemSetting('GLOBAL_KILL_SWITCH', active ? 'true' : 'false');
        return createJsonResponse(true, { kill_switch_active: active });

      default:
        return createJsonResponse(
          false, 
          null, 
          'Unrecognized action: "' + action + '".', 
          'UNKNOWN_ACTION'
        );
    }

  } catch (error) {
    Logger.log('[Router] doPost error: ' + error.message);
    return createJsonResponse(false, null, error.message, 'INTERNAL_ERROR');
  }
}

/**
 * Handles creation of a new campaign in the 'Campaigns' tab.
 */
function handleCreateCampaign(payload) {
  assertOperationsAllowed();

  if (!payload.name || !payload.newsletter_id) {
    throw new Error('handleCreateCampaign failed: "name" and "newsletter_id" are required fields.');
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_TIMEOUT_MS);
    var ss = getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Campaigns');
    if (!sheet) throw new Error('Campaigns tab does not exist in spreadsheet.');

    var campaignId = payload.campaign_id || generateId('camp');
    var newsletterId = String(payload.newsletter_id).trim();
    var name = String(payload.name).trim();
    var contentType = payload.content_type || 'html';
    var sourceId = payload.source_id || '';
    var status = payload.status || 'DRAFT';
    var scheduledTime = payload.scheduled_time || '';
    var subjectA = payload.subject_line_a || payload.subject || '';
    var subjectB = payload.subject_line_b || '';
    var splitRatio = payload.test_split_ratio !== undefined ? Number(payload.test_split_ratio) : 50;

    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });

    var newRow = headers.map(function(header) {
      switch (header) {
        case 'campaign_id': return campaignId;
        case 'newsletter_id': return newsletterId;
        case 'name': return name;
        case 'content_type': return contentType;
        case 'source_id': return sourceId;
        case 'status': return status;
        case 'scheduled_time': return scheduledTime;
        case 'subject_line_a': return subjectA;
        case 'subject_line_b': return subjectB;
        case 'test_split_ratio': return splitRatio;
        default: return payload[header] !== undefined ? payload[header] : '';
      }
    });

    sheet.appendRow(newRow);

    var createdObj = {};
    headers.forEach(function(h, idx) {
      createdObj[h] = newRow[idx];
    });

    return {
      action: 'created',
      campaign: createdObj
    };

  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// GOOGLE.SCRIPT.RUN RPC ENTRY POINTS (Used directly by frontend UI)
// =========================================================================

function rpcSendTestEmail(campaignId, testEmail) {
  return sendTestEmail(campaignId, testEmail);
}

function rpcExecuteCampaign(campaignId) {
  return executeCampaign(campaignId);
}

function rpcResumeCampaignExecution() {
  return resumeCampaignExecution();
}

function rpcRunDripSequences() {
  return runDripSequences();
}

function rpcInstallDripTrigger() {
  return installDripTrigger();
}

function rpcProcessBounces() {
  return processBounces();
}

function rpcInstallBounceTrigger() {
  return installBounceTrigger();
}

function rpcGetPreferenceData(email) {
  var cleanEmail = email ? email.trim().toLowerCase() : '';
  var subscribers = getRows('Subscribers');
  var sub = cleanEmail ? subscribers.find(function(s) { return String(s.email).trim().toLowerCase() === cleanEmail; }) : null;

  var newsletters = getRows('Newsletters');
  var subscribedList = [];

  if (sub && sub.subscribed_newsletters) {
    subscribedList = String(sub.subscribed_newsletters).split(',').map(function(s) { return s.trim(); });
  } else if (newsletters.length > 0) {
    // Default to first newsletter if new
    subscribedList = [newsletters[0].newsletter_id];
  }

  return {
    email: cleanEmail || 'subscriber@sessionzero.solutions',
    subscribedNewsletters: subscribedList,
    allNewsletters: newsletters
  };
}

function rpcSavePreferences(email, selectedNewsletters) {
  return addOrUpdateSubscriber({
    email: email,
    subscribed_newsletters: selectedNewsletters,
    replace_newsletters: true,
    status: (selectedNewsletters && selectedNewsletters.length > 0) ? 'active' : 'unsubscribed'
  });
}

function rpcUnsubscribeAll(email) {
  return addOrUpdateSubscriber({
    email: email,
    subscribed_newsletters: '',
    replace_newsletters: true,
    status: 'unsubscribed'
  });
}

function rpcGetSystemSettings() {
  return getSystemSettings();
}

function rpcAddOrUpdateSubscriber(subscriberData) {
  return addOrUpdateSubscriber(subscriberData);
}

function rpcCreateCampaign(campaignData) {
  return handleCreateCampaign(campaignData);
}

function rpcLogDelivery(logData) {
  return logDelivery(logData);
}

function rpcGetRows(sheetName) {
  return getRows(sheetName);
}

function rpcCheckQuota() {
  return checkEmailQuota();
}

function rpcSetKillSwitch(active) {
  setSystemSetting('GLOBAL_KILL_SWITCH', active ? 'true' : 'false');
  return active;
}
