import React from 'react';
import type { ClientCommsHandlers, ClientSendState } from '../../types';

export const sentTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const ACTIVE_STEPS: ClientSendState['step'][] = ['loading', 'preview', 'sending'];

/** The project whose Daisy draft is open (loading, preview or posting), if any. */
export function activeClientSend(comms: ClientCommsHandlers | undefined): string | null {
  if (!comms) return null;
  return Object.keys(comms.states).find((projectId) => ACTIVE_STEPS.includes(comms.states[projectId].step)) ?? null;
}

/**
 * Plan v3.1 E5, owner layout decision 2026-11-05: Daisy's editable preview opens as an overlay in the Alfred Core bay
 * (same pattern as the Vitals overlay). State lives in App; the Alfred bay stays open while a draft is active.
 */
export const SendToClientOverlay: React.FC<{ projectId: string; comms: ClientCommsHandlers }> = ({ projectId, comms }) => {
  const state = comms.states[projectId];
  if (!state || (state.step !== 'loading' && state.step !== 'preview' && state.step !== 'sending')) return null;
  const last = state.lastSent;
  return (
    <div className="absolute inset-0 z-30 flex flex-col gap-1.5 overflow-hidden rounded-xl border-2 border-[#E0CA3C] bg-[#020500]/98 p-3 font-mono text-xs text-[#DDFBD0] shadow-[0_8px_32px_rgba(0,0,0,0.95)]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#086375]/50 pb-1.5">
        <span className="font-display text-sm font-bold text-[#E0CA3C]">Daisy · Send to client · {projectId}</span>
        {state.step === 'preview' || state.step === 'sending'
          ? <span className="text-hud-3 text-[#DDFBD0]/60">client Chat Space{state.overdue ? ` · ${state.overdue} overdue` : ''}</span>
          : null}
      </div>
      {state.step === 'loading' ? (
        <p className="text-hud-4 text-[#DDFBD0]/60">Daisy is drafting…</p>
      ) : (
        <>
          {last && <p className="text-hud-4 text-amber-400">Already sent {sentTime(last.at)}. Confirming posts another message.</p>}
          {state.warnings.map((warning) => <p key={warning} className="text-hud-4 text-amber-400">{warning}</p>)}
          <textarea
            aria-label={`Message to ${projectId} client`}
            value={state.text}
            disabled={state.step === 'sending'}
            onChange={(event) => comms.edit(projectId, event.target.value)}
            className="min-h-0 w-full flex-1 resize-none rounded border border-[#086375]/50 bg-[#020500] p-2 font-mono text-hud-4 leading-relaxed text-[#DDFBD0]"
          />
          <label className={`flex shrink-0 items-start gap-2 rounded border px-2 py-1 text-hud-4 ${state.final ? 'border-[#FE5F00] text-[#FE5F00]' : 'border-[#086375]/50 text-[#DDFBD0]/80'} ${state.finalAllowed ? 'cursor-pointer' : 'opacity-60'}`}
            title={state.finalAllowed ? 'After posting, move the client folder from Sanctum Active to Sanctum Inactive' : state.finalReason}>
            <input type="checkbox" className="mt-0.5 accent-[#FE5F00]" checked={state.final} disabled={!state.finalAllowed || state.step === 'sending'}
              onChange={(event) => comms.setFinal(projectId, event.target.checked)} aria-label="Final message: archive the client folder after posting" />
            <span>
              Final message: archive the client folder to Sanctum Inactive after posting
              {!state.finalAllowed && state.finalReason && <span className="block text-hud-3 text-[#DDFBD0]/55">{state.finalReason}</span>}
            </span>
          </label>
          {state.step === 'preview' && state.error && <p className="text-hud-4 text-red-400">Not sent: {state.error}</p>}
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => comms.send(projectId)} disabled={state.step === 'sending' || !state.text.trim()} className="rounded bg-[#E0CA3C] px-2.5 py-1 text-hud-4 font-bold text-[#020500] disabled:opacity-50">
              {state.step === 'sending' ? 'Posting…' : state.final ? 'Confirm, post and archive' : 'Confirm and post'}
            </button>
            <button type="button" onClick={() => comms.close(projectId)} disabled={state.step === 'sending'} className="rounded border border-[#086375]/60 px-2.5 py-1 text-hud-4 text-[#DDFBD0]/75 disabled:opacity-50">
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
};
