import React from 'react';
import { ShieldAlert, ShieldCheck, Mail, Database, Code2, BookOpen, Cpu, RefreshCw } from 'lucide-react';

interface NavbarProps {
  activeTab: 'code' | 'simulator' | 'database' | 'architecture';
  setActiveTab: (tab: 'code' | 'simulator' | 'database' | 'architecture') => void;
  killSwitchActive: boolean;
  onToggleKillSwitch: () => void;
  quotaRemaining: number;
  totalSubscribers: number;
  onResetDb: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  killSwitchActive,
  onToggleKillSwitch,
  quotaRemaining,
  totalSubscribers,
  onResetDb
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-bold">
              <Mail className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white text-base">GAS Mailchimp Clone</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Phases 1, 2 &amp; 3 Complete
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Google Apps Script • Sheets Relational DB • Drips • Bounces • Preferences • Web App</p>
            </div>
          </div>

          {/* System Telemetry & Status Badges */}
          <div className="flex items-center gap-3">
            {/* Quota Badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-xs">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span className="text-slate-400">Quota:</span>
              <span className="font-mono font-medium text-slate-200">{quotaRemaining} emails</span>
            </div>

            {/* Subscribers Count */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-xs">
              <span className="text-slate-400">Subscribers:</span>
              <span className="font-mono font-medium text-slate-200">{totalSubscribers}</span>
            </div>

            {/* Kill Switch Toggle Button */}
            <button
              onClick={onToggleKillSwitch}
              title="Click to toggle the master GLOBAL_KILL_SWITCH setting"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm ${
                killSwitchActive
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
              }`}
            >
              {killSwitchActive ? (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  <span>KILL SWITCH: HALTED</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>OPERATIONAL</span>
                </>
              )}
            </button>

            {/* Reset DB State */}
            <button
              onClick={onResetDb}
              title="Reset simulated Google Sheets database to initial seed"
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 border-t border-slate-800/80 pt-1 pb-2">
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'code'
                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Apps Script Code (.gs)</span>
            <span className="ml-1 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">4 Core Files</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'simulator'
                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Interactive Test Workbench</span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'database'
                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Sheets Database (7 Tabs)</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'architecture'
                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Architecture & Constraints</span>
          </button>
        </div>
      </div>
    </header>
  );
};
