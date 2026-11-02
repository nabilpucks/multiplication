import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGenerator, ALLOWED, isAllowed, pairKey, randomNumber } from '../js/generator.js';
import { seeded } from './helpers.js';

test('allowed numbers are 1–99 without multiples of 10', () => {
  assert.equal(ALLOWED.length, 90);
  for (const n of [10, 20, 30, 40, 50, 60, 70, 80, 90, 0, 100]) assert.equal(isAllowed(n), false);
  for (const n of [1, 9, 11, 99, 55]) assert.equal(isAllowed(n), true);
});

test('never produces a multiple of 10 and covers the whole range', () => {
  const g = createGenerator({ rng: seeded(7) });
  const seen = new Set();
  for (let i = 0; i < 20000; i++) {
    const { a, b } = g.next();
    assert.ok(isAllowed(a) && isAllowed(b), `${a}×${b}`);
    seen.add(a); seen.add(b);
  }
  assert.equal(seen.size, 90);
});

test('roughly uniform', () => {
  const rng = seeded(3);
  const counts = new Map();
  const N = 90000;
  for (let i = 0; i < N; i++) { const n = randomNumber(rng); counts.set(n, (counts.get(n) || 0) + 1); }
  for (const c of counts.values()) assert.ok(c > 800 && c < 1200, `count ${c}`);
});

test('never the same pair twice in a row (order ignored)', () => {
  // An RNG that keeps trying to repeat: returns the same value most of the time.
  let i = 0;
  const sticky = () => (i++ % 7 === 6 ? 0.9 : 0.1);
  const g = createGenerator({ rng: sticky });
  let prev = null;
  for (let k = 0; k < 500; k++) {
    const p = g.next();
    const key = pairKey(p.a, p.b);
    assert.notEqual(key, prev);
    prev = key;
  }
});

test('treats a×b followed by b×a as a repeat', () => {
  const seq = [{ a: 7, b: 8 }, { a: 8, b: 7 }, { a: 8, b: 7 }, { a: 9, b: 9 }];
  let k = 0;
  const g = createGenerator({ rng: () => 0, weakSource: () => seq[k++] ?? null, weakShare: 1 });
  const first = g.next();
  const second = g.next();
  assert.equal(pairKey(first.a, first.b), '7x8');
  assert.equal(pairKey(second.a, second.b), '9x9');
});

test('weak source supplies about half of the questions', () => {
  const rng = seeded(11);
  const pool = [[47, 53], [38, 76], [67, 89], [14, 96]];
  const g = createGenerator({ rng, weakSource: (r) => { const [a, b] = pool[Math.floor(r() * pool.length)]; return { a, b, weak: true }; } });
  let weak = 0;
  for (let i = 0; i < 4000; i++) if (g.next().weak) weak++;
  assert.ok(weak > 1500 && weak < 2100, `weak ${weak}`);
});
