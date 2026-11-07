import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const sourceUrl = new URL('../src/Pipeline_Phase_Gate.gs', import.meta.url);
const context = {};
vm.runInNewContext(readFileSync(sourceUrl, 'utf8'), context);
const evaluateGate = context.evaluatePipelineStageGate_;

const compliantClient = {
  ClientID: 'ACME-01',
  PipelineStage: '03: Deep Intelligence',
  DepositPaid: true,
  MSA_DocID: 'msa-id',
  SOW_DocID: 'sow-id',
};

test('allows stages before 04 without finance or document prerequisites', () => {
  const result = evaluateGate({ ClientID: 'ACME-01' }, '03: Deep Intelligence', {}, {});
  assert.equal(result.allowed, true);
  assert.equal(result.code, 'PREREQUISITES_NOT_REQUIRED');
});

test('allows stage 04 when deposit and non-empty MSA and SOW IDs are present', () => {
  const result = evaluateGate(compliantClient, '04: Session Zero Kickoff', {}, {});
  assert.equal(result.allowed, true);
  assert.equal(result.code, 'PREREQUISITES_MET');
});

test('treats stage 04 and later as gated and reports every missing requirement', () => {
  const result = evaluateGate(
    { ClientID: 'ACME-01', DepositPaid: false, MSA_DocID: ' ', SOW_DocID: null },
    '08: Liftoff',
    {},
    {},
  );
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'PHASE_GATE_REQUIREMENTS_MISSING');
  assert.deepEqual(Array.from(result.missing), ['DepositPaid', 'MSA_DocID', 'SOW_DocID']);
});

test('accepts only boolean true or the string TRUE for DepositPaid', () => {
  const result = evaluateGate(
    { ...compliantClient, DepositPaid: ' TRUE ' },
    '04',
    {},
    {},
  );
  assert.equal(result.allowed, true);
});

test('requires an explicit override and a non-empty reason when requirements are missing', () => {
  const client = { ...compliantClient, DepositPaid: false };
  const missingOverride = evaluateGate(client, '04', { overrideAuth: 'true', overrideReason: 'approved' }, {});
  const missingReason = evaluateGate(client, '04', { overrideAuth: true, overrideReason: ' ' }, {});
  assert.equal(missingOverride.code, 'PHASE_GATE_REQUIREMENTS_MISSING');
  assert.equal(missingReason.code, 'OVERRIDE_REASON_REQUIRED');
});

test('requires server-side authorization and audit logging before allowing an override', () => {
  const client = { ...compliantClient, DepositPaid: false };
  const auditRecords = [];
  let authorizationRequest;
  const result = evaluateGate(
    client,
    '04: Session Zero Kickoff',
    { overrideAuth: true, overrideReason: 'Signed exception approved by finance.' },
    {
      authorizeOverride: (request) => {
        authorizationRequest = request;
        return true;
      },
      logOverride: (record) => auditRecords.push(record),
    },
  );

  assert.equal(result.allowed, true);
  assert.equal(result.code, 'AUTHORIZED_OVERRIDE');
  assert.equal(authorizationRequest.clientId, 'ACME-01');
  assert.equal(auditRecords.length, 1);
  assert.equal(auditRecords[0].reason, 'Signed exception approved by finance.');
  assert.deepEqual(Array.from(auditRecords[0].missing), ['DepositPaid']);
});

test('fails closed when the override is unauthorized or audit logging is unavailable', () => {
  const client = { ...compliantClient, DepositPaid: false };
  const request = { overrideAuth: true, overrideReason: 'Approved exception.' };
  const unauthorized = evaluateGate(client, '04', request, {
    authorizeOverride: () => false,
    logOverride: () => {},
  });
  const noAuditLogger = evaluateGate(client, '04', request, {
    authorizeOverride: () => true,
  });
  assert.equal(unauthorized.code, 'OVERRIDE_NOT_AUTHORIZED');
  assert.equal(noAuditLogger.code, 'OVERRIDE_AUDIT_UNAVAILABLE');
});

test('does not allow an override when the audit writer fails', () => {
  const client = { ...compliantClient, DepositPaid: false };
  assert.throws(
    () => evaluateGate(
      client,
      '04',
      { overrideAuth: true, overrideReason: 'Approved exception.' },
      {
        authorizeOverride: () => true,
        logOverride: () => {
          throw new Error('audit write failed');
        },
      },
    ),
    /audit write failed/,
  );
});

test('rejects malformed target stages and client records', () => {
  assert.equal(evaluateGate(compliantClient, '10: Invalid', {}, {}).code, 'INVALID_TARGET_STAGE');
  assert.equal(evaluateGate(null, '04', {}, {}).code, 'INVALID_CLIENT');
});
