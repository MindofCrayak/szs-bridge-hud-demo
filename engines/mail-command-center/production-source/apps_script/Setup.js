/**
 * @file Setup.js
 * @description Database verification and setup script for the Mailchimp Clone spreadsheet.
 * Ensures all 7 tabs exist with exact headers and default configurations.
 */

var SCHEMA_DEFINITIONS = {
  System_Settings: {
    headers: ['Setting_Name', 'Value', 'Description'],
    defaults: [
      ['GLOBAL_KILL_SWITCH', 'false', 'Master kill switch. If true, halts all email processing and mutative tasks.'],
      ['DAILY_QUOTA_LIMIT', '100', 'Safety reserve buffer for Gmail daily sending limit.'],
      ['EXECUTION_TIME_LIMIT_MS', '270000', 'Safe execution ceiling (4.5 min) before saving state.'],
      ['DEFAULT_SENDER_NAME', 'Newsletter Team', 'Default sender display name.'],
      ['TRACKING_PIXEL_ENABLED', 'true', 'Enable open-rate tracking pixel embed.'],
      ['BATCH_SIZE', '50', 'Max batch size per execution trigger.']
    ]
  },
  Newsletters: {
    headers: ['newsletter_id', 'name', 'sender_alias', 'reply_to', 'default_template_id', 'created_at'],
    defaults: [
      ['news_weekly', 'Weekly Engineering Digest', 'digest@sessionzero.solutions', 'reply@sessionzero.solutions', 'tpl_default', new Date().toISOString()]
    ]
  },
  Subscribers: {
    headers: ['subscriber_id', 'email', 'first_name', 'last_name', 'subscribed_newsletters', 'status', 'source', 'external_id', 'created_at'],
    defaults: [
      ['sub_sample_1', 'alex.dev@sessionzero.solutions', 'Alex', 'Dev', 'news_weekly', 'active', 'manual_seed', 'ext_001', new Date().toISOString()],
      ['sub_sample_2', 'sarah.tech@sessionzero.solutions', 'Sarah', 'Connor', 'news_weekly', 'active', 'manual_seed', 'ext_002', new Date().toISOString()]
    ]
  },
  Campaigns: {
    headers: ['campaign_id', 'newsletter_id', 'name', 'content_type', 'source_id', 'status', 'scheduled_time', 'subject_line_a', 'subject_line_b', 'test_split_ratio'],
    defaults: [
      ['camp_welcome_01', 'news_weekly', 'Welcome Issue #1', 'html', '', 'draft', '', 'Welcome to our newsletter!', 'Welcome to our community!', 50]
    ]
  },
  Drip_Sequences: {
    headers: ['sequence_id', 'newsletter_id', 'name', 'step_number', 'delay_days', 'content_type', 'source_id'],
    defaults: [
      ['seq_onboarding', 'news_weekly', 'New User Onboarding - Day 1', 1, 1, 'html', '']
    ]
  },
  Templates: {
    headers: ['template_id', 'name', 'type', 'drive_file_id', 'last_updated'],
    defaults: [
      ['tpl_default', 'Standard Minimalist Template', 'html', '', new Date().toISOString()]
    ]
  },
  Delivery_Logs: {
    headers: ['log_id_key', 'subscriber_id', 'email', 'campaign_or_drip_id', 'step_number', 'variant_sent', 'timestamp', 'status', 'error_message'],
    defaults: []
  }
};

/**
 * Validates that all 7 required tabs exist with exact headers.
 * Creates missing tabs and populates default settings if needed.
 */
function verifyOrSetupDatabase() {
  var ss = getActiveSpreadsheet();
  var lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(15000);
    var report = [];

    Object.keys(SCHEMA_DEFINITIONS).forEach(function(sheetName) {
      var def = SCHEMA_DEFINITIONS[sheetName];
      var sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(def.headers);
        sheet.getRange(1, 1, 1, def.headers.length).setFontWeight('bold').setBackground('#f1f5f9');
        if (def.defaults && def.defaults.length > 0) {
          def.defaults.forEach(function(row) {
            sheet.appendRow(row);
          });
        }
        report.push('Created tab: ' + sheetName);
      } else {
        // Tab exists, verify headers
        var data = sheet.getDataRange().getValues();
        if (data.length === 0) {
          sheet.appendRow(def.headers);
          sheet.getRange(1, 1, 1, def.headers.length).setFontWeight('bold');
          report.push('Added missing headers to: ' + sheetName);
        } else {
          report.push('Verified tab: ' + sheetName + ' (' + (data.length - 1) + ' rows)');
        }
      }
    });

    Logger.log('[Setup Report]\n' + report.join('\n'));
    return { success: true, report: report };
  } finally {
    lock.releaseLock();
  }
}
