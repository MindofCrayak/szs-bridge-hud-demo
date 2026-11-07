import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class HudErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🛰️ HUD ErrorBoundary caught:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[140px] flex flex-col items-center justify-center p-4 rounded-xl border border-[#FE5F00] bg-[#020500]/95 text-[#DDFBD0] font-mono text-xs select-none">
          <div className="flex items-center gap-2 text-[#FE5F00] font-bold mb-1">
            <i className="fa-solid fa-triangle-exclamation" />
            <span>{this.props.fallbackTitle || 'SUBSYSTEM ISOLATION FAULT'}</span>
          </div>
          <p className="text-hud-3 text-[#DDFBD0]/60 text-center max-w-sm mb-3">
            {this.state.error?.message || 'A component encountered a runtime exception. Adjacent bays remain active.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3 py-1 rounded border border-[#E0CA3C] bg-[#E0CA3C]/10 text-[#E0CA3C] hover:bg-[#E0CA3C] hover:text-black font-bold text-hud-3 transition-colors cursor-pointer"
          >
            RE-ENGAGE SUBSYSTEM
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
