import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calendarErrorFrom, eventDay, eventState, groupByDay, matchClient, parseCalendarEvents, parseCalendarList,
} from './calendar';
import type { ClientRecord } from '../types';

const clients = [
  { ClientID: 'PAC', Company_Name: '[TEST] Prime Auto Collision', ContactEmail: 'pat.pac@example.com', GoogleGroupEmail: 'client-pac@sessionzero.solutions' },
  { ClientID: 'HLW', Company_Name: '[TEST] Harbor Line Woodworks', ContactEmail: 'hal.hlw@example.com' },
] as unknown as ClientRecord[];

test('calendar list: primary first, selected defaults, names and colours', () => {
  const list = parseCalendarList({ items: [
    { id: 'team@x', summary: 'Team', backgroundColor: '#ff0000', selected: true },
    { id: 'me@x', summary: 'me@x', summaryOverride: 'Drake', primary: true },
    { id: 'holidays', summary: 'Holidays' },
    { summary: 'no id' },
  ] });
  assert.deepEqual(list.map((c) => [c.id, c.name, c.primary, c.selected]), [
    ['me@x', 'Drake', true, true], ['holidays', 'Holidays', false, false], ['team@x', 'Team', false, true],
  ]);
  assert.equal(list[2].color, '#ff0000');
  assert.deepEqual(parseCalendarList(null), []);
});

test('events: Meet link, all-day, client match, cancelled and declined dropped', () => {
  const events = parseCalendarEvents({ items: [
    { id: '1', summary: 'PAC kickoff', start: { dateTime: '2026-11-06T15:00:00Z' }, end: { dateTime: '2026-11-06T16:00:00Z' }, hangoutLink: 'https://meet.google.com/abc' },
    { id: '2', summary: 'Design review', start: { date: '2026-11-07' }, end: { date: '2026-11-08' },
      attendees: [{ email: 'HAL.HLW@example.com' }], conferenceData: { entryPoints: [{ entryPointType: 'phone', uri: 'tel:1' }, { entryPointType: 'video', uri: 'https://zoom.us/j/1' }] } },
    { id: '3', summary: 'Gone', status: 'cancelled', start: { dateTime: '2026-11-06T10:00:00Z' } },
    { id: '4', summary: 'Nope', start: { dateTime: '2026-11-06T11:00:00Z' }, attendees: [{ email: 'me@x', self: true, responseStatus: 'declined' }] },
    { id: '5', start: { dateTime: '2026-11-06T12:00:00Z' }, end: { dateTime: '2026-11-06T12:30:00Z' } },
  ] }, 'me@x', clients);
  assert.deepEqual(events.map((e) => e.id), ['me@x:1', 'me@x:2', 'me@x:5']);
  assert.equal(events[0].meetUrl, 'https://meet.google.com/abc');
  assert.equal(events[0].clientId, 'PAC');
  assert.equal(events[1].allDay, true);
  assert.equal(events[1].meetUrl, 'https://zoom.us/j/1');
  assert.equal(events[1].clientId, 'HLW', 'matched by attendee email, case-insensitive');
  assert.equal(events[2].title, '(no title)');
  assert.equal(events[2].clientId, '');
});

test('client match: company name without [TEST], ClientID only as a whole word', () => {
  assert.equal(matchClient('Call with Harbor Line Woodworks', '', [], clients), 'HLW');
  assert.equal(matchClient('Spacing review', '', [], clients), '', '"PAC" inside a word does not match');
  assert.equal(matchClient('Prep', 'Agenda for PAC-02', [], clients), 'PAC');
  assert.equal(matchClient('Sync', '', ['client-pac@sessionzero.solutions'], clients), 'PAC');
});

test('grouping by day, duplicates across calendars removed, live/done state', () => {
  const base = { calendarId: 'a', end: '', meetUrl: '', htmlLink: '', location: '', attendees: [], clientId: '' };
  const events = [
    { ...base, id: 'a:2', title: 'Later', start: '2026-11-06T18:00:00', allDay: false },
    { ...base, id: 'a:1', title: 'Early', start: '2026-11-06T09:00:00', allDay: false },
    { ...base, id: 'b:1', calendarId: 'b', title: 'Early', start: '2026-11-06T09:00:00', allDay: false },
    { ...base, id: 'a:3', title: 'Holiday', start: '2026-11-07', allDay: true },
  ];
  const days = groupByDay(events);
  assert.deepEqual(days.map((d) => [d.day, d.events.map((e) => e.title)]), [
    ['2026-11-06', ['Early', 'Later']], ['2026-11-07', ['Holiday']],
  ]);
  assert.equal(eventDay(events[3]), '2026-11-07');
  const meeting = { ...base, id: 'x', title: 'M', start: '2026-11-06T09:00:00Z', end: '2026-11-06T10:00:00Z', allDay: false };
  assert.equal(eventState(meeting, new Date('2026-11-06T08:00:00Z')), 'UPCOMING');
  assert.equal(eventState(meeting, new Date('2026-11-06T09:30:00Z')), 'LIVE');
  assert.equal(eventState(meeting, new Date('2026-11-06T10:00:00Z')), 'DONE');
});

test('calendar errors explain what to do', () => {
  assert.equal(calendarErrorFrom(403, { error: { message: 'Request had insufficient authentication scopes.', errors: [{ reason: 'insufficientPermissions' }] } }).kind, 'scope');
  assert.equal(calendarErrorFrom(403, { error: { message: 'Google Calendar API has not been used in project 123 before or it is disabled.', errors: [{ reason: 'accessNotConfigured' }] } }).kind, 'api-disabled');
  assert.equal(calendarErrorFrom(401, null).kind, 'auth');
  assert.equal(calendarErrorFrom(500, { error: { message: 'Backend Error' } }).message, 'Backend Error');
});
