// hazine.js — her word collection: list, search, detail, add/edit/delete, backup.
import { $, $$, elFrom, escapeHtml, on, toast, openSheet, confirmLight, debounce } from '../util.js';
import * as store from '../store.js';
import { statusOf, learnedCount } from '../scheduler.js';
import { ic } from '../icons.js';
import { speak } from '../audio.js';
import * as ai from '../ai.js';

let query = '';

export const hazine = {
  id: 'hazine',
  title: () => 'Hazine',
  mount(view, ctx) {
    ctx.setMeta(`<button class="iconbtn" data-add aria-label="Add a word">${ic.plus}</button>`);
    const metaBtn = $('#screen-meta [data-add]');
    if (metaBtn) metaBtn.addEventListener('click', () => openCardForm({ ctx, onSaved: () => render(view, ctx) }));
    render(view, ctx);
  },
};

function render(view, ctx) {
  const cards = store.getCards();
  const learned = learnedCount(cards);
  view.innerHTML = '';
  view.appendChild(elFrom(`
    <div>
      <div class="deck-prog"><b>${cards.length}</b> ${cards.length === 1 ? 'word' : 'words'} · <b>${learned}</b> learned</div>
      <div class="search">${ic.search}<input type="search" placeholder="Search" value="${escapeHtml(query)}" autocapitalize="off" autocomplete="off"></div>
      <div class="list" id="hz-list"></div>
    </div>`));
  view.appendChild(elFrom(`
    <div class="hazine-foot">
      <button data-act="build">Build a deck</button>
      <button data-act="export">Export deck</button>
      <button data-act="import">Import</button>
      <button data-act="key">${store.hasApiKey() ? 'Change API key' : 'Add API key'}</button>
    </div>`));

  view.querySelector('[data-act="build"]').addEventListener('click', () => buildDeckFlow(view, ctx));

  const input = view.querySelector('.search input');
  input.addEventListener('input', debounce(e => { query = e.target.value; paintList(view, ctx); }, 120));

  view.querySelector('[data-act="export"]').addEventListener('click', () => {
    if (store.getCards().length === 0) return toast('Nothing to export yet.');
    store.exportDeck(); toast('Backup downloaded.', { ok: true });
  });
  view.querySelector('[data-act="import"]').addEventListener('click', () => importFlow(view, ctx));
  view.querySelector('[data-act="key"]').addEventListener('click', async () => {
    await ai.promptForKey(); render(view, ctx);
  });

  on(view.querySelector('#hz-list'), 'click', '.row', (e, row) => openDetail(row.dataset.id, view, ctx));
  paintList(view, ctx);
}

function paintList(view, ctx) {
  const list = view.querySelector('#hz-list');
  let cards = store.getCards().slice().sort((a, b) => b.createdAt - a.createdAt);
  const q = query.trim().toLowerCase();
  if (q) cards = cards.filter(c =>
    c.term.toLowerCase().includes(q) ||
    (c.turkish || '').toLowerCase().includes(q) ||
    (c.english || '').toLowerCase().includes(q));

  if (cards.length === 0) {
    list.innerHTML = `<div class="center-state" style="min-height:240px">
      <p>${store.getCards().length === 0 ? "No words yet — paste something into Decode, or add a word." : 'No matches.'}</p>
      ${store.getCards().length === 0 ? '<button class="btn" data-go="decode">Open Decode</button>' : ''}</div>`;
    const g = list.querySelector('[data-go]');
    if (g) g.addEventListener('click', () => ctx.navigate('decode'));
    return;
  }
  list.innerHTML = cards.map(c => {
    const st = statusOf(c);
    return `<button class="row" data-id="${c.id}">
      <div>
        <div class="term"><span class="word">${escapeHtml(c.term)}</span>${c.type === 'phrase' ? '<span class="ph">phrase</span>' : ''}</div>
        ${c.turkish ? `<div class="gloss">${escapeHtml(c.turkish)}</div>` : ''}
      </div>
      <span class="status st-${st}" aria-label="${st}"></span>
    </button>`;
  }).join('');
}

// ---------- detail ----------
function openDetail(id, view, ctx) {
  const card = store.getCard(id);
  if (!card) return;
  const pron = [card.pos ? `<span class="pos">${escapeHtml(card.pos)}</span>` : '',
                card.respelling ? `<span class="say">${escapeHtml(card.respelling)}</span>` : ''].filter(Boolean).join(' · ');
  const exLabel = card.example && card.example.source === 'decode' ? 'Where you saw it' : 'Example';
  const body = elFrom(`
    <div class="detail">
      <div class="back-head" style="border:none;padding-bottom:6px">
        <span class="headword">${escapeHtml(card.term)}</span>
        <button class="speak sm" data-speak-term aria-label="Play">${ic.speakerSm}</button>
      </div>
      ${pron ? `<div class="pron" style="margin-top:0">${pron}</div>` : ''}
      <div class="defs" style="margin-top:16px">
        ${card.english ? `<div class="defrow"><span class="lang en">EN</span><span class="meaning">${escapeHtml(card.english)}</span></div>` : ''}
        ${card.turkish ? `<div class="defrow"><span class="lang tr">TR</span><span class="meaning tr">${escapeHtml(card.turkish)}</span></div>` : ''}
      </div>
      ${(card.senses || []).map(s => `<div class="defs" style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--line)">
        ${s.english ? `<div class="defrow"><span class="lang en">EN</span><span class="meaning">${escapeHtml(s.english)}</span></div>` : ''}
        ${s.turkish ? `<div class="defrow"><span class="lang tr">TR</span><span class="meaning tr">${escapeHtml(s.turkish)}</span></div>` : ''}</div>`).join('')}
      ${card.example && card.example.en ? `<div class="example"><div class="eyebrow">${exLabel}</div>
        <div class="ex-row"><p>${escapeHtml(card.example.en)}</p>
        <button class="speak xs" data-speak-ex aria-label="Play example">${ic.speakerSm}</button></div></div>` : ''}
      <div class="detail-actions">
        <button class="btn ghost" data-act="edit">Edit</button>
        <button class="btn ghost danger" data-act="delete">Delete</button>
      </div>
    </div>`);
  const { close } = openSheet(body);
  body.querySelector('[data-speak-term]').addEventListener('click', e => speak(card.term, e.currentTarget));
  const exb = body.querySelector('[data-speak-ex]');
  if (exb) exb.addEventListener('click', e => speak(card.example.en, e.currentTarget));
  body.querySelector('[data-act="edit"]').addEventListener('click', () => {
    close(); openCardForm({ ctx, card, onSaved: () => render(view, ctx) });
  });
  body.querySelector('[data-act="delete"]').addEventListener('click', async () => {
    const ok = await confirmLight(`Delete “${card.term}”?`, { okText: 'Delete', danger: true });
    if (ok) { store.deleteCard(card.id); close(); render(view, ctx); toast('Deleted.'); }
  });
}

// ---------- add / edit form ----------
function openCardForm({ ctx, card = null, onSaved }) {
  const c = card || { term: '', type: 'word', pos: '', respelling: '', english: '', turkish: '', example: null };
  const body = elFrom(`
    <div>
      <h2>${card ? 'Edit card' : 'Add a word'}</h2>
      <div class="field"><label for="f-term">Word or phrase</label>
        <input id="f-term" value="${escapeHtml(c.term)}" placeholder="e.g. reluctant, hash it out" autocapitalize="off"></div>
      ${card ? '' : '<button class="btn ghost" data-act="ai" style="margin-bottom:14px">' + ic.spark + ' Auto-fill with AI</button>'}
      <div class="field row2">
        <div><label for="f-type">Type</label>
          <select id="f-type"><option value="word"${c.type !== 'phrase' ? ' selected' : ''}>word</option><option value="phrase"${c.type === 'phrase' ? ' selected' : ''}>phrase</option></select></div>
        <div><label for="f-pos">Part of speech</label><input id="f-pos" value="${escapeHtml(c.pos)}" placeholder="adjective"></div>
      </div>
      <div class="field"><label for="f-resp">Pronunciation (respelling)</label>
        <input id="f-resp" value="${escapeHtml(c.respelling)}" placeholder="ri-LUHK-tuhnt" autocapitalize="off"></div>
      <div class="field"><label for="f-en">English meaning</label><input id="f-en" value="${escapeHtml(c.english)}" placeholder="simple meaning"></div>
      <div class="field"><label for="f-tr">Turkish meaning</label><input id="f-tr" value="${escapeHtml(c.turkish)}" placeholder="anlamı" lang="tr"></div>
      <div class="field"><label for="f-ex">Example sentence</label><textarea id="f-ex" placeholder="optional">${escapeHtml(c.example && c.example.en ? c.example.en : '')}</textarea></div>
      <div class="sheet-actions">
        <button class="btn ghost" data-act="cancel">Cancel</button>
        <button class="btn" data-act="save">${card ? 'Save' : 'Add card'}</button>
      </div>
    </div>`);
  const { close } = openSheet(body);
  const val = id => body.querySelector(id).value.trim();

  const aiBtn = body.querySelector('[data-act="ai"]');
  if (aiBtn) aiBtn.addEventListener('click', async () => {
    const term = val('#f-term');
    if (!term) return toast('Type a word first.');
    if (!(await ai.ensureKey())) return;
    const orig = aiBtn.innerHTML;
    aiBtn.innerHTML = '<span class="spinner"></span> Filling…'; aiBtn.disabled = true;
    try {
      const [info, sents] = await Promise.all([ai.autofillCard(term), ai.exampleSentences(term).catch(() => [])]);
      body.querySelector('#f-type').value = info.type;
      body.querySelector('#f-pos').value = info.pos;
      body.querySelector('#f-resp').value = info.respelling;
      body.querySelector('#f-en').value = info.english;
      body.querySelector('#f-tr').value = info.turkish;
      if (sents[0] && !val('#f-ex')) body.querySelector('#f-ex').value = sents[0].en;
      toast('Filled in.', { ok: true });
    } catch (e) {
      toast(e.kind === 'auth' ? 'Key rejected — check it in Hazine.' : (e.message || 'AI error.'));
    } finally { aiBtn.innerHTML = orig; aiBtn.disabled = false; }
  });

  body.querySelector('[data-act="cancel"]').addEventListener('click', close);
  body.querySelector('[data-act="save"]').addEventListener('click', () => {
    const term = val('#f-term');
    if (!term) return toast('A word or phrase is required.');
    const ex = val('#f-ex');
    const data = {
      term, type: body.querySelector('#f-type').value,
      pos: val('#f-pos'), respelling: val('#f-resp'),
      english: val('#f-en'), turkish: val('#f-tr'),
      example: ex ? { en: ex, source: (card && card.example && card.example.source) || 'manual' } : null,
    };
    if (card) {
      store.updateCard(card.id, data);
      toast('Saved.', { ok: true });
    } else {
      const { created } = store.addCard(data);
      toast(created ? 'Card added.' : 'Already in your deck.', { ok: created });
    }
    close(); onSaved && onSaved();
  });
}

// ---------- build a deck (batch) ----------
function buildDeckFlow(view, ctx) {
  const body = elFrom(`
    <div>
      <h2>Build a deck</h2>
      <div class="sheet-sub">Paste words or phrases, one per line. The AI fills in each card in one pass.</div>
      <div class="field"><textarea id="bd-list" style="min-height:140px" placeholder="reluctant&#10;hash it out&#10;look forward to&#10;candid"></textarea></div>
      <div id="bd-note" class="sheet-sub" style="color:var(--hard);display:none"></div>
      <div class="sheet-actions">
        <button class="btn ghost" data-act="cancel">Cancel</button>
        <button class="btn" data-act="build">Build cards</button>
      </div>
    </div>`);
  const { close } = openSheet(body);
  const ta = body.querySelector('#bd-list');
  const note = body.querySelector('#bd-note');
  const lines = () => ta.value.split('\n').map(s => s.trim()).filter(Boolean);
  ta.addEventListener('input', () => {
    const n = lines().length;
    if (n > 10) { note.style.display = 'block'; note.textContent = `That's ${n} at once — adding a lot can pile up. 5–10 a day tends to stick best (you can still build them all).`; }
    else note.style.display = 'none';
  });

  body.querySelector('[data-act="cancel"]').addEventListener('click', close);
  body.querySelector('[data-act="build"]').addEventListener('click', async () => {
    const all = [...new Set(lines().map(s => s.toLowerCase()))].map(lc => lines().find(l => l.toLowerCase() === lc));
    const terms = all.filter(t => !store.findByTerm(t));
    if (terms.length === 0) return toast('Nothing new to build.');
    if (!(await ai.ensureKey())) return;

    const btn = body.querySelector('[data-act="build"]');
    btn.disabled = true;
    let built = 0;
    for (let i = 0; i < terms.length; i++) {
      btn.innerHTML = `<span class="spinner"></span> Building ${i + 1}/${terms.length}…`;
      const term = terms[i];
      try {
        const info = await ai.autofillCard(term);
        let example = null;
        try { const s = await ai.exampleSentences(term); if (s[0]) example = { en: s[0].en, source: 'ai' }; } catch {}
        store.addCard({ term, ...info, example });
        built++;
      } catch (e) {
        if (e.kind === 'auth') { toast('Key rejected — stopped.'); break; }
        // skip a failed term and keep going
      }
    }
    close();
    render(view, ctx);
    toast(`Built ${built} card${built === 1 ? '' : 's'}.`, { ok: built > 0 });
  });
}

// ---------- import ----------
function importFlow(view, ctx) {
  const input = elFrom('<input type="file" accept="application/json,.json" style="display:none">');
  document.body.appendChild(input);
  input.addEventListener('change', () => {
    const file = input.files[0]; input.remove();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { added, skipped } = store.importDeck(reader.result);
        toast(`Imported ${added} new${skipped ? `, skipped ${skipped}` : ''}.`, { ok: true });
        render(view, ctx);
      } catch (e) { toast(e.message || 'Import failed.'); }
    };
    reader.readAsText(file);
  });
  input.click();
}
