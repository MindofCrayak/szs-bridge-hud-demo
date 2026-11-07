import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cadenceDay, compactMoney, computeHudStats } from './hudStats';
import type { AlfredAlert, ClientRecord } from '../types';

const client = (id: string, extra: Partial<ClientRecord>): ClientRecord => ({
  ClientID: id, Company_Name: id, PrimaryContact: '', ContactEmail: '', AccountPhase: '03: Active Sprints', ContractValue: 0,
  DepositPaid: true, DriveFolderUrl: '', NotesDocUrl: '', MSA_DocID: '', SOW_DocID: '', ChatSpaceUrl: '', activeProjects: [], ...extra,
}) as ClientRecord;

test('computeHudStats sums money, projects, alerts and roadblocks', () => {
  const clients = [
    client('PAC', {
      ContractValue: 9000, roadblock: 'DNS',
      finance: { remainingBalance: 0, estimatedTax: null, netMargin: null, invoices: [
        { InvoiceID: 'C', MilestoneStage: 'Contract', Amount: 9000, Status: '' },
        { InvoiceID: 'I1', MilestoneStage: '02', Amount: 3000, Status: 'Paid' },
        { InvoiceID: 'I2', MilestoneStage: '06', Amount: 3000, Status: 'Unpaid' },
      ] },
      activeProjects: [
        { ProjectID: 'PAC-01', ClientID: 'PAC', SprintStage: '05: Architecture & Builds', MilestonesTotal: 0, MilestonesDone: 0, AssignedRateTier: 'Normal' },
        { ProjectID: 'PAC-02', ClientID: 'PAC', SprintStage: '09: Sunset / Retainer', MilestonesTotal: 0, MilestonesDone: 0, AssignedRateTier: 'Normal' },
      ],
    }),
    client('ZES', { ContractValue: 1000, AccountPhase: '02: Session Zero', DepositPaid: false }),
    client('OLD', { AccountPhase: '06: Archived/Sunset' }),
  ];
  const alerts = [
    { id: '1', severity: 'BLOCK', subRoutine: 'Dolores', dismissed: false },
    { id: '2', severity: 'WARN', subRoutine: 'Police', dismissed: false },
    { id: '3', severity: 'BLOCK', subRoutine: 'Police', dismissed: true },
  ] as AlfredAlert[];
  const stats = computeHudStats(clients, alerts);
  assert.equal(stats.pipeline, 10000);
  assert.equal(stats.collected, 3000);
  assert.equal(stats.outstanding, 3000);
  assert.equal(stats.openProjects, 1);
  assert.equal(stats.totalProjects, 2);
  assert.equal(stats.activeClients, 2);
  assert.equal(stats.openAlerts, 2);
  assert.equal(stats.blockAlerts, 1);
  assert.equal(stats.policeOpen, 1);
  assert.equal(stats.roadblocks, 1);
  assert.equal(stats.depositsDue, 1);
});

test('cadenceDay and compactMoney', () => {
  assert.equal(cadenceDay('2026-11-01', new Date('2026-11-06T12:00:00Z')), 5);
  assert.equal(cadenceDay(undefined), null);
  assert.equal(cadenceDay('nope'), null);
  assert.equal(compactMoney(55000), '$55k');
  assert.equal(compactMoney(4500), '$4,500');
  assert.equal(compactMoney(2_500_000), '$2.5M');
});
