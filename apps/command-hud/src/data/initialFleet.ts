import { CommandAbility } from '../types';

export const COMMAND_ABILITIES: CommandAbility[] = [
  { key: 'Q', label: 'Pre-fill Gmail', action: 'Pre-fill Gmail', icon: 'fa-solid fa-envelope', description: 'Draft an email to the selected client.' },
  { key: 'W', label: 'Open Chat Space', action: 'Open Chat Space', icon: 'fa-solid fa-comments', description: 'Open the client conversation in Chat.' },
  { key: 'E', label: 'Schedule Meet', action: 'Schedule Meet', icon: 'fa-solid fa-video', description: 'Schedule a Google Meet with the selected client.' },
  { key: 'A', label: 'New Project Onboarding', action: 'New Project Onboarding', icon: 'fa-solid fa-folder-plus', description: 'Start a new client onboarding project.' },
  { key: 'S', label: 'Draft Milestone Invoice', action: 'Draft Milestone Invoice', icon: 'fa-solid fa-file-invoice-dollar', description: 'Prepare the next milestone invoice draft for the selected client.' },
  { key: 'D', label: 'Open Google Tasks Checklist', action: 'Open Google Tasks Checklist', icon: 'fa-solid fa-tasks', description: 'Review the selected client’s task checklist.' },
  { key: 'Z', label: 'Oracle (Quarantined)', action: 'Oracle Quarantined', icon: 'fa-solid fa-eye', description: 'Oracle MMD is excluded from the Command HUD package.', disabled: true },
  { key: 'X', label: 'Open Meeting Notes Doc', action: 'Open Meeting Notes Doc', icon: 'fa-solid fa-file-lines', description: 'Open the selected client’s meeting notes document.' },
  { key: 'C', label: 'Compliance Check', action: 'Compliance Check', icon: 'fa-solid fa-shield-halved', description: 'Audit the active client for required folders, docs, and provisioning gaps.' }
];
