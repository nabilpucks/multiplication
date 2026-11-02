import { fakeSessions } from './fake-data.js';
import * as DB from '../js/db.js';
import { buildExport, exportFileName } from '../js/transfer-logic.js';
import { localDateKey } from '../js/dates.js';

const out = document.getElementById('out');
const log = (m) => { out.textContent = m; };
const count = (list) => list.reduce((n, s) => n + s.questions.length, 0).toLocaleString();

async function load(days) {
  const existing = await DB.getAllSessions();
  if (existing.length && !confirmed('There is already data in this browser. Add fake sessions on top of it? You can only remove them with “Delete all data”.')) return;
  const sessions = fakeSessions({ days, seed: Date.now() & 0xffff });
  await DB.addSessions(sessions);
  const id = (await DB.getMeta('installId')) || DB.uuid();
  await DB.setMeta('installId', id);
  DB.writeMarker(id, existing.length + sessions.length);
  log(`Added ${sessions.length} sessions (${count(sessions)} questions). Open the app to see them.`);
}

// Dev page only: a plain confirm is acceptable here.
const confirmed = (msg) => window.confirm(msg);

document.getElementById('load6').onclick = () => load(182);
document.getElementById('load18').onclick = () => load(548);
document.getElementById('download').onclick = () => {
  const sessions = fakeSessions({ days: 182 });
  const blob = new Blob([JSON.stringify(buildExport(sessions))], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'fake-' + exportFileName(localDateKey());
  a.click();
  log(`Downloaded ${sessions.length} fake sessions (${count(sessions)} questions). Drag the file onto the app to import it.`);
};
document.getElementById('wipe').onclick = async () => {
  if (!confirmed('Delete ALL sessions in this browser, real and fake? Export first if you want to keep anything.')) return;
  await DB.clearAll();
  log('All data deleted.');
};
DB.getAllSessions().then((s) => log(`This browser currently stores ${s.length} sessions (${count(s)} questions).`));
