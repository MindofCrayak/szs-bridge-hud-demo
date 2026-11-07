import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toClientUnit } from './clientUnit';
import type { ClientRecord } from '../types';

const client = {
  ClientID: 'PAC', Company_Name: 'Pacific Co', PrimaryContact: 'Pat', ContactEmail: 'pat@example.com',
  AccountPhase: '03: Active Sprints', ContractValue: 4500, DepositPaid: true, DriveFolderUrl: 'd', NotesDocUrl: 'n',
  MSA_DocID: '', SOW_DocID: '', ChatSpaceUrl: 'c',
  activeProjects: [
    { ProjectID: 'PAC-01', ClientID: 'PAC', SprintStage: '05: Architecture & Builds', MilestonesTotal: 3, MilestonesDone: 1, AssignedRateTier: 'Normal', Title: 'Site' },
    { ProjectID: 'PAC-02', ClientID: 'PAC', SprintStage: '02: Contract & Inception', MilestonesTotal: 2, MilestonesDone: 0, AssignedRateTier: 'Normal', Title: 'App' },
  ],
} as ClientRecord;

test('toClientUnit fills the demo fields the prototype screens read (no blank names or $NaN)', () => {
  const unit = toClientUnit(client);
  assert.equal(unit.id, 'PAC');
  assert.equal(unit.name, 'Pacific Co');
  assert.equal(unit.contractValue, 4500);
  assert.equal(unit.depositPaid, true);
  assert.equal(unit.contactEmail, 'pat@example.com');
  assert.equal(unit.pipelineStage, '03: Active Sprints');
  assert.equal(unit.totalMilestones, 5);
  assert.equal(unit.completedMilestones, 1);
  assert.equal(unit.currentMilestone, '05: Architecture & Builds');
  assert.equal(unit.serviceArea, 'Site, App');
  assert.equal(unit.ClientID, 'PAC');
});

test('toClientUnit survives a client with no projects and no contract value', () => {
  const unit = toClientUnit({ ...client, ContractValue: Number.NaN, activeProjects: [], Company_Name: '' });
  assert.equal(unit.contractValue, 0);
  assert.equal(unit.name, 'Pat');
  assert.equal(unit.currentMilestone, 'No project');
  assert.equal(unit.totalMilestones, 0);
});
