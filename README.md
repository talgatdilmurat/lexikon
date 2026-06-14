# Lexikon

A calm, personal vocabulary app for learning authentic everyday English — built as a
standalone static web app (plain HTML/CSS/vanilla JS, no backend, no build step).

**Four surfaces:** Study (flip card + FSRS) · Hazine (word collection) · Quiz (private
self-check) · Decode (paste/screenshot → Turkish diagnosis). Plus offline review and
install-to-home-screen (PWA).

## Run it locally
Service workers and ES modules need to be served over http (not opened as a `file://`).

```bash
cd lexikon
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (GitHub Pages)
Push this folder to a repo and enable Pages (Settings → Pages → deploy from branch).
All paths are **relative**, so it works at either `username.github.io` or a
`username.github.io/lexikon/` project URL. Then in Safari on iPhone: **Share → Add to
Home Screen**.

## Your API key
AI features (Decode, card auto-fill, build-a-deck, AI cloze) use **your own Anthropic
key**. The app asks for it once and stores it **only in this device's localStorage** — it
is never committed to the repo or sent anywhere except `api.anthropic.com`. You can change
it any time from the bottom of the Hazine screen. Study, Quiz, manual cards, audio and
backup all work without a key.

Models (verified Jun 2026): Haiku `claude-haiku-4-5-20251001` for card fill / examples /
cloze; Sonnet `claude-sonnet-4-6` for Decode.

## Backup
The deck lives in localStorage. Use **Export deck** (Hazine) regularly — a cleared browser
cache would wipe it. **Import** merges a backup back in.

## Structure
```
index.html              app shell
css/styles.css          design system (paper · pine · bronze)
js/app.js               router + locked glass nav
js/{store,scheduler,ai,audio,util,icons}.js
js/screens/{study,hazine,quiz,decode}.js
vendor/ts-fsrs.js       FSRS scheduler (bundled, offline)
manifest.webmanifest, sw.js, icons/
```

FSRS scheduling uses [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (MIT),
vendored locally. Quiz is deliberately walled off from FSRS — it never changes your schedule.
