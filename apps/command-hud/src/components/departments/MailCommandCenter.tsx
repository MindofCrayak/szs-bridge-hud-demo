import React, { useState } from 'react';

export const MailCommandCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'drips' | 'studio' | 'subscribers'>('campaigns');

  return (
    <div className="w-full h-full bg-[#020500] text-[#DDFBD0] flex flex-col overflow-hidden font-mono select-none">
      {/* Studio Header */}
      <div className="h-14 border-b border-[#086375] bg-gradient-to-r from-[#0d1f18] via-[#05130e] to-[#020500] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-envelope-open-text text-xl text-[#FE5F00]" />
          <div>
            <h1 className="font-display font-bold text-sm tracking-wide text-[#E0CA3C]">
              MAIL COMMAND CENTER (MCC) // PRODUCTION ENGINE
            </h1>
            <p className="text-hud-3 text-[#DDFBD0]/60">
              DIRECTOR OF AUDIENCE ENGAGEMENT: DAISY ADARE // VERIFIED SPF/DKIM/DMARC ALIGNMENT
            </p>
          </div>
        </div>

        {/* Sub-panel Navigation */}
        <div className="flex items-center gap-1 bg-[#020500] p-1 border border-[#086375] rounded-lg">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
              activeTab === 'campaigns' ? 'bg-[#086375] text-[#DDFBD0] font-bold' : 'text-[#DDFBD0]/60 hover:text-white'
            }`}
          >
            1. Broadcasts
          </button>
          <button
            onClick={() => setActiveTab('drips')}
            className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
              activeTab === 'drips' ? 'bg-[#086375] text-[#DDFBD0] font-bold' : 'text-[#DDFBD0]/60 hover:text-white'
            }`}
          >
            2. Drip Sequences
          </button>
          <button
            onClick={() => setActiveTab('studio')}
            className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
              activeTab === 'studio' ? 'bg-[#086375] text-[#DDFBD0] font-bold' : 'text-[#DDFBD0]/60 hover:text-white'
            }`}
          >
            3. Template Studio
          </button>
          <button
            onClick={() => setActiveTab('subscribers')}
            className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
              activeTab === 'subscribers' ? 'bg-[#086375] text-[#DDFBD0] font-bold' : 'text-[#DDFBD0]/60 hover:text-white'
            }`}
          >
            4. Subscriber CRM
          </button>
        </div>
      </div>

      {/* Main Studio Viewport */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'campaigns' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="p-4 rounded-xl border border-[#086375] bg-[#020500]/80">
                <div className="text-hud-3 text-[#DDFBD0]/60 uppercase">Scheduled Broadcasts</div>
                <div className="text-xl font-bold text-[#E0CA3C] mt-1">2 Queued</div>
              </div>
              <div className="p-4 rounded-xl border border-[#086375] bg-[#020500]/80">
                <div className="text-hud-3 text-[#DDFBD0]/60 uppercase">Delivery Rate</div>
                <div className="text-xl font-bold text-[#DDFBD0] mt-1">99.4%</div>
              </div>
              <div className="p-4 rounded-xl border border-[#086375] bg-[#020500]/80">
                <div className="text-hud-3 text-[#DDFBD0]/60 uppercase">Open Velocity</div>
                <div className="text-xl font-bold text-[#FE5F00] mt-1">42.8%</div>
              </div>
              <div className="p-4 rounded-xl border border-[#086375] bg-[#020500]/80">
                <div className="text-hud-3 text-[#DDFBD0]/60 uppercase">Daily Quota Margin</div>
                <div className="text-xl font-bold text-[#E0CA3C] mt-1">1,780 / 1,900</div>
              </div>
            </div>

            <div className="rounded-xl border border-[#086375] bg-[#020500]/80 p-4">
              <h2 className="font-bold text-xs uppercase text-[#E0CA3C] mb-3">Live Campaign Dispatch Queue</h2>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded border border-[#086375]/40 flex justify-between items-center bg-[#0d1f18]/40">
                  <div>
                    <span className="font-bold text-[#E0CA3C]">CMP-2026-04: Google Workspace Architecture Pulse</span>
                    <p className="text-hud-3 text-[#DDFBD0]/60">Target: All Active Clients (Tier 1 & Tier 2)</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-[#086375]/30 border border-[#086375] text-[#DDFBD0]">
                    SCHEDULED 09:00 AM
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'drips' && (
          <div className="max-w-5xl mx-auto rounded-xl border border-[#086375] bg-[#020500]/80 p-4">
            <h2 className="font-bold text-xs uppercase text-[#E0CA3C] mb-3">Post-Contract Stepped Retention Matrix</h2>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded border border-[#086375]/40 bg-[#086375]/10">
                <div className="font-bold text-[#FE5F00]">Track 1: Day 30 Review</div>
                <p className="text-hud-3 text-[#DDFBD0]/70 mt-1">First-month architecture performance review & feedback pulse.</p>
              </div>
              <div className="p-3 rounded border border-[#086375]/40 bg-[#086375]/10">
                <div className="font-bold text-[#E0CA3C]">Track 2: Day 90 Pulse</div>
                <p className="text-hud-3 text-[#DDFBD0]/70 mt-1">Quarterly operational efficiency audit & expansion assessment.</p>
              </div>
              <div className="p-3 rounded border border-[#086375]/40 bg-[#086375]/10">
                <div className="font-bold text-[#DDFBD0]">Track 3: Day 365 Audit</div>
                <p className="text-hud-3 text-[#DDFBD0]/70 mt-1">Annual SLA renewal & infrastructure modernization strategy.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'studio' && (
          <div className="max-w-5xl mx-auto rounded-xl border border-[#086375] bg-[#020500]/80 p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-[#086375]/50 pb-2">
              <h2 className="font-bold text-xs uppercase text-[#E0CA3C]">Oracle AI Template Studio & Preview</h2>
              <button
                type="button"
                onClick={() => alert('Test email dispatched to drake@sessionzero.solutions')}
                className="px-3 py-1 rounded bg-[#FE5F00] text-black font-bold text-xs hover:bg-[#E0CA3C] transition-colors"
              >
                Send Test Email ➔
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-3">
                <div>
                  <label className="text-hud-3 uppercase text-[#086375] block mb-1">Campaign Subject Lines (KGR Scored)</label>
                  <input
                    type="text"
                    defaultValue="Optimize your Google Workspace bridge before month-end"
                    className="w-full bg-[#020500] border border-[#086375] rounded p-2 text-xs text-[#DDFBD0]"
                  />
                </div>
                <div>
                  <label className="text-hud-3 uppercase text-[#086375] block mb-1">Body Markup (HTML)</label>
                  <textarea
                    rows={8}
                    defaultValue="<p>Master Drake, eyes on the bridge. Here is your weekly infrastructure optimization report.</p>"
                    className="w-full bg-[#020500] border border-[#086375] rounded p-2 text-xs text-[#DDFBD0] font-mono"
                  />
                </div>
              </div>
              <div className="border border-[#086375]/60 rounded-xl bg-white text-black p-4 text-xs overflow-y-auto max-h-80 shadow-inner">
                <h3 className="font-bold text-sm text-[#086375]">Session Zero Solutions</h3>
                <p className="text-gray-600 text-hud-4 mb-3">Live Dispatch Preview Pane</p>
                <p>Master Drake, eyes on the bridge. Here is your weekly infrastructure optimization report.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'subscribers' && (
          <div className="max-w-5xl mx-auto rounded-xl border border-[#086375] bg-[#020500]/80 p-4">
            <h2 className="font-bold text-xs uppercase text-[#E0CA3C] mb-3">Authoritative Subscriber Roster</h2>
            <div className="p-3 rounded border border-[#086375]/40 text-xs">
              <div className="grid grid-cols-4 font-bold border-b border-[#086375]/50 pb-1 text-[#E0CA3C]">
                <span>Contact Email</span>
                <span>Client Unit</span>
                <span>Engagement Tier</span>
                <span>Status</span>
              </div>
              <div className="grid grid-cols-4 py-2 border-b border-[#086375]/20 text-hud-4">
                <span>sean@tuesdayknightgames.com</span>
                <span>TKG-01</span>
                <span>Tier 1 Active</span>
                <span className="text-[#DDFBD0]">SUBSCRIBED</span>
              </div>
              <div className="grid grid-cols-4 py-2 text-hud-4">
                <span>luke@melsonianartscouncil.co.uk</span>
                <span>MAC-01</span>
                <span>Tier 1 Active</span>
                <span className="text-[#DDFBD0]">SUBSCRIBED</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
