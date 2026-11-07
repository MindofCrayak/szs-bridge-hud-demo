import { ServiceComponent } from '../types';
import { SERVICE_REGISTRY } from '../data/serviceRegistry';

export type Department = 'pamela' | 'oracle' | 'dolores' | 'vala' | 'daisy' | 'core';

export type CatalogEntry = ServiceComponent & {
  serviceId: string;
  label: string;
  nodeType: 'component';
  department: Department;
  defaultLinkTo: 'sun';
};

const DEPARTMENT_BY_SERVICE: Record<string, Department> = {
  comp_oracle_deepscan: 'oracle',
  comp_iron_gate_legal: 'pamela',
  comp_mcc_engine: 'daisy',
  comp_dns_shield: 'daisy',
  comp_gantt_symphony: 'dolores',
};

export const CATALOG: CatalogEntry[] = SERVICE_REGISTRY.map((service) => ({
  ...service,
  serviceId: service.id,
  label: service.name,
  nodeType: 'component',
  department: DEPARTMENT_BY_SERVICE[service.id] ?? 'core',
  defaultLinkTo: 'sun',
}));
