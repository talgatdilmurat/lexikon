// util.js - DOM helpers, formatting, modal/sheet, toast, confirm
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Build an element from an HTML string (single root).
export function elFrom(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function on(root, evt, sel, handler) {
  root.addEventListener(evt, e => {
    const t = e.target.closest(sel);
    if (t && root.contains(t)) handler(e, t);
  });
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function debounce(fn, ms = 200) {
  let id;
  return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); };
}

// Local YYYY-MM-DD for streak bookkeeping.
export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Normalize a typed answer for forgiving comparison.
export function normalizeAnswer(s = '') {
  return s.toLowerCase().trim()
    .replace(/[‘’ʼ]/g, "'")
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9'\s]/g, '')
    .replace(/\s+/g, ' ');
}

// Human-readable interval from a millisecond delta (FSRS button labels).
export function formatInterval(ms) {
  const m = ms / 60000;
  if (m < 1) return '<1 min';
  if (m < 60) return `${Math.round(m)} min`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)} h`;
  const d = h / 24;
  if (d < 30) { const r = Math.max(1, Math.round(d)); return `${r} day${r > 1 ? 's' : ''}`; }
  const mo = d / 30;
  if (mo < 12) { const r = Math.round(mo); return `${r} mo`; }
  const y = Math.round((d / 365) * 10) / 10;
  return `${y} yr`;
}

// ---- toast ----
export function toast(msg, { ok = false, ms = 2200 } = {}) {
  const root = $('#toast-root') || document.body;
  const t = elFrom(`<div class="toast ${ok ? 'ok' : ''}">${escapeHtml(msg)}</div>`);
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 250);
  }, ms);
}

// ---- bottom sheet / modal ----
export function openSheet(content, { onClose } = {}) {
  const scrim = elFrom('<div class="scrim"></div>');
  const sheet = elFrom('<div class="sheet" role="dialog" aria-modal="true"></div>');
  sheet.appendChild(elFrom('<div class="grip"></div>'));
  sheet.appendChild(content);
  scrim.appendChild(sheet);
  ($('#modal-root') || document.body).appendChild(scrim);
  requestAnimationFrame(() => scrim.classList.add('show'));
  const close = () => {
    scrim.classList.remove('show');
    setTimeout(() => { scrim.remove(); onClose && onClose(); }, 260);
  };
  scrim.addEventListener('click', e => { if (e.target === scrim) close(); });
  return { close, sheet };
}

// Light confirm dialog -> Promise<boolean>
export function confirmLight(message, { okText = 'OK', cancelText = 'Cancel', danger = false } = {}) {
  return new Promise(resolve => {
    const body = elFrom(`
      <div>
        <h2>${escapeHtml(message)}</h2>
        <div class="sheet-actions">
          <button class="btn ghost" data-act="cancel">${escapeHtml(cancelText)}</button>
          <button class="btn" data-act="ok" ${danger ? 'style="background:var(--again);box-shadow:none"' : ''}>${escapeHtml(okText)}</button>
        </div>
      </div>`);
    const { close } = openSheet(body, { onClose: () => resolve(false) });
    body.querySelector('[data-act="ok"]').addEventListener('click', () => { resolve(true); close(); });
    body.querySelector('[data-act="cancel"]').addEventListener('click', () => { resolve(false); close(); });
  });
}

// A small prompt sheet with one or more fields -> Promise<values|null>
export function promptSheet({ title, sub = '', fields = [], okText = 'Save' }) {
  return new Promise(resolve => {
    const fieldHtml = fields.map(f => `
      <div class="field">
        <label for="pf-${f.name}">${escapeHtml(f.label)}</label>
        ${f.type === 'textarea'
          ? `<textarea id="pf-${f.name}" placeholder="${escapeHtml(f.placeholder || '')}">${escapeHtml(f.value || '')}</textarea>`
          : `<input id="pf-${f.name}" type="${f.type || 'text'}" placeholder="${escapeHtml(f.placeholder || '')}" value="${escapeHtml(f.value || '')}" ${f.attrs || ''}>`}
      </div>`).join('');
    const body = elFrom(`
      <div>
        <h2>${escapeHtml(title)}</h2>
        ${sub ? `<div class="sheet-sub">${escapeHtml(sub)}</div>` : ''}
        ${fieldHtml}
        <div class="sheet-actions">
          <button class="btn ghost" data-act="cancel">Cancel</button>
          <button class="btn" data-act="ok">${escapeHtml(okText)}</button>
        </div>
      </div>`);
    const { close } = openSheet(body, { onClose: () => resolve(null) });
    const collect = () => {
      const out = {};
      fields.forEach(f => { out[f.name] = body.querySelector(`#pf-${f.name}`).value.trim(); });
      return out;
    };
    body.querySelector('[data-act="ok"]').addEventListener('click', () => { const v = collect(); resolve(v); close(); });
    body.querySelector('[data-act="cancel"]').addEventListener('click', () => { resolve(null); close(); });
    setTimeout(() => { const first = body.querySelector('input,textarea'); first && first.focus(); }, 120);
  });
}

export function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
