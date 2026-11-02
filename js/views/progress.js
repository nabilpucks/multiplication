import { store } from '../store.js';
import { localDateKey, addDays, daysBetween, parseDateKey, formatDateKey } from '../dates.js';
import { dailyScore, currentStreak, bestScore, averageScore, averageAccuracy, isComplete, minutesOf } from '../sessions.js';
import { scaleLinear, line, max } from '../../vendor/d3.js';
import { $, $$, flow, esc, showTip, hideTip } from '../ui.js';
import { drawIn, growBars, fadeIn } from '../motion.js';

let range = '90';
let lastData = null;

export function initProgress() {
  $('#range-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-range]');
    if (!b) return;
    range = b.dataset.range;
    $$('#range-seg button').forEach((x) => x.classList.toggle('on', x === b));
    renderChart(true);
  });
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (!$('[data-view="progress"]').hidden) renderChart(false); }, 150); });
}

export function renderProgress() {
  const days = store.days();
  const today = localDateKey();
  flow($('#p-streak'), currentStreak(days, today));
  flow($('#p-best'), bestScore(days));
  flow($('#p-avg'), averageScore(days, addDays(today, -6), today).value, { maximumFractionDigits: 1 });
  const accNow = averageAccuracy(days, addDays(today, -6), today).value;
  const accPrev = averageAccuracy(days, addDays(today, -13), addDays(today, -7)).value;
  flow($('#p-acc'), accNow, { style: 'percent', maximumFractionDigits: 0 });
  const d = $('#p-acc-delta');
  if (accNow != null && accPrev != null) {
    const pp = Math.round((accNow - accPrev) * 100);
    d.textContent = `${pp > 0 ? '▲ +' : pp < 0 ? '▼ −' : '± '}${Math.abs(pp)} pts vs prior week`;
    d.className = pp > 0 ? 'delta-up' : pp < 0 ? 'delta-down' : '';
  } else { d.textContent = ''; }
  flow($('#p-mins'), Math.round(store.sessions.reduce((s, x) => s + minutesOf(x), 0)));
  renderChart(true);
}

function series() {
  const days = store.days();
  const today = localDateKey();
  let first = today;
  for (const k of days.keys()) if (k < first) first = k;
  let start = range === 'all' ? first : addDays(today, -(Number(range) - 1));
  if (range === 'all' && daysBetween(start, today) < 13) start = addDays(today, -13);
  const n = daysBetween(start, today) + 1;
  const rows = [];
  for (let i = 0; i < n; i++) {
    const key = addDays(start, i);
    const day = days.get(key);
    const score = dailyScore(day?.daily);
    const avg = averageScore(days, addDays(key, -6), key);
    rows.push({
      i, key, score,
      incomplete: !!day?.daily && !isComplete(day.daily),
      avg: avg.n ? avg.value : null,
      dailyMin: day?.dailyMinutes || 0,
      freeMin: day?.freeMinutes || 0,
      day,
    });
  }
  return rows;
}

function renderChart(animate) {
  const host = $('#progress-chart');
  const rows = series();
  lastData = rows;
  const hasAny = rows.some((r) => r.score != null || r.incomplete || r.dailyMin || r.freeMin);
  $('#progress-empty').hidden = hasAny;
  const W = Math.max(320, host.clientWidth || 900);
  const H1 = 280, GAP = 34, H2 = 96, M = { l: 36, r: 12, t: 12, b: 26 };
  const H = M.t + H1 + GAP + H2 + M.b;
  const n = rows.length;
  const x = scaleLinear().domain([0, Math.max(1, n - 1)]).range([M.l + 6, W - M.r - 6]);
  const step = n > 1 ? (x(1) - x(0)) : 20;
  const yMax = Math.max(10, max(rows, (r) => Math.max(r.score ?? 0, r.avg ?? 0)) || 0);
  const y = scaleLinear().domain([0, yMax * 1.1]).nice().range([M.t + H1, M.t]);
  const mMax = Math.max(10, max(rows, (r) => r.dailyMin + r.freeMin) || 0);
  const y2 = scaleLinear().domain([0, mMax]).nice().range([M.t + H1 + GAP + H2, M.t + H1 + GAP]);

  const scoreLine = line().defined((r) => r.score != null).x((r) => x(r.i)).y((r) => y(r.score));
  const avgLine = line().defined((r) => r.avg != null).x((r) => x(r.i)).y((r) => y(r.avg));

  // Points with no scored neighbour wouldn't show as a line, so give them a dot.
  const lone = rows.filter((r, k) => r.score != null && rows[k - 1]?.score == null && rows[k + 1]?.score == null);
  const bw = Math.max(1, Math.min(18, step - 2));
  const bars = [];
  for (const r of rows) {
    const cx = x(r.i) - bw / 2;
    const base = y2(0);
    if (r.dailyMin) {
      const h = base - y2(r.dailyMin);
      bars.push(`<rect class="bar-daily" x="${cx}" y="${base - h}" width="${bw}" height="${Math.max(1, h - (r.freeMin ? 1 : 0))}" rx="${Math.min(3, bw / 2)}"/>`);
    }
    if (r.freeMin) {
      const top = y2(r.dailyMin + r.freeMin), bottom = y2(r.dailyMin) - (r.dailyMin ? 1 : 0);
      bars.push(`<rect class="bar-free" x="${cx}" y="${top}" width="${bw}" height="${Math.max(1, bottom - top)}" rx="${Math.min(3, bw / 2)}"/>`);
    }
  }
  // X ticks: months for long ranges, weeks for short ones.
  const ticks = [];
  for (const r of rows) {
    const d = parseDateKey(r.key);
    if (n > 45 ? d.getDate() === 1 : d.getDay() === 1) ticks.push(r);
  }
  const yTicks = y.ticks(4);
  const svg = `
<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Daily score over time">
  <g class="grid">${yTicks.map((t) => `<line x1="${M.l}" x2="${W - M.r}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}</g>
  ${yTicks.map((t) => `<text x="${M.l - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
  <line class="axis-base" x1="${M.l}" x2="${W - M.r}" y1="${y(0)}" y2="${y(0)}"/>
  <path class="avg-line" d="${avgLine(rows) || ''}"/>
  <path class="score-line" d="${scoreLine(rows) || ''}"/>
  ${lone.map((r) => `<circle class="dot" cx="${x(r.i)}" cy="${y(r.score)}" r="4"/>`).join('')}
  ${rows.filter((r) => r.incomplete).map((r) => `<circle class="ring" cx="${x(r.i)}" cy="${y(0)}" r="4.5"/>`).join('')}
  <text x="${M.l}" y="${M.t + H1 + GAP - 10}" text-anchor="start">Minutes practised</text>
  <text x="${M.l - 8}" y="${y2(mMax) + 4}" text-anchor="end">${y2.domain()[1]}</text>
  <g class="bars">${bars.join('')}</g>
  <line class="axis-base" x1="${M.l}" x2="${W - M.r}" y1="${y2(0)}" y2="${y2(0)}"/>
  ${ticks.map((r) => `<text x="${x(r.i)}" y="${H - 6}" text-anchor="middle">${esc(formatDateKey(r.key, n > 45 ? { month: 'short' } : { day: 'numeric', month: 'short' }))}</text>`).join('')}
  <line class="cross" id="p-cross" x1="0" x2="0" y1="${M.t}" y2="${y2(0)}" visibility="hidden"/>
  <circle class="dot" id="p-hover-dot" r="5" visibility="hidden"/>
  <rect id="p-hit" x="${M.l}" y="0" width="${W - M.l - M.r}" height="${H}" fill="transparent"/>
</svg>`;
  host.innerHTML = svg;
  const svgEl = host.querySelector('svg');
  if (animate) {
    drawIn([svgEl.querySelector('.score-line')], { duration: 1.6, delay: 0.25 });
    drawIn([svgEl.querySelector('.avg-line')], { duration: 1.8, delay: 0.5 });
    growBars([...svgEl.querySelectorAll('.bars rect')], { delay: 0.35 });
    fadeIn([...svgEl.querySelectorAll('.ring, circle.dot:not(#p-hover-dot)')], { delay: 1.1 });
  }

  const hit = svgEl.querySelector('#p-hit'), cross = svgEl.querySelector('#p-cross'), hd = svgEl.querySelector('#p-hover-dot');
  hit.addEventListener('pointermove', (e) => {
    const pt = svgEl.getBoundingClientRect();
    const sx = (e.clientX - pt.left) * (W / pt.width);
    const i = Math.max(0, Math.min(n - 1, Math.round(x.invert(sx))));
    const r = lastData[i];
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    if (r.score != null) { hd.setAttribute('cx', x(i)); hd.setAttribute('cy', y(r.score)); hd.setAttribute('visibility', 'visible'); }
    else hd.setAttribute('visibility', 'hidden');
    const status = r.score != null ? `<b>${r.score}</b> correct` : r.incomplete ? 'Incomplete Daily (no score)' : '<span class="tt-muted">No Daily</span>';
    showTip(`<b>${esc(formatDateKey(r.key, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}</b><br>${status}` +
      (r.avg != null ? `<br><span class="tt-muted">7-day avg</span> ${r.avg.toFixed(1)}` : '') +
      `<br><span class="tt-muted">Minutes</span> ${r.dailyMin.toFixed(1)} Daily · ${r.freeMin.toFixed(1)} Free`, e.clientX, e.clientY);
  });
  hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); hd.setAttribute('visibility', 'hidden'); hideTip(); });
}
