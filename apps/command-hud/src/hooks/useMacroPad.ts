import { useMemo } from 'react';
import { CommandAbility, CommandKey, ViewportContext, ClientRecord } from '../types';
import { COMMAND_ABILITIES } from '../data/initialFleet';

export function useMacroPad(
  context: ViewportContext = 'GLOBAL',
  activeClient: ClientRecord | null = null,
  onTriggerCommand?: (key: CommandKey) => void,
) {
  const abilities = useMemo<CommandAbility[]>(() => {
    if (context === 'CLIENT_WORKBENCH' && activeClient) {
      // Retargeted Tier 2 (Workbench) bindings to the active client's satellite nodes
      return [
        {
          key: 'Q',
          label: 'Client Gmail',
          action: 'Pre-fill Client Gmail',
          icon: 'fa-solid fa-envelope',
          description: `Open pre-filled draft to ${activeClient.Company_Name} primary contact.`,
        },
        {
          key: 'W',
          label: 'Chat Space',
          action: 'Open Client Chat Space',
          icon: 'fa-solid fa-comments',
          description: `Jump into Google Chat Space for ${activeClient.ClientID}.`,
        },
        {
          key: 'E',
          label: 'Meet Invite',
          action: 'Schedule Meet w/ Client',
          icon: 'fa-solid fa-video',
          description: `Create Google Meet invitation for ${activeClient.Company_Name}.`,
        },
        {
          key: 'A',
          label: 'View SOW',
          action: 'View Active SOW',
          icon: 'fa-solid fa-file-contract',
          description: `Open current Statement of Work document in Drive.`,
        },
        {
          key: 'S',
          label: '1/3 Invoice',
          action: 'Trigger 1/3rd Milestone Invoice',
          icon: 'fa-solid fa-file-invoice-dollar',
          description: `Draft milestone invoice ($${Math.round((activeClient.ContractValue || 0) / 3).toLocaleString()}).`,
        },
        {
          key: 'D',
          label: 'Tasks List',
          action: 'Open Client Tasks Punch-list',
          icon: 'fa-solid fa-tasks',
          description: `Inspect active Google Tasks checklist for ${activeClient.ClientID}.`,
        },
        {
          key: 'Z',
          label: 'Oracle OSINT',
          action: 'Run Oracle OSINT Sweep',
          icon: 'fa-solid fa-eye',
          description: `Gather public dossier and competitive vectors for ${activeClient.Company_Name}.`,
        },
        {
          key: 'X',
          label: 'Meeting Notes',
          action: 'Open Client Meeting Notes',
          icon: 'fa-solid fa-file-lines',
          description: `Open Google Docs meeting ledger.`,
        },
        {
          key: 'C',
          label: 'Pitch Deck',
          action: 'Open Client Pitch Deck',
          icon: 'fa-solid fa-chalkboard',
          description: `Review Google Slides presentation deck.`,
        },
      ];
    }

    // Default: Tier 1 (Global) Bindings
    return COMMAND_ABILITIES;
  }, [context, activeClient]);

  const trigger = (key: CommandKey) => {
    onTriggerCommand?.(key);
  };

  return {
    abilities,
    trigger,
    context,
  };
}
