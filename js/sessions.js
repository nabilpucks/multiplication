// Derived views over session records: days, official Dailies, scores, streaks.
import { addDays, daysBetween } from './dates.js';
import { mean } from './stats.js';

export const isComplete = (s) => s.status === 'complete';

/** Share of answered (correct) questions that were right on the first try. */
export function accuracyOf(questions) {
  let answered = 0, first = 0;
  for (const q of questions) {
    if (q.outcome !== 'correct') continue;
    answered++;
    if (!q.wrongAttempts || q.wrongAttempts.length === 0) first++;
  }
  return answered ? first / answered : null;
}

export const minutesOf = (s) => (s.activeMs || 0) / 60000;

/** Daily score = correct answers per 10 minutes. Only complete Dailies have a score. */
export const dailyScore = (s) => (s && s.mode === 'daily' && isComplete(s) ? s.correct : null);

/**
 * Group sessions by local date. For each date the Daily that started earliest is that
 * day's official Daily; any other Daily on the same date is shown as extra practice.
 */
export function buildDays(sessions) {
  const days = new Map();
  const get = (date) => {
    let d = days.get(date);
    if (!d) days.set(date, (d = { date, daily: null, extras: [], free: [], dailyMinutes: 0, freeMinutes: 0 }));
    return d;
  };
  const sorted = [...sessions].sort((x, y) => (x.startedAt < y.startedAt ? -1 : x.startedAt > y.startedAt ? 1 : 0));
  for (const s of sorted) {
    const d = get(s.date);
    if (s.mode === 'daily' && !d.daily) { d.daily = s; d.dailyMinutes += minutesOf(s); }
    else if (s.mode === 'daily') { d.extras.push(s); d.freeMinutes += minutesOf(s); }
    else { d.free.push(s); d.freeMinutes += minutesOf(s); }
  }
  return days;
}

/** Set of session ids that are "extra practice" Dailies (not the official one for their date). */
export function extraDailyIds(days) {
  const ids = new Set();
  for (const d of days.values()) for (const s of d.extras) ids.add(s.id);
  return ids;
}

/** Consecutive days with a Daily (complete or incomplete), ending today, or yesterday if today isn't done yet. */
export function currentStreak(days, today) {
  let key = days.get(today)?.daily ? today : addDays(today, -1);
  let n = 0;
  while (days.get(key)?.daily) { n++; key = addDays(key, -1); }
  return n;
}

/** Mean of complete Daily scores in [from, to] (inclusive date keys). */
export function averageScore(days, from, to) {
  const scores = [];
  for (const d of days.values()) {
    if (d.date < from || d.date > to) continue;
    const sc = dailyScore(d.daily);
    if (sc != null) scores.push(sc);
  }
  return { value: mean(scores), n: scores.length };
}

export function averageAccuracy(days, from, to) {
  const vals = [];
  for (const d of days.values()) {
    if (d.date < from || d.date > to || !d.daily || !isComplete(d.daily)) continue;
    const a = accuracyOf(d.daily.questions);
    if (a != null) vals.push(a);
  }
  return { value: mean(vals), n: vals.length };
}

/** Comparison numbers for the Results screen of a Daily. */
export function compareDaily(days, session) {
  const y = days.get(addDays(session.date, -1));
  return {
    yesterday: dailyScore(y?.daily),
    week: averageScore(days, addDays(session.date, -7), addDays(session.date, -1)).value,
  };
}

export function bestScore(days) {
  let best = null;
  for (const d of days.values()) {
    const sc = dailyScore(d.daily);
    if (sc != null && (best == null || sc > best)) best = sc;
  }
  return best;
}

export function daysSince(isoOrNull, today) {
  if (!isoOrNull) return null;
  const d = new Date(isoOrNull);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return daysBetween(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, today);
}
