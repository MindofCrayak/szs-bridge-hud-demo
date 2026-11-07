import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SchemaChangeSchema } from './contracts';
import { createSchemaChangeRequest } from './schemaChangeRequest';

test('schema change draft has the exact log fields and is valid for a manual copy', () => {
  const request = createSchemaChangeRequest({
    Requested_By: 'HUD draft',
    Target_Database: 'Master Control',
    Target_Tab: 'Projects',
    Target_Column: 'ParentProjectID',
    Change_Type: 'Add column',
    Reason: 'Track project parentage.',
    Impact: 'Project relationships and Solar layout.',
    Severity: 'INFO',
  }, new Date('2026-10-31T12:00:00.000Z'));

  assert.deepEqual(Object.keys(request), [
    'Change_ID',
    'Logged_At',
    'Requested_By',
    'Target_Database',
    'Target_Tab',
    'Target_Column',
    'Change_Type',
    'Reason',
    'Impact',
    'Severity',
    'Status',
    'Approved_By',
    'Applied_Version',
    'Police_Check_Result',
    'Rollback_Note',
    'Source',
  ]);
  assert.equal(SchemaChangeSchema.safeParse(request).success, true);
  assert.equal(request.Status, 'Requested');
  assert.equal(request.Source, 'hud.draft');
});
