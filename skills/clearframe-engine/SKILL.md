---
name: clearframe-engine
description: Technical reference for building ClearFrame videos — project layout, storyboard.json schema, the composition + scene-module contract, the CF runtime (compose, beats, say(), time specs, onFrame, determinism rules), the CF.kit motion/data components, and the clearframe CLI (preview, voice, music, sheet, check, render). Use when writing or debugging storyboard.json, index.html or scenes/*.js, or running the engine.
---

# ClearFrame engine

HTML/CSS/SVG/Canvas animated by **one paused GSAP timeline**. The renderer opens the page in headless Chrome, calls `__CF.seek(t)` for every frame, captures it and pipes it to ffmpeg. The same input always gives the same frames.

## Setup

```bash
git clone https://github.com/brandonbryant12/clearframe && cd clearframe && npm install   # Node ≥ 20, ffmpeg on PATH
npm link            # optional: puts `clearframe` on your PATH (otherwise: node engine/cli.mjs …)
```
Installed as a Claude Code plugin? Run `npm install` once in `${CLAUDE_PLUGIN_ROOT}` and invoke `node ${CLAUDE_PLUGIN_ROOT}/engine/cli.mjs`.

## Project layout

```
my-video/
  storyboard.json      # script, beats, voice, music, assets, sources  ← the source of truth
  STYLE.md             # optional: rules shared by every scene builder
  data.json            # optional: figures (available as ctx.data)
  index.html           # global layers: texture, chrome, transitions
  scenes/*.js          # one module per scene (parallel-friendly)
  assets/vo|music|img|clips|sfx/   # generated or supplied media (+ .json metadata)
  build/               # timing.json, sheet.png, stills, captions, renders
```

## storyboard.json

```jsonc
{
  "title": "…", "format": { "preset": "landscape" | "vertical" | "square" | "portrait", "fps": 30 },
  "theme": "paper",                 // paper | ink | ember | editorial | slate | signal
  "budget": 1.0,                    // USD hard cap for paid generation
  "voice": { "model": "gemini-3.8-flash-tts", "voice": "Charon", "style": "calm, measured", "wpm": 150 },
  "music": { "model": "lyria-3.5", "prompt": "…", "bpm": 80, "key": "D major", "volume": 0.2, "arc": { "<chapter>": "…" } },
  "pacing": { "lead": 0.25, "tail": 0.6, "minBeat": 1.6 },
  "beats": [
    { "id": "hook", "chapter": "The forecast", "scene": "scenes/forecast.js",
      "vo": "Seventy percent. <short pause> It sounds like a sure thing.",
      "visual": "What the eye sees when the words land.",
      "lead": 0.5, "tail": 0.5, "hold": 0, "duration": null, "style": null,
      "sfx": [{ "src": "assets/sfx/tick.wav", "at": "word:seventy", "volume": 0.5 }] }
  ],
  "assets": [
    { "id": "paper-texture", "kind": "image", "prompt": "…", "size": "2K" },
    { "id": "city-dawn", "kind": "clip", "prompt": "…", "seconds": 4, "from": "paper-texture" }
  ],
  "sources": [{ "claim": "…", "source": "…", "asOf": "2026-09" }]
}
```
Beat length = `max(minBeat, lead + voice + tail + hold)`, or a fixed `duration`. A negative `lead` gives a J-cut, where the voice starts before the picture. `music: false` disables music. The JSON Schema is in `schema/storyboard.schema.json`.

## index.html

```html
<link rel="stylesheet" href="/_cf/cf.css">
<div id="stage"><div id="scenes"></div></div>
<script src="/_cf/vendor/gsap/gsap.min.js"></script>
<script src="/_cf/vendor/gsap/SplitText.min.js"></script>   <!-- optional plugins: DrawSVGPlugin, CustomEase, MotionPathPlugin -->
<script src="/_cf/cf.js"></script>
<script src="/_cf/cf-kit.js"></script>
<script>
  CF.compose(({ tl, kit, beat, beats, timing, stage, data }) => {
    kit.gridlines(stage, { dots: true }); kit.grain(stage); kit.vignette(stage);
    kit.transition('fade', '[data-beat="hook"]', '[data-beat="next"]', 'next');
  });
</script>
```
Fonts, GSAP and the runtime are served locally by the engine from `node_modules`, so renders never touch a CDN.

## Scene modules (`scenes/*.js`)

A beat with `"scene": "scenes/x.js"` gets a `<section class="cf-scene" data-beat="<id>">`. It is visible only during that beat; set `el.dataset.until = '<laterBeatId>'` to span beats.

```js
export const css = `.fc .big { font-family: var(--cf-display); font-size: calc(440px * var(--u)); }`;
export const html = `<div class="fc"><div class="big">70%</div><div class="sub">chance …</div></div>`;
export default function ({ el, b, beat, tl, kit, data, rand, time, stage, timing }) {
  el.dataset.until = 'flip';                 // keep this scene through the "flip" beat
  const flip = beat('flip');
  kit.reveal(el.querySelector('.big'), b.say('seventy') - 0.15, { by: 'chars', mask: true, ease: kit.tokens.ease.snap });
  tl.to(el.querySelector('.big'), { y: -250, scale: 0.6, duration: 0.9, ease: 'power3.inOut' }, flip.at(0.1));
}
```
Scene modules build in beat order, before the global `compose` callback. Declarative scenes also work: put `<section data-beat="id" data-until="other" data-in="-0.2" data-out="0.4">` straight into `index.html`.

## Runtime API

| | |
|---|---|
| `b.start`, `b.end`, `b.dur` | beat bounds (s) |
| `b.at(s)` / `b.before(s)` / `b.p(f)` | `s` after start / `s` before end / fraction `f` of the beat |
| `b.say('word', { nth, edge: 'start'\|'end', offset })` | **absolute time the narrator says it** (fuzzy, punctuation-insensitive; multi-word ok) |
| `b.voStart` / `b.voEnd` / `b.vo.words` | narration timing |
| `beat(id)` | another beat |
| `time(spec)` | `"id"`, `"id+0.4"`, `"id@0.5"`, `"id:end"` → seconds (all kit `at` args accept these) |
| `tl` | the master timeline. **Every tween goes on it.** |
| `CF.onFrame((t, frame) => …)` | per-frame drawing (canvas, derived text) |
| `rand(seed)` | seeded PRNG: `.range .int .pick .shuffle` |
| `data` | parsed `data.json` or `null` |

Preview URL params: `?t=12.5` jumps to a time. Keys: space play, ←/→ frame, shift+←/→ 1 s, `[` `]` beats, `S` safe areas, `M` mute.

## Determinism rules (break them and frames flicker or differ between workers)

1. **Every tween lives on `tl`.** No `gsap.to()` outside it, no `setTimeout`, no `requestAnimationFrame` loops, no `Date.now()`, no `Math.random()` (use `rand(seed)`). `check` warns about stray tweens.
2. **Never tween a property that an `onFrame` function also writes.** Wrap it in a parent element and tween the wrapper. Prefer `fromTo` (with `immediateRender: false` for later tweens) when a start value could be ambiguous.
3. Derived drawing (canvas, counters, chart tips) belongs in `CF.onFrame`, reading tweened proxies.
4. `<video data-start="beatId+0.2" data-offset="0" muted>` for footage. The runtime seeks it per frame. Audio comes only from the mix, never from page media.
5. CSS `@keyframes` are allowed for ambient loops; the runtime pins them to the playhead.
6. Fonts are loaded before build, so splitting and measuring are safe inside scene modules.

## Kit (full API in `references/kit.md`)

Text: `reveal, exit, enter, hit, mark, counter, scramble, type, fit, split`. Scene: `drift, transition`. Texture: `grain, vignette, gridlines, marquee`. Captions: `captions`. Data: `lineChart, bars, waffle, donut, meter, milestones, steps, draw, arrow, niceTicks, fmt, color`. Credibility: `source, footnote`. Tokens: `kit.tokens`.

## CLI

| Command | What it does |
|---|---|
| `clearframe new <dir> [--template explainer\|vertical]` | scaffold |
| `clearframe preview [dir]` | live preview with synced voice/music and a beat scrubber (auto-reload) |
| `clearframe plan [dir]` | the paid calls needed, what's cached, and their cost |
| `clearframe voice [dir] [--draft] [--only a,b] [--force]` | TTS per beat (cached by hash); trims silence; aligns words |
| `clearframe music [dir] [--draft]` | Lyria bed shaped to the chapters, or a free synthesized pad |
| `clearframe images [dir]` / `clips [dir]` | declared image / footage assets |
| `clearframe timing [dir]` | beat table with pace (wpm) |
| `clearframe sheet [dir] [--per 3]` | **contact sheet PNG. Read it.** |
| `clearframe still [dir] --beat id [--pos 0.6]` / `--at 12.5` | full-res frame |
| `clearframe check [dir]` | QA: frame edges, safe areas, overflow, tiny text, overlaps, word counts, pace, stillness, sources, missing files, stray tweens |
| `clearframe captions [dir]` | SRT + VTT |
| `clearframe render [dir] [--draft] [--workers n] [--from s --to s]` | MP4 (H.264 BT.709, AAC, −14 LUFS) |

## Debugging

- A build error shows as a red overlay in preview. The renderer prints it and stops.
- A `say()` miss logs `narration has no word "…"`. Match the text as written in `vo` ("seventy", not "70").
- Something is invisible? Check the scene's beat window, `data-until`, a `from()` tween that never ends, or an opacity tween that fights an `onFrame` function.
- Timing feels off? Run `clearframe timing`. The rows marked `est` have no recorded voice yet.
- Slow renders: `--draft` is half-resolution JPEG; `--workers` defaults to half your CPU cores (max 6).
