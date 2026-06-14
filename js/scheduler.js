// scheduler.js — FSRS wrapper (ts-fsrs, vendored). The ONLY place that writes card.fsrs.
import { fsrs, generatorParameters, createEmptyCard, Rating, State }
  from '../vendor/ts-fsrs.js';
import { formatInterval } from './util.js';

// Target retention ~90%, fuzz on so siblings don't all come due at once.
const params = generatorParameters({ request_retention: 0.9, enable_fuzz: true });
const f = fsrs(params);

export const RATING = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy };
export { State };

// A fresh FSRS card — due immediately (new cards are due now).
export function freshFsrs() {
  return createEmptyCard(new Date());
}

const dueMs = c => new Date(c.fsrs.due).getTime();

// Predicted next state for each of the four ratings, with a human label.
// Does NOT mutate the card.
export function preview(card, now = new Date()) {
  const s = f.repeat(card.fsrs, now);
  const out = {};
  for (const [k, g] of Object.entries(RATING)) {
    const next = s[g].card;
    out[k] = { label: formatInterval(new Date(next.due).getTime() - now.getTime()), card: next };
  }
  return out;
}

// Apply a rating during STUDY only. Returns the new fsrs object to persist.
export function rate(card, ratingKey, now = new Date()) {
  const s = f.repeat(card.fsrs, now);
  return s[RATING[ratingKey]].card;
}

// Cards due now, soonest first.
export function dueCards(cards, now = Date.now()) {
  return cards.filter(c => c.fsrs && dueMs(c) <= now).sort((a, b) => dueMs(a) - dueMs(b));
}

// Pull the n soonest-due cards regardless of due time (Review ahead).
export function soonest(cards, n = 12) {
  return cards.filter(c => c.fsrs).slice().sort((a, b) => dueMs(a) - dueMs(b)).slice(0, n);
}

// Display status for a card's dot in Hazine.
export function statusOf(card, now = Date.now()) {
  const st = card.fsrs ? card.fsrs.state : State.New;
  if (st === State.New) return 'new';
  if (dueMs(card) <= now) return 'due';
  if (st === State.Review && card.fsrs.stability >= 21) return 'known';
  return 'learning';
}

// "Learned" metric for the progress line: matured review cards.
export function learnedCount(cards) {
  return cards.filter(c => c.fsrs && c.fsrs.state === State.Review && c.fsrs.stability >= 21).length;
}
