// icons.js — inline SVG strings. Tab icons match lexikon-nav-locked.html exactly.
const S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

export const tabIcons = {
  // Study = a stack of cards (3 offset rectangles)
  study: `<svg viewBox="0 0 24 24" ${S} stroke-width="1.7"><rect x="8" y="9.5" width="12" height="10" rx="2"/><path d="M6.5 7.5h10.5a2 2 0 0 1 2 2"/><path d="M5 5.5h10.5a2 2 0 0 1 2 2"/></svg>`,
  // Hazine = a list (lines with bullet dots)
  hazine: `<svg viewBox="0 0 24 24" ${S} stroke-width="1.8"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.3"/><circle cx="4.5" cy="12" r="1.3"/><circle cx="4.5" cy="18" r="1.3"/></svg>`,
  // Quiz = a marked answer sheet (lines with ticks)
  quiz: `<svg viewBox="0 0 24 24" ${S} stroke-width="1.8"><path d="M5 6h7M5 10h5"/><path d="m15.5 8.2 2 2 3.2-3.6"/><path d="M5 15h7M5 18.5h4"/><path d="m15.5 16.7 2 2 3.2-3.6"/></svg>`,
  // Decode = a speech bubble (with text lines)
  decode: `<svg viewBox="0 0 24 24" ${S} stroke-width="1.8"><path d="M20 11.5a7.5 7.5 0 0 1-10.8 6.7L4 20l1.8-5.2A7.5 7.5 0 1 1 20 11.5Z"/><path d="M9 10.5h6M9 13.5h4"/></svg>`,
};

export const ic = {
  speaker: `<svg viewBox="0 0 24 24" ${S} stroke-width="1.7"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>`,
  speakerSm: `<svg viewBox="0 0 24 24" ${S} stroke-width="1.8"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>`,
  search: `<svg viewBox="0 0 24 24" ${S} stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" ${S} stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>`,
  check: `<svg viewBox="0 0 24 24" ${S} stroke-width="2.4"><path d="m5 12.5 4.5 4.5L19 6.5"/></svg>`,
  x: `<svg viewBox="0 0 24 24" ${S} stroke-width="2.4"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" ${S} stroke-width="1.8"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2L9 5h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.2"/></svg>`,
  flame: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1.2 3-1.5 4.5-1.5 7A2.5 2.5 0 0 0 13 11c.4-1 .2-2 .2-2 1.8 1.3 3.3 3.2 3.3 5.6A4.5 4.5 0 0 1 12 19a4.5 4.5 0 0 1-4.5-4.4c0-4 3-5.6 4.5-8.6 0-1.5 0-3 0-4z"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" ${S} stroke-width="1.7"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></svg>`,
  // Decode speech-bubble — the "Explain this" button (matches tabIcons.decode / the mockup).
  decode: `<svg viewBox="0 0 24 24" ${S} stroke-width="1.8"><path d="M20 11.5a7.5 7.5 0 0 1-10.8 6.7L4 20l1.8-5.2A7.5 7.5 0 1 1 20 11.5Z"/><path d="M9 10.5h6M9 13.5h4"/></svg>`,
};
