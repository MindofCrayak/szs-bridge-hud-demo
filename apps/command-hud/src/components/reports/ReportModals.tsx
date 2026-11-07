import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import type { AlfredAlert, ClientRecord } from '../../types';
import type { ProjectTaskSummary } from '../../data/api';
import { DropConfirmDialog } from '../canvas/workbench/DropConfirmDialog';
import { buildStatusSummary, invoiceRows } from '../../reports/statusSummary';

/** Phase G3 reports. Modals only (opened from the client context menu or a Dispatch proposal); nothing always visible. */

const money = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

const Shell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => ReactDOM.createPortal(
  <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={title}
    onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl border-2 border-[#086375] bg-[#020500] p-4 font-mono text-xs text-[#DDFBD0] shadow-2xl">
      <div className="mb-2 flex items-center justify-between border-b border-[#086375]/50 pb-2">
        <h2 className="font-display text-sm font-bold text-[#E0CA3C]">{title}</h2>
        <button type="button" onClick={onClose} autoFocus className="rounded border border-[#086375]/60 px-2 py-0.5 text-hud-3 hover:border-[#E0CA3C]">Close</button>
      </div>
      <div className="min-h-0 overflow-auto">{children}</div>
    </div>
  </div>,
  document.body,
);

export const StatusSummaryModal: React.FC<{
  client: ClientRecord;
  alerts: readonly AlfredAlert[];
  taskSummaries: Readonly<Record<string, ProjectTaskSummary>>;
  onClose: () => void;
}> = ({ client, alerts, taskSummaries, onClose }) => {
  const summary = buildStatusSummary(client, alerts, taskSummaries);
  const [copied, setCopied] = useState(false);
  return (
    <Shell title={`Status summary · ${summary.title}`} onClose={onClose}>
      <p className="mb-2 text-hud-3 text-[#DDFBD0]/50">Read-only. Built from the data loaded in the HUD; nothing is sent or written.</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-hud-4">
        <dt className="text-[#DDFBD0]/50">Phase</dt><dd>{summary.phase}</dd>
        <dt className="text-[#DDFBD0]/50">Contract</dt><dd>{money(summary.contract)} · deposit {summary.deposit}</dd>
        <dt className="text-[#DDFBD0]/50">Balance</dt><dd>{summary.balance === null ? '—' : money(summary.balance)}</dd>
        <dt className="text-[#DDFBD0]/50">Invoices</dt><dd>{summary.invoices.paid} paid · {summary.invoices.open} open ({money(summary.invoices.openAmount)})</dd>
      </dl>
      <h3 className="mt-3 font-bold text-[#E0CA3C]">Projects</h3>
      <ul className="mt-1 space-y-1 text-hud-4">
        {summary.projects.map((project) => (
          <li key={project.id} className="rounded border border-[#086375]/30 px-2 py-1">
            <div className="font-bold">{project.id} · {project.name}</div>
            <div className="text-[#DDFBD0]/70">{project.stage} · tasks {project.tasks} · hours {project.hours}</div>
          </li>
        ))}
      </ul>
      <h3 className="mt-3 font-bold text-[#E0CA3C]">Open alerts ({summary.openAlerts.length})</h3>
      <ul className="mt-1 space-y-0.5 text-hud-4">
        {summary.openAlerts.map((alert, index) => <li key={index}><span className="text-amber-400">{alert.severity}</span> {alert.message}</li>)}
        {summary.openAlerts.length === 0 && <li className="text-[#DDFBD0]/40">None.</li>}
      </ul>
      <button type="button" className="mt-3 rounded border border-[#E0CA3C]/60 px-2 py-0.5 text-hud-3 text-[#E0CA3C]"
        onClick={() => { void navigator.clipboard?.writeText(summary.text).then(() => setCopied(true), () => setCopied(false)); }}>
        {copied ? 'Copied' : 'Copy as text'}
      </button>
    </Shell>
  );
};

/**
 * Invoice draft: pick an invoice row, then the existing Financial Mutation confirmation (unchanged), then the audited
 * draftInvoice write. The draft copies the invoice template into the client's Drive folder; no sheet value changes,
 * so the dialog's ledger delta is $0.
 */
export const InvoiceDraftModal: React.FC<{
  client: ClientRecord;
  onDraft: (invoiceId: string) => Promise<{ url: string; name: string }>;
  onClose: () => void;
  /** Shown above the list when opened from a Dispatch proposal. */
  reason?: string;
}> = ({ client, onDraft, onClose, reason }) => {
  const invoices = invoiceRows(client);
  const [picked, setPicked] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ url: string; name: string } | null>(null);
  const invoice = invoices.find((row) => row.InvoiceID === picked);

  return (
    <>
      <Shell title={`Draft invoice · ${client.Company_Name || client.ClientID}`} onClose={onClose}>
        {reason && <p className="mb-2 rounded border border-[#FE5F00]/40 px-2 py-1 text-hud-3 text-[#FE5F00]">{reason}</p>}
        {done ? (
          <p className="text-hud-4 text-emerald-400">
            Drafted <a href={done.url} target="_blank" rel="noreferrer" className="text-[#E0CA3C] hover:underline">{done.name} ↗</a> in the client folder.
          </p>
        ) : (
          <>
            <p className="mb-2 text-hud-3 text-[#DDFBD0]/50">Pick an invoice. A copy of the invoice template is created in the client&apos;s Drive folder after you confirm.</p>
            <ul className="space-y-1">
              {invoices.map((row) => (
                <li key={row.InvoiceID}>
                  <button type="button" onClick={() => { setError(null); setPicked(row.InvoiceID); }}
                    className="flex w-full justify-between gap-2 rounded border border-[#086375]/40 px-2 py-1 text-left text-hud-4 hover:border-[#E0CA3C]">
                    <span>{row.InvoiceID} · {row.ProjectID} · {row.MilestoneStage || ''}</span>
                    <span>{money(row.Amount)} {row.Status}</span>
                  </button>
                </li>
              ))}
              {invoices.length === 0 && <li className="text-[#DDFBD0]/40">This client has no invoice rows in Finances.</li>}
            </ul>
          </>
        )}
      </Shell>
      <DropConfirmDialog
        isOpen={Boolean(invoice) && !done}
        onCancel={() => { if (!submitting) { setPicked(null); setError(null); } }}
        onConfirm={async () => {
          if (!invoice) return;
          setSubmitting(true);
          setError(null);
          try {
            setDone(await onDraft(invoice.InvoiceID));
            setPicked(null);
          } catch (draftError) {
            setError(draftError instanceof Error ? draftError.message : 'Master Control returned an unknown error.');
          } finally {
            setSubmitting(false);
          }
        }}
        serviceName={invoice ? `Invoice draft ${invoice.InvoiceID} (${money(invoice.Amount)}, no ledger change)` : ''}
        priceDelta={0}
        currentValue={client.ContractValue || 0}
        targetClientName={client.Company_Name}
        isSubmitting={submitting}
        errorMessage={error}
      />
    </>
  );
};

export type BlockerOp =
  | { kind: 'add'; note: string; projectId?: string }
  | { kind: 'remove'; alertId: string }
  | { kind: 'clear' };

/**
 * Flag Blocker (owner 2026-11-06): a client can have several blockers; each is listed with its own Remove button.
 * Every change is one audited setBlocker write.
 */
export const FlagBlockerModal: React.FC<{
  client: ClientRecord;
  projectId?: string;
  blockers: { id: string; note: string }[];
  onChange: (op: BlockerOp) => Promise<void>;
  onClose: () => void;
}> = ({ client, projectId, blockers, onChange, onClose }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A roadblock typed in the sheet before blockers were alerts has no alert row; it can only be cleared as a whole.
  const legacy = blockers.length === 0 ? client.roadblock?.trim() ?? '' : '';
  const run = async (key: string, op: BlockerOp) => {
    setBusy(key);
    setError(null);
    try {
      await onChange(op);
      if (op.kind === 'add') setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  const add = () => { if (note.trim()) void run('add', { kind: 'add', note: note.trim(), projectId }); };
  return (
    <Shell title={`Blockers · ${client.Company_Name || client.ClientID}${projectId ? ` · ${projectId}` : ''}`} onClose={onClose}>
      <p className="mb-2 text-hud-3 text-[#DDFBD0]/60">
        Each blocker is saved as a BLOCK alert in Dolores&apos; feed, and all of them show as the client&apos;s roadblock in the inspector. Remove each one when it is solved.
      </p>
      <ul className="mb-3 space-y-1" aria-label="Open blockers">
        {blockers.length === 0 && !legacy && <li className="text-hud-4 text-emerald-300/80">No open blockers.</li>}
        {blockers.map((blocker) => (
          <li key={blocker.id} className="flex items-start gap-2 rounded border border-[#FE5F00]/40 bg-[#FE5F00]/5 px-2 py-1">
            <i className="fa-solid fa-triangle-exclamation mt-0.5 text-[#FE5F00]" aria-hidden="true" />
            <span className="min-w-0 flex-1 break-words text-hud-4">{blocker.note}</span>
            <button type="button" disabled={busy !== null} onClick={() => { void run(blocker.id, { kind: 'remove', alertId: blocker.id }); }}
              aria-label={`Remove blocker: ${blocker.note}`}
              className="shrink-0 rounded border border-emerald-400/60 px-2 py-0.5 text-hud-3 text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-40">
              {busy === blocker.id ? 'Removing…' : 'Remove'}
            </button>
          </li>
        ))}
        {legacy && (
          <li className="flex items-start gap-2 rounded border border-[#E0CA3C]/40 px-2 py-1">
            <span className="min-w-0 flex-1 break-words text-hud-4">{legacy} <span className="text-hud-3 text-[#DDFBD0]/50">(typed in the sheet)</span></span>
            <button type="button" disabled={busy !== null} onClick={() => { void run('clear', { kind: 'clear' }); }}
              className="shrink-0 rounded border border-emerald-400/60 px-2 py-0.5 text-hud-3 text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-40">
              {busy === 'clear' ? 'Clearing…' : 'Clear'}
            </button>
          </li>
        )}
      </ul>
      <label className="mb-1 block text-hud-3 text-[#DDFBD0]/70" htmlFor="blocker-note">Add a blocker</label>
      <textarea id="blocker-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2}
        onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); add(); } }}
        placeholder="e.g. Waiting on DNS access from the client"
        className="w-full rounded border border-[#086375]/60 bg-black/40 p-2 text-hud-4 text-[#DDFBD0] focus:border-[#E0CA3C] focus:outline-none" />
      {error && <p className="mt-2 text-hud-4 text-red-400" role="alert">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy !== null || !note.trim()} onClick={add}
          className="rounded border border-[#FE5F00]/70 px-3 py-1 text-hud-4 text-[#FE5F00] hover:bg-[#FE5F00]/10 disabled:opacity-40">
          {busy === 'add' ? 'Saving…' : 'Add blocker'}
        </button>
        {blockers.length > 1 && (
          <button type="button" disabled={busy !== null} onClick={() => { void run('clear', { kind: 'clear' }); }}
            className="rounded border border-emerald-400/60 px-3 py-1 text-hud-4 text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-40">
            {busy === 'clear' ? 'Clearing…' : `Remove all ${blockers.length}`}
          </button>
        )}
        <span className="text-hud-3 text-[#DDFBD0]/45">Ctrl+Enter adds</span>
      </div>
    </Shell>
  );
};
