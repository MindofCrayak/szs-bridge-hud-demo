import React, { useState } from 'react';
import type { ClientRecord } from '../types';
import { defaultInvoiceSchedule } from '../data/pipeline';

interface TreasureLedgerViewProps {
  units: ClientRecord[];
  activeUnit: ClientRecord | null;
  onSelectUnit: (id: string) => void;
  onNavigateToDashboard: () => void;
  onLogTerminal: (message: string, type?: 'normal' | 'action' | 'server' | 'alert') => void;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Tranches follow the settled finance model: deposit at stage 02, mid-flight at 06, final at 08 (equal thirds). */
const TRANCHES = [
  { key: 'deposit', label: 'Deposit · Stage 02', index: 0 },
  { key: 'midterm', label: 'Mid-Flight · Stage 06', index: 1 },
  { key: 'completion', label: 'Final · Stage 08', index: 2 },
] as const;
type TrancheKey = typeof TRANCHES[number]['key'];

const advancedStage = (client: ClientRecord): string => {
  const stages = client.activeProjects.map((project) => project.SprintStage).sort();
  return stages[stages.length - 1] ?? 'No project';
};

export const TreasureLedgerView: React.FC<TreasureLedgerViewProps> = ({
  units,
  activeUnit,
  onSelectUnit,
  onNavigateToDashboard,
  onLogTerminal,
}) => {
  const currentClient = activeUnit || units[0] || null;
  const [invoiceType, setInvoiceType] = useState<TrancheKey>('deposit');

  const depositOf = (client: ClientRecord) => defaultInvoiceSchedule(client.ContractValue || 0)[0];
  const totalPipelineValue = units.reduce((sum, client) => sum + (client.ContractValue || 0), 0);
  const contracted = units.filter((client) => (client.ContractValue || 0) > 0);
  const paidDeposits = contracted.filter((client) => client.DepositPaid);
  const pendingDeposits = contracted.filter((client) => !client.DepositPaid);
  const totalPaidDeposits = paidDeposits.reduce((sum, client) => sum + depositOf(client), 0);
  const totalPendingDeposits = pendingDeposits.reduce((sum, client) => sum + depositOf(client), 0);
  const tranche = TRANCHES.find((candidate) => candidate.key === invoiceType) ?? TRANCHES[0];
  const draftTotal = currentClient ? defaultInvoiceSchedule(currentClient.ContractValue || 0)[tranche.index] : 0;

  return (
    <main className="flex-1 min-h-0 flex flex-col bg-bg-obsidian text-text-mana p-4 sm:p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-accent-teal/60 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-highlight-gold animate-pulse-glow" />
            <p className="font-mono text-xs uppercase tracking-widest text-highlight-gold">Vala Sub-Routine // Treasury &amp; Fiscal Ledger</p>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-text-mana">Treasure Ledger &amp; Milestone Billing</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateToDashboard}
            className="flex items-center gap-1.5 rounded border border-accent-teal px-3 py-1.5 font-display text-xs text-text-mana hover:bg-accent-teal/20"
          >
            <i className="fa-solid fa-diagram-project" />
            <span>Return to Tactical Canvas</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-accent-teal bg-primary-plum/30 p-4">
          <p className="font-mono text-hud-3 uppercase text-text-mana/60">Total Pipeline Value</p>
          <p className="font-display text-2xl font-bold text-highlight-gold mt-1">
            {currencyFormatter.format(totalPipelineValue)}
          </p>
          <p className="font-mono text-hud-3 text-accent-teal mt-1">{units.length} clients · Finances roll-up</p>
        </div>

        <div className="rounded-xl border border-accent-teal bg-primary-plum/30 p-4">
          <p className="font-mono text-hud-3 uppercase text-text-mana/60">Cleared Deposits (1/3)</p>
          <p className="font-display text-2xl font-bold text-text-mana mt-1">
            {currencyFormatter.format(totalPaidDeposits)}
          </p>
          <p className="font-mono text-hud-3 text-text-mana/70 mt-1">{paidDeposits.length} clients cleared the stage 04 gate deposit</p>
        </div>

        <div className="rounded-xl border border-accent-teal bg-primary-plum/30 p-4">
          <p className="font-mono text-hud-3 uppercase text-text-mana/60">Deposits Due (Iron Gate Blocked)</p>
          <p className="font-display text-2xl font-bold text-alert-orange mt-1">
            {currencyFormatter.format(totalPendingDeposits)}
          </p>
          <p className="font-mono text-hud-3 text-alert-orange mt-1">{pendingDeposits.length} contracted clients awaiting the deposit</p>
        </div>
      </div>

      {/* Main Section: Ledger Table + Invoice Drafter */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-accent-teal bg-primary-plum/20 p-4">
          <div className="flex items-center justify-between mb-3 border-b border-accent-teal/40 pb-2">
            <h2 className="font-display text-sm font-bold text-highlight-gold uppercase tracking-wide">
              Master Control Fiscal Reconciliation Ledger
            </h2>
            <span className="font-mono text-hud-3 text-accent-teal">THE IRON GATE AUDIT</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-accent-teal/40 text-text-mana/60 text-hud-3 uppercase">
                  <th className="py-2 px-2">Client Entity</th>
                  <th className="py-2 px-2">Contract Value</th>
                  <th className="py-2 px-2">Deposit (1/3)</th>
                  <th className="py-2 px-2">Iron Gate Status</th>
                  <th className="py-2 px-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent-teal/20">
                {units.map((client) => {
                  const isSelected = client.ClientID === currentClient?.ClientID;
                  const deposit = depositOf(client);
                  const hasContract = (client.ContractValue || 0) > 0;
                  const sheetMismatch = client.ContractValueSource === 'finances'
                    && client.SheetContractValue !== undefined
                    && Math.round(client.SheetContractValue * 100) !== Math.round(client.ContractValue * 100);
                  return (
                    <tr
                      key={client.ClientID}
                      onClick={() => onSelectUnit(client.ClientID)}
                      className={`hover:bg-primary-plum/40 cursor-pointer transition-colors ${
                        isSelected ? 'bg-accent-teal/20 font-bold text-highlight-gold' : 'text-text-mana/80'
                      }`}
                    >
                      <td className="py-2.5 px-2">
                        <span className="block font-bold">{client.Company_Name || client.ClientID}</span>
                        <span className="text-hud-2 text-text-mana/50">{client.ClientID} · {advancedStage(client)}</span>
                      </td>
                      <td className="py-2.5 px-2">
                        {currencyFormatter.format(client.ContractValue || 0)}
                        {sheetMismatch && (
                          <span className="block text-hud-2 text-alert-orange">Sheet: {currencyFormatter.format(client.SheetContractValue ?? 0)}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 font-bold">{hasContract ? currencyFormatter.format(deposit) : '—'}</td>
                      <td className="py-2.5 px-2">
                        <span className={`px-2 py-0.5 rounded text-hud-3 font-bold ${
                          !hasContract
                            ? 'bg-text-mana/10 text-text-mana/60'
                            : client.DepositPaid ? 'bg-text-mana/20 text-text-mana' : 'bg-alert-orange/20 text-alert-orange'
                        }`}>
                          {!hasContract ? 'NO CONTRACT' : client.DepositPaid ? 'CLEARED (TRUE)' : 'GATED (UNPAID)'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectUnit(client.ClientID);
                            onLogTerminal(`Deposit figure for ${client.Company_Name || client.ClientID}: ${currencyFormatter.format(deposit)} (no invoice was created).`, 'action');
                          }}
                          className="px-2 py-1 rounded border border-highlight-gold/50 text-hud-3 text-highlight-gold hover:bg-highlight-gold/20"
                        >
                          Draft
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-accent-teal bg-primary-plum/30 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-accent-teal/40 pb-2">
              <h3 className="font-display text-sm font-bold text-text-mana">Milestone Invoice Builder</h3>
              <span className="font-mono text-hud-3 text-highlight-gold">VALA DRAFTER</span>
            </div>

            <p className="font-mono text-xs text-text-mana/70 mb-3">
              Target: <span className="font-bold text-highlight-gold">{currentClient?.Company_Name || '—'}</span> ({currentClient?.ClientID ?? '—'})
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-hud-3 text-accent-teal uppercase mb-1">Milestone Tranche</label>
                <div className="grid grid-cols-3 gap-1">
                  {TRANCHES.map((candidate) => (
                    <button
                      key={candidate.key}
                      type="button"
                      onClick={() => setInvoiceType(candidate.key)}
                      className={`p-1.5 rounded border text-hud-3 ${invoiceType === candidate.key ? 'border-highlight-gold bg-highlight-gold/20 text-highlight-gold font-bold' : 'border-accent-teal/40 text-text-mana/60'}`}
                    >
                      {candidate.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-bg-obsidian border border-accent-teal/30 space-y-1.5">
                <div className="flex justify-between text-text-mana/70">
                  <span>Contract Baseline:</span>
                  <span className="text-text-mana">{currencyFormatter.format(currentClient?.ContractValue || 0)}</span>
                </div>
                <div className="flex justify-between text-text-mana/70">
                  <span>Tranche:</span>
                  <span className="text-text-mana">1/3{tranche.index === 2 ? ' (remainder)' : ''}</span>
                </div>
                <div className="flex justify-between border-t border-accent-teal/30 pt-1.5 text-highlight-gold font-bold">
                  <span>Draft Total:</span>
                  <span>{currencyFormatter.format(draftTotal)}</span>
                </div>
              </div>

              <div className="text-hud-3 text-text-mana/50 italic">
                * Invoices are created by Master Control when a project reaches stage 02, 06 or 08. This preview creates nothing.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onLogTerminal(`Vala preview for ${currentClient?.Company_Name || currentClient?.ClientID}: ${tranche.label} ${currencyFormatter.format(draftTotal)} (no invoice was created).`, 'action')}
            className="mt-4 w-full rounded border border-highlight-gold bg-highlight-gold/20 py-2.5 font-display text-xs font-bold text-highlight-gold hover:bg-highlight-gold/30 transition-colors"
          >
            <i className="fa-solid fa-file-invoice-dollar mr-1.5" />
            Preview Invoice Amount
          </button>
        </div>
      </div>
    </main>
  );
};
