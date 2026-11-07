/**
 * @file DripEngine.js
 * @description Automated Time-Delay Sequence & Drip Campaign Engine for Google Apps Script.
 * Runs on an hourly time-driven trigger to evaluate subscriber eligibility across sequence steps.
 * 
 * Target Schema Awareness:
 * - Drip_Sequences: sequence_id, newsletter_id, name, step_number, delay_days, content_type, source_id
 * - Subscribers: subscriber_id, email, first_name, last_name, subscribed_newsletters, status, source, external_id, created_at
 * - Delivery_Logs: log_id_key, subscriber_id, email, campaign_or_drip_id, step_number, variant_sent, timestamp, status, error_message
 * - System_Settings: GLOBAL_KILL_SWITCH, DAILY_QUOTA_LIMIT
 */

var DRIP_TRIGGER_FUNCTION = 'runDripSequences';
var MS_PER_DAY = 86400000; // 24 * 60 * 60 * 1000

/**
 * Main hourly orchestrator for automated drip sequences.
 * Evaluates active subscribers, verifies time delays, checks double-send ledger,
 * and dispatches sequence step emails via GmailApp.
 * 
 * @returns {Object} Execution summary metrics.
 */
function runDripSequences() {
  markExecutionStart();

  // 1. Pre-flight kill switch check
  if (isGlobalKillSwitchActive()) {
    Logger.log('[DripEngine] Aborted: GLOBAL_KILL_SWITCH is ACTIVE.');
    return { success: false, reason: 'KILL_SWITCH_ACTIVE', dispatched: 0 };
  }

  // 2. Check remaining daily quota
  var quotaInfo = checkEmailQuota();
  if (!quotaInfo.hasQuota) {
    Logger.log('[DripEngine] Aborted: Quota buffer reached (' + quotaInfo.remaining + ' remaining, buffer is ' + quotaInfo.buffer + ').');
    return { success: false, reason: 'QUOTA_BUFFER_EXCEEDED', dispatched: 0 };
  }

  Logger.log('[DripEngine] Starting drip sequence evaluation. Available quota: ' + quotaInfo.remaining);

  // 3. Read Database Tables
  var dripSteps = getRows('Drip_Sequences');
  if (!dripSteps || dripSteps.length === 0) {
    Logger.log('[DripEngine] No drip sequences found in Drip_Sequences tab.');
    return { success: true, dispatched: 0, message: 'No sequences configured' };
  }

  var subscribers = getRows('Subscribers');
  var deliveryLogs = getRows('Delivery_Logs');
  var newsletters = getRows('Newsletters');

  // Build fast lookup map for Delivery_Logs
  // Key: email + '_' + sequence_id + '_' + step_number -> log record
  var ledgerMap = {};
  deliveryLogs.forEach(function(log) {
    var key = String(log.log_id_key || '').trim().toLowerCase();
    if (key) {
      ledgerMap[key] = log;
    }
  });

  // Group and sort drip steps by sequence_id, ordered by step_number ascending
  var sequencesById = {};
  dripSteps.forEach(function(step) {
    var seqId = String(step.sequence_id).trim();
    if (!sequencesById[seqId]) {
      sequencesById[seqId] = [];
    }
    sequencesById[seqId].push({
      sequence_id: seqId,
      newsletter_id: String(step.newsletter_id || '').trim(),
      name: String(step.name || '').trim(),
      step_number: Number(step.step_number) || 1,
      delay_days: Number(step.delay_days) || 0,
      content_type: String(step.content_type || 'DOC_SHELL').trim(),
      source_id: String(step.source_id || '').trim()
    });
  });

  // Sort steps inside each sequence
  Object.keys(sequencesById).forEach(function(seqId) {
    sequencesById[seqId].sort(function(a, b) {
      return a.step_number - b.step_number;
    });
  });

  var nowMs = Date.now();
  var dispatchedCount = 0;
  var skippedCount = 0;
  var errorsCount = 0;

  // Filter for active subscribers only
  var activeSubscribers = subscribers.filter(function(sub) {
    return String(sub.status || '').toLowerCase() === 'active';
  });

  // 4. Iterate over sequences and eligible subscribers
  for (var s = 0; s < activeSubscribers.length; s++) {
    // Check 4.5-minute timeout guard
    if (isExecutionTimeExceeded()) {
      Logger.log('[DripEngine] 4.5-minute execution ceiling reached. Yielding until next hourly trigger.');
      break;
    }

    // Check quota buffer again
    if (quotaInfo.remaining - dispatchedCount <= quotaInfo.buffer) {
      Logger.log('[DripEngine] Daily quota buffer threshold reached mid-run. Pausing sequence execution.');
      break;
    }

    var subscriber = activeSubscribers[s];
    var subEmail = String(subscriber.email || '').trim().toLowerCase();
    var subNewsletters = String(subscriber.subscribed_newsletters || '');
    var subCreatedAt = subscriber.created_at ? new Date(subscriber.created_at).getTime() : nowMs;

    // Check each configured sequence
    for (var seqId in sequencesById) {
      var steps = sequencesById[seqId];
      if (steps.length === 0) continue;

      var newsletterId = steps[0].newsletter_id;
      // Confirm subscriber is tagged for this sequence's newsletter
      if (newsletterId && subNewsletters.indexOf(newsletterId) === -1) {
        continue;
      }

      var newsletter = newsletters.find(function(n) {
        return String(n.newsletter_id).trim() === newsletterId;
      }) || {
        sender_alias: 'newsletter@sessionzero.solutions',
        reply_to: 'reply@sessionzero.solutions',
        name: 'Newsletter Team'
      };

      // Evaluate steps in chronological order
      for (var st = 0; st < steps.length; st++) {
        var step = steps[st];
        var stepNum = step.step_number;
        var compositeKey = subEmail + '_' + seqId + '_' + stepNum;

        // Check if this step has already been delivered to this subscriber
        var existingLog = ledgerMap[compositeKey];
        if (existingLog) {
          var status = String(existingLog.status || '').toLowerCase();
          if (status === 'sent' || status === 'delivered' || status === 'opened' || status === 'success') {
            // Already sent, proceed to check the next step
            continue;
          }
        }

        // Step has NOT been sent. Check if subscriber is eligible to receive it yet:
        var referenceTimestamp = null;

        if (stepNum === 1) {
          // Step 1 triggers based on subscriber.created_at
          referenceTimestamp = subCreatedAt;
        } else {
          // Subsequent steps trigger based on timestamp of preceding step (step_number - 1)
          var prevStepKey = subEmail + '_' + seqId + '_' + (stepNum - 1);
          var prevLog = ledgerMap[prevStepKey];
          if (!prevLog) {
            // Preceding step has not been delivered yet, cannot jump ahead
            break;
          }
          referenceTimestamp = prevLog.timestamp ? new Date(prevLog.timestamp).getTime() : null;
          if (!referenceTimestamp || isNaN(referenceTimestamp)) {
            break;
          }
        }

        // Calculate time elapsed
        var requiredDelayMs = step.delay_days * MS_PER_DAY;
        var elapsedMs = nowMs - referenceTimestamp;

        if (elapsedMs < requiredDelayMs) {
          // Time delay has not elapsed yet. Subscriber must wait.
          // Since steps are sequential, do not check subsequent steps for this sequence
          break;
        }

        // ELIGIBLE FOR DISPATCH!
        try {
          // Build dummy campaign object for compiler compatibility
          var pseudoCampaign = {
            campaign_id: seqId,
            newsletter_id: newsletterId,
            name: step.name,
            content_type: step.content_type,
            source_id: step.source_id,
            subject_line_a: step.name
          };

          var rawHtml = fetchCampaignRawContent(pseudoCampaign, newsletter);
          var compiled = compileEmailContent(rawHtml, subscriber, pseudoCampaign, newsletter, 'A');

          // Send email via GmailApp
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

          GmailApp.sendEmail(
            subEmail,
            step.name,
            'Please enable HTML to view this sequence message.\n' + compiled.viewBrowserUrl,
            mailOptions
          );

          // Record in Delivery_Logs with sequence_id and step_number
          logDelivery({
            email: subEmail,
            campaign_or_drip_id: seqId,
            step_number: stepNum,
            subscriber_id: subscriber.subscriber_id || '',
            variant_sent: 'A',
            status: 'sent',
            timestamp: new Date().toISOString(),
            prevent_duplicates: false
          });

          // Update in-memory ledger
          ledgerMap[compositeKey] = {
            log_id_key: compositeKey,
            status: 'sent',
            timestamp: new Date().toISOString()
          };

          dispatchedCount++;
          Logger.log('[DripEngine] Dispatched ' + seqId + ' Step #' + stepNum + ' to ' + subEmail);

          // Only send one step per sequence per run for any given subscriber
          break;

        } catch (dispatchErr) {
          errorsCount++;
          Logger.log('[DripEngine] Error dispatching ' + compositeKey + ': ' + dispatchErr.message);

          try {
            logDelivery({
              email: subEmail,
              campaign_or_drip_id: seqId,
              step_number: stepNum,
              subscriber_id: subscriber.subscriber_id || '',
              variant_sent: 'A',
              status: 'failed',
              error_message: dispatchErr.message,
              timestamp: new Date().toISOString(),
              prevent_duplicates: false
            });
          } catch (e) {}

          break; // Stop this sequence for this user on error
        }
      }
    }
  }

  Logger.log('[DripEngine] Drip run complete. Dispatched: ' + dispatchedCount + ', Errors: ' + errorsCount);
  return {
    success: true,
    dispatched: dispatchedCount,
    errors: errorsCount,
    timestamp: new Date().toISOString()
  };
}

/**
 * Programmatically installs an hourly time-driven trigger for runDripSequences()
 * if one does not already exist.
 * 
 * @returns {{ installed: boolean, message: string }}
 */
function installDripTrigger() {
  var existingTriggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existingTriggers.length; i++) {
    if (existingTriggers[i].getHandlerFunction() === DRIP_TRIGGER_FUNCTION) {
      Logger.log('[DripEngine] Hourly trigger already exists.');
      return { installed: false, message: 'Hourly drip trigger is already installed and running.' };
    }
  }

  ScriptApp.newTrigger(DRIP_TRIGGER_FUNCTION)
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('[DripEngine] Successfully created hourly trigger for runDripSequences.');
  return { installed: true, message: 'Successfully installed hourly trigger for automated drip sequences.' };
}

/**
 * Helper to remove any existing drip triggers.
 */
function uninstallDripTrigger() {
  var existingTriggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < existingTriggers.length; i++) {
    if (existingTriggers[i].getHandlerFunction() === DRIP_TRIGGER_FUNCTION) {
      ScriptApp.deleteTrigger(existingTriggers[i]);
      removed++;
    }
  }
  return { removed: removed };
}
