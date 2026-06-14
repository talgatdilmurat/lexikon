// ai.js — Anthropic client. Browser-direct calls with the user's own key.
// Strict-JSON discipline: instruct JSON-only, strip fences, slice braces, parse, retry once.
// (No assistant prefill — last-turn prefill returns 400 on Sonnet 4.6, which Decode uses.)
import * as store from './store.js';
import { promptSheet } from './util.js';

const API = 'https://api.anthropic.com/v1/messages';
// Verified against Anthropic docs at build time (Jun 2026).
export const MODELS = { haiku: 'claude-haiku-4-5-20251001', sonnet: 'claude-sonnet-4-6' };

export class AiError extends Error {
  constructor(kind, message) { super(message); this.kind = kind; }
}

// ---------- key handling (no Settings tab; prompted on-device, stored locally) ----------
export function hasKey() { return store.hasApiKey(); }

export async function promptForKey() {
  const v = await promptSheet({
    title: 'Add your Anthropic API key',
    sub: 'Used only on this device for AI features. Stored in your browser, never uploaded anywhere but Anthropic. Get one at console.anthropic.com.',
    fields: [{ name: 'key', label: 'API key', placeholder: 'sk-ant-...', value: store.getApiKey(), attrs: 'autocapitalize="off" autocorrect="off" spellcheck="false"' }],
    okText: 'Save key',
  });
  if (v && v.key) { store.setApiKey(v.key); return v.key; }
  return store.getApiKey() || null;
}

// Ensure a key exists, prompting if needed. Returns key or null (cancelled).
export async function ensureKey() {
  return store.hasApiKey() ? store.getApiKey() : await promptForKey();
}

// ---------- low level ----------
function headers() {
  return {
    'x-api-key': store.getApiKey(),
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

async function rawCall({ model, system, messages, max_tokens }) {
  if (!store.hasApiKey()) throw new AiError('no-key', 'No API key set.');
  let res;
  try {
    res = await fetch(API, { method: 'POST', headers: headers(), body: JSON.stringify({ model, max_tokens, system, messages }) });
  } catch {
    throw new AiError('network', 'Couldn’t reach the AI — check your connection.');
  }
  if (!res.ok) {
    let msg = '';
    try { const j = await res.json(); msg = (j.error && j.error.message) || ''; } catch {}
    if (res.status === 401 || res.status === 403) throw new AiError('auth', 'Your API key was rejected — tap to update it.');
    if (res.status === 429) throw new AiError('rate', 'Rate limited — wait a moment and try again.');
    throw new AiError('http', msg || `AI error (${res.status}).`);
  }
  const data = await res.json();
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

function parseLoose(text) {
  let s = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
}

// Call expecting a JSON object. Parses loosely (strip fences / slice braces); retries once on parse failure.
async function callJSON({ model, system, content, max_tokens = 400 }) {
  const messages = [{ role: 'user', content }];
  let raw = await rawCall({ model, system, messages, max_tokens }); // network/auth errors bubble up
  try { return parseLoose(raw); }
  catch {
    raw = await rawCall({ model, system, messages, max_tokens });
    try { return parseLoose(raw); }
    catch { throw new AiError('parse', 'The AI returned something unexpected — please try again.'); }
  }
}

const cached = text => [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];

// ---------- card auto-fill (Haiku) — spec §4.4 ----------
export async function autofillCard(term) {
  const system = cached('You build vocabulary flashcards for a Turkish native speaker learning English (intermediate). Return only JSON.');
  const content =
`Word or phrase: "${term}"
Return ONLY this JSON, no markdown:
{"type":"word|phrase","pos":"<short part of speech>","respelling":"<simple sound-it-out pronunciation, capital on the stressed syllable, e.g. ri-LUHK-tuhnt; NOT IPA>","english":"<extremely simple definition, ~4-9 words, CEFR A2, no hard words, no example>","turkish":"<short Turkish meaning(s), comma-separated, max 3>"}
Use the most common everyday meaning. Output JSON only.`;
  const j = await callJSON({ model: MODELS.haiku, system, content, max_tokens: 220 });
  return {
    type: j.type === 'phrase' ? 'phrase' : 'word',
    pos: (j.pos || '').trim(),
    respelling: (j.respelling || '').trim(),
    english: (j.english || '').trim(),
    turkish: (j.turkish || '').trim(),
  };
}

// ---------- example sentences (Haiku) — spec §4.5 ----------
export async function exampleSentences(term) {
  const system = cached('You write natural everyday English example sentences for a Turkish learner. Return only JSON.');
  const content =
`For "${term}", write 2 short, natural, everyday English sentences a native speaker would really say in daily life (CEFR A2-B1, not formal, not difficult). The term must appear in each. Give a natural Turkish translation for each.
Return ONLY: {"sentences":[{"en":"...","tr":"..."},{"en":"...","tr":"..."}]}
Output JSON only.`;
  const j = await callJSON({ model: MODELS.haiku, system, content, max_tokens: 320 });
  return Array.isArray(j.sentences) ? j.sentences.filter(s => s && s.en) : [];
}

// ---------- cloze sentence for Quiz (Haiku) ----------
export async function clozeSentence(term) {
  const system = cached('You write one very easy, natural English sentence for a Turkish learner. Return only JSON.');
  const content =
`Write ONE short, very easy, natural English sentence (CEFR A1-A2) that uses "${term}" exactly once, naturally, the way a native speaker would in daily life. Keep it simple and clear.
Return ONLY: {"sentence":"..."}
The sentence MUST contain the exact text "${term}". Output JSON only.`;
  const j = await callJSON({ model: MODELS.haiku, system, content, max_tokens: 120 });
  return (j.sentence || '').trim();
}

// ---------- Decode, text (Sonnet) — spec §4.6 ----------
const DECODE_CONTRACT =
`You help a Turkish native speaker (intermediate English) understand real English she encountered. You DIAGNOSE why it was hard — you do not define words she already knows. Assume she knows everyday vocabulary and basic grammar. If nothing is genuinely tricky for an intermediate learner, say so and stop. Explain idiom/slang MEANINGS in Turkish — never translate them into a Turkish idiom equivalent. Keep explanations to 1-2 short Turkish sentences. Choose ONE example: a single sentence by default; a two-line mini-dialogue ONLY if the meaning depends on the back-and-forth. Use the SAME sense she encountered. Return only JSON.`;

const DECODE_FEWSHOT =
`Examples of the expected JSON (study the style, then answer the real input):

Input: "no worries, we'll hash it out tmrw"
{"meaning":"Don't worry, we'll talk it through and sort it out tomorrow.","category":"idiom / slang","why_tr":"\\"hash it out\\" — bir konuyu konuşarak çözmek demek. \\"tmrw\\" ise \\"tomorrow\\" kelimesinin kısaltması.","example":{"format":"sentence","text":"Let's hash it out after lunch."},"save":[{"term":"hash it out","english":"talk something through to solve it","turkish":"konuşarak çözmek"}]}

Input: "oh great, another Monday meeting. can't wait."
{"meaning":"She is annoyed about the meeting; she does NOT actually look forward to it.","category":"tone / sarcasm","why_tr":"Burada \\"can't wait\\" alaycı (sarkastik) kullanılmış — aslında toplantıyı hiç istemiyor, tam tersini kastediyor.","example":{"format":"dialogue","text":"— Another Monday meeting.\\n— Oh, can't wait. (rolling her eyes)"},"save":[]}

Input: "the food was good"
{"meaning":"The food was good.","category":"nothing tricky","why_tr":"","example":{"format":"sentence","text":"The food was good."},"save":[]}`;

export async function decodeText(text) {
  const system = cached(DECODE_CONTRACT + '\n\n' + DECODE_FEWSHOT);
  const content =
`Text she didn't fully understand:
"""${text}"""
Return ONLY this JSON:
{"meaning":"<one plain-language restatement of what it actually means>","category":"unknown word|known word, unusual use|idiom / slang|unusual structure|tone / sarcasm|nothing tricky","why_tr":"<1-2 short sentences in Turkish explaining the hard bit(s); empty if nothing tricky>","example":{"format":"sentence|dialogue","text":"<one example, in the same sense>"},"save":[{"term":"<hard word or phrase>","english":"<short EN>","turkish":"<short TR>"}]}
Output JSON only.`;
  return normalizeDecode(await callJSON({ model: MODELS.sonnet, system, content, max_tokens: 700 }));
}

// ---------- Decode, screenshot (Sonnet, image) — spec §4.7 ----------
export async function decodeImage(base64, mediaType) {
  const system = cached(DECODE_CONTRACT +
    '\nThis input is a SCREENSHOT of a conversation. First summarize in 1-2 Turkish sentences what the whole conversation is about (the gist) in "context_tr". Then diagnose only the genuinely tricky pieces.\n\n' + DECODE_FEWSHOT);
  const content = [
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
    { type: 'text', text:
`Read this screenshot of a conversation she didn't fully understand.
Return ONLY this JSON:
{"context_tr":"<1-2 sentence Turkish summary of what the whole conversation is about>","meaning":"<plain restatement of the key/tricky line(s)>","category":"unknown word|known word, unusual use|idiom / slang|unusual structure|tone / sarcasm|nothing tricky","why_tr":"<1-2 short Turkish sentences explaining the hard bit(s); empty if nothing tricky>","example":{"format":"sentence|dialogue","text":"<one example, same sense>"},"save":[{"term":"<hard word or phrase>","english":"<short EN>","turkish":"<short TR>"}]}
Output JSON only.` },
  ];
  return normalizeDecode(await callJSON({ model: MODELS.sonnet, system, content, max_tokens: 800 }));
}

function normalizeDecode(j) {
  return {
    context_tr: (j.context_tr || '').trim(),
    meaning: (j.meaning || '').trim(),
    category: (j.category || '').trim(),
    why_tr: (j.why_tr || '').trim(),
    example: j.example && j.example.text
      ? { format: j.example.format === 'dialogue' ? 'dialogue' : 'sentence', text: String(j.example.text).trim() }
      : null,
    save: Array.isArray(j.save) ? j.save.filter(s => s && s.term).map(s => ({
      term: String(s.term).trim(),
      english: String(s.english || '').trim(),
      turkish: String(s.turkish || '').trim(),
    })) : [],
  };
}
