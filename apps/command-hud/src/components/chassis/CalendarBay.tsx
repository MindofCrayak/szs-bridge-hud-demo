import React, { useEffect, useRef, useState } from 'react';
import type { ClientRecord } from '../../types';
import type { CalendarFeed } from '../../hooks/useCalendarFeed';
import { eventDay, eventState, groupByDay, type CalendarEvent } from '../../data/calendar';

/** Owner 2026-11-06: the Calendar bay is a real, read-only Google Calendar view (today, or the next 7 days). */
interface CalendarBayProps {
  feed: CalendarFeed;
  clients: readonly ClientRecord[];
  onOpenClient?: (clientId: string) => void;
}

const API_LIBRARY_URL = 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com';

const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function dayLabel(day: string, today: string): string {
  const tomorrow = localDay(new Date(new Date(`${today}T00:00:00`).getTime() + 86400000));
  if (day === today) return 'Today';
  if (day === tomorrow) return 'Tomorrow';
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

const timeOf = (event: CalendarEvent) => (event.allDay ? 'All day'
  : new Date(event.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }));

const ErrorHelp: React.FC<{ feed: CalendarFeed }> = ({ feed }) => (
  <div className="rounded border border-red-400/50 bg-red-500/10 p-2 text-hud-3 text-red-200" role="alert">
    <p className="font-bold">{feed.error}</p>
    {feed.errorKind === 'scope' && <p className="mt-1 text-[#DDFBD0]/80">MENU (top right) › Sign out, then sign in again. Google will ask to &quot;See your calendars&quot;; allow it.</p>}
    {feed.errorKind === 'auth' && <p className="mt-1 text-[#DDFBD0]/80">MENU (top right) › Sign out, then sign in again.</p>}
    {feed.errorKind === 'api-disabled' && (
      <p className="mt-1 text-[#DDFBD0]/80">
        Open <a href={API_LIBRARY_URL} target="_blank" rel="noreferrer" className="text-[#E0CA3C] underline">Google Calendar API in Google Cloud</a>,
        pick the HUD&apos;s project at the top, press <b>Enable</b>, wait a minute, then press Refresh here.
      </p>
    )}
  </div>
);

export const CalendarBay: React.FC<CalendarBayProps> = ({ feed, clients, onOpenClient }) => {
  const [range, setRange] = useState<'today' | 'week'>(() => {
    try { return localStorage.getItem('szs.calendar.range') === 'week' ? 'week' : 'today'; } catch { return 'today'; }
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!pickerOpen) return undefined;
    const onDown = (event: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setPickerOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pickerOpen]);

  const chooseRange = (next: 'today' | 'week') => {
    setRange(next);
    try { localStorage.setItem('szs.calendar.range', next); } catch { /* convenience only */ }
  };

  const today = localDay(now);
  const days = groupByDay(feed.events).filter((group) => range === 'week' || group.day === today);
  const colorOf = (id: string) => feed.calendars.find((c) => c.id === id)?.color ?? '#086375';
  const nameOf = (clientId: string) => String(clients.find((c) => c.ClientID === clientId)?.Company_Name ?? clientId).replace(/^\[TEST\]\s*/i, '');
  const tab = (active: boolean) => `rounded px-2 py-0.5 text-hud-3 font-bold ${active ? 'bg-[#E0CA3C] text-black' : 'text-[#DDFBD0]/70 hover:bg-[#086375]/40'}`;

  return (
    <div className="flex h-full flex-col overflow-hidden font-mono text-xs">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2 border-b border-[#086375]/40 pb-1.5">
        <div className="flex items-center gap-1" role="group" aria-label="Calendar range">
          <button type="button" onClick={() => chooseRange('today')} aria-pressed={range === 'today'} className={tab(range === 'today')}>Today</button>
          <button type="button" onClick={() => chooseRange('week')} aria-pressed={range === 'week'} className={tab(range === 'week')}>7 days</button>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative" ref={pickerRef}>
            <button type="button" onClick={() => setPickerOpen((open) => !open)} aria-expanded={pickerOpen} disabled={!feed.calendars.length}
              className="rounded border border-[#086375]/60 px-2 py-0.5 text-hud-3 text-[#E0CA3C] hover:border-[#E0CA3C] disabled:opacity-40">
              Calendars ({feed.enabledIds.length}) ▾
            </button>
            {pickerOpen && (
              <div className="absolute bottom-full right-0 z-50 mb-1 max-h-64 w-64 overflow-y-auto rounded-lg border border-[#086375] bg-[#020500] p-1 shadow-xl" role="group" aria-label="Calendars to show">
                {feed.calendars.map((calendar) => (
                  <label key={calendar.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-hud-3 text-[#DDFBD0] hover:bg-[#086375]/30">
                    <input type="checkbox" checked={feed.enabledIds.includes(calendar.id)} onChange={() => feed.toggleCalendar(calendar.id)} style={{ accentColor: calendar.color }} />
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: calendar.color }} aria-hidden="true" />
                    <span className="truncate">{calendar.name}{calendar.primary ? ' (yours)' : ''}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={feed.refresh} aria-label="Refresh calendar" title="Refresh calendar"
            className="rounded border border-[#086375]/60 px-2 py-0.5 text-hud-3 text-[#DDFBD0]/80 hover:border-[#E0CA3C] hover:text-[#E0CA3C]">
            <i className={`fa-solid fa-rotate ${feed.status === 'loading' ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
        {feed.status === 'signed-out' && (
          <p className="m-auto text-center text-hud-3 text-[#DDFBD0]/60">Sign in with Google to see your calendar here.</p>
        )}
        {feed.status === 'error' && <ErrorHelp feed={feed} />}
        {feed.status === 'loading' && !feed.events.length && <p className="m-auto text-hud-3 text-[#DDFBD0]/60">Reading Google Calendar…</p>}
        {feed.status === 'ready' && days.length === 0 && (
          <div className="m-auto flex flex-col items-center text-center text-[#DDFBD0]/55">
            <i className="fa-regular fa-calendar-check mb-1 text-xl text-[#086375]" aria-hidden="true" />
            <p className="text-hud-3">{range === 'today' ? 'Nothing else on the calendar today.' : 'Nothing on the calendar in the next 7 days.'}</p>
          </div>
        )}
        {days.map((group) => (
          <section key={group.day} aria-label={dayLabel(group.day, today)}>
            {range === 'week' && <h3 className="sticky top-0 z-10 bg-[#040706] py-0.5 text-hud-3 font-bold uppercase tracking-wider text-[#E0CA3C]">{dayLabel(group.day, today)}</h3>}
            <ul className="space-y-1">
              {group.events.map((event) => {
                const state = eventDay(event) === today ? eventState(event, now) : 'UPCOMING';
                return (
                  <li key={event.id}
                    className={`rounded border bg-[#020500]/75 p-1.5 ${state === 'LIVE' ? 'border-[#FE5F00]' : 'border-[#086375]/40'} ${state === 'DONE' ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-1.5 text-hud-3">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf(event.calendarId) }} aria-hidden="true" />
                      <span className="font-bold text-[#E0CA3C]">{timeOf(event)}</span>
                      {state === 'LIVE' && <span className="rounded bg-[#FE5F00] px-1 text-hud-2 font-bold text-black">NOW</span>}
                      <span className="ml-auto flex items-center gap-1.5">
                        {event.meetUrl && <a href={event.meetUrl} target="_blank" rel="noreferrer" className="text-[#E0CA3C] underline hover:text-white">Join</a>}
                        {event.htmlLink && <a href={event.htmlLink} target="_blank" rel="noreferrer" className="text-[#DDFBD0]/70 underline hover:text-white" aria-label={`Open ${event.title} in Google Calendar`}>Open</a>}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate font-display text-hud-4 font-bold text-[#DDFBD0]" title={event.title}>{event.title}</div>
                    {(event.clientId || event.location) && (
                      <div className="mt-0.5 flex items-center gap-1.5 text-hud-3 text-[#DDFBD0]/60">
                        {event.clientId && (
                          <button type="button" onClick={() => onOpenClient?.(event.clientId)} disabled={!onOpenClient}
                            title={`Open ${nameOf(event.clientId)} in Solar`}
                            className="rounded border border-[#086375]/60 px-1 text-[#DDFBD0] hover:border-[#E0CA3C] hover:text-[#E0CA3C]">
                            {event.clientId} · {nameOf(event.clientId)}
                          </button>
                        )}
                        {event.location && <span className="truncate">{event.location}</span>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="shrink-0 border-t border-[#086375]/30 pt-1 text-center text-hud-2 text-[#DDFBD0]/45">
        Google Calendar · read-only{feed.loadedAt ? ` · updated ${feed.loadedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}
      </div>
    </div>
  );
};
