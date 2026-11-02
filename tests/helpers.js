// Deterministic RNG for tests (mulberry32).
export function seeded(seed = 1) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function q(a, b, outcome = 'correct', ms = 3000, wrongAttempts = [], shownAtMs = 0) {
  return { a, b, outcome, ms, wrongAttempts, shownAtMs };
}

let n = 0;
export function session(over = {}) {
  n++;
  const questions = over.questions || [q(12, 34)];
  return {
    schemaVersion: 1,
    id: over.id || `id-${n}`,
    mode: 'daily',
    date: '2026-10-01',
    startedAt: '2026-10-01T08:00:00.000Z',
    timezone: 'Europe/London',
    activeMs: 600000,
    pausedMs: 0,
    status: 'complete',
    correct: questions.filter((x) => x.outcome === 'correct').length,
    mistakes: questions.filter((x) => x.wrongAttempts.length).length,
    ...over,
    questions,
  };
}
