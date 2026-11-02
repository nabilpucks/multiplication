import { test } from 'node:test';
import assert from 'node:assert/strict';
import { median, summarize } from '../js/stats.js';
import { computeAnalysis } from '../js/analysis-logic.js';
import { session, q } from './helpers.js';

test('median of odd, even, empty and unsorted lists', () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
  assert.equal(median([10, 1000, 2]), 10); // not the mean
});

test('needs more data below 5 samples', () => {
  assert.deepEqual(summarize([1, 2, 3, 4]), { n: 4, enough: false, median: 2.5 });
  assert.equal(summarize([1, 2, 3, 4, 5]).enough, true);
  assert.deepEqual(summarize([]), { n: 0, enough: false, median: null });
});

test('analysis only times correct answers and merges a×b with b×a', () => {
  const s = session({ questions: [
    q(12, 34, 'correct', 1000), q(34, 12, 'correct', 2000), q(12, 34, 'timed-out', 60000),
    q(12, 34, 'skipped-pause', 50), q(12, 34, 'correct', 3000), q(34, 12, 'correct', 4000), q(12, 34, 'correct', 5000),
  ] });
  const a = computeAnalysis([s]);
  assert.equal(a.overall.n, 5);
  assert.equal(a.overall.median, 3000);
  const square = a.grid.find((g) => g.row === 1 && g.col === 3);
  const mirror = a.grid.find((g) => g.row === 3 && g.col === 1);
  assert.equal(square.n, 5);
  assert.equal(square.enough, true);
  assert.equal(mirror.median, square.median);
  const n12 = a.numbers.find((x) => x.num === 12);
  assert.equal(n12.n, 5);
});

test('squares count once per number; thin squares are flagged', () => {
  const s = session({ questions: [q(7, 7, 'correct', 1000), q(7, 8, 'correct', 2000)] });
  const a = computeAnalysis([s]);
  assert.equal(a.numbers.find((x) => x.num === 7).n, 2);
  assert.equal(a.grid[0].enough, false);
  assert.equal(a.overall.enough, false);
});

test('slowest list: ranked by most recent time, timed-out kept, leaves when answered faster than median', () => {
  const qs = [];
  for (let i = 0; i < 10; i++) qs.push(q(2, 3 + (i % 3), 'correct', 2000)); // median ~2000
  qs.push(q(47, 53, 'correct', 9000));
  qs.push(q(67, 89, 'timed-out', 60000));
  qs.push(q(38, 76, 'correct', 12000));
  qs.push(q(76, 38, 'correct', 1500)); // answered faster than median -> leaves
  const a = computeAnalysis([session({ questions: qs })]);
  const keys = a.slowest.map((x) => `${x.a}x${x.b}`);
  assert.deepEqual(keys.slice(0, 2), ['67x89', '47x53']);
  assert.ok(!keys.includes('38x76'));
});

test('tiredness buckets by minute of Daily only', () => {
  const qs = [q(2, 3, 'correct', 1000, [], 5000), q(2, 4, 'correct', 3000, [], 65000), q(2, 5, 'correct', 3000, [], 599000)];
  const a = computeAnalysis([session({ questions: qs }), session({ mode: 'free', questions: [q(2, 3, 'correct', 9000, [], 1000)] })]);
  assert.equal(a.tiredness[0].n, 1);
  assert.equal(a.tiredness[0].median, 1000);
  assert.equal(a.tiredness[1].n, 1);
  assert.equal(a.tiredness[9].n, 1);
});
