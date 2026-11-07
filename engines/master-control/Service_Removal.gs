/**
 * Remove a service from a project (owner decisions 2026-11-06, parking lot "service uninstall"):
 *   - Try to save or adapt a service first; this is for a service that is truly dropped.
 *   - Money: the price comes off the FINAL invoice only (that is why the final delivery invoice exists, so no
 *     refund is needed). Deposit and mid-flight stay as they are; the contract TCV drops by the same amount.
 *     After invoicing has started the change is recorded in AddendumRef (Police R10).
 *   - Tasks: the service's open (not completed) Google Tasks are deleted; completed ones stay as history.
 * hud_write action "removeService", payload { projectId, serviceId, price }.
 */

var SERVICE_FINAL_MILESTONE = 'Liftoff & QA (1/3)';

/**
 * Pure: the Finances change for removing `price` from a project. rows = Finances records with rowNumber.
 * Returns null for a free service; throws a router error the owner can act on otherwise.
 */
function service_removalFinancePlan_(rows, projectId, price, serviceLabel, today) {
  if (!(price > 0)) return null;
  const group = rows.filter(function (row) { return String(row.ProjectID || '').trim() === projectId; });
  const contracts = group.filter(function (row) { return row.MilestoneStage === VALA_CONTRACT; });
  if (contracts.length !== 1) {
    throw createRouterError_(projectId + (contracts.length ? ' has more than one Finances contract row; fix that first (Police R8).'
      : ' has no Finances contract row, so there is no price to take off.'), contracts.length ? 'DUPLICATE_CONTRACT' : 'NO_CONTRACT_ROW', 409);
  }
  const contract = contracts[0];
  const finalRow = group.filter(function (row) { return row.MilestoneStage === SERVICE_FINAL_MILESTONE; })[0];
  if (finalRow && vala_isIssued_(finalRow)) {
    throw createRouterError_(projectId + '\'s final invoice (' + String(finalRow.InvoiceID || '') + ') is already ' + String(finalRow.InvoiceStatus)
      + ', so it cannot be reduced. Adapt the service instead, or agree a credit with the client.', 'FINAL_INVOICED', 409);
  }
  const schedule = vala_schedule_(contract);
  const tcv = vala_isBlank_(contract.TotalContractValue) ? 0 : Number(contract.TotalContractValue);
  const finalCents = vala_toCents_(schedule[2]) - vala_toCents_(price);
  if (finalCents < 0) {
    throw createRouterError_('The service price ($' + price + ') is more than ' + projectId + '\'s final invoice ($' + schedule[2]
      + '). Adapt the service instead, or agree a credit with the client.', 'PRICE_OVER_FINAL', 409);
  }
  const note = 'Removed ' + serviceLabel + ' -$' + price + ' from the final invoice (' + today + ')';
  const invoicing = !vala_isBlank_(contract.TCV_At_First_Invoice);
  const addendum = String(contract.AddendumRef || '').trim();
  return {
    rowNumber: contract.rowNumber,
    before: {
      TotalContractValue: contract.TotalContractValue, Schedule_Deposit: contract.Schedule_Deposit,
      Schedule_MidFlight: contract.Schedule_MidFlight, Schedule_Final: contract.Schedule_Final, AddendumRef: contract.AddendumRef
    },
    after: {
      TotalContractValue: vala_fromCents_(vala_toCents_(tcv) - vala_toCents_(price)),
      Schedule_Deposit: schedule[0],
      Schedule_MidFlight: schedule[1],
      Schedule_Final: vala_fromCents_(finalCents),
      AddendumRef: invoicing ? (addendum ? addendum + '; ' : '') + note : contract.AddendumRef
    },
    finalBefore: schedule[2],
    finalInvoiceId: finalRow ? String(finalRow.InvoiceID || '') : ''
  };
}

/** Pure: the open tasks of one template tab to delete, and its parent if nothing completed stays under it. */
function service_tasksToDelete_(tasks, tab) {
  const prefix = tab + '::';
  const parentKey = tab + '::__parent__';
  const live = tasks.filter(function (task) { return !task.deleted; });
  const keyed = live.filter(function (task) { return String(dolores_noteKey_(task.notes) || '').indexOf(prefix) === 0; });
  const parent = keyed.filter(function (task) { return dolores_noteKey_(task.notes) === parentKey; })[0];
  const children = keyed.filter(function (task) { return task !== parent; });
  const open = children.filter(function (task) { return task.status !== 'completed'; });
  const keepsHistory = children.some(function (task) { return task.status === 'completed'; });
  const ids = open.map(function (task) { return task.id; });
  // Tasks under the parent that were added by hand (no Key) also keep the parent.
  const handAdded = parent ? live.some(function (task) { return task.parent === parent.id && !dolores_noteKey_(task.notes); }) : false;
  if (parent && !keepsHistory && !handAdded && parent.status !== 'completed') ids.push(parent.id);
  return { ids: ids, completedKept: children.length - open.length };
}

function hud_prepareServiceRemovalMutation_(spreadsheet, payload) {
  const projectId = String(payload.projectId == null ? '' : payload.projectId).trim();
  const serviceId = String(payload.serviceId == null ? '' : payload.serviceId).trim();
  const price = Number(payload.price);
  if (!projectId || !serviceId) throw createRouterError_('A project ID and a service ID are required.', 'INVALID_REQUEST', 400);
  if (!Number.isFinite(price) || price < 0) throw createRouterError_('The service price must be zero or more.', 'INVALID_REQUEST', 400);

  const projectsSheet = hud_requireSheet_(spreadsheet, 'Projects');
  const project = hud_findUniqueRecord_(projectsSheet, 'ProjectID', projectId);
  const componentsColumn = hud_requireColumn_(project.headers, 'ActiveComponents');
  const previousComponents = project.values[componentsColumn];
  const components = parseActiveComponents_(previousComponents);
  if (components.indexOf(serviceId) === -1) {
    throw createRouterError_(serviceId + ' is not installed on ' + projectId + '.', 'NOT_INSTALLED', 409);
  }
  const remaining = components.filter(function (id) { return id !== serviceId; });

  const financeSheet = hud_requireSheet_(spreadsheet, 'Finances');
  const finance = vala_readRecords_(financeSheet, ['InvoiceID', 'ClientID', 'ProjectID']);
  const tab = DOLORES_COMPONENT_TABS[serviceId] || '';
  const label = tab ? tab.replace(/_/g, ' ') : serviceId;
  const plan = service_removalFinancePlan_(finance.rows, projectId, price, label,
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  const financeColumns = plan ? Object.keys(plan.after).map(function (name) {
    return { name: name, column: hud_requireColumn_(finance.headers, name) + 1 };
  }) : [];

  // Tasks: planned now (read-only); deleted last, because a deleted Google Task cannot be restored.
  const listId = String(project.record.Google_Tasklist_ID || '').trim();
  const extraTabs = String(project.record.Task_Templates || '').split(',').map(function (t) { return t.trim(); });
  const taskPlan = listId && tab && extraTabs.indexOf(tab) === -1
    ? service_tasksToDelete_(dolores_listTasks_(listId), tab)
    : { ids: [], completedKept: 0 };

  const componentsCell = function () { return projectsSheet.getRange(project.rowNumber, componentsColumn + 1); };
  let componentsWritten = false;
  let financeWritten = false;
  let deleted = 0;
  const taskErrors = [];

  return {
    entity: 'project:' + projectId,
    // What the owner confirms in the HUD (hud_previewServiceRemoval).
    preview: {
      projectId: projectId, serviceId: serviceId, serviceName: label, price: price, remainingComponents: remaining,
      tcvBefore: plan ? Number(plan.before.TotalContractValue || 0) : null, tcvAfter: plan ? plan.after.TotalContractValue : null,
      finalBefore: plan ? plan.finalBefore : null, finalAfter: plan ? plan.after.Schedule_Final : null,
      finalInvoiceId: plan ? plan.finalInvoiceId : '', addendum: Boolean(plan && plan.after.AddendumRef !== plan.before.AddendumRef),
      tasksToDelete: taskPlan.ids.length, completedTasksKept: taskPlan.completedKept, hasTaskList: Boolean(listId)
    },
    before: {
      projectId: projectId, serviceId: serviceId, price: price, ActiveComponents: String(previousComponents || ''),
      finance: plan ? plan.before : null, openTasksToDelete: taskPlan.ids.length
    },
    apply: function () {
      componentsCell().setValue(remaining.join(','));
      componentsWritten = true;
      if (plan) {
        financeColumns.forEach(function (item) { financeSheet.getRange(plan.rowNumber, item.column).setValue(plan.after[item.name]); });
        financeWritten = true;
        vala_recomputeFinances_(spreadsheet);
      }
      SpreadsheetApp.flush();
      taskPlan.ids.forEach(function (id) {
        try { Tasks.Tasks.remove(listId, id); deleted += 1; } catch (error) { taskErrors.push(String(error && error.message || error)); }
      });
    },
    readAfter: function () {
      const current = hud_findUniqueRecord_(projectsSheet, 'ProjectID', projectId);
      const after = {
        projectId: projectId, serviceId: serviceId, price: price,
        activeComponents: parseActiveComponents_(current.values[componentsColumn]),
        tasksDeleted: deleted, completedTasksKept: taskPlan.completedKept, taskErrors: taskErrors.join(' | ')
      };
      if (plan) {
        const row = financeSheet.getRange(plan.rowNumber, 1, 1, finance.headers.length).getValues()[0];
        after.TotalContractValue = Number(row[finance.headers.indexOf('TotalContractValue')]);
        after.Schedule_Final = Number(row[finance.headers.indexOf('Schedule_Final')]);
        after.finalBefore = plan.finalBefore;
        after.finalInvoiceId = plan.finalInvoiceId;
      }
      return after;
    },
    matches: function (after) {
      if (after.activeComponents.indexOf(serviceId) !== -1) return false;
      if (!plan) return true;
      return vala_toCents_(after.TotalContractValue) === vala_toCents_(plan.after.TotalContractValue)
        && vala_toCents_(after.Schedule_Final) === vala_toCents_(plan.after.Schedule_Final);
    },
    rollback: function () {
      if (financeWritten) {
        financeColumns.forEach(function (item) {
          const value = plan.before[item.name];
          financeSheet.getRange(plan.rowNumber, item.column).setValue(value == null ? '' : value);
        });
        vala_recomputeFinances_(spreadsheet);
      }
      if (componentsWritten) componentsCell().setValue(previousComponents == null ? '' : previousComponents);
      if (deleted) console.warn(deleted + ' Google Task(s) were deleted before the save was rolled back; they cannot be restored.');
    }
  };
}

/** HUD read (scripts.run): what removing a service would change. Writes nothing; a refusal comes back as { ok: false, reason }. */
function hud_previewServiceRemoval(projectId, serviceId, price) {
  getAuthorizedMasterControlUser_();
  try {
    const mutation = hud_prepareServiceRemovalMutation_(getMasterControlSpreadsheet_(), { projectId: projectId, serviceId: serviceId, price: price });
    return Object.assign({ ok: true, reason: '' }, mutation.preview);
  } catch (error) {
    return { ok: false, reason: String(error && error.message || error), projectId: String(projectId || ''), serviceId: String(serviceId || '') };
  }
}
