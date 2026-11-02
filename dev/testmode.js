// Test-mode panel. Loaded only with ?dev=1; works on the separate test database.
import { fakeSessions } from './fake-data.js';
import { localDateKey } from '../js/dates.js';

function whenReady(fn) {
  if (window.MT_TEST) fn(window.MT_TEST); else setTimeout(() => whenReady(fn), 50);
}

whenReady(({ store, DB }) => {
  const box = document.createElement('div');
  box.id = 'test-panel';
  box.innerHTML = `<b>Test mode</b><span>separate database, real data untouched</span>
    <button data-t="today">Reset today</button><button data-t="fake">Load 6 months of fake data</button><button data-t="wipe">Empty test data</button>`;
  const css = document.createElement('style');
  css.textContent = `#test-panel{position:fixed;left:16px;bottom:16px;z-index:90;display:flex;gap:8px;align-items:center;flex-wrap:wrap;max-width:calc(100% - 32px);
    padding:8px 12px;background:#141418;border:1px solid #333;border-radius:6px;font:14px/1.3 Geist,system-ui,sans-serif;color:#F2F2F5}
    #test-panel span{opacity:.6;margin-right:8px}#test-panel button{font:inherit;color:inherit;background:#26262d;border:0;border-radius:4px;padding:4px 10px;cursor:pointer}
    body.in-session #test-panel{opacity:.25}`;
  document.head.append(css);
  document.body.append(box);
  const say = (m) => { const s = box.querySelector('span'); s.textContent = m; };
  box.addEventListener('click', async (e) => {
    const t = e.target.dataset?.t;
    if (!t) return;
    if (t === 'today') {
      const today = localDateKey();
      const ids = store.sessions.filter((s) => s.date === today).map((s) => s.id);
      for (const id of ids) await store.remove(id);
      say(`removed ${ids.length} session${ids.length === 1 ? '' : 's'} from today`);
    }
    if (t === 'fake') {
      const list = fakeSessions({ days: 182, seed: (Date.now() & 0xffff) + 1 });
      await store.addMany(list);
      say(`added ${list.length} sessions`);
    }
    if (t === 'wipe') {
      for (const id of store.sessions.map((s) => s.id)) await store.remove(id);
      say('test data emptied');
    }
  });
});
