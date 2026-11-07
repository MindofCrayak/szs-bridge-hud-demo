/**
 * Phase E5 (Master Plan v3.1): "Send to client". Daisy is the single client-facing voice (Charter 8).
 * hud_previewClientMessage is read-only and composes the message; the HUD shows it for owner confirmation,
 * then sends it through the audited hud_write action "sendClientMessage", which posts to the project's
 * client-facing Chat Space only (Projects.ChatSpaceURL, never ChatSpace_Internal_URL).
 */

var DAISY_MAX_MESSAGE = 4000;
var DAISY_SIGNATURE = '— Daisy, Session Zero Solutions';

var DAISY_DUPLICATE_MINUTES = 10;

function daisy_text_(value) { return String(value == null ? '' : value).trim(); }

/**
 * Pure: true when audit rows hold a sendClientMessage to the same entity with the same text within the window.
 * Pending rows count too (a post may be in flight); Failed rows count only if they recorded a message name.
 */
function daisy_isRecentDuplicate_(rows, entity, text, now) {
  const cutoff = now.getTime() - DAISY_DUPLICATE_MINUTES * 60000;
  return rows.some(function (row) {
    if (row.Action !== 'sendClientMessage' || row.Entity !== entity) return false;
    const at = new Date(row.Timestamp).getTime();
    if (!(at >= cutoff)) return false;
    let before = {};
    let after = {};
    try { before = JSON.parse(row.Before || '{}'); } catch (error) { return false; }
    try { after = JSON.parse(row.After || '{}'); } catch (error) { after = {}; }
    if (String(before.text || '').trim() !== text) return false;
    return row.Status === 'Confirmed' || row.Status === 'Pending' || Boolean(after.messageName);
  });
}

function daisy_recentDuplicate_(spreadsheet, entity, text, now) {
  const sheet = spreadsheet.getSheetByName('HUD_Audit_Log');
  if (!sheet || sheet.getLastRow() < 2) return false;
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (h) { return String(h).trim(); });
  const start = Math.max(1, values.length - 200);
  const rows = values.slice(start).map(function (row) {
    const record = {};
    headers.forEach(function (header, index) { record[header] = row[index] instanceof Date ? row[index].toISOString() : row[index]; });
    return record;
  });
  return daisy_isRecentDuplicate_(rows, entity, text, now);
}

function daisy_shortDate_(iso) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? months[Number(match[2]) - 1] + ' ' + Number(match[3]) : '';
}

/** Pure: open client tasks whose due date is before today (YYYY-MM-DD), oldest first. */
function daisy_overdueClientTasks_(tasks, todayIso) {
  return dashboard_clientTasks_(tasks)
    .filter(function (task) { return !task.done && task.due && task.due < todayIso; })
    .map(function (task) { return { title: task.title, due: task.due }; });
}

/** Pure: the message in Daisy's voice (crisp, polished, no internal detail). Google Chat formatting. */
function daisy_composeClientMessage_(input) {
  const firstName = daisy_text_(input.firstName) || 'there';
  const projectName = daisy_text_(input.projectName).replace(/^\[TEST\]\s*/, '') || daisy_text_(input.projectId);
  const stage = daisy_text_(input.stage).replace(/^\d{2}:\s*/, '');
  const lines = ['Hi ' + firstName + ', a quick update on *' + projectName + '* (' + daisy_text_(input.projectId) + ').'];
  if (stage) lines.push('We are in *' + stage + '*.');
  if (input.deckUrl) {
    lines.push('', 'Your Command Deck has the live task list, documents and status: <' + input.deckUrl + '|Open your Command Deck>');
  }
  const overdue = input.overdue || [];
  if (overdue.length) {
    lines.push('', '*Waiting on you:*');
    overdue.slice(0, 10).forEach(function (task) { lines.push('• ' + task.title + (task.due ? ' (due ' + daisy_shortDate_(task.due) + ')' : '')); });
    if (overdue.length > 10) lines.push('• and ' + (overdue.length - 10) + ' more in the deck');
    lines.push('Tick each one in the Project_Tasks tab when it is done, or reply here with any questions.');
  } else {
    lines.push('', 'Nothing is waiting on you right now. Reply here any time with questions.');
  }
  lines.push('', DAISY_SIGNATURE);
  return lines.join('\n');
}

/** Pure: the client space for a project, refusing the internal one. Throws a plain Error with a reason. */
function daisy_clientSpace_(project) {
  const clientUrl = daisy_text_(project.ChatSpaceURL);
  const space = dolores_spaceName_(clientUrl);
  if (!space) throw new Error((daisy_text_(project.ProjectID) || 'This project') + ' has no client Chat Space (Projects.ChatSpaceURL).');
  if (space === dolores_spaceName_(project.ChatSpace_Internal_URL)) {
    throw new Error('ChatSpaceURL points at the internal space; refusing to post client messages there.');
  }
  return { name: space, url: clientUrl };
}

function daisy_projectContext_(spreadsheet, projectId) {
  const project = hud_findUniqueRecord_(hud_requireSheet_(spreadsheet, 'Projects'), 'ProjectID', projectId).record;
  const client = hud_findUniqueRecord_(hud_requireSheet_(spreadsheet, 'Clients'), 'ClientID', daisy_text_(project.ClientID)).record;
  return { project: project, client: client };
}

/** HUD read (scripts.run): composes the message for owner review. Writes nothing. */
function hud_previewClientMessage(projectId) {
  getAuthorizedMasterControlUser_();
  const id = daisy_text_(projectId);
  if (!id) throw new Error('A project ID is required.');
  const context = daisy_projectContext_(getMasterControlSpreadsheet_(), id);
  const space = daisy_clientSpace_(context.project);
  const listId = daisy_text_(context.project.Google_Tasklist_ID);
  const deckId = daisy_text_(context.project.Dashboard_Sheet_ID);
  const tz = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const overdue = listId ? daisy_overdueClientTasks_(dolores_listTasks_(listId), today) : [];
  const deckUrl = deckId ? 'https://docs.google.com/spreadsheets/d/' + deckId + '/edit' : '';
  const warnings = [];
  if (!deckId) warnings.push('No Command Deck yet; the message has no deck link.');
  if (!listId) warnings.push('No task list yet; no overdue digest.');
  const finalCheck = daisy_finalEligibility_(daisy_clientProjects_(getMasterControlSpreadsheet_(), context.client.ClientID), id);
  return {
    projectId: id,
    spaceName: space.name,
    spaceUrl: space.url,
    deckUrl: deckUrl,
    overdue: overdue,
    warnings: warnings,
    finalAllowed: finalCheck.ok,
    finalReason: finalCheck.reason,
    text: daisy_composeClientMessage_({
      firstName: context.client.First_Name, projectName: context.project.ProjectName, projectId: id,
      stage: context.project.SprintStage, deckUrl: deckUrl, overdue: overdue
    })
  };
}

/** hud_write action "sendClientMessage": payload { projectId, text }. A posted message cannot be unsent here. */
function hud_prepareClientMessageMutation_(spreadsheet, payload) {
  const projectId = daisy_text_(payload.projectId);
  const text = String(payload.text == null ? '' : payload.text).trim();
  if (!projectId || !text) {
    throw createRouterError_('A project ID and message text are required.', 'INVALID_REQUEST', 400);
  }
  if (text.length > DAISY_MAX_MESSAGE) {
    throw createRouterError_('The message is longer than ' + DAISY_MAX_MESSAGE + ' characters.', 'INVALID_REQUEST', 400);
  }
  let space;
  try {
    space = daisy_clientSpace_(daisy_projectContext_(spreadsheet, projectId).project);
  } catch (error) {
    if (error && error.code) throw error;
    throw createRouterError_(String(error && error.message || error), 'INVALID_REQUEST', 400);
  }
  // Final message (Final_Message.gs): planned before posting, so an ineligible project or a missing folder refuses
  // the whole send and nothing is posted.
  const archive = payload.final === true ? daisy_planArchive_(spreadsheet, projectId) : null;
  if (daisy_recentDuplicate_(spreadsheet, 'chat:' + space.name, text, new Date())) {
    throw createRouterError_('This exact message was already posted to this client space in the last '
      + DAISY_DUPLICATE_MINUTES + ' minutes. Edit it or wait before sending again.', 'DUPLICATE_MESSAGE', 409);
  }
  let posted = null;
  let archiveError = '';
  return {
    entity: 'chat:' + space.name,
    before: archive
      ? { projectId: projectId, space: space.name, text: text, final: true, folderId: archive.folderId, folderParents: archive.parents }
      : { projectId: projectId, space: space.name, text: text },
    apply: function () {
      posted = Chat.Spaces.Messages.create({ text: text }, space.name);
      // The post cannot be unsent, so a failed folder move is reported (after.archived false + archiveError) instead
      // of failing the save; the HUD shows it as a warning and the owner can retry from the menu.
      if (archive) {
        try { archive.apply(); } catch (error) { archiveError = String(error && error.message || error); }
      }
    },
    // Read-back = the message resource Chat created in the client space. Chat may reformat the text it echoes
    // (link markup, whitespace), so the echoed text is recorded for the audit log but is not the confirmation.
    readAfter: function () {
      return {
        projectId: projectId,
        space: space.name,
        messageName: posted ? daisy_text_(posted.name) : '',
        text: text,
        returnedText: posted ? String(posted.text || posted.formattedText || '') : '',
        createTime: posted ? daisy_text_(posted.createTime) : '',
        final: Boolean(archive),
        archived: archive ? archive.isInTarget() : false,
        archiveError: archiveError,
        folderId: archive ? archive.folderId : ''
      };
    },
    matches: function (after) {
      const ok = after.messageName.indexOf(space.name + '/messages/') === 0;
      if (!ok) console.warn('Chat create returned: ' + JSON.stringify(posted));
      return ok;
    },
    rollback: function () {
      if (archive) archive.undo();
      if (posted) console.warn('Message ' + posted.name + ' was posted but not confirmed; it cannot be unsent automatically.');
    }
  };
}
