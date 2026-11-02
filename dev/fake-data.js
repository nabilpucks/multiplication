// Realistic fake history for previewing Progress / Analysis / History. Dev only.
import { ALLOWED, pairKey } from '../js/generator.js';
import { localDateKey, addDays, parseDateKey } from '../js/dates.js';
import { SCHEMA_VERSION, DAILY_MS, IDLE_MS } from '../js/constants.js';

function rngFrom(seed) {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
const uuidFrom = (rng) => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (rng() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); });

// How hard a question is for this imaginary learner (ms at the start of training).
function baseMs(a, b) {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  if (lo === hi && hi < 30) return 2200;
  if (lo === 11 || hi === 11) return 2600;
  if (hi < 10) return 1300;
  if (lo < 10) return 2600 + hi * 45 + lo * 120;
  const tl = Math.floor(lo / 10), th = Math.floor(hi / 10);
  let ms = 4500 + (tl * th) * 160 + ((lo % 10) * (hi % 10)) * 45;
  if ((a + b) % 20 === 0 && a !== b) ms *= 0.7;
  if (tl === th && (lo % 10) + (hi % 10) === 10) ms *= 0.65;
  if (lo === hi) ms *= 0.8;
  return ms;
}

function wrongAnswer(correct, rng) {
  const c = String(correct);
  const r = rng();
  if (r < 0.4 && correct > 20) return String(correct + (rng() < 0.5 ? -1 : 1) * (correct >= 1000 && rng() < 0.4 ? 100 : 10));
  if (r < 0.65) { const d = (Number(c.at(-1)) + 1 + Math.floor(rng() * 8)) % 10; return c.slice(0, -1) + d; }
  if (r < 0.75 && c.length >= 2) { const i = c.length - 2; return c.slice(0, i) + c[i + 1] + c[i]; }
  let o = correct + Math.round((rng() - 0.5) * correct * 0.3) + 1;
  if (o <= 0) o = correct + 3;
  return String(o === correct ? o + 7 : o);
}

function simulate(rng, mode, durationMs, skill, date, startedAt) {
  const questions = [];
  let t = 0, correct = 0, mistakes = 0, pausedMs = 0, last = null;
  const pick = () => ALLOWED[Math.floor(rng() * ALLOWED.length)];
  while (t < durationMs) {
    let a = pick(), b = pick();
    while (pairKey(a, b) === last) { a = pick(); b = pick(); }
    last = pairKey(a, b);
    const minute = Math.floor(t / 60000);
    const tired = 1 + minute * 0.012;
    let ms = baseMs(a, b) * skill * tired * Math.exp((rng() - 0.5) * 0.7) + 250;
    const shownAtMs = Math.round(t);
    const r = rng();
    if (r < 0.006 && ms > 6000) {
      ms = IDLE_MS + rng() * 3000;
      questions.push({ a, b, outcome: 'timed-out', ms: Math.round(ms), wrongAttempts: [], shownAtMs });
      t += mode === 'daily' ? IDLE_MS : 0; pausedMs += 20000 + (mode === 'free' ? IDLE_MS : 0);
      continue;
    }
    if (r < 0.012) {
      questions.push({ a, b, outcome: 'skipped-pause', ms: Math.round(ms * rng()), wrongAttempts: [], shownAtMs });
      t += ms * 0.5; pausedMs += 15000 + rng() * 60000;
      continue;
    }
    const wrong = [];
    const pWrong = Math.min(0.25, 0.03 + (ms / 1000) * 0.008);
    while (rng() < (wrong.length ? 0.25 : pWrong)) { wrong.push(wrongAnswer(a * b, rng)); ms += 1200 + rng() * 1500; }
    if (t + ms > durationMs) break;
    t += ms;
    correct++;
    if (wrong.length) mistakes++;
    questions.push({ a, b, outcome: 'correct', ms: Math.round(ms), wrongAttempts: wrong, shownAtMs });
  }
  return {
    schemaVersion: SCHEMA_VERSION, id: uuidFrom(rng), mode, date, startedAt: startedAt.toISOString(), timezone: 'Europe/London',
    activeMs: Math.round(Math.min(t, durationMs)), pausedMs: Math.round(pausedMs), status: 'complete', correct, mistakes, questions,
  };
}

/** Sessions for `days` days ending yesterday (today is left free so you can try the Daily). */
export function fakeSessions({ days = 182, seed = 42, freeChance = 0.4 } = {}) {
  const rng = rngFrom(seed);
  const today = localDateKey();
  const out = [];
  for (let i = days; i >= 1; i--) {
    const date = addDays(today, -i);
    const progress = 1 - i / days; // 0 → 1 over the period
    const skill = 1.15 - 0.45 * progress + (rng() - 0.5) * 0.08;
    const r = rng();
    if (r < 0.08) continue; // missed day
    const start = parseDateKey(date); start.setHours(7 + Math.floor(rng() * 3), Math.floor(rng() * 60));
    if (r < 0.13) {
      const s = simulate(rng, 'daily', DAILY_MS * (0.2 + rng() * 0.6), skill, date, start);
      s.status = 'incomplete';
      out.push(s);
    } else {
      out.push(simulate(rng, 'daily', DAILY_MS, skill, date, start));
    }
    if (rng() < freeChance) {
      const fs = new Date(start.getTime() + (2 + rng() * 8) * 3600000);
      out.push(simulate(rng, 'free', (4 + rng() * 18) * 60000, skill * 0.98, date, fs));
    }
  }
  return out;
}
