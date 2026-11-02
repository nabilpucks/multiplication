// In-memory cache of all sessions plus derived data, kept in sync with IndexedDB.
import * as DB from './db.js';
import { buildDays } from './sessions.js';
import { computeAnalysis } from './analysis-logic.js';

const state = { sessions: [], byId: new Map(), installId: null, version: 0, _days: null, _analysis: null, _dv: -1, _av: -1 };
const listeners = new Set();

export const store = {
  get sessions() { return state.sessions; },
  get version() { return state.version; },
  setInstallId(id) { state.installId = id; },
  async load() {
    const list = await DB.getAllSessions();
    state.sessions = list;
    state.byId = new Map(list.map((s) => [s.id, s]));
    bump();
  },
  get(id) { return state.byId.get(id); },
  days() {
    if (state._dv !== state.version) { state._days = buildDays(state.sessions); state._dv = state.version; }
    return state._days;
  },
  analysis() {
    if (state._av !== state.version) { state._analysis = computeAnalysis(state.sessions); state._av = state.version; }
    return state._analysis;
  },
  /** Save (insert or update) one session. Called after every question. */
  async save(session, { quiet = false } = {}) {
    if (!state.byId.has(session.id)) { state.sessions.push(session); state.byId.set(session.id, session); }
    else if (state.byId.get(session.id) !== session) {
      const i = state.sessions.findIndex((s) => s.id === session.id);
      state.sessions[i] = session; state.byId.set(session.id, session);
    }
    await DB.putSession(session);
    if (state.installId) DB.writeMarker(state.installId, state.sessions.length);
    if (!quiet) bump();
  },
  async addMany(list) {
    await DB.addSessions(list);
    for (const s of list) { state.sessions.push(s); state.byId.set(s.id, s); }
    if (state.installId) DB.writeMarker(state.installId, state.sessions.length);
    bump();
  },
  async remove(id) {
    if (!state.byId.has(id)) return;
    state.byId.delete(id);
    state.sessions = state.sessions.filter((s) => s.id !== id);
    await DB.deleteSession(id);
    if (state.installId) DB.writeMarker(state.installId, state.sessions.length);
    bump();
  },
  touch() { bump(); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

function bump() { state.version++; for (const fn of listeners) fn(); }
