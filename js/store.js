// store.js — localStorage persistence for cards, settings (API key), and meta (streak).
import { uid, todayStr } from './util.js';
import { freshFsrs } from './scheduler.js';

const K = { cards: 'lexikon:cards', settings: 'lexikon:settings', meta: 'lexikon:meta' };

function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch (e) { console.warn('storage write failed', e); return false; }
}

// ---------- cards ----------
export function getCards() {
  const arr = read(K.cards, []);
  return Array.isArray(arr) ? arr : [];
}
export function saveCards(cards) { write(K.cards, cards); }
export function getCard(id) { return getCards().find(c => c.id === id) || null; }

export function findByTerm(term) {
  const t = term.trim().toLowerCase();
  return getCards().find(c => c.term.trim().toLowerCase() === t) || null;
}

// Create a card from a partial. Returns { card, created:boolean }.
export function addCard(data) {
  const cards = getCards();
  const term = (data.term || '').trim();
  if (!term) throw new Error('A term is required.');
  const existing = cards.find(c => c.term.trim().toLowerCase() === term.toLowerCase());
  if (existing) return { card: existing, created: false };

  const card = {
    id: uid(),
    term,
    type: data.type === 'phrase' ? 'phrase' : (/\s/.test(term) ? 'phrase' : 'word'),
    pos: data.pos || (data.type === 'phrase' ? 'phrase' : ''),
    respelling: data.respelling || '',
    english: data.english || '',
    turkish: data.turkish || '',
    example: data.example && data.example.en
      ? { en: data.example.en, source: data.example.source || 'manual' }
      : null,
    senses: Array.isArray(data.senses) ? data.senses : [],
    fsrs: freshFsrs(),
    createdAt: Date.now(),
    seen: 0,
    correct: 0,
  };
  cards.push(card);
  saveCards(cards);
  return { card, created: true };
}

export function updateCard(id, patch) {
  const cards = getCards();
  const i = cards.findIndex(c => c.id === id);
  if (i < 0) return null;
  cards[i] = { ...cards[i], ...patch };
  saveCards(cards);
  return cards[i];
}

// Quiz-only stat bump. Never touches fsrs.
export function bumpStats(id, correct) {
  const cards = getCards();
  const i = cards.findIndex(c => c.id === id);
  if (i < 0) return;
  cards[i].seen = (cards[i].seen || 0) + 1;
  if (correct) cards[i].correct = (cards[i].correct || 0) + 1;
  saveCards(cards);
}

export function deleteCard(id) {
  saveCards(getCards().filter(c => c.id !== id));
}

// ---------- settings (API key etc.) ----------
export function getSettings() { return read(K.settings, {}); }
export function getSetting(k, d = null) { const s = getSettings(); return k in s ? s[k] : d; }
export function setSetting(k, v) { const s = getSettings(); s[k] = v; write(K.settings, s); }
export function getApiKey() { return getSetting('apiKey', '') || ''; }
export function setApiKey(v) { setSetting('apiKey', (v || '').trim()); }
export function hasApiKey() { return !!getApiKey(); }

// ---------- meta (streak) ----------
export function getMeta() { return read(K.meta, { streak: 0, lastActive: null }); }
function setMeta(m) { write(K.meta, m); }

// Call on any study/quiz activity. Returns the current streak count.
export function touchStreak() {
  const m = getMeta();
  const today = todayStr();
  if (m.lastActive === today) return m.streak;
  const y = new Date(); y.setDate(y.getDate() - 1);
  m.streak = (m.lastActive === todayStr(y)) ? (m.streak || 0) + 1 : 1;
  m.lastActive = today;
  setMeta(m);
  return m.streak;
}
export function currentStreak() {
  const m = getMeta();
  if (!m.lastActive) return 0;
  const today = todayStr();
  const y = new Date(); y.setDate(y.getDate() - 1);
  // streak is "alive" only if active today or yesterday
  return (m.lastActive === today || m.lastActive === todayStr(y)) ? (m.streak || 0) : 0;
}

// ---------- export / import ----------
export function exportDeck() {
  const payload = {
    app: 'lexikon', version: 1, exportedAt: new Date().toISOString(),
    cards: getCards(), meta: getMeta(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lexikon-backup-${todayStr()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Merge imported cards (non-destructive: adds cards whose term is new).
// Returns { added, skipped }.
export function importDeck(json) {
  let data;
  try { data = typeof json === 'string' ? JSON.parse(json) : json; }
  catch { throw new Error('That file isn’t valid JSON.'); }
  const incoming = Array.isArray(data) ? data : (data.cards || []);
  if (!Array.isArray(incoming)) throw new Error('No cards found in that file.');

  const cards = getCards();
  const have = new Set(cards.map(c => c.term.trim().toLowerCase()));
  let added = 0, skipped = 0;
  for (const raw of incoming) {
    if (!raw || !raw.term) { skipped++; continue; }
    const key = raw.term.trim().toLowerCase();
    if (have.has(key)) { skipped++; continue; }
    have.add(key);
    cards.push({
      id: raw.id || uid(),
      term: raw.term,
      type: raw.type === 'phrase' ? 'phrase' : 'word',
      pos: raw.pos || '',
      respelling: raw.respelling || '',
      english: raw.english || '',
      turkish: raw.turkish || '',
      example: raw.example && raw.example.en ? { en: raw.example.en, source: raw.example.source || 'ai' } : null,
      senses: Array.isArray(raw.senses) ? raw.senses : [],
      fsrs: raw.fsrs && raw.fsrs.due ? raw.fsrs : freshFsrs(),
      createdAt: raw.createdAt || Date.now(),
      seen: raw.seen || 0,
      correct: raw.correct || 0,
    });
    added++;
  }
  saveCards(cards);
  return { added, skipped };
}
