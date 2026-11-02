// Local-calendar date helpers. A "date key" is local YYYY-MM-DD.
const pad = (n) => String(n).padStart(2, '0');

export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // midday avoids DST edge cases
}

export function addDays(key, n) {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return localDateKey(d);
}

// Whole calendar days from key a to key b (b - a).
export function daysBetween(a, b) {
  const da = parseDateKey(a), db = parseDateKey(b);
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / 86400000);
}

export function isDateKey(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return localDateKey(parseDateKey(s)) === s;
}

export function timezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

export function formatDateKey(key, opts = { day: 'numeric', month: 'short' }) {
  return parseDateKey(key).toLocaleDateString(undefined, opts);
}
