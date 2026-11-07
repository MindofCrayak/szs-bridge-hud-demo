import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ClientUnit } from '../types';
import { PendingProposal, parseAlfredProposals } from '../ecs/proposals';
import type { PendingAgentDispatch, AlfredNodeContext } from '../ecs/agentDispatch';
import type { StaffMeetingInput } from '../agents/personas.config';

interface AlfredTerminalProps {
  activeUnit: ClientUnit | null;
  staffMeetingInput?: StaffMeetingInput;
  onProposal?: (proposal: PendingProposal) => void;
  pendingAgentDispatch?: PendingAgentDispatch | null;
  onAgentDispatchHandled?: (dispatchId: number) => void;
}

export interface AlfredTerminalHandle {
  sendMessage: (text: string) => void;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface AlfredContext {
  name?: string;
  id?: string;
  phase?: string;
  step?: string;
  roadblock?: string;
  depositStatus?: string;
  installedComponents?: string[];
  node?: AlfredNodeContext;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const AlfredTerminal = forwardRef<AlfredTerminalHandle, AlfredTerminalProps>(({
  activeUnit,
  staffMeetingInput,
  onProposal,
  pendingAgentDispatch,
  onAgentDispatchHandled,
}, ref) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProxyConfigured, setIsProxyConfigured] = useState<boolean | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const pendingExternalCommandsRef = useRef<string[]>([]);
  const activeUnitIdRef = useRef<string | undefined>(activeUnit?.ClientID ?? activeUnit?.id);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dispatchContextRef = useRef<AlfredNodeContext | null>(null);
  const handledDispatchIdRef = useRef<number | null>(null);
  const dispatchWasPendingAtMountRef = useRef(Boolean(pendingAgentDispatch));
  const isTypingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  activeUnitIdRef.current = activeUnit?.ClientID ?? activeUnit?.id;

  useEffect(() => {
    if (dispatchWasPendingAtMountRef.current) return;
    const controller = new AbortController();
    void fetch('/api/alfred/status', { signal: controller.signal })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok || !isRecord(body) || typeof body.configured !== 'boolean') {
          throw new Error('Alfred proxy status is unavailable.');
        }
        setIsProxyConfigured(body.configured);
      })
      .catch((statusError: unknown) => {
        if (controller.signal.aborted) return;
        setIsProxyConfigured(null);
        setError(statusError instanceof Error ? statusError.message : 'Alfred proxy status is unavailable.');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!pendingAgentDispatch || handledDispatchIdRef.current === pendingAgentDispatch.id) return;
    handledDispatchIdRef.current = pendingAgentDispatch.id;
    dispatchContextRef.current = pendingAgentDispatch.nodeContext;
    setInput(pendingAgentDispatch.prompt);
    setError(null);
    requestAnimationFrame(() => inputRef.current?.focus());
    onAgentDispatchHandled?.(pendingAgentDispatch.id);
  }, [pendingAgentDispatch, onAgentDispatchHandled]);

  useEffect(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    messagesRef.current = [];
    pendingExternalCommandsRef.current = [];
    setMessages([]);
    setError(null);
  }, [activeUnit?.ClientID, activeUnit?.id]);

  const sendMessage = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;
    if (isTypingRef.current) {
      pendingExternalCommandsRef.current.push(text);
      return;
    }
    const conversation = [...messagesRef.current, { role: 'user' as const, text }].slice(-16);
    const requestClientId = activeUnit?.ClientID ?? activeUnit?.id;
    messagesRef.current = conversation;
    setMessages(conversation);
    setError(null);
    isTypingRef.current = true;
    setIsTyping(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const depositPaid = activeUnit?.DepositPaid ?? activeUnit?.depositPaid;
    const context: AlfredContext = activeUnit
      ? {
          name: activeUnit.Company_Name ?? activeUnit.companyName ?? activeUnit.name,
          id: activeUnit.ClientID ?? activeUnit.id,
          phase: activeUnit.AccountPhase ?? activeUnit.pipelineStage,
          step: activeUnit.activeProjects?.[0]?.SprintStage ?? activeUnit.currentMilestone,
          roadblock: activeUnit.roadblock ?? activeUnit.activePebble,
          depositStatus: depositPaid === undefined ? 'unknown' : depositPaid ? 'paid' : 'unpaid',
          installedComponents: activeUnit.activeComponents ?? [],
        }
      : {};
    context.node = dispatchContextRef.current || undefined;
    dispatchContextRef.current = null;

    try {
      if (isProxyConfigured === false) {
        throw new Error('No Gemini key found. Add GEMINI_API_KEY to the repo-root .env.local file, then restart the dev server.');
      }

      const response = await fetch('/api/alfred', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          question: text,
          history: messagesRef.current.slice(0, -1).slice(-16),
          context: /^staff meeting(?:\s*:.*)?$/i.test(text) ? {} : context,
          staffMeeting: /^staff meeting(?:\s*:.*)?$/i.test(text) ? staffMeetingInput : undefined,
        }),
      });
      const body: unknown = await response.json();
      if (!isRecord(body)) throw new Error('Alfred proxy returned an invalid response.');
      if (!response.ok) {
        throw new Error(typeof body.message === 'string' ? body.message : `Alfred request failed (${response.status}).`);
      }
      const responseText = typeof body.text === 'string' ? body.text.trim() : '';
      if (!responseText) {
        throw new Error('Alfred returned an empty response. Please try again.');
      }

      if (activeUnitIdRef.current === requestClientId) {
        const parsed = parseAlfredProposals(responseText, requestClientId || '');
        if (onProposal) parsed.proposals.forEach(onProposal);
        const displayText = onProposal ? parsed.text : responseText;
        setMessages((previous) => {
          const nextMessages: ChatMessage[] = [
            ...previous,
            {
              role: 'model' as const,
              text: displayText || 'A proposal was added for human review. No action was executed.',
            },
          ].slice(-16);
          messagesRef.current = nextMessages;
          return nextMessages;
        });
      }
    } catch (requestError) {
      if (activeUnitIdRef.current === requestClientId) {
        const message = requestError instanceof DOMException && requestError.name === 'AbortError'
          ? 'Stopped.'
          : requestError instanceof Error
            ? requestError.message
            : 'Alfred could not complete the request. Please try again.';
        setError(message);
      }
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      isTypingRef.current = false;
      setIsTyping(false);
    }
  }, [activeUnit, isProxyConfigured, onProposal]);

  useEffect(() => {
    if (!isTyping && pendingExternalCommandsRef.current.length > 0) {
      const nextCommand = pendingExternalCommandsRef.current.shift();
      if (nextCommand) void sendMessage(nextCommand);
    }
  }, [isTyping, sendMessage]);

  useImperativeHandle(ref, () => ({
    sendMessage: (text: string) => { void sendMessage(text); },
  }), [sendMessage]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || isTypingRef.current) return;
    setInput('');
    void sendMessage(text);
  };

  const handleStop = () => {
    pendingExternalCommandsRef.current = [];
    abortControllerRef.current?.abort();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-[#086375]/70 bg-[#020500] p-3 font-mono text-xs"
        aria-live="polite"
        aria-label="Alfred conversation"
      >
        {messages.length === 0 && (
          <p className="text-text-mana/55">Alfred is ready. Ask about the selected client, milestones, or roadblocks.</p>
        )}
        {isProxyConfigured === false && (
          <p role="status" className="text-alert-orange">
            No Gemini key found. Add GEMINI_API_KEY to the repo-root .env.local file, then restart the dev server.
          </p>
        )}
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'text-[#ddfbd0]' : 'text-[#E0CA3C]'}>
            <span className="font-bold">{message.role === 'user' ? 'You' : 'Alfred'}:</span>{' '}
            <span className="whitespace-pre-wrap">{message.text}</span>
          </div>
        ))}
        {isTyping && <p className="animate-pulse text-[#E0CA3C]">Alfred is thinking...</p>}
        {error && <p role="alert" className="text-alert-orange">{error}</p>}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="sticky bottom-0 mt-2 flex gap-2 border-t border-[#086375]/60 bg-[#020500] pt-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Command Alfred..."
          aria-label="Command Alfred"
          data-alfred-input
          disabled={isTyping}
          className="min-w-0 flex-1 rounded-md border border-[#086375] bg-[#020500] px-3 py-2 text-sm text-[#ddfbd0] outline-none placeholder:text-text-mana/45 focus:border-[#E0CA3C] disabled:opacity-60"
        />
        {isTyping ? (
          <button type="button" onClick={handleStop} className="rounded-md border border-alert-orange px-3 text-alert-orange">
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-md bg-alert-orange px-3 font-accent text-bg-obsidian hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
});

AlfredTerminal.displayName = 'AlfredTerminal';
