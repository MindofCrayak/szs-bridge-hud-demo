import configRaw from '../../apps_script/Config.js?raw';
import databaseRaw from '../../apps_script/Database.js?raw';
import routerRaw from '../../apps_script/Router.js?raw';
import sendingEngineRaw from '../../apps_script/SendingEngine.js?raw';
import dripEngineRaw from '../../apps_script/DripEngine.js?raw';
import bounceHandlerRaw from '../../apps_script/BounceHandler.js?raw';
import preferenceCenterRaw from '../../apps_script/PreferenceCenter.html?raw';
import indexRaw from '../../apps_script/Index.html?raw';
import appsscriptRaw from '../../apps_script/appsscript.json?raw';
import setupRaw from '../../apps_script/Setup.js?raw';

export interface ScriptFile {
  id: string;
  filename: string;
  title: string;
  badge: string;
  language: string;
  description: string;
  functions: string[];
  code: string;
}

export const scriptFiles: ScriptFile[] = [
  {
    id: 'drip_engine',
    filename: 'DripEngine.js',
    title: 'File 1: Automated Time-Delay Sequence & Drip Engine',
    badge: 'Drip Engine',
    language: 'javascript',
    description: 'Automated time-delay sequence engine intended to run on an hourly time-driven trigger. Evaluates subscriber step eligibility based on delay_days from created_at (Step 1) or preceding step delivery logs, prevents duplicates, dispatches via GmailApp, and includes programmatic trigger installation.',
    functions: [
      'runDripSequences()',
      'installDripTrigger()',
      'uninstallDripTrigger()'
    ],
    code: dripEngineRaw
  },
  {
    id: 'bounce_handler',
    filename: 'BounceHandler.js',
    title: 'File 2: Automated Bounce Detection & Reputation Shield',
    badge: 'Bounce Handler',
    language: 'javascript',
    description: 'Automated deliverability protection engine. Searches Gmail for Mailer-Daemon and Postmaster bounce failure notices, parses failed recipient addresses, updates subscriber statuses to BOUNCED via LockService, marks threads as read, and organizes them under label MailEngine_Processed_Bounces.',
    functions: [
      'processBounces(maxThreads)',
      'extractFailedRecipientEmail(body)',
      'markSubscribersAsBounced(bouncedEmails)',
      'installBounceTrigger()',
      'uninstallBounceTrigger()'
    ],
    code: bounceHandlerRaw
  },
  {
    id: 'preference_center',
    filename: 'PreferenceCenter.html',
    title: 'File 3: Responsive Email Preference Center',
    badge: 'Preference Center',
    language: 'html',
    description: 'Responsive, clean unsubscribe and preference landing page using Tailwind CSS. Rendered by Router.js on ?action=unsubscribe. Displays recipient email, dynamically lists publications from Newsletters tab with checked defaults, and submits async updates via google.script.run.',
    functions: [
      'google.script.run.rpcGetPreferenceData(email)',
      'google.script.run.rpcSavePreferences(email, selected)',
      'google.script.run.rpcUnsubscribeAll(email)'
    ],
    code: preferenceCenterRaw
  },
  {
    id: 'index_html',
    filename: 'Index.html',
    title: 'File 4: Single-Page Web Dashboard (Tailwind + Alpine.js)',
    badge: 'SPA Dashboard',
    language: 'html',
    description: 'Full-featured single-page web app dashboard built with Tailwind CSS and Alpine.js. Provides real-time daily quota tracking, prominent GLOBAL_KILL_SWITCH toggle, tabs for Campaigns (Send Test, Approve & Dispatch, Create), Subscribers (badges & add form), Sequences (run & install triggers), and live Delivery_Logs table.',
    functions: [
      'google.script.run.rpcGetRows()',
      'google.script.run.rpcSendTestEmail()',
      'google.script.run.rpcExecuteCampaign()',
      'google.script.run.rpcRunDripSequences()',
      'google.script.run.rpcSetKillSwitch()'
    ],
    code: indexRaw
  },
  {
    id: 'sending_engine',
    filename: 'SendingEngine.js',
    title: 'SendingEngine: Batch Delivery & Resumption',
    badge: 'Sending Engine',
    language: 'javascript',
    description: 'Core email delivery engine. Executes pre-flight safety checks (sendTestEmail), quota buffer enforcement, 4.5-minute timeout guard with ScriptApp resumption triggers, double-send ledger verification, merge tags ({{first_name}}, {{unsubscribe_url}}, {{view_in_browser}}), tracking instrumentation, and deterministic A/B testing via GmailApp.',
    functions: [
      'sendTestEmail(campaignId, testEmail)',
      'executeCampaign(campaignId, startIndex)',
      'processCampaignBatchLoop(campaign, startIndex)',
      'resumeCampaignExecution()',
      'scheduleContinuationTrigger()',
      'deleteResumeTriggers()',
      'fetchCampaignRawContent(campaign, newsletter)',
      'compileEmailContent(rawHtml, recipient, campaign, newsletter, variant)'
    ],
    code: sendingEngineRaw
  },
  {
    id: 'config',
    filename: 'Config.js',
    title: 'Config.js: System Settings & Kill Switch',
    badge: 'Core Config',
    language: 'javascript',
    description: 'Centralized environment and configuration utility. Grabs active spreadsheet, reads System_Settings with intelligent type coercion, monitors 4.5m execution ceiling, and enforces master GLOBAL_KILL_SWITCH.',
    functions: [
      'getActiveSpreadsheet()',
      'getSystemSettings(forceRefresh)',
      'isGlobalKillSwitchActive()',
      'assertOperationsAllowed()',
      'checkEmailQuota()'
    ],
    code: configRaw
  },
  {
    id: 'database',
    filename: 'Database.js',
    title: 'Database.js: Data Access Layer & Concurrency',
    badge: 'Data Access Layer',
    language: 'javascript',
    description: 'Batch-oriented CRUD operations wrapped in LockService.getScriptLock(). High-speed reads (getValues()), atomic subscriber upserts with tag merging, and double-send prevention logs.',
    functions: [
      'getRows(sheetName)',
      'addOrUpdateSubscriber(subscriberData)',
      'logDelivery(logData)',
      'isAlreadyDelivered(email, campaignOrDripId, stepNumber)',
      'sanitizeAndValidateEmail(email)'
    ],
    code: databaseRaw
  },
  {
    id: 'router',
    filename: 'Router.js',
    title: 'Router.js: HTTP Gateway & RPC Entry Points',
    badge: 'Gateway & RPC',
    language: 'javascript',
    description: 'Web app HTTP entry points (doGet/doPost). Routes 1x1 open tracking pixel, click redirects, PreferenceCenter.html rendering, Index.html dashboard serving, JSON REST API, and google.script.run server RPCs.',
    functions: [
      'doGet(e)',
      'doPost(e)',
      'rpcGetPreferenceData(email)',
      'rpcSavePreferences(email, selectedNewsletters)',
      'rpcRunDripSequences()',
      'rpcProcessBounces()'
    ],
    code: routerRaw
  },
  {
    id: 'appsscript_json',
    filename: 'appsscript.json',
    title: 'Apps Script Manifest & OAuth Scopes',
    badge: 'Manifest',
    language: 'json',
    description: 'Project manifest configuring Google Apps Script V8 runtime, execution as deploying user, and explicit OAuth scopes for Sheets, Gmail send, Drive read, and trigger scheduling.',
    functions: ['spreadsheets', 'script.send_mail', 'script.scriptapp', 'drive.readonly'],
    code: appsscriptRaw
  },
  {
    id: 'setup_js',
    filename: 'Setup.js',
    title: 'Setup & Schema Validation Utility',
    badge: 'Database Setup',
    language: 'javascript',
    description: 'One-click verification and setup script that creates all 7 relational tabs if missing and inserts header columns and default settings.',
    functions: ['verifyOrSetupDatabase()'],
    code: setupRaw
  }
];
