import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientRecord } from '../types';
import { CalendarError, fetchCalendarEvents, fetchCalendars, type CalendarErrorKind, type CalendarEvent, type CalendarInfo } from '../data/calendar';

const ENABLED_KEY = 'szs.calendar.enabled';
const REFRESH_MS = 5 * 60 * 1000;
const DAYS = 7;

export interface CalendarFeed {
  calendars: CalendarInfo[];
  enabledIds: string[];
  toggleCalendar: (id: string) => void;
  events: CalendarEvent[];
  status: 'signed-out' | 'loading' | 'ready' | 'error';
  error: string;
  errorKind: CalendarErrorKind | '';
  loadedAt: Date | null;
  refresh: () => void;
}

function readEnabled(): string[] | null {
  try {
    const raw = localStorage.getItem(ENABLED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string') ? parsed : null;
  } catch {
    return null;
  }
}

/** Today 00:00 local through the next 7 days; reloads every 5 minutes and on refresh(). */
export function useCalendarFeed(accessToken: string | null, clients: readonly ClientRecord[]): CalendarFeed {
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [enabledIds, setEnabledIds] = useState<string[] | null>(readEnabled);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [status, setStatus] = useState<CalendarFeed['status']>(accessToken ? 'loading' : 'signed-out');
  const [error, setError] = useState('');
  const [errorKind, setErrorKind] = useState<CalendarErrorKind | ''>('');
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const clientsRef = useRef(clients);
  clientsRef.current = clients;

  useEffect(() => {
    if (!accessToken) { setStatus('signed-out'); return undefined; }
    const controller = new AbortController();
    const load = async () => {
      setStatus((current) => (current === 'ready' ? current : 'loading'));
      try {
        const list = await fetchCalendars(accessToken, controller.signal);
        setCalendars(list);
        const chosen = (enabledIds ?? list.filter((c) => c.selected).map((c) => c.id)).filter((id) => list.some((c) => c.id === id));
        const from = new Date(); from.setHours(0, 0, 0, 0);
        const to = new Date(from.getTime() + DAYS * 86400000);
        const loaded = chosen.length ? await fetchCalendarEvents(accessToken, chosen, from, to, clientsRef.current, controller.signal) : [];
        setEvents(loaded);
        setLoadedAt(new Date());
        setError('');
        setErrorKind('');
        setStatus('ready');
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : 'Google Calendar could not be read.');
        setErrorKind(caught instanceof CalendarError ? caught.kind : 'other');
        setStatus('error');
      }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, REFRESH_MS);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [accessToken, enabledIds, tick]);

  const toggleCalendar = useCallback((id: string) => {
    setEnabledIds((current) => {
      const base = current ?? calendars.filter((c) => c.selected).map((c) => c.id);
      const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
      try { localStorage.setItem(ENABLED_KEY, JSON.stringify(next)); } catch { /* per-browser convenience only */ }
      return next;
    });
  }, [calendars]);

  return {
    calendars,
    enabledIds: enabledIds ?? calendars.filter((c) => c.selected).map((c) => c.id),
    toggleCalendar,
    events,
    status,
    error,
    errorKind,
    loadedAt,
    refresh: () => setTick((value) => value + 1),
  };
}
