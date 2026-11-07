import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({
  console,
  Utilities: { getUuid: () => 'uuid' },
  Session: { getActiveUser: () => ({ getEmail: () => 'drake@drakeaustinconsulting.com' }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
});
for (const file of [
  '../src/Master_Control_Auth.gs', '../src/Central_Router.gs', '../Schema_Registry.gs',
  // Same order Apps Script uses (alphabetical), so load-time cross-file references fail here too.
  '../HUD_API.gs', '../HUD_Diagnostics.gs', '../HUD_Writes.gs',
]) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
}

test('registry completion maps legacy types, fills blanks, and enforces canonical enums', () => {
  const fix = context.hud_completeRegistryFields_;
  assert.deepEqual({ ...fix({
    Tab: 'Clients', Column_Name: 'ClientID', Data_Type: 'string', Allowed_Values: '',
    Data_Class: 'internal', Owner_Persona: 'Pamela', Required: '', Schema_Version: '0.1-baseline',
  }) }, { Data_Type: 'id', Allowed_Values: '^[A-Z]{3}\\d{0,2}$', Required: 'yes' });

  const phase = fix({
    Tab: 'Clients', Column_Name: 'AccountPhase', Data_Type: 'enum',
    Allowed_Values: '01: Intake, 02: Inception', Data_Class: 'internal', Owner_Persona: 'Pamela',
    Required: '', Schema_Version: 0.1,
  });
  assert.match(phase.Allowed_Values, /02: Session Zero/);
  assert.doesNotMatch(phase.Allowed_Values, /Inception/);
  assert.equal(phase.Schema_Version, '0.1');

  assert.equal(fix({ Tab: 'Finances', Column_Name: 'NetMargin', Data_Type: 'percentage' }).Data_Type, 'number');
  assert.equal(fix({ Tab: 'Clients', Column_Name: 'ContactEmail' }).Data_Class, 'pii');
  assert.equal(fix({ Tab: 'Finances', Column_Name: 'Remaining_Balance' }).Owner_Persona, 'Vala');

  const complete = {
    Tab: 'HUD_Audit_Log', Column_Name: 'Status', Data_Type: 'enum', Allowed_Values: 'Pending,Confirmed,Failed',
    Data_Class: 'internal', Owner_Persona: 'Alfred', Required: 'yes', Schema_Version: '1.0',
  };
  assert.deepEqual({ ...fix(complete) }, {}, 'a valid row is left untouched (idempotent)');
});

