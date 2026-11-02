// Every question ever answered, virtualised so 50,000+ rows stay smooth.
import { store } from '../store.js';
import { extraDailyIds } from '../sessions.js';
import { formatDateKey } from '../dates.js';
import { $, esc } from '../ui.js';

const ROW_H = 40, OVERSCAN = 8;
const MODE_LABEL = { daily: 'Daily', extra: 'Extra practice', free: 'Free Practice' };
const OUTCOME_LABEL = { correct: 'Correct', 'timed-out': 'Timed out', 'skipped-pause': 'Skipped (pause)' };

let rows = [];          // flattened, newest first
let builtFor = -1;
let view = new Int32Array(0); // indexes into rows after filtering
let pool = [];
let scroller, spacer, raf = 0;
const dateLabels = new Map();

export function initHistory() {
  scroller = $('#h-scroll');
  spacer = $('#h-spacer');
  scroller.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); }, { passive: true });
  for (const id of ['#h-num', '#h-mode', '#h-outcome', '#h-from', '#h-to']) $(id).addEventListener('input', () => { applyFilter(); });
  window.addEventListener('resize', () => { if (!$('[data-view="history"]').hidden) paint(true); });
}

function build() {
  if (builtFor === store.version) return;
  builtFor = store.version;
  const extras = extraDailyIds(store.days());
  const sessions = [...store.sessions].sort((x, y) => (x.startedAt < y.startedAt ? 1 : -1));
  const out = [];
  for (const s of sessions) {
    const mode = s.mode === 'daily' ? (extras.has(s.id) ? 'extra' : 'daily') : 'free';
    for (let i = s.questions.length - 1; i >= 0; i--) {
      const q = s.questions[i];
      out.push({ date: s.date, mode, a: q.a, b: q.b, outcome: q.outcome, ms: q.ms, wrong: q.wrongAttempts, mistake: q.wrongAttempts.length > 0 });
    }
  }
  rows = out;
}

function applyFilter() {
  const numStr = $('#h-num').value.trim();
  const num = /^\d{1,2}$/.test(numStr) ? Number(numStr) : null;
  const mode = $('#h-mode').value, outcome = $('#h-outcome').value;
  const from = $('#h-from').value, to = $('#h-to').value;
  const idx = new Int32Array(rows.length);
  let n = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (num != null && r.a !== num && r.b !== num) continue;
    if (mode && r.mode !== mode) continue;
    if (outcome === 'mistake' ? !r.mistake : outcome && r.outcome !== outcome) continue;
    if (from && r.date < from) continue;
    if (to && r.date > to) continue;
    idx[n++] = i;
  }
  view = idx.subarray(0, n);
  $('#h-count').textContent = `${n.toLocaleString()} of ${rows.length.toLocaleString()} questions`;
  spacer.style.height = `${n * ROW_H}px`;
  scroller.scrollTop = 0;
  paint(true);
}

function dateLabel(key) {
  let l = dateLabels.get(key);
  if (!l) { l = formatDateKey(key, { day: 'numeric', month: 'short', year: 'numeric' }); dateLabels.set(key, l); }
  return l;
}

function rowHtml(r) {
  const answer = r.outcome === 'correct' ? String(r.a * r.b) : '—';
  const wrong = r.wrong.map((w) => `<s>${esc(w)}</s>`).join('');
  const oc = r.outcome === 'correct' && r.mistake ? 'mistake' : r.outcome;
  const ol = oc === 'mistake' ? 'Correct after mistake' : OUTCOME_LABEL[r.outcome];
  return `<span>${dateLabel(r.date)}</span><span><i class="mode-dot ${r.mode}"></i>${MODE_LABEL[r.mode]}</span>` +
    `<span class="qq">${r.a} × ${r.b}</span><span class="ans">${wrong}${answer}</span>` +
    `<span class="num">${(r.ms / 1000).toFixed(1)}s</span><span><span class="badge ${oc}">${ol}</span></span>`;
}

function paint(force = false) {
  const h = scroller.clientHeight;
  const first = Math.max(0, Math.floor(scroller.scrollTop / ROW_H) - OVERSCAN);
  const count = Math.min(view.length - first, Math.ceil(h / ROW_H) + OVERSCAN * 2);
  while (pool.length < Math.max(0, count)) {
    const div = document.createElement('div');
    div.className = 'h-row';
    scroller.appendChild(div);
    pool.push(div);
  }
  for (let k = 0; k < pool.length; k++) {
    const el = pool[k];
    if (k >= count) { if (!el.hidden) el.hidden = true; continue; }
    const vi = first + k;
    el.hidden = false;
    el.style.transform = `translateY(${vi * ROW_H}px)`;
    el.classList.toggle('alt', vi % 2 === 1);
    if (force || el._vi !== vi) { el.innerHTML = rowHtml(rows[view[vi]]); el._vi = vi; }
  }
  let empty = scroller.querySelector('.h-empty');
  if (!view.length) {
    if (!empty) { empty = document.createElement('div'); empty.className = 'h-empty'; scroller.appendChild(empty); }
    empty.textContent = rows.length ? 'No questions match these filters.' : 'Nothing here yet. Your questions will appear after your first session.';
  } else if (empty) empty.remove();
}

export function renderHistory() {
  build();
  applyFilter();
}
