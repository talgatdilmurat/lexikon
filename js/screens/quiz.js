// quiz.js — her private self-check. Productive recall: type / cloze / multiple-choice.
// ⚠️ Quiz NEVER touches FSRS. It only reads cards and bumps display-only seen/correct stats.
import { elFrom, escapeHtml, normalizeAnswer, toast } from '../util.js';
import * as store from '../store.js';
import { ic } from '../icons.js';
import { speak } from '../audio.js';
import * as ai from '../ai.js';

const ROUND = 10;

export const quiz = {
  id: 'quiz',
  title: () => 'Quiz',
  mount(view, ctx) {
    ctx.setMeta('');
    const cards = store.getCards();
    if (cards.length < 1) { renderNeedWords(view, ctx); return; }
    renderLanding(view, ctx, cards.length);
  },
};

function renderNeedWords(view, ctx) {
  view.innerHTML = '';
  view.appendChild(elFrom(`
    <div class="center-state">
      <div class="big">Nothing to quiz yet</div>
      <p>Save a few words first — then come back to test yourself. Nothing here changes your study schedule.</p>
      <button class="btn" data-go="decode">Open Decode</button>
    </div>`));
  view.querySelector('[data-go]').addEventListener('click', () => ctx.navigate('decode'));
}

function renderLanding(view, ctx, n) {
  const count = Math.min(ROUND, n);
  view.innerHTML = '';
  view.appendChild(elFrom(`
    <div class="center-state">
      <div class="big">Quiz yourself</div>
      <p>${count} quick question${count === 1 ? '' : 's'} from your own words. This is just practice — it won't change your study schedule.</p>
      <button class="btn" data-act="start">Start quiz</button>
    </div>`));
  view.querySelector('[data-act="start"]').addEventListener('click', () => startRound(view, ctx));
}

// ---------- round construction ----------
function sample(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

function pickType(card, poolSize) {
  const canMC = poolSize >= 4;
  if (card.type === 'phrase') return (canMC && Math.random() < 0.4) ? 'mc' : 'cloze';
  // words: mostly type (real production), some MC for variety
  return (canMC && Math.random() < 0.34) ? 'mc' : 'type';
}

function startRound(view, ctx) {
  const cards = store.getCards();
  const chosen = sample(cards, Math.min(ROUND, cards.length));
  const items = chosen.map(card => ({ card, type: pickType(card, cards.length) }));
  const state = { items, i: 0, score: 0, pool: cards };
  renderQuestion(view, ctx, state);
}

// ---------- rendering ----------
function header(state) {
  const pct = (state.i / state.items.length) * 100;
  return `<div class="quiz-progress"><i style="width:${pct}%"></i></div>`;
}

function renderQuestion(view, ctx, state) {
  const item = state.items[state.i];
  if (!item) { renderResults(view, ctx, state); return; }
  if (item.type === 'cloze') return renderCloze(view, ctx, state, item);
  if (item.type === 'mc') return renderMC(view, ctx, state, item);
  return renderType(view, ctx, state, item);
}

// type-the-word: prompt is the meaning (TR preferred), she types the English term
function renderType(view, ctx, state, item) {
  const c = item.card;
  const prompt = c.turkish || c.english || '—';
  const isTr = !!c.turkish;
  view.innerHTML = '';
  const wrap = elFrom(`
    <div>
      ${header(state)}
      <div class="eyebrow q-prompt-lbl">Type the English ${c.type === 'phrase' ? 'phrase' : 'word'}</div>
      <div class="q-card">
        <div class="q-prompt ${isTr ? 'tr' : ''}">${escapeHtml(prompt)}</div>
        <div class="q-hint">${isTr ? 'Turkish meaning' : 'English meaning'}</div>
        <input class="q-input" type="text" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="type here">
      </div>
      <div class="q-foot"><button class="btn" data-act="check">Check</button></div>
    </div>`);
  view.appendChild(wrap);
  const input = wrap.querySelector('.q-input');
  setTimeout(() => input.focus(), 80);
  const submit = () => {
    const ok = normalizeAnswer(input.value) === normalizeAnswer(c.term) && input.value.trim() !== '';
    showFeedback(view, ctx, state, item, ok);
  };
  wrap.querySelector('[data-act="check"]').addEventListener('click', submit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

// cloze: a sentence with the term blanked
async function renderCloze(view, ctx, state, item) {
  const c = item.card;
  view.innerHTML = '';
  view.appendChild(elFrom(`<div>${header(state)}
    <div class="eyebrow q-prompt-lbl">Fill in the blank</div>
    <div class="q-card"><div class="loading-rows"><div class="skl"></div><div class="skl" style="width:70%"></div></div></div></div>`));

  let sentence = item.sentence;
  if (!sentence) { sentence = await buildClozeSentence(c); item.sentence = sentence; }
  if (!sentence) { // no usable sentence → fall back
    item.type = (state.pool.length >= 4) ? 'mc' : 'type';
    return renderQuestion(view, ctx, state);
  }
  const { html } = blankOut(sentence, c.term);
  view.innerHTML = '';
  const wrap = elFrom(`
    <div>
      ${header(state)}
      <div class="eyebrow q-prompt-lbl">Fill in the blank</div>
      <div class="q-card">
        <div class="q-prompt">${html}</div>
        ${c.turkish ? `<div class="q-hint">${escapeHtml(c.turkish)}</div>` : ''}
        <input class="q-input" type="text" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="type the missing ${c.type === 'phrase' ? 'phrase' : 'word'}">
      </div>
      <div class="q-foot"><button class="btn" data-act="check">Check</button></div>
    </div>`);
  view.appendChild(wrap);
  const input = wrap.querySelector('.q-input');
  setTimeout(() => input.focus(), 80);
  const submit = () => {
    const ok = normalizeAnswer(input.value) === normalizeAnswer(c.term) && input.value.trim() !== '';
    showFeedback(view, ctx, state, item, ok);
  };
  wrap.querySelector('[data-act="check"]').addEventListener('click', submit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

// multiple choice: term → pick its Turkish meaning (or reverse)
function renderMC(view, ctx, state, item) {
  const c = item.card;
  const trMode = Math.random() < 0.5 && !!c.turkish; // prompt EN term → pick TR
  const field = trMode ? 'turkish' : 'english';
  const answer = c[field] || c.english || c.turkish;
  const distractors = sample(state.pool.filter(x => x.id !== c.id && (x[field] || '').trim() && x[field] !== answer), 3)
    .map(x => x[field]);
  if (distractors.length < 3) { item.type = 'type'; return renderQuestion(view, ctx, state); }
  const options = sample([answer, ...distractors], 4);
  view.innerHTML = '';
  const wrap = elFrom(`
    <div>
      ${header(state)}
      <div class="eyebrow q-prompt-lbl">Choose the ${trMode ? 'Turkish' : 'English'} meaning</div>
      <div class="q-card">
        <div class="q-prompt">${escapeHtml(c.term)}</div>
        <div class="q-options">
          ${options.map(o => `<button class="q-opt" data-opt="${escapeHtml(o)}">${escapeHtml(o)}</button>`).join('')}
        </div>
      </div>
    </div>`);
  view.appendChild(wrap);
  wrap.querySelectorAll('.q-opt').forEach(btn => btn.addEventListener('click', () => {
    const ok = btn.dataset.opt === answer;
    wrap.querySelectorAll('.q-opt').forEach(b => {
      b.disabled = true;
      if (b.dataset.opt === answer) b.classList.add('correct');
      else if (b === btn) b.classList.add('wrong');
    });
    showFeedback(view, ctx, state, item, ok, { inline: true });
  }));
}

// ---------- feedback + results ----------
function showFeedback(view, ctx, state, item, ok, { inline = false } = {}) {
  const c = item.card;
  if (ok) state.score++;
  store.bumpStats(c.id, ok);            // display-only stats; NOT fsrs
  store.touchStreak();

  const fb = elFrom(`
    <div class="q-feedback">
      <div class="q-verdict ${ok ? 'ok' : 'no'}">${ok ? ic.check + ' Correct' : ic.x + ' Not quite'}</div>
      <div class="q-answer">
        <div class="defrow"><span class="lang en">EN</span><span class="meaning" style="font-size:17px">${escapeHtml(c.term)}${c.english ? ' — ' + escapeHtml(c.english) : ''}</span>
          <button class="speak xs" data-speak aria-label="Play" style="margin-left:auto">${ic.speakerSm}</button></div>
        ${c.turkish ? `<div class="defrow"><span class="lang tr">TR</span><span class="meaning tr" style="font-size:17px">${escapeHtml(c.turkish)}</span></div>` : ''}
      </div>
      <div class="q-foot"><button class="btn" data-act="next">${state.i + 1 < state.items.length ? 'Next' : 'See results'}</button></div>
    </div>`);

  // disable the active input/buttons
  view.querySelectorAll('.q-input, [data-act="check"]').forEach(e => e.setAttribute('disabled', ''));
  view.querySelector('.q-card').appendChild(fb);
  fb.querySelector('[data-speak]').addEventListener('click', e => speak(c.term, e.currentTarget));
  const next = fb.querySelector('[data-act="next"]');
  next.addEventListener('click', () => { state.i++; renderQuestion(view, ctx, state); });
  setTimeout(() => next.focus(), 60);
  if (fb.scrollIntoView) fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderResults(view, ctx, state) {
  const total = state.items.length;
  const pct = Math.round((state.score / total) * 100);
  const line = pct >= 90 ? 'Excellent.' : pct >= 70 ? 'Solid work.' : pct >= 40 ? 'Good practice — keep at it.' : 'Practice makes it stick.';
  view.innerHTML = '';
  view.appendChild(elFrom(`
    <div class="center-state q-results">
      <div class="score">${state.score}<small>/${total}</small></div>
      <div class="big" style="font-size:22px">${line}</div>
      <p>Your study schedule is untouched — quizzing is just for practice.</p>
      <button class="btn" data-act="again">Quiz again</button>
      <button class="btn subtle" data-go="study">Back to study</button>
    </div>`));
  view.querySelector('[data-act="again"]').addEventListener('click', () => startRound(view, ctx));
  view.querySelector('[data-go="study"]').addEventListener('click', () => ctx.navigate('study'));
}

// ---------- cloze helpers ----------
function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function containsTerm(sentence, term) { return new RegExp(escapeRegExp(term), 'i').test(sentence); }

const straighten = s => String(s).replace(/[‘’ʼ]/g, "'");

async function buildClozeSentence(card) {
  if (ai.hasKey()) {
    try { const s = straighten(await ai.clozeSentence(card.term)); if (s && containsTerm(s, card.term)) return s; } catch {}
  }
  if (card.example && card.example.en) {
    const ex = straighten(card.example.en);
    if (containsTerm(ex, card.term)) return ex;
  }
  return null;
}

// Blank the term out, escaping the surrounding text parts separately so the
// regex still matches the raw sentence (escaping first would break it).
function blankOut(sentence, term) {
  const re = new RegExp(escapeRegExp(straighten(term)), 'i');
  const m = sentence.match(re);
  if (!m) return { html: escapeHtml(sentence) };
  const before = sentence.slice(0, m.index);
  const after = sentence.slice(m.index + m[0].length);
  const blank = '_'.repeat(Math.max(4, Math.min(12, term.length)));
  return { html: escapeHtml(before) + `<span class="blank">${blank}</span>` + escapeHtml(after) };
}
