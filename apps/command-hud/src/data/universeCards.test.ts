import assert from 'node:assert/strict';
import test from 'node:test';
import type { ClientRecord } from '../types';
import { PHASE_ENTRY_STAGE, universeCards } from '../components/canvas/UniverseGalaxyView';

const client = (over: Partial<ClientRecord>) => ({
  ClientID: 'X', Company_Name: 'X Co', AccountPhase: '02: Session Zero', AccountPhase_Mode: 'auto', activeProjects: [], ...over,
}) as unknown as ClientRecord;

test('Universe: one card per project in its stage phase; whole-client Complete/Sunset keeps projects together', () => {
  const sen = client({ ClientID: 'SEN', AccountPhase: '02: Session Zero', AccountPhase_Mode: 'manual', activeProjects: [
    { ProjectID: 'SEN-01', SprintStage: '09: Sunset / Retainer' }, { ProjectID: 'SEN-02', SprintStage: '03: Deep Intelligence' },
  ] as ClientRecord['activeProjects'] });
  const mbs = client({ ClientID: 'MBS', AccountPhase: '05: Complete', AccountPhase_Mode: 'manual', activeProjects: [
    { ProjectID: 'MBS-01', SprintStage: '08: Liftoff & Handover' },
  ] as ClientRecord['activeProjects'] });
  const lead = client({ ClientID: 'NEW', AccountPhase: '01: Intake' });
  const cards = universeCards([sen, mbs, lead], new Set());
  assert.deepEqual(cards.map((c) => [c.key, c.phase, c.first]), [
    ['project:SEN-01', '06: Archived/Sunset', true],
    ['project:SEN-02', '02: Session Zero', false],
    ['project:MBS-01', '05: Complete', true],
    ['client:NEW', '01: Intake', true],
  ]);
  assert.equal(PHASE_ENTRY_STAGE['03: Active Sprints'], '05: Architecture & Builds');
  assert.equal(PHASE_ENTRY_STAGE['05: Complete'], undefined, 'Complete is client-level');
});
