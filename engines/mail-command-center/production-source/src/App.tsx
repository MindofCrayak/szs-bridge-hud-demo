import React, { useState } from 'react';
import { initialDatabase } from './data/initialData';
import { AppsScriptSimulator } from './services/simulatorEngine';
import { Navbar } from './components/Navbar';
import { CodeViewer } from './components/CodeViewer';
import { DatabaseViewer } from './components/DatabaseViewer';
import { FunctionRunner } from './components/FunctionRunner';
import { ArchitectureGuide } from './components/ArchitectureGuide';

export default function App() {
  // Initialize the Apps Script Simulator
  const [simulator] = useState<AppsScriptSimulator>(() => new AppsScriptSimulator(initialDatabase));
  const [dbState, setDbState] = useState(() => simulator.getDatabaseState());
  const [activeTab, setActiveTab] = useState<'code' | 'simulator' | 'database' | 'architecture'>('code');

  // Trigger state refresh when simulated functions write to database
  const refreshDb = () => {
    setDbState({ ...simulator.getDatabaseState() });
  };

  const handleToggleKillSwitch = () => {
    const current = simulator.isGlobalKillSwitchActive();
    simulator.setSystemSetting('GLOBAL_KILL_SWITCH', !current);
    refreshDb();
  };

  const handleResetDb = () => {
    simulator.resetDatabase(initialDatabase);
    refreshDb();
  };

  const isKillSwitchActive = simulator.isGlobalKillSwitchActive();
  const quota = simulator.checkEmailQuota();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-amber-500 selection:text-slate-950">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        killSwitchActive={isKillSwitchActive}
        onToggleKillSwitch={handleToggleKillSwitch}
        quotaRemaining={quota.remaining}
        totalSubscribers={dbState.Subscribers.length}
        onResetDb={handleResetDb}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'code' && <CodeViewer />}
        {activeTab === 'simulator' && <FunctionRunner simulator={simulator} onDbModified={refreshDb} />}
        {activeTab === 'database' && <DatabaseViewer db={dbState} onReset={handleResetDb} />}
        {activeTab === 'architecture' && <ArchitectureGuide />}
      </main>

      <footer className="bg-slate-900/60 border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>GAS Mailchimp Clone • Full Production Architecture (Phases 1, 2 &amp; 3)</span>
          <span className="font-mono text-[11px] text-slate-400">
            DripEngine • BounceHandler • PreferenceCenter • Index.html • SendingEngine • LockService
          </span>
        </div>
      </footer>
    </div>
  );
}
