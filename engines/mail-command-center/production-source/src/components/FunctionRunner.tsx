import React, { useState } from 'react';
import { AppsScriptSimulator, ApiResponse, CompiledEmailPreview } from '../services/simulatorEngine';
import { Play, CheckCircle2, AlertTriangle, ShieldAlert, Image, Send, ArrowRight, RefreshCw, Sparkles, Clock, Check, Eye, ExternalLink, Mail, CheckCircle } from 'lucide-react';

interface FunctionRunnerProps {
  simulator: AppsScriptSimulator;
  onDbModified: () => void;
}

export const FunctionRunner: React.FC<FunctionRunnerProps> = ({ simulator, onDbModified }) => {
  const [activeTest, setActiveTest] = useState<'execute_campaign' | 'test_email' | 'drip_engine' | 'bounce_handler' | 'subscriber' | 'delivery' | 'pixel' | 'dopost'>('execute_campaign');
  const [bounceEmailInput, setBounceEmailInput] = useState('dev.marcus@matrix.net');
  const [testOutput, setTestOutput] = useState<{
    status: 'idle' | 'success' | 'error' | 'warning';
    title: string;
    message: string;
    data?: any;
    emailPreview?: CompiledEmailPreview;
  }>({
    status: 'idle',
    title: 'Sending Engine Ready',
    message: 'Select a Phase 2 action below to execute batch delivery, pre-flight test sends, or timeout resumption.'
  });

  // Phase 2: Campaign Execution State
  const [selectedCampaignId, setSelectedCampaignId] = useState('camp_v2_launch');
  const [simulateTimeout, setSimulateTimeout] = useState(true);
  const [allowDraftBypass, setAllowDraftBypass] = useState(false);

  // Phase 2: Send Test Email State
  const [testEmailAddress, setTestEmailAddress] = useState('editor.preview@sessionzero.solutions');
  const [testCampaignId, setTestCampaignId] = useState('camp_v2_launch');

  // Subscriber Test Form State
  const [subEmail, setSubEmail] = useState('alex.rivera@sessionzero.solutions');
  const [subFirstName, setSubFirstName] = useState('Alex');
  const [subLastName, setSubLastName] = useState('Rivera');
  const [subNewsletters, setSubNewsletters] = useState('news_tech_weekly, news_product_updates');
  const [subStatus, setSubStatus] = useState('active');
  const [replaceNewsletters, setReplaceNewsletters] = useState(false);

  // Delivery Log Test Form State
  const [delEmail, setDelEmail] = useState('alex.rivera@sessionzero.solutions');
  const [delCampaignId, setDelCampaignId] = useState('camp_oct20_arch');
  const [delStepNumber, setDelStepNumber] = useState('0');
  const [delVariant, setDelVariant] = useState('A');
  const [delStatus, setDelStatus] = useState('sent');

  // Tracking Pixel & Link State
  const [pixelEmail, setPixelEmail] = useState('sarah.connor@cyberdyne.org');
  const [pixelCampaignId, setPixelCampaignId] = useState('camp_oct20_arch');
  const [linkDestination, setLinkDestination] = useState('https://news.ycombinator.com');

  // doPost JSON State
  const [postAction, setPostAction] = useState('send_test_email');
  const [postBody, setPostBody] = useState(JSON.stringify({
    action: 'send_test_email',
    payload: {
      campaign_id: 'camp_v2_launch',
      test_email: 'qa.lead@sessionzero.solutions'
    }
  }, null, 2));

  // Current Campaigns in DB
  const campaigns = simulator.getRows('Campaigns');
  const selectedCampaign = campaigns.find(c => c.campaign_id === selectedCampaignId) || campaigns[0];

  // -------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------

  const handleSendTestEmail = () => {
    try {
      const result = simulator.sendTestEmail(testCampaignId, testEmailAddress);
      onDbModified();

      setTestOutput({
        status: 'success',
        title: 'sendTestEmail() Dispatched Successfully',
        message: `Compiled campaign content for dummy recipient and dispatched strictly to ${testEmailAddress} with subject prefix [TEST]. Updated campaign status to TEST_SENT. Included RFC 8058 List-Unsubscribe headers.`,
        data: {
          campaign_id: result.campaign_id,
          test_email: result.test_email,
          subject: result.subject,
          status: result.status,
          headers: result.preview.headers
        },
        emailPreview: result.preview
      });
    } catch (err: any) {
      setTestOutput({
        status: 'error',
        title: 'Pre-flight Test Failed',
        message: err.message
      });
    }
  };

  const handleApproveCampaign = (campId: string) => {
    try {
      simulator.updateCampaignStatus(campId, 'APPROVED');
      onDbModified();
      setTestOutput({
        status: 'success',
        title: 'Campaign Approved',
        message: `Campaign ${campId} status set to APPROVED. Ready for executeCampaign().`
      });
    } catch (err: any) {
      setTestOutput({
        status: 'error',
        title: 'Approval Error',
        message: err.message
      });
    }
  };

  const handleExecuteCampaign = () => {
    try {
      const result = simulator.executeCampaign(selectedCampaignId, {
        simulateTimeoutAfterIndex: simulateTimeout ? 1 : undefined,
        allowDraftBypass
      });
      onDbModified();

      if (result.resumed_scheduled) {
        setTestOutput({
          status: 'warning',
          title: '4.5-MINUTE TIMEOUT GUARD ACTIVATED',
          message: result.message,
          data: {
            status: result.status,
            campaign_id: result.campaign_id,
            total_recipients: result.total_recipients,
            sent_so_far: result.sent_count,
            saved_properties: simulator.getSimulatedProperties(),
            scheduled_triggers: simulator.getSimulatedTriggers(),
            dispatches: result.dispatches
          }
        });
      } else {
        setTestOutput({
          status: 'success',
          title: 'Campaign Dispatch Complete',
          message: result.message,
          data: {
            status: result.status,
            campaign_id: result.campaign_id,
            sent_count: result.sent_count,
            skipped_duplicates: result.skipped_duplicates,
            total_recipients: result.total_recipients,
            dispatches: result.dispatches
          }
        });
      }
    } catch (err: any) {
      setTestOutput({
        status: 'error',
        title: 'Campaign Refusal / Execution Error',
        message: err.message
      });
    }
  };

  const handleResumeCampaign = () => {
    try {
      const result = simulator.resumeCampaignExecution();
      onDbModified();

      setTestOutput({
        status: 'success',
        title: 'Campaign Continuation Completed',
        message: `Resumed from saved PropertiesService cursor. Processed remaining subscribers and updated campaign status to COMPLETED. Deleted continuation trigger.`,
        data: result
      });
    } catch (err: any) {
      setTestOutput({
        status: 'error',
        title: 'Resume Error',
        message: err.message
      });
    }
  };

  const handleRunDripSequences = () => {
    try {
      const result = simulator.runDripSequences();
      onDbModified();

      setTestOutput({
        status: 'success',
        title: 'runDripSequences() Completed',
        message: `Evaluated active subscribers against Drip_Sequences delays and Delivery_Logs preceding steps. Dispatched: ${result.dispatched} sequence emails.`,
        data: result
      });
    } catch (err: any) {
      setTestOutput({
        status: 'error',
        title: 'Drip Execution Error',
        message: err.message
      });
    }
  };

  const handleInstallDripTrigger = () => {
    setTestOutput({
      status: 'success',
      title: 'installDripTrigger() Invoked',
      message: 'Created hourly time-driven trigger for runDripSequences() via ScriptApp.newTrigger("runDripSequences").timeBased().everyHours(1).create().',
      data: {
        trigger: 'runDripSequences',
        frequency: 'Every 1 Hour',
        created_at: new Date().toISOString()
      }
    });
  };

  const handleProcessBounces = () => {
    try {
      const result = simulator.processBounces(bounceEmailInput);
      onDbModified();

      setTestOutput({
        status: 'success',
        title: 'processBounces() Finished',
        message: `Scanned Gmail Mailer-Daemon notifications. Found ${result.bounced_emails.length} bounce notification(s). Updated ${result.updated_subscribers} subscriber(s) to status 'BOUNCED' and applied label 'MailEngine_Processed_Bounces'.`,
        data: result
      });
    } catch (err: any) {
      setTestOutput({
        status: 'error',
        title: 'Bounce Processing Error',
        message: err.message
      });
    }
  };

  const handleInstallBounceTrigger = () => {
    setTestOutput({
      status: 'success',
      title: 'installBounceTrigger() Invoked',
      message: 'Created 6-hour time-driven trigger for processBounces() via ScriptApp.newTrigger("processBounces").timeBased().everyHours(6).create().',
      data: {
        trigger: 'processBounces',
        frequency: 'Every 6 Hours',
        created_at: new Date().toISOString()
      }
    });
  };

  const handleSimulateClick = () => {
    try {
      const query = {
        action: 'track_click',
        url: encodeURIComponent(linkDestination),
        c_id: pixelCampaignId,
        s_id: pixelEmail
      };
      const result = simulator.simulateDoGet(query);
      onDbModified();

      setTestOutput({
        status: 'success',
        title: 'Click Redirect Handled',
        message: `Recorded click open for ${pixelEmail} on ${pixelCampaignId}. Returned 302/HTML immediate redirect to: ${linkDestination}.`,
        data: {
          destination_url: linkDestination,
          redirect_output: result.content
        }
      });
    } catch (err: any) {
      setTestOutput({
        status: 'error',
        title: 'Click Tracking Error',
        message: err.message
      });
    }
  };

  const runSubscriberTest = () => {
    try {
      const result = simulator.addOrUpdateSubscriber({
        email: subEmail,
        first_name: subFirstName,
        last_name: subLastName,
        subscribed_newsletters: subNewsletters,
        status: subStatus as any,
        replace_newsletters: replaceNewsletters
      });
      onDbModified();

      setTestOutput({
        status: 'success',
        title: `addOrUpdateSubscriber(): ${result.action.toUpperCase()}`,
        message: result.action === 'created'
          ? `Created new subscriber with generated ID ${result.subscriber.subscriber_id}.`
          : `Updated existing subscriber in place. Tags normalized: "${result.subscriber.subscribed_newsletters}".`,
        data: result
      });
    } catch (err: any) {
      setTestOutput({
        status: 'error',
        title: 'Subscriber Execution Error',
        message: err.message
      });
    }
  };

  const runDeliveryTest = () => {
    try {
      const result = simulator.logDelivery({
        email: delEmail,
        campaign_or_drip_id: delCampaignId,
        step_number: delStepNumber,
        variant_sent: delVariant,
        status: delStatus,
        prevent_duplicates: true
      });
      onDbModified();

      if (result.duplicate_skipped) {
        setTestOutput({
          status: 'warning',
          title: 'DOUBLE-SEND PREVENTED!',
          message: `Double-Send Prevention Active: composite key "${result.log_id_key}" was already dispatched or opened. Skipped sending.`,
          data: result
        });
      } else {
        setTestOutput({
          status: 'success',
          title: 'logDelivery() Succeeded',
          message: `Appended row with composite key "${result.log_id_key}" to Delivery_Logs.`,
          data: result
        });
      }
    } catch (err: any) {
      setTestOutput({
        status: 'error',
        title: 'Delivery Logging Error',
        message: err.message
      });
    }
  };

  const runPixelTest = () => {
    try {
      const query = {
        action: 'track_open',
        c_id: pixelCampaignId,
        email: pixelEmail,
        step_number: '0',
        variant: 'A'
      };
      const result = simulator.simulateDoGet(query);
      onDbModified();

      setTestOutput({
        status: 'success',
        title: 'doGet(?action=track_open) Pixel Fired',
        message: `Successfully received open beacon for ${pixelEmail}. Delivery_Logs updated with status='opened'. Served 1x1 transparent GIF with cache-busting headers.`,
        data: {
          mimeType: result.mimeType,
          headers: result.headers,
          data_uri: result.content
        }
      });
    } catch (err: any) {
      setTestOutput({
        status: 'error',
        title: 'Tracking Pixel Error',
        message: err.message
      });
    }
  };

  const runDoPostTest = () => {
    try {
      const response: ApiResponse = simulator.simulateDoPost(postBody);
      onDbModified();

      setTestOutput({
        status: response.success ? 'success' : 'error',
        title: `doPost(e) Router -> Status: ${response.code}`,
        message: response.success
          ? 'API Router successfully verified action, passed payload validation, and executed database action.'
          : `API Error: ${response.error}`,
        data: response
      });
    } catch (err: any) {
      setTestOutput({
        status: 'error',
        title: 'doPost Exception',
        message: err.message
      });
    }
  };

  const loadPostPreset = (actionType: string) => {
    setPostAction(actionType);
    if (actionType === 'send_test_email') {
      setPostBody(JSON.stringify({
        action: 'send_test_email',
        payload: {
          campaign_id: 'camp_v2_launch',
          test_email: 'qa.lead@sessionzero.solutions'
        }
      }, null, 2));
    } else if (actionType === 'execute_campaign') {
      setPostBody(JSON.stringify({
        action: 'execute_campaign',
        payload: {
          campaign_id: 'camp_v2_launch',
          allow_draft_bypass: true
        }
      }, null, 2));
    } else if (actionType === 'resume_campaign') {
      setPostBody(JSON.stringify({
        action: 'resume_campaign',
        payload: {}
      }, null, 2));
    } else if (actionType === 'add_or_update_subscriber') {
      setPostBody(JSON.stringify({
        action: 'add_or_update_subscriber',
        payload: {
          email: 'sam.developer@sessionzero.solutions',
          first_name: 'Sam',
          last_name: 'Dev',
          subscribed_newsletters: 'news_tech_weekly',
          status: 'active'
        }
      }, null, 2));
    } else if (actionType === 'check_quota') {
      setPostBody(JSON.stringify({
        action: 'check_quota',
        payload: {}
      }, null, 2));
    }
  };

  const hasResumeState = Boolean(simulator.getSimulatedProperties()['CAMPAIGN_EXECUTION_STATE']);

  return (
    <div className="space-y-6">
      {/* Test Workbench Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Phase 2 Delivery
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">Sending Engine &amp; Dispatch Workbench</h2>
            </div>
            <p className="text-slate-400 text-sm mt-0.5">
              Live simulation of batch delivery, pre-flight safety checks, 4.5-minute timeout guard, merge tags, and RFC 8058 headers.
            </p>
          </div>

          {hasResumeState && (
            <button
              onClick={handleResumeCampaign}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold text-xs animate-bounce"
            >
              <Clock className="w-4 h-4" />
              <span>Resume Saved Execution</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-5 border-t border-slate-800 pt-4">
          <button
            onClick={() => setActiveTest('execute_campaign')}
            className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition ${
              activeTest === 'execute_campaign'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-semibold text-amber-300">executeCampaign()</div>
            <div className="text-[10px] text-slate-400 truncate">4.5m timeout &amp; batch</div>
          </button>

          <button
            onClick={() => setActiveTest('test_email')}
            className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition ${
              activeTest === 'test_email'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-semibold text-cyan-300">sendTestEmail()</div>
            <div className="text-[10px] text-slate-400 truncate">Pre-flight &amp; tags</div>
          </button>

          <button
            onClick={() => setActiveTest('drip_engine')}
            className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition ${
              activeTest === 'drip_engine'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-semibold text-indigo-300">Drip Sequences</div>
            <div className="text-[10px] text-slate-400 truncate">Time delay evaluator</div>
          </button>

          <button
            onClick={() => setActiveTest('bounce_handler')}
            className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition ${
              activeTest === 'bounce_handler'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-semibold text-rose-300">Bounce Shield</div>
            <div className="text-[10px] text-slate-400 truncate">Reputation scanner</div>
          </button>

          <button
            onClick={() => setActiveTest('pixel')}
            className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition ${
              activeTest === 'pixel'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-semibold text-emerald-300">Open &amp; Click Links</div>
            <div className="text-[10px] text-slate-400 truncate">1x1 GIF &amp; redirect</div>
          </button>

          <button
            onClick={() => setActiveTest('subscriber')}
            className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition ${
              activeTest === 'subscriber'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-semibold">Subscribers</div>
            <div className="text-[10px] text-slate-400 truncate">Upsert &amp; tag merge</div>
          </button>

          <button
            onClick={() => setActiveTest('dopost')}
            className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition ${
              activeTest === 'dopost'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-semibold">doPost Router</div>
            <div className="text-[10px] text-slate-400 truncate">REST API &amp; RPC</div>
          </button>
        </div>
      </div>

      {/* Split Interactive Form and Response Console */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Action Setup Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          {/* Phase 2: executeCampaign */}
          {activeTest === 'execute_campaign' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-amber-400" />
                  <span>Test: executeCampaign(campaignId)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enforces pre-flight checks (status must be APPROVED or RESUMING), quota buffer, 4.5-minute timeout continuation, and double-send ledger prevention.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Select Campaign to Execute</label>
                  <select
                    value={selectedCampaignId}
                    onChange={e => setSelectedCampaignId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                  >
                    {campaigns.map(camp => (
                      <option key={camp.campaign_id} value={camp.campaign_id}>
                        {camp.name} ({camp.campaign_id}) — Status: [{camp.status}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Campaign Pre-Flight Status Badge */}
                {selectedCampaign && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Current Status:</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        selectedCampaign.status === 'APPROVED' || selectedCampaign.status === 'RESUMING'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {selectedCampaign.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      {selectedCampaign.status === 'DRAFT' || selectedCampaign.status === 'TEST_SENT' ? (
                        <div className="flex items-center justify-between mt-1 text-amber-300">
                          <span>Refusal Guard: Dispatch will be refused until approved.</span>
                          <button
                            onClick={() => handleApproveCampaign(selectedCampaign.campaign_id)}
                            className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded text-[10px] font-bold"
                          >
                            Set to APPROVED
                          </button>
                        </div>
                      ) : (
                        <span className="text-emerald-400">Pre-flight checks passed! Eligible for dispatch.</span>
                      )}
                    </div>
                  </div>
                )}

                {/* 4.5 Min Timeout Simulation Toggle */}
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-yellow-400" />
                      <span className="font-semibold text-slate-200">Simulate 4.5m Timeout Guard</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={simulateTimeout}
                        onChange={e => setSimulateTimeout(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    When active, halts execution after 1 recipient to simulate the 270,000ms safety ceiling, saving state to <code>PropertiesService</code> and creating a <code>ScriptApp</code> continuation trigger.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="bypassCheck"
                    checked={allowDraftBypass}
                    onChange={e => setAllowDraftBypass(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-amber-500"
                  />
                  <label htmlFor="bypassCheck" className="text-slate-400 text-[11px] cursor-pointer">
                    Bypass approval check (forces dispatch even if in DRAFT)
                  </label>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleExecuteCampaign}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run executeCampaign()</span>
                  </button>

                  {hasResumeState && (
                    <button
                      onClick={handleResumeCampaign}
                      className="px-4 py-2.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 font-bold text-xs transition"
                    >
                      Resume
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Phase 2: sendTestEmail */}
          {activeTest === 'test_email' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  <span>Test: sendTestEmail(campaignId, testEmail)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Compiles content with dummy recipient data, prefixes subject with <code>[TEST]</code>, sets campaign status to <code>TEST_SENT</code>, and attaches RFC 8058 headers.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Campaign ID</label>
                  <select
                    value={testCampaignId}
                    onChange={e => setTestCampaignId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    {campaigns.map(camp => (
                      <option key={camp.campaign_id} value={camp.campaign_id}>
                        {camp.name} ({camp.campaign_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Test Recipient Email</label>
                  <input
                    type="email"
                    value={testEmailAddress}
                    onChange={e => setTestEmailAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Strictly dispatched to this email address with [TEST] prefix.
                  </span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-slate-400 space-y-1">
                  <div className="text-slate-300 font-semibold">Pre-Flight Test Rules:</div>
                  <div>• Sets campaign status to <code>TEST_SENT</code>.</div>
                  <div>• Populates <code>&#123;&#123;first_name&#125;&#125;</code>, <code>&#123;&#123;email&#125;&#125;</code>, <code>&#123;&#123;unsubscribe_url&#125;&#125;</code>.</div>
                  <div>• Injects 1x1 tracking pixel and rewrites anchor tags.</div>
                </div>

                <button
                  onClick={handleSendTestEmail}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-sm mt-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Execute sendTestEmail()</span>
                </button>
              </div>
            </div>
          )}

          {/* Drip Engine Panel */}
          {activeTest === 'drip_engine' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>Test: DripEngine (runDripSequences)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Evaluates subscribers across <code>Drip_Sequences</code> delay steps. Step 1 triggers from <code>created_at</code>; subsequent steps trigger from preceding step logs.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5 text-slate-300">
                  <div className="font-semibold text-white">Configured Drip Steps in Database:</div>
                  <div className="font-mono text-[11px] text-slate-400">
                    • Step 1: Welcome &amp; System Overview (delay: 0 days)<br/>
                    • Step 2: Advanced Automation Guide (delay: 3 days from Step 1)
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleRunDripSequences}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold text-xs transition shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run runDripSequences() Now</span>
                  </button>

                  <button
                    onClick={handleInstallDripTrigger}
                    className="px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium text-xs transition"
                  >
                    Install Hourly Trigger
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bounce Handler Panel */}
          {activeTest === 'bounce_handler' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Test: BounceHandler (processBounces)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Scans Gmail Mailer-Daemon messages, parses failed recipient addresses, marks subscribers as <code>BOUNCED</code>, and labels threads with <code>MailEngine_Processed_Bounces</code>.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Simulate Bounced Email Address</label>
                  <input
                    type="email"
                    value={bounceEmailInput}
                    onChange={e => setBounceEmailInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-rose-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Matches subscriber in database (e.g. "dev.marcus@matrix.net") and flags status to BOUNCED.
                  </span>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleProcessBounces}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs transition shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run processBounces()</span>
                  </button>

                  <button
                    onClick={handleInstallBounceTrigger}
                    className="px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium text-xs transition"
                  >
                    Install 6-Hour Trigger
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Phase 2: Open & Click Tracking */}
          {activeTest === 'pixel' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Image className="w-4 h-4 text-emerald-400" />
                  <span>Tracking Instrumentation: Open Pixel &amp; Click Redirects</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Test the rewritten <code>?action=track_click</code> redirect and <code>?action=track_open</code> transparent GIF beacon.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Subscriber Email</label>
                  <input
                    type="email"
                    value={pixelEmail}
                    onChange={e => setPixelEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Campaign ID</label>
                  <input
                    type="text"
                    value={pixelCampaignId}
                    onChange={e => setPixelCampaignId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Click Destination URL (rewritten in body)</label>
                  <input
                    type="url"
                    value={linkDestination}
                    onChange={e => setLinkDestination(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={runPixelTest}
                    className="flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
                  >
                    <Image className="w-3.5 h-3.5" />
                    <span>Fire 1x1 Pixel</span>
                  </button>

                  <button
                    onClick={handleSimulateClick}
                    className="flex items-center justify-center gap-2 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Simulate Link Click</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delivery & Double-send */}
          {activeTest === 'delivery' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Double-Send Prevention Ledger</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enforces ledger composite key: <code>$&#123;email&#125;_$&#123;campaignId&#125;_$&#123;stepNumber&#125;</code>.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-mono">email</label>
                  <input
                    type="email"
                    value={delEmail}
                    onChange={e => setDelEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Try "alex.rivera@sessionzero.solutions" with "camp_oct20_arch" to test duplicate blocking.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">campaign_id</label>
                    <input
                      type="text"
                      value={delCampaignId}
                      onChange={e => setDelCampaignId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">step_number</label>
                    <input
                      type="text"
                      value={delStepNumber}
                      onChange={e => setDelStepNumber(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400">
                  <span className="text-slate-500">Calculated Key: </span>
                  <span className="text-amber-300 font-semibold">{delEmail.trim()}_{delCampaignId.trim()}_{delStepNumber.trim()}</span>
                </div>

                <button
                  onClick={runDeliveryTest}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition mt-2 shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute logDelivery()</span>
                </button>
              </div>
            </div>
          )}

          {/* Subscribers */}
          {activeTest === 'subscriber' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Subscribers DAL: addOrUpdateSubscriber()</span>
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-mono">email</label>
                  <input
                    type="email"
                    value={subEmail}
                    onChange={e => setSubEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">first_name</label>
                    <input
                      type="text"
                      value={subFirstName}
                      onChange={e => setSubFirstName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">last_name</label>
                    <input
                      type="text"
                      value={subLastName}
                      onChange={e => setSubLastName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">subscribed_newsletters</label>
                  <input
                    type="text"
                    value={subNewsletters}
                    onChange={e => setSubNewsletters(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs"
                  />
                </div>

                <button
                  onClick={runSubscriberTest}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Upsert Subscriber</span>
                </button>
              </div>
            </div>
          )}

          {/* doPost REST API */}
          {activeTest === 'dopost' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-400" />
                  <span>doPost(e) REST &amp; RPC Router</span>
                </h3>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-semibold">Load Payload Preset:</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'send_test_email', label: 'send_test_email' },
                    { id: 'execute_campaign', label: 'execute_campaign' },
                    { id: 'resume_campaign', label: 'resume_campaign' },
                    { id: 'add_or_update_subscriber', label: 'add_subscriber' },
                    { id: 'check_quota', label: 'check_quota' }
                  ].map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => loadPostPreset(preset.id)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                        postAction === preset.id
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={8}
                value={postBody}
                onChange={e => setPostBody(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500 leading-relaxed"
              />

              <button
                onClick={runDoPostTest}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Send JSON to doPost(e)</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Response Output Console & Email Live Visualizer */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex space-x-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/70"></div>
                </div>
                <span className="text-xs font-mono text-slate-300 font-semibold">Execution Output Console</span>
              </div>

              {testOutput.status === 'success' && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> OK / COMPLETE
                </span>
              )}
              {testOutput.status === 'warning' && (
                <span className="flex items-center gap-1 text-[11px] text-amber-400 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" /> YIELDED / BLOCKED
                </span>
              )}
              {testOutput.status === 'error' && (
                <span className="flex items-center gap-1 text-[11px] text-rose-400 font-semibold">
                  <ShieldAlert className="w-3.5 h-3.5" /> REFUSED / ERROR
                </span>
              )}
            </div>

            {/* Status Message Box */}
            <div className="mt-4">
              <h4 className="text-sm font-bold text-white tracking-tight">{testOutput.title}</h4>
              <p className={`text-xs mt-1 leading-relaxed ${
                testOutput.status === 'error'
                  ? 'text-rose-400'
                  : testOutput.status === 'warning'
                  ? 'text-amber-300'
                  : 'text-slate-300'
              }`}>
                {testOutput.message}
              </p>
            </div>

            {/* Live HTML Email Preview if available */}
            {testOutput.emailPreview && (
              <div className="mt-4 border border-slate-800 rounded-lg overflow-hidden">
                <div className="bg-slate-900 px-3 py-2 border-b border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Compiled Email Preview</span>
                  </span>
                  <span className="font-mono text-amber-400">Variant {testOutput.emailPreview.variant}</span>
                </div>
                <div className="bg-slate-900/40 p-3 text-xs space-y-1 font-mono border-b border-slate-800 text-slate-400">
                  <div><strong className="text-slate-300">Subject:</strong> {testOutput.emailPreview.subject}</div>
                  <div><strong className="text-slate-300">To:</strong> {testOutput.emailPreview.recipientEmail}</div>
                  <div><strong className="text-slate-300">List-Unsubscribe:</strong> {testOutput.emailPreview.headers['List-Unsubscribe']}</div>
                  <div><strong className="text-slate-300">List-Unsubscribe-Post:</strong> {testOutput.emailPreview.headers['List-Unsubscribe-Post']}</div>
                </div>
                <div className="p-3 bg-white text-slate-900 text-xs max-h-56 overflow-y-auto">
                  <div dangerouslySetInnerHTML={{ __html: testOutput.emailPreview.html }} />
                </div>
              </div>
            )}

            {/* Structured JSON Output */}
            {testOutput.data && !testOutput.emailPreview && (
              <div className="mt-4">
                <div className="text-[11px] font-mono text-slate-400 mb-1">Execution Metrics &amp; Dispatches:</div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono text-xs text-amber-200/90 max-h-64 overflow-y-auto">
                  <pre>{JSON.stringify(testOutput.data, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Timeout Safety: 270,000ms</span>
            <span>Check Database tab to inspect updated delivery logs</span>
          </div>
        </div>
      </div>
    </div>
  );
};
