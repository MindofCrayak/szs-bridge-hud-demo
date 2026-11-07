import clients from '../../local-data/clients.csv?raw';
import projects from '../../local-data/projects.csv?raw';
import finances from '../../local-data/finances.csv?raw';
import alerts from '../../local-data/alerts.csv?raw';
import servicesRates from '../../local-data/services_rates.csv?raw';
import type { SnapshotCsvFiles } from './snapshotData';

export const SNAPSHOT_CSV_FILES: SnapshotCsvFiles = {
  'clients.csv': clients,
  'projects.csv': projects,
  'finances.csv': finances,
  'alerts.csv': alerts,
  'services_rates.csv': servicesRates,
};
