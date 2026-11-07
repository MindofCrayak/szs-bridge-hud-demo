import type { ClientRecord, ClientUnit } from '../types';

/**
 * Parking lot D4 (2026-11-04): the OSINT, Symphony, Client Directory and command-modal screens were written for
 * the old demo `ClientUnit` shape and were handed live `ClientRecord`s with `as any`, so they showed blank names
 * and $NaN. This maps a live record onto that shape (live fields are kept too, via `Partial<ClientRecord>`).
 */
export function toClientUnit(client: ClientRecord): ClientUnit {
  const projects = client.activeProjects ?? [];
  const stages = projects.map((project) => project.SprintStage).filter(Boolean).sort();
  const total = projects.reduce((sum, project) => sum + (Number(project.MilestonesTotal) || 0), 0);
  const done = projects.reduce((sum, project) => sum + (Number(project.MilestonesDone) || 0), 0);
  const titles = projects.map((project) => project.Title).filter(Boolean);
  return {
    ...client,
    id: client.ClientID,
    name: client.Company_Name || client.PrimaryContact || client.ClientID,
    companyName: client.Company_Name || client.ClientID,
    primaryContact: client.PrimaryContact,
    contactEmail: client.ContactEmail,
    contractValue: Number(client.ContractValue) || 0,
    depositPaid: Boolean(client.DepositPaid),
    driveFolderUrl: client.DriveFolderUrl,
    notesDocUrl: client.NotesDocUrl,
    chatSpaceUrl: client.ChatSpaceUrl,
    googleGroupEmail: client.GoogleGroupEmail,
    pipelineStage: client.AccountPhase,
    totalMilestones: total,
    completedMilestones: done,
    currentMilestone: stages[stages.length - 1] ?? 'No project',
    serviceArea: titles.join(', ') || client.Tech_Stack || `${projects.length} project${projects.length === 1 ? '' : 's'}`,
    posX: client.posX ?? 0,
    posY: client.posY ?? 0,
    taskListId: projects[0]?.Google_Tasklist_ID,
  };
}
