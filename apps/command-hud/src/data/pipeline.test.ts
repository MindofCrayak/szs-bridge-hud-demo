import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contractRollup, deriveAccountPhase, financeSummary, SPRINT_STAGES } from './pipeline';
import type { SprintStage } from '../types';

const project = (SprintStage: SprintStage) => ({ SprintStage });

test('derived account phase uses the most advanced applicable pipeline band', () => {
  assert.equal(deriveAccountPhase([project('00: Discovery'), project('04: Session Zero Kickoff')], '01: Intake'), '02: Session Zero');
  assert.equal(deriveAccountPhase([project('04: Session Zero Kickoff'), project('05: Architecture & Builds')], '02: Session Zero'), '03: Active Sprints');
  assert.equal(deriveAccountPhase([project('08: Liftoff & Handover')], '03: Active Sprints'), '04: Liftoff');
  assert.equal(deriveAccountPhase([project('08: Liftoff & Handover'), project('08: Liftoff & Handover')], '03: Active Sprints'), '04: Liftoff');
  assert.equal(deriveAccountPhase([project('09: Sunset / Retainer')], '04: Liftoff'), '06: Archived/Sunset');
});

test('stage columns are grouped under their canonical derived account phase', () => {
  for (const { stage, phaseGrouping } of SPRINT_STAGES) {
    assert.equal(deriveAccountPhase([project(stage)], '01: Intake'), phaseGrouping, stage);
  }
});

test('complete phase is manual-only and empty project sets preserve the sheet phase', () => {
  assert.equal(deriveAccountPhase([project('06: Mid-Flight Review')], '05: Complete'), '05: Complete');
  assert.equal(deriveAccountPhase([], '02: Session Zero'), '02: Session Zero');
});

test('contract value rolls up from Finances contract rows; no contract rows falls back', () => {
  const rows = [
    { ClientID: 'PAC', MilestoneStage: 'Contract', TotalContractValue: 9000 },
    { ClientID: 'PAC', MilestoneStage: 'Contract', TotalContractValue: 4500 },
    { ClientID: 'PAC', MilestoneStage: 'Deposit (1/3)', TotalContractValue: 99999 },
    { ClientID: 'HLW', MilestoneStage: 'Contract', TotalContractValue: 3333.33 },
    { ClientID: 'HLW', MilestoneStage: 'Contract', TotalContractValue: 0.01 },
  ];
  assert.equal(contractRollup(rows, 'PAC'), 13500);
  assert.equal(contractRollup(rows, 'HLW'), 3333.34);
  assert.equal(contractRollup(rows, 'ZES'), null);
});

test('finance summary: balance from contract rows, tax total, invoice list without contract rows', () => {
  const rows = [
    { ClientID: 'PAC', InvoiceID: '', ProjectID: 'PAC-01', MilestoneStage: 'Contract', Amount: 9000, Status: 'Contract', Remaining_Balance: 6000 },
    { ClientID: 'PAC', InvoiceID: '', ProjectID: 'PAC-02', MilestoneStage: 'Contract', Amount: 4500, Status: 'Contract', Remaining_Balance: 4500 },
    { ClientID: 'PAC', InvoiceID: 'INV-PAC-26-001', ProjectID: 'PAC-01', MilestoneStage: 'Deposit (1/3)', Amount: 3000, Status: 'Paid', EstimatedQuarterlyTax: 750, NetMargin: 0.67 },
    { ClientID: 'SEN', InvoiceID: 'INV-SEN-26-001', ProjectID: 'SEN-01', MilestoneStage: 'Deposit (1/3)', Amount: 2500, Status: 'Paid' },
  ];
  const pac = financeSummary(rows, 'PAC');
  assert.equal(pac?.remainingBalance, 10500);
  assert.equal(pac?.estimatedTax, 750);
  assert.equal(pac?.netMargin, 0.67);
  assert.deepEqual(pac?.invoices.map((invoice) => invoice.InvoiceID), ['INV-PAC-26-001']);
  assert.equal(financeSummary(rows, 'ZES'), undefined);
});
