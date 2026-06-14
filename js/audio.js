// audio.js — English text-to-speech via the browser. On-device, free. No Turkish audio.
let voices = [];
let enVoice = null;

function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  voices = window.speechSynthesis.getVoices() || [];
  // Prefer a natural en-US/en-GB voice; fall back to any English voice.
  enVoice =
    voices.find(v => /^en[-_]US/i.test(v.lang) && /Samantha|Siri|Google|Natural|Aaron|Nicky/i.test(v.name)) ||
    voices.find(v => /^en[-_]US/i.test(v.lang)) ||
    voices.find(v => /^en/i.test(v.lang)) ||
    null;
}

if ('speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export function canSpeak() { return 'speechSynthesis' in window; }

// Speak English text. `btn` (optional) gets a .speaking class while active.
export function speak(text, btn) {
  if (!text || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel(); // stop anything mid-utterance
    if (!enVoice) loadVoices();
    const u = new SpeechSynthesisUtterance(text);
    if (enVoice) u.voice = enVoice;
    u.lang = (enVoice && enVoice.lang) || 'en-US';
    u.rate = 0.95;
    u.pitch = 1;
    if (btn) {
      btn.classList.add('speaking');
      const clear = () => btn.classList.remove('speaking');
      u.onend = clear; u.onerror = clear;
    }
    window.speechSynthesis.speak(u);
  } catch (e) { /* no-op: audio is non-critical */ }
}
