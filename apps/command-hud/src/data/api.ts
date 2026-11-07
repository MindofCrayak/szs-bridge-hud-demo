import type { HudTask } from '../types';

interface AppsScriptExecutionResponse {
  done?: boolean;
  response?: {
    result?: unknown;
  };
  error?: {
    message?: string;
    details?: Array<{
      errorMessage?: string;
      errorType?: string;
    }>;
  };
}

export interface MasterControlReadSnapshot {
  clients: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  finances: Record<string, unknown>[];
  servicesRates: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
  schemaRegistry: Record<string, unknown>[];
  schemaChangeLog: Record<string, unknown>[];
  schemaVersion: string;
  generatedAt: string;
  warnings: string[];
}

export interface MasterControlWriteResult {
  ok: true;
  requestId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface ProjectTaskSummary {
  projectId: string;
  total: number;
  open: number;
}

export type MasterControlWriteAction = 'setAccountPhase' | 'setSprintStage' | 'resolveAlert' | 'resolveFinding' | 'sendClientMessage'
  | 'createTask' | 'setTaskStatus' | 'draftInvoice' | 'requestOsintSweep' | 'setBlocker' | 'restoreClientFolder' | 'removeService';

/** Phase E5: Daisy's composed message for owner review (read-only; nothing is sent). */
export interface ClientMessagePreview {
  projectId: string;
  spaceName: string;
  spaceUrl: string;
  deckUrl: string;
  overdue: { title: string; due: string }[];
  warnings: string[];
  text: string;
  /** Final message: allowed when the project is at 08/09 and the client's other projects are at 09. */
  finalAllowed: boolean;
  finalReason: string;
}

export function parseClientMessagePreview(value: unknown, projectId: string): ClientMessagePreview {
  const record = value as Record<string, unknown> | null;
  const isText = (field: unknown): field is string => typeof field === 'string';
  if (!record || typeof record !== 'object' || record.projectId !== projectId
    || !isText(record.spaceName) || !isText(record.spaceUrl) || !isText(record.deckUrl) || !isText(record.text)
    || !Array.isArray(record.warnings) || !record.warnings.every(isText) || !Array.isArray(record.overdue)) {
    throw new Error('Master Control returned an invalid client message preview.');
  }
  const overdue = record.overdue.map((item) => {
    const task = item as Record<string, unknown> | null;
    if (!task || !isText(task.title) || !isText(task.due)) throw new Error('Master Control returned an invalid overdue task.');
    return { title: task.title, due: task.due };
  });
  return {
    projectId, spaceName: record.spaceName, spaceUrl: record.spaceUrl, deckUrl: record.deckUrl,
    overdue, warnings: record.warnings, text: record.text,
    finalAllowed: record.finalAllowed === true,
    finalReason: isText(record.finalReason) ? record.finalReason : '',
  };
}

export async function fetchClientMessagePreview(accessToken: string, projectId: string): Promise<ClientMessagePreview> {
  const id = projectId.trim();
  if (!id) throw new Error('A project ID is required.');
  return parseClientMessagePreview(await runMasterControlFunction(accessToken, 'hud_previewClientMessage', [id]), id);
}

/** Owner 2026-11-06: what removing a service changes (price off the final invoice, open tasks deleted). */
export interface ServiceRemovalPreview {
  ok: boolean;
  reason: string;
  serviceName: string;
  price: number;
  tcvBefore: number | null;
  tcvAfter: number | null;
  finalBefore: number | null;
  finalAfter: number | null;
  finalInvoiceId: string;
  addendum: boolean;
  tasksToDelete: number;
  completedTasksKept: number;
  hasTaskList: boolean;
}

const numberOrNull = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export function parseServiceRemovalPreview(value: unknown): ServiceRemovalPreview {
  if (!isRecord(value) || typeof value.ok !== 'boolean') throw new Error('Master Control returned an invalid service removal preview.');
  const count = (field: unknown) => (typeof field === 'number' && Number.isInteger(field) && field >= 0 ? field : 0);
  return {
    ok: value.ok,
    reason: typeof value.reason === 'string' ? value.reason : '',
    serviceName: typeof value.serviceName === 'string' ? value.serviceName : String(value.serviceId ?? ''),
    price: numberOrNull(value.price) ?? 0,
    tcvBefore: numberOrNull(value.tcvBefore),
    tcvAfter: numberOrNull(value.tcvAfter),
    finalBefore: numberOrNull(value.finalBefore),
    finalAfter: numberOrNull(value.finalAfter),
    finalInvoiceId: typeof value.finalInvoiceId === 'string' ? value.finalInvoiceId : '',
    addendum: value.addendum === true,
    tasksToDelete: count(value.tasksToDelete),
    completedTasksKept: count(value.completedTasksKept),
    hasTaskList: value.hasTaskList === true,
  };
}

export async function fetchServiceRemovalPreview(accessToken: string, projectId: string, serviceId: string, price: number): Promise<ServiceRemovalPreview> {
  return parseServiceRemovalPreview(await runMasterControlFunction(accessToken, 'hud_previewServiceRemoval', [projectId, serviceId, price]));
}

export type ServiceAttachmentResult =
  | { status: 'offline' }
  | {
      status: 'persisted';
      updatedValue: number;
      activeComponents: string[];
      tasksCreated: number;
      tasksFailed: number;
      alreadyAttached: boolean;
    };

export const MASTER_CONTROL_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/script.scriptapp',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/admin.directory.group',
  'https://www.googleapis.com/auth/chat.spaces.create',
  'https://www.googleapis.com/auth/chat.memberships',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/apps.groups.settings',
] as const;

const getAppsScriptDeploymentId = (): string => {
  const deploymentId = import.meta.env.VITE_APPS_SCRIPT_DEPLOYMENT_ID?.trim();
  if (!deploymentId) {
    throw new Error('Master Control API Executable deployment ID is not configured.');
  }
  return deploymentId;
};

const getErrorMessage = (response: AppsScriptExecutionResponse): string =>
  response.error?.details?.[0]?.errorMessage
  || response.error?.message
  || 'Apps Script execution failed.';

/**
 * The Apps Script API itself failed (HTTP error), as opposed to the script throwing. Owner 2026-11-06: Google
 * sometimes answers HTTP 500 "Internal error encountered" although the script ran to the end, so a 5xx on a
 * write does not mean the write failed.
 */
export class MasterControlTransportError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'MasterControlTransportError';
    this.status = status;
  }
}

export const isServerSideTransportError = (error: unknown): error is MasterControlTransportError =>
  error instanceof MasterControlTransportError && error.status >= 500;

const pause = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

async function runMasterControlFunction(
  accessToken: string,
  functionName: string,
  parameters: unknown[] = [],
  signal?: AbortSignal,
): Promise<unknown> {
  if (!accessToken) {
    throw new Error('Google sign-in is required to contact Master Control.');
  }

  const deploymentId = getAppsScriptDeploymentId();
  const response = await fetch(
    `https://script.googleapis.com/v1/scripts/${encodeURIComponent(deploymentId)}:run`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        function: functionName,
        parameters,
        devMode: false,
      }),
      signal,
    },
  );

  const result: unknown = await response.json();
  if (!response.ok) {
    const responseError = typeof result === 'object'
      && result !== null
      && 'error' in result
      ? result.error
      : null;
    const errorMessage = typeof responseError === 'object'
      && responseError !== null
      && 'message' in responseError
      ? String(responseError.message || `HTTP ${response.status}`)
      : `Apps Script API request failed with HTTP ${response.status}.`;
    throw new MasterControlTransportError(errorMessage, response.status);
  }
  if (typeof result !== 'object' || result === null) {
    throw new Error('Apps Script API returned an invalid execution response.');
  }

  const execution = result as AppsScriptExecutionResponse;
  if (execution.error) {
    throw new Error(getErrorMessage(execution));
  }
  if (execution.done === false) {
    throw new Error('Apps Script execution did not complete.');
  }
  if (!execution.response || !('result' in execution.response)) {
    throw new Error('Apps Script execution returned no function result.');
  }
  return execution.response.result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRecordRows(value: unknown, tableName: string): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error(`Master Control returned an invalid ${tableName} table.`);
  }
  return value;
}

/** Task notes without the Audience/Start/Key header block (mirrors dashboard_description_ in Master Control). */
export function taskDescription(notes: string): string {
  const split = notes.indexOf('\n\n');
  if (split === -1) return /^(Audience|Start|Key):/m.test(notes) ? '' : notes;
  return notes.slice(split + 2).trim();
}

export function parseMasterControlProjectTaskList(
  value: unknown,
  expectedProjectId: string,
): { projectId: string; tasks: HudTask[] } {
  if (!isRecord(value)
    || value.projectId !== expectedProjectId
    || !Array.isArray(value.tasks)
    || !value.tasks.every(isRecord)) {
    throw new Error('Master Control returned an invalid project task response.');
  }
  const tasks = value.tasks;
  if (!tasks.every((task) => task.status === 'needsAction' || task.status === 'completed')) {
    throw new Error('Master Control returned a task without a supported status.');
  }
  const text = (field: unknown) => (typeof field === 'string' ? field : '');
  // Phase F: template Keys whose Is_Milestone is set (older servers omit the field).
  const milestoneKeys = new Set(Array.isArray(value.milestoneKeys) ? value.milestoneKeys.filter((key) => typeof key === 'string') : []);
  return {
    projectId: expectedProjectId,
    tasks: tasks.filter((task) => task.deleted !== true).map((task) => {
      const notes = text(task.notes);
      const audience = /^Audience:\s*client\b/im.test(notes) ? 'client' as const : 'internal' as const;
      const key = notes.match(/^Key:\s*(.+)$/m)?.[1].trim() ?? '';
      return {
        id: text(task.id),
        title: text(task.title),
        status: task.status as HudTask['status'],
        due: text(task.due).slice(0, 10),
        parentId: text(task.parent),
        audience,
        notes: taskDescription(notes),
        start: notes.match(/^Start:\s*(\d{4}-\d{2}-\d{2})/m)?.[1] ?? '',
        key,
        milestone: key !== '' && milestoneKeys.has(key),
      };
    }),
  };
}

export function summarizeProjectTasks(projectId: string, tasks: readonly HudTask[]): ProjectTaskSummary {
  return { projectId, total: tasks.length, open: tasks.filter((task) => task.status === 'needsAction').length };
}

export function parseMasterControlProjectTasks(
  value: unknown,
  expectedProjectId: string,
): ProjectTaskSummary {
  return summarizeProjectTasks(expectedProjectId, parseMasterControlProjectTaskList(value, expectedProjectId).tasks);
}

export async function fetchMasterControlProjectTasks(
  accessToken: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<{ projectId: string; tasks: HudTask[] }> {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) throw new Error('A project ID is required to read project tasks.');
  const result = await runMasterControlFunction(accessToken, 'hud_getProjectTasks', [normalizedProjectId], signal);
  return parseMasterControlProjectTaskList(result, normalizedProjectId);
}

export async function fetchMasterControlProjectTaskSummary(
  accessToken: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectTaskSummary> {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) throw new Error('A project ID is required to read project tasks.');
  const result = await runMasterControlFunction(
    accessToken,
    'hud_getProjectTasks',
    [normalizedProjectId],
    signal,
  );
  return parseMasterControlProjectTasks(result, normalizedProjectId);
}

export async function fetchMasterControlSnapshot(
  accessToken: string,
  signal?: AbortSignal,
): Promise<MasterControlReadSnapshot> {
  let result: unknown;
  try {
    result = await runMasterControlFunction(accessToken, 'hud_getSnapshot', [], signal);
  } catch (error) {
    // A read is safe to repeat: one retry after a Google-side 5xx before falling back to the snapshot.
    if (!isServerSideTransportError(error) || signal?.aborted) throw error;
    await pause(1500);
    result = await runMasterControlFunction(accessToken, 'hud_getSnapshot', [], signal);
  }
  if (!isRecord(result)) {
    throw new Error('Master Control returned an invalid read-only snapshot.');
  }
  const schemaVersion = result.schemaVersion;
  const generatedAt = result.generatedAt;
  const warnings = result.warnings;
  if (typeof schemaVersion !== 'string' || typeof generatedAt !== 'string'
      || !Array.isArray(warnings) || !warnings.every((warning) => typeof warning === 'string')) {
    throw new Error('Master Control snapshot is missing metadata or has invalid warnings.');
  }
  return {
    clients: parseRecordRows(result.clients, 'Clients'),
    projects: parseRecordRows(result.projects, 'Projects'),
    finances: parseRecordRows(result.finances, 'Finances'),
    servicesRates: parseRecordRows(result.servicesRates, 'Services_Rates'),
    alerts: parseRecordRows(result.alerts, 'Alfred_Alerts'),
    schemaRegistry: parseRecordRows(result.schemaRegistry, 'Schema_Registry'),
    schemaChangeLog: parseRecordRows(result.schemaChangeLog, 'Schema_Change_Log'),
    schemaVersion,
    generatedAt,
    warnings,
  };
}

export function parseMasterControlWriteResult(value: unknown): MasterControlWriteResult {
  if (!isRecord(value)
    || value.ok !== true
    || typeof value.requestId !== 'string'
    || !isRecord(value.before)
    || !isRecord(value.after)) {
    throw new Error('Master Control did not confirm the requested write.');
  }
  return {
    ok: true,
    requestId: value.requestId,
    before: value.before,
    after: value.after,
  };
}

export async function writeMasterControl(
  accessToken: string,
  action: MasterControlWriteAction,
  payload: Record<string, unknown>,
  requestId: string,
): Promise<MasterControlWriteResult> {
  const normalizedRequestId = requestId.trim();
  if (!normalizedRequestId) throw new Error('A write request ID is required.');
  const startedAt = Date.now();
  let result: unknown;
  try {
    result = await runMasterControlFunction(
      accessToken,
      'hud_write',
      [action, payload, normalizedRequestId],
    );
  } catch (error) {
    if (!isServerSideTransportError(error)) throw error;
    // The reply was lost, not necessarily the write: ask the audit log what happened to this request ID.
    return recoverWriteFromAudit(accessToken, normalizedRequestId, error);
  }
  const confirmed = parseMasterControlWriteResult(result);
  if (confirmed.requestId !== normalizedRequestId) {
    throw new Error('Master Control confirmed a different write request ID.');
  }
  // Owner feedback 2026-11-05 (slow saves): report where the time went (round trip vs. server steps).
  const timings = isRecord(result) && isRecord(result.timings) ? result.timings : {};
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hud-write-timing', { detail: { action, roundTripMs: Date.now() - startedAt, server: timings } }));
  }
  return confirmed;
}

export interface MasterControlWriteStatus {
  found: boolean;
  status: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  error: string;
}

export function parseMasterControlWriteStatus(value: unknown, requestId: string): MasterControlWriteStatus {
  if (!isRecord(value) || value.requestId !== requestId || typeof value.found !== 'boolean') {
    throw new Error('Master Control returned an invalid write status.');
  }
  return {
    found: value.found,
    status: typeof value.status === 'string' ? value.status : '',
    before: isRecord(value.before) ? value.before : {},
    after: isRecord(value.after) ? value.after : {},
    error: typeof value.error === 'string' ? value.error : '',
  };
}

/** Delays between audit-log checks after a lost write reply (a write holds the lock for up to ~30 s). */
export const WRITE_RECOVERY_DELAYS_MS = [1500, 3000, 5000, 8000, 12000];

export async function recoverWriteFromAudit(
  accessToken: string,
  requestId: string,
  original: Error,
  delays: number[] = WRITE_RECOVERY_DELAYS_MS,
  readStatus: (id: string) => Promise<unknown> = (id) => runMasterControlFunction(accessToken, 'hud_getWriteStatus', [id]),
): Promise<MasterControlWriteResult> {
  for (const delay of delays) {
    await pause(delay);
    let status: MasterControlWriteStatus;
    try {
      status = parseMasterControlWriteStatus(await readStatus(requestId), requestId);
    } catch {
      continue;
    }
    if (status.status === 'Confirmed') {
      return { ok: true, requestId, before: status.before, after: status.after };
    }
    if (status.status === 'Failed') throw new Error(status.error || 'Master Control recorded this write as failed.');
    // Not found or Pending: the write may still be running.
  }
  throw new Error(`${original.message} Master Control has not confirmed this save; refresh in a minute to see whether it went through.`);
}

export async function postMasterControlAction(
  accessToken: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  if (payload.action === 'updateKanban') {
    throw new Error('Legacy updateKanban actions are unsupported; use the audited setAccountPhase write.');
  }

  if (payload.action === 'RUN_PROVISIONING') {
    throw new Error('Provisioning is not available through the deployed Master Control API; no authorized provisioning wrapper is configured.');
  }

  if (payload.action === 'attachClientServiceNode') {
    return runMasterControlFunction(accessToken, 'attachClientServiceNode', [payload]);
  }

  throw new Error(`Master Control action "${String(payload.action ?? 'unknown')}" is not available through the deployed API.`);
}

export async function syncServiceToMasterControl(
  clientId: string,
  serviceId: string,
  priceDelta: number,
  tasks: string[],
  accessToken?: string | null,
  /** Phase G: the Solar project, so clients with several projects can attach (price goes to its contract TCV). */
  projectId?: string,
): Promise<ServiceAttachmentResult> {
  if (!accessToken) {
    return { status: 'offline' };
  }
  if (!clientId.trim() || !serviceId.trim() || !Number.isFinite(priceDelta) || priceDelta < 0
      || tasks.some(task => !task.trim())) {
    throw new Error('A valid client, service, price, and task list are required.');
  }
  const result = await postMasterControlAction(accessToken, {
    action: 'attachClientServiceNode',
    clientId,
    serviceId,
    priceDelta,
    tasks,
    ...(projectId ? { projectId } : {}),
    timestamp: new Date().toISOString(),
  });
  if (typeof result !== 'object' || result === null
      || !('success' in result) || result.success !== true
      || !('updatedValue' in result) || typeof result.updatedValue !== 'number'
      || !Number.isFinite(result.updatedValue)
      || !('activeComponents' in result) || !Array.isArray(result.activeComponents)
      || !result.activeComponents.every(component => typeof component === 'string')
      || !('tasksCreated' in result) || typeof result.tasksCreated !== 'number'
      || !Number.isInteger(result.tasksCreated)
      || !('tasksFailed' in result) || typeof result.tasksFailed !== 'number'
      || !Number.isInteger(result.tasksFailed)
      || !('alreadyAttached' in result) || typeof result.alreadyAttached !== 'boolean'
      || !result.activeComponents.includes(serviceId)) {
    throw new Error('Master Control did not confirm a complete service attachment response.');
  }
  return {
    status: 'persisted',
    updatedValue: result.updatedValue,
    activeComponents: result.activeComponents,
    tasksCreated: result.tasksCreated,
    tasksFailed: result.tasksFailed,
    alreadyAttached: result.alreadyAttached,
  };
}
