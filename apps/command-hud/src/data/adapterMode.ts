export type DataMode = 'live' | 'snapshot' | 'mock';

const configuredMode = import.meta.env?.VITE_DATA_MODE?.trim().toLowerCase();

if (configuredMode && !['live', 'snapshot', 'mock'].includes(configuredMode)) {
  throw new Error('VITE_DATA_MODE must be "live", "snapshot", or "mock".');
}

export const DATA_ADAPTER_MODE: DataMode = configuredMode
  || (import.meta.env?.VITE_LOCAL_DATA_EXISTS ? 'snapshot' : 'mock');
