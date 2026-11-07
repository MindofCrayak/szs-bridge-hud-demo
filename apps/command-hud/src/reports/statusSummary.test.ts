import assert from 'node:assert/strict';
import test from 'node:test';
import type { AlfredAlert, ClientRecord } from '../types';
import { buildStatusSummary, invoiceRows } from './statusSummary';

const client = {
  ClientID: 'PAC', Company_Name: '[TEST] Prime Auto Collision', AccountPhase: '03: Active Sprints', ContractValue: 13500, DepositPaid: true,
  finance: { remainingBalance: 9000, estimatedTax: null, netMargin: null, invoices: [
    { InvoiceID: '', ProjectID: 'PAC-01', MilestoneStage: 'Contract', Amount: 13500, Status: 'Contract' },
    { InvoiceID: 'INV-PAC-26-001', ProjectID: 'PAC-01', MilestoneStage: 'Deposit', Amount: 4500, Status: 'Paid' },
    { InvoiceID: 'INV-PAC-26-002', ProjectID: 'PAC-01', MilestoneStage: 'Mid-Flight', Amount: 4500, Status: 'Unpaid' },
  ] },
  activeProjects: [
    { ProjectID: 'PAC-01', Title: 'Initial Build', SprintStage: '06: Mid-Flight Review', Google_Tasklist_ID: 'L', Est_Hours: 40, Actual_Hours: 12 },
    { ProjectID: 'PAC-02', SprintStage: '02: Contract & Inception' },
  ],
} as unknown as ClientRecord;

const alerts = [
  { id: 'a', clientId: 'PAC', dismissed: false, severity: 'WARN', message: 'Deck stale' },
  { id: 'b', clientId: 'PAC', dismissed: true, severity: 'INFO', message: 'Old' },
  { id: 'c', clientId: 'SEN', dismissed: false, severity: 'INFO', message: 'Other client' },
] as AlfredAlert[];

test('invoice rows exclude the contract row', () => {
  assert.deepEqual(invoiceRows(client).map((invoice) => invoice.InvoiceID), ['INV-PAC-26-001', 'INV-PAC-26-002']);
});

test('status summary: money, invoices, projects with task counts, open alerts for this client only', () => {
  const summary = buildStatusSummary(client, alerts, { 'PAC-01': { projectId: 'PAC-01', open: 19, total: 24 } });
  assert.deepEqual(summary.invoices, { drafted: 2, paid: 1, open: 1, openAmount: 4500 });
  assert.equal(summary.projects[0].tasks, '19 open / 24');
  assert.equal(summary.projects[1].tasks, 'no list');
  assert.deepEqual(summary.openAlerts, [{ severity: 'WARN', message: 'Deck stale' }]);
  assert.match(summary.text, /Contract \$13,500 · deposit Paid · balance \$9,000/);
  assert.match(summary.text, /PAC-01 Initial Build: 06: Mid-Flight Review · tasks 19 open \/ 24/);
});
