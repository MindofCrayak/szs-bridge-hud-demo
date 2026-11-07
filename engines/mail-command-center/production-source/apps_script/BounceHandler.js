/**
 * @file BounceHandler.js
 * @description Automated Bounce Detection and Deliverability Reputation Protection for Google Apps Script.
 * Scans Gmail mailbox for Mailer-Daemon bounce notifications, parses failed recipient addresses,
 * flags subscribers as 'BOUNCED' in the database, and archives notification threads.
 * 
 * Target Schema Awareness:
 * - Subscribers: subscriber_id, email, first_name, last_name, subscribed_newsletters, status, source, external_id, created_at
 * - Delivery_Logs: status='bounced', error_message
 */

var BOUNCE_TRIGGER_FUNCTION = 'processBounces';
var BOUNCE_LABEL_NAME = 'MailEngine_Processed_Bounces';

/**
 * Searches Gmail for bounce delivery notifications, extracts failed recipient emails,
 * marks subscribers as BOUNCED in the database, marks threads as read, and applies label.
 * 
 * @param {number} [maxThreads=50] Maximum email threads to process per execution.
 * @returns {Object} Execution summary report.
 */
function processBounces(maxThreads) {
  var limit = maxThreads || 50;
  var searchQuery = 'from:(mailer-daemon OR postmaster) (subject:("Delivery Status Notification" OR "Undelivered Mail" OR "failure notice" OR "Delivery Failure")) is:unread';

  Logger.log('[BounceHandler] Scanning Gmail for bounce messages: ' + searchQuery);

  var threads = [];
  try {
    threads = GmailApp.search(searchQuery, 0, limit);
  } catch (searchErr) {
    Logger.log('[BounceHandler] Search error: ' + searchErr.message);
    return { success: false, error: searchErr.message, processed: 0 };
  }

  if (threads.length === 0) {
    Logger.log('[BounceHandler] No unread bounce messages found.');
    return { success: true, message: 'No new bounce notifications found.', processed: 0, bounced_emails: [] };
  }

  // Ensure Gmail label exists
  var bounceLabel = null;
  try {
    bounceLabel = GmailApp.getUserLabelByName(BOUNCE_LABEL_NAME);
    if (!bounceLabel) {
      bounceLabel = GmailApp.createLabel(BOUNCE_LABEL_NAME);
    }
  } catch (labelErr) {
    Logger.log('[BounceHandler] Label creation warning: ' + labelErr.message);
  }

  var extractedEmails = {};
  var processedThreadsCount = 0;

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var messages = thread.getMessages();

    for (var m = 0; m < messages.length; m++) {
      var msg = messages[m];
      var rawBody = msg.getPlainBody() || msg.getBody();

      // Extract failed recipient email using standard RFC bounce patterns
      var parsedEmail = extractFailedRecipientEmail(rawBody);
      if (parsedEmail) {
        extractedEmails[parsedEmail] = true;
      }
    }

    // Label and mark read
    try {
      thread.markRead();
      if (bounceLabel) {
        thread.addLabel(bounceLabel);
      }
      processedThreadsCount++;
    } catch (threadErr) {
      Logger.log('[BounceHandler] Error updating thread: ' + threadErr.message);
    }
  }

  var bouncedEmailsList = Object.keys(extractedEmails);
  Logger.log('[BounceHandler] Extracted ' + bouncedEmailsList.length + ' unique bounced emails from ' + processedThreadsCount + ' threads.');

  if (bouncedEmailsList.length === 0) {
    return {
      success: true,
      processed: processedThreadsCount,
      bounced_emails: [],
      updated_subscribers: 0
    };
  }

  // Update Subscribers in Google Sheet database wrapped in LockService
  var updatedSubscribersCount = markSubscribersAsBounced(bouncedEmailsList);

  return {
    success: true,
    processed_threads: processedThreadsCount,
    bounced_emails: bouncedEmailsList,
    updated_subscribers: updatedSubscribersCount,
    timestamp: new Date().toISOString()
  };
}

/**
 * Parses the failed recipient email address from a bounce notification body.
 * Checks standard Delivery Status Notification headers and body patterns.
 * 
 * @param {string} body Plain text or HTML of the bounce message.
 * @returns {string|null} Clean lowercase bounced email, or null if not found.
 */
function extractFailedRecipientEmail(body) {
  if (!body) return null;

  // Pattern 1: Final-Recipient / Failed-Recipient / Original-Recipient: rfc822; user@sessionzero.solutions
  var rfcPattern = /(?:Final-Recipient|Failed-Recipient|Original-Recipient):\s*(?:rfc822;\s*)?([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})/i;
  var match = body.match(rfcPattern);
  if (match && match[1]) {
    return match[1].trim().toLowerCase();
  }

  // Pattern 2: Action: failed followed by Status and email
  var actionPattern = /Action:\s*failed[\s\S]*?(?:To|for|recipient):\s*<?([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})>?/i;
  match = body.match(actionPattern);
  if (match && match[1]) {
    return match[1].trim().toLowerCase();
  }

  // Pattern 3: <user@sessionzero.solutions>: ... (550 / mailbox unavailable / User unknown)
  var angleBracketPattern = /<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})>[\s\S]{0,120}?(?:user unknown|does not exist|mailbox unavailable|550|rejected|no such user)/i;
  match = body.match(angleBracketPattern);
  if (match && match[1]) {
    return match[1].trim().toLowerCase();
  }

  // Pattern 4: General "Your message to user@sessionzero.solutions couldn't be delivered"
  var genericPattern = /(?:message to|delivered to)\s+([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})/i;
  match = body.match(genericPattern);
  if (match && match[1]) {
    return match[1].trim().toLowerCase();
  }

  return null;
}

/**
 * Updates status in the 'Subscribers' tab to 'BOUNCED' for all matching email addresses.
 * Uses atomic lock and batch getValues/setValues.
 * 
 * @param {string[]} bouncedEmails List of clean lowercase emails to mark as bounced.
 * @returns {number} Number of subscriber rows updated.
 */
function markSubscribersAsBounced(bouncedEmails) {
  if (!bouncedEmails || bouncedEmails.length === 0) return 0;

  var lookupMap = {};
  bouncedEmails.forEach(function(em) {
    lookupMap[em.trim().toLowerCase()] = true;
  });

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var ss = getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Subscribers');
    if (!sheet) return 0;

    var range = sheet.getDataRange();
    var values = range.getValues();
    if (values.length <= 1) return 0;

    var headers = values[0].map(function(h) { return String(h).trim(); });
    var emailColIdx = headers.indexOf('email');
    var statusColIdx = headers.indexOf('status');

    if (emailColIdx === -1 || statusColIdx === -1) {
      Logger.log('[BounceHandler] Missing email or status column in Subscribers sheet.');
      return 0;
    }

    var updatedCount = 0;
    for (var r = 1; r < values.length; r++) {
      var rowEmail = String(values[r][emailColIdx]).trim().toLowerCase();
      if (lookupMap[rowEmail]) {
        var currentStatus = String(values[r][statusColIdx]).toUpperCase();
        if (currentStatus !== 'BOUNCED') {
          values[r][statusColIdx] = 'BOUNCED';
          updatedCount++;
          Logger.log('[BounceHandler] Subscriber ' + rowEmail + ' marked as BOUNCED.');
        }
      }
    }

    if (updatedCount > 0) {
      // Write updated batch values back to sheet
      range.setValues(values);
    }

    return updatedCount;
  } catch (err) {
    Logger.log('[BounceHandler] Error updating subscribers: ' + err.message);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Programmatically installs a 6-hour time-driven trigger for processBounces().
 * 
 * @returns {{ installed: boolean, message: string }}
 */
function installBounceTrigger() {
  var existingTriggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existingTriggers.length; i++) {
    if (existingTriggers[i].getHandlerFunction() === BOUNCE_TRIGGER_FUNCTION) {
      Logger.log('[BounceHandler] Bounce trigger already exists.');
      return { installed: false, message: 'Bounce detection trigger is already installed.' };
    }
  }

  ScriptApp.newTrigger(BOUNCE_TRIGGER_FUNCTION)
    .timeBased()
    .everyHours(6)
    .create();

  Logger.log('[BounceHandler] Successfully created 6-hour trigger for processBounces.');
  return { installed: true, message: 'Successfully installed 6-hour trigger for automated bounce processing.' };
}

/**
 * Helper to remove any existing bounce triggers.
 */
function uninstallBounceTrigger() {
  var existingTriggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < existingTriggers.length; i++) {
    if (existingTriggers[i].getHandlerFunction() === BOUNCE_TRIGGER_FUNCTION) {
      ScriptApp.deleteTrigger(existingTriggers[i]);
      removed++;
    }
  }
  return { removed: removed };
}
