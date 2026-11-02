import { store } from '../store.js';
import { localDateKey, addDays, parseDateKey } from '../dates.js';
import { currentStreak, averageScore, bestScore, dailyScore, minutesOf } from '../sessions.js';
import { $, flow } from '../ui.js';
import { weakPref, setWeakPref } from './session.js';

export function todayState() {
  const today = localDateKey();
  const day = store.days().get(today);
  return { today, daily: day?.daily || null };
}

export function renderHome() {
  const { today, daily } = todayState();
  const days = store.days();
  $('#home-date').textContent = parseDateKey(today).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const card = $('#daily-card');
  card.classList.toggle('done', !!daily);
  card.disabled = !!daily;
  if (daily) {
    $('#daily-title').textContent = 'Done today ✓';
    $('#daily-sub').textContent = daily.status === 'complete'
      ? `${dailyScore(daily)} correct · come back tomorrow`
      : `Incomplete · ${minutesOf(daily).toFixed(1)} min recorded · come back tomorrow`;
  } else {
    $('#daily-title').textContent = 'Start today’s Daily';
    $('#daily-sub').textContent = '10:00 · one attempt · counts towards your trend';
  }

  const unlocked = !!daily;
  $('#free-card').classList.toggle('locked', !unlocked);
  $('#free-title').textContent = unlocked ? 'Keep going' : 'Locked';
  $('#free-sub').textContent = unlocked ? 'No clock. Stop whenever you like. Doesn’t affect your Daily score.' : 'Unlocks after today’s Daily.';
  $('#free-start').disabled = !unlocked;
  const wt = $('#weak-toggle-home');
  wt.checked = weakPref();
  wt.onchange = () => setWeakPref(wt.checked);

  flow($('#home-streak'), currentStreak(days, today));
  flow($('#home-avg'), averageScore(days, addDays(today, -6), today).value, { maximumFractionDigits: 1 });
  flow($('#home-best'), bestScore(days));
  $('#home-empty').hidden = store.sessions.length > 0;
}
