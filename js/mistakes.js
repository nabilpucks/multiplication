// Classify a wrong attempt against the correct product.
export const MISTAKE_TYPES = {
  carry: 'Off by ±10 / ±100 / ±1000',
  'last-digit': 'Only the last digit wrong',
  swapped: 'Swapped digits',
  other: 'Other',
};

export function classifyMistake(correct, typed) {
  const c = String(correct);
  const t = String(typed).replace(/^0+(?=\d)/, '');
  if (!/^\d+$/.test(t) || t === c) return null;
  const diff = Math.abs(Number(t) - Number(c));
  if (diff === 10 || diff === 100 || diff === 1000) return 'carry';
  if (t.length === c.length) {
    const diffs = [];
    for (let i = 0; i < c.length; i++) if (c[i] !== t[i]) diffs.push(i);
    if (diffs.length === 1 && diffs[0] === c.length - 1) return 'last-digit';
    if (diffs.length === 2 && c[diffs[0]] === t[diffs[1]] && c[diffs[1]] === t[diffs[0]]) return 'swapped';
  }
  return 'other';
}
