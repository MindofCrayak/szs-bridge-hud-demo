import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { fetchServiceRemovalPreview, writeMasterControl, type MasterControlWriteResult, type ServiceRemovalPreview } from '../../../data/api';

/**
 * Remove a service from a project (owner decisions 2026-11-06). The money confirmation stays as explicit as the
 * attach dialog (DropConfirmDialog is unchanged): Master Control previews the exact change first, nothing is
 * written until the owner presses Remove.
 */
interface ServiceRemovalDialogProps {
  accessToken: string;
  clientName: string;
  projectId: string;
  serviceId: string;
  serviceName: string;
  price: number;
  onCancel: () => void;
  onRemoved: (result: MasterControlWriteResult) => void;
}

const money = (value: number | null) => (value === null ? '—' : `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

export const ServiceRemovalDialog: React.FC<ServiceRemovalDialogProps> = ({
  accessToken, clientName, projectId, serviceId, serviceName, price, onCancel, onRemoved,
}) => {
  const [preview, setPreview] = useState<ServiceRemovalPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchServiceRemovalPreview(accessToken, projectId, serviceId, price)
      .then((result) => { if (live) setPreview(result); })
      .catch((error: unknown) => { if (live) setLoadError(error instanceof Error ? error.message : String(error)); });
    return () => { live = false; };
  }, [accessToken, projectId, serviceId, price]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) { event.preventDefault(); onCancel(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [saving, onCancel]);

  const confirm = async () => {
    if (!globalThis.crypto?.randomUUID) { setSaveError('This browser cannot create a secure write request ID.'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await writeMasterControl(accessToken, 'removeService', { projectId, serviceId, price }, globalThis.crypto.randomUUID());
      const remaining = result.after.activeComponents;
      if (!Array.isArray(remaining) || remaining.includes(serviceId)) throw new Error('Master Control did not confirm the service was removed.');
      onRemoved(result);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const row = (label: string, value: React.ReactNode, strong = false) => (
    <div className={`flex items-center justify-between gap-3 text-xs ${strong ? 'font-bold text-[#E0CA3C]' : ''}`}>
      <span className="text-[#DDFBD0]/70">{label}</span><span className="font-mono text-white">{value}</span>
    </div>
  );

  return ReactDOM.createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="service-removal-title"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 font-mono backdrop-blur-sm">
      <div className="w-full max-w-[440px] rounded-2xl border-2 border-[#FE5F00] bg-[#020500] p-5 text-[#DDFBD0] shadow-[0_0_50px_rgba(254,95,0,0.4)]">
        <div className="mb-3 border-b border-[#FE5F00]/40 pb-2">
          <h3 id="service-removal-title" className="font-display text-sm font-bold uppercase tracking-wide text-white">Remove service from project</h3>
          <p className="text-hud-3 font-bold text-[#FE5F00]">{clientName} · {projectId}</p>
        </div>
        <p className="mb-3 text-hud-3 text-[#DDFBD0]/70">
          Try to save or adapt the service first. Removing it takes its price off the <b>final invoice</b> (deposit and mid-flight stay as they are)
          and deletes its open Google Tasks. Completed tasks stay as history.
        </p>

        {!preview && !loadError && <p className="mb-3 text-hud-3 text-[#DDFBD0]/60">Asking Master Control what would change…</p>}
        {loadError && <p role="alert" className="mb-3 rounded border border-red-500/50 bg-red-950/30 p-2 text-xs text-red-200">Preview failed: {loadError}</p>}
        {preview && !preview.ok && (
          <p role="alert" className="mb-3 rounded border border-red-500/50 bg-red-950/30 p-2 text-xs text-red-200">Cannot remove: {preview.reason}</p>
        )}
        {preview?.ok && (
          <div className="mb-3 space-y-1.5 rounded-xl border border-[#086375]/60 bg-[#0d1513] p-3">
            {row('Service', preview.serviceName || serviceName)}
            {row('Price', money(preview.price))}
            {preview.tcvBefore !== null ? (
              <>
                {row('Contract value', `${money(preview.tcvBefore)} → ${money(preview.tcvAfter)}`)}
                {row(`Final invoice${preview.finalInvoiceId ? ` (${preview.finalInvoiceId}, draft)` : ''}`, `${money(preview.finalBefore)} → ${money(preview.finalAfter)}`, true)}
                {preview.addendum && <p className="text-hud-3 text-[#DDFBD0]/60">Invoicing has started, so the change is written to the contract&apos;s AddendumRef.</p>}
              </>
            ) : row('Money', 'no change (free service)')}
            {row('Open tasks deleted', preview.hasTaskList ? String(preview.tasksToDelete) : 'no task list yet')}
            {preview.completedTasksKept > 0 && row('Completed tasks kept', String(preview.completedTasksKept))}
          </div>
        )}

        {saveError && <p role="alert" className="mb-3 rounded border border-red-500/50 bg-red-950/30 p-2 text-xs text-red-200">Not removed: {saveError}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={saving} autoFocus
            className="flex-1 rounded-lg border border-[#086375] py-2 text-xs font-bold text-[#DDFBD0]/80 hover:bg-[#086375]/30">
            Keep the service
          </button>
          <button type="button" onClick={() => { void confirm(); }} disabled={saving || !preview?.ok} aria-busy={saving}
            className="flex-1 rounded-lg border border-[#FE5F00] bg-[#FE5F00] py-2 text-xs font-bold text-black hover:bg-[#FE5F00]/80 disabled:opacity-40">
            {saving ? 'Removing…' : 'Remove service'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
