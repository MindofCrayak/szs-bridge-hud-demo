import React, { useState, useRef, useEffect } from 'react';
import { ScreenView, ClientRecord } from '../../types';
import { SolarMapSelector } from './SolarMapSelector';
import { UiScaleControl } from './UiScaleControl';
import type { DepartmentNotification, NotificationDepartment } from '../../notifications/summary';
import { notificationSeverityColor } from '../../notifications/summary';
import type { HudStats } from '../../data/hudStats';
import { compactMoney } from '../../data/hudStats';

type DashboardLevel = 'universe' | 'galaxy' | 'solar';

interface SkyHeaderProps {
  currentScreen: ScreenView;
  dashboardLevel: DashboardLevel;
  onDashboardLevelChange: (level: DashboardLevel) => void;
  /** Up one level: other screen -> board, Planet -> Solar, Solar -> Galaxy, Galaxy -> Universe. Undefined at the top. */
  onBack?: () => void;
  backLabel?: string;
  selectedClientName?: string | null;
  selectedProjectName?: string | null;
  selectedProjectId?: string | null;
  onSelectProject?: (projectId: string | null) => void;
  stats: HudStats;
  onSelectScreen: (screen: ScreenView) => void;
  onSignOut: () => void;
  onOpenKeybindings?: () => void;
  currentSkin?: string;
  onToggleSkin?: () => void;
  onOpenCockpitWindow: () => void;
  clients?: ClientRecord[];
  activeClientId?: string | null;
  onSelectClient?: (client: ClientRecord) => void;
  notifications?: DepartmentNotification[];
  onSelectNotificationDepartment?: (department: NotificationDepartment) => void;
}

/** Department screens, always one click away (owner 2026-11-06: leaving and returning to views must be easy). */
export const SCREEN_TABS: { id: ScreenView; label: string; icon: string; hotkey: string }[] = [
  { id: 'osint', label: 'OSINT', icon: 'fa-crosshairs', hotkey: 'Alt+2' },
  { id: 'symphony', label: 'SYMPHONY', icon: 'fa-wave-square', hotkey: 'Alt+3' },
  { id: 'treasure', label: 'TREASURE', icon: 'fa-coins', hotkey: 'Alt+4' },
  { id: 'archive', label: 'MAIL', icon: 'fa-envelope-open-text', hotkey: 'Alt+5' },
  { id: 'clients', label: 'CLIENTS', icon: 'fa-address-book', hotkey: 'Alt+6' },
];

/** StarCraft-style resource readout: icon, value, small caption; the whole cell explains itself on hover. */
const Resource: React.FC<{ icon: string; value: string; caption: string; title: string; color: string; onClick?: () => void; pulse?: boolean }> = ({
  icon, value, caption, title, color, onClick, pulse,
}) => {
  const body = (
    <>
      <i className={`fa-solid ${icon} text-hud-3`} style={{ color }} aria-hidden="true" />
      <span className="flex flex-col leading-none">
        <span className="text-hud-4 font-bold tabular-nums" style={{ color }}>{value}</span>
        <span className="mt-0.5 text-hud-1 tracking-widest text-[#DDFBD0]/55">{caption}</span>
      </span>
    </>
  );
  const cls = `flex items-center gap-1.5 rounded px-1.5 py-0.5 ${pulse ? 'animate-pulse' : ''}`;
  return onClick ? (
    <button type="button" onClick={onClick} title={title} aria-label={title} className={`${cls} hover:bg-[#086375]/30`}>{body}</button>
  ) : (
    <div title={title} aria-label={title} className={cls}>{body}</div>
  );
};

export const SkyHeader: React.FC<SkyHeaderProps> = ({
  currentScreen,
  dashboardLevel,
  onDashboardLevelChange,
  onBack,
  backLabel,
  selectedClientName,
  selectedProjectName,
  selectedProjectId = null,
  onSelectProject,
  stats,
  onSelectScreen,
  onSignOut,
  onOpenKeybindings,
  currentSkin = 'heraldry-gold',
  onToggleSkin,
  onOpenCockpitWindow,
  clients = [],
  activeClientId = null,
  onSelectClient,
  notifications = [],
  onSelectNotificationDepartment,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFocusedMode, setIsFocusedMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('szs_header_focus_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [isHoveringTop, setIsHoveringTop] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const toggleFocusMode = () => {
    setIsFocusedMode((prev) => {
      const next = !prev;
      try { localStorage.setItem('szs_header_focus_mode', String(next)); } catch { /* optional */ }
      return next;
    });
  };

  const isHidden = isFocusedMode && !isHoveringTop;
  const onBoard = currentScreen === 'dashboard';
  const levelClass = (active: boolean) => `rounded px-2 py-1 text-hud-4 font-bold ${active ? 'bg-[#FE5F00] text-black' : 'text-[#DDFBD0]/70 hover:bg-[#086375]/40 hover:text-[#DDFBD0]'}`;
  const menuItem = 'w-full text-left px-2.5 py-1.5 rounded hover:bg-[#086375]/30 text-hud-3 text-[#DDFBD0] flex items-center justify-between gap-2 cursor-pointer';
  const close = (fn: () => void) => () => { fn(); setIsMenuOpen(false); };

  return (
    <>
      {isFocusedMode && (
        <div onMouseEnter={() => setIsHoveringTop(true)} className="fixed top-0 left-0 right-0 h-2 z-[130] pointer-events-auto" />
      )}

      <header
        onMouseEnter={() => isFocusedMode && setIsHoveringTop(true)}
        onMouseLeave={() => isFocusedMode && setIsHoveringTop(false)}
        className={`relative z-[70] h-[48px] shrink-0 border-b border-[#086375]/60 bg-gradient-to-b from-[#06100c] to-[#020500] px-2 flex items-center justify-between gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.8)] select-none transition-transform duration-200 ease-out font-mono text-xs ${
          isHidden ? '-translate-y-full' : 'translate-y-0'
        }`}
      >
        {/* LEFT: home and back (the Solar canvas controls moved to the workbench ribbon, owner 2026-11-06) */}
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            className="h-7 px-2 rounded bg-[#FE5F00] font-serif-display text-xs font-bold text-[#020500] hover:brightness-110 cursor-pointer"
            onClick={() => onDashboardLevelChange('universe')}
            title="Home: Universe (Alt+1)"
          >
            SZS
          </button>
          <button
            type="button"
            onClick={onBack}
            disabled={!onBack}
            title={onBack ? `Back to ${backLabel} (Backspace)` : 'Already at the top (Universe)'}
            aria-label={onBack ? `Back to ${backLabel}` : 'Back (already at the top)'}
            className="flex h-7 items-center gap-1 rounded border border-[#086375]/60 px-2 text-hud-3 font-bold text-[#DDFBD0]/80 hover:border-[#E0CA3C] hover:text-[#E0CA3C] disabled:opacity-30 disabled:hover:border-[#086375]/60 disabled:hover:text-[#DDFBD0]/80"
          >
            <i className="fa-solid fa-chevron-left text-hud-1" />
            <span className="hidden 2xl:inline">BACK</span>
          </button>
        </div>

        {/* CENTER: one navigation bar. Board levels on the left, department screens on the right; both always shown. */}
        <nav aria-label="Main navigation" className="flex min-w-0 items-center gap-1 rounded-lg border border-[#086375]/50 bg-[#040706] p-0.5">
          <button type="button" onClick={() => onDashboardLevelChange('universe')} aria-current={onBoard && dashboardLevel === 'universe' ? 'page' : undefined}
            title="Universe: every project by phase (Alt+1)" className={levelClass(onBoard && dashboardLevel === 'universe')}>UNIVERSE</button>
          <span aria-hidden="true" className="text-[#086375]">›</span>
          <button type="button" onClick={() => onDashboardLevelChange('galaxy')} aria-current={onBoard && dashboardLevel === 'galaxy' ? 'page' : undefined}
            title={selectedClientName ? `Galaxy: stage board (${selectedClientName} selected)` : 'Galaxy: stage board'} className={levelClass(onBoard && dashboardLevel === 'galaxy')}>GALAXY</button>
          <span aria-hidden="true" className="text-[#086375]">›</span>
          <button type="button" onClick={() => onDashboardLevelChange('solar')} disabled={!selectedClientName} aria-current={onBoard && dashboardLevel === 'solar' ? 'page' : undefined}
            title={selectedClientName ? `Solar: ${selectedClientName}` : 'Pick a client first (▾ next to SOLAR)'} className={`${levelClass(onBoard && dashboardLevel === 'solar')} disabled:opacity-40`}>SOLAR</button>
          {onSelectClient && (
            <SolarMapSelector clients={clients} activeClientId={activeClientId} onSelectClient={onSelectClient} />
          )}
          {onBoard && dashboardLevel === 'solar' && selectedClientName && (
            <>
              <span aria-hidden="true" className="text-[#086375]">›</span>
              <button type="button" onClick={() => onSelectProject?.(null)} title={selectedClientName}
                className="max-w-28 truncate rounded px-2 py-1 text-left text-hud-3 font-bold text-[#E0CA3C] hover:bg-[#086375]/30 md:max-w-40">
                {selectedClientName}
              </button>
              {selectedProjectId && (
                <>
                  <span aria-hidden="true" className="hidden text-[#086375] lg:inline">›</span>
                  <button type="button" onClick={() => onSelectProject?.(selectedProjectId)} aria-current="page" title={selectedProjectName || selectedProjectId}
                    className="hidden max-w-36 truncate rounded px-2 py-1 text-left text-hud-3 text-[#DDFBD0]/80 hover:bg-[#086375]/30 lg:block">
                    {selectedProjectName || selectedProjectId}
                  </button>
                </>
              )}
            </>
          )}
          <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-[#086375]/70" />
          {SCREEN_TABS.map((view) => {
            const isActive = currentScreen === view.id;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => onSelectScreen(view.id)}
                aria-current={isActive ? 'page' : undefined}
                title={`${view.label} (${view.hotkey})`}
                aria-label={view.label}
                className={`flex items-center gap-1.5 rounded px-2 py-1 text-hud-3 font-bold ${isActive ? 'bg-[#E0CA3C] text-black' : 'text-[#DDFBD0]/70 hover:bg-[#086375]/40 hover:text-[#DDFBD0]'}`}
              >
                <i className={`fa-solid ${view.icon} text-hud-2`} />
                <span className="hidden 2xl:inline">{view.label}</span>
              </button>
            );
          })}
        </nav>

        {/* RIGHT: resource readout, then menu, palette, pin */}
        <div className="flex shrink-0 items-center gap-1">
          <div className="hidden items-center gap-0.5 rounded-lg border border-[#086375]/50 bg-[#040706] px-1 lg:flex" aria-label="Business resources">
            <Resource icon="fa-sack-dollar" value={compactMoney(stats.collected)} caption="PAID" color="#34d399"
              title={`Collected: $${stats.collected.toLocaleString('en-US')} in paid invoices`} />
            <Resource icon="fa-file-invoice-dollar" value={compactMoney(stats.outstanding)} caption="OWED" color="#E0CA3C"
              title={`Outstanding: $${stats.outstanding.toLocaleString('en-US')} in unpaid invoices`} onClick={() => onSelectScreen('treasure')} />
            <Resource icon="fa-diagram-project" value={`${stats.openProjects}/${stats.totalProjects}`} caption="PROJ" color="#3C91E6"
              title={`${stats.openProjects} open projects of ${stats.totalProjects} (open = not at 09 Sunset)`} onClick={() => onDashboardLevelChange('galaxy')} />
            <Resource icon="fa-triangle-exclamation" value={String(stats.openAlerts)} caption={stats.blockAlerts ? `${stats.blockAlerts} BLOCK` : 'ALERTS'}
              color={stats.blockAlerts ? '#f87171' : stats.openAlerts ? '#FE5F00' : '#DDFBD0'}
              title={`${stats.openAlerts} open alerts, ${stats.blockAlerts} at BLOCK severity. Click for the department list.`} onClick={() => setIsMenuOpen(true)} />
            {stats.depositsDue > 0 && (
              <Resource icon="fa-hand-holding-dollar" value={String(stats.depositsDue)} caption="DEP DUE" color="#FE5F00" pulse
                title={`${stats.depositsDue} Session Zero client(s) have not paid the deposit`} onClick={() => onDashboardLevelChange('universe')} />
            )}
          </div>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-expanded={isMenuOpen}
              title="Menu: department items, screens, settings"
              className={`flex h-7 items-center gap-1 px-2 rounded border text-hud-3 font-bold cursor-pointer ${
                isMenuOpen ? 'border-[#E0CA3C] bg-[#E0CA3C]/20 text-[#E0CA3C]' : 'border-[#086375]/60 bg-[#086375]/15 text-[#DDFBD0]/80 hover:border-[#E0CA3C]'
              }`}
            >
              <i className="fa-solid fa-bars text-hud-1" />
              <span>MENU</span>
              {stats.openAlerts > 0 && <span className="rounded bg-[#FE5F00] px-1 text-hud-1 text-black">{stats.openAlerts}</span>}
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 max-h-[80vh] w-[min(22rem,90vw)] overflow-auto rounded-xl border border-[#086375] bg-[#020500]/98 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.9)] backdrop-blur-md z-50">
                <section className="mb-1 rounded border border-[#086375]/50 p-2">
                  <h2 className="mb-1 text-hud-2 font-bold tracking-widest text-[#E0CA3C]">OPEN DEPARTMENT ITEMS</h2>
                  {notifications.length === 0 && <p className="px-2 py-1 text-hud-3 text-[#DDFBD0]/50">Nothing open.</p>}
                  {notifications.map((item) => (
                    <button
                      key={item.department}
                      type="button"
                      onClick={close(() => onSelectNotificationDepartment?.(item.department))}
                      aria-label={`${item.department}, ${item.count} open item${item.count === 1 ? '' : 's'}, highest severity ${item.severity || 'none'}`}
                      className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-hud-3 hover:bg-[#086375]/30"
                      style={{ color: notificationSeverityColor(item.severity) }}
                    >
                      <span>{item.department}</span>
                      <span>{item.count}{item.severity ? ` · ${item.severity}` : ''}</span>
                    </button>
                  ))}
                </section>
                <h2 className="px-2.5 pt-1 text-hud-2 font-bold tracking-widest text-[#E0CA3C]">GO TO</h2>
                <button type="button" onClick={close(() => onDashboardLevelChange('universe'))} className={menuItem}><span>Universe</span><kbd className="text-hud-1 text-[#DDFBD0]/50">Alt+1</kbd></button>
                <button type="button" onClick={close(() => onDashboardLevelChange('galaxy'))} className={menuItem}><span>Galaxy</span></button>
                {SCREEN_TABS.map((view) => (
                  <button key={view.id} type="button" onClick={close(() => onSelectScreen(view.id))} className={menuItem}>
                    <span><i className={`fa-solid ${view.icon} w-4 text-center`} /> {view.label[0]}{view.label.slice(1).toLowerCase()}</span>
                    <kbd className="text-hud-1 text-[#DDFBD0]/50">{view.hotkey}</kbd>
                  </button>
                ))}
                <button type="button" onClick={close(() => onSelectScreen('actions'))} className={menuItem}><span><i className="fa-solid fa-table-cells w-4 text-center" /> Command palette</span><kbd className="text-hud-1 text-[#DDFBD0]/50">Ctrl+K</kbd></button>
                <div className="my-1 border-t border-[#086375]/40" />
                <h2 className="px-2.5 pt-1 text-hud-2 font-bold tracking-widest text-[#E0CA3C]">COCKPIT</h2>
                <button type="button" onClick={close(() => onSelectScreen('cockpit'))} className={menuItem}><span><i className="fa-solid fa-gauge-high w-4 text-center" /> Cockpit in this window</span><kbd className="text-hud-1 text-[#DDFBD0]/50">Alt+8</kbd></button>
                <button type="button" onClick={close(onOpenCockpitWindow)} className={menuItem}><span><i className="fa-solid fa-up-right-from-square w-4 text-center" /> Cockpit on the side screen</span><span className="text-hud-1 text-[#DDFBD0]/50">new window</span></button>
                <div className="my-1 border-t border-[#086375]/40" />
                {onToggleSkin && (
                  <button type="button" onClick={close(onToggleSkin)} className={menuItem}>
                    <span>Board colours: {currentSkin === 'heraldry-gold' ? 'Gold' : 'Stealth'}</span>
                    <i className={`fa-solid ${currentSkin === 'heraldry-gold' ? 'fa-shield-halved text-[#E0CA3C]' : 'fa-ghost text-[#086375]'}`} />
                  </button>
                )}
                <div className="px-2.5 py-1.5"><UiScaleControl /></div>
                {onOpenKeybindings && (
                  <button type="button" onClick={close(onOpenKeybindings)} className={menuItem}><span>Settings &amp; keyboard shortcuts</span><kbd className="text-hud-1 text-[#DDFBD0]/50">F1</kbd></button>
                )}
                <button type="button" onClick={close(toggleFocusMode)} className={menuItem}>
                  <span>Auto-hide this bar: {isFocusedMode ? 'on' : 'off'}</span><i className="fa-solid fa-thumbtack" />
                </button>
                <div className="my-1 border-t border-[#086375]/40" />
                <button type="button" onClick={close(onSignOut)} className={`${menuItem} font-bold text-[#FE5F00] hover:bg-[#FE5F00]/20`}>
                  <span>Sign out</span><i className="fa-solid fa-right-from-bracket text-hud-1" />
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSelectScreen('actions')}
            className="flex h-7 items-center gap-1 px-2 rounded border border-[#086375]/60 bg-[#086375]/10 text-[#DDFBD0]/70 hover:border-[#E0CA3C] hover:text-[#E0CA3C] text-hud-3 cursor-pointer"
            title="Command palette (Ctrl+K)"
            aria-label="Command palette (Ctrl+K)"
          >
            <i className="fa-solid fa-magnifying-glass text-hud-1" />
            <kbd className="hidden text-hud-1 px-1 rounded bg-[#020500] border border-[#086375] xl:inline">Ctrl K</kbd>
          </button>

          <button
            type="button"
            onClick={toggleFocusMode}
            className={`h-7 px-2 rounded border text-hud-2 cursor-pointer ${isFocusedMode ? 'border-[#E0CA3C] bg-[#E0CA3C]/20 text-[#E0CA3C]' : 'border-[#086375]/60 text-[#DDFBD0]/60 hover:text-[#DDFBD0]'}`}
            title={isFocusedMode ? 'Auto-hide is on: the bar slides away until you point at the top edge. Click to keep it shown.' : 'Keep this bar shown. Click to auto-hide it.'}
            aria-label="Toggle auto-hide for the top bar"
            aria-pressed={isFocusedMode}
          >
            <i className={`fa-solid fa-thumbtack ${isFocusedMode ? '-rotate-45' : ''}`} />
          </button>
        </div>
      </header>
    </>
  );
};
