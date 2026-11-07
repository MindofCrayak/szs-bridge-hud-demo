import React, { useState } from 'react';
import { ActiveModal, ClientUnit } from '../types';
import { createClientId } from '../data/identity';

interface CommandModalsProps {
  activeModal: ActiveModal;
  onClose: () => void;
  activeUnit: ClientUnit | null;
  units: ClientUnit[];
  onAddUnit: (newUnit: ClientUnit) => void;
  onLogTerminal?: (message: string, type?: 'normal' | 'action' | 'server' | 'alert') => void;
}

const ACTION_DETAILS: Partial<Record<Exclude<ActiveModal, null | 'MENU'>, { title: string; description: string; href: string; action: string }>> = {
  Q: {
    title: 'Pre-fill Gmail',
    description: 'Open a new Gmail draft addressed to the selected client.',
    href: 'https://mail.google.com/mail/?view=cm&fs=1',
    action: 'Open Gmail draft',
  },
  W: {
    title: 'Open Chat Space',
    description: 'Continue the client conversation in Google Chat.',
    href: 'https://chat.google.com/',
    action: 'Open Google Chat',
  },
  E: {
    title: 'Schedule Meet',
    description: 'Create a calendar event for a client meeting.',
    href: 'https://calendar.google.com/calendar/u/0/r/eventedit',
    action: 'Open Calendar',
  },
  S: {
    title: 'Draft Milestone Invoice',
    description: 'Open a blank document for drafting a milestone invoice. The one-third contract amount is a reference only; confirm the approved rate tier and final amount before sending.',
    href: 'https://docs.google.com/document/create',
    action: 'Open blank invoice document',
  },
  D: {
    title: 'Open Google Tasks Checklist',
    description: 'Review follow-ups and task lists in Google Tasks.',
    href: 'https://tasks.google.com/',
    action: 'Open Google Tasks',
  },
  X: {
    title: 'Open Meeting Notes Doc',
    description: 'Open Google Docs to review or create meeting notes.',
    href: 'https://docs.google.com/document/u/0/',
    action: 'Open Google Docs',
  },
};

export const CommandModals: React.FC<CommandModalsProps> = ({
  activeModal,
  onClose,
  activeUnit,
  units,
  onAddUnit,
  onLogTerminal,
}) => {
  const [clientName, setClientName] = useState('');
  const [company, setCompany] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contractValue, setContractValue] = useState('5000');
  if (!activeModal) return null;

  const actionDetails = activeModal === 'MENU' ? undefined : ACTION_DETAILS[activeModal];
  const meetingNotesFolderId = activeUnit?.activeProjects
    ?.map((project) => project.MeetingNotes_DriveFolderID)
    .find((folderId) => Boolean(folderId?.trim()))
    ?.trim();
  const actionHref = actionDetails
    ? new URLSearchParams({
        view: 'cm',
        fs: '1',
        to: activeModal === 'Q' ? activeUnit?.contactEmail || '' : '',
        su: activeModal === 'Q' ? `Session Zero Solutions - ${activeUnit?.name || 'Client follow-up'}` : '',
        body: activeModal === 'Q' ? `Hi ${activeUnit?.name || 'there'},\n\n` : '',
        text: activeModal === 'E' ? `Client meeting: ${activeUnit?.name || ''}` : '',
        details: activeModal === 'E' ? `Session Zero Solutions client meeting${activeUnit ? ` with ${activeUnit.name}` : ''}` : '',
        add: activeModal === 'E' ? activeUnit?.googleGroupEmail || activeUnit?.contactEmail || '' : '',
      })
    : null;
  const finalActionHref = actionDetails && actionHref
    ? activeModal === 'Q'
      ? `https://mail.google.com/mail/?${actionHref.toString()}`
      : activeModal === 'E'
        ? `https://calendar.google.com/calendar/u/0/r/eventedit?${actionHref.toString()}`
        : activeModal === 'W' && activeUnit?.chatSpaceUrl?.startsWith('https://')
          ? activeUnit.chatSpaceUrl
          : activeModal === 'X' && meetingNotesFolderId
            ? `https://drive.google.com/drive/folders/${encodeURIComponent(meetingNotesFolderId)}`
            : actionDetails.href
    : '';

  const handleCreateClient = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericValue = Number(contractValue);
    if (!clientName.trim() || !Number.isFinite(numericValue) || numericValue < 0) return;

    const initials = clientName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    const newClient: ClientUnit = {
      id: createClientId(
        company.trim() || clientName.trim(),
        units.map((unit) => unit.id),
      ),
      name: clientName.trim(),
      archetype: company.trim() || 'New client',
      serviceArea: company.trim() || 'New client',
      avatar: initials,
      contractValue: numericValue,
      depositPaid: false,
      currentMilestone: 'Initial consultation',
      totalMilestones: 4,
      completedMilestones: 0,
      posX: 35,
      posY: 45,
      pipelineStage: '00: Discovery',
      roadblock: 'Confirm project scope',
      contactEmail: contactEmail.trim(),
      companyName: company.trim(),
      primaryContact: clientName.trim(),
      isDraft: true,
    };
    onAddUnit(newClient);
    onLogTerminal?.(`Client Onboarded: ${newClient.name} added to Intake.`, 'action');
    onClose();
  };

  const title = activeModal === 'MENU'
    ? 'Workspace settings'
    : activeModal === 'A'
      ? 'New Project Onboarding'
      : actionDetails?.title || 'Workspace action';

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-bg-obsidian/80 p-4 backdrop-blur-sm">
      <section className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-accent-teal bg-bg-obsidian shadow-2xl">
        <header className="flex items-center justify-between border-b border-accent-teal/60 bg-primary-plum/60 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-text-mana">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent-teal text-text-mana hover:border-alert-orange"
            title="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </header>

        <div className="overflow-y-auto p-5">
          {activeModal === 'A' && (
            <form onSubmit={handleCreateClient} className="space-y-4">
              <p className="text-sm text-text-mana/70">Create a local client intake record. Project, MSA, and SOW provisioning is not connected to a backend in this HUD.</p>
              <label className="block text-sm text-text-mana">
                Client name
                <input value={clientName} onChange={(event) => setClientName(event.target.value)} required className="mt-1 w-full rounded-lg border border-accent-teal bg-primary-plum/30 px-3 py-2" />
              </label>
              <label className="block text-sm text-text-mana">
                Company or service area
                <input value={company} onChange={(event) => setCompany(event.target.value)} className="mt-1 w-full rounded-lg border border-accent-teal bg-primary-plum/30 px-3 py-2" />
              </label>
              <label className="block text-sm text-text-mana">
                Contact email
                <input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-accent-teal bg-primary-plum/30 px-3 py-2" />
              </label>
              <label className="block text-sm text-text-mana">
                Contract value (USD)
                <input type="number" min="0" step="1" value={contractValue} onChange={(event) => setContractValue(event.target.value)} required className="mt-1 w-full rounded-lg border border-accent-teal bg-primary-plum/30 px-3 py-2" />
              </label>
              <button type="submit" className="w-full rounded-lg bg-alert-orange px-4 py-2 font-accent text-bg-obsidian">
                Add client to Intake
              </button>
            </form>
          )}

          {actionDetails && (
            <div className="space-y-4">
              <p className="text-sm text-text-mana/70">{actionDetails.description}</p>
              <div className="rounded-lg border border-accent-teal bg-primary-plum/30 p-4">
                <div className="text-xs uppercase text-text-mana/55">Selected client</div>
                <div className="mt-1 font-display text-lg text-text-mana">{activeUnit?.name || 'No client selected'}</div>
                {activeUnit && (
                  <div className="mt-2 space-y-1 text-sm text-text-mana/70">
                    <div>{activeUnit.contactEmail || 'No email address saved'}</div>
                    <div>Contract: ${(activeUnit?.ContractValue ?? activeUnit?.contractValue ?? 0).toLocaleString()}</div>
                    {activeModal === 'S' && (
                      <div>
                        One-third reference: ${(Math.round(((activeUnit?.ContractValue ?? activeUnit?.contractValue ?? 0) / 3) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                    {activeModal === 'S' && (
                      <div>One-third reference: ${(Math.round((activeUnit.contractValue / 3) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    )}
                    <div>Milestone: {activeUnit.currentMilestone}</div>
                  </div>
                )}
              </div>
              {activeModal === 'Q' && !activeUnit?.contactEmail && (
                <p className="text-sm text-alert-orange">Add a contact email to pre-fill the recipient.</p>
              )}
              <a
                href={finalActionHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onLogTerminal?.(`${actionDetails.title} opened${activeUnit ? ` for ${activeUnit.name}` : ''}.`, 'action')}
                className="block rounded-lg bg-alert-orange px-4 py-3 text-center font-accent text-bg-obsidian"
              >
                {actionDetails.action}
              </a>
            </div>
          )}

          {activeModal === 'MENU' && (
            <div className="space-y-4 text-sm text-text-mana">
              <p>Session Zero Solutions workspace preferences.</p>
              <button onClick={onClose} className="w-full rounded-lg border border-accent-teal px-4 py-3 hover:border-alert-orange">
                Close settings
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
