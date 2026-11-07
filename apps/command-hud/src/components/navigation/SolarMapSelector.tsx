import React, { useState, useRef, useEffect } from 'react';
import type { ClientRecord } from '../../types';

/**
 * Owner 2026-11-06: the separate "SOLAR MAP // client" box crowded the ribbon. It is now a ▾ dropdown fixed to
 * the SOLAR button in the main navigation: pick a client and Solar opens on it.
 */
export const SolarMapSelector: React.FC<{
  clients: ClientRecord[];
  activeClientId: string | null;
  onSelectClient: (client: ClientRecord) => void;
}> = ({ clients = [], activeClientId, onSelectClient }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Pick a client for Solar"
        title="Pick a client for Solar"
        className={`rounded px-1.5 py-1 text-hud-3 ${isOpen ? 'bg-[#086375]/50 text-[#E0CA3C]' : 'text-[#DDFBD0]/70 hover:bg-[#086375]/40 hover:text-[#E0CA3C]'}`}
      >
        <i className={`fa-solid fa-chevron-down text-hud-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div role="menu" aria-label="Clients" className="absolute left-1/2 top-full z-50 mt-1.5 max-h-80 w-72 -translate-x-1/2 overflow-y-auto rounded-lg border border-[#086375] bg-[#020500]/98 p-1 font-mono text-xs shadow-2xl">
          <div className="flex justify-between border-b border-[#086375]/30 px-2 py-1 text-hud-2 uppercase tracking-wider text-[#DDFBD0]/60">
            <span>Open in Solar</span>
            <span className="text-[#E0CA3C]">keys 1..9</span>
          </div>
          {clients.length === 0 ? (
            <div className="p-3 text-center text-hud-3 text-[#DDFBD0]/40">No clients loaded</div>
          ) : (
            clients.map((client, idx) => {
              const isCurrent = client.ClientID === activeClientId;
              return (
                <button
                  key={client.ClientID}
                  type="button"
                  role="menuitem"
                  onClick={() => { onSelectClient(client); setIsOpen(false); }}
                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left ${
                    isCurrent ? 'border-l-2 border-[#E0CA3C] bg-[#086375]/40 font-bold text-[#E0CA3C]' : 'text-[#DDFBD0]/80 hover:bg-[#086375]/20 hover:text-white'
                  }`}
                >
                  <span className="mr-2 min-w-0 flex-1">
                    <span className="block truncate text-hud-4 font-bold">{client.Company_Name || client.ClientID}</span>
                    <span className="block text-hud-2 text-[#DDFBD0]/50">{client.ClientID} · {client.AccountPhase}</span>
                  </span>
                  {idx < 9 && (
                    <kbd className="shrink-0 rounded border border-[#086375]/60 bg-[#086375]/40 px-1 text-hud-2 font-bold text-[#DDFBD0]/60">{idx + 1}</kbd>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
