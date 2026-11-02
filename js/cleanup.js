// One-off data fixes for the real database. Each runs once (tracked in meta).
import { DEV } from './env.js';

/** 2 Nov 2026: a 6-second test Daily locked the day. Remove short incomplete Dailies from that date. */
export const isShortTestDaily = (s) =>
  s.mode === 'daily' && s.date === '2026-11-02' && s.status === 'incomplete' && s.activeMs < 15000;

export async function runCleanups(DB) {
  if (DEV) return 0;
  const key = 'cleanup:2026-11-02-short-daily';
  if (await DB.getMeta(key)) return 0;
  const victims = (await DB.getAllSessions()).filter(isShortTestDaily);
  for (const s of victims) await DB.deleteSession(s.id);
  await DB.setMeta(key, { at: new Date().toISOString(), removed: victims.map((s) => s.id) });
  return victims.length;
}
