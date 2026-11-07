/**
 * @file SendingEngine.js
 * @description Phase 2: Batch Email Delivery, Merge Tag Compilation, Tracking Instrumentation,
 * A/B Testing, and 4.5-minute Timeout-Resilient Continuation Engine for Google Apps Script.
 * 
 * Works directly with Google Sheets DB schema:
 * - System_Settings: Setting_Name, Value, Description
 * - Newsletters: newsletter_id, name, sender_alias, reply_to, default_template_id, created_at
 * - Subscribers: subscriber_id, email, first_name, last_name, subscribed_newsletters, status, source, external_id, created_at
 * - Campaigns: campaign_id, newsletter_id, name, content_type, source_id, status, scheduled_time, subject_line_a, subject_line_b, test_split_ratio
 * - Drip_Sequences: sequence_id, newsletter_id, name, step_number, delay_days, content_type, source_id
 * - Templates: template_id, name, type, drive_file_id, last_updated
 * - Delivery_Logs: log_id_key, subscriber_id, email, campaign_or_drip_id, step_number, variant_sent, timestamp, status, error_message
 */

// Execution Constants
var EXECUTION_TIMEOUT_GUARD_MS = 270000; // 4.5 minutes (Apps Script hard limit is 6 min)
var RESUME_PROPERTY_KEY = 'CAMPAIGN_EXECUTION_STATE';
var RESUME_TRIGGER_FUNCTION = 'resumeCampaignExecution';

/**
 * Gets the deployed Web App URL for generating trackable open/click and unsubscribe links.
 * Falls back to ScriptProperties WEB_APP_URL or ScriptApp.getService().getUrl().
 * 
 * @returns {string} Fully qualified Web App URL.
 */
function getWebAppUrl() {
  var props = PropertiesService.getScriptProperties();
  var configuredUrl = props.getProperty('WEB_APP_URL');
  if (configuredUrl && configuredUrl.trim()) {
    return configuredUrl.trim();
  }

  try {
    var serviceUrl = ScriptApp.getService().getUrl();
    if (serviceUrl) return serviceUrl;
  } catch (e) {
    Logger.log('[SendingEngine] Warning: Could not detect Web App URL via ScriptApp: ' + e.message);
  }

  return 'https://script.google.com/macros/s/CURRENT_DEPLOYMENT_ID/exec';
}

/**
 * Helper to update campaign status in the 'Campaigns' tab with LockService.
 * 
 * @param {string} campaignId
 * @param {string} newStatus Status ('DRAFT' | 'APPROVED' | 'TEST_SENT' | 'SENDING' | 'RESUMING' | 'COMPLETED' | 'PAUSED_QUOTA')
 */
function updateCampaignStatus(campaignId, newStatus) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var ss = getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Campaigns');
    if (!sheet) throw new Error('Campaigns tab does not exist.');

    var values = sheet.getDataRange().getValues();
    if (values.length <= 1) throw new Error('Campaigns tab has no data.');

    var headers = values[0].map(function(h) { return String(h).trim(); });
    var idCol = headers.indexOf('campaign_id');
    var statusCol = headers.indexOf('status');

    if (idCol === -1 || statusCol === -1) {
      throw new Error('Required columns campaign_id or status missing in Campaigns tab.');
    }

    for (var r = 1; r < values.length; r++) {
      if (String(values[r][idCol]).trim() === String(campaignId).trim()) {
        sheet.getRange(r + 1, statusCol + 1).setValue(newStatus);
        Logger.log('[SendingEngine] Campaign ' + campaignId + ' status updated to ' + newStatus);
        return true;
      }
    }

    throw new Error('Campaign not found with ID: ' + campaignId);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Deterministic string hasher for A/B testing assignment.
 * Generates identical integer values for the same email address across executions.
 * 
 * @param {string} str Input string (e.g. subscriber email)
 * @returns {number} Non-negative 32-bit hash value.
 */
function hashString(str) {
  var hash = 0;
  if (!str || str.length === 0) return hash;
  for (var i = 0; i < str.length; i++) {
    var char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Exports a Google Doc as HTML and returns only the body contents.
 * @param {string} docId Google Docs file ID.
 * @returns {string} HTML fragment from the document body.
 * @throws {Error} If the document cannot be exported as HTML.
 */
function getGoogleDocHtml(docId) {
  if (!docId || typeof docId !== 'string') {
    throw new Error('getGoogleDocHtml failed: docId is required.');
  }

  var url = 'https://docs.google.com/feeds/download/documents/export/Export?id=' +
    encodeURIComponent(docId) + '&exportFormat=html';
  var response = UrlFetchApp.fetch(url, {
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  });
  var statusCode = response.getResponseCode();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('Google Docs HTML export failed for "' + docId + '" with HTTP status ' + statusCode + '.');
  }

  var html = response.getContentText();
  var bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch || !bodyMatch[1]) {
    throw new Error('Google Docs HTML export returned no body content for "' + docId + '".');
  }
  return bodyMatch[1];
}

/**
 * Fetches content body based on Campaign content_type:
 * 1. GMAIL_DRAFT: Clones HTML body from an existing Gmail draft matching source_id.
 * 2. DOC_SHELL: Pulls master shell HTML from Templates (drive_file_id) and injects Google Doc HTML from source_id into {{body}}.
 * 
 * @param {Object} campaign Campaign record object.
 * @param {Object} newsletter Newsletter record object.
 * @returns {string} Raw un-compiled HTML template string.
 */
function fetchCampaignRawContent(campaign, newsletter) {
  var contentType = String(campaign.content_type || 'DOC_SHELL').trim().toUpperCase();
  var sourceId = String(campaign.source_id || '').trim();

  // -----------------------------------------------------------------
  // 1. GMAIL_DRAFT: Clone existing draft by draft ID
  // -----------------------------------------------------------------
  if (contentType === 'GMAIL_DRAFT') {
    if (!sourceId) {
      throw new Error('Campaign content_type is GMAIL_DRAFT but source_id (Draft ID) is empty.');
    }

    try {
      var draft = GmailApp.getDraft(sourceId);
      if (!draft) {
        throw new Error('Gmail draft with ID "' + sourceId + '" was not found.');
      }
      return draft.getMessage().getBody();
    } catch (err) {
      Logger.log('[SendingEngine] Error loading Gmail draft: ' + err.message);
      throw new Error('Failed to load Gmail draft (' + sourceId + '): ' + err.message);
    }
  }

  // -----------------------------------------------------------------
  // 2. DOC_SHELL: Template master shell + Google Doc body
  // -----------------------------------------------------------------
  if (contentType === 'DOC_SHELL') {
    var templates = getRows('Templates');
    var defaultTplId = newsletter.default_template_id;
    var template = null;

    if (defaultTplId) {
      template = templates.find(function(t) { return t.template_id === defaultTplId; });
    }
    if (!template && templates.length > 0) {
      template = templates[0];
    }

    var shellHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;margin:0;padding:20px;color:#1e293b;"><div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;">{{body}}<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;"><p><a href="{{view_in_browser}}">View in Browser</a> &bull; <a href="{{unsubscribe_url}}">Unsubscribe</a></p></div></div></body></html>';

    // If template has a drive_file_id, load it
    if (template && template.drive_file_id) {
      try {
        var shellFile = DriveApp.getFileById(template.drive_file_id);
        if (shellFile.getMimeType() === 'application/vnd.google-apps.document') {
          shellHtml = getGoogleDocHtml(template.drive_file_id);
        } else {
          shellHtml = shellFile.getBlob().getDataAsString();
        }
      } catch (e) {
        Logger.log('[SendingEngine] Warning: Could not read template file (' + template.drive_file_id + '), using default shell: ' + e.message);
      }
    }

    // Pull Google Doc body content if source_id is provided
    var docBodyHtml = '<p>Hello {{first_name}},</p><p>This is your newsletter content.</p>';
    if (sourceId) {
      try {
        docBodyHtml = getGoogleDocHtml(sourceId);
      } catch (docErr) {
        Logger.log('[SendingEngine] Warning: Could not read Google Doc (' + sourceId + '), using fallback body: ' + docErr.message);
        docBodyHtml = '<p>' + (campaign.name || 'Newsletter Content') + '</p>';
      }
    }

    // Inject Google Doc body into {{body}} of shell
    if (shellHtml.indexOf('{{body}}') !== -1) {
      return shellHtml.replace(/\{\{body\}\}/g, docBodyHtml);
    } else {
      return shellHtml + docBodyHtml;
    }
  }

  // Fallback for custom HTML content
  return '<!DOCTYPE html><html><body><p>Hello {{first_name}},</p><p>' + (campaign.name || '') + '</p><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p></body></html>';
}

/**
 * Performs merge tag compilation, link click rewriting, and 1x1 tracking pixel instrumentation.
 * 
 * Merge Tags:
 * - {{first_name}}, {{last_name}}, {{email}}, {{newsletter_name}}
 * - {{unsubscribe_url}}: Preference center with encoded email parameter
 * - {{view_in_browser}}: Web App URL rendering archived campaign view
 * 
 * Link Tracking:
 * - Rewrites <a href="..."> to: ?action=track_click&url=...&c_id=...&s_id=...
 * 
 * Open Tracking:
 * - Injects <img src="?action=track_open&c_id=...&s_id=...&email=..." width="1" height="1" style="display:none;" />
 * 
 * @param {string} rawHtml Template HTML
 * @param {Object} recipient Subscriber record
 * @param {Object} campaign Campaign record
 * @param {Object} newsletter Newsletter record
 * @param {string} variant 'A' or 'B'
 * @returns {string} Fully compiled HTML ready for dispatch.
 */
function compileEmailContent(rawHtml, recipient, campaign, newsletter, variant) {
  var webAppUrl = getWebAppUrl();
  var campaignId = campaign.campaign_id;
  var newsletterId = newsletter.newsletter_id || campaign.newsletter_id;
  var subscriberId = recipient.subscriber_id || recipient.email;
  var cleanEmail = recipient.email.trim();

  // 1. Generate URLs
  var unsubUrl = webAppUrl + (webAppUrl.indexOf('?') === -1 ? '?' : '&') +
    'action=unsubscribe' +
    '&email=' + encodeURIComponent(cleanEmail) +
    '&c_id=' + encodeURIComponent(campaignId) +
    '&news_id=' + encodeURIComponent(newsletterId);

  var viewBrowserUrl = webAppUrl + (webAppUrl.indexOf('?') === -1 ? '?' : '&') +
    'action=view_browser' +
    '&c_id=' + encodeURIComponent(campaignId) +
    '&s_id=' + encodeURIComponent(subscriberId);

  // 2. Perform merge tag replacements
  var resolvedNewsletterName = (newsletter && newsletter.name) || (campaign && campaign.newsletter_name) || (campaign && campaign.name) || 'Session Zero Solutions';
  var compiled = rawHtml
    .replace(/\{\{first_name\}\}/gi, recipient.first_name || 'Subscriber')
    .replace(/\{\{last_name\}\}/gi, recipient.last_name || '')
    .replace(/\{\{email\}\}/gi, cleanEmail)
    .replace(/\{\{newsletter_name\}\}/gi, resolvedNewsletterName)
    .replace(/\{\{unsubscribe_url\}\}/gi, unsubUrl)
    .replace(/\{\{view_in_browser\}\}/gi, viewBrowserUrl);

  // Guarantee no lingering {{newsletter_name}} variants remain
  compiled = compiled.replace(/\{\{\s*newsletter_name\s*\}\}/gi, resolvedNewsletterName);

  // 3. Rewrite anchor tags for click tracking: <a href="...">
  // Matches href attributes that are HTTP/HTTPS links (ignores mailto:, tel:, #)
  var anchorRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(https?:\/\/[^"']+)\1([^>]*)>/gi;
  compiled = compiled.replace(anchorRegex, function(match, quote, originalUrl, rest) {
    // Avoid double wrapping if already pointing to the tracking route
    if (originalUrl.indexOf('action=track_click') !== -1) {
      return match;
    }
    var trackingUrl = webAppUrl + (webAppUrl.indexOf('?') === -1 ? '?' : '&') +
      'action=track_click' +
      '&url=' + encodeURIComponent(originalUrl) +
      '&c_id=' + encodeURIComponent(campaignId) +
      '&s_id=' + encodeURIComponent(subscriberId) +
      '&variant=' + encodeURIComponent(variant);

    return '<a href=' + quote + trackingUrl + quote + rest + '>';
  });

  // 4. Inject 1x1 Open Tracking Pixel before </body>
  var trackingPixelUrl = webAppUrl + (webAppUrl.indexOf('?') === -1 ? '?' : '&') +
    'action=track_open' +
    '&c_id=' + encodeURIComponent(campaignId) +
    '&s_id=' + encodeURIComponent(subscriberId) +
    '&email=' + encodeURIComponent(cleanEmail) +
    '&variant=' + encodeURIComponent(variant);

  var pixelTag = '<img src="' + trackingPixelUrl + '" width="1" height="1" style="display:none;width:1px;height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;" alt="" />';

  if (compiled.indexOf('</body>') !== -1) {
    compiled = compiled.replace('</body>', pixelTag + '</body>');
  } else {
    compiled = compiled + pixelTag;
  }

  return {
    html: compiled,
    unsubUrl: unsubUrl,
    viewBrowserUrl: viewBrowserUrl
  };
}

/**
 * SECTION 1: PRE-FLIGHT TEST EMAIL DISPATCH
 * 
 * Compiles campaign content for a dummy test recipient and dispatches strictly
 * to the specified testEmail with subject prefix [TEST]. Updates status to TEST_SENT.
 * 
 * @param {string} campaignId ID of campaign to test.
 * @param {string} testEmail Email address to receive the test.
 * @returns {Object} Test dispatch summary.
 */
function sendTestEmail(campaignId, testEmail) {
  if (!campaignId || !testEmail) {
    throw new Error('sendTestEmail failed: campaignId and testEmail are required.');
  }

  var cleanTestEmail = sanitizeAndValidateEmail(testEmail);

  // 1. Fetch Campaign and Newsletter records
  var campaigns = getRows('Campaigns');
  var campaign = campaigns.find(function(c) { return String(c.campaign_id).trim() === String(campaignId).trim(); });
  if (!campaign) {
    throw new Error('Campaign not found with ID: ' + campaignId);
  }

  var newsletters = getRows('Newsletters');
  var newsletter = newsletters.find(function(n) { return String(n.newsletter_id).trim() === String(campaign.newsletter_id).trim(); }) || {
    sender_alias: 'newsletter@sessionzero.solutions',
    reply_to: 'reply@sessionzero.solutions'
  };

  // 2. Build dummy subscriber for merge tag preview
  var dummySubscriber = {
    subscriber_id: 'sub_test_preview',
    email: cleanTestEmail,
    first_name: 'TestRecipient',
    last_name: 'Preview',
    subscribed_newsletters: campaign.newsletter_id,
    status: 'active'
  };

  // 3. Compile Content
  var rawHtml = fetchCampaignRawContent(campaign, newsletter);
  var compiledContent = compileEmailContent(rawHtml, dummySubscriber, campaign, newsletter, 'A');

  var subject = '[TEST] ' + (campaign.subject_line_a || campaign.name || 'Test Campaign');
  var plainText = 'This is a test preview for campaign: ' + campaign.name + '\nView in HTML email client.';

  // 4. Send via GmailApp
  var sendOptions = {
    name: newsletter.name || 'Newsletter Team',
    replyTo: newsletter.reply_to || undefined,
    htmlBody: compiledContent.html,
    headers: {
      "List-Unsubscribe": "<" + compiledContent.unsubUrl + ">",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
    }
  };

  if (newsletter.sender_alias && newsletter.sender_alias.indexOf('@') !== -1) {
    sendOptions.from = newsletter.sender_alias;
  }

  GmailApp.sendEmail(cleanTestEmail, subject, plainText, sendOptions);

  // 5. Update status to TEST_SENT
  updateCampaignStatus(campaignId, 'TEST_SENT');

  Logger.log('[SendingEngine] Test email dispatched successfully to ' + cleanTestEmail);
  return {
    success: true,
    campaign_id: campaignId,
    test_email: cleanTestEmail,
    subject: subject,
    status: 'TEST_SENT'
  };
}

/**
 * SECTION 2: CAMPAIGN EXECUTION ORCHESTRATOR
 * 
 * Verifies pre-flight safety checks, confirms campaign is APPROVED or RESUMING,
 * switches status to SENDING, and executes the timeout-protected batch loop.
 * 
 * @param {string} campaignId Campaign to execute.
 * @param {number} [startIndex=0] Index to start from (used during continuation).
 * @returns {Object} Execution summary.
 */
function executeCampaign(campaignId, startIndex) {
  // 1. Verify GLOBAL_KILL_SWITCH from Config.js
  assertOperationsAllowed();

  if (!campaignId) {
    throw new Error('executeCampaign failed: campaignId is required.');
  }

  // 2. Fetch Campaign
  var campaigns = getRows('Campaigns');
  var campaign = campaigns.find(function(c) { return String(c.campaign_id).trim() === String(campaignId).trim(); });
  if (!campaign) {
    throw new Error('Campaign not found with ID: ' + campaignId);
  }

  // 3. Verify status: Must be APPROVED or RESUMING
  var currentStatus = String(campaign.status || '').trim().toUpperCase();
  if (currentStatus !== 'APPROVED' && currentStatus !== 'RESUMING' && currentStatus !== 'SENDING') {
    throw new Error('Refusing campaign dispatch: Status is "' + currentStatus + '". Campaign must be APPROVED or RESUMING before sending.');
  }

  // 4. Switch status to SENDING
  updateCampaignStatus(campaignId, 'SENDING');

  // 5. Run the batch dispatch loop
  return processCampaignBatchLoop(campaign, startIndex || 0);
}

/**
 * Core Batch Loop with 4.5-minute timeout guard, quota buffer check,
 * double-send ledger verification, and A/B split testing.
 * 
 * @param {Object} campaign Campaign record object.
 * @param {number} startIndex Index of recipient to resume from.
 * @returns {Object} Result metrics.
 */
function processCampaignBatchLoop(campaign, startIndex) {
  var startTime = Date.now();
  var campaignId = campaign.campaign_id;
  var newsletterId = campaign.newsletter_id;

  // 1. Fetch Newsletter
  var newsletters = getRows('Newsletters');
  var newsletter = newsletters.find(function(n) { return String(n.newsletter_id).trim() === String(newsletterId).trim(); }) || {
    sender_alias: '',
    reply_to: ''
  };

  // 2. Fetch Eligible Subscribers
  // Filter for active subscribers subscribed to this campaign's newsletter
  var allSubscribers = getRows('Subscribers');
  var eligibleRecipients = allSubscribers.filter(function(sub) {
    var status = String(sub.status || '').toLowerCase();
    if (status !== 'active') return false;

    var subsList = String(sub.subscribed_newsletters || '');
    if (!newsletterId) return true;
    return subsList.indexOf(newsletterId) !== -1;
  });

  var totalRecipients = eligibleRecipients.length;
  Logger.log('[SendingEngine] Processing campaign ' + campaignId + ': ' + totalRecipients + ' eligible recipients (starting at ' + startIndex + ')');

  // 3. Pre-load Delivery_Logs for fast in-memory double-send checking
  var deliveryLogs = getRows('Delivery_Logs');
  var existingLedgerKeys = {};
  deliveryLogs.forEach(function(log) {
    var key = String(log.log_id_key || '').trim();
    var status = String(log.status || '').toLowerCase();
    if (key && (status === 'sent' || status === 'delivered' || status === 'opened' || status === 'success')) {
      existingLedgerKeys[key] = true;
    }
  });

  // 4. Pre-compile Master Content Template
  var rawHtml = fetchCampaignRawContent(campaign, newsletter);

  // 5. Setup A/B Split Ratio
  var hasSubjectB = Boolean(campaign.subject_line_b && String(campaign.subject_line_b).trim().length > 0);
  var splitRatio = campaign.test_split_ratio !== undefined ? Number(campaign.test_split_ratio) : 50;

  // Quota buffer from System_Settings
  var settings = getSystemSettings();
  var quotaBuffer = Number(settings['DAILY_QUOTA_LIMIT']) || 100;

  var sentCount = 0;
  var skippedCount = 0;
  var failedCount = 0;

  // -----------------------------------------------------------------
  // DISPATCH LOOP
  // -----------------------------------------------------------------
  for (var i = startIndex; i < totalRecipients; i++) {
    var recipient = eligibleRecipients[i];
    var email = recipient.email;

    // A. 4.5-MINUTE EXECUTION TIMEOUT GUARD
    if ((Date.now() - startTime) >= EXECUTION_TIMEOUT_GUARD_MS) {
      Logger.log('[SendingEngine] 4.5-minute execution ceiling reached at recipient index ' + i + ' (' + email + '). Saving state and scheduling continuation.');
      
      // Store state in PropertiesService
      var resumeState = {
        campaignId: campaignId,
        lastProcessedIndex: i,
        lastProcessedEmail: email,
        totalRecipients: totalRecipients,
        timestamp: Date.now()
      };
      PropertiesService.getScriptProperties().setProperty(RESUME_PROPERTY_KEY, JSON.stringify(resumeState));

      // Update status to RESUMING
      updateCampaignStatus(campaignId, 'RESUMING');

      // Schedule one-time trigger 1 minute out
      scheduleContinuationTrigger();

      return {
        completed: false,
        resumed_scheduled: true,
        campaign_id: campaignId,
        processed_count: i,
        total_recipients: totalRecipients,
        message: 'Yielded at 4.5 minutes. Continuation trigger created for 1 minute.'
      };
    }

    // B. QUOTA CHECK
    var remainingQuota = 0;
    try {
      remainingQuota = MailApp.getRemainingDailyQuota();
    } catch (qErr) {
      remainingQuota = 0;
    }

    if (remainingQuota <= quotaBuffer) {
      Logger.log('[SendingEngine] Quota buffer limit hit: ' + remainingQuota + ' remaining (buffer is ' + quotaBuffer + '). Pausing campaign.');
      updateCampaignStatus(campaignId, 'PAUSED_QUOTA');
      return {
        completed: false,
        quota_paused: true,
        campaign_id: campaignId,
        remaining_quota: remainingQuota,
        message: 'Campaign paused: Remaining quota (' + remainingQuota + ') is below safety buffer (' + quotaBuffer + ').'
      };
    }

    // C. DOUBLE-SEND PREVENT (Ledger Verification)
    var stepNumber = '0';
    var compositeKey = email.trim().toLowerCase() + '_' + campaignId + '_' + stepNumber;

    if (existingLedgerKeys[compositeKey]) {
      Logger.log('[SendingEngine] Ledger duplicate skipped for: ' + compositeKey);
      skippedCount++;
      continue;
    }

    // D. A/B VARIANT DETERMINATION
    var variant = 'A';
    var subject = campaign.subject_line_a || campaign.name || 'Newsletter';

    if (hasSubjectB) {
      // Deterministic split based on recipient email hash
      var hash = hashString(email) % 100;
      if (hash >= splitRatio) {
        variant = 'B';
        subject = campaign.subject_line_b;
      }
    }

    // E. COMPILE CONTENT
    var compiled = compileEmailContent(rawHtml, recipient, campaign, newsletter, variant);

    // F. DISPATCH VIA GMAILAPP
    try {
      var mailOptions = {
        name: newsletter.name || 'Newsletter Team',
        replyTo: newsletter.reply_to || undefined,
        htmlBody: compiled.html,
        headers: {
          "List-Unsubscribe": "<" + compiled.unsubUrl + ">",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
        }
      };

      if (newsletter.sender_alias && newsletter.sender_alias.indexOf('@') !== -1) {
        mailOptions.from = newsletter.sender_alias;
      }

      // Ensure PDF deliverables attach cleanly rather than leaking raw byte streams into the body
      if (campaign.pdf_deliverable_id || (campaign.source_id && String(campaign.content_type).toUpperCase() === 'PDF')) {
        try {
          var targetPdfId = campaign.pdf_deliverable_id || campaign.source_id;
          var pdfFile = DriveApp.getFileById(targetPdfId);
          mailOptions.attachments = [pdfFile.getAs(MimeType.PDF)];
        } catch (pdfErr) {
          Logger.log('[SendingEngine] Clean PDF attachment notice: ' + pdfErr.message);
        }
      }

      GmailApp.sendEmail(
        email,
        subject,
        'Please enable HTML to view this message.\n' + compiled.viewBrowserUrl,
        mailOptions
      );

      // G. RECORD IN DELIVERY_LOGS
      logDelivery({
        email: email,
        campaign_or_drip_id: campaignId,
        step_number: stepNumber,
        subscriber_id: recipient.subscriber_id || '',
        variant_sent: variant,
        status: 'sent',
        timestamp: new Date().toISOString(),
        prevent_duplicates: false
      });

      // Mark in in-memory ledger
      existingLedgerKeys[compositeKey] = true;
      sentCount++;

    } catch (sendError) {
      Logger.log('[SendingEngine] Error sending to ' + email + ': ' + sendError.message);
      failedCount++;

      // Log failure
      try {
        logDelivery({
          email: email,
          campaign_or_drip_id: campaignId,
          step_number: stepNumber,
          subscriber_id: recipient.subscriber_id || '',
          variant_sent: variant,
          status: 'failed',
          error_message: sendError.message,
          timestamp: new Date().toISOString(),
          prevent_duplicates: false
        });
      } catch (logErr) {
        // Continue
      }
    }
  }

  // -----------------------------------------------------------------
  // ALL RECIPIENTS PROCESSED: COMPLETE CAMPAIGN
  // -----------------------------------------------------------------
  updateCampaignStatus(campaignId, 'COMPLETED');

  // Clean up any residual stored properties and triggers
  cleanupResumeStateAndTriggers();

  Logger.log('[SendingEngine] Campaign ' + campaignId + ' completed successfully. Sent: ' + sentCount + ', Skipped: ' + skippedCount + ', Failed: ' + failedCount);

  return {
    completed: true,
    campaign_id: campaignId,
    total_recipients: totalRecipients,
    sent_count: sentCount,
    skipped_duplicates: skippedCount,
    failed_count: failedCount,
    status: 'COMPLETED'
  };
}

/**
 * SECTION 3: TIMEOUT RESUMPTION TRIGGER HANDLERS
 * 
 * Creates a one-time time-driven trigger scheduled 1 minute out.
 */
function scheduleContinuationTrigger() {
  // Clear any existing continuation triggers first
  deleteResumeTriggers();

  // Create new trigger for 1 minute in future
  ScriptApp.newTrigger(RESUME_TRIGGER_FUNCTION)
    .timeBased()
    .after(60000)
    .create();

  Logger.log('[SendingEngine] Continuation trigger created for 1 minute.');
}

/**
 * Deletes all triggers matching resumeCampaignExecution to prevent trigger accumulation.
 */
function deleteResumeTriggers() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(function(trigger) {
      if (trigger.getHandlerFunction() === RESUME_TRIGGER_FUNCTION) {
        ScriptApp.deleteTrigger(trigger);
        Logger.log('[SendingEngine] Deleted temporary resume trigger.');
      }
    });
  } catch (e) {
    Logger.log('[SendingEngine] Warning deleting triggers: ' + e.message);
  }
}

/**
 * Clears PropertiesService and trigger artifacts after campaign completion.
 */
function cleanupResumeStateAndTriggers() {
  try {
    PropertiesService.getScriptProperties().deleteProperty(RESUME_PROPERTY_KEY);
    deleteResumeTriggers();
  } catch (e) {
    Logger.log('[SendingEngine] Cleanup notice: ' + e.message);
  }
}

/**
 * Automatic continuation trigger target.
 * Reads saved campaign cursor from PropertiesService and resumes executeCampaign.
 */
function resumeCampaignExecution() {
  Logger.log('[SendingEngine] resumeCampaignExecution invoked by trigger.');

  // 1. Immediately delete the temporary trigger that invoked this
  deleteResumeTriggers();

  // 2. Read saved execution state
  var props = PropertiesService.getScriptProperties();
  var stateRaw = props.getProperty(RESUME_PROPERTY_KEY);

  if (!stateRaw) {
    Logger.log('[SendingEngine] No resume state found in PropertiesService. Nothing to resume.');
    return;
  }

  var state;
  try {
    state = JSON.parse(stateRaw);
  } catch (err) {
    Logger.log('[SendingEngine] Failed to parse resume state: ' + err.message);
    return;
  }

  var campaignId = state.campaignId;
  var nextIndex = Number(state.lastProcessedIndex) || 0;

  Logger.log('[SendingEngine] Resuming campaign ' + campaignId + ' starting at index ' + nextIndex);

  // 3. Resume campaign execution
  return executeCampaign(campaignId, nextIndex);
}
