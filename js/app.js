// app.js — router + the locked floating glass nav (active tab names itself).
import { study } from './screens/study.js';
import { hazine } from './screens/hazine.js';
import { quiz } from './screens/quiz.js';
import { decode } from './screens/decode.js';
import { tabIcons } from './icons.js';

const ROUTES = { study, hazine, quiz, decode };
const ORDER = ['study', 'hazine', 'quiz', 'decode'];

const view = document.getElementById('view');
const titleEl = document.getElementById('screen-title');
const metaEl = document.getElementById('screen-meta');
const nav = document.getElementById('nav');

// Build the nav once.
nav.innerHTML = ORDER.map(r =>
  `<button class="ptab" data-route="${r}" aria-label="${ROUTES[r].title()}">${tabIcons[r]}<span class="lbl">${ROUTES[r].title()}</span></button>`
).join('');
nav.querySelectorAll('.ptab').forEach(btn =>
  btn.addEventListener('click', () => go(btn.dataset.route)));

const ctx = {
  navigate: go,
  setTitle: t => { titleEl.textContent = t; },
  setMeta: html => { metaEl.innerHTML = html || ''; },
};

function routeFromHash() {
  const r = (location.hash || '').replace(/^#\/?/, '');
  return ROUTES[r] ? r : 'study';
}

function renderRoute(route) {
  const screen = ROUTES[route];
  nav.querySelectorAll('.ptab').forEach(b => b.classList.toggle('active', b.dataset.route === route));
  titleEl.textContent = screen.title();
  metaEl.innerHTML = '';
  view.scrollTop = 0;
  view.innerHTML = '';
  try {
    screen.mount(view, ctx);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="center-state"><p>Something went wrong on this screen.</p></div>`;
  }
}

function go(route) {
  const target = ROUTES[route] ? route : 'study';
  if (routeFromHash() === target) renderRoute(target);   // same route → re-render
  else location.hash = '#' + target;                      // else let hashchange drive it
}

window.addEventListener('hashchange', () => renderRoute(routeFromHash()));
renderRoute(routeFromHash());

// PWA: register the service worker (relative path → correct scope at any subpath).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
