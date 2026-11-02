import { store } from '../store.js';
import { scaleLinear } from '../../vendor/d3.js';
import { $, esc, secs, tipOn } from '../ui.js';
import { growBars, gsap } from '../motion.js';
import { reducedMotion } from '../ui.js';
import { MIN_SAMPLES } from '../constants.js';

// Diverging: faster (blue) ↔ overall median (neutral gray) ↔ slower (red).
const heat = scaleLinear().domain([-0.5, 0, 0.5]).range(['#2a78d6', '#383835', '#d03b3b']).clamp(true);
const tensLabel = (t) => (t === 0 ? '1–9' : `${t}1–${t}9`);
const pct = (rel) => `${rel > 0 ? '+' : rel < 0 ? '−' : '±'}${Math.abs(Math.round(rel * 100))}%`;
const relWord = (rel) => (rel == null ? '' : `<span class="${rel < 0 ? 'faster' : 'slower'}">${pct(rel)} vs your median</span>`);

let a = null;

export function initAnalysis() {
  tipOn($('#tens-grid'), (el) => {
    const g = a.grid[Number(el.dataset.tip)];
    return `<b>${tensLabel(g.row)} × ${tensLabel(g.col)}</b><br>` +
      (g.enough ? `Median ${secs(g.median)}<br>${relWord(g.rel)}<br>` : '<span class="tt-muted">Needs more data</span><br>') +
      `<span class="tt-muted">${g.n} correct answer${g.n === 1 ? '' : 's'}</span>`;
  });
  tipOn($('#num-grid'), (el) => {
    const x = a.numbers.find((v) => v.num === Number(el.dataset.tip));
    const rel = x.enough && a.overall.median ? x.median / a.overall.median - 1 : null;
    return `<b>${x.num}</b><br>` + (x.enough ? `Median ${secs(x.median)}<br>${relWord(rel)}<br>` : '<span class="tt-muted">Needs more data</span><br>') +
      `<span class="tt-muted">${x.n} correct answer${x.n === 1 ? '' : 's'}</span>`;
  });
  tipOn($('#tired-chart'), (el) => {
    const t = a.tiredness[Number(el.dataset.tip)];
    return `<b>Minute ${t.minute}</b><br>` + (t.enough ? `Median ${secs(t.median)}` : '<span class="tt-muted">Needs more data</span>') + `<br><span class="tt-muted">${t.n} answers</span>`;
  });
}

export function renderAnalysis() {
  a = store.analysis();
  const om = a.overall.median;
  $('#a-overall').innerHTML = a.overall.enough
    ? `Overall median <b>${secs(om)}</b> across ${a.overall.n.toLocaleString()} correct answers. Only correct answers are timed.`
    : `Needs more data: answer at least ${MIN_SAMPLES} questions correctly.`;

  // 1) Tens-digit grid (main view)
  const tg = ['<div></div>'];
  for (let c = 0; c < 10; c++) tg.push(`<div class="tg-head">${tensLabel(c)}</div>`);
  for (let r = 0; r < 10; r++) {
    tg.push(`<div class="tg-head">${tensLabel(r)}</div>`);
    for (let c = 0; c < 10; c++) {
      const idx = r * 10 + c, g = a.grid[idx];
      tg.push(g.enough
        ? `<div class="cell" data-tip="${idx}" style="background:${heat(g.rel ?? 0)}">${(g.median / 1000).toFixed(1)}<small>${g.n}</small></div>`
        : `<div class="cell nd" data-tip="${idx}">needs more data<small>${g.n}</small></div>`);
    }
  }
  $('#tens-grid').innerHTML = tg.join('');

  // 2) Each number
  const ng = [];
  for (let k = 0; k < 100; k++) {
    if (k === 0) { ng.push('<div class="cell ten"></div>'); continue; }
    if (k % 10 === 0) { ng.push(`<div class="cell ten">${k}</div>`); continue; }
    const x = a.numbers.find((v) => v.num === k);
    const rel = x.enough && om ? x.median / om - 1 : null;
    ng.push(x.enough ? `<div class="cell" data-tip="${k}" style="background:${heat(rel)}">${k}</div>` : `<div class="cell nd" data-tip="${k}">${k}</div>`);
  }
  $('#num-grid').innerHTML = ng.join('');

  // 6) Slowest
  $('#slow-list').innerHTML = a.slowest.length
    ? a.slowest.map((q) => `<li><span class="sq">${q.a} × ${q.b}</span><span class="st">${secs(q.ms)}</span>${q.outcome === 'timed-out' ? '<span class="tag">timed out</span>' : '<span></span>'}</li>`).join('')
    : '<p class="needs-data">Needs more data.</p>';

  // 4) Patterns
  $('#patterns').innerHTML = a.patterns.map((p) => {
    const nd = !p.enough || p.rel == null;
    const w = nd ? 0 : Math.min(50, Math.abs(p.rel) * 100);
    const bar = nd ? '' : `<i style="${p.rel < 0 ? `right:50%;width:${w}%;background:#2a78d6` : `left:50%;width:${w}%;background:#d03b3b`}"></i>`;
    return `<div class="pattern${nd ? ' nd' : ''}"><span class="p-label">${esc(p.label)}<small>${esc(p.example)}</small></span>` +
      `<span class="p-val">${nd ? `needs more data (${p.n})` : `${secs(p.median)} <span class="${p.rel < 0 ? 'faster' : 'slower'}">${pct(p.rel)}</span>`}</span>` +
      `<span class="p-bar">${bar}</span></div>`;
  }).join('');

  // 5) Tiredness
  renderTiredness();

  // 3) Mistakes
  const total = a.mistakes.reduce((s, m) => s + m.count, 0);
  $('#mistakes').innerHTML = a.mistakes.map((m) => `<div class="m-card"><h3>${esc(m.label)}</h3>` +
    `<div class="m-count">${m.count.toLocaleString()}<small>${total ? Math.round((m.count / total) * 100) + '%' : ''}</small></div>` +
    `<ul class="m-ex">${m.examples.slice(0, 4).map((e) => `<li>${e.a}×${e.b} = ${e.correct} · <s>${esc(e.typed)}</s></li>`).join('') || '<li class="tt-muted">none yet</li>'}</ul></div>`).join('');

  if (!reducedMotion()) {
    gsap.from('#tens-grid .cell', { opacity: 0, scale: 0.85, duration: 0.5, ease: 'expo.out', stagger: { grid: [10, 10], from: 'start', amount: 0.6 }, delay: 0.25, clearProps: 'opacity,transform' });
  }
}

function renderTiredness() {
  const host = $('#tired-chart');
  const W = Math.max(300, host.clientWidth || 480), H = 220, M = { l: 34, r: 8, t: 10, b: 26 };
  const vals = a.tiredness.filter((t) => t.enough).map((t) => t.median);
  const yMax = Math.max(1000, ...vals) * 1.1;
  const y = scaleLinear().domain([0, yMax]).nice().range([H - M.b, M.t]);
  const bw = (W - M.l - M.r) / 10;
  const ticks = y.ticks(4);
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Median time per minute of the Daily">
    <g class="grid">${ticks.map((t) => `<line x1="${M.l}" x2="${W - M.r}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}</g>
    ${ticks.map((t) => `<text x="${M.l - 6}" y="${y(t) + 4}" text-anchor="end">${(t / 1000).toFixed(0)}s</text>`).join('')}
    <g class="bars">${a.tiredness.map((t, i) => {
      const h = t.enough ? y(0) - y(t.median) : 6;
      return `<rect class="tired-bar${t.enough ? '' : ' nd'}" data-tip="${i}" x="${M.l + i * bw + 2}" y="${y(0) - h}" width="${bw - 4}" height="${h}" rx="4"/>`;
    }).join('')}</g>
    <line class="axis-base" x1="${M.l}" x2="${W - M.r}" y1="${y(0)}" y2="${y(0)}"/>
    ${a.tiredness.map((t, i) => `<text x="${M.l + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${t.minute}</text>`).join('')}
  </svg>`;
  growBars([...host.querySelectorAll('rect')], { delay: 0.4 });
}
