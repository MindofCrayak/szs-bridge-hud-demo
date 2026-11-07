import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applySnapshotOverlay,
  countSnapshotOverlayChanges,
  emptySnapshotOverlay,
  parseSnapshotOverlay,
  withClientPhase,
  withClientPhaseMode,
  withProjectStage,
  withoutClientPhase,
  withoutProjectStage,
} from './localOverlay';
import type { ClientRecord } from '../types';

const client: ClientRecord = {
  ClientID: 'AAA',
  Company_Name: 'Example Co',
  PrimaryContact: '',
  ContactEmail: '',
  AccountPhase: '01: Intake',
  ContractValue: 100,
  DepositPaid: false,
  DriveFolderUrl: '',
  NotesDocUrl: '',
  MSA_DocID: '',
  SOW_DocID: '',
  ChatSpaceUrl: '',
  activeProjects: [{
    ProjectID: 'AAA-01',
    ClientID: 'AAA',
    SprintStage: '00: Discovery',
    MilestonesTotal: 0,
    MilestonesDone: 0,
    AssignedRateTier: 'Normal',
  }],
};

test('snapshot overlay round trips, merges local moves, and counts changed records', () => {
  let overlay = withClientPhase(emptySnapshotOverlay(), 'AAA', '02: Session Zero');
  overlay = withProjectStage(overlay, 'AAA-01', '04: Session Zero Kickoff');
  const parsed = parseSnapshotOverlay(JSON.stringify(overlay));

  assert.deepEqual(applySnapshotOverlay([client], parsed), [{
    ...client,
    SheetAccountPhase: '01: Intake',
    AccountPhase: '02: Session Zero',
    AccountPhase_Mode: 'manual',
    activeProjects: [{ ...client.activeProjects[0], SprintStage: '04: Session Zero Kickoff' }],
  }]);
  assert.equal(countSnapshotOverlayChanges(parsed), 2);
});

test('project stage overlay derives the client phase unless a manual phase is saved', () => {
  const stageOverlay = withProjectStage(emptySnapshotOverlay(), 'AAA-01', '06: Mid-Flight Review');
  const [derived] = applySnapshotOverlay([client], stageOverlay);
  assert.equal(derived.AccountPhase, '03: Active Sprints');

  const manualOverlay = withClientPhase(stageOverlay, 'AAA', '02: Session Zero');
  const [manual] = applySnapshotOverlay([client], manualOverlay);
  assert.equal(manual.AccountPhase, '02: Session Zero');
});

test('removing local overrides restores automatic phase derivation', () => {
  const overlay = withProjectStage(
    withClientPhase(emptySnapshotOverlay(), 'AAA', '02: Session Zero'),
    'AAA-01',
    '06: Mid-Flight Review',
  );
  const cleared = withoutProjectStage(withoutClientPhase(overlay, 'AAA'), 'AAA-01');
  const [reset] = applySnapshotOverlay([client], cleared);
  assert.equal(reset.AccountPhase_Mode, 'auto');
  assert.equal(reset.AccountPhase, '01: Intake');

  const manualSource = { ...client, AccountPhase: '04: Liftoff' as const, AccountPhase_Mode: 'manual' as const };
  const manualOverlay = withClientPhase(emptySnapshotOverlay(), 'AAA', '04: Liftoff');
  const modeOverride = withClientPhaseMode(manualOverlay, 'AAA', 'auto');
  const [resetSource] = applySnapshotOverlay([manualSource], modeOverride);
  assert.equal(resetSource.AccountPhase_Mode, 'auto');
  assert.equal(resetSource.AccountPhase, '01: Intake');
});

test('snapshot overlay rejects invalid saved values with a readable error', () => {
  assert.throws(() => parseSnapshotOverlay('{"clients":{"AAA":"Unknown"}}'), /unknown account phase/i);
});
