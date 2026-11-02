// IndexedDB access via the idb wrapper.
import { openDB } from '../vendor/idb.js';

const DB_NAME = 'multiplication-trainer';
const MARKER = 'mt.marker'; // localStorage copy of the install id, used to notice wiped IndexedDB

let dbp = null;

export function db() {
  if (!dbp) {
    dbp = openDB(DB_NAME, 1, {
      upgrade(d) {
        const s = d.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('date', 'date');
        d.createObjectStore('meta');
      },
    });
  }
  return dbp;
}

export const getAllSessions = async () => (await db()).getAll('sessions');
export const putSession = async (s) => { await (await db()).put('sessions', s); };
export const deleteSession = async (id) => { await (await db()).delete('sessions', id); };
export const getMeta = async (k) => (await db()).get('meta', k);
export const setMeta = async (k, v) => (await db()).put('meta', v, k);
export async function allIds() { return new Set(await (await db()).getAllKeys('sessions')); }

export async function addSessions(list) {
  const tx = (await db()).transaction('sessions', 'readwrite');
  for (const s of list) tx.store.add(s);
  await tx.done;
}

export async function clearAll() {
  const d = await db();
  const tx = d.transaction(['sessions', 'meta'], 'readwrite');
  await Promise.all([tx.objectStore('sessions').clear(), tx.objectStore('meta').clear(), tx.done]);
  try { localStorage.removeItem(MARKER); } catch {}
}

function readMarker() {
  try { return JSON.parse(localStorage.getItem(MARKER) || 'null'); } catch { return null; }
}
export function writeMarker(installId, sessionCount) {
  try { localStorage.setItem(MARKER, JSON.stringify({ installId, sessionCount, at: new Date().toISOString() })); } catch {}
}

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
  ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

/**
 * Startup check. Returns { ok, wiped, persisted, error }.
 * - ok=false: IndexedDB can't be opened or written.
 * - wiped=true: this browser had data before (localStorage marker) but IndexedDB is now empty.
 */
export async function checkStorage() {
  let persisted = null;
  try { if (navigator.storage?.persist) persisted = await navigator.storage.persist(); } catch {}
  try {
    const d = await db();
    await d.put('meta', Date.now(), 'probe');
    if (typeof (await d.get('meta', 'probe')) !== 'number') throw new Error('read-back failed');
    let installId = await d.get('meta', 'installId');
    const count = await d.count('sessions');
    const marker = readMarker();
    let wiped = false;
    if (!installId) {
      wiped = !!(marker && marker.sessionCount > 0);
      installId = uuid();
      await d.put('meta', installId, 'installId');
    } else if (marker && marker.installId === installId && marker.sessionCount > 0 && count === 0) {
      wiped = true;
    }
    writeMarker(installId, count);
    return { ok: true, wiped, persisted, installId, lastMarker: marker };
  } catch (error) {
    return { ok: false, wiped: false, persisted, error };
  }
}
