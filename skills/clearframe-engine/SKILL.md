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
  index.html           # optional: global layers (omit it and the default composition is used)
  scenes/*.js          # optional: custom scene modules (parallel-friendly); most beats use library blocks instead
  assets/vo|music|img|clips|sfx/   # generated or supplied media (+ .json metadata)
  build/               # timing.json, sheet.png, stills, captions, renders
```

## storyboard.json

```jsonc
{
  "title": "…", "format": { "preset": "landscape" | "vertical" | "square" | "portrait", "fps": 30 },
  "theme": "paper",                 // paper | ink | ember | editorial | slate | signal
  "backdrop": "dots",               // dots | grid | ruled | topo | aurora | none      (default composition)
  "chrome": "auto", "captions": "auto", "transition": "auto", "sfx": false, "grain": true, "vignette": true,
  "budget": 1.0,                    // USD hard cap for paid generation
  "voice": { "model": "gemini-3.8-flash-tts", "voice": "Charon", "style": "calm, measured", "wpm": 150 },
  "music": { "model": "lyria-3.5", "prompt": "…", "bpm": 80, "key": "D major", "volume": 0.2, "arc": { "<chapter>": "…" } },
  "pacing": { "lead": 0.25, "tail": 0.6, "minBeat": 1.6 },
  "beats": [
    { "id": "kpis", "chapter": "Headline", "block": "kpis", "props": { "items": [ … ] }, "vo": "…" },   // a library block
    { "id": "hook", "chapter": "The forecast", "scene": "scenes/forecast.js",                          // or your own scene module
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
Beat length = `max(minBeat, lead + voice + tail + hold)`, or a fixed `duration`. A negative `lead` gives a J-cut, where the voice starts before the picture. `tail` defaults to the block's own recommended hold (`meta.tail`, 0.9–1.8 s), otherwise `pacing.tail`. Per beat, `"transition"` overrides the cut into it. `music: false` disables music. The JSON Schema is in `schema/storyboard.schema.json`.

## Blocks and storyboard-only projects

`"block": "<name>"` plus `"props"` mounts a library scene from `engine/runtime/blocks/`. There are 33 of them: charts, numbers, diagrams, UI, text and cards. The catalogue is in the `clearframe-library` skill, `clearframe blocks`, and `docs/media/blocks.jpg`. **With no `index.html`, the engine serves a default composition**: blocks, then backdrop, grain, vignette, chrome (`'auto'`), captions (`'auto'`, on for 9:16) and automatic transitions (`'auto'`: rise across chapters, fade within). A project can be only `storyboard.json`.

## index.html

Only needed for custom global layers. Start from `engine/runtime/default.html`:

```html
<link rel="stylesheet" href="/_cf/cf.css">
<div id="stage"><div id="scenes"></div></div>
<script src="/_cf/all.js"></script>   <!-- GSAP + SplitText + CustomEase + MotionPath + runtime + kit + kit+ -->
<script>
  CF.compose((ctx) => {
    ctx.kit.look(ctx);                                   // the default look (backdrop, grain, chrome, captions, transitions)…
    // …or do it by hand: kit.backdrop(stage, 'topo'); kit.grain(stage); kit.transition('fade', A, B, 'next');
  });
</script>
```
Fonts, GSAP, icons and the runtime are served locally by the engine from `node_modules`, so renders never touch a CDN. The individual files (`/_cf/vendor/gsap/*.js`, `/_cf/cf.js`, `/_cf/cf-kit.js`, `/_cf/cf-kit-plus.js`) still work.

## Scene modules (`scenes/*.js`)

A beat with `"scene": "scenes/x.js"` gets a `<section class="cf-scene" data-beat="<id>">`. It is visible only during that beat; set `el.dataset.until = '<laterBeatId>'` to span beats.

```js
export const css = `.fc .big { font-family: var(--cf-display); font-size: calc(440px * var(--u)); }`;
export const html = (props, ctx) => `<div class="fc"><div class="big">70%</div><div class="sub">chance …</div></div>`;  // or a string
export default async function ({ el, b, beat, tl, kit, data, rand, time, stage, timing, props, cue, sound, format }) {
  el.dataset.until = 'flip';                 // keep this scene through the "flip" beat
  const flip = beat('flip');
  kit.reveal(el.querySelector('.big'), b.say('seventy') - 0.15, { by: 'chars', mask: true, ease: kit.tokens.ease.snap });
  tl.to(el.querySelector('.big'), { y: -250, scale: 0.6, duration: 0.9, ease: 'power3.inOut' }, flip.at(0.1));
}
```
Scene modules and blocks share one mount path and the same `ctx`, so you can **fork a block**: copy `engine/runtime/blocks/<name>.js` into `scenes/`, change `./_lib.js` to `/_cf/blocks/_lib.js`, and point a beat's `scene` at it. `props` comes from the beat's `props`; `cue(spec, fallback)` turns a spoken word or seconds into a time; `sound(name, t)` emits a sound cue when `sfx` is on. **Compose blocks inside a scene** with `await CF.mount('stat', someEl, { value: 42 }, b)`. Scene modules build in beat order, before the global `compose` callback. Declarative scenes also work: put `<section data-beat="id" data-until="other" data-in="-0.2" data-out="0.4">` straight into `index.html`.

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
| `CF.mount(name, el, props, beat)` | mount a library block anywhere (returns the element) |
| `CF.sfx(name, t, { volume })` | sound cue: `tick tock pop click type whoosh chime thud rise` (synthesized) or a project file path. Mixed in at render; played in preview |
| `format` / `look` | `'landscape'\|'vertical'\|'square'` / the storyboard look settings |

Preview URL params: `?t=12.5` jumps to a time. Keys: space play, ←/→ frame, shift+←/→ 1 s, `[` `]` beats, `S` safe areas, `M` mute.

## Determinism rules (break them and frames flicker or differ between workers)

1. **Every tween lives on `tl`.** No `gsap.to()` outside it, no `setTimeout`, no `requestAnimationFrame` loops, no `Date.now()`, no `Math.random()` (use `rand(seed)`). `check` warns about stray tweens.
2. **Never tween a property that an `onFrame` function also writes.** Wrap it in a parent element and tween the wrapper. Prefer `fromTo` (with `immediateRender: false` for later tweens) when a start value could be ambiguous.
3. Derived drawing (canvas, counters, chart tips) belongs in `CF.onFrame`, reading tweened proxies.
4. `<video data-start="beatId+0.2" data-offset="0" muted>` for footage. The runtime seeks it per frame. Audio comes only from the mix, never from page media.
5. CSS `@keyframes` are allowed for ambient loops; the runtime pins them to the playhead.
6. Fonts are loaded before build, so splitting and measuring are safe inside scene modules.
7. Tag ambient tweens (camera drifts) with `data: 'cf-ambient'`. The runtime flags any other animation still running after its beat (`animation runs Xs past the beat`), because that payoff would be cut. `kit.drift` and `kit.transition` tag themselves.

## Kit (full API in `references/kit.md`)

- **Text:** `reveal, exit, enter, hit, mark, counter, odometer, scramble, type, fit, split, md, esc, spoken`
- **Scene and camera:** `drift, transition, autoTransitions, camera (zoomTo / reset / push), spotlight, cursor, rectIn`
- **Look:** `look, backdrop (dots / grid / ruled / topo / aurora), grain, vignette, gridlines, chrome, marquee, captions`
- **Data:** `lineChart (dash), bars, waffle, donut, meter, milestones, steps, chip, draw, arrow, niceTicks, fmt, color`
- **Icons:** `await icon(parent, 'shield-check', { size })`, `drawIcon(svg, at)` (Lucide; search with `clearframe icons`)
- **Cues:** `cueFor(b)`, `spread(b, i, n)`, `sequence(els, b, cues)`
- **Credibility:** `source, footnote`
- **Tokens:** `kit.tokens`

## CLI

| Command | What it does |
|---|---|
| `clearframe doctor` | check ffmpeg (+ required filters/encoders), headless Chrome, fonts, icons, draft voice, API key |
| `clearframe new <dir> [--recipe <name> \| --template explainer\|vertical]` | scaffold (recipes are block-only storyboards) |
| `clearframe recipes` · `clearframe blocks [name] [--json\|--md]` · `clearframe icons <query>` | discover recipes, blocks (props plus an example beat), and icon names |
| `clearframe gallery [dir] [--vertical]` | render every block into a catalogue grid PNG |
| `clearframe preview [dir]` | live preview with synced voice/music and a beat scrubber (auto-reload) |
| `clearframe plan [dir]` | the paid calls needed, what's cached, and their cost |
| `clearframe voice [dir] [--draft] [--only a,b] [--force]` | TTS per beat (cached by hash); trims silence; aligns words |
| `clearframe music [dir] [--draft]` | Lyria bed shaped to the chapters, or a free synthesized pad |
| `clearframe images [dir]` / `clips [dir]` | declared image / footage assets |
| `clearframe timing [dir]` | beat table with pace (wpm) |
| `clearframe sheet [dir] [--per 3] [--grid 4]` | **contact sheet PNG. Read it.** `--grid` = one frame per beat |
| `clearframe still [dir] --beat id [--pos 0.6]` / `--at 12.5` | full-res frame |
| `clearframe check [dir]` | QA: frame edges, safe areas, overflow, tiny text, overlaps, word counts, pace, stillness, sources, missing files, stray tweens |
| `clearframe captions [dir]` | SRT + VTT |
| `clearframe render [dir] [--draft] [--lossless] [--workers n] [--from s --to s]` | MP4 (H.264 BT.709, AAC, −14 LUFS). Block sound cues are mixed in |

## Debugging

- A build error shows as a red overlay in preview. The renderer prints it and stops.
- A `say()` miss logs `narration has no word "…"`. Match the text as written in `vo` ("seventy", not "70").
- Something is invisible? Check the scene's beat window, `data-until`, a `from()` tween that never ends, or an opacity tween that fights an `onFrame` function.
- Timing feels off? Run `clearframe timing`. The rows marked `est` have no recorded voice yet.
- Slow renders: `--draft` is half-resolution JPEG; `--workers` defaults to half your CPU cores (max 6).
