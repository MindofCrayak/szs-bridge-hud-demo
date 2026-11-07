import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSnapshotCsvFiles, SnapshotCsvFiles, SnapshotCsvName, countCsvDataRows } from '../src/data/snapshotData';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const IMPORTS = [
  { tab: 'Clients', destination: 'clients.csv', required: true },
  { tab: 'Projects', destination: 'projects.csv', required: true },
  { tab: 'Finances', destination: 'finances.csv', required: true },
  { tab: 'Alfred_Alerts', destination: 'alerts.csv', required: true },
  { tab: 'Services_Rates', destination: 'services_rates.csv', required: true },
  { tab: 'Schema_Registry', destination: 'schema_registry.csv', required: false },
  { tab: 'Schema_Change_Log', destination: 'schema_change_log.csv', required: false },
] as const;

export interface SnapshotImportResult {
  file: string;
  source: string | null;
  missing: boolean;
  rows: number;
  loaded: number | null;
  rejected: number | null;
  ignored: number | null;
}

function findSourceFile(sourceDirectory: string, tab: string): string | null {
  const suffix = ` - ${tab}.csv`.toLowerCase();
  const matches = readdirSync(sourceDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(suffix))
    .map((entry) => entry.name);

  if (matches.length > 1) {
    throw new Error(`More than one CSV export was found for the ${tab} tab.`);
  }
  return matches[0] ?? null;
}

export function importSnapshotFiles(
  sourceDirectory = resolve(REPO_ROOT, 'local_data'),
  destinationDirectory = resolve(REPO_ROOT, 'apps/command-hud/local-data'),
  warn: (message: string) => void = (message) => console.warn(message),
): SnapshotImportResult[] {
  mkdirSync(destinationDirectory, { recursive: true });

  const sources = new Map<string, string>();
  for (const item of IMPORTS) {
    const sourceName = findSourceFile(sourceDirectory, item.tab);

    if (!sourceName) {
      warn(`Missing export for ${item.tab} in ${sourceDirectory}.`);
    } else {
      const sourcePath = resolve(sourceDirectory, sourceName);
      copyFileSync(sourcePath, resolve(destinationDirectory, item.destination));
      sources.set(item.destination, sourceName);
    }
  }

  const snapshotNames: SnapshotCsvName[] = [
    'clients.csv',
    'projects.csv',
    'finances.csv',
    'alerts.csv',
    'services_rates.csv',
  ];
  const snapshotFiles = Object.fromEntries(snapshotNames.map((file) => {
    const path = resolve(destinationDirectory, file);
    return [file, existsSync(path) ? readFileSync(path, 'utf8') : ''];
  })) as SnapshotCsvFiles;
  const parsed = parseSnapshotCsvFiles(snapshotFiles);

  return IMPORTS.map((item) => {
    const file = item.destination;
    const source = sources.get(file) ?? null;
    const destinationPath = resolve(destinationDirectory, file);
    const contents = existsSync(destinationPath) ? readFileSync(destinationPath, 'utf8') : '';
    const fileCounts = file in parsed.fileCounts
      ? parsed.fileCounts[file as SnapshotCsvName]
      : null;
    return {
      file,
      source,
      missing: source === null,
      rows: source === null ? 0 : countCsvDataRows(contents),
      loaded: fileCounts?.loaded ?? null,
      rejected: fileCounts?.rejected ?? null,
      ignored: fileCounts?.ignored ?? null,
    };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = importSnapshotFiles();
  for (const item of result) {
    const status = item.loaded === null
      ? `source rows ${item.rows}`
      : `loaded ${item.loaded}, rejected ${item.rejected}, formula/blank rows ignored ${item.ignored}`;
    console.log(`${item.file}: ${status}${item.missing ? ' (no new export found)' : ''}`);
  }
}
