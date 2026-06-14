// study.js — the flashcard (flip) + FSRS rating. Only Study writes the schedule.
import { $, elFrom, escapeHtml, toast } from '../util.js';
import * as store from '../store.js';
import { preview, rate, dueCards, soonest } from '../scheduler.js';
import { ic } from '../icons.js';
import { speak } from '../audio.js';

export const study = {
  id: 'study',
  title: () => 'Study',
  mount(view, ctx) {
    const cards = store.getCards();
    const due = dueCards(cards);
    setMeta(ctx, due.length);

    if (cards.length === 0) { renderEmpty(view, ctx); return; }
    if (due.length === 0) { renderCaughtUp(view, ctx); return; }
    renderLanding(view, ctx, due.length);
  },
};

function setMeta(ctx, dueCount) {
  const streak = store.currentStreak();
  const streakHtml = streak > 0 ? `<span class="streak">${ic.flame}${streak}</span>` : '';
  ctx.setMeta(`${streakHtml}<span><b>${dueCount}</b> due today</span>`);
}

function renderEmpty(view, ctx) {
  view.innerHTML = '';
  view.appendChild(elFrom(`
    <div class="center-state">
      <div class="big">No words <b>yet</b></div>
      <p>Paste something into Decode, or add a word in Hazine, and it'll show up here to study.</p>
      <button class="btn" data-go="decode">Open Decode</button>
      <button class="btn subtle" data-go="hazine">Add a word</button>
    </div>`));
  view.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => ctx.navigate(b.dataset.go)));
}

function renderCaughtUp(view, ctx) {
  view.innerHTML = '';
  const ahead = soonest(store.getCards(), 12);
  view.appendChild(elFrom(`
    <div class="center-state">
      <div class="big">All caught up</div>
      <p>Nothing's due right now. You can review a few ahead of time if you like.</p>
      ${ahead.length ? '<button class="btn ghost" data-act="ahead">Review ahead</button>' : ''}
    </div>`));
  const b = view.querySelector('[data-act="ahead"]');
  if (b) b.addEventListener('click', () => startSession(view, ctx, ahead));
}

function renderLanding(view, ctx, count) {
  view.innerHTML = '';
  view.appendChild(elFrom(`
    <div class="center-state">
      <div class="big"><b>${count}</b> ${count === 1 ? 'card' : 'cards'} due</div>
      <p>A few minutes is plenty. Rate each card honestly — that's what tunes your schedule.</p>
      <button class="btn" data-act="start">Start studying</button>
    </div>`));
  view.querySelector('[data-act="start"]').addEventListener('click', () => {
    startSession(view, ctx, dueCards(store.getCards()));
  });
}

function startSession(view, ctx, queue) {
  const state = { queue, i: 0, reviewed: 0 };
  renderCardStage(view, ctx, state);
}

function cardFaces(card) {
  const long = card.term.length > 14;
  const pron = [card.pos ? `<span class="pos">${escapeHtml(card.pos)}</span>` : '',
                card.respelling ? `<span class="say">${escapeHtml(card.respelling)}</span>` : '']
                .filter(Boolean).join(' · ');
  const ex = card.example && card.example.en
    ? `<div class="example"><div class="eyebrow">Example</div>
         <div class="ex-row"><p>${escapeHtml(card.example.en)}</p>
           <button class="speak xs" data-speak="example" aria-label="Play example">${ic.speakerSm}</button></div></div>`
    : '';
  return `
    <div class="flip-inner">
      <div class="face front"><div class="front-c">
        <div class="headword ${long ? 'long' : ''}">${escapeHtml(card.term)}</div>
        ${pron ? `<div class="pron">${pron}</div>` : ''}
        <button class="speak" data-speak="term" aria-label="Play pronunciation">${ic.speaker}</button>
      </div></div>
      <div class="face back"><div class="back-scroll">
        <div class="back-head"><span class="w">${escapeHtml(card.term)}</span>
          <button class="speak sm" data-speak="term" aria-label="Play pronunciation">${ic.speakerSm}</button></div>
        <div class="defs">
          ${card.english ? `<div class="defrow"><span class="lang en">EN</span><span class="meaning">${escapeHtml(card.english)}</span></div>` : ''}
          ${card.turkish ? `<div class="defrow"><span class="lang tr">TR</span><span class="meaning tr">${escapeHtml(card.turkish)}</span></div>` : ''}
        </div>
        ${ex}
      </div></div>
    </div>`;
}

function renderCardStage(view, ctx, state) {
  const card = state.queue[state.i];
  if (!card) { renderComplete(view, ctx, state); return; }
  const p = preview(card);
  view.innerHTML = '';
  const stage = elFrom(`
    <div style="flex:1; display:flex; flex-direction:column;">
      <div class="study-stage">
        <div class="flip" role="button" tabindex="0" aria-label="Flip card">${cardFaces(card)}</div>
      </div>
      <div class="rate">
        <button class="b-again" data-rate="again"><span class="lbl">Again</span><span class="ivl">${p.again.label}</span></button>
        <button class="b-hard" data-rate="hard"><span class="lbl">Hard</span><span class="ivl">${p.hard.label}</span></button>
        <button class="b-good" data-rate="good"><span class="lbl">Good</span><span class="ivl">${p.good.label}</span></button>
        <button class="b-easy" data-rate="easy"><span class="lbl">Easy</span><span class="ivl">${p.easy.label}</span></button>
      </div>
    </div>`);
  view.appendChild(stage);

  const flip = stage.querySelector('.flip');
  const doFlip = () => flip.classList.toggle('flipped');
  flip.addEventListener('click', e => { if (!e.target.closest('[data-speak]')) doFlip(); });
  flip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doFlip(); } });

  stage.querySelectorAll('[data-speak]').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    speak(btn.dataset.speak === 'term' ? card.term : card.example.en, btn);
  }));

  stage.querySelectorAll('[data-rate]').forEach(btn => btn.addEventListener('click', () => {
    const newFsrs = rate(card, btn.dataset.rate);     // FSRS write — Study only
    store.updateCard(card.id, { fsrs: newFsrs });
    store.touchStreak();
    state.reviewed++;
    state.i++;
    setMeta(ctx, dueCards(store.getCards()).length);
    renderCardStage(view, ctx, state);
  }));
}

function renderComplete(view, ctx, state) {
  view.innerHTML = '';
  const stillDue = dueCards(store.getCards()).length;
  view.appendChild(elFrom(`
    <div class="center-state">
      <div class="big">All done</div>
      <p>You reviewed <b style="color:var(--accent)">${state.reviewed}</b> ${state.reviewed === 1 ? 'card' : 'cards'}.${stillDue ? ` ${stillDue} still due.` : ' Nicely done.'}</p>
      ${stillDue ? '<button class="btn" data-act="more">Keep going</button>' : ''}
      <div class="quiz-invite">Want to lock them in? <a data-go="quiz">Quiz these →</a></div>
    </div>`));
  const more = view.querySelector('[data-act="more"]');
  if (more) more.addEventListener('click', () => startSession(view, ctx, dueCards(store.getCards())));
  const q = view.querySelector('[data-go="quiz"]');
  if (q) q.addEventListener('click', () => ctx.navigate('quiz'));
}
