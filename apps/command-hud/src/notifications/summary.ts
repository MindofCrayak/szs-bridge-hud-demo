import type { AlfredAlert } from '../types';
import type { PendingProposal } from '../ecs/proposals';

export type NotificationDepartment = 'Housekeeping' | 'Pamela' | 'Oracle' | 'Dolores' | 'Vala' | 'Daisy';
export type NotificationSeverity = 'INFO' | 'WARN' | 'BLOCK';

export interface DepartmentNotification {
  department: NotificationDepartment;
  count: number;
  severity: NotificationSeverity | null;
}

const DEPARTMENTS: readonly NotificationDepartment[] = [
  'Housekeeping', 'Pamela', 'Oracle', 'Dolores', 'Vala', 'Daisy',
];
const SEVERITY_RANK: Record<NotificationSeverity, number> = { INFO: 1, WARN: 2, BLOCK: 3 };

export function normalizeNotificationSeverity(value: string): NotificationSeverity {
  if (value === 'BLOCK' || value === 'BLOCKER' || value === 'CRITICAL') return 'BLOCK';
  if (value === 'WARN' || value === 'WARNING' || value === 'HIGH') return 'WARN';
  return 'INFO';
}

function normalizeDepartment(value: string): NotificationDepartment | null {
  if (value === 'Alfred' || value === 'Police' || value === 'Housekeeping') return 'Housekeeping';
  return DEPARTMENTS.find((department) => department.toLowerCase() === value.toLowerCase()) || null;
}

export function summarizeDepartmentNotifications(
  alerts: readonly AlfredAlert[],
  proposals: readonly PendingProposal[],
  schemaFindings = 0,
): DepartmentNotification[] {
  const summaries = new Map<NotificationDepartment, DepartmentNotification>(
    DEPARTMENTS.map((department) => [department, { department, count: 0, severity: null }]),
  );
  const add = (department: NotificationDepartment, severity: NotificationSeverity) => {
    const summary = summaries.get(department)!;
    summary.count += 1;
    if (!summary.severity || SEVERITY_RANK[severity] > SEVERITY_RANK[summary.severity]) {
      summary.severity = severity;
    }
  };

  for (const alert of alerts) {
    if (alert.dismissed) continue;
    const department = normalizeDepartment(alert.subRoutine);
    if (department) add(department, normalizeNotificationSeverity(alert.severity));
  }
  for (const proposal of proposals) {
    if (proposal.status !== 'pending') continue;
    if (proposal.clientFacing) {
      add('Daisy', 'INFO');
    } else {
      const owner = proposal.type === 'draft_invoice' || proposal.type === 'ledger_increment'
        ? 'Vala'
        : proposal.type === 'create_task' || proposal.type === 'create_tasks'
          ? 'Dolores'
          : 'Housekeeping';
      add(owner, 'INFO');
    }
  }
  for (let index = 0; index < schemaFindings; index += 1) add('Housekeeping', 'WARN');

  return DEPARTMENTS.map((department) => summaries.get(department)!);
}

export function notificationSeverityColor(severity: NotificationSeverity | null): string {
  if (severity === 'BLOCK') return '#FE5F00';
  if (severity === 'WARN') return '#E0CA3C';
  return '#22D3EE';
}
