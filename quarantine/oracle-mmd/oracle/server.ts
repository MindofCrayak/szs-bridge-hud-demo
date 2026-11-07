import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(express.json({ limit: '10mb' }));

// In-Memory Storage
let clientsStore: any[] = [];
let auditsStore: Record<string, any[]> = {};
let milestonesStore: Record<string, any[]> = {};
type OperationalTrack = 'trade_contractor' | 'ttrpg_indie';
type TargetStatus = 'CANDIDATE' | 'NEEDS_REVIEW' | 'VERIFIED' | 'TRACKED' | 'REJECTED';
type BracketRole = 'aspirational_1' | 'aspirational_2' | 'seed_1' | 'seed_2' | 'lateral_1' | 'lateral_2' | 'client' | 'additional_benchmark';
type AuditKind = 'gbpCard' | 'associatesMap' | 'identifyWedge';

interface ReconTarget {
  id: string;
  name: string;
  isManual: boolean;
  status: TargetStatus;
  bracketRole: BracketRole;
  perimeter: {
    primaryDomain: string;
    gbpUrl: string;
    linkedinUrl: string;
    socials: string[];
    location: string;
    confidenceScore: number;
  };
  telemetry: {
    postingCadence: string;
    brandTone: string;
    coreKeywords: string[];
    estimatedAudienceScale: string;
    audienceEngagement: string;
  };
  notes: string;
  audits: {
    gbpCard: Record<string, unknown> | null;
    associatesMap: Record<string, unknown> | null;
    identifyWedge: Record<string, unknown> | null;
  };
}

interface CaseFile {
  clientId: string;
  clientName: string;
  track: OperationalTrack;
  weeklyHours: number;
  monthlyBudget: number;
  maturityTier: number;
  primaryHorizon: string;
  targets: ReconTarget[];
  sourcebook: Record<string, unknown> | null;
}

const caseFileStore: Record<string, CaseFile> = {};
const caseFilesDirectory = process.env.CASE_FILES_DIR || path.join(__dirname, 'case_files');
const llmPacingMs = 3500;
let lastLlmCallAt = 0;
let llmQueue: Promise<void> = Promise.resolve();

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function extractAndParseJson(rawText: string): any {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
  return JSON.parse(cleaned.trim());
}

function createEmptyCaseFile(clientId: string, values: Partial<CaseFile> = {}): CaseFile {
  return {
    clientId,
    clientName: values.clientName || '',
    track: values.track || 'trade_contractor',
    weeklyHours: values.weeklyHours || 0,
    monthlyBudget: values.monthlyBudget || 0,
    maturityTier: values.maturityTier || 0,
    primaryHorizon: values.primaryHorizon || '',
    targets: values.targets || [],
    sourcebook: values.sourcebook || null,
  };
}

function caseFilePath(clientId: string): string {
  return path.join(caseFilesDirectory, encodeURIComponent(clientId), 'case_file.json');
}

function loadCaseFile(clientId: string): CaseFile | null {
  if (caseFileStore[clientId]) return caseFileStore[clientId];
  const filePath = caseFilePath(clientId);
  if (!fs.existsSync(filePath)) return null;
  const caseFile = createEmptyCaseFile(clientId, JSON.parse(fs.readFileSync(filePath, 'utf8')));
  caseFileStore[clientId] = caseFile;
  return caseFile;
}

function saveCaseFile(caseFile: CaseFile): CaseFile {
  const filePath = caseFilePath(caseFile.clientId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(caseFile, null, 2), 'utf8');
  caseFileStore[caseFile.clientId] = caseFile;
  return caseFile;
}

function createTarget(
  name: string,
  overrides: Omit<Partial<ReconTarget>, 'perimeter' | 'telemetry' | 'audits'> & {
    perimeter?: Partial<ReconTarget['perimeter']>;
    telemetry?: Partial<ReconTarget['telemetry']>;
    audits?: Partial<ReconTarget['audits']>;
  } = {},
): ReconTarget {
  const { perimeter, telemetry, audits, ...baseOverrides } = overrides;
  return {
    id: randomUUID(),
    name,
    isManual: false,
    status: 'CANDIDATE',
    bracketRole: 'additional_benchmark',
    perimeter: {
      primaryDomain: '',
      gbpUrl: '',
      linkedinUrl: '',
      socials: [],
      location: '',
      confidenceScore: 0,
      ...perimeter,
    },
    telemetry: {
      postingCadence: '',
      brandTone: '',
      coreKeywords: [],
      estimatedAudienceScale: '',
      audienceEngagement: '',
      ...telemetry,
    },
    notes: overrides.notes || '',
    audits: {
      gbpCard: null,
      associatesMap: null,
      identifyWedge: null,
      ...audits,
    },
    ...baseOverrides,
  };
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('429') || message.includes('RESOURCE_EXHAUSTED');
}

function generateAutomatedContent(model: string, contents: string, config: Record<string, unknown> = {}) {
  const request = llmQueue.then(async () => {
    const waitMs = llmPacingMs - (Date.now() - lastLlmCallAt);
    if (lastLlmCallAt && waitMs > 0) await sleep(waitMs);
    try {
      return await ai.models.generateContent({ model, contents, config });
    } finally {
      lastLlmCallAt = Date.now();
    }
  });
  llmQueue = request.then(() => undefined, () => undefined);
  return request;
}

function sendModelError(res: Response, error: unknown) {
  if (isRateLimitError(error)) {
    return res.status(429).json({ success: false, error: 'Rate limit (429) encountered. Please wait 60 seconds before retrying.' });
  }
  const message = error instanceof Error ? error.message : String(error);
  return res.status(502).json({ success: false, error: `Model request failed: ${message}` });
}

function ensureClientId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// API Routes

// 1. Google Workspace Deployment Files
app.get('/api/source-files', (_req: Request, res: Response) => {
  try {
    const codeGsPath = path.join(__dirname, 'Code.gs');
    const indexHtmlPath = path.join(__dirname, 'Index.html');

    const codeGs = fs.existsSync(codeGsPath) ? fs.readFileSync(codeGsPath, 'utf8') : '';
    const indexHtml = fs.existsSync(indexHtmlPath) ? fs.readFileSync(indexHtmlPath, 'utf8') : '';

    res.json({ success: true, codeGs, indexHtml });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Client Management
app.get('/api/clients', (_req: Request, res: Response) => {
  res.json({ success: true, clients: clientsStore });
});

app.post('/api/clients', (req: Request, res: Response) => {
  const clientData = req.body;
  if (!clientData || !clientData.name) {
    return res.status(400).json({ success: false, error: 'Client name is required' });
  }

  const existingIdx = clientsStore.findIndex((c) => c.id === clientData.id);
  if (existingIdx >= 0) {
    clientsStore[existingIdx] = { ...clientsStore[existingIdx], ...clientData };
  } else {
    clientsStore.push({
      ...clientData,
      id: clientData.id || `client-${Date.now()}`,
      createdDate: new Date().toISOString().split('T')[0],
      status: clientData.status || 'Intake',
    });
  }

  res.json({ success: true, clients: clientsStore });
});

// 3. Milestones Management
app.get('/api/milestones/:clientId', (req: Request, res: Response) => {
  const { clientId } = req.params;
  res.json({ success: true, milestones: milestonesStore[clientId] || [] });
});

app.post('/api/milestones/:clientId', (req: Request, res: Response) => {
  const { clientId } = req.params;
  const { milestones } = req.body;
  milestonesStore[clientId] = milestones || [];
  res.json({ success: true, milestones: milestonesStore[clientId] });
});

app.patch('/api/milestones/:clientId/:milestoneId', (req: Request, res: Response) => {
  const { clientId, milestoneId } = req.params;
  const { completed } = req.body;
  const clientMilestones = milestonesStore[clientId] || [];
  const target = clientMilestones.find((m: any) => m.id === milestoneId);
  if (target) {
    target.completed = completed;
  }
  res.json({ success: true, milestone: target });
});

// Persistent Oracle case files
app.get('/api/casefile/:clientId', (req: Request, res: Response) => {
  const caseFile = loadCaseFile(req.params.clientId);
  if (!caseFile) return res.status(404).json({ success: false, error: 'Case file not found' });
  return res.json({ success: true, caseFile });
});

app.post('/api/casefile/:clientId', (req: Request, res: Response) => {
  const clientId = req.params.clientId;
  const caseFile = createEmptyCaseFile(clientId, { ...req.body, clientId });
  return res.json({ success: true, caseFile: saveCaseFile(caseFile) });
});

app.patch('/api/casefile/:clientId', (req: Request, res: Response) => {
  const current = loadCaseFile(req.params.clientId);
  if (!current) return res.status(404).json({ success: false, error: 'Case file not found' });
  const updated: CaseFile = {
    ...current,
    ...req.body,
    clientId: current.clientId,
    targets: Array.isArray(req.body.targets) ? req.body.targets : current.targets,
  };
  if (updated.track !== 'trade_contractor' && updated.track !== 'ttrpg_indie') {
    return res.status(400).json({ success: false, error: 'track must be trade_contractor or ttrpg_indie' });
  }
  return res.json({ success: true, caseFile: saveCaseFile(updated) });
});

app.post('/api/recon/manual', (req: Request, res: Response) => {
  const { clientId, name } = req.body;
  if (!ensureClientId(clientId) || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: 'clientId and target name are required' });
  }
  const caseFile = loadCaseFile(clientId) || createEmptyCaseFile(clientId, req.body);
  const rawUrl = String(req.body.url || req.body.websiteUrl || '').trim();
  let primaryDomain = rawUrl;
  if (rawUrl) {
    try {
      primaryDomain = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`).hostname;
    } catch {
      return res.status(400).json({ success: false, error: 'Target URL is invalid' });
    }
  }
  const target = createTarget(name.trim(), {
    isManual: true,
    status: 'VERIFIED',
    notes: String(req.body.customNotes || req.body.notes || ''),
    perimeter: {
      primaryDomain,
      location: String(req.body.location || ''),
      confidenceScore: 1,
    },
  });
  caseFile.targets.push(target);
  saveCaseFile(caseFile);
  return res.json({ success: true, target, caseFile });
});

app.post('/api/recon/finder', async (req: Request, res: Response) => {
  const { clientId } = req.body;
  const candidateName = String(req.body.candidateName || req.body.name || '').trim();
  if (!ensureClientId(clientId) || !candidateName) {
    return res.status(400).json({ success: false, error: 'clientId and candidateName are required' });
  }
  const caseFile = loadCaseFile(clientId) || createEmptyCaseFile(clientId, req.body);
  const prompt = `Use Google Search to resolve the public perimeter for this candidate organization.\nCandidate: ${candidateName}\nKnown URL: ${req.body.url || 'None'}\nLocation hint: ${req.body.location || 'Unknown'}\nReturn only JSON: {"primaryDomain":"","gbpUrl":"","linkedinUrl":"","socials":[],"location":"","confidenceScore":0}`;
  try {
    const response = await generateAutomatedContent('gemini-3.5-flash-lite', prompt, {
      tools: [{ googleSearch: {} }],
      maxOutputTokens: 250,
      responseMimeType: 'application/json',
    });
    const perimeter = extractAndParseJson(response.text || '');
    const target = createTarget(candidateName, {
      status: 'NEEDS_REVIEW',
      notes: String(req.body.customNotes || ''),
      perimeter: {
        primaryDomain: String(perimeter.primaryDomain || ''),
        gbpUrl: String(perimeter.gbpUrl || ''),
        linkedinUrl: String(perimeter.linkedinUrl || ''),
        socials: Array.isArray(perimeter.socials) ? perimeter.socials : [],
        location: String(perimeter.location || req.body.location || ''),
        confidenceScore: Number(perimeter.confidenceScore) || 0,
      },
    });
    caseFile.targets.push(target);
    saveCaseFile(caseFile);
    return res.json({ success: true, target, caseFile });
  } catch (error) {
    return sendModelError(res, error);
  }
});

app.post('/api/recon/confirm', (req: Request, res: Response) => {
  const { clientId, targetId, status } = req.body;
  const caseFile = ensureClientId(clientId) ? loadCaseFile(clientId) : null;
  if (!caseFile) return res.status(404).json({ success: false, error: 'Case file not found' });
  const target = caseFile.targets.find((entry) => entry.id === targetId);
  if (!target) return res.status(404).json({ success: false, error: 'Target not found' });
  if (status !== 'VERIFIED' && status !== 'REJECTED') {
    return res.status(400).json({ success: false, error: 'status must be VERIFIED or REJECTED' });
  }
  const bracketRoles: BracketRole[] = ['aspirational_1', 'aspirational_2', 'seed_1', 'seed_2', 'lateral_1', 'lateral_2', 'client', 'additional_benchmark'];
  if (req.body.bracketRole && !bracketRoles.includes(req.body.bracketRole)) {
    return res.status(400).json({ success: false, error: 'Invalid bracketRole' });
  }
  const perimeterUpdate = req.body.perimeter || {
    primaryDomain: req.body.primaryDomain,
    gbpUrl: req.body.gbpUrl,
    linkedinUrl: req.body.linkedinUrl,
    socials: req.body.socials,
    location: req.body.location,
    confidenceScore: req.body.confidenceScore,
  };
  target.perimeter = Object.fromEntries(
    Object.entries({ ...target.perimeter, ...perimeterUpdate }).filter(([, value]) => value !== undefined),
  ) as ReconTarget['perimeter'];
  if (req.body.bracketRole) target.bracketRole = req.body.bracketRole;
  if (typeof req.body.notes === 'string') target.notes = req.body.notes;
  target.status = status;
  saveCaseFile(caseFile);
  return res.json({ success: true, target, caseFile });
});

app.post('/api/recon/tracker', async (req: Request, res: Response) => {
  const { clientId, targetId } = req.body;
  const caseFile = ensureClientId(clientId) ? loadCaseFile(clientId) : null;
  if (!caseFile) return res.status(404).json({ success: false, error: 'Case file not found' });
  const target = caseFile.targets.find((entry) => entry.id === targetId);
  if (!target) return res.status(404).json({ success: false, error: 'Target not found' });
  if (target.status !== 'VERIFIED') return res.status(409).json({ success: false, error: 'Only VERIFIED targets can be tracked' });
  const verifiedUrls = [target.perimeter.primaryDomain, target.perimeter.gbpUrl, target.perimeter.linkedinUrl, ...target.perimeter.socials].filter(Boolean);
  if (!verifiedUrls.length) return res.status(400).json({ success: false, error: 'Target has no verified URLs to track' });
  const prompt = `Research ONLY the following verified URLs for ${target.name}. Do not search for or use other entities or domains: ${verifiedUrls.join(', ')}.\nExtract observed posting cadence, core keywords, audience engagement, estimated audience scale, and brand voice. Do not invent unavailable metrics; label unknown values. Return only JSON: {"postingCadence":"","coreKeywords":[],"audienceEngagement":"","estimatedAudienceScale":"","brandTone":""}`;
  try {
    const response = await generateAutomatedContent('gemini-3.5-flash-lite', prompt, {
      tools: [{ googleSearch: {} }],
      maxOutputTokens: 400,
      responseMimeType: 'application/json',
    });
    const telemetry = extractAndParseJson(response.text || '');
    target.telemetry = {
      postingCadence: String(telemetry.postingCadence || ''),
      brandTone: String(telemetry.brandTone || ''),
      coreKeywords: Array.isArray(telemetry.coreKeywords) ? telemetry.coreKeywords : [],
      estimatedAudienceScale: String(telemetry.estimatedAudienceScale || ''),
      audienceEngagement: String(telemetry.audienceEngagement || ''),
    };
    target.status = 'TRACKED';
    saveCaseFile(caseFile);
    return res.json({ success: true, target, audienceEngagement: telemetry.audienceEngagement || '', caseFile });
  } catch (error) {
    return sendModelError(res, error);
  }
});

app.post('/api/recon/report', async (req: Request, res: Response) => {
  const { clientId, targetId, auditType } = req.body;
  const auditFields: Record<string, AuditKind> = {
    gbp_card: 'gbpCard',
    associates_map: 'associatesMap',
    identify_wedge: 'identifyWedge',
  };
  const auditField = auditFields[auditType];
  const caseFile = ensureClientId(clientId) ? loadCaseFile(clientId) : null;
  if (!caseFile) return res.status(404).json({ success: false, error: 'Case file not found' });
  const target = caseFile.targets.find((entry) => entry.id === targetId);
  if (!target) return res.status(404).json({ success: false, error: 'Target not found' });
  if (!auditField) return res.status(400).json({ success: false, error: 'auditType must be gbp_card, associates_map, or identify_wedge' });
  if (target.status !== 'VERIFIED' && target.status !== 'TRACKED') {
    return res.status(409).json({ success: false, error: 'Only VERIFIED or TRACKED targets can be audited' });
  }
  const prompt = `Perform the ${auditType} modular audit for this verified target. Use only the supplied case-file evidence and clearly label unknowns.\n${JSON.stringify({ client: caseFile.clientName, track: caseFile.track, target }, null, 2)}\nReturn a concise JSON object with findings and evidence.`;
  try {
    const response = await generateAutomatedContent('gemini-3.8-flash', prompt, {
      maxOutputTokens: 800,
      responseMimeType: 'application/json',
    });
    const audit = extractAndParseJson(response.text || '');
    target.audits[auditField] = audit;
    saveCaseFile(caseFile);
    return res.json({ success: true, target, audit, caseFile });
  } catch (error) {
    return sendModelError(res, error);
  }
});

// 4. Strategic Audit Generator via Guardrailed 2-Stage Pipeline
app.post('/api/audit', async (req: Request, res: Response) => {
  try {
    const clientDataInput = req.body.clientData || {};
    const clientId = req.body.clientId || clientDataInput.id || clientDataInput.clientId;
    if (!ensureClientId(clientId)) {
      return res.status(400).json({ success: false, error: 'clientId is required' });
    }
    const caseFile = loadCaseFile(clientId);
    if (!caseFile) {
      return res.status(404).json({ success: false, error: 'Create a case file before generating a sourcebook' });
    }
    const clientData = {
      ...clientDataInput,
      id: caseFile.clientId,
      name: caseFile.clientName,
      track: caseFile.track,
      weeklyHours: caseFile.weeklyHours,
      monthlyBudget: caseFile.monthlyBudget,
      maturityTier: caseFile.maturityTier,
      primaryHorizon: caseFile.primaryHorizon,
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      return res.status(500).json({
        success: false,
        error: 'CRITICAL: GEMINI_API_KEY is not loaded in .env. Restart server after setting key.'
      });
    }

    const verifiedTargets = caseFile.targets.filter((target) => target.status === 'VERIFIED' || target.status === 'TRACKED');
    const stage1Model = 'case_file';
    const isTrade = clientData.track === 'trade_contractor';

    // =========================================================================
    // STAGE 2: STRATEGIC SYNTHESIS (Search OFF, Output Capped at 3200 Tokens)
    // =========================================================================
    console.log(`[Stage 2 Synthesis] Generating 10-slide sourcebook narrative for ${clientData.name}...`);
    const strategyModels = ['gemini-3.8-flash'];

    const trackDirectives = isTrade
      ? `TRACK: TRADE & LOCAL SERVICES (Contractors / SBOs)
- Authority scored on Google Business Profile health, local 3-pack ranking, review velocity.
- Battleground: Local search visibility, direct trade referral ecosystems, service-radius SEO.
- Calendar: Structured around 4 seasonal demand shifts and commercial preventative maintenance cycles.`
      : `TRACK: TTRPG & INDIE CREATIVES (Game Designers / Publishers)
- Authority scored on mechanics/worldbuilding prestige, devlogs, playtest engagement, itch/DTRPG presence.
- Battleground: Community ownership (Discord/email), pre-launch follower velocity, Actual Play (AP) coverage.
- Calendar: Phased launch run-up (Playtest/Community -> Pre-Launch -> Live Sprint -> Fulfillment/Retail).`;

    const strategySystemInstruction = `
You are Oracle, an internal research and reporting tool.
Derive a candid, grounded, executive 10-slide competitive strategy and 12-month roadmap based on pre-audited competitor data.
Resource Constraints: Client has strictly ${clientData.weeklyHours} hours/week dedicated and $${clientData.monthlyBudget}/month budget. Never prescribe unsustainable enterprise routines.
Return ONLY a valid JSON object matching the schema. No markdown outside the JSON.`;

    const strategyPrompt = `
Generate the 10-slide Sourcebook Report for:
Client: ${clientData.name} (${clientData.websiteUrl || 'No domain'})
Track: ${clientData.track} | Maturity Tier: ${clientData.maturityTier}
Horizon: ${clientData.primaryHorizon}
Bandwidth: ${clientData.weeklyHours} hrs/wk | Budget: $${clientData.monthlyBudget}/mo

VERIFIED AND TRACKED TARGETS FROM CASE FILE:
${JSON.stringify(verifiedTargets, null, 2)}

${trackDirectives}

You MUST output a valid JSON object matching these top-level keys:
- clientId: string
- clientName: string
- track: string ('trade_contractor' or 'ttrpg_indie')
- maturityTier: number (0, 1, or 2)
- generatedDate: string
- modelUsed: string
- thoughtLeadershipScore: number (1 to 10)
- slide1_TitleScope: { title, clientName, trackLabel, executiveAdvisor, scopeSummary, auditDate, speakerNotes }
- slide2_StrategicBaseline: { title, maturityTier, maturityLabel, weeklyHours, monthlyBudget, capacityVerdict, constraintRealityCheck, primaryHorizon, speakerNotes }
- slide3_Bracket: { title, entities: sourcebook bracket entities with name, role, roleLabel, websiteOrHandle, authorityScore, audienceScale, primaryBattleground, coreStrength, criticalVulnerabilityOrGap, evidenceBadge; strategicTakeaway, speakerNotes }
- slide4_DeepDive: { channels: Array of 4 with [channel, clientStatus, aspirationalBenchmark, lateralBenchmark, strategicAssessment], speakerNotes }
- slide5_GapMatrix: { diagnostic: { doingWell: [{title, detail}], doingBetter: [{title, competitor, detail, counterTactic}], needToAddWhitespace: [{title, rationale, commercialValue}] }, speakerNotes }
- slide6_ICP: { icp: { personaName, demographics, corePainPoints, buyingOrBackingTriggers, primaryHangoutsAndChannels, antiPersona }, speakerNotes }
- slide7_Positioning: { positioning: { categoryAnchor, tenSecondElevatorPitch, contrastWedgeAgainstRivals, uniqueValueProposition, proofPillars }, speakerNotes }
- slide8_Roadmap: { phases: Array of 4 with [phase, name, monthRange, focus, keyMilestones: string[]], speakerNotes }
- slide9_ChannelWaterfall: { waterfall: { tier1Primary: {channel, cadence, allocatedHoursWeekly, objective}, tier2Secondary: {channel, cadence, allocatedHoursWeekly, objective}, tier3Maintenance: {channel, cadence, allocatedHoursWeekly, objective}, hoursRealityCheck: {totalRequiredHours, clientCapacityHours, sustainable, mitigationStrategy} }, speakerNotes }
- slide10_AlliesEcosystem: { allies: { nonCompetingPartners: [{partnerType, exampleTargets, referralMechanism}], ecosystemHubs: [{hubName, accessMethod, expectedYield}], referralLoopDesign }, speakerNotes }
- milestones: Array of 12 roadmap milestones (id, phase, phaseName, targetMonthRange, description, targetMonth, completed: false, estimatedWeeklyHours, expectedDeliverable, notes)
`;

    let stage2Raw = '';
    let stage2Model = '';

    for (const modelName of strategyModels) {
      try {
        console.log(`[Stage 2] Synthesizing deck with ${modelName}...`);
        const response = await generateAutomatedContent(modelName, strategyPrompt, {
          systemInstruction: strategySystemInstruction,
          maxOutputTokens: 800,
          responseMimeType: 'application/json',
        });

        stage2Raw = response.text || '';
        if (stage2Raw && stage2Raw.length > 100) {
          stage2Model = modelName;
          console.log(`[Stage 2] Strategy synthesis completed via ${modelName}.`);
          break;
        }
      } catch (err: any) {
        const errMsg = err.message || JSON.stringify(err);
        // Guardrail 3: Circuit Breaker on 429
        if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
          console.error(`[Circuit Breaker] 429 Quota Exceeded on ${modelName}. Halting cascade.`);
          return res.status(429).json({
            success: false,
            error: 'Rate limit (429) encountered. Please wait 60 seconds before triggering the next audit.'
          });
        }
        console.warn(`[Stage 2] ${modelName} unavailable (${errMsg.substring(0, 80)}...). Trying fallback...`);
      }
    }

    if (!stage2Raw) {
      return res.status(503).json({
        success: false,
        error: 'Strategic synthesis failed across active models. Please retry in 30 seconds.'
      });
    }

    const auditData = extractAndParseJson(stage2Raw);
    auditData.clientId = clientData.id;
    auditData.clientName = clientData.name;
    auditData.generatedDate = new Date().toISOString().split('T')[0];
    auditData.modelUsed = `Stage 1: ${stage1Model} + Stage 2: ${stage2Model}`;

    // Persist in memory store
    if (!auditsStore[clientData.id]) auditsStore[clientData.id] = [];
    auditsStore[clientData.id].push(auditData);
    milestonesStore[clientData.id] = auditData.milestones || [];
    caseFile.sourcebook = auditData;
    saveCaseFile(caseFile);

    const existingIdx = clientsStore.findIndex((c) => c.id === clientData.id);
    if (existingIdx >= 0) clientsStore[existingIdx].status = 'Audited';
    else clientsStore.push({ ...clientData, status: 'Audited' });

    console.log(`[Pipeline Complete] Successfully delivered audit for ${clientData.name}!`);
    res.json({ success: true, audit: auditData });
  } catch (err: any) {
    console.error('Audit Pipeline Error:', err);
    res.status(500).json({ success: false, error: `Pipeline Error: ${err.message}` });
  }
});

// Dev vs Production Middleware
// Dev vs Production Middleware & Auto-Port Resolver
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Starts checking from process.env.PORT or 3001, increments automatically if busy
  const startingPort = Number(process.env.PORT) || 3001;

  function listen(port: number) {
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`\n==================================================`);
      console.log(` Oracle Console online at: http://localhost:${port}`);
      console.log(`==================================================\n`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Port Conflict] Port ${port} is occupied. Trying http://localhost:${port + 1}...`);
        listen(port + 1);
      } else {
        console.error('Server error:', err);
      }
    });
  }

  listen(startingPort);
}

startServer();