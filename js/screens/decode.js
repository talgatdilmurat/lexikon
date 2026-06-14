// decode.js — paste text or a screenshot of real English; get a Turkish diagnosis + save chips.
import { elFrom, escapeHtml, toast, openSheet } from '../util.js';
import * as store from '../store.js';
import { ic } from '../icons.js';
import * as ai from '../ai.js';

export const decode = {
  id: 'decode',
  title: () => 'Decode',
  mount(view, ctx) {
    ctx.setMeta('');
    view.innerHTML = '';
    view.appendChild(elFrom(`
      <div>
        <div class="sub">Paste anything you didn't quite catch — or a screenshot of a chat.</div>
        <div class="paste"><textarea id="dc-text" placeholder="“no worries, we'll hash it out tmrw — i'm beat 😅”"></textarea></div>
        <div class="decode-actions">
          <button class="btn" data-act="explain">${ic.decode}Explain this</button>
          <button class="btn ghost" data-act="shot" aria-label="Upload screenshot">${ic.camera}</button>
        </div>
        <input type="file" accept="image/*" id="dc-file" style="display:none">
        <div id="dc-result"></div>
      </div>`));

    const text = view.querySelector('#dc-text');
    const fileInput = view.querySelector('#dc-file');

    view.querySelector('[data-act="explain"]').addEventListener('click', async () => {
      const t = text.value.trim();
      if (!t) return toast('Paste some text first.');
      if (!(await ai.ensureKey())) return;
      await runDecode(view, ctx, () => ai.decodeText(t), { sourceText: t });
    });

    view.querySelector('[data-act="shot"]').addEventListener('click', async () => {
      if (!(await ai.ensureKey())) return;
      if (!(await screenshotNoticeOnce())) return;
      fileInput.click();
    });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0]; fileInput.value = '';
      if (!file) return;
      let img;
      try { img = await downscaleImage(file); }
      catch { return toast('Couldn’t read that image.'); }
      // image is used for this one call, then dropped — never stored.
      await runDecode(view, ctx, () => ai.decodeImage(img.base64, img.mediaType), { sourceText: '' });
    });
  },
};

async function runDecode(view, ctx, call, { sourceText }) {
  const out = view.querySelector('#dc-result');
  out.innerHTML = `<div class="loading-rows"><div class="skl"></div><div class="skl" style="width:80%"></div><div class="skl" style="width:55%"></div></div>`;
  try {
    const r = await call();
    renderResult(out, ctx, r, sourceText);
  } catch (e) {
    out.innerHTML = '';
    out.appendChild(errorBox(e, () => out.querySelector('[data-retry]') && call()));
    if (e.kind === 'auth') { const b = out.querySelector('[data-retry]'); if (b) b.onclick = () => ai.promptForKey(); }
  }
}

function renderResult(out, ctx, r, sourceText) {
  const nothing = r.category === 'nothing tricky' || (!r.why_tr && r.save.length === 0 && r.example);
  const toneChip = /tone|sarcasm/i.test(r.category);
  out.innerHTML = '';
  const node = elFrom(`
    <div class="result">
      ${r.context_tr ? `<div class="res-context"><b>Konuşma:</b> ${escapeHtml(r.context_tr)}</div>` : ''}
      <div class="eyebrow">What it means</div>
      <div class="res-mean">${escapeHtml(r.meaning)}</div>
      ${r.category ? `<div class="chips"><span class="tagchip ${toneChip ? 'amber' : ''}">${escapeHtml(r.category)}</span></div>` : ''}
      ${nothing
        ? `<div class="res-block"><div class="res-tr">Nothing tricky here — it just means what it says.</div></div>`
        : `
          ${r.why_tr ? `<div class="res-block"><div class="eyebrow">Why it's tricky</div><div class="res-tr">${formatWhy(r.why_tr)}</div></div>` : ''}
          ${r.example ? `<div class="res-block"><button class="more-link" data-act="show-ex">Show example ↓</button>
            <div class="res-ex" data-ex hidden>${formatExample(r.example)}</div></div>` : ''}
          ${r.save.length ? `<div class="save-row"><div class="eyebrow">Save to your deck</div>
            <div class="save-chips">${r.save.map((s, i) => `<button class="savechip" data-save="${i}">${ic.plus}${escapeHtml(s.term)}</button>`).join('')}</div></div>` : ''}`}
    </div>`);
  out.appendChild(node);

  const showEx = node.querySelector('[data-act="show-ex"]');
  if (showEx) showEx.addEventListener('click', () => {
    const ex = node.querySelector('[data-ex]');
    ex.hidden = false; showEx.remove();
  });

  node.querySelectorAll('[data-save]').forEach(btn => btn.addEventListener('click', () => {
    const item = r.save[+btn.dataset.save];
    // Zero extra API cost: reuse meaning/example already generated.
    const example = sourceText
      ? { en: sourceText.slice(0, 240), source: 'decode' }
      : (r.example ? { en: r.example.text, source: 'ai' } : null);
    const { created } = store.addCard({
      term: item.term, english: item.english, turkish: item.turkish,
      type: /\s/.test(item.term) ? 'phrase' : 'word', example,
    });
    btn.classList.add('saved'); btn.disabled = true;
    btn.innerHTML = `${ic.check}${escapeHtml(item.term)}`;
    toast(created ? `Saved “${item.term}”.` : `“${item.term}” was already saved.`, { ok: created });
  }));
}

function formatWhy(s) {
  // bold any **term** the model may have emphasised
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}
function formatExample(ex) {
  if (ex.format === 'dialogue') {
    return escapeHtml(ex.text).split('\n').filter(Boolean).map(l => `<span class="dlg">${l}</span>`).join('');
  }
  return escapeHtml(ex.text);
}

function errorBox(e, onRetry) {
  const msg = e && e.message ? e.message : 'Couldn’t reach the AI — check your key and connection.';
  const box = elFrom(`<div class="result"><div class="res-block">
    <div class="res-mean" style="font-size:16px">${escapeHtml(msg)}</div>
    <button class="btn ghost" data-retry style="margin-top:12px">${e && e.kind === 'auth' ? 'Update key' : 'Try again'}</button>
  </div></div>`);
  if (onRetry) box.querySelector('[data-retry]').addEventListener('click', onRetry);
  return box;
}

// ---------- screenshot helpers ----------
function screenshotNoticeOnce() {
  if (store.getSetting('seenShotNotice')) return Promise.resolve(true);
  return new Promise(resolve => {
    const body = elFrom(`
      <div>
        <h2>About screenshots</h2>
        <div class="sheet-sub">Your screenshot is sent to the AI to read it, then discarded. Nothing is stored — saved cards are plain text only.</div>
        <div class="sheet-actions"><button class="btn" data-ok>Got it</button></div>
      </div>`);
    const { close } = openSheet(body, { onClose: () => resolve(false) });
    body.querySelector('[data-ok]').addEventListener('click', () => {
      store.setSetting('seenShotNotice', true); resolve(true); close();
    });
  });
}

// Downscale to <=1568px long edge (Anthropic's sweet spot) and return base64.
function downscaleImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const max = 1568;
      let { width: w, height: h } = im;
      const scale = Math.min(1, max / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(im, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')); };
    im.src = url;
  });
}
