import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { importSnapshotFiles } from './importSnapshot';

const createTempDirectory = (): string => mkdtempSync(join(tmpdir(), 'szs-snapshot-import-'));

test('imports named sheet exports and counts quoted multiline rows', () => {
  const root = createTempDirectory();
  const source = join(root, 'local_data');
  const destination = join(root, 'apps', 'command-hud', 'local-data');
  mkdirSync(source, { recursive: true });
  const exports = [
    ['Clients', 'ClientID,Company_Name,AccountPhase,ContractValue,DepositPaid\nCSV,Example Co,03: Active Sprints,1000,TRUE\n'],
    ['Projects', 'ProjectID,ClientID,ProjectName,SprintStage,AssignedRateTier\nPRJ-2026-01,CSV,"Example,\nproject",04: Session Zero Kickoff,Normal\n'],
    ['Finances', 'InvoiceID,ClientID,InvoiceAmount,InvoiceStatus\nINV-TMP-26-001,CSV,100,Draft\n'],
    ['Alfred_Alerts', 'Alert_ID,Timestamp,Source_Module,ClientID,Priority,Category,Message,Action_URL,Dismissed_Status\nALT-01,2026-10-31T12:00:00Z,Police,CSV,Info,Alfred,Example,Review,FALSE\n'],
    ['Services_Rates', 'Rate_Tier,Hourly_Rate,Service_Category,Task_Item_Name\nNormal,85,Core Setups,Example Task\n'],
  ] as const;
  for (const [tab, content] of exports) {
    writeFileSync(join(source, `Working Copy of SZS Master Control - ${tab}.csv`), content);
  }
  writeFileSync(join(source, 'Working Copy of SZS Master Control - Schema_Registry.csv'), 'Registry_ID\nREG-1\n');

  try {
    const result = importSnapshotFiles(source, destination, () => undefined);
    assert.equal(result.find((item) => item.file === 'clients.csv')?.loaded, 1);
    assert.equal(result.find((item) => item.file === 'projects.csv')?.rows, 1);
    assert.equal(result.find((item) => item.file === 'schema_registry.csv')?.rows, 1);
    assert.equal(result.find((item) => item.file === 'schema_change_log.csv')?.missing, true);
    assert.match(readFileSync(join(destination, 'projects.csv'), 'utf8'), /"Example,\nproject"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects duplicate exports for a tab rather than choosing an arbitrary file', () => {
  const root = createTempDirectory();
  const source = join(root, 'source');
  const destination = join(root, 'destination');
  mkdirSync(source);
  writeFileSync(join(source, 'A - Clients.csv'), 'ClientID\n');
  writeFileSync(join(source, 'B - Clients.csv'), 'ClientID\n');

  try {
    assert.throws(() => importSnapshotFiles(source, destination, () => undefined), /More than one CSV export.*Clients/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
