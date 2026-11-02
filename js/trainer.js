// Session engine: timing, idle auto-pause, answer checking. No DOM here.
import { DAILY_MS, IDLE_MS, SCHEMA_VERSION } from './constants.js';
import { localDateKey, timezone } from './dates.js';
import { uuid } from './db.js';

const now = () => performance.now();

export class Trainer {
  /**
   * @param {object} o
   * @param {'daily'|'free'} o.mode
   * @param {{next: () => {a:number,b:number}}} o.generator
   * @param {(session:object) => void} o.save            persist the record (called after every question)
   * @param {object} o.on  callbacks: question(q), wrong(typed), typed(str), pause(reason), resume(), finish(session)
   */
  constructor({ mode, generator, save, on = {} }) {
    this.mode = mode;
    this.gen = generator;
    this.saveFn = save;
    this.on = on;
    this.state = 'idle';
    const started = new Date();
    this.record = {
      schemaVersion: SCHEMA_VERSION,
      id: uuid(),
      mode,
      date: localDateKey(started),
      startedAt: started.toISOString(),
      timezone: timezone(),
      activeMs: 0,
      pausedMs: 0,
      status: 'incomplete', // becomes 'complete' only when it finishes properly
      correct: 0,
      mistakes: 0,
      questions: [],
    };
    this.segStart = 0;     // perf time the current running segment began
    this.pausedSince = 0;
    this.lastKeyAt = 0;
    this.cur = null;       // {a, b, answer, shownAt, shownAtMs, typed, wrong: []}
  }

  /** Active time so far (ms), at perf time t. */
  activeAt(t = now()) { return this.record.activeMs + (this.state === 'running' ? t - this.segStart : 0); }
  pausedAt(t = now()) { return this.record.pausedMs + (this.state === 'paused' ? t - this.pausedSince : 0); }
  remaining(t = now()) { return Math.max(0, DAILY_MS - this.activeAt(t)); }

  start() {
    const t = now();
    this.state = 'running';
    this.segStart = t;
    this.lastKeyAt = t;
    this.persist(t);
    this.show(t);
  }

  show(t) {
    const { a, b } = this.gen.next();
    this.cur = { a, b, answer: String(a * b), shownAt: t, shownAtMs: Math.round(this.activeAt(t)), typed: '', wrong: [] };
    this.on.question?.(this.cur);
  }

  /** Push the current question into the record with the given outcome. */
  commit(outcome, t) {
    const c = this.cur;
    if (!c) return;
    this.record.questions.push({ a: c.a, b: c.b, outcome, ms: Math.round(t - c.shownAt), wrongAttempts: c.wrong.slice(), shownAtMs: c.shownAtMs });
    if (outcome === 'correct') this.record.correct++;
    if (c.wrong.length) this.record.mistakes++;
    this.cur = null;
  }

  persist(t = now()) {
    const r = this.record;
    r.activeMs = Math.round(this.activeAt(t)) ; // snapshot values for storage
    r.pausedMs = Math.round(this.pausedAt(t));
    if (this.state === 'running') this.segStart = t; // re-base the running segment on the snapshot
    if (this.state === 'paused') this.pausedSince = t;
    this.saveFn(r);
  }

  // ---- input ----
  digit(d) {
    const t = now();
    this.lastKeyAt = t;
    if (this.state !== 'running' || !this.cur) return;
    const c = this.cur;
    c.typed += d;
    if (c.typed === c.answer) {
      this.on.typed?.(c.typed);
      this.commit('correct', t);
      this.persist(t);
      this.show(t);
      return;
    }
    if (c.typed.length >= c.answer.length) { this.wrong(); return; }
    this.on.typed?.(c.typed);
  }

  backspace() {
    this.lastKeyAt = now();
    if (this.state !== 'running' || !this.cur) return;
    this.cur.typed = this.cur.typed.slice(0, -1);
    this.on.typed?.(this.cur.typed);
  }

  enter() {
    this.lastKeyAt = now();
    if (this.state !== 'running' || !this.cur || !this.cur.typed) return;
    if (this.cur.typed !== this.cur.answer) this.wrong();
  }

  wrong() {
    const c = this.cur;
    c.wrong.push(c.typed);
    c.typed = '';
    this.on.wrong?.();
    this.on.typed?.('');
  }

  /** Any other key counts as activity for the idle timer. */
  activity() { this.lastKeyAt = now(); }

  togglePause() {
    if (this.state === 'running') this.pause('manual');
    else if (this.state === 'paused') this.resume();
  }

  pause(reason = 'manual', t = now()) {
    if (this.state !== 'running') return;
    if (reason === 'manual') this.commit('skipped-pause', t);
    this.record.activeMs += t - this.segStart;
    this.state = 'paused';
    this.pausedSince = t;
    this.persist(t);
    this.on.pause?.(reason);
  }

  resume() {
    if (this.state !== 'paused') return;
    const t = now();
    this.record.pausedMs += t - this.pausedSince;
    this.state = 'running';
    this.segStart = t;
    this.lastKeyAt = t;
    this.on.resume?.();
    this.show(t);
  }

  /** Called regularly (and when the tab becomes visible again). Handles time-up and idle. */
  tick() {
    if (this.state !== 'running') return;
    const t = now();
    const idleAt = this.lastKeyAt + IDLE_MS;
    if (this.mode === 'daily') {
      const endAt = this.segStart + (DAILY_MS - this.record.activeMs);
      if (endAt <= idleAt && t >= endAt) { this.finish('complete', endAt); return; }
    }
    if (t >= idleAt) this.timeout(idleAt);
  }

  timeout(at) {
    this.commit('timed-out', at);
    this.record.activeMs += at - this.segStart;
    if (this.mode === 'free') {
      // In Free Practice the idle minute doesn't count as practice time.
      this.record.activeMs = Math.max(0, this.record.activeMs - IDLE_MS);
      this.record.pausedMs += IDLE_MS;
    }
    this.state = 'paused';
    this.pausedSince = at;
    this.persist(now());
    this.on.pause?.('idle');
  }

  /** Stop the clocks and drop the unanswered current question. */
  close(t) {
    if (this.state === 'running') this.record.activeMs += t - this.segStart;
    if (this.state === 'paused') this.record.pausedMs += t - this.pausedSince;
    this.state = 'done';
    this.cur = null;
  }

  /** End the session. Unanswered current question is dropped. */
  finish(status, t = now()) {
    if (this.state === 'done') return;
    this.close(t);
    const r = this.record;
    if (this.mode === 'daily' && status === 'complete') r.activeMs = DAILY_MS;
    r.activeMs = Math.round(r.activeMs);
    r.pausedMs = Math.round(r.pausedMs);
    r.status = status;
    this.saveFn(r);
    this.on.finish?.(r);
  }

  /**
   * Cancel a Daily attempt so it can be retried. The attempt stops being a Daily:
   * it is kept as Free Practice (marked cancelledDaily) so its questions still feed Analysis.
   */
  cancel(t = now()) {
    if (this.mode !== 'daily' || this.state === 'done') return;
    this.close(t);
    const r = this.record;
    r.activeMs = Math.round(r.activeMs);
    r.pausedMs = Math.round(r.pausedMs);
    r.mode = 'free';
    r.cancelledDaily = true;
    r.status = 'complete';
    this.saveFn(r);
    this.on.cancel?.(r);
  }
}
