import React, { useMemo, useRef, useState } from 'react';
import type { ClientRecord, HudTask, ProjectRecord, ProjectTaskHandlers } from '../../types';
import { buildGantt, orderTasks, taskState, visibleWindow } from '../../planet/gantt';
import type { GanttRow, GanttState } from '../../planet/gantt';

/**
 * Phase F (Master Plan v3.1): the Planet project page. Owner layout: Gantt in the center, project details on the
 * right, task list below the Gantt. Route /client/:clientId/project/:projectId; Esc or the breadcrumb returns to Solar.
 */
export interface PlanetViewProps {
  client: ClientRecord | null;
  project: ProjectRecord | null;
  projectId: string;
  /** Live only; absent offline (read-only page). */
  tasks?: ProjectTaskHandlers;
  onClose: () => void;
  onOpenGalaxy: () => void;
  onOpenUniverse: () => void;
}

const STATE_COLORS: Record<GanttState, string> = { completed: '#34d399', overdue: '#E63946', upcoming: '#22D3EE' };
const DAY_W = 18;
const ROW_H = 20;
const LIST_ROW_H = 26;
const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const driveLink = (id?: string) => (id && !id.startsWith('TEST-PLACEHOLDER') ? `https://drive.google.com/open?id=${id}` : '');
const money = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

const Gantt: React.FC<{ rows: GanttRow[]; days: number; todayDay: number; stages: { label: string; day: number }[]; kickoff: string }> = ({
  rows, days, todayDay, stages, kickoff,
}) => {
  const width = days * DAY_W;
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded border border-[#086375]/40 bg-[#020500]">
      <div className="flex">
        <div className="sticky left-0 z-20 w-56 shrink-0 border-r border-[#086375]/40 bg-[#020500]">
          <div className="h-10 border-b border-[#086375]/40 px-2 pt-1 text-hud-2 text-[#DDFBD0]/50">Kickoff {kickoff}</div>
          {rows.map((row) => (
            <div key={row.task.id} style={{ height: ROW_H }} title={row.task.title}
              className={`truncate px-2 text-hud-2 leading-5 ${row.kind === 'parent' ? 'font-bold text-[#E0CA3C]' : 'pl-4 text-[#DDFBD0]/80'}`}>
              {row.task.milestone && <span className="mr-1 text-[#E0CA3C]">◆</span>}{row.task.title}
            </div>
          ))}
        </div>
        <div className="relative shrink-0" style={{ width }}>
          <div className="sticky top-0 z-10 h-10 border-b border-[#086375]/40 bg-[#020500]">
            {stages.map((stage) => (
              <div key={stage.label} className="absolute top-0 h-full border-l border-[#E0CA3C]/40 pl-1 text-hud-1 text-[#E0CA3C]/80" style={{ left: stage.day * DAY_W }}>
                {stage.label}
              </div>
            ))}
            {Array.from({ length: Math.ceil(days / 5) }, (_, index) => (
              <span key={index} className="absolute bottom-0.5 text-hud-1 text-[#DDFBD0]/40" style={{ left: index * 5 * DAY_W + 2 }}>d{index * 5}</span>
            ))}
          </div>
          {stages.map((stage) => (
            <div key={`line-${stage.label}`} className="absolute bottom-0 top-10 border-l border-dashed border-[#E0CA3C]/15" style={{ left: stage.day * DAY_W }} />
          ))}
          {todayDay >= 0 && todayDay <= days && (
            <div className="absolute bottom-0 top-0 z-10 w-px bg-[#FE5F00]" style={{ left: todayDay * DAY_W + DAY_W / 2 }} title="Today" />
          )}
          {rows.map((row) => (
            <div key={row.task.id} className="relative" style={{ height: ROW_H }}>
              {row.startDay !== null && row.endDay !== null && (row.marker ? (
                <div className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45" title={`${row.task.title} · due ${row.task.due}`}
                  style={{ left: row.endDay * DAY_W + DAY_W / 2 - 5, backgroundColor: STATE_COLORS[row.state] }} />
              ) : (
                <div className={`absolute top-1/2 -translate-y-1/2 rounded-sm ${row.kind === 'parent' ? 'h-1.5 opacity-60' : 'h-3'}`}
                  title={`${row.task.title} · ${row.task.start || '?'} → ${row.task.due || '?'}`}
                  style={{ left: row.startDay * DAY_W + 1, width: Math.max(1, row.endDay - row.startDay + 1) * DAY_W - 2, backgroundColor: STATE_COLORS[row.state] }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TaskList: React.FC<{ projectId: string; handlers?: ProjectTaskHandlers; tasks: HudTask[]; today: string }> = ({ projectId, handlers, tasks, today }) => {
  const [showDone, setShowDone] = useState(true);
  const [scrollTop, setScrollTop] = useState(0);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [notes, setNotes] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [clientFacing, setClientFacing] = useState(false);
  const parents = tasks.filter((task) => !task.parentId);
  const chosenParent = parentId ?? parents[0]?.id ?? '';
  const creating = handlers?.pendingWriteKeys.has(`task:${projectId}/new`) ?? false;
  const rows = orderTasks(tasks).filter(({ task }) => showDone || task.status === 'needsAction'
    || tasks.some((child) => child.parentId === task.id && child.status === 'needsAction'));
  const viewport = 260;
  const windowed = rows.length > 100;
  const slice = windowed ? visibleWindow(rows.length, scrollTop, LIST_ROW_H, viewport) : { first: 0, last: rows.length, padTop: 0, padBottom: 0 };
  const inputClass = 'rounded border border-[#086375]/50 bg-[#020500] px-1.5 py-0.5 text-hud-3 text-[#DDFBD0]';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!handlers || !title.trim() || creating || (clientFacing && !chosenParent)) return;
    if (await handlers.create(projectId, { title, due, notes, parentId: chosenParent, clientFacing })) { setTitle(''); setDue(''); setNotes(''); }
  };

  return (
    <section className="flex shrink-0 flex-col rounded border border-[#086375]/40 bg-[#040706]">
      <header className="flex items-center gap-3 border-b border-[#086375]/40 px-2 py-1 text-hud-3">
        <h2 className="flex-1 font-bold text-[#E0CA3C]">Tasks · {tasks.filter((task) => task.status === 'needsAction').length} open / {tasks.length}</h2>
        <label className="flex items-center gap-1 text-[#DDFBD0]/60">
          <input type="checkbox" checked={showDone} onChange={(event) => setShowDone(event.target.checked)} className="accent-[#E0CA3C]" /> show done
        </label>
        {handlers && (
          <button type="button" onClick={() => handlers.reload(projectId)} disabled={handlers.loading.has(projectId)} className="text-[#DDFBD0]/60 hover:text-[#E0CA3C] disabled:opacity-50">
            {handlers.loading.has(projectId) ? 'Reading…' : 'Reload'}
          </button>
        )}
      </header>
      {handlers?.errors[projectId] && <p role="status" className="px-2 py-1 text-hud-3 text-red-400">{handlers.errors[projectId]}</p>}
      <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_4.5rem_minmax(0,1fr)] gap-x-2 border-b border-[#086375]/30 px-2 py-0.5 text-hud-1 uppercase text-[#DDFBD0]/40">
        <span /><span>Title</span><span>Due</span><span>Status</span><span>Notes</span>
      </div>
      <div className="overflow-auto" style={{ maxHeight: viewport }} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
        <div style={{ paddingTop: slice.padTop, paddingBottom: slice.padBottom }}>
          {rows.slice(slice.first, slice.last).map(({ task, depth }) => {
            const busy = handlers?.pendingWriteKeys.has(`task:${projectId}/${task.id}`) ?? false;
            const done = task.status === 'completed';
            const state = taskState(task, today);
            return (
              <div key={task.id} style={{ height: LIST_ROW_H }}
                className="grid grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_4.5rem_minmax(0,1fr)] items-center gap-x-2 border-b border-[#086375]/15 px-2 text-hud-3">
                <input type="checkbox" checked={done} disabled={!handlers || busy}
                  onChange={(event) => handlers?.setDone(projectId, task.id, event.target.checked)}
                  aria-label={`${done ? 'Reopen' : 'Complete'} ${task.title}`} className="accent-[#E0CA3C] disabled:cursor-wait" />
                <span className={`truncate ${depth ? 'pl-4' : 'font-bold text-[#E0CA3C]'} ${done ? 'text-[#DDFBD0]/40 line-through' : ''}`} title={task.title}>
                  {task.milestone && <span className="mr-1 text-[#E0CA3C]" title="Milestone">◆</span>}
                  {task.title}
                  {task.audience === 'client' && <span className="ml-1 rounded bg-[#E0CA3C]/15 px-1 text-hud-1 text-[#E0CA3C]">client</span>}
                  {busy && <span className="ml-1 text-hud-1 text-[#E0CA3C]">saving…</span>}
                </span>
                <span className="text-[#DDFBD0]/60">{task.due || '—'}</span>
                <span style={{ color: STATE_COLORS[state] }}>{done ? 'Done' : state === 'overdue' ? 'Overdue' : 'Open'}</span>
                <span className="truncate text-[#DDFBD0]/50" title={task.notes || undefined}>{task.notes}</span>
              </div>
            );
          })}
          {rows.length === 0 && <p className="px-2 py-2 text-hud-3 text-[#DDFBD0]/40">No tasks to show.</p>}
        </div>
      </div>
      {handlers && (
        <form onSubmit={submit} className="flex flex-wrap items-center gap-1.5 border-t border-[#086375]/40 px-2 py-1.5">
          <input aria-label="New task title" placeholder="New task title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={creating} className={`${inputClass} min-w-[12rem] flex-1`} />
          <input aria-label="Due date" type="date" value={due} onChange={(event) => setDue(event.target.value)} disabled={creating} className={inputClass} />
          <select aria-label="Parent task" value={chosenParent} onChange={(event) => setParentId(event.target.value)} disabled={creating} className={`${inputClass} max-w-[14rem]`}>
            <option value="">(top level)</option>
            {parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.title}</option>)}
          </select>
          <label className="flex items-center gap-1 text-hud-3 text-[#DDFBD0]/80">
            <input type="checkbox" checked={clientFacing} onChange={(event) => setClientFacing(event.target.checked)} disabled={creating} className="accent-[#E0CA3C]" /> Client-facing
          </label>
          <input aria-label="Task notes" placeholder="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={creating} className={`${inputClass} min-w-[10rem] flex-1`} />
          <button type="submit" disabled={creating || !title.trim() || (clientFacing && !chosenParent)} className="rounded bg-[#E0CA3C] px-2 py-0.5 text-hud-3 font-bold text-[#020500] disabled:opacity-50">
            {creating ? 'Adding…' : 'Add task'}
          </button>
          {clientFacing && !chosenParent && <span className="text-hud-2 text-amber-400">Client-facing tasks need a parent so they show on the Command Deck.</span>}
        </form>
      )}
    </section>
  );
};

const Detail: React.FC<{ label: string; children?: React.ReactNode }> = ({ label, children }) => (
  <>
    <dt className="text-[#DDFBD0]/50">{label}</dt>
    <dd className="truncate text-[#DDFBD0]/90">{children || <span className="text-red-400">MISSING</span>}</dd>
  </>
);
const Ext: React.FC<{ href: string; label: string }> = ({ href, label }) => (href
  ? <a href={href} target="_blank" rel="noreferrer" className="text-[#E0CA3C] hover:underline">{label} ↗</a>
  : <span className="text-red-400">{label}: missing</span>);

const Details: React.FC<{ client: ClientRecord; project: ProjectRecord }> = ({ client, project }) => {
  const invoices = (client.finance?.invoices ?? []).filter((invoice) => invoice.ProjectID === project.ProjectID);
  return (
    <aside className="flex w-full min-w-0 flex-col gap-2 overflow-auto rounded border border-[#086375]/40 bg-[#040706] p-2 text-hud-3 lg:w-80 lg:shrink-0">
      <section>
        <h2 className="font-display text-sm font-bold text-[#E0CA3C]">{project.Title || project.ProjectID}</h2>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          <Detail label="Project">{project.ProjectID}</Detail>
          <Detail label="Sprint stage">{project.SprintStage}</Detail>
          <Detail label="Account phase">{client.AccountPhase}</Detail>
          <Detail label="Rate tier">{project.AssignedRateTier}</Detail>
          <Detail label="Hours">{`${project.Est_Hours ?? '—'} est / ${project.Actual_Hours ?? '—'} actual`}</Detail>
          <Detail label="Kickoff">{project.Kickoff_Date?.slice(0, 10)}</Detail>
          {project.ParentProjectID && <Detail label="Parent">{project.ParentProjectID}</Detail>}
          {project.AddendumRef && <Detail label="Addendum">{project.AddendumRef}</Detail>}
        </dl>
      </section>
      <section className="border-t border-[#086375]/30 pt-1.5">
        <h3 className="mb-1 font-bold text-[#DDFBD0]/80">Documents & spaces</h3>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <Ext label="Brief" href={driveLink(project.Project_Brief_DocID)} />
          <Ext label="Outline" href={driveLink(project.Project_Outline_DocID)} />
          <Ext label="SOW" href={driveLink(project.SOW_DocID)} />
          <Ext label="Command Deck" href={driveLink(project.Dashboard_Sheet_ID)} />
          <Ext label="COMS" href={project.COMS_Sheet_URL ?? ''} />
          <Ext label="Meeting notes" href={project.MeetingNotes_DriveFolderID ? `https://drive.google.com/drive/folders/${project.MeetingNotes_DriveFolderID}` : ''} />
          <Ext label="Client chat" href={project.ChatSpace_URL ?? ''} />
          <Ext label="Internal chat" href={project.ChatSpace_Internal_URL ?? ''} />
        </div>
      </section>
      <section className="border-t border-[#086375]/30 pt-1.5">
        <h3 className="mb-1 font-bold text-[#DDFBD0]/80">Client</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          <Detail label="Company">{client.Company_Name}</Detail>
          <Detail label="Contact">{[client.PrimaryContact, client.ContactEmail].filter(Boolean).join(' · ')}</Detail>
          <Detail label="Group">{client.GoogleGroupEmail}</Detail>
          <Detail label="Contract">{money(client.ContractValue)}</Detail>
          <Detail label="Deposit">{client.DepositPaid ? 'Paid' : 'Due'}</Detail>
          {client.finance && <Detail label="Balance">{money(client.finance.remainingBalance)}</Detail>}
        </dl>
      </section>
      <section className="border-t border-[#086375]/30 pt-1.5">
        <h3 className="mb-1 font-bold text-[#DDFBD0]/80">Invoices ({invoices.length})</h3>
        {invoices.length ? (
          <ul className="space-y-0.5">
            {invoices.map((invoice) => (
              <li key={`${invoice.InvoiceID}-${invoice.MilestoneStage ?? ''}`} className="flex justify-between gap-2">
                <span className="truncate">{invoice.InvoiceID || '—'} · {invoice.MilestoneStage || ''}</span>
                <span className="shrink-0">{money(invoice.Amount)} {invoice.Status}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-[#DDFBD0]/40">No invoices for this project.</p>}
      </section>
    </aside>
  );
};

const PlanetView: React.FC<PlanetViewProps> = ({ client, project, projectId, tasks: handlers, onClose, onOpenGalaxy, onOpenUniverse }) => {
  const today = todayIso();
  const tasks = useMemo(() => handlers?.tasks[projectId] ?? [], [handlers, projectId]);
  const layout = useMemo(() => buildGantt(tasks, project?.Kickoff_Date, today), [tasks, project?.Kickoff_Date, today]);
  const rootRef = useRef<HTMLDivElement>(null);

  const crumb = 'text-[#DDFBD0]/60 hover:text-[#E0CA3C] hover:underline';
  return (
    <div ref={rootRef} className="absolute inset-0 z-40 flex flex-col gap-2 overflow-hidden bg-[#020500] p-3 pb-16 font-mono text-[#DDFBD0]" aria-label={`Planet view for ${projectId}`}>
      <nav className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[#086375]/50 pb-1.5 text-hud-3" aria-label="Breadcrumb">
        <button type="button" onClick={onOpenUniverse} className={crumb}>Universe</button><span>/</span>
        <button type="button" onClick={onOpenGalaxy} className={crumb}>Galaxy</button><span>/</span>
        <button type="button" onClick={onClose} className={crumb}>Solar · {client?.Company_Name || client?.ClientID || '?'}</button><span>/</span>
        <span className="font-bold text-[#E0CA3C]">Planet · {projectId}</span>
        <span className="ml-auto text-[#DDFBD0]/40">Esc returns to Solar</span>
        <button type="button" onClick={onClose} className="rounded border border-[#086375]/60 px-2 py-0.5 hover:border-[#E0CA3C]">Close</button>
      </nav>
      {!client || !project ? (
        <p className="text-[0.75rem] text-red-400">Project {projectId} was not found in the loaded Master Control data.</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">
          <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            {!handlers && <p className="text-hud-3 text-amber-400">Tasks need live Master Control data; sign in to see the Gantt and task list.</p>}
            {handlers && !project.Google_Tasklist_ID && <p className="text-hud-3 text-amber-400">This project has no Google Tasks list yet (created automatically at stage 03).</p>}
            {handlers && project.Google_Tasklist_ID && !handlers.tasks[projectId] && (
              <p className="text-hud-3 text-[#DDFBD0]/60">{handlers.loading.has(projectId) ? 'Reading the task list…' : handlers.errors[projectId] || 'Task list not loaded.'}</p>
            )}
            <div className="flex shrink-0 gap-3 text-hud-2 text-[#DDFBD0]/60">
              {(['completed', 'upcoming', 'overdue'] as GanttState[]).map((state) => (
                <span key={state} className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: STATE_COLORS[state] }} />{state}</span>
              ))}
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rotate-45 bg-[#22D3EE]" />due only</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-px bg-[#FE5F00]" />today</span>
              <span>◆ milestone</span>
            </div>
            <Gantt rows={layout.rows} days={layout.days} todayDay={layout.todayDay} stages={layout.stages} kickoff={layout.kickoff} />
            {project.Google_Tasklist_ID && <TaskList projectId={projectId} handlers={handlers} tasks={tasks} today={today} />}
          </main>
          <Details client={client} project={project} />
        </div>
      )}
    </div>
  );
};

export default PlanetView;
