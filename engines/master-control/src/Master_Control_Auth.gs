function getAuthorizedMasterControlUser_() {
  const activeEmail = (typeof Session.getActiveUser === 'function' && Session.getActiveUser() && typeof Session.getActiveUser().getEmail === 'function')
    ? String(Session.getActiveUser().getEmail() || '').trim().toLowerCase()
    : '';
  const effectiveEmail = (typeof Session.getEffectiveUser === 'function' && Session.getEffectiveUser() && typeof Session.getEffectiveUser().getEmail === 'function')
    ? String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase()
    : '';
  const email = activeEmail || effectiveEmail;
  let allowedUsers = getConfiguredEmailList_('AUTHORIZED_USER_EMAILS');

  if (allowedUsers.length === 0) {
    allowedUsers = [
      'drake@drakeaustinconsulting.com',
      'drake@sessionzero.solutions'
    ];
    if (effectiveEmail && !allowedUsers.includes(effectiveEmail)) {
      allowedUsers.push(effectiveEmail);
    }
  }

  if (!email || !allowedUsers.includes(email)) {
    throw createRouterError_('A configured, authenticated Workspace user is required.', 'UNAUTHORIZED', 401);
  }
  return email;
}

function getAuthorizedPoliceAuditUser_() {
  const activeEmail = (typeof Session.getActiveUser === 'function' && Session.getActiveUser() && typeof Session.getActiveUser().getEmail === 'function')
    ? String(Session.getActiveUser().getEmail() || '').trim().toLowerCase()
    : '';
  const effectiveEmail = (typeof Session.getEffectiveUser === 'function' && Session.getEffectiveUser() && typeof Session.getEffectiveUser().getEmail === 'function')
    ? String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase()
    : '';
  let allowedUsers = getConfiguredEmailList_('POLICE_AUDIT_EMAILS');
  const actor = activeEmail || effectiveEmail;

  if (allowedUsers.length === 0) {
    allowedUsers = [
      'drake@drakeaustinconsulting.com',
      'drake@sessionzero.solutions'
    ];
    if (effectiveEmail && !allowedUsers.includes(effectiveEmail)) {
      allowedUsers.push(effectiveEmail);
    }
  }

  if (!actor || !allowedUsers.includes(actor)) {
    throw createRouterError_('A configured police-audit Workspace user is required.', 'UNAUTHORIZED', 401);
  }
  return actor;
}

function getConfiguredEmailList_(propertyName) {
  const value = PropertiesService.getScriptProperties().getProperty(propertyName) || '';
  return value.split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

function createRouterError_(message, code, statusCode, details) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
}

/** Working Copy guard (moved from the Phase C wipe file, 2026-11-06). Every tool that writes calls this first. */
var HUD_WORKING_COPY_SPREADSHEET_ID = '1KlP547wMInbfabpbAYI-sx8oirIQ8A19wlUquUdx3Rs';
var HUD_ORIGINAL_SPREADSHEET_ID = '1VLvipkP8LUOX2_F4RdIFHrq7e346XRSk1nYSClTVDy0';
/** Refuses to continue unless the target is the Working Copy (section 2). */
function hud_assertWorkingCopy_() {
  const spreadsheet = getMasterControlSpreadsheet_();
  const id = spreadsheet.getId();
  if (id === HUD_ORIGINAL_SPREADSHEET_ID) throw new Error('REFUSING: this is the ORIGINAL Master Control.');
  if (id !== HUD_WORKING_COPY_SPREADSHEET_ID) throw new Error('REFUSING: spreadsheet ' + id + ' is not the Working Copy.');
  return spreadsheet;
}
