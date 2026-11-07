import React from 'react';
import { Clock, ShieldCheck, Mail, Database, Terminal, CheckCircle2, AlertOctagon, ExternalLink, Sparkles, Send, Split, RefreshCw } from 'lucide-react';

export const ArchitectureGuide: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Intro Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Phase 1 &amp; Phase 2 Complete
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight">Enterprise Architecture &amp; Execution Specifications</h2>
        </div>
        <p className="text-slate-400 text-sm mt-1">
          Detailed technical reference on batch dispatching, 4.5-minute timeout continuation triggers, RFC 8058 unsubscription headers, merge tag compilation, and double-send prevention.
        </p>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pillar 1: Execution Limits & 4.5m Guard */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">4.5-Minute Guard &amp; Resumption</h3>
              <span className="text-xs text-amber-400 font-mono">EXECUTION_TIMEOUT_GUARD_MS (270,000ms)</span>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Google Apps Script enforces an uncatchable 6-minute process ceiling. SendingEngine monitors loop elapsed time via <code>Date.now()</code>.
          </p>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 space-y-1.5">
            <div className="text-amber-300 font-sans font-semibold">Continuation Lifecycle:</div>
            <p className="text-slate-400">
              1. If <code>(Date.now() - startTime) &gt;= 270000</code>:
            </p>
            <p className="text-slate-400">
              2. Saves <code>CAMPAIGN_EXECUTION_STATE</code> in <code>PropertiesService.getScriptProperties()</code>.
            </p>
            <p className="text-slate-400">
              3. Sets campaign status in sheet to <code>RESUMING</code>.
            </p>
            <p className="text-slate-400">
              4. Creates <code>ScriptApp.newTrigger('resumeCampaignExecution').timeBased().after(60000).create()</code> and returns gracefully.
            </p>
            <p className="text-slate-400">
              5. Trigger wakes up <code>resumeCampaignExecution()</code>, purges trigger, and dispatches from the saved index!
            </p>
          </div>
        </div>

        {/* Pillar 2: Pre-Flight Safety & Status Machine */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Pre-Flight Safety Checks</h3>
              <span className="text-xs text-cyan-400 font-mono">DRAFT &rarr; TEST_SENT &rarr; APPROVED &rarr; SENDING</span>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Prevents accidental dispatches. Campaigns in <code>DRAFT</code> or <code>TEST_SENT</code> are strictly refused by <code>executeCampaign()</code>.
          </p>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 space-y-1.5">
            <div className="text-cyan-300 font-sans font-semibold">Pre-Flight Methods:</div>
            <p className="text-slate-400">
              • <code>sendTestEmail(campaignId, testEmail)</code>: Dispatches strictly to test recipient with subject prefix <code>[TEST]</code> and sets status to <code>TEST_SENT</code>.
            </p>
            <p className="text-slate-400">
              • <code>assertOperationsAllowed()</code>: Confirms <code>GLOBAL_KILL_SWITCH</code> is false.
            </p>
            <p className="text-slate-400">
              • Quota safety: Confirms <code>MailApp.getRemainingDailyQuota() &gt; DAILY_QUOTA_LIMIT</code> buffer before starting.
            </p>
          </div>
        </div>

        {/* Pillar 3: Merge Tags & Tracking Instrumentation */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Merge Tags &amp; Link Tracking</h3>
              <span className="text-xs text-emerald-400 font-mono">RFC 8058 + Click Rewriting</span>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Dynamic compilation for individual recipients and automated link and open tracking instrumentation.
          </p>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 space-y-1.5">
            <div className="text-emerald-300 font-sans font-semibold">Compilation Pipeline:</div>
            <p className="text-slate-400">
              • Tags: <code>&#123;&#123;first_name&#125;&#125;</code>, <code>&#123;&#123;last_name&#125;&#125;</code>, <code>&#123;&#123;email&#125;&#125;</code>, <code>&#123;&#123;unsubscribe_url&#125;&#125;</code>, <code>&#123;&#123;view_in_browser&#125;&#125;</code>.
            </p>
            <p className="text-slate-400">
              • Click Tracking: Rewrites <code>&lt;a href="..."&gt;</code> to <code>?action=track_click&amp;url=...&amp;c_id=...&amp;s_id=...</code>.
            </p>
            <p className="text-slate-400">
              • Open Tracking: Injects 1x1 transparent GIF beacon before <code>&lt;/body&gt;</code>.
            </p>
            <p className="text-slate-400">
              • Headers: Standardized <code>List-Unsubscribe</code> and <code>List-Unsubscribe-Post: List-Unsubscribe=One-Click</code>.
            </p>
          </div>
        </div>

        {/* Pillar 4: A/B Testing & Double-Send Prevention */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Split className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">A/B Testing &amp; Double-Send Ledger</h3>
              <span className="text-xs text-purple-400 font-mono">Deterministic Hash Assignment</span>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Ensures deterministic variant selection and zero repeat sends even across multiple trigger cycles.
          </p>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 space-y-1.5">
            <div className="text-purple-300 font-sans font-semibold">Ledger &amp; Splitting:</div>
            <p className="text-slate-400">
              • Composite key: <code>email_campaignId_stepNumber</code>.
            </p>
            <p className="text-slate-400">
              • Pre-loaded into an in-memory hash set for instant O(1) duplicate skipping.
            </p>
            <p className="text-slate-400">
              • A/B testing: <code>hashString(recipient.email) % 100 &lt; test_split_ratio ? 'A' : 'B'</code> guarantees the exact same variant is assigned even after execution resumption.
            </p>
          </div>
        </div>
      </div>

      {/* Deployment Walkthrough */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
          <Terminal className="w-5 h-5 text-amber-400" />
          <span>Full Apps Script Deployment Checklist (Phase 1 &amp; Phase 2)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shrink-0">1</span>
            <div>
              <div className="font-semibold text-white">Copy All 4 .gs Files into Apps Script Editor</div>
              <p className="text-slate-400 mt-0.5">
                In your Google Sheet, open <strong>Extensions &gt; Apps Script</strong>. Add <strong>Config.gs</strong>, <strong>Database.gs</strong>, <strong>SendingEngine.gs</strong>, and <strong>Router.gs</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shrink-0">2</span>
            <div>
              <div className="font-semibold text-white">Create Index.html &amp; Verify Manifest</div>
              <p className="text-slate-400 mt-0.5">
                Add an HTML file named <strong>Index.html</strong>. Under Project Settings, enable "Show 'appsscript.json'" and confirm scopes for <code>spreadsheets</code>, <code>script.send_mail</code>, <code>script.scriptapp</code>, and <code>drive.readonly</code>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shrink-0">3</span>
            <div>
              <div className="font-semibold text-white">Run Pre-Flight sendTestEmail()</div>
              <p className="text-slate-400 mt-0.5">
                Execute <code>sendTestEmail(campaignId, yourEmail)</code> from the editor or Web UI to verify your Gmail alias, merge tag compilation, and one-click unsubscription headers.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shrink-0">4</span>
            <div>
              <div className="font-semibold text-white">Deploy Web App (Execute as: Me, Access: Anyone)</div>
              <p className="text-slate-400 mt-0.5">
                Deploy as Web App so that email open-tracking pixels and preference center links can load seamlessly from subscribers' email clients.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
