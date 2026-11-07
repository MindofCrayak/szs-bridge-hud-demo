/**
 * Phase E6 (Master Plan v3.1): HUD task writes through the audited hud_write path.
 *   createTask     payload { projectId, title, notes?, due? (YYYY-MM-DD), parentId?, clientFacing }
 *   setTaskStatus  payload { projectId, taskId, done }
 * The project's list is Projects.Google_Tasklist_ID. Notes follow the Tasks conventions in section 3 of the plan:
 * an "Audience:" line, a "Key:" line, a blank line, then the description. Client-facing tasks must sit under a
 * parent task, because the Command Deck shows client child tasks only.
 */

var TASKW_TITLE_MAX = 1024;
var TASKW_NOTES_MAX = 8000;

function taskw_text_(value) { return String(value == null ? '' : value).trim(); }

/** Pure: Tasks notes with the header block. */
function taskw_notes_(audience, key, description) {
  const header = 'Audience: ' + audience + '\nKey: ' + key;
  const body = taskw_text_(description);
  return body ? header + '\n\n' + body : header;
}

/** Pure: '' -> '', 'YYYY-MM-DD' (a real date) -> RFC 3339 midnight UTC. Throws on anything else. */
function taskw_due_(value) {
  const text = taskw_text_(value);
  if (!text) return '';
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  if (!date || date.toISOString().slice(0, 10) !== text) throw new Error('Due must be a date in YYYY-MM-DD form.');
  return text + 'T00:00:00.000Z';
}

/** Pure: the fields the HUD and the read-back compare. */
function taskw_view_(task) {
  const item = task || {};
  return {
    taskId: taskw_text_(item.id),
    title: String(item.title || ''),
    status: item.status === 'completed' ? 'completed' : 'needsAction',
    due: String(item.due || '').slice(0, 10),
    parentId: taskw_text_(item.parent),
    audience: dashboard_audience_(item.notes),
    deleted: item.deleted === true
  };
}

function taskw_invalid_(message) { return createRouterError_(message, 'INVALID_REQUEST', 400); }

function taskw_listId_(spreadsheet, projectId) {
  let project;
  try {
    project = hud_findUniqueRecord_(hud_requireSheet_(spreadsheet, 'Projects'), 'ProjectID', projectId).record;
  } catch (error) {
    if (error && error.code) throw error;
    throw taskw_invalid_(String(error && error.message || error));
  }
  const listId = taskw_text_(project.Google_Tasklist_ID);
  if (!listId) throw taskw_invalid_(projectId + ' has no Google Tasks list (Projects.Google_Tasklist_ID).');
  return listId;
}

function taskw_get_(listId, taskId) {
  try {
    return Tasks.Tasks.get(listId, taskId);
  } catch (error) {
    throw taskw_invalid_('Task ' + taskId + ' was not found in this project list.');
  }
}

function hud_prepareTaskCreateMutation_(spreadsheet, payload) {
  const projectId = taskw_text_(payload.projectId);
  const title = taskw_text_(payload.title);
  const description = taskw_text_(payload.notes);
  const parentId = taskw_text_(payload.parentId);
  const audience = payload.clientFacing === true ? 'client' : 'internal';
  if (!projectId || !title) throw taskw_invalid_('A project ID and task title are required.');
  if (title.length > TASKW_TITLE_MAX) throw taskw_invalid_('The title is longer than ' + TASKW_TITLE_MAX + ' characters.');
  let due;
  try { due = taskw_due_(payload.due); } catch (error) { throw taskw_invalid_(error.message); }
  if (audience === 'client' && !parentId) {
    throw taskw_invalid_('Client-facing tasks need a parent task so they appear on the Command Deck.');
  }
  const listId = taskw_listId_(spreadsheet, projectId);
  if (parentId) {
    const parent = taskw_get_(listId, parentId);
    if (parent.parent) throw taskw_invalid_('Google Tasks allows one level of subtasks; pick a top-level parent.');
  }
  const key = 'hud::' + Utilities.getUuid().slice(0, 8);
  const notes = taskw_notes_(audience, key, description);
  if (notes.length > TASKW_NOTES_MAX) throw taskw_invalid_('The notes are longer than ' + TASKW_NOTES_MAX + ' characters.');
  const resource = { title: title, notes: notes };
  if (due) resource.due = due;
  const expected = { title: title, status: 'needsAction', due: due.slice(0, 10), parentId: parentId, audience: audience };
  let created = null;
  return {
    entity: 'task:' + projectId + '/new',
    before: { projectId: projectId, listId: listId, title: title, due: expected.due, parentId: parentId, audience: audience, key: key },
    apply: function () {
      created = parentId ? Tasks.Tasks.insert(resource, listId, { parent: parentId }) : Tasks.Tasks.insert(resource, listId);
    },
    readAfter: function () {
      const view = created && created.id ? taskw_view_(Tasks.Tasks.get(listId, created.id)) : taskw_view_(null);
      view.projectId = projectId;
      view.key = key;
      return view;
    },
    matches: function (after) {
      return Boolean(after.taskId) && !after.deleted && after.title === expected.title && after.status === expected.status
        && after.due === expected.due && after.parentId === expected.parentId && after.audience === expected.audience;
    },
    rollback: function () {
      if (created && created.id) Tasks.Tasks.remove(listId, created.id);
    }
  };
}

function hud_prepareTaskStatusMutation_(spreadsheet, payload) {
  const projectId = taskw_text_(payload.projectId);
  const taskId = taskw_text_(payload.taskId);
  if (!projectId || !taskId || typeof payload.done !== 'boolean') {
    throw taskw_invalid_('A project ID, task ID and done (true or false) are required.');
  }
  const done = payload.done;
  const target = done ? 'completed' : 'needsAction';
  const listId = taskw_listId_(spreadsheet, projectId);
  const current = taskw_view_(taskw_get_(listId, taskId));
  if (current.deleted) throw taskw_invalid_('Task ' + taskId + ' is deleted.');
  if (current.status === target) {
    throw createRouterError_('"' + current.title + '" is already ' + (done ? 'complete' : 'open') + '.', 'NO_CHANGE', 409);
  }
  let applied = false;
  return {
    entity: 'task:' + projectId + '/' + taskId,
    before: { projectId: projectId, listId: listId, taskId: taskId, title: current.title, status: current.status },
    apply: function () {
      dashboard_setTaskDone_(listId, taskId, done);
      applied = true;
    },
    readAfter: function () {
      const view = taskw_view_(Tasks.Tasks.get(listId, taskId));
      view.projectId = projectId;
      return view;
    },
    matches: function (after) { return after.taskId === taskId && after.status === target; },
    rollback: function () {
      if (applied) dashboard_setTaskDone_(listId, taskId, !done);
    }
  };
}
