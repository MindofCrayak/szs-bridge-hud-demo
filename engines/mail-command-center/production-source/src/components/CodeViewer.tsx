import React, { useState } from 'react';
import { scriptFiles, ScriptFile } from '../data/codeFiles';
import { Copy, Check, Download, FileCode, Search, Terminal, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export const CodeViewer: React.FC = () => {
  const [selectedFileId, setSelectedFileId] = useState<string>('config');
  const [copied, setCopied] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const currentFile = scriptFiles.find(f => f.id === selectedFileId) || scriptFiles[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (file: ScriptFile) => {
    const element = document.createElement('a');
    const fileBlob = new Blob([file.code], { type: 'text/javascript' });
    element.href = URL.createObjectURL(fileBlob);
    element.download = file.filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadAll = () => {
    scriptFiles.forEach(file => {
      setTimeout(() => handleDownload(file), 200);
    });
  };

  const lines = currentFile.code.split('\n');
  const filteredIndices = searchQuery.trim()
    ? lines
        .map((line, idx) => (line.toLowerCase().includes(searchQuery.toLowerCase()) ? idx : -1))
        .filter(idx => idx !== -1)
    : [];

  return (
    <div className="space-y-6">
      {/* Top Banner with File Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Phase 1 Delivery
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">Production Google Apps Script Files</h2>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Three modular ES6 files ready to paste directly into your Apps Script project linked to your Google Sheet database.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs sm:text-sm transition shadow-sm"
            >
              {copied ? <Check className="w-4 h-4 text-slate-950" /> : <Copy className="w-4 h-4 text-slate-950" />}
              <span>{copied ? 'Copied Code!' : `Copy ${currentFile.filename}`}</span>
            </button>

            <button
              onClick={() => handleDownload(currentFile)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm transition"
              title="Download this file"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>

            <button
              onClick={handleDownloadAll}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 text-xs sm:text-sm transition"
              title="Download all files in bundle"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Download All (6)</span>
            </button>
          </div>
        </div>

        {/* File Tabs */}
        <div className="flex flex-wrap gap-2 mt-6 border-t border-slate-800 pt-4">
          {scriptFiles.map(file => (
            <button
              key={file.id}
              onClick={() => {
                setSelectedFileId(file.id);
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                selectedFileId === file.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span className="font-mono">{file.filename}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900/60 text-slate-400">
                {file.badge}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main File Content Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left 3 cols: Code Editor View */}
        <div className="lg:col-span-3 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
          {/* Editor Header */}
          <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
              </div>
              <span className="font-mono text-xs text-slate-300 font-semibold">{currentFile.filename}</span>
              <span className="text-xs text-slate-500 font-mono">({lines.length} lines • UTF-8)</span>
            </div>

            {/* In-File Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Find in code..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 w-48 sm:w-60"
              />
              {searchQuery && (
                <span className="absolute right-2 top-1.5 text-[10px] text-amber-400 font-mono">
                  {filteredIndices.length} matches
                </span>
              )}
            </div>
          </div>

          {/* Code Body with Line Numbers */}
          <div className="p-4 overflow-x-auto max-h-[640px] font-mono text-xs leading-relaxed text-slate-300 bg-slate-950">
            <pre className="table w-full">
              {lines.map((line, idx) => {
                const lineNum = idx + 1;
                const isMatch = searchQuery && line.toLowerCase().includes(searchQuery.toLowerCase());
                return (
                  <div
                    key={idx}
                    className={`table-row transition ${
                      isMatch ? 'bg-amber-500/20 text-amber-200 font-semibold' : 'hover:bg-slate-900/40'
                    }`}
                  >
                    <span className="table-cell select-none text-slate-600 text-right pr-4 pl-1 w-10 text-[11px]">
                      {lineNum}
                    </span>
                    <span className="table-cell whitespace-pre font-mono">{line}</span>
                  </div>
                );
              })}
            </pre>
          </div>
        </div>

        {/* Right 1 col: File Architecture Spec & Key Exports */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Specification & Role</span>
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">{currentFile.description}</p>

            <div className="mt-4 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Exported Functions</h4>
              <div className="mt-2 space-y-1.5">
                {currentFile.functions.map((fn, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-1.5 rounded bg-slate-950/70 border border-slate-800 text-[11px] font-mono text-amber-300"
                  >
                    <Terminal className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="truncate">{fn}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Constraint Highlights */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Production Guarantees</span>
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span><strong>No Loop getValue():</strong> 100% batch operations with <code>getValues()</code> &amp; <code>setValues()</code>.</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span><strong>Race-Condition Free:</strong> Mutative operations acquire <code>LockService.getScriptLock()</code>.</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span><strong>Zero Double-Sends:</strong> Strict composite key validation on <code>email_campaignID_stepNumber</code>.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
