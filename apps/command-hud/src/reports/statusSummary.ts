import type { AlfredAlert, ClientRecord } from '../types';
import type { ProjectTaskSummary } from '../data/api';

/** Phase G3: read-only status summary (no writes, nothing sent). */
export interface StatusSummary {
  title: string;
  phase: string;
  contract: number;
  balance: number | null;
  deposit: string;
  invoices: { drafted: number; paid: number; open: number; openAmount: number };
  projects: { id: string; name: string; stage: string; tasks: string; hours: string }[];
  openAlerts: { severity: string; message: string }[];
  text: string;
}

const money = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/** Invoice rows only (the Finances contract row is not an invoice). */
export function invoiceRows(client: ClientRecord) {
  return (client.finance?.invoices ?? []).filter((invoice) => invoice.InvoiceID && invoice.MilestoneStage !== 'Contract');
}

export function buildStatusSummary(
  client: ClientRecord,
  alerts: readonly AlfredAlert[],
  taskSummaries: Readonly<Record<string, ProjectTaskSummary>>,
): StatusSummary {
  const invoices = invoiceRows(client);
  const isPaid = (status: string) => /^paid$/i.test(status.trim());
  const open = invoices.filter((invoice) => !isPaid(invoice.Status));
  const projects = client.activeProjects.map((project) => {
    const summary = taskSummaries[project.ProjectID];
    return {
      id: project.ProjectID,
      name: project.Title || project.ProjectID,
      stage: project.SprintStage,
      tasks: summary ? `${summary.open} open / ${summary.total}` : project.Google_Tasklist_ID ? 'not read' : 'no list',
      hours: `${project.Est_Hours ?? '—'} est / ${project.Actual_Hours ?? '—'} actual`,
    };
  });
  const openAlerts = alerts.filter((alert) => alert.clientId === client.ClientID && !alert.dismissed)
    .map((alert) => ({ severity: alert.severity, message: alert.message }));
  const summary: Omit<StatusSummary, 'text'> = {
    title: client.Company_Name || client.ClientID,
    phase: client.AccountPhase,
    contract: client.ContractValue,
    balance: client.finance ? client.finance.remainingBalance : null,
    deposit: client.DepositPaid ? 'Paid' : 'Due',
    invoices: { drafted: invoices.length, paid: invoices.length - open.length, open: open.length, openAmount: open.reduce((sum, invoice) => sum + invoice.Amount, 0) },
    projects,
    openAlerts,
  };
  const lines = [
    `${summary.title} (${client.ClientID}) · ${summary.phase}`,
    `Contract ${money(summary.contract)} · deposit ${summary.deposit}${summary.balance === null ? '' : ` · balance ${money(summary.balance)}`}`,
    `Invoices: ${summary.invoices.paid} paid, ${summary.invoices.open} open (${money(summary.invoices.openAmount)})`,
    ...projects.map((project) => `${project.id} ${project.name}: ${project.stage} · tasks ${project.tasks} · hours ${project.hours}`),
    openAlerts.length ? `Open alerts (${openAlerts.length}): ${openAlerts.map((alert) => alert.message).join('; ')}` : 'No open alerts.',
  ];
  return { ...summary, text: lines.join('\n') };
}
