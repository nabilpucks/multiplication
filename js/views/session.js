// The answering screen for both Daily and Free Practice.
import { Trainer } from '../trainer.js';
import { createGenerator } from '../generator.js';
import { buildWeakSource } from '../analysis-logic.js';
import { store } from '../store.js';
import { DAILY_MS } from '../constants.js';
import { $, reducedMotion, confirmDialog, toast } from '../ui.js';

let trainer = null;
let tickTimer = 0;
let lastShownSecond = -1;
let navigate = () => {};
const WEAK_KEY = 'mt.weakSpots';

export const isActive = () => !!trainer && trainer.state !== 'done';
export const weakPref = () => { try { return localStorage.getItem(WEAK_KEY) === '1'; } catch { return false; } };
export const setWeakPref = (v) => { try { localStorage.setItem(WEAK_KEY, v ? '1' : '0'); } catch {} };

const els = {};
export function initSession({ go }) {
  navigate = go;
  Object.assign(els, {
    view: $('[data-view="session"]'), mode: $('#session-mode'), qa: $('#qa'), qb: $('#qb'), q: $('#question'),
    input: $('#answer'), flash: $('#answer-flash'), box: $('#answer-box'), correct: $('#session-correct'),
    tm: $('#timer-m'), ts: $('#timer-s'), timer: $('.session-timer'), pause: $('#pause-layer'),
    pauseTitle: $('#pause-title'), pauseSub: $('#pause-sub'), resume: $('#resume-btn'), quit: $('#session-quit'),
    weak: $('#weak-toggle'), weakWrap: $('#weak-switch-wrap'),
  });
  els.tm.format = { minimumIntegerDigits: 1 };
  els.ts.format = { minimumIntegerDigits: 2 };
  els.ts.digits = { 1: { max: 5 } };
  for (const nf of [els.tm, els.ts]) { nf.transformTiming = { duration: 400, easing: 'cubic-bezier(.2,.7,.1,1)' }; nf.spinTiming = nf.transformTiming; }

  document.addEventListener('keydown', onKey, true);
  els.input.addEventListener('blur', () => { if (isActive() && $('#modal').hidden) setTimeout(() => focusInput(), 0); });
  els.input.addEventListener('beforeinput', (e) => e.preventDefault()); // we control the value ourselves
  els.view.addEventListener('pointerup', () => focusInput());
  els.resume.addEventListener('click', () => { trainer?.resume(); });
  els.quit.addEventListener('click', quit);
  els.weak.addEventListener('change', () => { setWeakPref(els.weak.checked); trainer && (trainer.weakOn = els.weak.checked); focusInput(); });
  document.addEventListener('visibilitychange', () => { if (isActive()) { trainer.tick(); renderTimer(true); } });
  window.addEventListener('pagehide', () => { if (isActive()) trainer.persist(); });
}

function focusInput() {
  if (isActive() && document.activeElement !== els.input) els.input.focus({ preventScroll: true });
}

export function startSession(mode) {
  if (isActive()) return;
  let weakSource = null;
  if (mode === 'free') {
    const ws = buildWeakSource(store.analysis());
    weakSource = ws && ((rng) => (trainer?.weakOn ? ws(rng) : null));
  }
  const generator = createGenerator({ weakSource });
  trainer = new Trainer({
    mode, generator,
    save: (r) => { store.save(r, { quiet: true }).catch((e) => toast('Couldn’t save: ' + e.message)); },
    on: { question: showQuestion, typed: (s) => { els.input.value = s; }, wrong: flashWrong, pause: onPause, resume: onResume, finish: onFinish },
  });
  trainer.weakOn = mode === 'free' && weakPref();
  els.weak.checked = trainer.weakOn;
  els.weakWrap.hidden = mode !== 'free';
  els.mode.textContent = mode === 'daily' ? 'Daily' : 'Free Practice';
  els.quit.textContent = mode === 'daily' ? 'End early' : 'Stop';
  els.correct.textContent = '0';
  els.pause.hidden = true;
  els.input.value = '';
  els.timer.classList.remove('low');
  document.body.classList.add('in-session');
  lastShownSecond = -1;
  trainer.start();
  renderTimer(true);
  clearInterval(tickTimer);
  tickTimer = setInterval(() => { trainer.tick(); renderTimer(false); }, 100);
  focusInput();
}

function showQuestion(c) {
  els.qa.textContent = c.a;
  els.qb.textContent = c.b;
  els.input.value = '';
  els.correct.textContent = String(trainer.record.correct);
  // ≤120ms, compositor-only, never blocks input (text is already swapped).
  if (!reducedMotion() && els.q.animate) {
    els.q.animate([{ opacity: 0.25, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 110, easing: 'cubic-bezier(.2,.7,.1,1)' });
  }
}

function flashWrong() {
  els.flash.animate?.([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 120, easing: 'linear' });
  if (!reducedMotion()) {
    els.input.animate?.([{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: 120, easing: 'linear' });
  }
}

function renderTimer(force) {
  if (!trainer) return;
  const ms = trainer.mode === 'daily' ? trainer.remaining() : trainer.activeAt();
  const total = trainer.mode === 'daily' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
  if (!force && total === lastShownSecond) return;
  lastShownSecond = total;
  // Digits only roll while paused; while answering the clock updates without motion.
  const animate = trainer.state !== 'running' && !reducedMotion();
  els.tm.animated = animate; els.ts.animated = animate;
  els.tm.update(Math.floor(total / 60));
  els.ts.update(total % 60);
  if (trainer.mode === 'daily') els.timer.classList.toggle('low', ms <= 30000);
}

function onKey(e) {
  if (!isActive() || !$('#modal').hidden) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  const numpad = /^Numpad(\d)$/.exec(e.code);
  const digit = /^\d$/.test(k) ? k : numpad ? numpad[1] : null;
  if (digit != null) { e.preventDefault(); trainer.digit(digit); return; }
  if (k === 'Backspace') { e.preventDefault(); trainer.backspace(); return; }
  if (k === 'Enter') {
    e.preventDefault();
    if (trainer.state === 'paused') trainer.resume(); else trainer.enter();
    return;
  }
  if (k === ' ' || e.code === 'Space' || k === 'Escape') { e.preventDefault(); trainer.activity(); trainer.togglePause(); return; }
  if (k === 'Tab') { e.preventDefault(); }
  trainer.activity();
}

function onPause(reason) {
  els.pause.hidden = false;
  els.pauseTitle.textContent = reason === 'idle' ? 'Still there?' : 'Paused';
  els.pauseSub.textContent = reason === 'idle'
    ? (trainer.mode === 'daily' ? 'No keys pressed for a minute, so we paused. That minute still counted on the clock.' : 'No keys pressed for a minute, so we paused. That minute isn’t counted in your practice time.')
    : 'The question is hidden. You’ll get a fresh one when you resume.';
  renderTimer(true);
}

function onResume() {
  els.pause.hidden = true;
  renderTimer(true);
  focusInput();
}

async function quit() {
  if (!isActive()) return;
  if (trainer.mode === 'free') { trainer.finish('complete'); return; }
  const wasRunning = trainer.state === 'running';
  if (wasRunning) trainer.pause('manual');
  const ok = await confirmDialog({
    title: 'End today’s Daily early?',
    body: 'It will be saved as incomplete with the minutes you’ve done, and you can’t restart it today.',
    ok: 'End Daily', cancel: 'Keep going',
  });
  if (ok) trainer.finish('incomplete');
  else focusInput();
}

function onFinish(record) {
  clearInterval(tickTimer);
  document.body.classList.remove('in-session');
  els.input.blur();
  const id = record.id;
  store.save(record).then(() => navigate(`#/results/${id}`));
}

/** Leaving the session view by URL (back button etc.) ends it. */
export function abandonIfActive() {
  if (!isActive()) return;
  trainer.finish(trainer.mode === 'daily' ? 'incomplete' : 'complete');
}

