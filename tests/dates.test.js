import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDateKey, addDays, daysBetween, isDateKey } from '../js/dates.js';

test('local date key uses the local calendar, just before and after midnight', () => {
  assert.equal(localDateKey(new Date(2026, 10, 2, 23, 59, 59, 999)), '2026-11-02');
  assert.equal(localDateKey(new Date(2026, 10, 3, 0, 0, 0, 0)), '2026-11-03');
});

test('a session started before midnight keeps its start date', () => {
  const started = new Date(2026, 11, 31, 23, 58);
  const date = localDateKey(started);
  const finished = new Date(started.getTime() + 10 * 60000);
  assert.equal(date, '2026-12-31');
  assert.equal(localDateKey(finished), '2027-01-01');
});

test('addDays crosses month, year and leap day', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('daysBetween counts calendar days, including across DST changes', () => {
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2); // EU spring forward
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2); // EU fall back
  assert.equal(daysBetween('2026-11-02', '2026-11-02'), 0);
  assert.equal(daysBetween('2026-11-02', '2026-10-31'), -2);
});

test('isDateKey rejects impossible dates', () => {
  assert.equal(isDateKey('2026-02-30'), false);
  assert.equal(isDateKey('2026-2-3'), false);
  assert.equal(isDateKey('2026-02-03'), true);
});
