/**
 * Calendar bay (owner 2026-11-06: "make it a real Google Calendar view"). Read-only. The HUD reads Google
 * Calendar directly with the signed-in owner's token; Master Control is not involved, so its script scopes and
 * triggers are unchanged. Only the browser sign-in asks for calendar.readonly.
 */
import type { ClientRecord } from '../types';

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const API = 'https://www.googleapis.com/calendar/v3';

export interface CalendarInfo {
  id: string;
  name: string;
  color: string;
  primary: boolean;
  /** Shown in Google Calendar's own list (used as the default selection). */
  selected: boolean;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  /** ISO date-time, or YYYY-MM-DD for all-day events. */
  start: string;
  end: string;
  allDay: boolean;
  meetUrl: string;
  htmlLink: string;
  location: string;
  attendees: string[];
  clientId: string;
}

export type CalendarErrorKind = 'scope' | 'api-disabled' | 'auth' | 'other';

export class CalendarError extends Error {
  readonly kind: CalendarErrorKind;
  constructor(message: string, kind: CalendarErrorKind) {
    super(message);
    this.name = 'CalendarError';
    this.kind = kind;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value : '');

/** Pure: Google's error body -> a plain reason the owner can act on. */
export function calendarErrorFrom(status: number, body: unknown): CalendarError {
  const error = isRecord(body) && isRecord(body.error) ? body.error : {};
  const message = text(error.message);
  const reasons = Array.isArray(error.errors) ? error.errors.filter(isRecord).map((item) => text(item.reason)) : [];
  const details = Array.isArray(error.details) ? JSON.stringify(error.details) : '';
  if (status === 401) return new CalendarError('Your Google sign-in has expired. Sign out and sign in again.', 'auth');
  if (status === 403 && (reasons.includes('accessNotConfigured') || /SERVICE_DISABLED|has not been used|is disabled/i.test(message + details))) {
    return new CalendarError('The Google Calendar API is turned off for this HUD\'s Google Cloud project.', 'api-disabled');
  }
  if (status === 403 && (reasons.includes('insufficientPermissions') || /insufficient|scope/i.test(message))) {
    return new CalendarError('This sign-in has no calendar permission yet. Sign out and sign in again, and allow "See your calendars".', 'scope');
  }
  return new CalendarError(message || `Google Calendar returned HTTP ${status}.`, 'other');
}

async function getJson(token: string, url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw calendarErrorFrom(response.status, body);
  return body;
}

/** Pure: calendarList response -> calendars, primary first. */
export function parseCalendarList(value: unknown): CalendarInfo[] {
  const items = isRecord(value) && Array.isArray(value.items) ? value.items.filter(isRecord) : [];
  return items
    .filter((item) => text(item.id))
    .map((item) => ({
      id: text(item.id),
      name: text(item.summaryOverride) || text(item.summary) || text(item.id),
      color: text(item.backgroundColor) || '#086375',
      primary: item.primary === true,
      selected: item.selected === true || item.primary === true,
    }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name));
}

/** Pure: which client an event is about (ClientID word, company name, or a client email among the attendees). */
export function matchClient(title: string, description: string, attendees: string[], clients: readonly ClientRecord[]): string {
  const haystack = `${title}\n${description}`.toLowerCase();
  const emails = attendees.map((email) => email.toLowerCase());
  for (const client of clients) {
    const own = [client.ContactEmail, client.GoogleGroupEmail].filter(Boolean).map((email) => String(email).toLowerCase());
    if (own.some((email) => emails.includes(email))) return client.ClientID;
  }
  for (const client of clients) {
    const company = String(client.Company_Name || '').replace(/^\[TEST\]\s*/i, '').trim().toLowerCase();
    if (company.length >= 4 && haystack.includes(company)) return client.ClientID;
    if (client.ClientID && new RegExp(`(^|[^A-Za-z0-9])${client.ClientID}([^A-Za-z0-9]|$)`).test(`${title}\n${description}`)) return client.ClientID;
  }
  return '';
}

/** Pure: events response -> events, without cancelled ones or ones the owner declined. */
export function parseCalendarEvents(value: unknown, calendarId: string, clients: readonly ClientRecord[]): CalendarEvent[] {
  const items = isRecord(value) && Array.isArray(value.items) ? value.items.filter(isRecord) : [];
  return items.flatMap((item) => {
    if (text(item.status) === 'cancelled') return [];
    const attendeeRows = Array.isArray(item.attendees) ? item.attendees.filter(isRecord) : [];
    if (attendeeRows.some((attendee) => attendee.self === true && text(attendee.responseStatus) === 'declined')) return [];
    const start = isRecord(item.start) ? item.start : {};
    const end = isRecord(item.end) ? item.end : {};
    const allDay = !text(start.dateTime) && Boolean(text(start.date));
    const video = isRecord(item.conferenceData) && Array.isArray(item.conferenceData.entryPoints)
      ? item.conferenceData.entryPoints.filter(isRecord).find((entry) => text(entry.entryPointType) === 'video')
      : undefined;
    const attendees = attendeeRows.map((attendee) => text(attendee.email)).filter(Boolean);
    const title = text(item.summary) || '(no title)';
    return [{
      id: `${calendarId}:${text(item.id)}`,
      calendarId,
      title,
      start: text(start.dateTime) || text(start.date),
      end: text(end.dateTime) || text(end.date),
      allDay,
      meetUrl: text(item.hangoutLink) || (video ? text(video.uri) : ''),
      htmlLink: text(item.htmlLink),
      location: text(item.location),
      attendees,
      clientId: matchClient(title, text(item.description), attendees, clients),
    }];
  });
}

/** Pure: local YYYY-MM-DD of an event start (all-day events already are). */
export function eventDay(event: Pick<CalendarEvent, 'start' | 'allDay'>): string {
  if (event.allDay) return event.start.slice(0, 10);
  const d = new Date(event.start);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Pure: sorted, de-duplicated (same event on two calendars), grouped by local day. */
export function groupByDay(events: CalendarEvent[]): { day: string; events: CalendarEvent[] }[] {
  const seen = new Set<string>();
  const unique = events
    .slice()
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start))
    .filter((event) => {
      const key = `${event.title}|${event.start}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const days = new Map<string, CalendarEvent[]>();
  unique.forEach((event) => { const day = eventDay(event); days.set(day, [...(days.get(day) ?? []), event]); });
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => ({ day, events: list }));
}

/** Pure: LIVE while a timed event runs, DONE after it ends, UPCOMING before (all-day events count as upcoming). */
export function eventState(event: CalendarEvent, now: Date): 'LIVE' | 'DONE' | 'UPCOMING' {
  if (event.allDay) return 'UPCOMING';
  const start = new Date(event.start).getTime();
  const end = new Date(event.end || event.start).getTime();
  if (now.getTime() >= end) return 'DONE';
  if (now.getTime() >= start) return 'LIVE';
  return 'UPCOMING';
}

export async function fetchCalendars(token: string, signal?: AbortSignal): Promise<CalendarInfo[]> {
  return parseCalendarList(await getJson(token, `${API}/users/me/calendarList?minAccessRole=reader&maxResults=100`, signal));
}

export async function fetchCalendarEvents(
  token: string,
  calendarIds: string[],
  from: Date,
  to: Date,
  clients: readonly ClientRecord[],
  signal?: AbortSignal,
): Promise<CalendarEvent[]> {
  const query = new URLSearchParams({
    timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '100',
  });
  const lists = await Promise.all(calendarIds.map(async (id) => parseCalendarEvents(
    await getJson(token, `${API}/calendars/${encodeURIComponent(id)}/events?${query.toString()}`, signal), id, clients,
  )));
  return lists.flat();
}
