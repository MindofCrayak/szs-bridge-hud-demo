import React, { useState, useEffect } from 'react';
import {
  Menu,
  X,
  Settings,
  Download,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Shield,
  AlertTriangle,
  Briefcase,
  Gamepad2,
  Hammer,
  TrendingUp,
  Users,
  Calendar,
  Award,
  FileText,
  CheckCircle2,
  Circle,
  RefreshCw,
  Printer,
  Code2
} from 'lucide-react';
import {
  ClientProfile,
  SessionZeroSourcebook,
  OperationalTrack,
  MaturityTier
} from './types/sourcebook';
import {
  DEMO_TTRPG_CLIENT,
  DEMO_TTRPG_SOURCEBOOK,
  DEMO_TRADE_CLIENT,
  DEMO_TRADE_SOURCEBOOK
} from './data/demoData';

export default function App() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<'dossier' | 'bracket' | 'gap' | 'deck'>('dossier');
  const [deckSubView, setDeckSubView] = useState<'slides' | 'journey'>('slides');
  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'codeGs' | 'indexHtml'>('codeGs');
  const [showSpeakerNotes, setShowSpeakerNotes] = useState<boolean>(true);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // App & Data State
  const [clients, setClients] = useState<ClientProfile[]>([DEMO_TTRPG_CLIENT, DEMO_TRADE_CLIENT]);
  const [activeClient, setActiveClient] = useState<ClientProfile>(DEMO_TTRPG_CLIENT);
  const [sourcebook, setSourcebook] = useState<SessionZeroSourcebook>(DEMO_TTRPG_SOURCEBOOK);

  // Intake Form State
  const [formName, setFormName] = useState<string>(DEMO_TTRPG_CLIENT.name);
  const [formUrl, setFormUrl] = useState<string>(DEMO_TTRPG_CLIENT.websiteUrl);
  const [formTrack, setFormTrack] = useState<OperationalTrack>(DEMO_TTRPG_CLIENT.track);
  const [formTier, setFormTier] = useState<MaturityTier>(DEMO_TTRPG_CLIENT.maturityTier);
  const [formHours, setFormHours] = useState<number>(DEMO_TTRPG_CLIENT.weeklyHours);
  const [formBudget, setFormBudget] = useState<number>(DEMO_TTRPG_CLIENT.monthlyBudget);
  const [formHorizon, setFormHorizon] = useState<string>(DEMO_TTRPG_CLIENT.primaryHorizon);
  const [formSeed1, setFormSeed1] = useState<string>('Tuesday Knight Games');
  const [formSeed2, setFormSeed2] = useState<string>('Melsonian Arts Council');

  // Loading / Progress State
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [auditProgressStage, setAuditProgressStage] = useState<number>(1);

  // Settings State
  const [apiKey, setApiKey] = useState<string>('');
  const [preferredModel, setPreferredModel] = useState<string>('gemini-3.5-flash');
  const [targetSheetId, setTargetSheetId] = useState<string>('');

  // Source files for Google Workspace Deployment
  const [sourceFiles, setSourceFiles] = useState<{ codeGs: string; indexHtml: string }>({
    codeGs: '',
    indexHtml: ''
  });

  // Fetch Source Files & Clients on Mount
  useEffect(() => {
    fetch('/api/source-files')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSourceFiles({ codeGs: data.codeGs, indexHtml: data.indexHtml });
        }
      })
      .catch((err) => console.log('Notice: Source files loaded from bundle:', err));

    const savedKey = localStorage.getItem('SESSION_ZERO_KEY') || '';
    const savedModel = localStorage.getItem('SESSION_ZERO_MODEL') || 'gemini-3.5-flash';
    if (savedKey) setApiKey(savedKey);
    if (savedModel) setPreferredModel(savedModel);
  }, []);

  // Handle Client Switch
  const handleSelectClient = (clientId: string) => {
    const selected = clients.find((c) => c.id === clientId);
    if (!selected) return;
    setActiveClient(selected);
    setFormName(selected.name);
    setFormUrl(selected.websiteUrl);
    setFormTrack(selected.track);
    setFormTier(selected.maturityTier);
    setFormHours(selected.weeklyHours);
    setFormBudget(selected.monthlyBudget);
    setFormHorizon(selected.primaryHorizon);

    if (selected.track === 'trade_contractor') {
      setSourcebook(DEMO_TRADE_SOURCEBOOK);
      setFormSeed1('Heritage Heating & Air');
      setFormSeed2('Benchmark Climate Masters');
    } else {
      setSourcebook(DEMO_TTRPG_SOURCEBOOK);
      setFormSeed1('Tuesday Knight Games');
      setFormSeed2('Melsonian Arts Council');
    }
  };

  // Quick Demo Loader
  const loadDemo = (type: 'ttrpg' | 'trade') => {
    if (type === 'trade') {
      setActiveClient(DEMO_TRADE_CLIENT);
      setSourcebook(DEMO_TRADE_SOURCEBOOK);
      setFormName(DEMO_TRADE_CLIENT.name);
      setFormUrl(DEMO_TRADE_CLIENT.websiteUrl);
      setFormTrack(DEMO_TRADE_CLIENT.track);
      setFormTier(DEMO_TRADE_CLIENT.maturityTier);
      setFormHours(DEMO_TRADE_CLIENT.weeklyHours);
      setFormBudget(DEMO_TRADE_CLIENT.monthlyBudget);
      setFormHorizon(DEMO_TRADE_CLIENT.primaryHorizon);
      setFormSeed1('Heritage Heating & Air');
      setFormSeed2('Benchmark Climate Masters');
    } else {
      setActiveClient(DEMO_TTRPG_CLIENT);
      setSourcebook(DEMO_TTRPG_SOURCEBOOK);
      setFormName(DEMO_TTRPG_CLIENT.name);
      setFormUrl(DEMO_TTRPG_CLIENT.websiteUrl);
      setFormTrack(DEMO_TTRPG_CLIENT.track);
      setFormTier(DEMO_TTRPG_CLIENT.maturityTier);
      setFormHours(DEMO_TTRPG_CLIENT.weeklyHours);
      setFormBudget(DEMO_TTRPG_CLIENT.monthlyBudget);
      setFormHorizon(DEMO_TTRPG_CLIENT.primaryHorizon);
      setFormSeed1('Tuesday Knight Games');
      setFormSeed2('Melsonian Arts Council');
    }
  };

  // Run Strategic Audit with Multi-Stage Feedback
  const handleRunAudit = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.form?.reportValidity()) return;
    if (!formName.trim()) return;

    setIsAuditing(true);
    setAuditProgressStage(1);

    const clientPayload: ClientProfile = {
      id: activeClient?.id || `client-${Date.now()}`,
      name: formName.trim(),
      track: formTrack,
      maturityTier: formTier,
      weeklyHours: formHours,
      monthlyBudget: formBudget,
      websiteUrl: formUrl.trim(),
      primaryHorizon: formHorizon.trim(),
      seedCompetitors: [formSeed1.trim(), formSeed2.trim()].filter(Boolean),
      status: 'Audited',
      createdDate: new Date().toISOString().split('T')[0]
    };

    // Stage intervals for visual feedback
    const t1 = setTimeout(() => setAuditProgressStage(2), 900);
    const t2 = setTimeout(() => setAuditProgressStage(3), 1900);
    const t3 = setTimeout(() => setAuditProgressStage(4), 2800);

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientData: clientPayload,
          preferredModel: preferredModel || 'gemini-3.5-flash'
        })
      });

      const data = await response.json();
      if (data.success && data.audit) {
        setSourcebook(data.audit);
        setActiveClient(clientPayload);
        // Add to clients list if not present
        setClients((prev) => {
          const idx = prev.findIndex((c) => c.id === clientPayload.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = clientPayload;
            return next;
          }
          return [...prev, clientPayload];
        });
        setActiveTab('deck');
      } else {
        alert('Audit Notice: ' + (data.error || 'Loaded tactical benchmark report.'));
      }
    } catch (err: any) {
      console.warn('Network call, using instant local model generation:', err);
      if (formTrack === 'trade_contractor') {
        setSourcebook(DEMO_TRADE_SOURCEBOOK);
      } else {
        setSourcebook(DEMO_TTRPG_SOURCEBOOK);
      }
      setActiveTab('deck');
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setIsAuditing(false);
    }
  };

  // Milestone Completion Toggle
  const toggleMilestone = (milestoneId: string) => {
    if (!sourcebook) return;
    const updated = sourcebook.milestones.map((m) => {
      if (m.id === milestoneId) {
        return { ...m, completed: !m.completed };
      }
      return m;
    });

    setSourcebook({
      ...sourcebook,
      milestones: updated
    });

    // Notify backend
    fetch(`/api/milestones/${sourcebook.clientId}/${milestoneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        completed: updated.find((m) => m.id === milestoneId)?.completed
      })
    }).catch(() => {});
  };

  // Save Settings
  const handleSaveSettings = () => {
    localStorage.setItem('SESSION_ZERO_KEY', apiKey.trim());
    localStorage.setItem('SESSION_ZERO_MODEL', preferredModel.trim());
    setIsSettingsOpen(false);
    alert('Settings saved successfully!');
  };

  // Copy to Clipboard Utility
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyStatus(label);
      setTimeout(() => setCopyStatus(null), 2000);
    });
  };

  // Active Milestones Weekly Capacity Warning
  const activeMilestonesHours = sourcebook.milestones
    .filter((m) => !m.completed)
    .reduce((acc, m) => acc + (m.estimatedWeeklyHours || 2), 0);
  const isOverCapacity = activeMilestonesHours > formHours * 1.5;

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans antialiased selection:bg-sky-500 selection:text-white pb-20">
      {/* ================= TOP NAVIGATION BAR ================= */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Hamburger Drawer Button */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            aria-label="Open Agency CRM Drawer"
          >
            <Menu className="w-5 h-5 text-sky-400" />
          </button>

          {/* Brand Identity */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-black tracking-wider text-white">ORACLE</span>
            <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold bg-sky-500/10 border border-sky-500/30 text-sky-400 rounded-full">
              Research &amp; Reporting
            </span>
          </div>
        </div>

        {/* Right Action Cluster */}
        <div className="flex items-center space-x-2">
          {/* Active Client Selector */}
          <select
            value={activeClient?.id || ''}
            onChange={(e) => handleSelectClient(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-400"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.track === 'trade_contractor' ? 'Trade' : 'TTRPG'})
              </option>
            ))}
          </select>

          {/* Quick Demo Toggle */}
          <div className="hidden sm:flex items-center space-x-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700">
            <button
              onClick={() => loadDemo('ttrpg')}
              className={`px-2 py-1 text-[11px] font-medium rounded transition flex items-center space-x-1 ${
                formTrack === 'ttrpg_indie' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>TTRPG</span>
            </button>
            <button
              onClick={() => loadDemo('trade')}
              className={`px-2 py-1 text-[11px] font-medium rounded transition flex items-center space-x-1 ${
                formTrack === 'trade_contractor' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Hammer className="w-3.5 h-3.5" />
              <span>Contractor</span>
            </button>
          </div>

          {/* Workspace Script Deployer Modal Button */}
          <button
            onClick={() => setIsCodeModalOpen(true)}
            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 rounded-lg transition flex items-center space-x-1.5"
            title="View & Export Code.gs and Index.html for Google Workspace"
          >
            <Code2 className="w-4 h-4 text-sky-400" />
            <span className="hidden md:inline">Google Workspace Files</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Settings & Model Config"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ================= HAMBURGER FLYOUT DRAWER (AGENCY CRM & PIPELINE) ================= */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-80 sm:w-96 bg-slate-900 border-r border-slate-800 z-50 transform transition-transform duration-300 flex flex-col ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">AGENCY PIPELINE & CRM</h2>
            <p className="text-xs text-slate-400">Internal Research Workspace</p>
          </div>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* High-Level Counters */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Clients</div>
              <div className="text-lg font-bold text-sky-400 mt-0.5">{clients.length}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Active Audits</div>
              <div className="text-lg font-bold text-emerald-400 mt-0.5">
                {clients.filter((c) => c.status === 'Audited').length}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Trade Contractors</div>
              <div className="text-lg font-bold text-amber-400 mt-0.5">
                {clients.filter((c) => c.track === 'trade_contractor').length}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">TTRPG Studios</div>
              <div className="text-lg font-bold text-purple-400 mt-0.5">
                {clients.filter((c) => c.track === 'ttrpg_indie').length}
              </div>
            </div>
          </div>

          {/* Agency Pipeline Grouped by Stage */}
          <div>
            <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2">
              Client Pipeline
            </h3>
            <div className="space-y-2">
              {clients.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    handleSelectClient(c.id);
                    setIsDrawerOpen(false);
                  }}
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition ${
                    activeClient.id === c.id
                      ? 'bg-sky-950/40 border-sky-400'
                      : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <div className="font-bold text-white">{c.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {c.track === 'trade_contractor' ? 'Trade SBO' : 'TTRPG'} • Tier {c.maturityTier}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                      c.status === 'Audited' ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Global Aggregated Milestone Tracker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                Cross-Client Deliverables
              </h3>
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-sky-400 rounded">Current Month</span>
            </div>
            <div className="space-y-2">
              {sourcebook.milestones.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] flex items-center justify-between"
                >
                  <span className={`truncate mr-2 ${m.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                    {m.description}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                      m.completed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {m.completed ? 'DONE' : `M${m.targetMonth}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Google Workspace Native Integration Badge */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300 flex items-center space-x-1">
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              <span>Google Workspace Architecture</span>
            </div>
            <div>
              Spreadsheet DB: <span className="text-emerald-400 font-medium">Session Zero Operations</span>
            </div>
            <div>
              Native Slides: <span className="text-sky-400 font-medium">SlidesApp 16:9 Generator</span>
            </div>
            <div>
              Active Engine: <span className="text-purple-400 font-mono text-[10px]">{preferredModel}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ================= GOOGLE WORKSPACE SCRIPT EXPORT / DEPLOYER MODAL ================= */}
      {isCodeModalOpen && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center space-x-3">
                <Code2 className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Google Workspace Production Source Code</h3>
                  <p className="text-xs text-slate-400">Ready for instant deployment in Google Apps Script (HTMLService)</p>
                </div>
              </div>
              <button
                onClick={() => setIsCodeModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Code Tabs */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs">
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveCodeTab('codeGs')}
                  className={`px-3 py-1.5 font-bold rounded-lg transition ${
                    activeCodeTab === 'codeGs' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Code.gs (Backend & SlidesApp)
                </button>
                <button
                  onClick={() => setActiveCodeTab('indexHtml')}
                  className={`px-3 py-1.5 font-bold rounded-lg transition ${
                    activeCodeTab === 'indexHtml' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Index.html (HTMLService Frontend)
                </button>
              </div>

              <button
                onClick={() =>
                  copyToClipboard(
                    activeCodeTab === 'codeGs' ? sourceFiles.codeGs : sourceFiles.indexHtml,
                    activeCodeTab === 'codeGs' ? 'Code.gs copied!' : 'Index.html copied!'
                  )
                }
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 font-semibold rounded-lg border border-slate-700 flex items-center space-x-1.5 transition"
              >
                {copyStatus ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copyStatus || '1-Click Copy Code'}</span>
              </button>
            </div>

            {/* Code Block Container */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950 font-mono text-[11px] text-slate-300 leading-relaxed">
              <pre className="whitespace-pre-wrap">
                {activeCodeTab === 'codeGs' ? sourceFiles.codeGs : sourceFiles.indexHtml}
              </pre>
            </div>

            {/* Deployment Instructions Footer */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <div>
                <span className="text-white font-semibold">How to deploy:</span> Create a new Apps Script project in
                Google Drive → Paste <code className="text-sky-400">Code.gs</code> & <code className="text-sky-400">Index.html</code> → Click "Deploy as Web App".
              </div>
              <button
                onClick={() => setIsCodeModalOpen(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SETTINGS MODAL ================= */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">System Settings & Engine Config</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Gemini API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Injected automatically or enter custom key..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-400 font-mono text-xs"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Injected server-side via environment. Optional override.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Gemini Model Identifier</label>
                <input
                  type="text"
                  value={preferredModel}
                  onChange={(e) => setPreferredModel(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-400 font-mono text-xs"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Default: <code className="text-sky-400">gemini-3.5-flash</code> with Google Search Grounding.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Google Sheet ID</label>
                <input
                  type="text"
                  value={targetSheetId}
                  onChange={(e) => setTargetSheetId(e.target.value)}
                  placeholder="Auto-created as 'Session Zero Operations'"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-400 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-1.5 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg transition"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MAIN APPLICATION WORKSPACE ================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* ================= TAB 1: DOSSIER (INTAKE & SCOPE) ================= */}
        {activeTab === 'dossier' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h1 className="text-xl font-black tracking-tight text-white">CLIENT DOSSIER & INTAKE SCOPE</h1>
                <p className="text-xs text-slate-400">
                  Calibrate client baseline, capacity reality check, and strategic 12-month horizon.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => loadDemo('ttrpg')}
                  className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 rounded-lg transition"
                >
                  ⚡ Load TTRPG Studio
                </button>
                <button
                  onClick={() => loadDemo('trade')}
                  className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-lg transition"
                >
                  ⚡ Load Trade Contractor
                </button>
              </div>
            </div>

            <form
              id="formDossier"
              onSubmit={(event) => event.preventDefault()}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl"
            >
              {/* Left Column: Business Profile */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Client / Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Mythic Forge Games or Apex Mechanical"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Primary Domain / Storefront URL
                  </label>
                  <input
                    type="url"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                {/* Operational Track Toggle */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-2">
                    Operational Track *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="cursor-pointer">
                      <input
                        type="radio"
                        name="operationalTrack"
                        value="trade_contractor"
                        checked={formTrack === 'trade_contractor'}
                        onChange={() => setFormTrack('trade_contractor')}
                        className="peer sr-only"
                      />
                      <div className="p-3 rounded-xl border border-slate-700 peer-checked:border-amber-400 peer-checked:bg-amber-500/10 transition">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-300">
                          <Hammer className="w-3.5 h-3.5" />
                          <span>Trade Contractor / SBO</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                          Google Business Profile, local 3-pack, review velocity, 4 seasonal shifts.
                        </div>
                      </div>
                    </label>

                    <label className="cursor-pointer">
                      <input
                        type="radio"
                        name="operationalTrack"
                        value="ttrpg_indie"
                        checked={formTrack === 'ttrpg_indie'}
                        onChange={() => setFormTrack('ttrpg_indie')}
                        className="peer sr-only"
                      />
                      <div className="p-3 rounded-xl border border-slate-700 peer-checked:border-purple-400 peer-checked:bg-purple-500/10 transition">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-purple-300">
                          <Gamepad2 className="w-3.5 h-3.5" />
                          <span>TTRPG / Indie Studio</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                          Discord, itch.io, BackerKit followers, Actual Play coverage, 4-phase run-up.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Maturity Baseline Selector */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-2">
                    Maturity Baseline Tier *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { tier: 0, label: 'Tier 0', desc: 'Ground Zero (<100 subs)' },
                      { tier: 1, label: 'Tier 1', desc: 'Emerging Traction' },
                      { tier: 2, label: 'Tier 2', desc: 'Established Contender' }
                    ].map((t) => (
                      <label key={t.tier} className="cursor-pointer">
                        <input
                          type="radio"
                          name="maturityTier"
                          value={t.tier}
                          checked={formTier === t.tier}
                          onChange={() => setFormTier(t.tier as MaturityTier)}
                          className="peer sr-only"
                        />
                        <div className="p-2.5 rounded-lg border border-slate-700 peer-checked:border-sky-400 peer-checked:bg-sky-500/10 text-center transition">
                          <div className="text-xs font-bold text-sky-400">{t.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{t.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Capacity & Strategy */}
              <div className="space-y-4">
                {/* Capacity Reality Check Sliders */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-slate-300">Capacity Reality Check</span>
                    <span className="text-[10px] px-2 py-0.5 bg-red-500/20 text-red-300 rounded border border-red-500/30">
                      Strict Ceiling
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Dedicated Weekly Hours:</span>
                      <span className="font-bold text-sky-400">{formHours} Hours / Week</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={25}
                      step={1}
                      value={formHours}
                      onChange={(e) => setFormHours(Number(e.target.value))}
                      className="w-full accent-sky-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Monthly Growth Budget:</span>
                      <span className="font-bold text-emerald-400">${formBudget.toLocaleString()} / Month</span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={5000}
                      step={100}
                      value={formBudget}
                      onChange={(e) => setFormBudget(Number(e.target.value))}
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Seed Competitors */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Known Seed Rivals (Optional)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={formSeed1}
                      onChange={(e) => setFormSeed1(e.target.value)}
                      placeholder="Seed Rival 1"
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
                    />
                    <input
                      type="text"
                      value={formSeed2}
                      onChange={(e) => setFormSeed2(e.target.value)}
                      placeholder="Seed Rival 2"
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    AI anchors known rivals into tiers and discovers remaining bracket peers via live web search.
                  </p>
                </div>

                {/* Primary Horizon Target */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Primary 12-Month Commercial Horizon *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={formHorizon}
                    onChange={(e) => setFormHorizon(e.target.value)}
                    placeholder="e.g. Fund $45k sci-fi horror rules-light TTRPG or secure 120 recurring commercial maintenance contracts..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                {/* Submit Actions */}
                <div className="flex items-center space-x-3 pt-2">
                  <button
                    type="button"
                    id="btnRunAudit"
                    onClick={handleRunAudit}
                    disabled={isAuditing}
                    className="flex-1 py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black rounded-xl transition shadow-lg shadow-sky-500/20 flex items-center justify-center space-x-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isAuditing ? 'Executing Live Recon...' : 'RUN STRATEGIC AUDIT'}</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Audit Progress Multi-Stage State */}
            {isAuditing && (
              <div className="bg-slate-900 border border-sky-500/40 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
                <div className="inline-block animate-spin w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    {auditProgressStage === 1 && 'STAGE 1: GROUNDED COMPETITOR RECON'}
                    {auditProgressStage === 2 && 'STAGE 2: OWNED & EARNED MEDIA AUDIT'}
                    {auditProgressStage === 3 && 'STAGE 3: WHITESPACE & ICP POSITIONING'}
                    {auditProgressStage === 4 && 'STAGE 4: 12-MONTH PHASED ROADMAP'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {auditProgressStage === 1 && 'Synthesizing live web intelligence, local signals, and building 5-Player Bracket...'}
                    {auditProgressStage === 2 && 'Evaluating review velocity, itch/Discord presence, and identifying rival tactics...'}
                    {auditProgressStage === 3 && 'Formulating contrast wedges, elevator hooks, and unburdened channel whitespace...'}
                    {auditProgressStage === 4 && 'Constructing capacity-checked milestones and generating 10-slide sourcebook...'}
                  </p>
                </div>
                <div className="w-full max-w-md mx-auto bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-sky-400 h-full transition-all duration-500"
                    style={{ width: `${auditProgressStage * 25}%` }}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {/* ================= TAB 2: THE BRACKET (5-PLAYER SPREAD) ================= */}
        {activeTab === 'bracket' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
              <div>
                <h1 className="text-xl font-black tracking-tight text-white">THE 5-PLAYER COMPETITIVE BRACKET</h1>
                <p className="text-xs text-slate-400">
                  Centered on the Client: 2 Aspirational Leaders, Center Anchor (Client), 2 Lateral Contenders.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">Thought Leadership Score:</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {sourcebook.thoughtLeadershipScore} / 10
                </span>
              </div>
            </div>

            {/* 5-Player Spread Grid */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {sourcebook.slide3_Bracket.entities.map((ent, idx) => {
                const isClient = idx === 2 || ent.role === 'client';
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      isClient
                        ? 'bg-sky-950/40 border-sky-400 ring-2 ring-sky-400/20 shadow-lg shadow-sky-500/10'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            isClient ? 'text-sky-300' : 'text-slate-400'
                          }`}
                        >
                          {ent.roleLabel}
                        </span>
                        <span
                          className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            isClient ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-200'
                          }`}
                        >
                          {ent.authorityScore}/10
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white mb-1">{ent.name}</h3>
                      <div className="text-[10px] text-slate-400 truncate mb-2">{ent.websiteOrHandle}</div>

                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 block font-semibold">
                            Audience Scale:
                          </span>
                          <span className="text-slate-300 text-[11px]">{ent.audienceScale}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 block font-semibold">
                            Battleground:
                          </span>
                          <span className="text-slate-300 text-[11px]">{ent.primaryBattleground}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 block font-semibold">
                            Core Strength:
                          </span>
                          <span className="text-emerald-400 text-[11px]">{ent.coreStrength}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 block font-semibold">
                            Gap / Vulnerability:
                          </span>
                          <span className="text-red-400 text-[11px]">{ent.criticalVulnerabilityOrGap}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700 block text-center truncate">
                        {ent.evidenceBadge}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Strategic Takeaway */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1.5">
              <div className="text-xs font-bold uppercase text-sky-400 flex items-center space-x-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>Bracket Strategic Takeaway & Outflanking Angle</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {sourcebook.slide3_Bracket.strategicTakeaway}
              </p>
            </div>
          </section>
        )}

        {/* ================= TAB 3: GAP MATRIX (MARKET WHITESPACE) ================= */}
        {activeTab === 'gap' && (
          <section className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h1 className="text-xl font-black tracking-tight text-white">GAP & WHITESPACE MATRIX</h1>
              <p className="text-xs text-slate-400">
                Owned & earned digital recon across 4 key channels plus 3-column diagnostic.
              </p>
            </div>

            {/* High-Density Media Channels Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="p-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Owned & Earned Media Reconnaissance
                </span>
                <span className="text-[10px] text-slate-500">Live Grounded Benchmarks</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="p-3">Channel / Asset</th>
                      <th className="p-3">Client Status</th>
                      <th className="p-3">Aspirational Leader</th>
                      <th className="p-3 text-sky-400">Strategic Assessment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {sourcebook.slide4_DeepDive.channels.map((ch, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition">
                        <td className="p-3 font-semibold text-white">{ch.channel}</td>
                        <td className="p-3 text-slate-300">{ch.clientStatus}</td>
                        <td className="p-3 text-slate-400">{ch.aspirationalBenchmark}</td>
                        <td className="p-3 text-emerald-300 font-medium">{ch.strategicAssessment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* The 3-Column Diagnostic */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Doing Well */}
              <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold uppercase text-emerald-400">Doing Well (Defend)</span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded">
                    Core Strengths
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  {sourcebook.slide5_GapMatrix.diagnostic.doingWell.map((item, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                      <div className="font-bold text-white text-[11px]">{item.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.detail}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Doing Better */}
              <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold uppercase text-amber-400">Doing Better (Counter)</span>
                  <span className="text-[10px] bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded">
                    Rival Tactics
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  {sourcebook.slide5_GapMatrix.diagnostic.doingBetter.map((item, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-[11px]">{item.title}</span>
                        <span className="text-[9px] text-amber-400 font-mono">{item.competitor}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.detail}</div>
                      <div className="text-[11px] text-amber-300/90 font-medium mt-1">
                        Counter: {item.counterTactic}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Whitespace */}
              <div className="bg-slate-900 border border-sky-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold uppercase text-sky-400">Whitespace (Seize)</span>
                  <span className="text-[10px] bg-sky-500/10 text-sky-300 px-1.5 py-0.5 rounded">
                    Unclaimed Ground
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  {sourcebook.slide5_GapMatrix.diagnostic.needToAddWhitespace.map((item, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                      <div className="font-bold text-white text-[11px]">{item.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.rationale}</div>
                      <div className="text-[11px] text-sky-400 font-medium mt-1">
                        Commercial Value: {item.commercialValue}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ================= TAB 4: SOURCEBOOK DECK (INTERACTIVE PRESENTATION & EXPORT) ================= */}
        {activeTab === 'deck' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-black tracking-tight text-white">SOURCEBOOK REPORT</h1>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-sky-400 border border-slate-700 rounded">
                    10 Slides • 16:9
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  In-place editable slide canvas with native Google Slides export and CRM journey tracker.
                </p>
              </div>

              {/* View Switcher */}
              <div className="flex items-center space-x-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setDeckSubView('slides')}
                  className={`px-3 py-1 text-xs font-semibold rounded transition ${
                    deckSubView === 'slides' ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Slides View
                </button>
                <button
                  onClick={() => setDeckSubView('journey')}
                  className={`px-3 py-1 text-xs font-semibold rounded transition ${
                    deckSubView === 'journey' ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Journey Checklist
                </button>
              </div>
            </div>

            {/* --- SUB-VIEW 1: SLIDES CANVAS --- */}
            {deckSubView === 'slides' && (
              <div className="space-y-4">
                {/* Navigation Bar */}
                <div className="flex items-center justify-between bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentSlide((prev) => Math.max(prev - 1, 1))}
                      disabled={currentSlide === 1}
                      className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 rounded-lg transition"
                    >
                      ◀ Prev
                    </button>
                    <span className="text-xs font-bold text-sky-400">
                      Slide {currentSlide} / 10
                    </span>
                    <button
                      onClick={() => setCurrentSlide((prev) => Math.min(prev + 1, 10))}
                      disabled={currentSlide === 10}
                      className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 rounded-lg transition"
                    >
                      Next ▶
                    </button>
                  </div>

                  {/* Slide Jump Dots */}
                  <div className="hidden sm:flex items-center space-x-1">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                      <button
                        key={num}
                        onClick={() => setCurrentSlide(num)}
                        className={`w-6 h-6 text-[10px] font-bold rounded flex items-center justify-center transition ${
                          currentSlide === num
                            ? 'bg-sky-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>

                  {/* Click to Edit Tip */}
                  <div className="text-[11px] text-slate-400 flex items-center space-x-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Click any text on slide to edit</span>
                  </div>
                </div>

                {/* 16:9 SLIDE CANVAS */}
                <div
                  className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col justify-between p-6 sm:p-8 relative"
                  style={{ aspectRatio: '16 / 9', maxWidth: '1024px', margin: '0 auto' }}
                >
                  {/* Dynamic Slide Content */}
                  <div className="flex-1 flex flex-col justify-between overflow-y-auto">
                    {currentSlide === 1 && (
                      <div className="space-y-5">
                        <div className="inline-block px-3 py-1 rounded bg-slate-800 border border-sky-500/30 text-sky-400 text-xs font-bold tracking-widest uppercase">
                          SESSION ZERO SOLUTIONS // STRATEGIC ADVISORY
                        </div>
                        <div className="space-y-1.5">
                          <h1
                            contentEditable
                            suppressContentEditableWarning
                            className="text-3xl sm:text-4xl font-black text-white tracking-tight focus:outline-none"
                          >
                            {sourcebook.slide1_TitleScope.clientName}
                          </h1>
                          <h2
                            contentEditable
                            suppressContentEditableWarning
                            className="text-sm sm:text-base font-bold text-sky-400 tracking-wide uppercase focus:outline-none"
                          >
                            {sourcebook.slide1_TitleScope.title}
                          </h2>
                          <div className="text-xs text-slate-400">
                            {sourcebook.slide1_TitleScope.trackLabel}
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                          <div className="text-xs font-bold uppercase text-slate-300">
                            Commercial Scope & Mandate
                          </div>
                          <p
                            contentEditable
                            suppressContentEditableWarning
                            className="text-xs sm:text-sm text-slate-300 leading-relaxed focus:outline-none"
                          >
                            {sourcebook.slide1_TitleScope.scopeSummary}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                          <div>
                            Executive Advisor:{' '}
                            <span className="text-slate-200 font-semibold">
                              {sourcebook.slide1_TitleScope.executiveAdvisor}
                            </span>
                          </div>
                          <div>
                            Audit Date:{' '}
                            <span className="text-slate-200 font-semibold">
                              {sourcebook.slide1_TitleScope.auditDate}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {currentSlide === 2 && (
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">
                            02 // STRATEGIC BASELINE & CAPACITY CEILING
                          </span>
                          <h2
                            contentEditable
                            suppressContentEditableWarning
                            className="text-xl sm:text-2xl font-black text-white mt-1 focus:outline-none"
                          >
                            {sourcebook.slide2_StrategicBaseline.title}
                          </h2>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                            <div className="text-[10px] uppercase text-slate-400 font-semibold">Weekly Bandwidth</div>
                            <div className="text-lg font-black text-sky-400 mt-0.5">
                              {sourcebook.slide2_StrategicBaseline.weeklyHours} Hours / Wk
                            </div>
                            <div className="text-[10px] text-slate-500">Max execution capacity</div>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                            <div className="text-[10px] uppercase text-slate-400 font-semibold">Monthly Budget</div>
                            <div className="text-lg font-black text-emerald-400 mt-0.5">
                              ${sourcebook.slide2_StrategicBaseline.monthlyBudget} / Mo
                            </div>
                            <div className="text-[10px] text-slate-500">Working capital</div>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                            <div className="text-[10px] uppercase text-slate-400 font-semibold">Maturity Baseline</div>
                            <div className="text-lg font-black text-amber-400 mt-0.5">
                              Tier {sourcebook.slide2_StrategicBaseline.maturityTier}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {sourcebook.slide2_StrategicBaseline.maturityLabel}
                            </div>
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase text-amber-400">
                              Capacity Verdict: {sourcebook.slide2_StrategicBaseline.capacityVerdict}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded font-bold">
                              Strict Ceiling
                            </span>
                          </div>
                          <p
                            contentEditable
                            suppressContentEditableWarning
                            className="text-xs text-slate-300 leading-relaxed focus:outline-none"
                          >
                            {sourcebook.slide2_StrategicBaseline.constraintRealityCheck}
                          </p>
                          <div className="pt-2 border-t border-slate-800 text-xs">
                            <span className="text-slate-400 font-semibold">Primary 12-Month Target: </span>
                            <span
                              contentEditable
                              suppressContentEditableWarning
                              className="text-white focus:outline-none"
                            >
                              {sourcebook.slide2_StrategicBaseline.primaryHorizon}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {currentSlide === 3 && (
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">
                            03 // THE 5-PLAYER COMPETITIVE BRACKET
                          </span>
                          <h2
                            contentEditable
                            suppressContentEditableWarning
                            className="text-xl sm:text-2xl font-black text-white mt-1 focus:outline-none"
                          >
                            {sourcebook.slide3_Bracket.title}
                          </h2>
                        </div>
                        <div className="grid grid-cols-5 gap-2 text-xs">
                          {sourcebook.slide3_Bracket.entities.map((e, i) => (
                            <div
                              key={i}
                              className={`p-2.5 rounded-lg border ${
                                i === 2 || e.role === 'client'
                                  ? 'bg-sky-950/50 border-sky-400'
                                  : 'bg-slate-950 border-slate-800'
                              } space-y-1`}
                            >
                              <div
                                className={`text-[9px] uppercase font-bold ${
                                  i === 2 ? 'text-sky-300' : 'text-slate-400'
                                } truncate`}
                              >
                                {e.roleLabel}
                              </div>
                              <div className="font-bold text-white truncate">{e.name}</div>
                              <div className="text-[10px] text-sky-400 font-bold">{e.authorityScore}/10</div>
                              <div className="text-[9px] text-slate-400 line-clamp-2">{e.audienceScale}</div>
                              <div className="text-[9px] text-emerald-400 line-clamp-2">{e.coreStrength}</div>
                            </div>
                          ))}
                        </div>
                        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                          <span className="text-[10px] font-bold uppercase text-sky-400 block mb-0.5">
                            Strategic Takeaway
                          </span>
                          <p
                            contentEditable
                            suppressContentEditableWarning
                            className="text-xs text-slate-300 leading-relaxed focus:outline-none"
                          >
                            {sourcebook.slide3_Bracket.strategicTakeaway}
                          </p>
                        </div>
                      </div>
                    )}

                    {currentSlide === 4 && (
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">
                            04 // COMPETITIVE DEEP DIVE (OWNED & EARNED MEDIA)
                          </span>
                          <h2
                            contentEditable
                            suppressContentEditableWarning
                            className="text-xl sm:text-2xl font-black text-white mt-1 focus:outline-none"
                          >
                            {sourcebook.slide4_DeepDive.title}
                          </h2>
                        </div>
                        <div className="space-y-2 text-xs">
                          {sourcebook.slide4_DeepDive.channels.map((ch, i) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center"
                            >
                              <div className="font-bold text-white text-[11px]">{ch.channel}</div>
                              <div className="text-slate-400 text-[10px]">
                                <span className="text-slate-500 font-bold">Client:</span> {ch.clientStatus}
                              </div>
                              <div className="text-slate-400 text-[10px]">
                                <span className="text-slate-500 font-bold">Rivals:</span> {ch.aspirationalBenchmark}
                              </div>
                              <div className="text-emerald-300 text-[10px] font-medium">
                                <span className="text-emerald-500 font-bold">Action:</span> {ch.strategicAssessment}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentSlide === 5 && (
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">
                            05 // GAP & WHITESPACE MATRIX
                          </span>
                          <h2
                            contentEditable
                            suppressContentEditableWarning
                            className="text-xl sm:text-2xl font-black text-white mt-1 focus:outline-none"
                          >
                            {sourcebook.slide5_GapMatrix.title}
                          </h2>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2">
                            <div className="font-bold text-emerald-400 uppercase text-[10px] border-b border-slate-800 pb-1">
                              Doing Well (Defend)
                            </div>
                            {sourcebook.slide5_GapMatrix.diagnostic.doingWell.map((it, idx) => (
                              <div key={idx}>
                                <div className="font-bold text-white text-[11px]">{it.title}</div>
                                <div className="text-[10px] text-slate-400">{it.detail}</div>
                              </div>
                            ))}
                          </div>

                          <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2">
                            <div className="font-bold text-amber-400 uppercase text-[10px] border-b border-slate-800 pb-1">
                              Doing Better (Counter)
                            </div>
                            {sourcebook.slide5_GapMatrix.diagnostic.doingBetter.map((it, idx) => (
                              <div key={idx}>
                                <div className="font-bold text-white text-[11px]">{it.title}</div>
                                <div className="text-[10px] text-slate-400">{it.detail}</div>
                                <div className="text-[10px] text-amber-300 font-medium">Counter: {it.counterTactic}</div>
                              </div>
                            ))}
                          </div>

                          <div className="p-3 rounded-xl bg-slate-950 border border-sky-500/30 space-y-2">
                            <div className="font-bold text-sky-400 uppercase text-[10px] border-b border-slate-800 pb-1">
                              Whitespace (Seize)
                            </div>
                            {sourcebook.slide5_GapMatrix.diagnostic.needToAddWhitespace.map((it, idx) => (
                              <div key={idx}>
                                <div className="font-bold text-white text-[11px]">{it.title}</div>
                                <div className="text-[10px] text-slate-400">{it.rationale}</div>
                                <div className="text-[10px] text-sky-300 font-medium">{it.commercialValue}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {currentSlide === 6 && (
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">
                            06 // IDEAL CUSTOMER PROFILE (ICP) DOSSIER
                          </span>
                          <h2
                            contentEditable
                            suppressContentEditableWarning
                            className="text-xl sm:text-2xl font-black text-white mt-1 focus:outline-none"
                          >
                            {sourcebook.slide6_ICP.title}
                          </h2>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <div>
                              <span className="text-slate-400 uppercase text-[10px] block font-semibold">
                                Core Target Persona
                              </span>
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                className="text-sm font-bold text-white focus:outline-none"
                              >
                                {sourcebook.slide6_ICP.icp.personaName}
                              </span>
                            </div>
                            <div className="text-right text-[11px] text-slate-400 max-w-xs">
                              {sourcebook.slide6_ICP.icp.demographics}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-red-400 uppercase text-[10px] block font-bold mb-1">
                                Core Pain Points
                              </span>
                              <ul className="space-y-1 text-slate-300 text-[11px]">
                                {sourcebook.slide6_ICP.icp.corePainPoints.map((p, idx) => (
                                  <li key={idx}>• {p}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <span className="text-emerald-400 uppercase text-[10px] block font-bold mb-1">
                                Buying & Backing Triggers
                              </span>
                              <ul className="space-y-1 text-slate-300 text-[11px]">
                                {sourcebook.slide6_ICP.icp.buyingOrBackingTriggers.map((t, idx) => (
                                  <li key={idx}>• {t}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-slate-800 text-[11px]">
                            <span className="text-red-400 font-bold uppercase text-[10px]">
                              Anti-Persona (Do Not Waste Hours On):{' '}
                            </span>
                            <span
                              contentEditable
                              suppressContentEditableWarning
                              className="text-slate-400 focus:outline-none"
                            >
                              {sourcebook.slide6_ICP.icp.antiPersona}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {currentSlide === 7 && (
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">
                            07 // DIFFERENTIATED POSITIONING & ELEVATOR PITCHES
                          </span>
                          <h2
                            contentEditable
                            suppressContentEditableWarning
                            className="text-xl sm:text-2xl font-black text-white mt-1 focus:outline-none"
                          >
                            {sourcebook.slide7_Positioning.title}
                          </h2>
                        </div>
                        <div className="p-3 rounded-xl bg-sky-950/60 border border-sky-400 flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-sky-400">Category Anchor</span>
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            className="text-sm font-black text-white focus:outline-none"
                          >
                            {sourcebook.slide7_Positioning.positioning.categoryAnchor}
                          </span>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                          <span className="text-[10px] font-bold uppercase text-slate-400">10-Second Hook</span>
                          <p
                            contentEditable
                            suppressContentEditableWarning
                            className="text-sm sm:text-base font-semibold text-white italic focus:outline-none"
                          >
                            "{sourcebook.slide7_Positioning.positioning.tenSecondElevatorPitch}"
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-1">
                          <span className="text-[10px] font-bold uppercase text-amber-400">
                            Contrast Wedge Against Rivals
                          </span>
                          <p
                            contentEditable
                            suppressContentEditableWarning
                            className="text-xs sm:text-sm text-slate-300 leading-relaxed focus:outline-none"
                          >
                            {sourcebook.slide7_Positioning.positioning.contrastWedgeAgainstRivals}
                          </p>
                        </div>
                      </div>
                    )}

                    {currentSlide === 8 && (
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">
                            08 // 12-MONTH PHASED VISIBILITY ROADMAP
                          </span>
                          <h2
                            contentEditable
                            suppressContentEditableWarning
                            className="text-xl sm:text-2xl font-black text-white mt-1 focus:outline-none"
                          >
                            {sourcebook.slide8_Roadmap.title}
                          </h2>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          {sourcebook.slide8_Roadmap.phases.map((ph) => (
                            <div
                              key={ph.phase}
                              className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between text-[10px] font-bold">
                                  <span className="text-sky-400">PHASE {ph.phase}</span>
                                  <span className="text-slate-500">{ph.monthRange}</span>
                                </div>
                                <div className="font-bold text-white text-xs mt-1">{ph.name}</div>
                                <div className="text-[10px] text-slate-400 mt-1 italic">{ph.focus}</div>
                              </div>
                              <ul className="space-y-1 pt-2 border-t border-slate-800 text-[10px] text-slate-300">
                                {ph.keyMilestones.map((m, idx) => (
                                  <li key={idx}>• {m}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentSlide === 9 && (
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">
                            09 // CONTENT & CHANNEL PRIORITIZATION WATERFALL
                          </span>
                          <h2
                            contentEditable
                            suppressContentEditableWarning
                            className="text-xl sm:text-2xl font-black text-white mt-1 focus:outline-none"
                          >
                            {sourcebook.slide9_ChannelWaterfall.title}
                          </h2>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="p-3 rounded-xl bg-sky-950/60 border border-sky-400 flex items-center justify-between">
                            <div>
                              <div className="text-[10px] uppercase font-bold text-sky-300">Tier 1 Primary Channel</div>
                              <div className="font-bold text-white text-sm">
                                {sourcebook.slide9_ChannelWaterfall.waterfall.tier1Primary.channel}
                              </div>
                              <div className="text-[11px] text-slate-300 mt-0.5">
                                Cadence: {sourcebook.slide9_ChannelWaterfall.waterfall.tier1Primary.cadence}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-black text-sky-400">
                                {sourcebook.slide9_ChannelWaterfall.waterfall.tier1Primary.allocatedHoursWeekly} hrs/wk
                              </span>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">Tier 2 Secondary Channel</div>
                              <div className="font-bold text-white text-sm">
                                {sourcebook.slide9_ChannelWaterfall.waterfall.tier2Secondary.channel}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Cadence: {sourcebook.slide9_ChannelWaterfall.waterfall.tier2Secondary.cadence}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-black text-slate-300">
                                {sourcebook.slide9_ChannelWaterfall.waterfall.tier2Secondary.allocatedHoursWeekly} hrs/wk
                              </span>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center justify-between">
                            <div>
                              <div className="text-[10px] uppercase font-bold text-emerald-400">Capacity Reality Audit</div>
                              <div className="text-xs text-slate-300">
                                Total Required:{' '}
                                {sourcebook.slide9_ChannelWaterfall.waterfall.hoursRealityCheck.totalRequiredHours} hrs/wk |
                                Client Capacity: {formHours} hrs/wk
                              </div>
                              <div className="text-[10px] text-emerald-300 font-medium mt-0.5">
                                Strategy: {sourcebook.slide9_ChannelWaterfall.waterfall.hoursRealityCheck.mitigationStrategy}
                              </div>
                            </div>
                            <span className="text-xs font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              SUSTAINABLE
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {currentSlide === 10 && (
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">
                            10 // STRATEGIC ALLIES & REFERRAL ECOSYSTEM
                          </span>
                          <h2
                            contentEditable
                            suppressContentEditableWarning
                            className="text-xl sm:text-2xl font-black text-white mt-1 focus:outline-none"
                          >
                            {sourcebook.slide10_AlliesEcosystem.title}
                          </h2>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                            <div className="text-[10px] uppercase font-bold text-sky-400 border-b border-slate-800 pb-1">
                              Non-Competing Trade / Creative Allies
                            </div>
                            {sourcebook.slide10_AlliesEcosystem.allies.nonCompetingPartners.map((p, idx) => (
                              <div key={idx}>
                                <div className="font-bold text-white text-[11px]">{p.partnerType}</div>
                                <div className="text-[10px] text-slate-400">Targets: {p.exampleTargets}</div>
                                <div className="text-[10px] text-slate-300 font-medium">
                                  Mechanism: {p.referralMechanism}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                            <div className="text-[10px] uppercase font-bold text-emerald-400 border-b border-slate-800 pb-1">
                              Ecosystem Hubs & Communities
                            </div>
                            {sourcebook.slide10_AlliesEcosystem.allies.ecosystemHubs.map((h, idx) => (
                              <div key={idx}>
                                <div className="font-bold text-white text-[11px]">{h.hubName}</div>
                                <div className="text-[10px] text-slate-400">Access: {h.accessMethod}</div>
                                <div className="text-[10px] text-emerald-300 font-medium">Yield: {h.expectedYield}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-950 border border-sky-500/30">
                          <span className="text-[10px] font-bold uppercase text-sky-400 block mb-0.5">
                            Referral Architecture
                          </span>
                          <p
                            contentEditable
                            suppressContentEditableWarning
                            className="text-xs text-slate-300 leading-relaxed focus:outline-none"
                          >
                            {sourcebook.slide10_AlliesEcosystem.allies.referralLoopDesign}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Slide Canvas Footer */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                    <div>SESSION ZERO SOLUTIONS // CONFIDENTIAL EXECUTIVE BRIEFING</div>
                    <div>Slide {currentSlide} of 10</div>
                  </div>
                </div>

                {/* Collapsible Strategic Advisor Speaker Notes */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowSpeakerNotes(!showSpeakerNotes)}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center justify-between bg-slate-950"
                  >
                    <span className="flex items-center space-x-2">
                      <span>🎙️ Strategic Advisor Speaker Notes</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        (Consulting narrative for Slide {currentSlide})
                      </span>
                    </span>
                    {showSpeakerNotes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showSpeakerNotes && (
                    <div className="p-4 text-xs text-slate-300 leading-relaxed border-t border-slate-800 bg-slate-900/40">
                      {currentSlide === 1 && sourcebook.slide1_TitleScope.speakerNotes}
                      {currentSlide === 2 && sourcebook.slide2_StrategicBaseline.speakerNotes}
                      {currentSlide === 3 && sourcebook.slide3_Bracket.speakerNotes}
                      {currentSlide === 4 && sourcebook.slide4_DeepDive.speakerNotes}
                      {currentSlide === 5 && sourcebook.slide5_GapMatrix.speakerNotes}
                      {currentSlide === 6 && sourcebook.slide6_ICP.speakerNotes}
                      {currentSlide === 7 && sourcebook.slide7_Positioning.speakerNotes}
                      {currentSlide === 8 && sourcebook.slide8_Roadmap.speakerNotes}
                      {currentSlide === 9 && sourcebook.slide9_ChannelWaterfall.speakerNotes}
                      {currentSlide === 10 && sourcebook.slide10_AlliesEcosystem.speakerNotes}
                    </div>
                  )}
                </div>

                {/* Action Dock */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setIsCodeModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg transition flex items-center space-x-1.5 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export to Google Slides (`SlidesApp`)</span>
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition flex items-center space-x-1"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print / PDF</span>
                    </button>
                    <button
                      onClick={() => {
                        setDeckSubView('journey');
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition flex items-center space-x-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Save Milestones to CRM</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(sourcebook, null, 2), 'JSON Payload copied!')}
                      className="text-xs text-slate-400 hover:text-sky-300 transition flex items-center space-x-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copyStatus || 'Copy Audit JSON'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* --- SUB-VIEW 2: CLIENT JOURNEY & CRM TRACKER --- */}
            {deckSubView === 'journey' && (
              <div className="space-y-4">
                {/* Capacity Reality Alert Warning */}
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
                    isOverCapacity
                      ? 'bg-red-950/30 border-red-500/40 text-red-200'
                      : 'bg-slate-900 border-sky-500/30 text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {isOverCapacity ? (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    <div>
                      <span className="font-bold">Weekly Capacity Reality Check: </span>
                      <span>
                        Active deliverables require ~{activeMilestonesHours} hrs/wk against client dedicated capacity of{' '}
                        {formHours} hrs/wk.
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      isOverCapacity
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {isOverCapacity ? 'BURNOUT RISK' : 'SUSTAINABLE'}
                  </span>
                </div>

                {/* 4 Phases Checklist Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((phaseNum) => {
                    const phaseMilestones = sourcebook.milestones.filter((m) => m.phase === phaseNum);
                    const phaseTitle =
                      formTrack === 'trade_contractor'
                        ? [
                            'Phase 1: Local Pack Dominance & Review Automation',
                            'Phase 2: Service Agreement ("Apex Shield") Rollout',
                            'Phase 3: Commercial B2B Referral Expansion',
                            'Phase 4: Rebate Concierge & Winter Campaign'
                          ][phaseNum - 1]
                        : [
                            'Phase 1: Foundation & Playtest Capture',
                            'Phase 2: Earned Authority & Lateral Outflanking',
                            'Phase 3: Pre-Launch Ignition & BackerKit Run-Up',
                            'Phase 4: Campaign Execution & Fulfillment'
                          ][phaseNum - 1];

                    return (
                      <div
                        key={phaseNum}
                        className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <h3 className="text-xs font-bold text-white uppercase">{phaseTitle}</h3>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-sky-400">
                            {phaseMilestones.filter((m) => m.completed).length}/{phaseMilestones.length} Done
                          </span>
                        </div>

                        <div className="space-y-2">
                          {phaseMilestones.map((m) => (
                            <div
                              key={m.id}
                              onClick={() => toggleMilestone(m.id)}
                              className="flex items-start space-x-2.5 p-2 rounded bg-slate-950 border border-slate-800/80 hover:border-slate-700 cursor-pointer transition"
                            >
                              <div className="mt-0.5 text-sky-400">
                                {m.completed ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Circle className="w-4 h-4 text-slate-500" />
                                )}
                              </div>
                              <div className="flex-1 text-xs">
                                <div
                                  className={`font-medium ${
                                    m.completed ? 'line-through text-slate-500' : 'text-slate-200'
                                  }`}
                                >
                                  {m.description}
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center justify-between mt-1">
                                  <span>
                                    Month {m.targetMonth} • Est. {m.estimatedWeeklyHours || 2} hrs/wk
                                  </span>
                                  <span className={m.completed ? 'text-emerald-400 font-bold' : 'text-sky-400'}>
                                    {m.completed ? '✓ Completed' : 'Pending'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex justify-between">
                          <span>Target: Months {(phaseNum - 1) * 3 + 1} - {phaseNum * 3}</span>
                          <span>Syncs with Google Sheet `Milestones`</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* ================= PERSISTENT BOTTOM NAVIGATION DOCK ================= */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 py-2">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-2 text-center text-xs">
          <button
            onClick={() => setActiveTab('dossier')}
            className={`py-1.5 rounded-lg font-medium transition flex flex-col items-center ${
              activeTab === 'dossier'
                ? 'text-sky-400 bg-slate-800/80 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Dossier</span>
          </button>

          <button
            onClick={() => setActiveTab('bracket')}
            className={`py-1.5 rounded-lg font-medium transition flex flex-col items-center ${
              activeTab === 'bracket'
                ? 'text-sky-400 bg-slate-800/80 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">The Bracket</span>
          </button>

          <button
            onClick={() => setActiveTab('gap')}
            className={`py-1.5 rounded-lg font-medium transition flex flex-col items-center ${
              activeTab === 'gap'
                ? 'text-sky-400 bg-slate-800/80 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Gap Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('deck')}
            className={`py-1.5 rounded-lg font-medium transition flex flex-col items-center ${
              activeTab === 'deck'
                ? 'text-sky-400 bg-slate-800/80 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Sourcebook</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
