import React, { useState } from 'react';
import { DatabaseState } from '../types/database';
import { Database, Search, Table, RefreshCw, Layers } from 'lucide-react';

interface DatabaseViewerProps {
  db: DatabaseState;
  onReset: () => void;
}

export const DatabaseViewer: React.FC<DatabaseViewerProps> = ({ db, onReset }) => {
  const [selectedSheet, setSelectedSheet] = useState<keyof DatabaseState>('Subscribers');
  const [filterText, setFilterText] = useState<string>('');

  const sheetsList: { key: keyof DatabaseState; name: string; count: number; description: string }[] = [
    { key: 'Subscribers', name: 'Subscribers', count: db.Subscribers.length, description: 'Audience contacts, newsletter tags, subscription status' },
    { key: 'System_Settings', name: 'System_Settings', count: db.System_Settings.length, description: 'Global kill switch, quota buffers, execution limits' },
    { key: 'Campaigns', name: 'Campaigns', count: db.Campaigns.length, description: 'Broadcast emails, A/B subject tests, split ratios' },
    { key: 'Delivery_Logs', name: 'Delivery_Logs', count: db.Delivery_Logs.length, description: 'Composite key dispatch audit & open pixel events' },
    { key: 'Newsletters', name: 'Newsletters', count: db.Newsletters.length, description: 'Publication brands, sender aliases, reply-to routing' },
    { key: 'Drip_Sequences', name: 'Drip_Sequences', count: db.Drip_Sequences.length, description: 'Automated delay steps and onboarding flows' },
    { key: 'Templates', name: 'Templates', count: db.Templates.length, description: 'Google Drive file links and layout metadata' }
  ];

  const currentData = db[selectedSheet] as any[];

  // Headers from first row or fallback
  const headers = currentData.length > 0 ? Object.keys(currentData[0]) : [];

  const filteredData = currentData.filter(row => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return Object.values(row).some(val => String(val).toLowerCase().includes(q));
  });

  const getStatusBadge = (val: string) => {
    const s = String(val).toLowerCase();
    if (s === 'active' || s === 'true' || s === 'opened' || s === 'completed') {
      return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    }
    if (s === 'delivered' || s === 'sent') {
      return 'bg-sky-500/15 text-sky-400 border border-sky-500/30';
    }
    if (s === 'draft' || s === 'scheduled') {
      return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    }
    if (s === 'false' || s === 'unsubscribed' || s === 'failed' || s === 'bounced') {
      return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
    }
    return 'bg-slate-800 text-slate-300';
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Google Sheets Relational Database</h2>
              <p className="text-slate-400 text-sm mt-0.5">
                Exact schema mapping for all 7 tabs. Read &amp; written via batch operations (<code>getValues()</code>/<code>setValues()</code>).
              </p>
            </div>
          </div>

          <button
            onClick={onReset}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Demo DB</span>
          </button>
        </div>

        {/* Tab Pills */}
        <div className="flex flex-wrap gap-2 mt-6 border-t border-slate-800 pt-4">
          {sheetsList.map(sheet => (
            <button
              key={sheet.key}
              onClick={() => {
                setSelectedSheet(sheet.key);
                setFilterText('');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                selectedSheet === sheet.key
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>{sheet.name}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900 text-slate-300 font-mono">
                {sheet.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Sheet Content Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {/* Sub-header with search and info */}
        <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-white">{selectedSheet}</span>
              <span className="text-xs text-slate-400">
                — {sheetsList.find(s => s.key === selectedSheet)?.description}
              </span>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder={`Filter ${selectedSheet}...`}
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-full sm:w-64"
            />
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto max-h-[500px]">
          {filteredData.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              <Layers className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              No records found in {selectedSheet} {filterText ? 'matching your query' : ''}.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-mono uppercase tracking-wider text-[11px] sticky top-0 z-10">
                  <th className="py-3 px-4 w-12 text-slate-600">#</th>
                  {headers.map(header => (
                    <th key={header} className="py-3 px-4 font-semibold text-slate-300">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition text-slate-300">
                    <td className="py-3 px-4 text-slate-600 text-[11px]">{idx + 1}</td>
                    {headers.map(header => {
                      const val = row[header];
                      const isStatusCol = header === 'status' || header === 'GLOBAL_KILL_SWITCH' || header === 'Value';
                      const isKeyCol = header === 'log_id_key' || header === 'subscriber_id' || header === 'campaign_id';

                      return (
                        <td key={header} className="py-3 px-4 whitespace-nowrap">
                          {isStatusCol && typeof val !== 'object' ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${getStatusBadge(String(val))}`}>
                              {String(val)}
                            </span>
                          ) : isKeyCol ? (
                            <span className="font-semibold text-amber-300/90 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              {String(val)}
                            </span>
                          ) : (
                            <span className="text-slate-300 truncate max-w-xs inline-block">
                              {val !== undefined && val !== null ? String(val) : ''}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info */}
        <div className="bg-slate-950/70 border-t border-slate-800 px-4 py-2.5 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Showing {filteredData.length} of {currentData.length} records</span>
          <span className="font-mono">Sheet access: <code>SpreadsheetApp.getActiveSpreadsheet().getSheetByName('{selectedSheet}')</code></span>
        </div>
      </div>
    </div>
  );
};
