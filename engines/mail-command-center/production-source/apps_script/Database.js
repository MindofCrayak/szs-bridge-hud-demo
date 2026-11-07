/**
 * @file Database.js
 * @description Data Access Layer (DAL) for Google Apps Script Mailchimp Clone.
 * Provides high-performance, batch-oriented read/write operations against the Google Sheet relational schema.
 * All write operations are protected with LockService.getScriptLock() to eliminate race conditions.
 * 
 * Target Google Sheet Schema Awareness:
 * - System_Settings: Setting_Name, Value, Description
 * - Newsletters: newsletter_id, name, sender_alias, reply_to, default_template_id, created_at
 * - Subscribers: subscriber_id, email, first_name, last_name, subscribed_newsletters, status, source, external_id, created_at
 * - Campaigns: campaign_id, newsletter_id, name, content_type, source_id, status, scheduled_time, subject_line_a, subject_line_b, test_split_ratio
 * - Drip_Sequences: sequence_id, newsletter_id, name, step_number, delay_days, content_type, source_id
 * - Templates: template_id, name, type, drive_file_id, last_updated
 * - Delivery_Logs: log_id_key, subscriber_id, email, campaign_or_drip_id, step_number, variant_sent, timestamp, status, error_message
 */

// Maximum lock wait time in milliseconds (30 seconds)
var LOCK_TIMEOUT_MS = 30000;

/**
 * Standardized email sanitization and validation.
 * @param {string} email
 * @returns {string} Clean lowercase email.
 * @throws {Error} If email is invalid.
 */
function sanitizeAndValidateEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new Error('Invalid email provided: email must be a non-empty string.');
  }
  var clean = email.trim().toLowerCase();
  // Standard RFC 5322 regex approximation
  var emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(clean)) {
    throw new Error('Invalid email format: "' + email + '"');
  }
  return clean;
}

/**
 * Normalizes comma-separated newsletter IDs into a clean, deduplicated, sorted string.
 * Supports string inputs ("news_1, news_2") or Array inputs (["news_1", "news_2"]).
 * 
 * @param {string|string[]} input
 * @returns {string} Deduplicated comma-separated string, e.g. "news_1, news_2".
 */
function normalizeNewsletterList(input) {
  if (!input) return '';
  var items = [];
  if (Array.isArray(input)) {
    items = input;
  } else if (typeof input === 'string') {
    items = input.split(',');
  } else {
    items = [String(input)];
  }

  var set = {};
  items.forEach(function(item) {
    var clean = String(item).trim();
    if (clean) {
      set[clean] = true;
    }
  });

  return Object.keys(set).sort().join(', ');
}

/**
 * Merges two comma-separated lists of newsletters without duplicate entries.
 * @param {string} existingList 
 * @param {string|string[]} newList 
 * @returns {string} Combined deduplicated newsletter string.
 */
function mergeNewsletterLists(existingList, newList) {
  var combined = (existingList || '') + ',' + (Array.isArray(newList) ? newList.join(',') : (newList || ''));
  return normalizeNewsletterList(combined);
}

/**
 * Generates a unique identifier with a given prefix.
 * @param {string} prefix e.g., 'sub', 'camp', 'seq', 'tpl'
 * @returns {string} Unique ID e.g. "sub_1715000000_a8f9"
 */
function generateId(prefix) {
  var p = prefix || 'id';
  var timestamp = Date.now().toString(36);
  var randomPart = Math.random().toString(36).substring(2, 7);
  return p + '_' + timestamp + '_' + randomPart;
}

/**
 * Reads all data from a given sheet and returns an array of objects.
 * Uses batch operations (getDataRange().getValues()) for maximum speed.
 * The first row is treated as headers, mapped directly to object keys.
 * 
 * @param {string} sheetName Name of the sheet/tab.
 * @returns {Array<Object<string, any>>} Array of row objects.
 * @throws {Error} If sheet does not exist.
 */
function getRows(sheetName) {
  if (!sheetName || typeof sheetName !== 'string') {
    throw new Error('getRows failed: sheetName is required.');
  }

  var ss = getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Sheet not found: "' + sheetName + '". Verify tab exists in spreadsheet.');
  }

  var range = sheet.getDataRange();
  var values = range.getValues();

  // If sheet is empty or only has headers
  if (values.length <= 1) {
    return [];
  }

  // Row 0 is the header row
  var rawHeaders = values[0];
  var headers = rawHeaders.map(function(h) {
    return String(h).trim();
  });

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var rowValues = values[r];
    var rowObj = {};
    var hasContent = false;

    for (var c = 0; c < headers.length; c++) {
      var headerKey = headers[c];
      if (!headerKey) continue;
      var cellVal = rowValues[c];
      rowObj[headerKey] = cellVal;
      if (cellVal !== '' && cellVal !== null && cellVal !== undefined) {
        hasContent = true;
      }
    }

    // Only include rows that have at least one non-empty cell
    if (hasContent) {
      rows.push(rowObj);
    }
  }

  return rows;
}

/**
 * Creates a Google Doc for a campaign and links it as the campaign body.
 * @param {string} campaignId
 * @param {string} campaignName
 * @returns {{success: boolean, docId: string, docUrl: string}}
 */
function createCampaignGoogleDoc(campaignId, campaignName) {
  if (!campaignId || typeof campaignId !== 'string' || !campaignId.trim()) {
    throw new Error('createCampaignGoogleDoc failed: campaignId is required.');
  }
  if (!campaignName || typeof campaignName !== 'string' || !campaignName.trim()) {
    throw new Error('createCampaignGoogleDoc failed: campaignName is required.');
  }

  assertOperationsAllowed();
  var doc = DocumentApp.create(campaignName.trim() + ' - Body');
  var body = doc.getBody();
  body.appendParagraph('[Write your email newsletter body here]')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('Use normal Google Docs formatting (headings, bold, lists, links). When you send, this content will automatically be injected into your Master Shell.');
  doc.saveAndClose();

  updateCampaignContent_(campaignId, 'DOC_SHELL', doc.getId());
  return { success: true, docId: doc.getId(), docUrl: doc.getUrl() };
}

/**
 * Lists the current user's Gmail drafts for campaign linking.
 * @returns {Array<{id: string, subject: string}>}
 */
function getGmailDraftsList() {
  return GmailApp.getDrafts().map(function(draft) {
    return {
      id: draft.getId(),
      subject: draft.getMessage().getSubject() || '(No Subject)'
    };
  });
}

/**
 * Links a Google Doc or Gmail draft to a campaign.
 * @param {string} campaignId
 * @param {string} contentType
 * @param {string} sourceId
 * @returns {{success: boolean}}
 */
function linkExistingContent(campaignId, contentType, sourceId) {
  if (contentType !== 'DOC_SHELL' && contentType !== 'GMAIL_DRAFT') {
    throw new Error('linkExistingContent failed: contentType must be DOC_SHELL or GMAIL_DRAFT.');
  }
  if (!sourceId || typeof sourceId !== 'string' || !sourceId.trim()) {
    throw new Error('linkExistingContent failed: sourceId is required.');
  }

  var cleanSourceId = sourceId.trim();
  if (contentType === 'DOC_SHELL') {
    var docUrlMatch = cleanSourceId.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (docUrlMatch) cleanSourceId = docUrlMatch[1];
  }

  updateCampaignContent_(campaignId, contentType, cleanSourceId);
  return { success: true };
}

function updateCampaignContent_(campaignId, contentType, sourceId) {
  if (!campaignId || typeof campaignId !== 'string' || !campaignId.trim()) {
    throw new Error('Campaign ID is required.');
  }

  assertOperationsAllowed();
  var lock = LockService.getScriptLock();
  var hasLock = false;
  try {
    lock.waitLock(LOCK_TIMEOUT_MS);
    hasLock = true;

    var sheet = getActiveSpreadsheet().getSheetByName('Campaigns');
    if (!sheet) throw new Error('Campaigns tab does not exist in the spreadsheet.');

    var values = sheet.getDataRange().getValues();
    if (values.length === 0) throw new Error('Campaigns tab is missing its header row.');

    var headers = values[0].map(function(header) { return String(header).trim(); });
    var campaignIdCol = headers.indexOf('campaign_id');
    var contentTypeCol = headers.indexOf('content_type');
    var sourceIdCol = headers.indexOf('source_id');
    if (campaignIdCol === -1 || contentTypeCol === -1 || sourceIdCol === -1) {
      throw new Error('Campaigns tab must contain campaign_id, content_type, and source_id columns.');
    }

    for (var row = 1; row < values.length; row++) {
      if (String(values[row][campaignIdCol]).trim() === campaignId.trim()) {
        sheet.getRange(row + 1, contentTypeCol + 1).setValue(contentType);
        sheet.getRange(row + 1, sourceIdCol + 1).setValue(sourceId);
        return;
      }
    }
    throw new Error('Campaign not found: "' + campaignId + '".');
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

/**
 * Adds a new subscriber or updates an existing one if the email already exists in 'Subscribers'.
 * Enforces atomic database operations using LockService.getScriptLock().
 * 
 * Expected schema in 'Subscribers':
 * [subscriber_id, email, first_name, last_name, subscribed_newsletters, status, source, external_id, created_at]
 * 
 * @param {Object} subscriberData
 * @param {string} subscriberData.email Subscriber email (required)
 * @param {string} [subscriberData.first_name]
 * @param {string} [subscriberData.last_name]
 * @param {string|string[]} [subscriberData.subscribed_newsletters] Comma-separated list or array
 * @param {string} [subscriberData.status='active'] 'active', 'unsubscribed', 'bounced', etc.
 * @param {string} [subscriberData.source='api']
 * @param {string} [subscriberData.external_id]
 * @param {boolean} [subscriberData.replace_newsletters=false] If true, replaces newsletters instead of merging.
 * @returns {{ action: 'created'|'updated', subscriber: Object }} Result object
 */
function addOrUpdateSubscriber(subscriberData) {
  if (!subscriberData || typeof subscriberData !== 'object') {
    throw new Error('addOrUpdateSubscriber failed: Invalid subscriberData payload.');
  }

  var cleanEmail = sanitizeAndValidateEmail(subscriberData.email);

  // Check global kill switch
  assertOperationsAllowed();

  var lock = LockService.getScriptLock();
  try {
    var hasLock = lock.tryLock(LOCK_TIMEOUT_MS);
    if (!hasLock) {
      throw new Error('Could not obtain database lock after ' + (LOCK_TIMEOUT_MS / 1000) + ' seconds. Try again later.');
    }

    var ss = getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Subscribers');

    if (!sheet) {
      throw new Error('Subscribers tab does not exist in the spreadsheet.');
    }

    var values = sheet.getDataRange().getValues();
    if (values.length === 0) {
      throw new Error('Subscribers tab is completely empty. Header row is required.');
    }

    var headers = values[0].map(function(h) { return String(h).trim(); });
    var emailColIdx = headers.indexOf('email');
    if (emailColIdx === -1) {
      throw new Error('Column "email" missing in Subscribers tab.');
    }

    var existingRowIdx = -1; // 1-based index in the spreadsheet
    var existingRowData = null;

    // Scan in-memory batch for existing email (case-insensitive)
    for (var r = 1; r < values.length; r++) {
      var rowEmail = String(values[r][emailColIdx]).trim().toLowerCase();
      if (rowEmail === cleanEmail) {
        existingRowIdx = r + 1; // Sheets rows are 1-indexed
        existingRowData = values[r];
        break;
      }
    }

    var nowIso = new Date().toISOString();

    if (existingRowIdx !== -1) {
      // -------------------------------------------------------------
      // UPDATE EXISTING SUBSCRIBER
      // -------------------------------------------------------------
      var updatedRow = existingRowData.slice(); // Clone row array

      // Helper to update column by name
      var setCol = function(colName, newVal) {
        var idx = headers.indexOf(colName);
        if (idx !== -1 && newVal !== undefined && newVal !== null) {
          updatedRow[idx] = newVal;
        }
      };

      if (subscriberData.first_name !== undefined) setCol('first_name', subscriberData.first_name);
      if (subscriberData.last_name !== undefined) setCol('last_name', subscriberData.last_name);
      if (subscriberData.status !== undefined) setCol('status', subscriberData.status);
      if (subscriberData.source !== undefined) setCol('source', subscriberData.source);
      if (subscriberData.external_id !== undefined) setCol('external_id', subscriberData.external_id);

      // Handle subscribed_newsletters
      var newsColIdx = headers.indexOf('subscribed_newsletters');
      if (newsColIdx !== -1 && subscriberData.subscribed_newsletters !== undefined) {
        var currentNewsletters = String(existingRowData[newsColIdx] || '');
        if (subscriberData.replace_newsletters) {
          updatedRow[newsColIdx] = normalizeNewsletterList(subscriberData.subscribed_newsletters);
        } else {
          updatedRow[newsColIdx] = mergeNewsletterLists(currentNewsletters, subscriberData.subscribed_newsletters);
        }
      }

      // Write single batch row back
      sheet.getRange(existingRowIdx, 1, 1, updatedRow.length).setValues([updatedRow]);

      // Construct return subscriber object
      var subscriberObj = {};
      headers.forEach(function(h, idx) {
        subscriberObj[h] = updatedRow[idx];
      });

      return {
        action: 'updated',
        subscriber: subscriberObj
      };

    } else {
      // -------------------------------------------------------------
      // INSERT NEW SUBSCRIBER
      // -------------------------------------------------------------
      var newSubscriberId = subscriberData.subscriber_id || generateId('sub');
      var newNewsletters = normalizeNewsletterList(subscriberData.subscribed_newsletters || '');
      var status = subscriberData.status || 'active';
      var source = subscriberData.source || 'web_api';
      var externalId = subscriberData.external_id || '';
      var firstName = subscriberData.first_name || '';
      var lastName = subscriberData.last_name || '';

      // Build row ordered strictly by header columns
      var newRow = headers.map(function(header) {
        switch (header) {
          case 'subscriber_id': return newSubscriberId;
          case 'email': return cleanEmail;
          case 'first_name': return firstName;
          case 'last_name': return lastName;
          case 'subscribed_newsletters': return newNewsletters;
          case 'status': return status;
          case 'source': return source;
          case 'external_id': return externalId;
          case 'created_at': return nowIso;
          default:
            return subscriberData[header] !== undefined ? subscriberData[header] : '';
        }
      });

      sheet.appendRow(newRow);

      var newSubscriberObj = {};
      headers.forEach(function(h, idx) {
        newSubscriberObj[h] = newRow[idx];
      });

      return {
        action: 'created',
        subscriber: newSubscriberObj
      };
    }

  } catch (err) {
    Logger.log('[Database] addOrUpdateSubscriber error: ' + err.message);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Checks if a specific email has already received a campaign or sequence step.
 * Uses the Delivery_Logs composite key to prevent double-sends.
 * 
 * @param {string} email Target subscriber email.
 * @param {string} campaignOrDripId Campaign ID or Drip Sequence ID.
 * @param {number|string} stepNumber Sequence step (use 0 or 1 for standalone campaigns).
 * @returns {boolean} True if already logged as sent/delivered/opened.
 */
function isAlreadyDelivered(email, campaignOrDripId, stepNumber) {
  var cleanEmail = sanitizeAndValidateEmail(email);
  var cleanStep = stepNumber !== undefined && stepNumber !== null ? String(stepNumber).trim() : '0';
  var targetKey = cleanEmail + '_' + String(campaignOrDripId).trim() + '_' + cleanStep;

  var ss = getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Delivery_Logs');
  if (!sheet) return false;

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return false;

  var headers = data[0].map(function(h) { return String(h).trim(); });
  var keyColIdx = headers.indexOf('log_id_key');
  if (keyColIdx === -1) keyColIdx = 0;

  var statusColIdx = headers.indexOf('status');

  for (var r = 1; r < data.length; r++) {
    var rowKey = String(data[r][keyColIdx]).trim();
    if (rowKey === targetKey) {
      if (statusColIdx !== -1) {
        var status = String(data[r][statusColIdx]).toLowerCase();
        // Failed deliveries may be retried, but 'sent', 'delivered', 'opened' cannot be sent again
        if (status === 'sent' || status === 'delivered' || status === 'opened' || status === 'success') {
          return true;
        }
      } else {
        return true;
      }
    }
  }

  return false;
}

/**
 * Appends a delivery or tracking record to 'Delivery_Logs'.
 * Generates the critical composite key: `${email}_${campaign_or_drip_id}_${step_number}`.
 * Double-send prevention check can be enforced automatically.
 * 
 * Target Schema for 'Delivery_Logs':
 * [log_id_key, subscriber_id, email, campaign_or_drip_id, step_number, variant_sent, timestamp, status, error_message]
 * 
 * @param {Object} logData
 * @param {string} logData.email Target email (required)
 * @param {string} logData.campaign_or_drip_id Campaign ID or Drip ID (required)
 * @param {number|string} [logData.step_number=0] Step number (default 0 for one-off campaigns)
 * @param {string} [logData.subscriber_id='']
 * @param {string} [logData.variant_sent='A'] Variant sent ('A', 'B', etc.)
 * @param {string} [logData.status='sent'] 'sent', 'delivered', 'opened', 'failed', 'bounced'
 * @param {string} [logData.error_message='']
 * @param {boolean} [logData.prevent_duplicates=true] If true, halts duplicate send entries.
 * @returns {{ success: boolean, log_id_key: string, row_appended: boolean }}
 */
function logDelivery(logData) {
  if (!logData || typeof logData !== 'object') {
    throw new Error('logDelivery failed: logData must be a valid object.');
  }

  var cleanEmail = sanitizeAndValidateEmail(logData.email);
  var campaignId = String(logData.campaign_or_drip_id || logData.campaign_id || '').trim();
  if (!campaignId) {
    throw new Error('logDelivery failed: campaign_or_drip_id is required.');
  }

  var stepNumber = logData.step_number !== undefined && logData.step_number !== null 
    ? String(logData.step_number).trim() 
    : '0';

  // Standardized composite key
  var logIdKey = cleanEmail + '_' + campaignId + '_' + stepNumber;
  var status = String(logData.status || 'sent').trim().toLowerCase();
  var timestamp = logData.timestamp || new Date().toISOString();

  var lock = LockService.getScriptLock();
  try {
    var hasLock = lock.tryLock(LOCK_TIMEOUT_MS);
    if (!hasLock) {
      throw new Error('Database locked. Could not write to Delivery_Logs.');
    }

    var ss = getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Delivery_Logs');
    if (!sheet) {
      throw new Error('Delivery_Logs tab missing from spreadsheet.');
    }

    var data = sheet.getDataRange().getValues();
    if (data.length === 0) {
      throw new Error('Delivery_Logs tab is missing header row.');
    }

    var headers = data[0].map(function(h) { return String(h).trim(); });
    var keyColIdx = headers.indexOf('log_id_key');
    if (keyColIdx === -1) keyColIdx = 0;

    var statusColIdx = headers.indexOf('status');

    // Check for existing record with this key
    var existingRowIdx = -1;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][keyColIdx]).trim() === logIdKey) {
        existingRowIdx = r + 1; // 1-indexed
        break;
      }
    }

    // Double-send prevention check
    if (existingRowIdx !== -1 && logData.prevent_duplicates !== false && status === 'sent') {
      var currentStatus = statusColIdx !== -1 ? String(data[existingRowIdx - 1][statusColIdx]).toLowerCase() : '';
      if (currentStatus === 'sent' || currentStatus === 'delivered' || currentStatus === 'opened') {
        Logger.log('[Database] Duplicate delivery prevented for key: ' + logIdKey);
        return {
          success: false,
          duplicate_skipped: true,
          log_id_key: logIdKey,
          message: 'Double-send prevented: message already delivered for this key.'
        };
      }
    }

    // If record exists and status is 'opened', update the existing record
    if (existingRowIdx !== -1 && status === 'opened') {
      if (statusColIdx !== -1) {
        sheet.getRange(existingRowIdx, statusColIdx + 1).setValue('opened');
      }
      return {
        success: true,
        log_id_key: logIdKey,
        row_appended: false,
        action: 'status_updated_to_opened'
      };
    }

    // Otherwise, append new delivery log row strictly matching headers
    var subscriberId = logData.subscriber_id || '';
    var variantSent = logData.variant_sent || 'A';
    var errorMsg = logData.error_message || '';

    var newRow = headers.map(function(header) {
      switch (header) {
        case 'log_id_key': return logIdKey;
        case 'subscriber_id': return subscriberId;
        case 'email': return cleanEmail;
        case 'campaign_or_drip_id': return campaignId;
        case 'step_number': return stepNumber;
        case 'variant_sent': return variantSent;
        case 'timestamp': return timestamp;
        case 'status': return status;
        case 'error_message': return errorMsg;
        default:
          return logData[header] !== undefined ? logData[header] : '';
      }
    });

    sheet.appendRow(newRow);

    return {
      success: true,
      log_id_key: logIdKey,
      row_appended: true,
      status: status
    };

  } catch (err) {
    Logger.log('[Database] logDelivery error: ' + err.message);
    throw err;
  } finally {
    lock.releaseLock();
  }
}
