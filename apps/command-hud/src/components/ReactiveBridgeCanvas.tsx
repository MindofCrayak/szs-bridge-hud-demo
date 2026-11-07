import React, { useEffect, useState } from 'react';

interface ReactiveBridgeCanvasProps {
  /** Which sub-routine department is currently active/selected */
  activeDepartment?: string;
  /** Number of active (non-dismissed) alerts */
  alertsCount?: number;
  /** Optional theme override */
  theme?: 'tactical-hex' | 'obsidian-grid' | 'crystal-strata';
}

const getAtmosphericGlow = (activeDepartment?: string, alertsCount = 0): string => {
  if (alertsCount > 0) {
    return 'radial-gradient(circle at 50% 0%, rgba(254, 95, 0, 0.14) 0%, transparent 70%)';
  }
  switch (activeDepartment) {
    case 'Oracle':
      return 'radial-gradient(circle at 70% 30%, rgba(8, 99, 117, 0.22) 0%, transparent 60%)';
    case 'Vala':
      return 'radial-gradient(circle at 50% 80%, rgba(224, 202, 60, 0.14) 0%, transparent 65%)';
    case 'Dolores':
      return 'radial-gradient(circle at 30% 50%, rgba(95, 15, 64, 0.22) 0%, transparent 60%)';
    case 'Pamela':
      return 'radial-gradient(circle at 20% 20%, rgba(221, 251, 208, 0.12) 0%, transparent 55%)';
    case 'Daisy':
      return 'radial-gradient(circle at 80% 80%, rgba(254, 95, 0, 0.12) 0%, transparent 60%)';
    case 'Alfred':
      return 'radial-gradient(circle at 50% 50%, rgba(254, 95, 0, 0.08) 0%, transparent 50%)';
    default:
      return 'none';
  }
};

export const ReactiveBridgeCanvas: React.FC<ReactiveBridgeCanvasProps> = ({
  activeDepartment,
  alertsCount = 0,
  theme = 'obsidian-grid',
}) => {
  const [currentTheme, setCurrentTheme] = useState<string>(theme);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('szs_canvas_theme');
      if (stored) setCurrentTheme(stored);
    } catch {}

    const handleStorage = () => {
      try {
        const stored = localStorage.getItem('szs_canvas_theme');
        if (stored) setCurrentTheme(stored);
      } catch {}
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <div 
      data-canvas-theme={currentTheme}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
    >
      {/* Dynamic Atmospheric Tint reacting to active subroutine */}
      <div
        className="absolute inset-0 transition-all duration-1000 ease-in-out"
        style={{ background: getAtmosphericGlow(activeDepartment, alertsCount) }}
      />

      {/* Swappable Background Texture */}
      {currentTheme === 'obsidian-grid' && (
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #086375 1px, transparent 1px),
              linear-gradient(to bottom, #086375 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
      )}

      {currentTheme === 'tactical-hex' && (
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, #086375 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
      )}

      {currentTheme === 'crystal-strata' && (
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(135deg, #086375 25%, transparent 25%),
              linear-gradient(225deg, #086375 25%, transparent 25%),
              linear-gradient(45deg, #086375 25%, transparent 25%),
              linear-gradient(315deg, #086375 25%, transparent 25%)
            `,
            backgroundPosition: '10px 0, 10px 0, 0 0, 0 0',
            backgroundSize: '40px 40px',
          }}
        />
      )}

      {/* Radar Sweep Ring (when Oracle is active) */}
      {activeDepartment === 'Oracle' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-[850px] h-[850px] rounded-full border border-[#086375]/25 animate-ping" style={{ animationDuration: '3.5s' }} />
        </div>
      )}

      {/* Alert Perimeter Strobe (when alerts > 0) */}
      {alertsCount > 0 && (
        <div
          className="absolute inset-0 animate-pulse opacity-30"
          style={{
            animationDuration: '2s',
            boxShadow: 'inset 0 0 80px rgba(254, 95, 0, 0.18), inset 0 0 200px rgba(254, 95, 0, 0.06)',
          }}
        />
      )}

      {/* Coordinate Telemetry Watermark */}
      <div className="absolute bottom-3 right-4 font-mono text-hud-3 text-[#086375]/35 select-none tracking-widest">
        SZS-HORIZON // SPATIAL MATRIX // 47°33&apos;56&quot;N 122°37&apos;44&quot;W // TELEMETRY: NOMINAL
      </div>
    </div>
  );
};
