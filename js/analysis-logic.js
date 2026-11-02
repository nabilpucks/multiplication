// All Analysis computations. Timing stats use the median of correctly answered questions only.
import { summarize } from './stats.js';
import { pairKey, ALLOWED } from './generator.js';
import { classifyMistake, MISTAKE_TYPES } from './mistakes.js';
import { PATTERNS } from './patterns.js';
import { MIN_SAMPLES, IDLE_MS } from './constants.js';

const tensOf = (n) => Math.floor(n / 10);

export function computeAnalysis(sessions, { min = MIN_SAMPLES } = {}) {
  const sorted = [...sessions].sort((x, y) => (x.startedAt < y.startedAt ? -1 : 1));
  const all = [];
  const byNumber = Array.from({ length: 100 }, () => []);
  const tens = Array.from({ length: 100 }, () => []); // index lo*10+hi (lo ≤ hi)
  const pat = Object.fromEntries(PATTERNS.map((p) => [p.id, []]));
  const minute = Array.from({ length: 10 }, () => []);
  const mistakeCounts = Object.fromEntries(Object.keys(MISTAKE_TYPES).map((k) => [k, 0]));
  const mistakeExamples = Object.fromEntries(Object.keys(MISTAKE_TYPES).map((k) => [k, []]));
  const latest = new Map(); // pairKey -> most recent {a,b,ms,outcome,date}
  let totalAttempts = 0;

  for (const s of sorted) {
    for (const q of s.questions) {
      const { a, b } = q;
      for (const typed of q.wrongAttempts || []) {
        const type = classifyMistake(a * b, typed);
        if (!type) continue;
        totalAttempts++;
        mistakeCounts[type]++;
        const ex = mistakeExamples[type];
        ex.push({ a, b, typed, correct: a * b, date: s.date });
        if (ex.length > 6) ex.shift(); // keep the most recent
      }
      if (q.outcome === 'correct' || q.outcome === 'timed-out') {
        latest.set(pairKey(a, b), { a: Math.min(a, b), b: Math.max(a, b), ms: q.outcome === 'timed-out' ? Math.max(q.ms, IDLE_MS) : q.ms, outcome: q.outcome, date: s.date });
      }
      if (q.outcome !== 'correct') continue;
      const ms = q.ms;
      all.push(ms);
      byNumber[a].push(ms);
      if (b !== a) byNumber[b].push(ms);
      const ta = tensOf(a), tb = tensOf(b);
      tens[Math.min(ta, tb) * 10 + Math.max(ta, tb)].push(ms);
      for (const p of PATTERNS) if (p.test(a, b)) pat[p.id].push(ms);
      if (s.mode === 'daily') {
        const m = Math.min(9, Math.floor(q.shownAtMs / 60000));
        minute[m].push(ms);
      }
    }
  }

  const overall = summarize(all, min);
  const om = overall.median;
  const rel = (sum) => (sum.enough && om ? sum.median / om - 1 : null);

  const numbers = ALLOWED.map((num) => ({ num, ...summarize(byNumber[num], min) }));
  const grid = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
    const sum = summarize(tens[Math.min(r, c) * 10 + Math.max(r, c)], min);
    grid.push({ row: r, col: c, ...sum, rel: rel(sum) });
  }
  const patterns = PATTERNS.map((p) => {
    const sum = summarize(pat[p.id], min);
    return { id: p.id, label: p.label, example: p.example, ...sum, rel: rel(sum) };
  });
  const tiredness = minute.map((v, i) => ({ minute: i + 1, ...summarize(v, min) }));

  const slowest = [...latest.values()]
    .filter((q) => q.outcome === 'timed-out' || om == null || q.ms >= om)
    .sort((x, y) => y.ms - x.ms)
    .slice(0, 20);

  const mistakes = Object.keys(MISTAKE_TYPES).map((id) => ({
    id, label: MISTAKE_TYPES[id], count: mistakeCounts[id], examples: mistakeExamples[id].slice().reverse(),
  }));

  return { overall, numbers, grid, patterns, tiredness, slowest, mistakes, totalAttempts };
}

/** Weak-spot pool for Free Practice: the slowest list plus the 5 slowest tens squares with enough data. */
export function buildWeakSource(analysis) {
  const slow = analysis.slowest.map((q) => ({ a: q.a, b: q.b }));
  const squares = analysis.grid
    .filter((g) => g.enough && g.row <= g.col)
    .sort((x, y) => y.median - x.median)
    .slice(0, 5);
  if (!slow.length && !squares.length) return null;
  const pickWithTens = (t, rng) => (t === 0 ? 1 : t * 10 + 1) + Math.floor(rng() * 9);
  return (rng) => {
    const useSlow = slow.length && (!squares.length || rng() < 0.5);
    let a, b;
    if (useSlow) ({ a, b } = slow[Math.floor(rng() * slow.length)]);
    else {
      const sq = squares[Math.floor(rng() * squares.length)];
      a = pickWithTens(sq.row, rng); b = pickWithTens(sq.col, rng);
    }
    return rng() < 0.5 ? { a, b, weak: true } : { a: b, b: a, weak: true };
  };
}
