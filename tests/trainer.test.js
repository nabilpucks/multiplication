import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Trainer } from '../js/trainer.js';

let clock = 0;
Object.defineProperty(globalThis, 'performance', { value: { now: () => clock }, configurable: true, writable: true });

function make(mode, seq = [[12, 34], [7, 8], [56, 78], [23, 45], [9, 9], [67, 89], [13, 14]]) {
  let i = 0;
  const saves = [];
  const events = [];
  const t = new Trainer({
    mode,
    generator: { next: () => { const [a, b] = seq[i++ % seq.length]; return { a, b }; } },
    save: (r) => saves.push(structuredClone(r)),
    on: { pause: (r) => events.push('pause:' + r), finish: () => events.push('finish') },
  });
  return { t, saves, events };
}
const type = (t, s) => { for (const d of s) t.digit(d); };

test('correct answer advances immediately; wrong full-length answer is recorded once per question', () => {
  clock = 0;
  const { t, saves } = make('daily');
  t.start();
  clock = 2000; type(t, '418');           // wrong (12×34 = 408), auto-checked at full length
  clock = 3000; type(t, '4');  t.enter(); // wrong via Enter
  clock = 4000; type(t, '408');           // correct
  const r = t.record;
  assert.equal(r.correct, 1);
  assert.equal(r.mistakes, 1);
  assert.deepEqual(r.questions[0], { a: 12, b: 34, outcome: 'correct', ms: 4000, wrongAttempts: ['418', '4'], shownAtMs: 0 });
  assert.equal(t.cur.a, 7);
  assert.equal(saves.at(-1).questions.length, 1, 'saved after the question');
  assert.equal(saves.at(-1).status, 'incomplete');
});

test('pause hides the question as skipped-pause; the clock stops while paused', () => {
  clock = 0;
  const { t } = make('daily');
  t.start();
  clock = 5000; t.togglePause();
  assert.equal(t.record.questions[0].outcome, 'skipped-pause');
  clock = 100000; t.tick();
  assert.equal(t.activeAt(), 5000);
  t.togglePause();
  assert.equal(t.cur.a, 7, 'fresh question on resume');
  assert.equal(t.record.pausedMs, 95000);
  assert.equal(t.cur.shownAtMs, 5000);
});

test('Daily: 60s idle auto-pauses as timed-out and the idle minute still counts on the clock', () => {
  clock = 0;
  const { t, events } = make('daily');
  t.start();
  clock = 10000; t.activity();
  clock = 75000; t.tick(); // idle since 10s → timeout at 70s
  assert.deepEqual(events, ['pause:idle']);
  assert.equal(t.record.questions[0].outcome, 'timed-out');
  assert.equal(t.record.questions[0].ms, 70000);
  assert.equal(t.activeAt(), 70000);
  assert.equal(t.record.pausedMs, 5000);
});

test('Free: the idle minute is not counted in practice minutes', () => {
  clock = 0;
  const { t } = make('free');
  t.start();
  clock = 20000; type(t, '408');
  clock = 90000; t.tick(); // idle since 20s → timeout at 80s
  assert.equal(t.record.questions[1].outcome, 'timed-out');
  assert.equal(t.activeAt(), 20000);
  t.finish('complete');
  assert.equal(t.record.activeMs, 20000);
  assert.equal(t.record.status, 'complete');
});

test('Daily finishes at exactly 10:00 of active time, even if the tab was asleep', () => {
  clock = 0;
  const { t, events } = make('daily');
  t.start();
  for (let s = 30000; s <= 600000; s += 30000) { clock = s; t.activity(); t.tick(); }
  clock = 650000; t.tick();
  assert.ok(events.includes('finish'));
  assert.equal(t.record.status, 'complete');
  assert.equal(t.record.activeMs, 600000);
});

test('time-up takes priority over an idle minute that would end later', () => {
  clock = 0;
  const { t, events } = make('daily');
  t.start();
  for (let s = 30000; s <= 570000; s += 30000) { clock = s; t.activity(); }
  clock = 700000; t.tick(); // clock hits 0 at 600s, idle would trigger at 630s
  assert.deepEqual(events, ['finish']);
  assert.equal(t.record.questions.length, 0, 'unfinished question is dropped');
});

test('quitting a Daily early saves it as incomplete with the minutes done', () => {
  clock = 0;
  const { t, saves } = make('daily');
  t.start();
  clock = 3000; type(t, '408');
  clock = 125000; t.activity(); t.finish('incomplete');
  assert.equal(saves.at(-1).status, 'incomplete');
  assert.equal(saves.at(-1).activeMs, 125000);
  assert.equal(saves.at(-1).correct, 1);
});
