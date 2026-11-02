// Export / Import UI (button + drag-and-drop) and the "last export" reminder.
import { store } from './store.js';
import * as DB from './db.js';
import { buildExport, exportFileName, parseExport, mergeSessions, importReport } from './transfer-logic.js';
import { localDateKey } from './dates.js';
import { daysSince } from './sessions.js';
import { EXPORT_WARN_DAYS } from './constants.js';
import { $, $$, toast } from './ui.js';
import { isActive } from './views/session.js';

const LAST_EXPORT = 'mt.lastExportAt';
let lastExportAt = null;

export async function initTransfer() {
  try { lastExportAt = (await DB.getMeta('lastExportAt')) || localStorage.getItem(LAST_EXPORT); } catch { lastExportAt = null; }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    if (b.dataset.action === 'export') doExport();
    if (b.dataset.action === 'import') $('#file-input').click();
  });
  $('#file-input').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) await importFile(f);
  });

  // Drag a file anywhere onto the window.
  let depth = 0;
  const layer = $('#drop-layer');
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; if (!isActive()) layer.hidden = false; });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) layer.hidden = true; });
  window.addEventListener('drop', async (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0; layer.hidden = true;
    if (isActive()) { toast('Finish the session first, then import.'); return; }
    const f = e.dataTransfer.files[0];
    if (f) await importFile(f);
  });
  renderExportLines();
}

export async function doExport() {
  const data = buildExport(store.sessions);
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(localDateKey());
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  lastExportAt = data.exportedAt;
  try { await DB.setMeta('lastExportAt', lastExportAt); localStorage.setItem(LAST_EXPORT, lastExportAt); } catch {}
  renderExportLines();
  toast(`Exported ${store.sessions.length} session${store.sessions.length === 1 ? '' : 's'}.`);
}

export async function importFile(file) {
  let text;
  try { text = await file.text(); } catch { toast('Couldn’t read that file.'); return; }
  const parsed = parseExport(text);
  if (!parsed.ok) { toast(parsed.error, 7000); return; }
  const res = mergeSessions(await DB.allIds(), parsed.sessions);
  try {
    if (res.toAdd.length) await store.addMany(res.toAdd);
  } catch (e) { toast('Import failed while saving: ' + e.message, 7000); return; }
  $('#banner').hidden = true;
  toast(importReport(res) + '.', 6000);
}

export function renderExportLines() {
  const n = daysSince(lastExportAt, localDateKey());
  for (const el of $$('[data-export-line]')) {
    const stale = n == null ? store.sessions.length > 0 : n >= EXPORT_WARN_DAYS;
    el.classList.toggle('stale', stale);
    el.innerHTML = (n == null ? 'Last export: never' : `Last export: ${n === 0 ? 'today' : n === 1 ? '1 day ago' : `${n} days ago`}`) +
      ' · <button class="link" data-action="export">Export now</button>';
  }
}
