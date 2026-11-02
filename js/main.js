// App entry: storage check, routing, view lifecycle.
import { store } from './store.js';
import * as DB from './db.js';
import { checkStorage } from './db.js';
import { DEV } from './env.js';
import { runCleanups } from './cleanup.js';
import { $, $$ } from './ui.js';
import { enterView, leaveView } from './motion.js';
import { initSession, startSession, isActive, abandonIfActive } from './views/session.js';
import { renderHome, todayState } from './views/home.js';
import { renderResults } from './views/results.js';
import { initProgress, renderProgress } from './views/progress.js';
import { initAnalysis, renderAnalysis } from './views/analysis.js';
import { initHistory, renderHistory } from './views/history.js';
import { initTransfer, renderExportLines } from './transfer.js';

let current = null;

function go(hash) { if (location.hash !== hash) location.hash = hash; else route(); }

function banner(html) {
  const b = $('#banner');
  b.innerHTML = html;
  b.hidden = false;
}

async function route() {
  const [, name = 'home', arg] = (location.hash || '#/home').split('/');
  let view = name;

  if (name === 'daily' || name === 'free') {
    const { daily } = todayState();
    if (name === 'daily' && daily) { go('#/home'); return; }
    if (name === 'free' && !daily) { go('#/home'); return; }
    view = 'session';
  } else if (isActive()) {
    abandonIfActive(); // leaving the session by URL ends it (Daily → incomplete)
    return;
  }
  if (!['home', 'session', 'results', 'progress', 'analysis', 'history'].includes(view)) { go('#/home'); return; }

  const next = $(`[data-view="${view}"]`);
  if (current && current !== next) {
    if (view === 'session' || current.dataset.view === 'session') current.hidden = true;
    else { await leaveView(current); current.hidden = true; }
  }
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === view));
  next.hidden = false;
  current = next;
  window.scrollTo(0, 0);

  if (view === 'session') { next.style.opacity = 1; startSession(name); return; }
  if (view === 'home') renderHome();
  if (view === 'results' && !renderResults(arg)) { go('#/home'); return; }
  if (view === 'progress') renderProgress();
  if (view === 'analysis') renderAnalysis();
  if (view === 'history') renderHistory();
  renderExportLines();
  enterView(next);
}

async function boot() {
  const check = await checkStorage();
  if (!check.ok) {
    banner('<strong>Storage isn’t working in this browser.</strong> Nothing you do will be saved. Try a normal (non-private) window, then <button class="link" data-action="import">import your last export</button>.');
  } else {
    store.setInstallId(check.installId);
    try { await runCleanups(DB); } catch (e) { console.warn('cleanup failed', e); }
    try { await store.load(); } catch (e) { banner(`<strong>Couldn’t read saved data</strong> (${e.message}). <button class="link" data-action="import">Import your last export</button>.`); }
    if (check.wiped) {
      banner('<strong>Your saved sessions seem to have been cleared</strong> by the browser. <button class="link" data-action="import">Import your last export</button> or drag it onto this window to get them back.');
    }
  }
  initSession({ go });
  initProgress();
  initAnalysis();
  initHistory();
  await initTransfer();

  $('#daily-card').addEventListener('click', () => go('#/daily'));
  $('#free-start').addEventListener('click', () => go('#/free'));
  store.subscribe(() => {
    if (!current || isActive()) return;
    const v = current.dataset.view;
    if (v === 'home') renderHome();
    if (v === 'progress') renderProgress();
    if (v === 'analysis') renderAnalysis();
    if (v === 'history') renderHistory();
    renderExportLines();
  });
  // Midnight: refresh Home so the new day's Daily appears.
  let day = todayState().today;
  setInterval(() => { const t = todayState().today; if (t !== day) { day = t; if (current?.dataset.view === 'home') renderHome(); } }, 30000);

  if (DEV) window.MT_TEST = { store, DB, rerender: route };
  window.addEventListener('hashchange', route);
  route();
}

boot();
