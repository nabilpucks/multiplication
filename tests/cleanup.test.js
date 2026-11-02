import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isShortTestDaily } from '../js/cleanup.js';
import { session } from './helpers.js';

test('only the short incomplete Daily from 2 Nov 2026 is removed', () => {
  const base = { date: '2026-11-02', status: 'incomplete', activeMs: 6000 };
  assert.equal(isShortTestDaily(session(base)), true);
  assert.equal(isShortTestDaily(session({ ...base, activeMs: 600000, status: 'complete' })), false);
  assert.equal(isShortTestDaily(session({ ...base, activeMs: 40000 })), false);
  assert.equal(isShortTestDaily(session({ ...base, date: '2026-11-03' })), false);
  assert.equal(isShortTestDaily(session({ ...base, mode: 'free' })), false);
});
