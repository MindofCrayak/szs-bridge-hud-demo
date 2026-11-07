export type OperationalTrack = 'trade_contractor' | 'ttrpg_indie';

export type MaturityTier = 0 | 1 | 2;

export interface ClientProfile {
  id: string;
  name: string;
  track: OperationalTrack;
  maturityTier: MaturityTier;
  primaryHorizon: string;
  weeklyHours: number;
  monthlyBudget: number;
  websiteUrl: string;
  seedCompetitors: string[];
  status: 'Intake' | 'Audited' | 'In Execution' | 'Completed';
  createdDate: string;
}

export interface CompetitorBracketEntity {
  name: string;
  role: 'aspirational_1' | 'aspirational_2' | 'client' | 'lateral_1' | 'lateral_2';
  roleLabel: string; // e.g. "Aspirational Leader", "Center Anchor (Client)", "Lateral Competitor"
  websiteOrHandle: string;
  authorityScore: number; // 1 to 10
  audienceScale: string; // e.g. "15k Backers / 4.2k Discord" or "480 Google Reviews (4.9★)"
  primaryBattleground: string; // e.g. "BackerKit Pre-launch & Actual Play" or "Local Pack 3-Pack & Referral Radii"
  coreStrength: string;
  criticalVulnerabilityOrGap: string;
  evidenceBadge: string;
}

export interface MediaChannelAudit {
  channel: string;
  clientStatus: string;
  aspirationalBenchmark: string;
  lateralBenchmark: string;
  strategicAssessment: string;
}

export interface GapMatrix3Column {
  doingWell: { title: string; detail: string; impact: 'High' | 'Medium' }[];
  doingBetter: { title: string; competitor: string; detail: string; counterTactic: string }[];
  needToAddWhitespace: { title: string; rationale: string; commercialValue: string }[];
}

export interface ICPProfile {
  personaName: string;
  demographics: string;
  corePainPoints: string[];
  buyingOrBackingTriggers: string[];
  primaryHangoutsAndChannels: string[];
  antiPersona: string;
}

export interface PositioningDossier {
  categoryAnchor: string;
  tenSecondElevatorPitch: string;
  contrastWedgeAgainstRivals: string;
  uniqueValueProposition: string;
  proofPillars: string[];
}

export interface RoadmapMilestone {
  id: string;
  phase: 1 | 2 | 3 | 4;
  phaseName: string;
  targetMonthRange: string;
  description: string;
  targetMonth: number;
  completed: boolean;
  estimatedWeeklyHours: number;
  expectedDeliverable: string;
  notes?: string;
}

export interface ChannelPrioritization {
  tier1Primary: {
    channel: string;
    cadence: string;
    allocatedHoursWeekly: number;
    objective: string;
  };
  tier2Secondary: {
    channel: string;
    cadence: string;
    allocatedHoursWeekly: number;
    objective: string;
  };
  tier3Maintenance: {
    channel: string;
    cadence: string;
    allocatedHoursWeekly: number;
    objective: string;
  };
  hoursRealityCheck: {
    totalRequiredHours: number;
    clientCapacityHours: number;
    sustainable: boolean;
    mitigationStrategy: string;
  };
}

export interface StrategicAllies {
  nonCompetingPartners: { partnerType: string; exampleTargets: string; referralMechanism: string }[];
  ecosystemHubs: { hubName: string; accessMethod: string; expectedYield: string }[];
  referralLoopDesign: string;
}

export interface SourcebookSlideContent {
  slideNumber: number;
  title: string;
  subtitle: string;
  bulletPoints?: string[];
  speakerNotes: string;
  customData?: any;
}

export interface SessionZeroSourcebook {
  clientId: string;
  clientName: string;
  track: OperationalTrack;
  maturityTier: MaturityTier;
  generatedDate: string;
  modelUsed: string;
  thoughtLeadershipScore: number; // 1 to 10
  slidesUrl?: string;

  // 10 Slides Data
  slide1_TitleScope: {
    title: string;
    clientName: string;
    trackLabel: string;
    executiveAdvisor: string;
    scopeSummary: string;
    auditDate: string;
    speakerNotes: string;
  };
  slide2_StrategicBaseline: {
    title: string;
    maturityTier: MaturityTier;
    maturityLabel: string;
    weeklyHours: number;
    monthlyBudget: number;
    capacityVerdict: string;
    constraintRealityCheck: string;
    primaryHorizon: string;
    speakerNotes: string;
  };
  slide3_Bracket: {
    title: string;
    entities: CompetitorBracketEntity[];
    strategicTakeaway: string;
    speakerNotes: string;
  };
  slide4_DeepDive: {
    title: string;
    channels: MediaChannelAudit[];
    speakerNotes: string;
  };
  slide5_GapMatrix: {
    title: string;
    diagnostic: GapMatrix3Column;
    speakerNotes: string;
  };
  slide6_ICP: {
    title: string;
    icp: ICPProfile;
    speakerNotes: string;
  };
  slide7_Positioning: {
    title: string;
    positioning: PositioningDossier;
    speakerNotes: string;
  };
  slide8_Roadmap: {
    title: string;
    phases: {
      phase: 1 | 2 | 3 | 4;
      name: string;
      monthRange: string;
      focus: string;
      keyMilestones: string[];
    }[];
    speakerNotes: string;
  };
  slide9_ChannelWaterfall: {
    title: string;
    waterfall: ChannelPrioritization;
    speakerNotes: string;
  };
  slide10_AlliesEcosystem: {
    title: string;
    allies: StrategicAllies;
    speakerNotes: string;
  };

  milestones: RoadmapMilestone[];
}
