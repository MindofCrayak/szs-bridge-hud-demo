import { SchemaChangeSchema } from './contracts';
import type { SchemaChange } from './contracts';

export type SchemaChangeRequestInput = Pick<
  SchemaChange,
  'Requested_By' | 'Target_Database' | 'Target_Tab' | 'Target_Column' | 'Change_Type' | 'Reason' | 'Impact' | 'Severity'
>;

export function createSchemaChangeRequest(
  input: SchemaChangeRequestInput,
  now = new Date(),
): SchemaChange {
  return SchemaChangeSchema.parse({
    Change_ID: 'SCH-####',
    Logged_At: now.toISOString(),
    ...input,
    Status: 'Requested',
    Approved_By: '',
    Applied_Version: '',
    Police_Check_Result: '',
    Rollback_Note: '',
    Source: 'hud.draft',
  });
}

export function serializeSchemaChangeRequest(request: SchemaChange): string {
  return JSON.stringify(request, null, 2);
}
