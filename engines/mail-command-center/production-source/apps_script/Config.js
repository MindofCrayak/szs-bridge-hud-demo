/**
 * @file Config.js
 * @description Centralized configuration and environment utility for Mailchimp Clone on Google Apps Script.
 * Provides active spreadsheet access, caching of System_Settings, quota checking, and operational kill-switch enforcement.
 * 
 * Target Google Sheet Tabs:
 * - System_Settings: [Setting_Name, Value, Description]
 * 
 * Critical System Constraints:
 * - 6-minute execution limit: Script monitors execution time against EXECUTION_TIME_LIMIT_MS (4.5 min).
 * - Quota buffer: Enforces safety margins around MailApp.getRemainingDailyQuota().
 * - Global Kill-Switch: Halts operations immediately if GLOBAL_KILL_SWITCH is enabled.
 */

// Global constant fallback settings if not configured in the sheet
var SYSTEM_DEFAULTS = {
  GLOBAL_KILL_SWITCH: 'false',
  DAILY_QUOTA_LIMIT: 100, // Safety threshold for daily emails
  EXECUTION_TIME_LIMIT_MS: 270000, // 4.5 minutes (Apps Script hard limit is 6 mins)
  BATCH_SIZE: 50, // Max emails to process per cycle
  TRACKING_PIXEL_ENABLED: 'true',
  DEFAULT_SENDER_NAME: 'Newsletter Team',
  APP_ENV: 'production'
};

// In-memory cache for the current execution lifecycle
var _cachedSettings = null;
var _scriptStartTime = null;

/**
 * Initializes the execution timer if not already set.
 * Should be called at the beginning of critical execution loops.
 * @returns {number} Start timestamp in milliseconds.
 */
function markExecutionStart() {
  _scriptStartTime = Date.now();
  return _scriptStartTime;
}

/**
 * Checks if the script has exceeded the safe execution time (4.5 minutes).
 * Allows the script to save state and trigger continuation before hitting the 6-min timeout.
 * @param {number} [maxDurationMs] Optional duration override (defaults to 270,000ms / 4.5 min).
 * @returns {boolean} True if execution should yield and reschedule.
 */
function isExecutionTimeExceeded(maxDurationMs) {
  if (!_scriptStartTime) {
    _scriptStartTime = Date.now();
    return false;
  }
  var limit = maxDurationMs || SYSTEM_DEFAULTS.EXECUTION_TIME_LIMIT_MS;
  return (Date.now() - _scriptStartTime) >= limit;
}

/**
 * Grabs the active spreadsheet.
 * Works seamlessly when bound to a Google Sheet (container-bound),
 * or falls back to SPREADSHEET_ID stored in ScriptProperties for standalone web apps.
 * 
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} The active or configured Google Spreadsheet.
 * @throws {Error} If spreadsheet cannot be accessed.
 */
function getActiveSpreadsheet() {
  try {
    // 1. Attempt container-bound active spreadsheet
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      return ss;
    }

    // 2. Fallback to ScriptProperties SPREADSHEET_ID
    var props = PropertiesService.getScriptProperties();
    var sheetId = props.getProperty('SPREADSHEET_ID');
    if (sheetId) {
      return SpreadsheetApp.openById(sheetId);
    }

    throw new Error('No active spreadsheet found. If running as a standalone script, set SPREADSHEET_ID in ScriptProperties.');
  } catch (error) {
    Logger.log('[Config] Error accessing Spreadsheet: ' + error.message);
    throw new Error('Database connection failed: ' + error.message);
  }
}

/**
 * Reads the 'System_Settings' tab and returns a key-value JSON object.
 * Parses booleans, numbers, and strings with intelligent type coercion.
 * Caches the result in memory for the duration of the execution context.
 * 
 * Expected Sheet Schema:
 * [Setting_Name, Value, Description]
 * 
 * @param {boolean} [forceRefresh=false] If true, bypasses the in-memory cache and re-reads sheet.
 * @returns {Object<string, string|number|boolean>} Key-value map of system settings.
 */
function getSystemSettings(forceRefresh) {
  if (_cachedSettings && !forceRefresh) {
    return _cachedSettings;
  }

  var settings = Object.assign({}, SYSTEM_DEFAULTS);

  try {
    var ss = getActiveSpreadsheet();
    var sheet = ss.getSheetByName('System_Settings');

    if (!sheet) {
      Logger.log('[Config] Warning: System_Settings tab not found. Using default configurations.');
      _cachedSettings = settings;
      return settings;
    }

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();

    if (values.length <= 1) {
      Logger.log('[Config] System_Settings sheet has no data rows. Using defaults.');
      _cachedSettings = settings;
      return settings;
    }

    // First row is headers: Setting_Name, Value, Description
    var headers = values[0].map(function(h) { return String(h).trim(); });
    var keyCol = headers.indexOf('Setting_Name');
    var valCol = headers.indexOf('Value');

    if (keyCol === -1 || valCol === -1) {
      // Fallback to columns 0 and 1
      keyCol = 0;
      valCol = 1;
    }

    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      var rawKey = row[keyCol];
      if (!rawKey) continue;

      var key = String(rawKey).trim();
      var rawVal = row[valCol];
      var val = rawVal;

      // Intelligent type coercion
      if (typeof rawVal === 'string') {
        var trimmed = rawVal.trim();
        var lower = trimmed.toLowerCase();
        if (lower === 'true') {
          val = true;
        } else if (lower === 'false') {
          val = false;
        } else if (!isNaN(Number(trimmed)) && trimmed !== '') {
          val = Number(trimmed);
        } else {
          val = trimmed;
        }
      } else if (typeof rawVal === 'number') {
        val = rawVal;
      } else if (typeof rawVal === 'boolean') {
        val = rawVal;
      }

      settings[key] = val;
    }

    _cachedSettings = settings;
    return settings;
  } catch (err) {
    Logger.log('[Config] Error reading System_Settings: ' + err.message);
    return settings;
  }
}

/**
 * Checks if the GLOBAL_KILL_SWITCH is engaged.
 * When enabled, halts all sending, queuing, and non-read operations.
 * 
 * @returns {boolean} True if operations are halted by kill switch.
 */
function isGlobalKillSwitchActive() {
  var settings = getSystemSettings();
  var killVal = settings['GLOBAL_KILL_SWITCH'];

  if (killVal === true || killVal === 1 || killVal === '1') {
    return true;
  }
  if (typeof killVal === 'string' && killVal.trim().toLowerCase() === 'true') {
    return true;
  }
  return false;
}

/**
 * Asserts that the system is operational.
 * Throws an explicit error if the GLOBAL_KILL_SWITCH is activated.
 * Call this at the start of any mutative or email sending task.
 * 
 * @throws {Error} If GLOBAL_KILL_SWITCH is active.
 */
function assertOperationsAllowed() {
  if (isGlobalKillSwitchActive()) {
    var msg = 'HALT: GLOBAL_KILL_SWITCH is ACTIVE in System_Settings. All email sending and writing operations are stopped.';
    Logger.log('[Config] ' + msg);
    throw new Error(msg);
  }
}

/**
 * Validates remaining Gmail quota against the DAILY_QUOTA_LIMIT buffer in System_Settings.
 * 
 * @returns {{ remaining: number, buffer: number, hasQuota: boolean }}
 */
function checkEmailQuota() {
  var remaining = 0;
  try {
    remaining = MailApp.getRemainingDailyQuota();
  } catch (e) {
    Logger.log('[Config] Quota lookup warning: ' + e.message);
    remaining = 0;
  }

  var settings = getSystemSettings();
  var buffer = Number(settings['DAILY_QUOTA_LIMIT']) || SYSTEM_DEFAULTS.DAILY_QUOTA_LIMIT;
  var hasQuota = remaining > buffer;

  return {
    remaining: remaining,
    buffer: buffer,
    hasQuota: hasQuota
  };
}

/**
 * Convenience helper to set or update a setting in ScriptProperties or System_Settings tab.
 * @param {string} key Setting name
 * @param {string|number|boolean} value Value to store
 */
function setSystemSetting(key, value) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = getActiveSpreadsheet();
    var sheet = ss.getSheetByName('System_Settings');
    if (!sheet) return false;

    var data = sheet.getDataRange().getValues();
    var updated = false;

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim() === key) {
        sheet.getRange(r + 1, 2).setValue(value);
        updated = true;
        break;
      }
    }

    if (!updated) {
      sheet.appendRow([key, value, 'Added via Config API ' + new Date().toISOString()]);
    }

    // Invalidate cache
    _cachedSettings = null;
    return true;
  } catch (e) {
    Logger.log('[Config] Error writing setting: ' + e.message);
    throw e;
  } finally {
    lock.releaseLock();
  }
}
