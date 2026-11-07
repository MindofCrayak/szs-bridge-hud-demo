import React, { useEffect, useState } from 'react';
import { ClientUnit } from '../../../apps/command-hud/src/types';

type TargetStatus = 'CANDIDATE' | 'VERIFIED' | 'TRACKED';

interface OracleTarget {
  id: string;
  name: string;
  url: string;
  status: TargetStatus;
  metrics: string;
  findings: string;
  notes: string;
}

interface OraclePanelProps {
  isOpen: boolean;
  activeUnit: ClientUnit | null;
  onClose: () => void;
  onLogTerminal: (message: string, type?: 'normal' | 'action' | 'server' | 'alert') => void;
}

const MACROS = [
  { command: '/recon', label: 'RECON', icon: 'fa-crosshairs' },
  { command: '/bracket', label: 'BRACKET', icon: 'fa-code-branch' },
  { command: '/whitespace', label: 'WHITESPACE', icon: 'fa-expand' },
  { command: '/finder', label: 'FINDER', icon: 'fa-magnifying-glass' },
  { command: '/tracker', label: 'TRACKER', icon: 'fa-crosshairs' },
  { command: '/gbp-audit', label: 'GBP AUDIT', icon: 'fa-location-dot' },
  { command: '/associates', label: 'ASSOCIATES', icon: 'fa-people-group' },
  { command: '/identify', label: 'IDENTIFY', icon: 'fa-fingerprint' },
  { command: '/sourcebook', label: 'SOURCEBOOK', icon: 'fa-book-open' },
] as const;

const STATUS_STYLES: Record<TargetStatus, string> = {
  CANDIDATE: 'border-amber-400/50 bg-amber-400/10 text-amber-300',
  VERIFIED: 'border-sky-400/50 bg-sky-400/10 text-sky-300',
  TRACKED: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300',
};

const getStatusIndex = (status: TargetStatus) =>
  ['CANDIDATE', 'VERIFIED', 'TRACKED'].indexOf(status);

export const OraclePanel: React.FC<OraclePanelProps> = ({
  isOpen,
  activeUnit,
  onClose,
  onLogTerminal,
}) => {
  const [targetsByClient, setTargetsByClient] = useState<Record<string, OracleTarget[]>>({});
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState<string[]>([
    'Oracle tactical console ready.',
    'Target and intelligence changes are held in memory until you reload.',
  ]);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [sourcebook, setSourcebook] = useState('');

  const clientId = activeUnit?.id;
  const targets = clientId ? targetsByClient[clientId] || [] : [];
  const selectedTarget = targets.find((target) => target.id === selectedTargetId) || null;

  useEffect(() => {
    setSelectedTargetId(null);
    setIsInspectorOpen(false);
    setSourcebook('');
  }, [clientId]);

  const writeOutput = (message: string) => {
    setOutput((previous) => [...previous.slice(-19), message]);
  };

  const updateTargets = (update: (current: OracleTarget[]) => OracleTarget[]) => {
    if (!clientId) return;
    setTargetsByClient((previous) => ({
      ...previous,
      [clientId]: update(previous[clientId] || []),
    }));
  };

  const updateTarget = (targetId: string, update: (target: OracleTarget) => OracleTarget) => {
    updateTargets((current) => current.map((target) => (
      target.id === targetId ? update(target) : target
    )));
  };

  const createSourcebook = () => {
    if (!activeUnit) {
      writeOutput('Select an active client before building a sourcebook.');
      return;
    }

    const reportTargets = targets.map((target) => [
      `${target.name} [${target.status}]${target.url ? ` — ${target.url}` : ''}`,
      target.metrics.trim() ? `Metrics:\n${target.metrics.trim()}` : '',
      target.findings.trim() ? `Findings:\n${target.findings.trim()}` : '',
    ].filter(Boolean).join('\n'));
    setSourcebook([
      `SOURCEBOOK — ${activeUnit.name}`,
      `Generated ${new Date().toLocaleString()}`,
      'Private notes are excluded from this client-facing preview.',
      '',
      ...(reportTargets.length ? reportTargets : ['No targets have been added.']),
    ].join('\n\n'));
    setIsInspectorOpen(true);
    writeOutput(`Sourcebook preview generated for ${activeUnit.name}.`);
    onLogTerminal(`Oracle sourcebook preview generated for ${activeUnit.name}.`, 'action');
  };

  const executeCommand = (rawCommand: string) => {
    const trimmedCommand = rawCommand.trim();
    if (!trimmedCommand) return;
    const [verb = '', ...args] = trimmedCommand.split(/\s+/);
    const targetId = args[0];

    switch (verb.toLowerCase()) {
      case '/target': {
        const targetValue = trimmedCommand.slice(verb.length).trim();
        if (!activeUnit) {
          writeOutput('Select an active client before adding a target.');
          return;
        }
        if (!targetValue) {
          writeOutput('Usage: /target <name or url>');
          return;
        }
        const isUrl = /^https?:\/\//i.test(targetValue);
        let targetUrl = '';
        let targetName = targetValue;
        if (isUrl) {
          try {
            const parsedUrl = new URL(targetValue);
            targetUrl = parsedUrl.href;
            targetName = parsedUrl.hostname;
          } catch {
            writeOutput('Invalid URL. Use a complete http:// or https:// address.');
            return;
          }
        }
        const target: OracleTarget = {
          id: `T-${Date.now().toString(36).toUpperCase()}`,
          name: targetName,
          url: targetUrl,
          status: 'CANDIDATE',
          metrics: '',
          findings: '',
          notes: '',
        };
        updateTargets((current) => [...current, target]);
        setSelectedTargetId(target.id);
        writeOutput(`Candidate added: ${target.name} (${target.id}).`);
        onLogTerminal(`Oracle candidate added for ${activeUnit.name}: ${target.name}.`, 'action');
        return;
      }
      case '/verify': {
        const target = targets.find((item) => item.id.toLowerCase() === targetId?.toLowerCase());
        if (!target) {
          writeOutput(targetId ? `Target not found: ${targetId}.` : 'Usage: /verify <target_id>');
          return;
        }
        if (target.status !== 'CANDIDATE') {
          writeOutput(`${target.id} is already ${target.status}.`);
          return;
        }
        updateTarget(target.id, (item) => ({ ...item, status: 'VERIFIED' }));
        setSelectedTargetId(target.id);
        writeOutput(`${target.name} verified. Use /scrape ${target.id} to mark it tracked.`);
        onLogTerminal(`Oracle target verified: ${target.name}.`, 'action');
        return;
      }
      case '/scrape': {
        const target = targets.find((item) => item.id.toLowerCase() === targetId?.toLowerCase());
        if (!target) {
          writeOutput(targetId ? `Target not found: ${targetId}.` : 'Usage: /scrape <target_id>');
          return;
        }
        if (target.status !== 'VERIFIED') {
          writeOutput(`${target.id} must be VERIFIED before it can be tracked.`);
          return;
        }
        updateTarget(target.id, (item) => ({ ...item, status: 'TRACKED' }));
        setSelectedTargetId(target.id);
        writeOutput(`${target.name} moved to TRACKED. No external data was fetched; a scrape connector is not configured.`);
        onLogTerminal(`Oracle target moved to tracked: ${target.name}; no external scrape connector is configured.`, 'action');
        return;
      }
      case '/audit': {
        if (args[0]?.toLowerCase() !== 'gbp' || !args[1]) {
          writeOutput('Usage: /audit gbp <target_id>');
          return;
        }
        if (!targets.some((target) => target.id.toLowerCase() === args[1].toLowerCase())) {
          writeOutput(`Target not found: ${args[1]}.`);
          return;
        }
        setSelectedTargetId(args[1]);
        writeOutput('GBP audit requested. The external audit connector is not configured; no data was fetched.');
        onLogTerminal(`Oracle GBP audit requested for target ${args[1]}; no external audit connector is configured.`, 'action');
        return;
      }
      case '/build': {
        if (args[0]?.toLowerCase() !== 'sourcebook') {
          writeOutput('Usage: /build sourcebook');
          return;
        }
        createSourcebook();
        return;
      }
      case '/finder':
      case '/recon':
        writeOutput(activeUnit
          ? `Recon invoked for ${activeUnit.name}. Discovery connector is not configured; add a candidate with /target <name or url>.`
          : 'Select an active client to use Oracle recon.');
        onLogTerminal(`Oracle recon invoked${activeUnit ? ` for ${activeUnit.name}` : ''}; discovery connector is not configured.`, 'action');
        return;
      case '/bracket':
      case '/whitespace':
        writeOutput(`${verb.slice(1)} invoked. The intelligence connector is not configured; no external data was fetched.`);
        onLogTerminal(`Oracle ${verb.slice(1)} invoked; intelligence connector is not configured.`, 'action');
        return;
      case '/tracker': {
        const verifiableTarget = selectedTarget?.status === 'VERIFIED'
          ? selectedTarget
          : targets.find((target) => target.status === 'VERIFIED');
        if (verifiableTarget) {
          executeCommand(`/scrape ${verifiableTarget.id}`);
        } else {
          writeOutput('Tracker invoked. Verify a candidate first with /verify <target_id>.');
        }
        return;
      }
      case '/gbp-audit':
        if (selectedTarget) executeCommand(`/audit gbp ${selectedTarget.id}`);
        else writeOutput('Select a target before running the GBP audit.');
        return;
      case '/associates':
      case '/identify':
        writeOutput(`${verb.slice(1)} invoked. This external integration is not configured.`);
        onLogTerminal(`Oracle ${verb.slice(1)} invoked; external integration is not configured.`, 'action');
        return;
      case '/sourcebook':
        createSourcebook();
        return;
      default:
        writeOutput('Unknown command. Try /target, /verify, /scrape, /audit gbp, or /build sourcebook.');
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    executeCommand(command);
    setCommand('');
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-accent-teal bg-[#04100c] shadow-[-20px_0_60px_rgba(0,0,0,0.55)] transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        aria-label="Oracle tactical panel"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-accent-teal/60 bg-gradient-to-r from-primary-plum/60 to-[#04100c] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-alert-orange/60 bg-alert-orange/10 text-alert-orange">
              <i className="fa-solid fa-eye" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold tracking-widest text-text-mana">ORACLE</h2>
              <p className="font-mono text-[0.62rem] uppercase tracking-wide text-text-mana/55">Tactical intelligence</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent-teal text-text-mana hover:border-alert-orange hover:text-alert-orange"
            aria-label="Close Oracle panel"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[0.62rem] uppercase tracking-wider text-text-mana/50">Active client</p>
              <p className="mt-1 truncate font-display text-sm font-semibold text-text-mana">
                {activeUnit?.name || 'No client selected'}
              </p>
            </div>
            <span className="shrink-0 rounded border border-accent-teal/60 px-2 py-1 font-mono text-[0.62rem] text-text-mana/65">
              {targets.length} TARGET{targets.length === 1 ? '' : 'S'}
            </span>
          </div>

          <section className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-text-mana">Target roster</h3>
              <div className="flex items-center gap-1 font-mono text-[0.55rem] text-text-mana/45">
                <span>CANDIDATE</span><i className="fa-solid fa-angle-right" />
                <span>VERIFIED</span><i className="fa-solid fa-angle-right" />
                <span>TRACKED</span>
              </div>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-accent-teal/50 bg-black/20 p-2">
              {!activeUnit ? (
                <p className="py-3 text-center font-mono text-xs text-text-mana/50">Select a client to view its targets.</p>
              ) : targets.length === 0 ? (
                <p className="py-3 text-center font-mono text-xs text-text-mana/50">No targets yet. Add one with <span className="text-alert-orange">/target</span>.</p>
              ) : targets.map((target) => (
                <button
                  type="button"
                  key={target.id}
                  onClick={() => setSelectedTargetId(target.id)}
                  className={`w-full rounded-lg border p-2 text-left transition-colors ${selectedTargetId === target.id ? 'border-alert-orange/70 bg-alert-orange/5' : 'border-accent-teal/30 bg-[#071610] hover:border-accent-teal'}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-display text-xs font-semibold text-text-mana">{target.name}</span>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[0.55rem] ${STATUS_STYLES[target.status]}`}>{target.status}</span>
                  </span>
                  <span className="mt-1 block truncate font-mono text-[0.62rem] text-text-mana/45">{target.url || target.id}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                if (!selectedTarget) {
                  writeOutput('Select a target to open its intelligence inspector.');
                  return;
                }
                setIsInspectorOpen(true);
              }}
              disabled={!selectedTarget}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-accent-teal/60 px-3 py-2 font-mono text-[0.68rem] uppercase tracking-wide text-text-mana/80 hover:border-alert-orange hover:text-alert-orange disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i className="fa-solid fa-sliders" /> Intelligence inspector
            </button>
          </section>

          <section className="mb-5">
            <h3 className="mb-2 font-display text-xs font-bold uppercase tracking-wider text-text-mana">Action macros</h3>
            <div className="grid grid-cols-3 gap-2">
              {MACROS.map((macro) => (
                <button
                  type="button"
                  key={macro.command}
                  onClick={() => executeCommand(macro.command)}
                  disabled={!activeUnit && macro.command !== '/sourcebook'}
                  className="flex min-h-[58px] flex-col items-center justify-center gap-1.5 rounded-lg border border-accent-teal/50 bg-accent-teal/10 px-1.5 py-2 font-mono text-[0.58rem] font-semibold tracking-wide text-text-mana/80 transition-colors hover:border-alert-orange hover:bg-alert-orange/10 hover:text-alert-orange disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className={`fa-solid ${macro.icon} text-sm text-alert-orange`} />
                  {macro.label}
                </button>
              ))}
            </div>
          </section>

          <section className="flex min-h-[210px] flex-1 flex-col rounded-xl border border-accent-teal/50 bg-black/25 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-text-mana">Terminal command line</h3>
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-label="Terminal ready" />
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto font-mono text-[0.68rem]" aria-live="polite">
              {output.map((line, index) => (
                <p key={`${index}-${line}`} className={line.startsWith('>') ? 'text-alert-orange' : 'text-text-mana/70'}>{line}</p>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2 border-t border-accent-teal/40 pt-3">
              <span className="font-mono text-sm text-alert-orange">&gt;</span>
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="/target <name or url>"
                aria-label="Oracle command"
                disabled={!isOpen}
                className="min-w-0 flex-1 bg-transparent font-mono text-xs text-text-mana outline-none placeholder:text-text-mana/35"
              />
              <button type="submit" disabled={!command.trim() || !isOpen} className="rounded-md bg-alert-orange px-2.5 py-1.5 font-mono text-[0.65rem] font-bold text-bg-obsidian disabled:opacity-40">RUN</button>
            </form>
            <p className="mt-2 font-mono text-[0.56rem] leading-relaxed text-text-mana/40">
              /target · /verify · /scrape · /audit gbp · /build sourcebook
            </p>
          </section>
        </div>

        <div
          className={`absolute inset-0 z-10 flex flex-col bg-[#04100c] transition-transform duration-300 ${isInspectorOpen ? 'translate-x-0' : 'translate-x-full'}`}
          aria-hidden={!isInspectorOpen}
        >
          <header className="flex shrink-0 items-center justify-between border-b border-accent-teal/60 bg-primary-plum/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setIsInspectorOpen(false)} className="flex h-8 w-8 items-center justify-center rounded border border-accent-teal text-text-mana hover:border-alert-orange" aria-label="Back to Oracle panel">
                <i className="fa-solid fa-arrow-left" />
              </button>
              <div>
                <h3 className="font-display text-sm font-bold text-text-mana">Intelligence Inspector</h3>
                <p className="font-mono text-[0.6rem] text-text-mana/55">{selectedTarget?.name || 'No target selected'}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded border border-accent-teal text-text-mana hover:border-alert-orange" aria-label="Close Oracle panel">
              <i className="fa-solid fa-xmark" />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {selectedTarget ? (
              <>
                <div className="flex items-center justify-between rounded-lg border border-accent-teal/50 bg-black/20 p-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[0.6rem] uppercase text-text-mana/45">Target</p>
                    <p className="truncate font-display text-sm text-text-mana">{selectedTarget.name}</p>
                    <p className="truncate font-mono text-[0.62rem] text-text-mana/50">{selectedTarget.url || selectedTarget.id}</p>
                  </div>
                  <span className={`shrink-0 rounded border px-2 py-1 font-mono text-[0.58rem] ${STATUS_STYLES[selectedTarget.status]}`}>{selectedTarget.status}</span>
                </div>
                <label className="block font-mono text-[0.65rem] uppercase tracking-wide text-text-mana/70">
                  Raw metrics
                  <textarea
                    value={selectedTarget.metrics}
                    onChange={(event) => updateTarget(selectedTarget.id, (target) => ({ ...target, metrics: event.target.value }))}
                    placeholder="Paste verified metrics or source data..."
                    rows={4}
                    className="mt-1.5 w-full resize-y rounded-lg border border-accent-teal/50 bg-black/30 p-3 font-mono text-xs normal-case text-text-mana outline-none placeholder:text-text-mana/35 focus:border-alert-orange"
                  />
                </label>
                <label className="block font-mono text-[0.65rem] uppercase tracking-wide text-text-mana/70">
                  Findings
                  <textarea
                    value={selectedTarget.findings}
                    onChange={(event) => updateTarget(selectedTarget.id, (target) => ({ ...target, findings: event.target.value }))}
                    placeholder="Record evidence-based findings..."
                    rows={4}
                    className="mt-1.5 w-full resize-y rounded-lg border border-accent-teal/50 bg-black/30 p-3 font-mono text-xs normal-case text-text-mana outline-none placeholder:text-text-mana/35 focus:border-alert-orange"
                  />
                </label>
                <label className="block font-mono text-[0.65rem] uppercase tracking-wide text-text-mana/70">
                  Personal notes
                  <textarea
                    value={selectedTarget.notes}
                    onChange={(event) => updateTarget(selectedTarget.id, (target) => ({ ...target, notes: event.target.value }))}
                    placeholder="Private notes for report preparation..."
                    rows={4}
                    className="mt-1.5 w-full resize-y rounded-lg border border-accent-teal/50 bg-black/30 p-3 font-mono text-xs normal-case text-text-mana outline-none placeholder:text-text-mana/35 focus:border-alert-orange"
                  />
                </label>
                <button type="button" onClick={createSourcebook} className="w-full rounded-lg bg-alert-orange px-3 py-2 font-display text-xs font-bold uppercase tracking-wider text-bg-obsidian hover:brightness-110">
                  Generate client report preview
                </button>
              </>
            ) : (
              <p className="rounded-lg border border-accent-teal/50 p-4 font-mono text-xs text-text-mana/60">Select a target from the roster to inspect its intelligence.</p>
            )}
            {sourcebook && (
              <section>
                <h4 className="mb-1 font-mono text-[0.65rem] uppercase tracking-wide text-alert-orange">Sourcebook preview</h4>
                <pre className="whitespace-pre-wrap rounded-lg border border-accent-teal/50 bg-black/30 p-3 font-mono text-[0.68rem] leading-relaxed text-text-mana/80">{sourcebook}</pre>
              </section>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
