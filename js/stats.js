import { MIN_SAMPLES } from './constants.js';

export function median(values) {
  const n = values.length;
  if (!n) return null;
  const s = Float64Array.from(values).sort();
  const mid = n >> 1;
  return n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median with a "needs more data" verdict. */
export function summarize(values, min = MIN_SAMPLES) {
  const n = values.length;
  const enough = n >= min;
  return { n, enough, median: n ? median(values) : null };
}

export const mean = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
