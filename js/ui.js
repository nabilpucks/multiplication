// Small DOM helpers shared by views.
import '../vendor/number-flow.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Set a <number-flow> value; null shows an em dash. */
export function flow(el, value, format) {
  if (!el) return;
  if (format) el.format = format;
  let dash = el.nextElementSibling?.classList.contains('nf-dash') ? el.nextElementSibling : null;
  const empty = value == null || Number.isNaN(value);
  if (empty && !dash) { dash = document.createElement('span'); dash.className = 'nf-dash'; dash.textContent = '—'; el.after(dash); }
  if (dash) dash.hidden = !empty;
  el.hidden = empty;
  if (!empty) el.update(value);
}

export const secs = (ms, d = 1) => (ms == null ? '—' : (ms / 1000).toFixed(d) + 's');

let toastTimer;
export function toast(msg, ms = 4200) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  t.animate?.([{ opacity: 0, transform: 'translate(-50%, 8px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: reducedMotion() ? 0 : 260, easing: 'ease-out' });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/** In-app confirm dialog (avoids blocking browser dialogs). Resolves true/false. */
export function confirmDialog({ title, body, ok = 'OK', cancel = 'Cancel', danger = true }) {
  const layer = $('#modal');
  $('#modal-title').textContent = title;
  $('#modal-body').textContent = body;
  const okBtn = $('#modal-ok'), cancelBtn = $('#modal-cancel');
  okBtn.textContent = ok; cancelBtn.textContent = cancel;
  okBtn.className = danger ? 'btn danger' : 'btn primary';
  layer.hidden = false;
  okBtn.focus();
  return new Promise((resolve) => {
    const done = (v) => {
      layer.hidden = true;
      okBtn.onclick = cancelBtn.onclick = null;
      document.removeEventListener('keydown', onKey, true);
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(true); }
      else e.stopPropagation();
    };
    okBtn.onclick = () => done(true);
    cancelBtn.onclick = () => done(false);
    document.addEventListener('keydown', onKey, true);
  });
}

// ---- tooltip ----
const tip = () => $('#tooltip');
export function showTip(html, x, y) {
  const t = tip();
  t.innerHTML = html;
  t.hidden = false;
  const r = t.getBoundingClientRect();
  let left = x + 14, top = y + 14;
  if (left + r.width > innerWidth - 8) left = x - r.width - 14;
  if (top + r.height > innerHeight - 8) top = y - r.height - 14;
  t.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
  t.style.left = '0'; t.style.top = '0';
}
export const hideTip = () => { tip().hidden = true; };

/** Delegate hover tooltips: elements with data-tip get their tooltip from getHtml(el). */
export function tipOn(root, getHtml) {
  root.addEventListener('pointermove', (e) => {
    const el = e.target.closest('[data-tip]');
    if (!el || !root.contains(el)) return hideTip();
    showTip(getHtml(el), e.clientX, e.clientY);
  });
  root.addEventListener('pointerleave', hideTip);
}
