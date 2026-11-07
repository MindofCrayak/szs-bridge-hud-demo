import React from 'react';
import type { CockpitCommand, CockpitFeed } from '../../cockpit/cockpitFeed';
import type { NotificationDepartment } from '../../notifications/summary';
import { notificationSeverityColor } from '../../notifications/summary';
import { compactMoney } from '../../data/hudStats';

/**
 * Display 2: the cockpit (762x1366 portrait side screen). Owner 2026-11-06: every number here is live, from the
 * feed the main HUD window sends; nothing is a demo value. Layout follows RTS consoles: resources across the top,
 * a department "unit panel", the project runway in the middle, the alert feed and activity log below, and real
 * command buttons at the bottom.
 */
const DEPARTMENTS: { id: NotificationDepartment; role: string; icon: string }[] = [
  { id: 'Housekeeping', role: 'Alfred · Police', icon: 'fa-shield-halved' },
  { id: 'Pamela', role: 'Intake', icon: 'fa-user-plus' },
  { id: 'Oracle', role: 'OSINT', icon: 'fa-eye' },
  { id: 'Dolores', role: 'Delivery', icon: 'fa-list-check' },
  { id: 'Vala', role: 'Billing', icon: 'fa-coins' },
  { id: 'Daisy', role: 'Client journey', icon: 'fa-envelope' },
];

const Panel: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, right, children, className = '' }) => (
  <section className={`relative rounded-md border border-[#086375]/70 bg-[#030806] shadow-[inset_0_0_18px_rgba(0,0,0,0.9),0_0_0_1px_#0d1513] ${className}`}>
    <header className="flex items-center justify-between border-b border-[#086375]/50 bg-gradient-to-r from-[#086375]/25 to-transparent px-2.5 py-1">
      <h2 className="font-display text-hud-3 font-bold uppercase tracking-widest text-[#E0CA3C]">{title}</h2>
      {right && <span className="text-hud-2 text-[#DDFBD0]/60">{right}</span>}
    </header>
    <div className="p-2">{children}</div>
  </section>
);

const severityColor = (severity: string) => notificationSeverityColor(
  /^block$/i.test(severity) ? 'BLOCK' : /^warn/i.test(severity) ? 'WARN' : 'INFO',
);

export const AvionicsCockpitView: React.FC<{
  feed: CockpitFeed | null;
  onCommand: (command: CockpitCommand) => void;
  onClose?: () => void;
  /** Side-window mode: no main window has answered yet. */
  waiting?: boolean;
}> = ({ feed, onCommand, onClose, waiting = false }) => {
  const button = 'flex-1 rounded border border-[#086375] bg-[#086375]/20 px-2 py-2 text-hud-3 font-bold text-[#DDFBD0] hover:border-[#E0CA3C] hover:text-[#E0CA3C] disabled:opacity-40';
  const live = feed?.adapterStatus === 'live';
  const time = feed ? new Date(feed.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--';

  return (
    <div className="relative flex h-screen max-h-[1366px] w-full max-w-[762px] select-none flex-col overflow-hidden border-2 border-[#1a2b27] bg-[#020500] font-mono text-[#DDFBD0] shadow-[0_0_60px_rgba(8,99,117,0.4)]">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-[#086375]/60 bg-[#0d1513] px-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : feed ? 'bg-[#3C91E6]' : 'bg-[#FE5F00] animate-pulse'}`} />
          <span className="text-hud-3 font-bold tracking-widest text-[#E0CA3C]">SZS COCKPIT</span>
          <span className="text-hud-2 text-[#DDFBD0]/60">DATA {feed ? feed.adapterStatus.toUpperCase() : 'WAITING'} · {time}</span>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded border border-[#FE5F00]/50 px-2 py-0.5 text-hud-2 text-[#FE5F00] hover:bg-[#FE5F00] hover:text-black">
            CLOSE ✕
          </button>
        )}
      </div>

      {!feed ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <i className="fa-solid fa-satellite-dish text-3xl text-[#086375]" />
          <p className="text-hud-5 text-[#DDFBD0]">{waiting ? 'Waiting for the main HUD window…' : 'No data loaded yet.'}</p>
          <p className="max-w-md text-hud-3 text-[#DDFBD0]/60">
            The cockpit shows what the main HUD window has loaded. Keep the main window open (and signed in); this screen fills in by itself.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5">
          {/* Resources */}
          <div className="grid shrink-0 grid-cols-5 gap-1.5">
            {[
              { label: 'PAID', value: compactMoney(feed.stats.collected), color: '#34d399', title: 'Collected (paid invoices)' },
              { label: 'OWED', value: compactMoney(feed.stats.outstanding), color: '#E0CA3C', title: 'Outstanding (unpaid invoices)' },
              { label: 'PIPELINE', value: compactMoney(feed.stats.pipeline), color: '#E0CA3C', title: 'Total contract value' },
              { label: 'PROJECTS', value: `${feed.stats.openProjects}/${feed.stats.totalProjects}`, color: '#3C91E6', title: 'Open projects / all projects' },
              { label: 'ALERTS', value: String(feed.stats.openAlerts), color: feed.stats.blockAlerts ? '#f87171' : '#FE5F00', title: `${feed.stats.blockAlerts} at BLOCK` },
            ].map((item) => (
              <div key={item.label} title={item.title} className="rounded-md border border-[#086375]/70 bg-[#030806] px-2 py-1.5 text-center shadow-[inset_0_0_12px_rgba(0,0,0,0.9)]">
                <div className="text-hud-1 tracking-widest text-[#DDFBD0]/55">{item.label}</div>
                <div className="text-base font-bold tabular-nums" style={{ color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Department unit panel */}
          <Panel title="Departments" right={feed.selectedClient ? `Selected: ${feed.selectedClient}` : undefined}>
            <div className="grid grid-cols-3 gap-1.5">
              {DEPARTMENTS.map((dept) => {
                const item = feed.departments.find((entry) => entry.department === dept.id);
                const count = item?.count ?? 0;
                const color = count ? notificationSeverityColor(item?.severity ?? null) : '#DDFBD0';
                return (
                  <button key={dept.id} type="button" onClick={() => onCommand({ type: 'department', department: dept.id })}
                    title={`Open ${dept.id} in the main window`}
                    className="flex items-center gap-2 rounded border border-[#086375]/50 bg-black/40 px-2 py-1.5 text-left hover:border-[#E0CA3C]">
                    <i className={`fa-solid ${dept.icon} w-5 text-center text-hud-5`} style={{ color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-hud-4 font-bold">{dept.id}</span>
                      <span className="block truncate text-hud-1 text-[#DDFBD0]/55">{dept.role}</span>
                    </span>
                    <span className="text-hud-5 font-bold tabular-nums" style={{ color }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </Panel>

          {/* Project runway */}
          <Panel title="Project runway" right={`${feed.projects.length} open · 45-day cadence`}>
            <ul className="space-y-1">
              {feed.projects.length === 0 && <li className="text-hud-3 text-[#DDFBD0]/50">No open projects.</li>}
              {feed.projects.map((project) => {
                const pct = project.day === null ? 0 : Math.min(100, (project.day / 45) * 100);
                const late = project.day !== null && project.day > 45;
                return (
                  <li key={project.projectId}>
                    <button type="button" onClick={() => onCommand({ type: 'client', clientId: project.clientId })}
                      title={`Open ${project.company} in Solar (main window)`}
                      className="block w-full rounded border border-[#086375]/40 bg-black/30 px-2 py-1 text-left hover:border-[#E0CA3C]">
                      <div className="flex items-center justify-between gap-2 text-hud-3">
                        <span className="min-w-0 truncate"><b className="text-[#E0CA3C]">{project.projectId}</b> {project.company} · {project.title}</span>
                        <span className="shrink-0 text-[#DDFBD0]/70">{project.stage.slice(0, 2)} · {project.day === null ? 'no kickoff' : `day ${project.day}/45`}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded bg-[#086375]/25">
                        <div className="h-full rounded" style={{ width: `${pct}%`, background: late ? '#f87171' : 'linear-gradient(90deg,#086375,#34d399)' }} />
                      </div>
                      {project.roadblock && <div className="mt-0.5 truncate text-hud-2 text-[#FE5F00]">Roadblock: {project.roadblock}</div>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {/* Alerts */}
          <Panel title="Alert feed" right={`${feed.stats.openAlerts} open`}>
            <ul className="space-y-0.5">
              {feed.alerts.length === 0 && <li className="text-hud-3 text-[#DDFBD0]/50">All clear.</li>}
              {feed.alerts.map((alert) => (
                <li key={alert.id} className="flex gap-2 text-hud-3">
                  <span className="w-12 shrink-0 font-bold" style={{ color: severityColor(alert.severity) }}>{alert.severity}</span>
                  <span className="w-20 shrink-0 truncate text-[#DDFBD0]/60">{alert.subRoutine}</span>
                  <span className="min-w-0 truncate" title={alert.message}>{alert.clientId ? <b>{alert.clientId} </b> : null}{alert.message}</span>
                </li>
              ))}
            </ul>
          </Panel>

          {/* Activity log */}
          <Panel title="Activity">
            <ul className="space-y-0.5 text-hud-2">
              {feed.logs.length === 0 && <li className="text-[#DDFBD0]/50">Nothing yet.</li>}
              {[...feed.logs].reverse().map((log) => (
                <li key={log.id} className="flex gap-2">
                  <span className="shrink-0 text-[#E0CA3C]">{log.time}</span>
                  <span className={`min-w-0 truncate ${log.type === 'alert' ? 'text-[#FE5F00]' : log.type === 'server' ? 'text-emerald-300' : 'text-[#DDFBD0]/80'}`} title={log.text}>{log.text}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      <div className="flex shrink-0 gap-2 border-t-2 border-[#1a2b27] bg-[#0d1513] p-2.5">
        <button type="button" className={button} disabled={!feed} onClick={() => onCommand({ type: 'refresh' })} title="Reload Master Control data in the main window">
          <i className="fa-solid fa-rotate" /> REFRESH DATA
        </button>
        <button type="button" className={button} disabled={!feed} onClick={() => onCommand({ type: 'level', level: 'universe' })}>
          <i className="fa-solid fa-globe" /> UNIVERSE
        </button>
        <button type="button" className={button} disabled={!feed} onClick={() => onCommand({ type: 'level', level: 'galaxy' })}>
          <i className="fa-solid fa-table-columns" /> GALAXY
        </button>
        <button type="button" className={button} disabled={!feed?.selectedClient} onClick={() => onCommand({ type: 'level', level: 'solar' })}>
          <i className="fa-solid fa-sun" /> SOLAR
        </button>
      </div>
    </div>
  );
};
