import { store } from '../store.js';
import { accuracyOf, compareDaily, extraDailyIds, minutesOf } from '../sessions.js';
import { localDateKey, formatDateKey } from '../dates.js';
import { $, flow, esc, reducedMotion } from '../ui.js';
import { gsap } from '../motion.js';

function delta(value, ref, unit = '') {
  if (value == null || ref == null) return '<span class="tt-muted">—</span>';
  const d = value - ref;
  const r = Math.round(d * 10) / 10;
  const cls = r > 0 ? 'delta-up' : r < 0 ? 'delta-down' : '';
  const sign = r > 0 ? '+' : r < 0 ? '−' : '±';
  return `<span class="${cls}">${sign}${Math.abs(r)}${unit}</span><small>vs ${Math.round(ref * 10) / 10}</small>`;
}

export function renderResults(id) {
  const s = store.get(id);
  if (!s) return false;
  const days = store.days();
  const isExtra = extraDailyIds(days).has(s.id);
  const daily = s.mode === 'daily' && !isExtra;
  const when = s.date === localDateKey() ? 'today' : formatDateKey(s.date, { weekday: 'short', day: 'numeric', month: 'short' });
  $('#results-eyebrow').textContent = `${daily ? 'Daily' : isExtra ? 'Extra practice' : 'Free Practice'} · ${when}`;
  const complete = s.status === 'complete';
  $('#results-title').textContent = daily ? (complete ? 'Time.' : 'Saved as incomplete.') : 'Practice done.';
  $('#results-unit').textContent = daily && complete ? 'correct in 10 minutes' : `correct in ${minutesOf(s).toFixed(1)} min`;

  const acc = accuracyOf(s.questions);
  const scoreEl = $('#results-score');
  scoreEl.animated = !reducedMotion();
  scoreEl.update(0);
  flow($('#results-acc'), null, { style: 'percent', maximumFractionDigits: 0 });
  flow($('#results-mistakes'), null);

  if (daily && complete) {
    const c = compareDaily(days, s);
    $('#results-l2').textContent = 'vs yesterday';
    $('#results-v2').innerHTML = delta(s.correct, c.yesterday);
    $('#results-l3').textContent = 'vs 7-day average';
    $('#results-v3').innerHTML = delta(s.correct, c.week);
  } else {
    $('#results-l2').textContent = 'Minutes';
    $('#results-v2').innerHTML = esc(minutesOf(s).toFixed(1));
    $('#results-l3').textContent = 'Questions seen';
    $('#results-v3').innerHTML = esc(String(s.questions.length));
  }

  // Rolling number: start from 0 once the view has faded in.
  const run = () => {
    scoreEl.update(s.correct);
    flow($('#results-acc'), acc, { style: 'percent', maximumFractionDigits: 0 });
    flow($('#results-mistakes'), s.mistakes);
  };
  if (reducedMotion()) run(); else gsap.delayedCall(0.45, run);
  return true;
}
