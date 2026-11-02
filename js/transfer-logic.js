// Export file building and import validation / merging. Pure: no DOM, no IndexedDB.
import { SCHEMA_VERSION, APP_ID } from './constants.js';
import { isDateKey } from './dates.js';

export function buildExport(sessions, now = new Date()) {
  return { app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), sessions };
}

export function exportFileName(dateKey) {
  return `multiplication-${dateKey}.json`;
}

// Migrations from older schema versions: migrations[n] turns a version-n session into n+1.
// Version 1 is the first schema, so there is nothing to migrate yet.
export const migrations = {};

const OUTCOMES = new Set(['correct', 'timed-out', 'skipped-pause']);
const isNum = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const isInt = (x) => Number.isInteger(x) && x >= 0;
const isFactor = (x) => Number.isInteger(x) && x >= 1 && x <= 99;

export function validateSession(s) {
  const e = [];
  if (!s || typeof s !== 'object' || Array.isArray(s)) return ['is not an object'];
  if (typeof s.id !== 'string' || !s.id) e.push('missing id');
  if (s.mode !== 'daily' && s.mode !== 'free') e.push('mode must be "daily" or "free"');
  if (!isDateKey(s.date)) e.push('date must be YYYY-MM-DD');
  if (typeof s.startedAt !== 'string' || Number.isNaN(Date.parse(s.startedAt))) e.push('startedAt is not a valid date');
  if (typeof s.timezone !== 'string') e.push('missing timezone');
  if (!isNum(s.activeMs)) e.push('activeMs must be a number ≥ 0');
  if (!isNum(s.pausedMs)) e.push('pausedMs must be a number ≥ 0');
  if (s.status !== 'complete' && s.status !== 'incomplete') e.push('status must be "complete" or "incomplete"');
  if (!isInt(s.correct)) e.push('correct must be a whole number');
  if (!isInt(s.mistakes)) e.push('mistakes must be a whole number');
  if (!Array.isArray(s.questions)) e.push('questions must be a list');
  else {
    for (let i = 0; i < s.questions.length; i++) {
      const q = s.questions[i];
      const bad = !q || typeof q !== 'object' || !isFactor(q.a) || !isFactor(q.b) || !OUTCOMES.has(q.outcome) ||
        !isNum(q.ms) || !isNum(q.shownAtMs) || !Array.isArray(q.wrongAttempts) ||
        !q.wrongAttempts.every((w) => typeof w === 'string' && /^\d+$/.test(w));
      if (bad) { e.push(`question ${i + 1} is malformed`); break; }
    }
  }
  return e;
}

/**
 * Parse and check an export file (string or object) before anything is imported.
 * Returns { ok: true, sessions, fileVersion } or { ok: false, error }.
 */
export function parseExport(input) {
  let data = input;
  if (typeof input === 'string') {
    try { data = JSON.parse(input); } catch { return { ok: false, error: 'This file isn’t valid JSON.' }; }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.sessions)) {
    return { ok: false, error: 'This doesn’t look like a Multiplication Trainer export (no sessions list).' };
  }
  if (data.app != null && data.app !== APP_ID) return { ok: false, error: 'This export is from a different app.' };
  const v = data.schemaVersion;
  if (!Number.isInteger(v) || v < 1) return { ok: false, error: 'The file has no valid schemaVersion.' };
  if (v > SCHEMA_VERSION) {
    return { ok: false, error: `This file was made by a newer version of the app (schema ${v}). Update this copy first — this one understands schema ${SCHEMA_VERSION}.` };
  }
  const out = [];
  for (let i = 0; i < data.sessions.length; i++) {
    let s = data.sessions[i];
    let sv = s && Number.isInteger(s.schemaVersion) ? s.schemaVersion : v;
    if (sv > SCHEMA_VERSION) return { ok: false, error: `Session ${i + 1} uses a newer schema (${sv}).` };
    while (sv < SCHEMA_VERSION) {
      const step = migrations[sv];
      if (!step) return { ok: false, error: `Session ${i + 1} uses schema ${sv}, which can’t be converted.` };
      s = step(s); sv++;
    }
    const errs = validateSession(s);
    if (errs.length) return { ok: false, error: `Session ${i + 1} is invalid: ${errs.slice(0, 3).join('; ')}. Nothing was imported.` };
    out.push({ ...s, schemaVersion: SCHEMA_VERSION });
  }
  return { ok: true, sessions: out, fileVersion: v };
}

/** Combine: add sessions whose id isn't stored yet (or repeated earlier in the file); skip the rest. */
export function mergeSessions(existingIds, incoming) {
  const seen = new Set(existingIds);
  const toAdd = [];
  let alreadyHere = 0;
  for (const s of incoming) {
    if (seen.has(s.id)) { alreadyHere++; continue; }
    seen.add(s.id);
    toAdd.push(s);
  }
  return { toAdd, alreadyHere };
}

export function importReport({ toAdd, alreadyHere }) {
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  return `${plural(toAdd.length, 'new session')} added, ${alreadyHere} already here`;
}
