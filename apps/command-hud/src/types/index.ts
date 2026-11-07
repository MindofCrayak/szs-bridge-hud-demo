export type AccountPhase =
  | '01: Intake'
  | '02: Session Zero'
  | '03: Active Sprints'
  | '04: Liftoff'
  | '05: Complete'
  | '06: Archived/Sunset';

export type SprintStage =
  | '00: Discovery'
  | '01: Vibecheck'
  | '02: Contract & Inception'
  | '03: Deep Intelligence'
  | '04: Session Zero Kickoff'
  | '05: Architecture & Builds'
  | '06: Mid-Flight Review'
  | '07: Final Staging & QA'
  | '08: Liftoff & Handover'
  | '09: Sunset / Retainer';

export interface ProjectRecord {
  ProjectID: string;
  ClientID: string;
  SprintStage: SprintStage;
  MilestonesTotal: number;
  MilestonesDone: number;
  AssignedRateTier: 'Normal' | 'Premium' | 'Reduced' | 'Fixed';
  Title?: string;
  Est_Hours?: number;
  Actual_Hours?: number;
  Google_Tasklist_ID?: string;
  SOW_DocID?: string;
  Project_Brief_DocID?: string;
  Project_Outline_DocID?: string;
  COMS_Sheet_URL?: string;
  MeetingNotes_DriveFolderID?: string;
  ChatSpace_URL?: string;
  ChatSpace_Internal_URL?: string;
  Dashboard_Sheet_ID?: string;
  /** Day 0 of the 45-day cadence (ISO). */
  Kickoff_Date?: string;
  ParentProjectID?: string;
  AddendumRef?: string;
  /** This project's installed services (Projects.ActiveComponents). */
  ActiveComponents?: string[];
}

/** Per-client view of the Finances ledger (Plan v3.1 D4). */
export interface ClientFinanceSummary {
  remainingBalance: number;
  estimatedTax: number | null;
  netMargin: number | null;
  invoices: { InvoiceID: string; ProjectID?: string; MilestoneStage?: string; Amount: number; Status: string }[];
}

export interface ClientRecord {
  ClientID: string;
  Company_Name: string;
  PrimaryContact: string;
  ContactEmail: string;
  AccountPhase: AccountPhase;
  AccountPhase_Mode?: 'auto' | 'manual';
  SheetAccountPhase?: AccountPhase;
  /** Contract total from the Finances roll-up (sum of the client's contract-row TCVs) when contract rows exist. */
  ContractValue: number;
  /** The value typed in Clients.ContractValue; differs from ContractValue when Police R1 would fire. */
  SheetContractValue?: number;
  ContractValueSource?: 'finances' | 'clients';
  GoogleGroupEmail?: string;
  Tech_Stack?: string;
  MCC_Subscriber_ID?: string;
  /** Master Control reference only; no Oracle internals enter the HUD. */
  Oracle_Baseline_ID?: string;
  finance?: ClientFinanceSummary;
  DepositPaid: boolean;
  DriveFolderUrl: string;
  NotesDocUrl: string;
  MSA_DocID: string;
  SOW_DocID: string;
  ChatSpaceUrl: string;
  activeProjects: ProjectRecord[];
  activePebble?: string;
  roadblock?: string;
  avatar?: string;
  archetype?: string;
  caseFileJsonUrl?: string;
  osintGenerated?: boolean;
  leadSource?: string;
  activeComponents?: string[];
  posX?: number;
  posY?: number;
}

// ── MODULE 4: ENTITY COMPONENT SYSTEM (ECS) SERVICE REGISTRY ─────────────
export type ClientEntity = {
  id: string;
  name: string;
  activeComponents: string[];
};

export interface ServiceComponent {
  id: string;
  name: string;
  category: 'INFRA' | 'LEGAL' | 'AI' | 'DELIVERY' | 'GROWTH';
  /** Template repository tab whose tasks this component adds (Master Control DOLORES_COMPONENT_TABS). */
  templateTab?: string;
  /** 0 = not priced yet. */
  price: number;
  description: string;
  tasksToInject: string[];
  legalClauses: string[];
}

export type ViewportContext = 'GLOBAL' | 'CLIENT_WORKBENCH';

export interface ClientUnit extends Partial<ClientRecord> {
  id: string;
  name: string;
  companyName: string;
  primaryContact?: string;
  contactEmail?: string;
  contractValue: number;
  depositPaid: boolean;
  driveFolderUrl?: string;
  notesDocUrl?: string;
  chatSpaceUrl?: string;
  notes?: string;
  pipelineStage: string;
  totalMilestones: number;
  completedMilestones: number;
  currentMilestone: string;
  serviceArea: string;
  posX: number;
  posY: number;
  isDraft?: boolean;
  taskListId?: string;
  googleGroupEmail?: string;
}

export type ScreenView = 
  | 'dashboard' 
  | 'pipeline' 
  | 'osint' 
  | 'symphony' 
  | 'treasure' 
  | 'archive' 
  | 'cockpit'
  | 'clients' 
  | 'actions';

export type CommandKey = 'Q' | 'W' | 'E' | 'A' | 'S' | 'D' | 'Z' | 'X' | 'C';

export interface CommandAbility {
  key: CommandKey;
  label: string;
  action: string;
  icon: string;
  description: string;
  disabled?: boolean;
}

export interface TerminalLog {
  id: string;
  time: string;
  text: string;
  type: 'normal' | 'action' | 'server' | 'alert';
}

export interface HudTelemetry {
  pipelineMrr: number;
  activeSprints: number;
  missingDeposits: number;
  activeAlertsCount: number;
  lastSynced: string;
}

export interface AlfredAlert {
  id: string;
  timestamp: string;
  severity: string;
  subRoutine: string;
  clientId: string;
  companyName: string;
  message: string;
  dismissed: boolean;
  actionStatus?: string;
  /** Flag Blocker alerts only: the blocker note (Trigger_Condition "Blocker: <note>"). */
  blockerNote?: string;
}

export type ActiveModal = CommandKey | 'MENU' | null;


// ============================================================================
// 🛰️ HUD SCHEMA CONTRACT: NODE TAXONOMY & DISCRIMINATED UNIONS
// ============================================================================

export type NodeCategory = 
  | 'structural' 
  | 'entity' 
  | 'template' 
  | 'automation' 
  | 'financial';

export type SubRoutinePersona = 
  | 'Alfred' 
  | 'Pamela' 
  | 'Oracle' 
  | 'Dolores' 
  | 'Vala' 
  | 'Daisy';

export interface BaseHudNodeData {
  id: string;                          // Unique instance ID (e.g., "node_proj_ICA_01")
  category: NodeCategory;              // Architectural bucket
  label: string;                       // Primary UI display title
  status: 'idle' | 'active' | 'blocked' | 'complete' | 'error';
  isLocked?: boolean;                  // Prevents canvas movement if true
  assignedPersona?: SubRoutinePersona; // Persona owner for telemetry badges
  metadata?: Record<string, unknown>;  // Arbitrary execution cache
}

// React Flow wrapper
export interface HudNode<TData extends BaseHudNodeData = BaseHudNodeData> {
  id: string;
  type: string;                        // Registered custom component identifier
  position: { x: number; y: number };
  data: TData;
  parentNode?: string;                 // Set when nested inside a Structural Zone
  extent?: 'parent' | undefined;       // Clamps movement inside parent bounds
  width?: number;
  height?: number;
}

export interface HudEdgeData {
  edgeType: 'data_pipe' | 'logic_gate' | 'financial_funnel' | 'dependency';
  isActive: boolean;
  validationError?: string;
}

// ============================================================================
// 1. STRUCTURAL NODES (The Constants)
// ============================================================================

// 1.1 Master Stage / Zone Node (Canvas Boundary & Phase Gate)
export interface MasterStageZoneData extends BaseHudNodeData {
  category: 'structural';
  zoneType: 'MACRO_ACCOUNT' | 'MICRO_SPRINT';
  
  accountPhase?: AccountPhase;
    
  sprintStage?: SprintStage;

  boundingDimensions: { width: number; height: number };
  allowedEntityTypes: ('lead' | 'project' | 'deliverable')[];
  ironGateActive: boolean;              // Strict check: Blocks entry if conditions fail (e.g., Missing Deposit)
}

// 1.2 Subsystem / Department Node
export interface SubsystemDepartmentData extends BaseHudNodeData {
  category: 'structural';
  department: 'Leadership' | 'Intake' | 'Intelligence' | 'Operations' | 'Finance' | 'Retention';
  persona: SubRoutinePersona;
  inboxQueueCount: number;
  routingChannelUrl?: string;          // Internal Google Chat space link
}

// 1.3 Pipeline Router Node (Branching Logic)
export interface PipelineRouterData extends BaseHudNodeData {
  category: 'structural';
  routingStrategy: 'parallel_split' | 'conditional_branch' | 'merge_join';
  conditions: Array<{
    targetHandleId: string;
    expression: string;                // e.g., "scope.type === 'FULL_BUILD'"
  }>;
}

// ============================================================================
// 2. ENTITY NODES (The Moving Data-Carriers)
// ============================================================================

// 2.1 Lead / Client Contact Node (Macro Level)
export interface LeadContactData extends BaseHudNodeData {
  category: 'entity';
  clientId: string;                    // e.g., "ICA"
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  accountPhase: AccountPhase;
  estimatedValue: number;
  depositPaid: boolean;
}

// 2.2 Project Node (Primary Delivery Anchor - Micro Level)
export interface ProjectNodeData extends BaseHudNodeData {
  category: 'entity';
  projectId: string;                   // e.g., "PAC-26-01"
  clientId: string;                    // Foreign Key: "ICA"
  companyName: string;
  sprintStage: SprintStage;
  assignedRateTier: 'Normal ($85)' | 'Premium ($115)' | 'Reduced ($65)' | 'Blueprint ($2,500)';
  contractValue: number;
  depositCleared: boolean;
  driveFolderId: string;               // Permanent Google Drive Directory ID
  sowDocId?: string;
  msaDocId?: string;
  activeRoadblock?: string;
}

// 2.3 Deliverable / Artifact Node
export interface DeliverableArtifactData extends BaseHudNodeData {
  category: 'entity';
  deliverableId: string;
  projectId: string;                   // Foreign Key
  artifactType: 'sow_contract' | 'case_file' | 'sourcebook_deck' | 'code_repo' | 'workspace_tenant';
  storageUrl: string;                  // Direct asset URL / Drive view URL
  driveFileId: string;
  isSignedOrApproved: boolean;
  version: number;
}

// 2.4 Competitor Entity Node (Oracle Sandbox)
export interface CompetitorEntityData extends BaseHudNodeData {
  category: 'entity';
  targetId: string;
  clientId: string;                    // Foreign Key to the client being analyzed
  domain: string;
  verificationStatus: 'Candidate' | 'Verified' | 'Disqualified';
  threatLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  gbpScore?: number;
  reviewCount?: number;
  scrapedKeywords: string[];
}

// ============================================================================
// 3. TEMPLATE & COMPONENT NODES (The Subsystems)
// ============================================================================

// 3.1 Feature / Service Blueprint Node
export interface ServiceBlueprintData extends BaseHudNodeData {
  category: 'template';
  blueprintId: string;
  serviceCategory: 'Core Setups' | 'Custom Automations' | 'Maintenance';
  serviceName: string;
  defaultHoursEstimate: number;
  rateTier: 'Normal ($85)' | 'Premium ($115)' | 'Reduced ($65)' | 'Blueprint ($2,500)';
  fixedPackagePrice?: number;
  sowLineItemTemplate: string;         // Pre-formatted legal/SOW description
}

// 3.2 Document / Paperwork Template Node
export interface DocumentTemplateData extends BaseHudNodeData {
  category: 'template';
  templateDriveId: string;             // Immutable Master Doc/Sheet Template ID
  docType: 'MSA' | 'SOW' | 'INVOICE' | 'CASE_FILE' | 'SOURCEBOOK';
  requiredTags: string[];              // e.g., ["{{COMPANY_NAME}}", "{{DEPOSIT_AMOUNT}}"]
  targetFolderSubpath: string;         // e.g., "00 Legal and Admin/Invoices"
}

// 3.3 Task List / Checklist Node
export interface TaskListChecklistData extends BaseHudNodeData {
  category: 'template';
  checklistId: string;
  tasklistTitle: string;
  tasks: Array<{
    taskId: string;
    description: string;
    estimatedMinutes: number;
    isMilestoneGate: boolean;
    assignedPersona: SubRoutinePersona;
  }>;
}

// ============================================================================
// 4. FUNCTIONAL & AUTOMATION NODES (The Engines)
// ============================================================================

// 4.1 Drip Engine / Campaign Node (MCC Integration)
export interface DripCampaignData extends BaseHudNodeData {
  category: 'automation';
  campaignId: string;
  newsletterId: string;                // Native MCC target (e.g., "sz_newsletter")
  triggerOnStage: string;              // e.g., "08: Liftoff & Handover"
  delayIntervalDays: number;
  templateShellId: string;
  requiresManualReview: boolean;       // If true, stages in HUD PENDING_APPROVAL
}

// 4.2 Trigger / Gate Node (The Iron Gate Evaluator)
export interface TriggerGateData extends BaseHudNodeData {
  category: 'automation';
  gateName: string;
  evaluationRules: Array<{
    field: string;                     // e.g., "Finances.DepositPaid"
    operator: 'EQUALS' | 'EXISTS' | 'GREATER_THAN';
    targetValue: string | number | boolean;
  }>;
  isUnlocked: boolean;
  bypassAllowed: boolean;
  bypassReason?: string;               // Required if manual operator override is used
}

// 4.3 Webhook / Integration Node
export interface WebhookIntegrationData extends BaseHudNodeData {
  category: 'automation';
  endpointUrl: string;
  httpMethod: 'GET' | 'POST';
  authType: 'BEARER' | 'OAUTH' | 'NONE';
  timeoutMs: number;
  lastRunTimestamp?: string;
  lastResponseStatus?: number;
}

// 4.4 Notification Node (HUD Telemetry & Alerts)
export interface NotificationNodeData extends BaseHudNodeData {
  category: 'automation';
  alertId: string;                     // ALT-XXXX
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  dispatchTarget: 'HUD_TELEMETRY' | 'ALFRED_DRAWER' | 'EXTERNAL_CHAT';
  messagePattern: string;              // String with token replacement support
  isDismissed: boolean;
}

// ============================================================================
// 5. FINANCIAL & TRANSACTIONAL NODES (The Ledgers)
// ============================================================================

// 5.1 Ledger / Retainer Node
export interface LedgerRetainerData extends BaseHudNodeData {
  category: 'financial';
  clientId: string;
  totalContractValue: number;
  totalDepositAmount: number;
  balanceRemaining: number;
  quarterlyTaxReserve: number;         // Dynamic 25% tax allocation
  overheadCostSum: number;
  netMarginPercent: number;
}

// 5.2 Invoice Node (Milestone Extraction)
export interface InvoiceNodeData extends BaseHudNodeData {
  category: 'financial';
  invoiceId: string;                   // INV-PAC-26-01
  projectId: string;
  milestoneStage: 'Deposit (1/3)' | 'Mid-Flight (1/3)' | 'Liftoff & QA (1/3)' | 'Retainer / Maintenance';
  invoiceAmount: number;
  invoiceStatus: 'Draft' | 'Sent' | 'Paid' | 'Void' | 'Overdue';
  invoiceDriveDocId?: string;
  paymentDate?: string;
  autoAdvanceTargetStage?: string;     // Advances Project node on status = "Paid"
}

// 5.3 Time-Log Node
export interface TimeLogNodeData extends BaseHudNodeData {
  category: 'financial';
  logId: string;
  projectId: string;
  assignedRateTier: 'Normal ($85)' | 'Premium ($115)' | 'Reduced ($65)' | 'Blueprint ($2,500)';
  hourlyRate: number;
  hoursWorked: number;
  effectiveHourlyRate: number;         // (InvoiceAmount - Overhead) / ActualHours
  billingPeriod: string;
}

// ============================================================================
// 6. DISCRIMINATED UNION & REGISTRY
// ============================================================================
export type HudNodeData =
  | MasterStageZoneData
  | SubsystemDepartmentData
  | PipelineRouterData
  | LeadContactData
  | ProjectNodeData
  | DeliverableArtifactData
  | CompetitorEntityData
  | ServiceBlueprintData
  | DocumentTemplateData
  | TaskListChecklistData
  | DripCampaignData
  | TriggerGateData
  | WebhookIntegrationData
  | NotificationNodeData
  | LedgerRetainerData
  | InvoiceNodeData
  | TimeLogNodeData;

export type CanvasNode = HudNode<HudNodeData>;

/** Phase E5 "Send to client": preview (read-only) then an audited post to the client Chat Space. */
export interface ClientSendDraft {
  text: string; warnings: string[]; overdue: number; spaceUrl: string;
  /** Final message: posting also archives the client folder to Sanctum Inactive. */
  finalAllowed: boolean; finalReason: string; final: boolean;
}

/** Per-project send state, held in App so it survives the Dossier bay collapsing (owner feedback 2026-11-05). */
export type ClientSendState =
  | { step: 'idle'; lastSent?: { at: string; messageName: string; spaceUrl: string } }
  | { step: 'loading'; lastSent?: { at: string; messageName: string; spaceUrl: string } }
  | ({ step: 'preview'; error?: string; lastSent?: { at: string; messageName: string; spaceUrl: string } } & ClientSendDraft)
  | ({ step: 'sending'; lastSent?: { at: string; messageName: string; spaceUrl: string } } & ClientSendDraft)
  | { step: 'sent'; lastSent: { at: string; messageName: string; spaceUrl: string } }
  | { step: 'error'; message: string; lastSent?: { at: string; messageName: string; spaceUrl: string } };

/** Phase E6: a Google Tasks item as the HUD shows it (read from hud_getProjectTasks). */
export interface HudTask {
  id: string;
  title: string;
  status: 'needsAction' | 'completed';
  /** YYYY-MM-DD or '' */
  due: string;
  /** '' for top-level tasks */
  parentId: string;
  audience: 'client' | 'internal';
  /** Notes without the Audience/Start/Key header block. */
  notes: string;
  /** From the notes header (Phase F Gantt): YYYY-MM-DD or ''. */
  start: string;
  /** Template Key (`<tab>::<slug>`) or ''. */
  key: string;
  /** Template Is_Milestone (Master Control milestoneKeys). */
  milestone: boolean;
}

export interface TaskDraft { title: string; due: string; notes: string; parentId: string; clientFacing: boolean }

/** Phase E6: task reads and audited task writes, attached to the Client Dossier bay's Projects section. */
export interface ProjectTaskHandlers {
  tasks: Record<string, HudTask[]>;
  loading: ReadonlySet<string>;
  errors: Record<string, string>;
  /** Write keys in flight: `task:<projectId>/<taskId>` and `task:<projectId>/new`. */
  pendingWriteKeys: ReadonlySet<string>;
  /** The project whose task panel is open; the Dossier bay stays open while it is set. */
  openProjectId: string | null;
  open: (projectId: string) => void;
  close: () => void;
  reload: (projectId: string) => void;
  /** Resolves true once Master Control confirms the new task on read-back. */
  create: (projectId: string, draft: TaskDraft) => Promise<boolean>;
  setDone: (projectId: string, taskId: string, done: boolean) => void;
}

export interface ClientCommsHandlers {
  states: Record<string, ClientSendState>;
  /** True while any project has a draft open, a preview loading, or a post in flight: the Dossier bay stays open. */
  busy: boolean;
  preview: (projectId: string) => void;
  edit: (projectId: string, text: string) => void;
  send: (projectId: string) => void;
  close: (projectId: string) => void;
  setFinal: (projectId: string, final: boolean) => void;
}
