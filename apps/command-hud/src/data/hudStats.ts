import type { AlfredAlert, ClientRecord } from '../types';
import { invoiceRows } from '../reports/statusSummary';

/**
 * Owner 2026-11-06: one source for the HUD's counters (top resource bar, bottom strip, cockpit), so the three
 * never disagree. Pure; computed from the loaded clients and alerts only.
 */
export interface HudStats {
  pipeline: number;
  collected: number;
  outstanding: number;
  openProjects: number;
  totalProjects: number;
  activeClients: number;
  openAlerts: number;
  blockAlerts: number;
  roadblocks: number;
  depositsDue: number;
  policeOpen: number;
}

const isPaid = (status: string) => /^paid$/i.test(String(status ?? '').trim());
const POLICE = new Set(['police', 'housekeeping', 'alfred']);

export function computeHudStats(clients: readonly ClientRecord[], alerts: readonly AlfredAlert[]): HudStats {
  let collected = 0;
  let outstanding = 0;
  let openProjects = 0;
  let totalProjects = 0;
  for (const client of clients) {
    for (const invoice of invoiceRows(client)) {
      const amount = Number(invoice.Amount) || 0;
      if (isPaid(invoice.Status)) collected += amount;
      else outstanding += amount;
    }
    totalProjects += client.activeProjects.length;
    openProjects += client.activeProjects.filter((project) => !String(project.SprintStage).startsWith('09')).length;
  }
  const open = alerts.filter((alert) => !alert.dismissed);
  return {
    pipeline: clients.reduce((sum, client) => sum + (Number(client.ContractValue) || 0), 0),
    collected,
    outstanding,
    openProjects,
    totalProjects,
    activeClients: clients.filter((client) => !['05: Complete', '06: Archived/Sunset'].includes(client.AccountPhase)).length,
    openAlerts: open.length,
    blockAlerts: open.filter((alert) => /^block$/i.test(alert.severity)).length,
    roadblocks: clients.filter((client) => client.roadblock?.trim()).length,
    depositsDue: clients.filter((client) => client.AccountPhase === '02: Session Zero' && !client.DepositPaid).length,
    policeOpen: open.filter((alert) => POLICE.has(String(alert.subRoutine).toLowerCase())).length,
  };
}

/** Day N of the 45-day cadence from Kickoff_Date, or null when there is no kickoff yet. */
export function cadenceDay(kickoff: string | undefined, now = new Date()): number | null {
  if (!kickoff) return null;
  const start = new Date(kickoff);
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
}

export const compactMoney = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `$${Math.round(value / 1000)}k`;
  return `$${Math.round(value).toLocaleString('en-US')}`;
};
