import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MockAdapter } from '../data/adapter';
import type { AlfredAlert } from '../types';
import { notificationSeverityColor, summarizeDepartmentNotifications } from './summary';

test('notification summaries group open alerts by department and highest severity', async () => {
  const rows = await new MockAdapter().getAlerts();
  const alerts: AlfredAlert[] = rows.map((row) => ({
    id: row.Alert_ID,
    timestamp: row.Created_At,
    severity: row.Severity,
    subRoutine: row.Department,
    clientId: row.Client_ID || '',
    companyName: row.Department,
    message: row.Trigger_Condition,
    dismissed: false,
  }));
  alerts.push({
    id: 'dismissed',
    timestamp: new Date().toISOString(),
    severity: 'BLOCKER',
    subRoutine: 'Pamela',
    clientId: 'AAA',
    companyName: 'Example',
    message: 'Dismissed alert.',
    dismissed: true,
  });
  const summaries = summarizeDepartmentNotifications(alerts, []);
  assert.deepEqual(summaries.map(({ count }) => count), [3, 3, 3, 3, 3, 3]);
  assert.deepEqual(summaries.map(({ severity }) => severity), ['BLOCK', 'BLOCK', 'BLOCK', 'BLOCK', 'BLOCK', 'BLOCK']);
  assert.equal(notificationSeverityColor('INFO'), '#22D3EE');
  assert.equal(notificationSeverityColor('WARN'), '#E0CA3C');
  assert.equal(notificationSeverityColor('BLOCK'), '#FE5F00');
  assert.equal(notificationSeverityColor(null), '#22D3EE');
});

test('client-facing proposals add to Daisy and money proposals add to Vala', () => {
  const summaries = summarizeDepartmentNotifications([], [
    {
      id: 'proposal-money',
      proposer: 'Alfred',
      type: 'draft_invoice',
      title: 'Invoice review',
      detail: 'Review only.',
      clientId: 'AAA',
      surface: 'MultiAgentDispatch Priority Feed',
      effect: 'propose',
      requiresMoneyGate: true,
      clientFacing: false,
      status: 'pending',
      createdAt: 1,
    },
    {
      id: 'proposal-comms',
      proposer: 'Alfred',
      type: 'send_email',
      title: 'Email review',
      detail: 'Daisy review.',
      clientId: 'AAA',
      surface: 'MultiAgentDispatch Priority Feed',
      effect: 'propose',
      requiresMoneyGate: false,
      clientFacing: true,
      status: 'pending',
      createdAt: 1,
    },
  ]);
  assert.equal(summaries.find((item) => item.department === 'Vala')?.count, 1);
  assert.equal(summaries.find((item) => item.department === 'Daisy')?.count, 1);
});

test('schema findings contribute warning items to Housekeeping only', () => {
  const summary = summarizeDepartmentNotifications([], [], 2);
  assert.equal(summary.find((item) => item.department === 'Housekeeping')?.count, 2);
  assert.equal(summary.find((item) => item.department === 'Housekeeping')?.severity, 'WARN');
  assert.equal(summary.filter((item) => item.department !== 'Housekeeping').every((item) => item.count === 0), true);
});
