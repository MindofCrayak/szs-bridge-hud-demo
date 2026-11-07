/**
 * Final message -> archive (parking lot 2026-11-05, built 2026-11-06).
 * Owner: moving the client folder to Sanctum Inactive by hand "felt unnecessary; it should be automatic, maybe when
 * I click send on their FINAL email". So Daisy's send has a "final message" option: the audited sendClientMessage
 * write posts the message, then moves the client root folder from Sanctum Active to Sanctum Inactive, and confirms
 * the move on read-back. "restoreClientFolder" is the undo (Inactive -> Active), also audited.
 *
 * A final message is allowed only when the project is at 08 Liftoff or 09 Sunset and every other project of the
 * client is at 09, because the folder belongs to the whole client.
 */
var DAISY_INACTIVE_DEFAULT_ID = '1vvPDDq4pw037kwkKDEdZbCfEWXc16eSl'; // Sanctum Inactive (alfred-grounding-document-v7)

function daisy_sanctumFolders_() {
  const props = PropertiesService.getScriptProperties();
  return {
    active: props.getProperty('ACTIVE_PARENT_FOLDER_ID') || HUD_SANCTUM_ACTIVE_FOLDER_ID,
    inactive: props.getProperty('INACTIVE_PARENT_FOLDER_ID') || DAISY_INACTIVE_DEFAULT_ID
  };
}

function daisy_clientProjects_(spreadsheet, clientId) {
  return hud_getSheetRecords_(hud_requireSheet_(spreadsheet, 'Projects'))
    .filter(function (row) { return daisy_text_(row.ClientID) === daisy_text_(clientId); });
}

/** Pure: may this project's message be the client's FINAL one? Returns { ok, reason }. */
function daisy_finalEligibility_(projects, projectId) {
  const stageNo = function (row) { return parseInt(daisy_text_(row.SprintStage).slice(0, 2), 10); };
  const own = projects.filter(function (row) { return daisy_text_(row.ProjectID) === projectId; })[0];
  if (!own) return { ok: false, reason: projectId + ' was not found.' };
  if (!(stageNo(own) >= 8)) {
    return { ok: false, reason: 'A final message is for Liftoff (08) or Sunset (09); ' + projectId + ' is at ' + daisy_text_(own.SprintStage) + '.' };
  }
  const open = projects
    .filter(function (row) { return daisy_text_(row.ProjectID) !== projectId && !(stageNo(row) >= 9); })
    .map(function (row) { return daisy_text_(row.ProjectID); });
  if (open.length) return { ok: false, reason: 'The client folder is shared, and these projects are still open: ' + open.join(', ') + '.' };
  return { ok: true, reason: '' };
}

/** A reversible move of one folder into a target parent folder. */
function daisy_folderMove_(folderId, targetId) {
  const folder = DriveApp.getFolderById(folderId);
  const target = DriveApp.getFolderById(targetId);
  const parentIds = function () {
    const out = [];
    const it = folder.getParents();
    while (it.hasNext()) out.push(it.next().getId());
    return out;
  };
  const parents = parentIds();
  let moved = false;
  return {
    folderId: folderId,
    folderName: folder.getName(),
    parents: parents,
    targetId: targetId,
    apply: function () {
      if (parents.indexOf(targetId) !== -1) return; // already there
      folder.moveTo(target);
      moved = true;
    },
    isInTarget: function () { return parentIds().indexOf(targetId) !== -1; },
    undo: function () { if (moved && parents.length) folder.moveTo(DriveApp.getFolderById(parents[0])); }
  };
}

/** Planned before anything is posted, so a refusal changes nothing. */
function daisy_planArchive_(spreadsheet, projectId) {
  const context = daisy_projectContext_(spreadsheet, projectId);
  const clientId = daisy_text_(context.client.ClientID);
  const check = daisy_finalEligibility_(daisy_clientProjects_(spreadsheet, clientId), projectId);
  if (!check.ok) throw createRouterError_(check.reason, 'NOT_FINAL', 409);
  const folderId = report_folderId_(context.client.DriveFolderUrl);
  if (!folderId) {
    throw createRouterError_(clientId + ' has no Drive folder (Clients.DriveFolderUrl), so there is nothing to archive.', 'INVALID_REQUEST', 400);
  }
  return daisy_folderMove_(folderId, daisy_sanctumFolders_().inactive);
}

/** hud_write action "restoreClientFolder": payload { clientId }. Undo of a final message: Inactive -> Active. */
function hud_prepareRestoreFolderMutation_(spreadsheet, payload) {
  const clientId = daisy_text_(payload.clientId);
  if (!clientId) throw createRouterError_('A client ID is required.', 'INVALID_REQUEST', 400);
  const client = hud_findUniqueRecord_(hud_requireSheet_(spreadsheet, 'Clients'), 'ClientID', clientId).record;
  const folderId = report_folderId_(client.DriveFolderUrl);
  if (!folderId) throw createRouterError_(clientId + ' has no Drive folder.', 'INVALID_REQUEST', 400);
  const folders = daisy_sanctumFolders_();
  const move = daisy_folderMove_(folderId, folders.active);
  if (move.parents.indexOf(folders.inactive) === -1) {
    throw createRouterError_('The ' + clientId + ' folder is not in Sanctum Inactive, so there is nothing to restore.', 'NOTHING_TO_RESTORE', 409);
  }
  return {
    entity: 'folder:' + folderId,
    before: { clientId: clientId, folderId: folderId, parents: move.parents },
    apply: move.apply,
    readAfter: function () { return { clientId: clientId, folderId: folderId, restored: move.isInTarget() }; },
    matches: function (after) { return after.restored === true; },
    rollback: move.undo
  };
}
