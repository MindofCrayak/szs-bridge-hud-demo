import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildStaffMeetingBriefs,
  deriveEffectiveAutonomy,
  getContextWhitelist,
  getPersonaOrder,
  HUD_CAP,
  PERSONAS,
  stageCrisisOverrideFromBlockAlert,
  type StaffMeetingInput,
} from './personas.config';
import {
  buildStaffMeetingPayload,
  buildStaffMeetingInstruction,
  buildStaffMeetingPrompt,
  normalizeStaffMeetingInput,
} from '../../server/alfredProxy';

const meetingInput: StaffMeetingInput = {
  clients: [
    { clientId: 'AAA', phase: '01: Intake', projectStages: ['00: Discovery'], depositPaid: false },
    { clientId: 'BBB', phase: '03: Active Sprints', projectStages: ['05: Architecture & Builds'], depositPaid: true },
  ],
  alerts: [
    { department: 'Housekeeping', severity: 'BLOCK' },
    { department: 'Daisy', severity: 'WARN' },
  ],
  proposals: [
    { title: 'Review first', type: 'draft_invoice', requiresMoneyGate: true, clientFacing: false },
    { title: 'Review second', type: 'send_email', requiresMoneyGate: false, clientFacing: true },
    { title: 'Review third', type: 'create_task', requiresMoneyGate: false, clientFacing: false },
    { title: 'Not in top three', type: 'create_task', requiresMoneyGate: false, clientFacing: false },
  ],
};

test('all personas use proposal-only autonomy capped below their sheet tier', () => {
  assert.equal(HUD_CAP, 'proposal-only');
  for (const persona of Object.values(PERSONAS)) {
    assert.equal(persona.authority.effectiveAutonomy, 'proposal-only');
    assert.equal(persona.authority.effectiveAutonomy, deriveEffectiveAutonomy(persona.authority.sheetTier));
  }
});

test('mock Staff Meeting returns six deterministic reports in Charter order', () => {
  const briefs = buildStaffMeetingBriefs(meetingInput);
  assert.deepEqual(briefs.map((brief) => brief.persona), getPersonaOrder());
  assert.equal(briefs.length, 6);
  assert.match(briefs[0].report.status, /2 client summaries, 2 alerts, 4 pending proposals/);
  assert.match(briefs[2].report.status, /No Oracle internal summary/);
  assert.equal(JSON.stringify(briefs[2].report).includes('case_file'), false);
});

test('context whitelist excludes registry columns classified pii or secret', () => {
  const whitelist = getContextWhitelist([
    { Column_Name: 'Owner_Email', Data_Class: 'pii' },
    { Column_Name: 'Access_Token', Data_Class: 'secret' },
    { Column_Name: 'AccountPhase', Data_Class: 'internal' },
  ]);
  assert.equal(whitelist.has('Owner_Email'), false);
  assert.equal(whitelist.has('Access_Token'), false);
  assert.equal(whitelist.has('AccountPhase'), true);
});

test('Staff Meeting proxy normalizes only whitelisted summaries and builds a redacted prompt', () => {
  const email = 'person@example.test';
  const longId = 'a'.repeat(44);
  const normalized = normalizeStaffMeetingInput({
    ...meetingInput,
    clients: [{
      ...meetingInput.clients[0],
      displayName: 'Should not enter prompt',
      email,
      contactId: longId,
    }],
    schemaRegistry: [
      { Column_Name: 'Owner_Email', Data_Class: 'pii' },
      { Column_Name: 'DepositPaid', Data_Class: 'pii' },
    ],
  });
  assert.ok(normalized);
  assert.equal(normalized.clients[0].depositPaid, undefined);
  const prompt = buildStaffMeetingPrompt('Staff Meeting: weekly review', normalized);
  const payload = buildStaffMeetingPayload('Staff Meeting: weekly review', normalized);
  assert.equal(payload.briefs.length, 6);
  assert.deepEqual(payload.briefs.map((brief) => brief.persona), getPersonaOrder());
  assert.equal(payload.decisionGates.length, 3);
  assert.ok(prompt.length <= 4_000);
  assert.equal(prompt.includes(email), false);
  assert.equal(prompt.includes(longId), false);
  assert.equal(prompt.includes('Owner_Email'), false);
  assert.equal(prompt.includes('Should not enter prompt'), false);
  assert.equal(prompt.includes('Not in top three'), false);
  assert.equal(prompt.includes('via Daisy'), true);
  assert.equal(buildStaffMeetingInstruction().includes('90/10'), false);
});

test('Police BLOCK may stage a crisis override but never activates it', () => {
  assert.equal(stageCrisisOverrideFromBlockAlert(
    { id: 'alert-info', clientId: 'AAA', severity: 'INFO' },
    'financial pause',
  ), null);
  const staged = stageCrisisOverrideFromBlockAlert(
    { id: 'alert-block', clientId: 'AAA', severity: 'BLOCK' },
    'financial pause',
  );
  assert.equal(staged?.id, 'crisis:alert-block:financial pause');
  assert.equal(staged?.alertId, 'alert-block');
  assert.equal(staged?.clientId, 'AAA');
  assert.equal(staged?.requestedState, 'financial pause');
  assert.deepEqual(staged?.stagedState, { state: 'staged', requiresSignoff: true });
  assert.equal(staged?.requiresSignoff, true);
  assert.equal(staged?.status, 'pending');
  assert.equal(staged?.type, 'stage_crisis_override');
  assert.equal(staged?.effect, 'propose');
});
