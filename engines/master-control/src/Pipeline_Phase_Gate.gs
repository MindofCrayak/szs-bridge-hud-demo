function evaluatePipelineStageGate_(client, targetStage, request, services) {
  if (!client || typeof client !== 'object' || Array.isArray(client)) {
    return { allowed: false, code: 'INVALID_CLIENT', message: 'A client record is required.' };
  }

  var stageMatch = String(targetStage == null ? '' : targetStage).trim().match(/^(0[0-9])(?::|$)/);
  if (!stageMatch) {
    return { allowed: false, code: 'INVALID_TARGET_STAGE', message: 'A canonical pipeline stage from 00 through 09 is required.' };
  }

  var targetStageNumber = Number(stageMatch[1]);
  if (targetStageNumber < 4) {
    return { allowed: true, code: 'PREREQUISITES_NOT_REQUIRED', missing: [] };
  }

  var missing = [];
  var depositPaid = client.DepositPaid === true
    || (typeof client.DepositPaid === 'string' && client.DepositPaid.trim().toLowerCase() === 'true');

  if (!depositPaid) missing.push('DepositPaid');
  if (typeof client.MSA_DocID !== 'string' || !client.MSA_DocID.trim()) missing.push('MSA_DocID');
  if (typeof client.SOW_DocID !== 'string' || !client.SOW_DocID.trim()) missing.push('SOW_DocID');

  if (missing.length === 0) {
    return { allowed: true, code: 'PREREQUISITES_MET', missing: [] };
  }

  if (!request || request.overrideAuth !== true) {
    return {
      allowed: false,
      code: 'PHASE_GATE_REQUIREMENTS_MISSING',
      message: 'DepositPaid, MSA_DocID, and SOW_DocID are required before stage 04 or later.',
      missing: missing,
    };
  }

  var reason = typeof request.overrideReason === 'string' ? request.overrideReason.trim() : '';
  if (!reason) {
    return { allowed: false, code: 'OVERRIDE_REASON_REQUIRED', message: 'An override reason is required.', missing: missing };
  }

  if (!services || typeof services.authorizeOverride !== 'function') {
    return { allowed: false, code: 'OVERRIDE_AUTHORIZER_UNAVAILABLE', message: 'Override authorization is unavailable.', missing: missing };
  }

  var authorization = services.authorizeOverride({
    clientId: String(client.ClientID == null ? '' : client.ClientID),
    targetStage: String(targetStage).trim(),
    reason: reason,
  });
  if (authorization !== true) {
    return { allowed: false, code: 'OVERRIDE_NOT_AUTHORIZED', message: 'The requested override was not authorized.', missing: missing };
  }

  if (typeof services.logOverride !== 'function') {
    return { allowed: false, code: 'OVERRIDE_AUDIT_UNAVAILABLE', message: 'Override audit logging is unavailable.', missing: missing };
  }

  services.logOverride({
    timestamp: new Date().toISOString(),
    clientId: String(client.ClientID == null ? '' : client.ClientID),
    fromStage: String(client.PipelineStage == null ? '' : client.PipelineStage),
    targetStage: String(targetStage).trim(),
    missing: missing.slice(),
    reason: reason,
  });

  return { allowed: true, code: 'AUTHORIZED_OVERRIDE', missing: missing, reason: reason };
}
