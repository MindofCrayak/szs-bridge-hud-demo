import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

interface DropConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  serviceName: string;
  priceDelta: number;
  currentValue: number;
  targetClientName: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
}

export const DropConfirmDialog: React.FC<DropConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  serviceName,
  priceDelta,
  currentValue,
  targetClientName,
  isSubmitting = false,
  errorMessage = null,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElement.current = document.activeElement as HTMLElement | null;

    // Focus the first button inside dialog on open
    const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements && focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!isSubmitting) onCancel();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocusedElement.current) {
        try {
          previouslyFocusedElement.current.focus();
        } catch {}
      }
    };
  }, [isOpen, isSubmitting, onCancel]);

  if (!isOpen) return null;

  const finalValue = currentValue + priceDelta;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="financial-mutation-dialog-title"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm select-none font-mono p-4"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-[420px] rounded-2xl border-2 border-[#FE5F00] bg-[#020500] p-5 shadow-[0_0_50px_rgba(254,95,0,0.4)] text-[#DDFBD0] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-[#FE5F00]/40 pb-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#FE5F00]/20 border border-[#FE5F00] flex items-center justify-center text-[#FE5F00]">
            <ShieldAlert size={18} />
          </div>
          <div>
            <h3
              id="financial-mutation-dialog-title"
              className="font-display font-bold text-sm tracking-wide text-white uppercase"
            >
              Financial Mutation Confirmation
            </h3>
            <span className="text-hud-3 text-[#FE5F00] font-bold">
              IRON GATE LEDGER OVERRIDE REQUIRED
            </span>
          </div>
        </div>

        {/* Target Entity */}
        <div className="p-2.5 rounded-lg bg-[#086375]/15 border border-[#086375]/40 mb-3 text-xs">
          <span className="text-hud-3 text-[#086375] uppercase block font-bold">Client Target:</span>
          <span className="font-bold text-[#E0CA3C] text-sm">{targetClientName}</span>
        </div>

        {/* Ledger Impact Delta */}
        <div className="space-y-2 mb-4 bg-[#0d1513] p-3 rounded-xl border border-[#086375]/60">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#DDFBD0]/70">Modular Component:</span>
            <span className="font-bold text-white">{serviceName}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#DDFBD0]/70">Current Contract Value:</span>
            <span className="font-mono text-white">${currentValue.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-[#FE5F00]">
            <span className="font-bold">+ Ledger Increment:</span>
            <span className="font-bold font-mono">+${priceDelta.toLocaleString()}</span>
          </div>
          <div className="border-t border-[#086375]/40 pt-2 flex items-center justify-between text-sm font-bold text-[#E0CA3C]">
            <span>Authoritative New Value:</span>
            <span>${finalValue.toLocaleString()}</span>
          </div>
        </div>

        {/* Guardrail Warning */}
        <div className="flex items-start gap-2 p-2 rounded bg-[#FE5F00]/10 border border-[#FE5F00]/30 text-hud-3 text-[#FE5F00] mb-5">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            According to the Brief, any action changing Contract Value must be verified and confirmed by the human operator before syncing to Master Control.
          </span>
        </div>

        {errorMessage && (
          <div role="alert" className="mb-4 rounded border border-red-500/50 bg-red-950/30 p-2 text-xs text-red-200">
            Master Control did not confirm this attachment: {errorMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 py-2 rounded-lg border border-[#086375] bg-[#020500] hover:bg-[#086375]/30 text-xs font-bold transition-colors cursor-pointer text-[#DDFBD0]/80"
          >
            ABORT DROP
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="flex-1 py-2 rounded-lg border border-[#FE5F00] bg-[#FE5F00] hover:bg-[#FE5F00]/80 text-black text-xs font-bold transition-all shadow-[0_0_15px_rgba(254,95,0,0.5)] cursor-pointer"
          >
            {isSubmitting ? 'SYNCING...' : 'AUTHORIZE MUTATION'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? ReactDOM.createPortal(modalContent, document.body)
    : modalContent;
};
