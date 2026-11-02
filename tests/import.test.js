import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseExport, mergeSessions, importReport, buildExport, exportFileName } from '../js/transfer-logic.js';
import { buildDays, extraDailyIds } from '../js/sessions.js';
import { session, q } from './helpers.js';

const file = (sessions, over = {}) => JSON.stringify({ ...buildExport(sessions, new Date('2026-11-01T10:00:00Z')), ...over });

test('export has schemaVersion, exportedAt and a dated name', () => {
  const e = buildExport([session()]);
  assert.equal(e.schemaVersion, 1);
  assert.ok(e.exportedAt);
  assert.equal(exportFileName('2026-11-02'), 'multiplication-2026-11-02.json');
});

test('combines: adds new ids, skips existing, never replaces', () => {
  const a = session({ id: 'a' }), b = session({ id: 'b' }), c = session({ id: 'c' });
  const parsed = parseExport(file([a, b, c]));
  assert.equal(parsed.ok, true);
  const res = mergeSessions(new Set(['a', 'b']), parsed.sessions);
  assert.deepEqual(res.toAdd.map((s) => s.id), ['c']);
  assert.equal(res.alreadyHere, 2);
  assert.equal(importReport(res), '1 new session added, 2 already here');
});

test('duplicate ids inside the same file are only added once', () => {
  const a = session({ id: 'dup' });
  const res = mergeSessions(new Set(), parseExport(file([a, { ...a }])).sessions);
  assert.equal(res.toAdd.length, 1);
  assert.equal(res.alreadyHere, 1);
});

test('report wording', () => {
  assert.equal(importReport({ toAdd: new Array(12), alreadyHere: 40 }), '12 new sessions added, 40 already here');
});

test('rejects bad files before importing anything', () => {
  assert.equal(parseExport('not json').ok, false);
  assert.equal(parseExport('[]').ok, false);
  assert.equal(parseExport('{"foo":1}').ok, false);
  assert.equal(parseExport(file([session()], { app: 'something-else' })).ok, false);
  // One bad session poisons the whole file.
  const bad = parseExport(file([session({ id: 'ok' }), session({ id: 'bad', date: '2026-13-01' })]));
  assert.equal(bad.ok, false);
  assert.match(bad.error, /Session 2/);
  const badQ = parseExport(file([session({ questions: [{ a: 3, b: 'x', outcome: 'correct', ms: 1, wrongAttempts: [], shownAtMs: 0 }] })]));
  assert.equal(badQ.ok, false);
  const badOutcome = parseExport(file([session({ questions: [q(3, 4, 'nope')] })]));
  assert.equal(badOutcome.ok, false);
});

test('files from different schema versions', () => {
  const s = session();
  const newer = parseExport(file([s], { schemaVersion: 2 }));
  assert.equal(newer.ok, false);
  assert.match(newer.error, /newer version/);
  assert.equal(parseExport(file([s], { schemaVersion: undefined })).ok, false);
  assert.equal(parseExport(file([s], { schemaVersion: 0 })).ok, false);
  assert.equal(parseExport(file([s], { schemaVersion: '1' })).ok, false);
  const newerSession = parseExport(file([{ ...s, schemaVersion: 3 }]));
  assert.equal(newerSession.ok, false);
  // A session without its own schemaVersion inherits the file's and gets stamped.
  const { schemaVersion, ...bare } = s;
  const ok = parseExport(file([bare]));
  assert.equal(ok.ok, true);
  assert.equal(ok.sessions[0].schemaVersion, 1);
});

test('two Dailies on the same date after combining: the earliest is the Daily, the other is extra practice', () => {
  const late = session({ id: 'late', startedAt: '2026-10-01T18:00:00.000Z' });
  const early = session({ id: 'early', startedAt: '2026-10-01T07:00:00.000Z' });
  const days = buildDays([late, early]);
  const day = days.get('2026-10-01');
  assert.equal(day.daily.id, 'early');
  assert.deepEqual(day.extras.map((s) => s.id), ['late']);
  assert.ok(extraDailyIds(days).has('late'));
  assert.equal(day.freeMinutes, 10);
});
