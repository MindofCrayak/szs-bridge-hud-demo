import React from 'react';
import { ClientCommsHandlers, ClientRecord, ProjectTaskHandlers } from '../../types';
import { sentTime } from './SendToClientOverlay';

interface ClientDossierBayProps {
  client: ClientRecord | null;
  /** Live only (Plan v3.1 E5). Absent offline/demo, so the control is hidden. */
  clientComms?: ClientCommsHandlers;
  /** Live only (Plan v3.1 E6): the project task panel. */
  projectTasks?: ProjectTaskHandlers;
}

/**
 * "Send to client" launcher. The editable preview opens in the Alfred Core bay (owner layout decision 2026-11-05);
 * this keeps only the button, the last-sent line and errors so the Dossier stays a links bay.
 */
const SendToClient: React.FC<{ projectId: string; comms: ClientCommsHandlers }> = ({ projectId, comms }) => {
  const state = comms.states[projectId] ?? { step: 'idle' as const };
  const last = state.lastSent;
  const active = state.step === 'loading' || state.step === 'preview' || state.step === 'sending';
  return (
    <div className="mt-1 text-hud-2">
      <div className="flex flex-wrap items-center gap-2">
        {active ? (
          <span className="text-[#E0CA3C]">{state.step === 'sending' ? 'Posting…' : 'Draft open in Alfred Core'}</span>
        ) : (
          <button type="button" onClick={() => comms.preview(projectId)} className="rounded border border-[#E0CA3C]/60 px-1.5 py-0.5 font-bold text-[#E0CA3C] hover:bg-[#E0CA3C]/10">
            {last ? 'Send another…' : 'Send to client…'}
          </button>
        )}
        {last && (
          <span className="text-emerald-400">
            Sent {sentTime(last.at)} · <a href={last.spaceUrl} target="_blank" rel="noreferrer" className="text-[#E0CA3C] hover:underline">Open ↗</a>
          </span>
        )}
      </div>
      {state.step === 'error' && <p className="mt-0.5 text-red-400">{state.message}</p>}
    </div>
  );
};

/** Task count only; the task list itself lives in the Planet view (owner layout decision 2026-11-05). */
const TaskCount: React.FC<{ projectId: string; handlers: ProjectTaskHandlers }> = ({ projectId, handlers }) => {
  const tasks = handlers.tasks[projectId];
  const error = handlers.errors[projectId];
  return (
    <div className="mt-0.5 text-hud-2 text-[#DDFBD0]/70">
      Tasks: {tasks ? `${tasks.filter((task) => task.status === 'needsAction').length} open / ${tasks.length}` : handlers.loading.has(projectId) ? 'reading…' : '—'}
      {error && <span className="ml-1 text-red-400">{error}</span>}
    </div>
  );
};

const money = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

const Field: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <>
    <dt className="text-[#DDFBD0]/50">{label}</dt>
    <dd className={`truncate ${value ? 'text-[#DDFBD0]/85' : 'text-red-400'}`}>{value || 'MISSING'}</dd>
  </>
);

const DocLink: React.FC<{ label: string; id?: string }> = ({ label, id }) => (
  id && !id.startsWith('TEST-PLACEHOLDER')
    ? <a href={`https://drive.google.com/open?id=${id}`} target="_blank" rel="noreferrer" className="text-[#E0CA3C] hover:underline">{label} ↗</a>
    : <span className="text-red-400/80">{label} missing</span>
);

const UrlLink: React.FC<{ label: string; url?: string }> = ({ label, url }) => (
  url
    ? <a href={url} target="_blank" rel="noreferrer" className="text-[#E0CA3C] hover:underline">{label} ↗</a>
    : <span className="text-red-400/80">{label} missing</span>
);

export const ClientDossierBay: React.FC<ClientDossierBayProps> = ({ client, clientComms, projectTasks }) => {
  return (
    <div className="flex flex-col h-full overflow-hidden text-xs font-mono">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between border-b border-[#086375]/40 pb-1.5 shrink-0">
        <h2 className="font-display text-sm font-bold text-[#DDFBD0]">Client Dossier</h2>
        <span className="text-hud-2 text-[#E0CA3C] font-bold">LINKS ONLY</span>
      </div>

      {client ? (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
          <div className="pb-1 border-b border-[#086375]/30 truncate">
            <span className="text-[#E0CA3C] font-bold">{client.Company_Name}</span>
            <span className="text-[#DDFBD0]/50 ml-1">· {client.ClientID}</span>
          </div>

          {/* Sanctum Drive */}
          <div className="flex items-center justify-between p-1.5 rounded bg-[#020500]/60 border border-[#086375]/40">
            <span className="text-[#DDFBD0]/75 flex items-center gap-1.5 truncate">
              <i className="fa-brands fa-google-drive text-[#E0CA3C]" />
              Root Drive
            </span>
            {client.DriveFolderUrl ? (
              <a
                href={client.DriveFolderUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#E0CA3C] hover:underline font-bold text-hud-3"
              >
                OPEN ↗
              </a>
            ) : (
              <span className="text-red-400 text-hud-2">MISSING</span>
            )}
          </div>

          {/* Meeting Notes Doc */}
          <div className="flex items-center justify-between p-1.5 rounded bg-[#020500]/60 border border-[#086375]/40">
            <span className="text-[#DDFBD0]/75 flex items-center gap-1.5 truncate">
              <i className="fa-solid fa-file-lines text-[#FE5F00]" />
              Meeting Notes
            </span>
            {client.NotesDocUrl ? (
              <a
                href={client.NotesDocUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#FE5F00] hover:underline font-bold text-hud-3"
              >
                OPEN ↗
              </a>
            ) : (
              <span className="text-red-400 text-hud-2">MISSING</span>
            )}
          </div>

          {/* MSA Doc */}
          <div className="flex items-center justify-between p-1.5 rounded bg-[#020500]/60 border border-[#086375]/40">
            <span className="text-[#DDFBD0]/75 flex items-center gap-1.5 truncate">
              <i className="fa-solid fa-file-contract text-[#086375]" />
              View MSA
            </span>
            {client.MSA_DocID ? (
              <a
                href={`https://docs.google.com/document/d/${client.MSA_DocID}/edit`}
                target="_blank"
                rel="noreferrer"
                className="text-[#086375] hover:text-[#E0CA3C] hover:underline font-bold text-hud-3"
              >
                VIEW ↗
              </a>
            ) : (
              <span className="text-red-400 text-hud-2">MISSING</span>
            )}
          </div>

          {/* SOW Doc */}
          <div className="flex items-center justify-between p-1.5 rounded bg-[#020500]/60 border border-[#086375]/40">
            <span className="text-[#DDFBD0]/75 flex items-center gap-1.5 truncate">
              <i className="fa-solid fa-signature text-[#086375]" />
              View SOW
            </span>
            {client.SOW_DocID ? (
              <a
                href={`https://docs.google.com/document/d/${client.SOW_DocID}/edit`}
                target="_blank"
                rel="noreferrer"
                className="text-[#086375] hover:text-[#E0CA3C] hover:underline font-bold text-hud-3"
              >
                VIEW ↗
              </a>
            ) : (
              <span className="text-red-400 text-hud-2">MISSING</span>
            )}
          </div>

          {/* Chat Space */}
          <div className="flex items-center justify-between p-1.5 rounded bg-[#020500]/60 border border-[#086375]/40">
            <span className="text-[#DDFBD0]/75 flex items-center gap-1.5 truncate">
              <i className="fa-solid fa-comments text-[#E0CA3C]" />
              Chat Space
            </span>
            {client.ChatSpaceUrl ? (
              <a
                href={client.ChatSpaceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#E0CA3C] hover:underline font-bold text-hud-3"
              >
                JOIN ↗
              </a>
            ) : (
              <span className="text-red-400 text-hud-2">MISSING</span>
            )}
          </div>

          {/* Plan v3.1 D4: remaining Master Control fields, collapsed by default to keep the bay compact. */}
          <details className="rounded border border-[#086375]/40 bg-[#020500]/60">
            <summary className="cursor-pointer px-1.5 py-1 text-hud-3 font-bold text-[#DDFBD0]/80">Identity</summary>
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 px-1.5 pb-1.5 text-hud-2">
              <Field label="Group" value={client.GoogleGroupEmail} />
              <Field label="Tech stack" value={client.Tech_Stack} />
              <Field label="MCC subscriber" value={client.MCC_Subscriber_ID} />
              <Field label="Oracle baseline" value={client.Oracle_Baseline_ID} />
            </dl>
          </details>

          <details className="rounded border border-[#086375]/40 bg-[#020500]/60">
            <summary className="cursor-pointer px-1.5 py-1 text-hud-3 font-bold text-[#DDFBD0]/80">
              Projects ({client.activeProjects.length})
            </summary>
            <div className="space-y-1.5 px-1.5 pb-1.5 text-hud-2">
              {client.activeProjects.map((project) => (
                <div key={project.ProjectID} className="border-t border-[#086375]/30 pt-1">
                  <div className="truncate font-bold text-[#E0CA3C]">{project.ProjectID} · {project.SprintStage}</div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                    <Field label="Hours" value={`${project.Est_Hours ?? '—'} est / ${project.Actual_Hours ?? '—'} actual`} />
                    <Field label="Task list" value={project.Google_Tasklist_ID} />
                    <Field label="Parent" value={project.ParentProjectID} />
                    <Field label="Addendum" value={project.AddendumRef} />
                  </dl>
                  <div className="mt-0.5 flex flex-wrap gap-x-2">
                    <DocLink label="Brief" id={project.Project_Brief_DocID} />
                    <DocLink label="Outline" id={project.Project_Outline_DocID} />
                    <DocLink label="SOW" id={project.SOW_DocID} />
                    <UrlLink label="Client chat" url={project.ChatSpace_URL} />
                    <UrlLink label="Internal chat" url={project.ChatSpace_Internal_URL} />
                    <UrlLink label="COMS" url={project.COMS_Sheet_URL} />
                    <DocLink label="Command Deck" id={project.Dashboard_Sheet_ID} />
                  </div>
                  {clientComms && project.ChatSpace_URL && <SendToClient projectId={project.ProjectID} comms={clientComms} />}
                  {projectTasks && project.Google_Tasklist_ID && <TaskCount projectId={project.ProjectID} handlers={projectTasks} />}
                </div>
              ))}
            </div>
          </details>

          <details className="rounded border border-[#086375]/40 bg-[#020500]/60">
            <summary className="cursor-pointer px-1.5 py-1 text-hud-3 font-bold text-[#DDFBD0]/80">Finances</summary>
            {client.finance ? (
              <div className="px-1.5 pb-1.5 text-hud-2">
                <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                  <Field label="Contract" value={money(client.ContractValue)} />
                  <Field label="Balance" value={money(client.finance.remainingBalance)} />
                  <Field label="Est. tax" value={client.finance.estimatedTax === null ? undefined : money(client.finance.estimatedTax)} />
                  <Field label="Net margin" value={client.finance.netMargin === null ? undefined : String(client.finance.netMargin)} />
                </dl>
                <ul className="mt-1 space-y-0.5 border-t border-[#086375]/30 pt-1">
                  {client.finance.invoices.map((invoice) => (
                    <li key={`${invoice.InvoiceID}-${invoice.ProjectID}`} className="flex justify-between gap-2">
                      <span className="truncate">{invoice.InvoiceID || '—'} · {invoice.ProjectID}</span>
                      <span className="shrink-0">{money(invoice.Amount)} {invoice.Status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="px-1.5 pb-1.5 text-hud-2 text-[#DDFBD0]/50">No Finances rows.</p>
            )}
          </details>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center p-3 text-[#DDFBD0]/50">
          <p className="text-hud-3">Select an account to load Sanctum document shortcuts</p>
        </div>
      )}
    </div>
  );
};
