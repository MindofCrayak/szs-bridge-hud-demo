import React, { useState } from 'react';
import { ClientUnit } from '../types';

interface OsintWarRoomViewProps {
  units: ClientUnit[];
  activeUnit: ClientUnit | null;
  onSelectUnit: (id: string) => void;
  onNavigateToDashboard: () => void;
  onLogTerminal: (message: string, type?: 'normal' | 'action' | 'server' | 'alert') => void;
}

interface CompetitorData {
  tier: 'Tier 1: Aspirational' | 'Tier 2: Battleground' | 'Tier 3: Lateral / Niche';
  name: string;
  gbpRank: number;
  reviewVelocity: number;
  schemaScore: number;
  citationDensity: number;
  siteSpeedMs: number;
  vulnerability: string;
  notes: string;
}

interface KgrItem {
  query: string;
  monthlySearch: number;
  allintitle: number;
  ratio: number;
  status: 'EXCELLENT (<0.25)' | 'VIABLE (<0.25)' | 'COMPETITIVE (>0.25)';
  intent: string;
  mccHook: string;
}

const DECK_SLIDES = [
  {
    slideNumber: 1,
    title: 'Executive Mission & Strategic Thesis',
    subtitle: 'Session Zero Solutions · Operational Overhaul',
    points: [
      'Comprehensive audit of market position, technical footprint, and operational bottlenecks.',
      'Transition from fragmented SaaS subscriptions to unified Google Workspace delivery pipeline.',
      'Estimated annual operational efficiency uplift: +38% throughput, $22,200 SaaS savings.',
    ],
  },
  {
    slideNumber: 2,
    title: 'Market Topology & 6-Competitor Bracket',
    subtitle: 'Competitive Landscape Analysis across 3 Strategic Tiers',
    points: [
      'Tier 1 (Aspirational): Heavy brand moats but legacy monolith tech debt and high bounce rates.',
      'Tier 2 (Battleground): Direct local contenders competing aggressively on Google Local Service Ads.',
      'Tier 3 (Lateral/Niche): Fragmented citation graphs and missing structured data schemas.',
    ],
  },
  {
    slideNumber: 3,
    title: 'Target Reconnaissance & Technical Audit',
    subtitle: 'Domain Authority, Core Web Vitals & Local Search Authority',
    points: [
      'Core Web Vitals Speed Index: 94/100 (FCP 0.8s, LCP 1.9s, CLS 0.02).',
      'Google Business Profile (GBP) 3-Pack presence established with 4.9 average review velocity.',
      'Structured data validation: Missing Organization & FAQ JSON-LD schemas identified for deployment.',
    ],
  },
  {
    slideNumber: 4,
    title: 'SaaS Bloat & Redundancy Extraction',
    subtitle: 'Consolidating Multi-App Subscriptions into Google Workspace',
    points: [
      'Identified duplicate PM tooling: Asana ($520/mo) + Monday.com ($340/mo) running concurrently.',
      'Messaging fragmentation: Slack Pro ($480/mo) duplicative with Google Chat Spaces.',
      'Total annual SaaS waste eliminated: $22,200 redirected to core client delivery.',
    ],
  },
  {
    slideNumber: 5,
    title: 'Keyword Golden Ratio (KGR) Arbitrage',
    subtitle: 'High-Intent Search Terms with Guaranteed Rapid Indexing',
    points: [
      'Identified 6 high-converting queries with KGR ratios < 0.15 (allintitle < 25 per 300+ searches).',
      'Direct pipeline connection to Daisy MCC for automated search-intent email broadcasts.',
      'Target organic traffic ramp: +1,800 monthly qualified commercial visitors within 90 days.',
    ],
  },
  {
    slideNumber: 6,
    title: 'Sentiment Vulnerabilities & Competitor Exploits',
    subtitle: 'Customer Review Friction Gaps in Competing Services',
    points: [
      'Competitor Review Audit reveals 41% complaint rate regarding "unclear milestone invoices".',
      '32% of customers report project delivery delays with zero real-time progress visibility.',
      'Session Zero Countermeasure: Iron Gate deposit enforcement and transparent Kanban telemetry.',
    ],
  },
  {
    slideNumber: 7,
    title: '10-Stage Delivery Pipeline Architecture',
    subtitle: 'From Intake to Liftoff: Zero Unbilled Scope',
    points: [
      'Intake (Stages 00–01): Automated Google Forms discovery, AI pitch generation.',
      'Session Zero (Stages 02–03): MSA execution, 35% deposit gate, Deep OSINT dossier.',
      'Active Sprints (Stages 04–07) & Liftoff (Stages 08–09): Google Tasklist syncing and retainer offboarding.',
    ],
  },
  {
    slideNumber: 8,
    title: 'Google Workspace Native Integration',
    subtitle: 'Drive, Docs, Sheets, Calendar, Meet & Chat Spaces',
    points: [
      'Zero 3rd-party database lock-in: Google Sheets functions as the SSOT database.',
      'Auto-generated folder trees per client with granular OAuth permission governance.',
      'Shared client Chat Space for real-time async communication without Slack licensing.',
    ],
  },
  {
    slideNumber: 9,
    title: '90-Day Execution Roadmap & Sprints',
    subtitle: 'Dolores Herbig Sprint Cadence & Deliverable Schedule',
    points: [
      'Weeks 1–2: Inception, Brand DNA, and Google Workspace Drive/Folder infrastructure provisioning.',
      'Weeks 3–6: Core engineering sprints, custom Apps Script automations, and CRM integration.',
      'Weeks 7–10: User acceptance testing, KGR content publishing, and staff onboarding.',
    ],
  },
  {
    slideNumber: 10,
    title: 'Fiscal ROI & Milestone Payment Matrix',
    subtitle: 'Vala Milestone Schedule & Break-Even Velocity',
    points: [
      'Milestone 1: 35% Upfront Deposit upon MSA & Inception signing (Gated by The Iron Gate).',
      'Milestones 2–4: 15% each upon Alpha build, Beta review, and Final QA sign-off.',
      'Milestone 5: 20% Liftoff & Retainer Transfer upon final Workspace handoff.',
    ],
  },
];

export const OsintWarRoomView: React.FC<OsintWarRoomViewProps> = ({
  units,
  activeUnit,
  onSelectUnit,
  onNavigateToDashboard,
  onLogTerminal,
}) => {
  const currentClient = activeUnit || units[0] || null;
  const [selectedCompetitorName, setSelectedCompetitorName] = useState<string>('Apex Logistics Global');
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isCompilingSlides, setIsCompilingSlides] = useState<boolean>(false);
  const [slidesCompiledUrl, setSlidesCompiledUrl] = useState<string | null>(null);
  const [isExportingCaseFile, setIsExportingCaseFile] = useState<boolean>(false);

  // 6-Competitor Bracket in 3 Tiers
  const competitors: CompetitorData[] = [
    {
      tier: 'Tier 1: Aspirational',
      name: 'Apex Logistics Global',
      gbpRank: 1,
      reviewVelocity: 94,
      schemaScore: 92,
      citationDensity: 96,
      siteSpeedMs: 510,
      vulnerability: 'Enterprise pricing barrier; zero self-serve client portal; slow email response.',
      notes: 'Market incumbent with high DR 74, but rigid engagement terms and no async chat integration.',
    },
    {
      tier: 'Tier 1: Aspirational',
      name: 'Titan Creative Systems',
      gbpRank: 2,
      reviewVelocity: 89,
      schemaScore: 84,
      citationDensity: 91,
      siteSpeedMs: 740,
      vulnerability: 'Monolithic project quotes; recurring scope creep disputes in public reviews.',
      notes: 'Strong visual portfolio, but bloated 18-person agency overhead passed to client invoices.',
    },
    {
      tier: 'Tier 2: Battleground',
      name: 'Benchmark Climate Masters',
      gbpRank: 3,
      reviewVelocity: 91,
      schemaScore: 65,
      citationDensity: 88,
      siteSpeedMs: 950,
      vulnerability: 'Aggressive Google Local Service Ads, legacy CMS; zero FAQ/Service schema.',
      notes: 'High organic search bounce rate; ad-dependent acquisition that breaks when bids spike.',
    },
    {
      tier: 'Tier 2: Battleground',
      name: 'Tuesday Knight Games',
      gbpRank: 4,
      reviewVelocity: 74,
      schemaScore: 82,
      citationDensity: 79,
      siteSpeedMs: 680,
      vulnerability: 'Strong Discord & Kickstarter presence, but lacks LocalBusiness JSON-LD markup.',
      notes: 'Heavy community engagement but disjointed client onboarding and manual billing.',
    },
    {
      tier: 'Tier 3: Lateral / Niche',
      name: 'Melsonian Arts Council',
      gbpRank: 5,
      reviewVelocity: 68,
      schemaScore: 71,
      citationDensity: 84,
      siteSpeedMs: 820,
      vulnerability: 'UK international logistics footprint; citation graph fragmented across regional TLDs.',
      notes: 'High artistic credibility; zero automated milestone payment tracking.',
    },
    {
      tier: 'Tier 3: Lateral / Niche',
      name: 'Heritage Heating & Air',
      gbpRank: 6,
      reviewVelocity: 52,
      schemaScore: 48,
      citationDensity: 61,
      siteSpeedMs: 1450,
      vulnerability: 'Poor mobile responsiveness (FCP 3.2s); missing Google review verification hooks.',
      notes: 'Legacy phone-dispatch system; ripe for displacement via streamlined Google Workspace CRM.',
    },
  ];

  const selectedCompetitor = competitors.find((c) => c.name === selectedCompetitorName) || competitors[0];

  // KGR Queries & Content Hooks for Daisy's MCC
  const kgrKeywords: KgrItem[] = [
    {
      query: 'session zero facilitator kit',
      monthlySearch: 320,
      allintitle: 18,
      ratio: 0.056,
      status: 'EXCELLENT (<0.25)',
      intent: 'Commercial Investigation',
      mccHook: 'Why traditional discovery meetings fail: The complete Session Zero toolkit.',
    },
    {
      query: 'creative ops workflow blueprint',
      monthlySearch: 480,
      allintitle: 42,
      ratio: 0.087,
      status: 'EXCELLENT (<0.25)',
      intent: 'Transactional / Decision',
      mccHook: 'Cut $1,800/mo in redundant SaaS: The Google Workspace Creative Ops Blueprint.',
    },
    {
      query: 'specialty contractor google drive crm',
      monthlySearch: 210,
      allintitle: 31,
      ratio: 0.147,
      status: 'EXCELLENT (<0.25)',
      intent: 'High Commercial Intent',
      mccHook: 'How top specialty contractors run 6-figure jobs directly inside Google Drive.',
    },
    {
      query: 'ttrpg publisher fulfillment automation',
      monthlySearch: 190,
      allintitle: 38,
      ratio: 0.200,
      status: 'VIABLE (<0.25)',
      intent: 'Problem Solving',
      mccHook: 'Eliminate shipping bottlenecks: Automated Google Sheets fulfillment workflows.',
    },
    {
      query: 'client delivery portal google workspace',
      monthlySearch: 350,
      allintitle: 72,
      ratio: 0.205,
      status: 'VIABLE (<0.25)',
      intent: 'Solution Comparison',
      mccHook: 'Stop paying per-seat fees for client portals: Leverage native Google Drive permissions.',
    },
    {
      query: 'google apps script agency dashboard',
      monthlySearch: 890,
      allintitle: 310,
      ratio: 0.348,
      status: 'COMPETITIVE (>0.25)',
      intent: 'Informational',
      mccHook: 'Building an enterprise-grade agency dashboard with zero monthly software costs.',
    },
  ];

  // Compile Google Slides action
  const handleCompileSlides = () => {
    setIsCompilingSlides(true);
    onLogTerminal(`[ORACLE] Initializing SlidesApp compiler for ${currentClient?.companyName || currentClient?.id}...`, 'action');
    setTimeout(() => {
      setIsCompilingSlides(false);
      const mockDeckUrl = `https://docs.google.com/presentation/d/szs-deck-${currentClient?.id?.toLowerCase() || 'node-01'}/edit`;
      setSlidesCompiledUrl(mockDeckUrl);
      onLogTerminal(`[ORACLE] 10-Slide Battleground Deck compiled to Google Drive: ${mockDeckUrl}`, 'server');
    }, 1200);
  };

  // Export Sanitized case_file.json
  const handleExportCaseFile = () => {
    setIsExportingCaseFile(true);
    const caseFileData = {
      meta: {
        system: 'Session Zero Solutions Airship Command Bridge',
        subroutine: 'Oracle Reconnaissance Nexus',
        timestamp: new Date().toISOString(),
        classification: 'SANITIZED TACTICAL DOSSIER',
      },
      client: {
        id: currentClient?.id || 'SZS-NODE-01',
        name: currentClient?.name || 'Client Node',
        companyName: currentClient?.companyName || 'Session Zero Partner',
        archetype: currentClient?.archetype || 'Creative Studio',
        contractValue: currentClient?.contractValue || 12500,
        depositPaid: currentClient?.depositPaid || false,
        pipelineStage: currentClient?.pipelineStage || '03: Deep Intelligence',
      },
      reconnaissance: {
        domainAuthority: 68,
        pagespeedIndex: 94,
        gbpRank: 1,
        monthlySaasWasteIdentified: 1850,
        saasBloatTools: ['Asana ($520)', 'Monday.com ($340)', 'Slack Pro ($480)', 'Notion ($210)', 'Dropbox ($300)'],
      },
      competitiveBracket: competitors,
      kgrIntelligence: kgrKeywords,
      departmentCrossFeeds: {
        pamelaComplianceScore: '96% (MSA verified)',
        doloresSprintPoints: 42,
        valaCashVelocity: '35% Deposit Gated / 4 Milestones',
        daisyMccHookReady: true,
      },
    };

    const blob = new Blob([JSON.stringify(caseFileData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Case_File_${currentClient?.id || 'CLIENT'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExportingCaseFile(false);
    onLogTerminal(`[ORACLE] Exported sanitized Case_File_${currentClient?.id}.json to local workspace.`, 'action');
  };

  const currentSlide = DECK_SLIDES[currentSlideIndex];

  return (
    <main className="flex-1 min-h-0 flex flex-col bg-bg-obsidian text-text-mana p-3 sm:p-5 overflow-y-auto">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-accent-teal/60 pb-3 mb-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent-teal animate-pulse-glow shadow-[0_0_8px_#086375]" />
            <p className="font-mono text-xs uppercase tracking-widest text-accent-teal">Oracle Sub-Routine // Reconnaissance Nexus</p>
          </div>
          <h1 className="font-display text-lg sm:text-xl font-bold text-text-mana">
            Tactical OSINT War Room &amp; Competitive Intelligence Deck
          </h1>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={handleExportCaseFile}
            disabled={isExportingCaseFile}
            className="flex items-center gap-1.5 rounded border border-highlight-gold/60 bg-highlight-gold/15 px-3 py-1.5 font-bold text-highlight-gold hover:bg-highlight-gold/25 transition-colors cursor-pointer"
            title="Download sanitized case_file.json for this client"
          >
            <i className="fa-solid fa-file-export text-hud-4" />
            <span>EXPORT CASE_FILE.JSON</span>
          </button>
          <button
            type="button"
            onClick={onNavigateToDashboard}
            className="flex items-center gap-1.5 rounded border border-accent-teal px-3 py-1.5 font-display text-xs text-text-mana hover:bg-accent-teal/20 transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-diagram-project" />
            <span>Tactical Canvas (Alt+1)</span>
          </button>
        </div>
      </div>

      {/* Client Node Switcher */}
      <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1.5 border-b border-accent-teal/30 flex-shrink-0">
        <span className="font-mono text-hud-3 uppercase text-text-mana/60 shrink-0">Target Node:</span>
        {units.map((u) => {
          const isSelected = u.id === currentClient?.id;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onSelectUnit(u.id);
                onLogTerminal(`[ORACLE] Reconnaissance focus locked onto ${u.companyName || u.name} (${u.id}).`, 'action');
              }}
              className={`rounded px-2.5 py-1 text-xs font-mono font-bold transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? 'border border-highlight-gold bg-primary-plum text-highlight-gold shadow-[0_0_8px_rgba(224,202,60,0.3)] ring-1 ring-highlight-gold'
                  : 'border border-accent-teal/40 bg-bg-obsidian text-text-mana/70 hover:border-accent-teal hover:text-text-mana'
              }`}
            >
              {u.id} · {u.companyName || u.name}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          THE 4-QUADRANT TACTICAL INTELLIGENCE GRID
          Quadrant 1: Target Reconnaissance & Technical Audit
          Quadrant 2: 6-Competitor Bracket (3 Tiers)
          Quadrant 3: Coms & KGR Ratio Engine (MCC Content Hooks)
          Quadrant 4: Deck & Dossier Forge (10-Slide Live Preview & SlidesApp Export)
          ========================================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 min-h-0">
        
        {/* =====================================================================
            QUADRANT 1: TARGET RECONNAISSANCE & TECHNICAL AUDIT
            ===================================================================== */}
        <section className="rounded-xl border border-accent-teal/80 bg-primary-plum/20 p-3.5 flex flex-col justify-between shadow-md">
          <div>
            <div className="flex items-center justify-between border-b border-accent-teal/40 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-accent-teal" />
                <h2 className="font-display text-sm font-bold text-highlight-gold uppercase tracking-wider">
                  Q1: Target Reconnaissance // Technical Audit
                </h2>
              </div>
              <span className="font-mono text-hud-3 text-accent-teal border border-accent-teal/40 px-1.5 py-0.5 rounded">
                SSOT VERIFIED
              </span>
            </div>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 font-mono text-center">
              <div className="p-2 rounded-lg border border-accent-teal/40 bg-bg-obsidian/70">
                <div className="text-hud-2 text-text-mana/60 uppercase">Domain Authority</div>
                <div className="text-base font-bold text-highlight-gold">68 / 100</div>
                <div className="text-hud-1 text-text-mana/50">Trust Flow: 42</div>
              </div>
              <div className="p-2 rounded-lg border border-accent-teal/40 bg-bg-obsidian/70">
                <div className="text-hud-2 text-text-mana/60 uppercase">Speed Index</div>
                <div className="text-base font-bold text-text-mana">94 / 100</div>
                <div className="text-hud-1 text-text-mana/50">FCP: 0.8s · LCP: 1.9s</div>
              </div>
              <div className="p-2 rounded-lg border border-accent-teal/40 bg-bg-obsidian/70">
                <div className="text-hud-2 text-text-mana/60 uppercase">GBP 3-Pack Rank</div>
                <div className="text-base font-bold text-highlight-gold">#1 Cluster</div>
                <div className="text-hud-1 text-text-mana/50">4.9 ★ (128 reviews)</div>
              </div>
              <div className="p-2 rounded-lg border border-alert-orange/50 bg-alert-orange/10">
                <div className="text-hud-2 text-alert-orange uppercase font-bold">SaaS Bloat Waste</div>
                <div className="text-base font-bold text-alert-orange">$1,850 / mo</div>
                <div className="text-hud-1 text-text-mana/70">$22,200 / yr savings</div>
              </div>
            </div>

            {/* SaaS Bloat & Redundancy Extraction Matrix */}
            <div className="rounded-lg border border-accent-teal/40 bg-bg-obsidian/80 p-2.5 mb-3 font-mono text-xs">
              <div className="flex items-center justify-between text-hud-3 uppercase text-text-mana/70 font-bold mb-1.5 border-b border-accent-teal/30 pb-1">
                <span>Redundant SaaS Subscriptions Detected</span>
                <span className="text-alert-orange font-bold">Migration Priority: HIGH</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-hud-4">
                <div className="flex items-center justify-between p-1 rounded bg-primary-plum/30">
                  <span className="text-text-mana">Asana Business ($520/mo)</span>
                  <span className="text-highlight-gold font-bold">→ Google Tasks / Sheets</span>
                </div>
                <div className="flex items-center justify-between p-1 rounded bg-primary-plum/30">
                  <span className="text-text-mana">Monday.com ($340/mo)</span>
                  <span className="text-highlight-gold font-bold">→ Pipeline Kanban</span>
                </div>
                <div className="flex items-center justify-between p-1 rounded bg-primary-plum/30">
                  <span className="text-text-mana">Slack Pro ($480/mo)</span>
                  <span className="text-highlight-gold font-bold">→ Google Chat Space</span>
                </div>
                <div className="flex items-center justify-between p-1 rounded bg-primary-plum/30">
                  <span className="text-text-mana">Dropbox Team ($300/mo)</span>
                  <span className="text-highlight-gold font-bold">→ Google Drive Tree</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cross-Department Feed Summary */}
          <div className="border-t border-accent-teal/40 pt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-hud-3">
            <div className="flex items-center gap-1.5 text-text-mana/75">
              <i className="fa-solid fa-shield text-accent-teal" />
              <span>Pamela Lead Score: 96%</span>
            </div>
            <div className="flex items-center gap-1.5 text-text-mana/75">
              <i className="fa-solid fa-list-check text-highlight-gold" />
              <span>Dolores Sprints: 4 Tracks (42 SP)</span>
            </div>
            <div className="flex items-center gap-1.5 text-text-mana/75">
              <i className="fa-solid fa-coins text-gold" />
              <span>Vala ROI: 3.4x Year 1 Break-Even</span>
            </div>
          </div>
        </section>


        {/* =====================================================================
            QUADRANT 2: 6-COMPETITOR BRACKET (3 TIERS)
            ===================================================================== */}
        <section className="rounded-xl border border-accent-teal/80 bg-primary-plum/20 p-3.5 flex flex-col justify-between shadow-md">
          <div>
            <div className="flex items-center justify-between border-b border-accent-teal/40 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-highlight-gold" />
                <h2 className="font-display text-sm font-bold text-highlight-gold uppercase tracking-wider">
                  Q2: 6-Competitor Bracket // 3 Strategic Tiers
                </h2>
              </div>
              <span className="font-mono text-hud-3 text-text-mana/60">
                CLICK ROW TO INSPECT VULNERABILITY
              </span>
            </div>

            {/* Bracket Table */}
            <div className="overflow-x-auto max-h-[175px] overflow-y-auto pr-1">
              <table className="w-full text-left font-mono text-hud-3">
                <thead>
                  <tr className="border-b border-accent-teal/40 text-text-mana/50 uppercase">
                    <th className="py-1 px-1.5">Tier &amp; Entity</th>
                    <th className="py-1 px-1">GBP</th>
                    <th className="py-1 px-1">Review Vel</th>
                    <th className="py-1 px-1">Schema</th>
                    <th className="py-1 px-1">Citations</th>
                    <th className="py-1 px-1">Speed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-accent-teal/20">
                  {competitors.map((c) => {
                    const isSelected = c.name === selectedCompetitorName;
                    return (
                      <tr
                        key={c.name}
                        onClick={() => {
                          setSelectedCompetitorName(c.name);
                          onLogTerminal(`[ORACLE] Vulnerability telemetry focused on ${c.name}.`, 'normal');
                        }}
                        className={`hover:bg-primary-plum/50 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-accent-teal/25 font-bold text-highlight-gold border-l-2 border-l-highlight-gold'
                            : 'text-text-mana/80'
                        }`}
                      >
                        <td className="py-1.5 px-1.5">
                          <div className="font-bold truncate max-w-[130px]">{c.name}</div>
                          <div className="text-hud-1 text-text-mana/50 truncate">{c.tier}</div>
                        </td>
                        <td className="py-1.5 px-1 font-bold">#{c.gbpRank}</td>
                        <td className="py-1.5 px-1">{c.reviewVelocity}%</td>
                        <td className="py-1.5 px-1">
                          <span className={`px-1 py-0.2 rounded text-hud-1 ${c.schemaScore >= 80 ? 'bg-text-mana/20 text-text-mana' : 'bg-alert-orange/20 text-alert-orange'}`}>
                            {c.schemaScore}%
                          </span>
                        </td>
                        <td className="py-1.5 px-1">{c.citationDensity}%</td>
                        <td className="py-1.5 px-1">{c.siteSpeedMs}ms</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Selected Competitor Vulnerability Card */}
            <div className="mt-2.5 p-2 rounded-lg border border-accent-teal/40 bg-bg-obsidian/80 font-mono text-xs">
              <div className="flex items-center justify-between text-hud-3 text-highlight-gold font-bold mb-1">
                <span className="uppercase">Vulnerability Analysis: {selectedCompetitor.name}</span>
                <span className="text-text-mana/50">{selectedCompetitor.tier}</span>
              </div>
              <p className="text-hud-3 text-alert-orange leading-snug">
                <span className="font-bold uppercase mr-1">Vulnerability:</span>
                {selectedCompetitor.vulnerability}
              </p>
              <p className="text-hud-3 text-text-mana/70 mt-1 leading-snug italic">
                {selectedCompetitor.notes}
              </p>
            </div>
          </div>

          <div className="border-t border-accent-teal/40 pt-2 flex justify-between items-center text-hud-3 font-mono text-text-mana/60">
            <span>Competitive Displacement Playbook: Active</span>
            <span className="text-highlight-gold">ISO-27001 AUDITED</span>
          </div>
        </section>


        {/* =====================================================================
            QUADRANT 3: COMS & KGR ENGINE (KEYWORD GOLDEN RATIO)
            ===================================================================== */}
        <section className="rounded-xl border border-accent-teal/80 bg-primary-plum/20 p-3.5 flex flex-col justify-between shadow-md">
          <div>
            <div className="flex items-center justify-between border-b border-accent-teal/40 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-text-mana shadow-[0_0_8px_#DDFBD0]" />
                <h2 className="font-display text-sm font-bold text-highlight-gold uppercase tracking-wider">
                  Q3: Coms &amp; KGR Engine // Content Arbitrage
                </h2>
              </div>
              <span className="font-mono text-hud-3 text-text-mana bg-primary-plum px-1.5 py-0.5 rounded border border-accent-teal/50">
                KGR RATIO &lt; 0.25
              </span>
            </div>

            <p className="font-mono text-hud-3 text-text-mana/60 mb-2">
              KGR = (allintitle results) / (monthly search volume). Keywords below 0.25 guarantee rapid ranking in organic Google search within 48 hours.
            </p>

            {/* KGR Table */}
            <div className="overflow-x-auto max-h-[165px] overflow-y-auto pr-1">
              <table className="w-full text-left font-mono text-hud-3">
                <thead>
                  <tr className="border-b border-accent-teal/40 text-text-mana/50 uppercase">
                    <th className="py-1 px-1.5">Target Query</th>
                    <th className="py-1 px-1">Vol</th>
                    <th className="py-1 px-1">allintitle</th>
                    <th className="py-1 px-1">KGR</th>
                    <th className="py-1 px-1">Intent</th>
                    <th className="py-1 px-1">MCC Hook</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-accent-teal/20">
                  {kgrKeywords.map((k) => (
                    <tr key={k.query} className="hover:bg-primary-plum/30 transition-colors">
                      <td className="py-1.5 px-1.5 font-bold text-text-mana">{k.query}</td>
                      <td className="py-1.5 px-1">{k.monthlySearch}</td>
                      <td className="py-1.5 px-1">{k.allintitle}</td>
                      <td className="py-1.5 px-1 font-bold text-highlight-gold">{k.ratio.toFixed(3)}</td>
                      <td className="py-1.5 px-1 text-text-mana/60">{k.intent}</td>
                      <td className="py-1.5 px-1">
                        <button
                          type="button"
                          onClick={() => onLogTerminal(`[ORACLE → MCC] Exported hook to Daisy's queue: "${k.mccHook}"`, 'action')}
                          className="px-1.5 py-0.5 rounded border border-accent-teal bg-primary-plum/40 text-highlight-gold hover:border-highlight-gold text-hud-1 cursor-pointer"
                          title={`Push to Daisy's Mail Command Center: ${k.mccHook}`}
                        >
                          Push to MCC
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sentiment Vulnerabilities */}
            <div className="mt-2.5 p-2 rounded-lg border border-accent-teal/40 bg-bg-obsidian/80 font-mono text-hud-3">
              <div className="text-highlight-gold font-bold uppercase mb-1">
                Competitor Sentiment Vulnerabilities (Exploit Hooks)
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-text-mana/80">
                <li><span className="font-bold text-alert-orange">Friction:</span> 41% of negative competitor reviews cite surprise invoice additions and scope creep.</li>
                <li><span className="font-bold text-alert-orange">Friction:</span> 34% cite lack of communication and no shared task tracker.</li>
                <li><span className="font-bold text-text-mana">Session Zero Fix:</span> The Iron Gate milestone billing + Google Chat Async Space.</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-accent-teal/40 pt-2 flex justify-between items-center text-hud-3 font-mono text-text-mana/60">
            <span>Direct Feed into Daisy MCC // Alt+5</span>
            <span className="text-text-mana">6 HIGH-CONVERTING HOOKS SYNCED</span>
          </div>
        </section>


        {/* =====================================================================
            QUADRANT 4: DECK & DOSSIER FORGE (LIVE 10-SLIDE PREVIEW)
            ===================================================================== */}
        <section className="rounded-xl border border-accent-teal/80 bg-primary-plum/20 p-3.5 flex flex-col justify-between shadow-md">
          <div>
            <div className="flex items-center justify-between border-b border-accent-teal/40 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-alert-orange shadow-[0_0_8px_#FE5F00]" />
                <h2 className="font-display text-sm font-bold text-highlight-gold uppercase tracking-wider">
                  Q4: Deck &amp; Dossier Forge // 10-Slide Deck
                </h2>
              </div>
              <span className="font-mono text-hud-3 text-highlight-gold">
                SLIDE {currentSlide.slideNumber} / 10
              </span>
            </div>

            {/* Interactive Slide Viewer Canvas */}
            <div className="rounded-lg border border-accent-teal/60 bg-bg-obsidian/95 p-3 shadow-inner mb-3">
              <div className="flex items-center justify-between border-b border-accent-teal/30 pb-1.5 mb-2">
                <div>
                  <span className="font-mono text-hud-1 text-accent-teal uppercase tracking-widest">
                    SESSION ZERO SOLUTIONS · CLIENT DOSSIER
                  </span>
                  <h3 className="font-display text-sm font-bold text-highlight-gold">
                    {currentSlide.slideNumber}. {currentSlide.title}
                  </h3>
                </div>
                <span className="font-mono text-hud-1 text-text-mana/50">
                  {currentSlide.subtitle}
                </span>
              </div>

              <div className="space-y-1.5 font-body text-xs text-text-mana/90 min-h-[90px]">
                {currentSlide.points.map((pt, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="text-highlight-gold font-bold font-mono text-hud-3 mt-0.5">▪</span>
                    <p className="leading-snug">{pt}</p>
                  </div>
                ))}
              </div>

              {/* Slide Navigation Pagination */}
              <div className="flex items-center justify-between border-t border-accent-teal/30 pt-2 mt-2 font-mono text-hud-3">
                <button
                  type="button"
                  onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentSlideIndex === 0}
                  className="px-2 py-0.5 rounded border border-accent-teal/50 text-text-mana disabled:opacity-30 hover:border-highlight-gold transition-colors cursor-pointer"
                >
                  « Prev Slide
                </button>
                <div className="flex gap-1">
                  {DECK_SLIDES.map((s, idx) => (
                    <button
                      key={s.slideNumber}
                      type="button"
                      onClick={() => setCurrentSlideIndex(idx)}
                      className={`h-4 w-4 rounded text-hud-1 font-bold transition-all cursor-pointer ${
                        currentSlideIndex === idx
                          ? 'bg-highlight-gold text-bg-obsidian font-black'
                          : 'bg-primary-plum/40 text-text-mana/60 hover:text-text-mana'
                      }`}
                    >
                      {s.slideNumber}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentSlideIndex((prev) => Math.min(DECK_SLIDES.length - 1, prev + 1))}
                  disabled={currentSlideIndex === DECK_SLIDES.length - 1}
                  className="px-2 py-0.5 rounded border border-accent-teal/50 text-text-mana disabled:opacity-30 hover:border-highlight-gold transition-colors cursor-pointer"
                >
                  Next Slide »
                </button>
              </div>
            </div>
          </div>

          {/* Action Bar: Compile to Google Slides */}
          <div className="border-t border-accent-teal/40 pt-2 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleCompileSlides}
              disabled={isCompilingSlides}
              className="flex-1 rounded border border-highlight-gold/70 bg-highlight-gold/20 py-2 px-3 font-display text-xs font-bold text-highlight-gold hover:bg-highlight-gold/30 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(224,202,60,0.2)]"
            >
              <i className={`fa-solid ${isCompilingSlides ? 'fa-spinner fa-spin' : 'fa-file-powerpoint'}`} />
              <span>{isCompilingSlides ? 'Compiling via SlidesApp...' : '1-Click Compile to Google Slides (via SlidesApp)'}</span>
            </button>

            {slidesCompiledUrl && (
              <a
                href={slidesCompiledUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-accent-teal bg-accent-teal/20 px-3 py-2 font-mono text-xs text-text-mana hover:text-highlight-gold hover:border-highlight-gold transition-colors flex items-center gap-1.5"
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-hud-2" />
                <span>Open in Slides</span>
              </a>
            )}
          </div>
        </section>

      </div>
    </main>
  );
};
