import React from 'react';
import { HudTelemetry, TerminalLog } from '../../types';
import { AdapterStatus } from '../../data/adapter';
import type { RejectedSnapshotRow } from '../../data/snapshotData';

interface BottomStatusStripProps {
  telemetry: HudTelemetry | null;
  isBackendConnected: boolean;
  latestLog: TerminalLog | null;
  adapterStatus: AdapterStatus;
  rejectedRows: RejectedSnapshotRow[];
  localDraftCount: number;
  localStateError: string | null;
  dataSourceReason?: string | null;
  writeError?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Open Police/Housekeeping alerts (real count; was a fixed "NOMINAL"). */
  policeOpen?: number;
  activeClients?: number;
}

export const BottomStatusStrip: React.FC<BottomStatusStripProps> = ({
  telemetry,
  isBackendConnected,
  latestLog,
  adapterStatus,
  rejectedRows,
  localDraftCount,
  localStateError,
  dataSourceReason,
  writeError,
  onRefresh,
  refreshing = false,
  policeOpen = 0,
  activeClients = 0,
}) => {
  const [showRejectedRows, setShowRejectedRows] = React.useState(false);
  return (
    <div className="relative h-[24px] shrink-0 border-t border-[#086375]/40 bg-[#020500]/95 px-3 flex items-center justify-between font-mono text-hud-2 text-[#DDFBD0]/70 select-none z-20">
      {/* Left: Backend & Police Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isBackendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[#DDFBD0]/90 font-bold">
            {isBackendConnected ? 'BRIDGE CONNECTED' : 'OFFLINE'}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-[#086375]">
          <span>|</span>
        </div>
        <div
          className="flex items-center gap-1.5"
          title={`Typed data adapter status: ${adapterStatus}`}
          aria-label={`Typed data adapter status: ${adapterStatus}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${
            adapterStatus === 'live' ? 'bg-emerald-400' : adapterStatus === 'mock' ? 'bg-[#E0CA3C]'
              : adapterStatus === 'snapshot' ? 'bg-[#3C91E6]' : 'bg-[#FE5F00]'
          }`} />
          <span>DATA {adapterStatus.toUpperCase()}</span>
        </div>
        {onRefresh && !['snapshot', 'mock'].includes(adapterStatus) && (
          <button
            type="button"
            className="text-[#DDFBD0]/80 hover:text-white disabled:cursor-wait disabled:opacity-50"
            aria-label="Refresh Master Control data"
            disabled={refreshing}
            onClick={onRefresh}
          >
            {refreshing ? 'REFRESHING…' : 'REFRESH'}
          </button>
        )}
        {dataSourceReason && ['live', 'stale', 'offline'].includes(adapterStatus) && (
          <span
            className="max-w-72 truncate text-alert-orange"
            title={dataSourceReason}
            role="status"
          >
            {adapterStatus === 'stale' ? 'SNAPSHOT FALLBACK: '
              : adapterStatus === 'offline' ? 'LIVE READ ISSUE: ' : 'LIVE DATA NOTE: '}
            {dataSourceReason}
          </span>
        )}
        {writeError && (
          <span className="max-w-72 truncate text-alert-orange" title={writeError} role="status">
            WRITE ISSUE
          </span>
        )}
        <button
          type="button"
          className="text-alert-orange hover:text-[#ff9a54] disabled:cursor-default disabled:text-[#DDFBD0]/60"
          aria-expanded={showRejectedRows}
          aria-label={`${rejectedRows.length} rejected data rows`}
          onClick={() => rejectedRows.length > 0 && setShowRejectedRows((visible) => !visible)}
          disabled={rejectedRows.length === 0}
        >
          REJECTED {rejectedRows.length}
        </button>
        {adapterStatus === 'snapshot' && (
          <span title="These snapshot moves are saved only in this browser; they are not written to Master Control." className="text-[#E0CA3C]">
            {localDraftCount} LOCAL CHANGES NOT IN SHEET
          </span>
        )}
        {localStateError && (
          <span className="max-w-64 truncate text-alert-orange" title={localStateError} role="status">
            LOCAL SAVE ISSUE
          </span>
        )}
        {showRejectedRows && rejectedRows.length > 0 && (
          <div
            role="dialog"
            aria-label="Rejected CSV rows"
            className="absolute bottom-full left-2 z-50 mb-2 max-h-64 w-[min(32rem,90vw)] overflow-auto rounded border border-alert-orange/60 bg-[#020500] p-3 text-left text-hud-4 shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between font-bold text-alert-orange">
              <span>Rejected CSV rows</span>
              <button type="button" onClick={() => setShowRejectedRows(false)} aria-label="Close rejected rows">Close</button>
            </div>
            <ul className="space-y-2">
              {rejectedRows.map((row) => (
                <li key={`${row.fileName}-${row.rowNumber}`} className="border-t border-[#086375]/40 pt-2">
                  <span className="font-bold text-[#DDFBD0]">{row.fileName}, row {row.rowNumber}:</span>{' '}
                  <span>{row.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="hidden sm:flex items-center gap-1.5" title="Open Police and Housekeeping alerts (data checks that need a look)">
          <span className={`w-1.5 h-1.5 rounded-full ${policeOpen ? 'bg-[#FE5F00]' : 'bg-emerald-400'}`} />
          <span className={policeOpen ? 'text-alert-orange' : undefined}>POLICE {policeOpen ? `${policeOpen} OPEN` : 'CLEAR'}</span>
        </div>
      </div>

      {latestLog && (
        <div
          className="hidden min-w-0 flex-1 truncate px-4 text-text-mana/55 lg:block"
          title={latestLog.text}
          aria-label={`Latest activity at ${latestLog.time}`}
        >
          <span className="text-highlight-gold">{latestLog.time}</span> {latestLog.text}
        </div>
      )}

      {/* Right: Key Metrics Strip */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-[#DDFBD0]/50">PIPELINE:</span>
          <span className="text-[#E0CA3C] font-bold">
            ${telemetry ? (telemetry.pipelineMrr ?? 0).toLocaleString() : '0'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[#DDFBD0]/50">SPRINTS:</span>
          <span className="text-[#3C91E6] font-bold">
            {telemetry ? telemetry.activeSprints : 0}
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1">
          <span className="text-[#DDFBD0]/50">CLIENTS:</span>
          <span className="text-[#DDFBD0]/90 font-bold">{activeClients}</span>
        </div>
      </div>
    </div>
  );
};
