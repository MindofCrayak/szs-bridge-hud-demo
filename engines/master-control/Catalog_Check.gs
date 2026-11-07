/**
 * Phase E7 (Master Plan v3.1): catalog check. READ-ONLY: writes nothing anywhere.
 * Dumps what the comparison needs (template tabs and their task names, Services_Rates, the component -> tab map,
 * and what Projects reference) and flags mismatches inside Master Control. The comparison with the HUD service
 * registry (apps/command-hud/src/data/serviceRegistry.ts) is done from this log in the repo, not here.
 */

/** Pure: mismatches between the template repository and what Master Control references. */
function catalog_findings_(input) {
  const tabs = input.tabs.map(function (t) { return t.tab; });
  const mapped = input.componentTabs;
  const findings = [];
  Object.keys(mapped).forEach(function (id) {
    if (tabs.indexOf(mapped[id]) === -1) findings.push('Component ' + id + ' maps to missing tab ' + mapped[id] + '.');
  });
  const mappedTabs = Object.keys(mapped).map(function (id) { return mapped[id]; });
  input.tabs.forEach(function (t) {
    if (t.tab === DOLORES_BASE_TAB || t.tab === DOLORES_OFFBOARDING_TAB || mappedTabs.indexOf(t.tab) !== -1) return;
    findings.push('Tab ' + t.tab + ' (' + t.tasks.length + ' tasks) is not mapped to a service component; reachable only via Projects.Task_Templates.');
  });
  input.tabs.forEach(function (t) {
    if (t.tasks.length === 0) findings.push('Tab ' + t.tab + ' has no tasks.');
    const seen = {};
    t.tasks.forEach(function (name) {
      const key = dolores_slug_(name);
      if (seen[key]) findings.push('Tab ' + t.tab + ' repeats task "' + name + '" (duplicate Key ' + t.tab + '::' + key + ').');
      seen[key] = true;
    });
  });
  input.projects.forEach(function (p) {
    p.components.forEach(function (id) {
      if (!mapped[id]) findings.push(p.projectId + ' uses component ' + id + ' which has no template tab.');
    });
    p.templates.forEach(function (tab) {
      if (tabs.indexOf(tab) === -1) findings.push(p.projectId + ' names unknown template tab ' + tab + ' in Task_Templates.');
    });
  });
  return findings;
}

function catalog_list_(value) {
  return String(value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

/** Owner entry point (run from the editor, paste the log). */
function runCatalogCheck() {
  const repo = SpreadsheetApp.openById(DOLORES_TEMPLATE_REPO_ID);
  const tabNames = repo.getSheets().map(function (s) { return s.getName(); })
    .filter(function (name) { return DOLORES_NOT_TASK_TABS.indexOf(name) === -1; });
  const tabs = dolores_readTemplates_(repo, tabNames).map(function (t) {
    return { tab: t.tab, tasks: t.tasks.map(function (task) { return task.name; }),
      client: t.tasks.filter(function (task) { return task.audience === 'client'; }).length,
      milestones: t.tasks.filter(function (task) { return task.milestone; }).map(function (task) { return task.name; }) };
  });
  const spreadsheet = getMasterControlSpreadsheet_();
  const projects = hud_getSheetRows_(spreadsheet, 'Projects').map(function (p) {
    return { projectId: String(p.ProjectID || ''), components: catalog_list_(p.ActiveComponents), templates: catalog_list_(p.Task_Templates) };
  });
  const report = {
    readOnly: true,
    servicesRates: hud_getSheetRows_(spreadsheet, 'Services_Rates'),
    componentTabs: DOLORES_COMPONENT_TABS,
    tabs: tabs,
    projects: projects,
    findings: catalog_findings_({ tabs: tabs, componentTabs: DOLORES_COMPONENT_TABS, projects: projects })
  };
  return dolores_report_(report);
}
