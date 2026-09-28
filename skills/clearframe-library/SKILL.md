---
name: clearframe-library
description: The ClearFrame block library and recipes — 33 ready-made, voice-synced motion-graphics scenes (hero numbers, KPI tiles, charts, unit charts, gauges, funnels, distributions, calendars, timelines, process steps, system diagrams, comparisons, tables, code, chat, product UI walkthroughs, quotes, definitions, titles, end cards) used by naming them in storyboard.json with JSON props — no HTML or code. Use to pick the right graphic for a beat, compose a whole film from blocks, choose look/sound settings, find icons, or extend the library.
---

# The block library

**Most videos need no scene code.** Name a block on a beat, pass props, and the narration drives the timing. A project can be just `storyboard.json`: with no `index.html`, the default composition adds the backdrop, grain, chrome, captions and transitions.

```jsonc
{ "id": "kpis", "block": "kpis",
  "vo": "Requests rose to twelve thousand four hundred, and first response fell to four hours.",
  "props": { "kicker": "Q3 at a glance",
    "items": [ { "label": "Requests", "value": 12400, "delta": "+8%", "say": "requests" },
               { "label": "First response", "value": 4, "suffix": " h", "delta": "−2.1 h", "dir": "down", "good": "down", "say": "first" } ] } }
```

- **See them.** Read `docs/media/blocks.jpg` (16:9) and `docs/media/blocks-vertical.jpg` (9:16), a frame of every block. Rebuild them with `clearframe gallery`.
- **Look them up.** Run `clearframe blocks` (the list), `clearframe blocks <name>` (props plus an example beat), or read `references/blocks.md`, which is generated from the code.
- **Start from a recipe.** Run `clearframe recipes`, then `clearframe new my-film --recipe quarterly-update`, then replace the content.

## Pick by intent

| I need to show… | Block | Notes |
|---|---|---|
| the promise / a section opener | `title`, `chapter` | ≤ 8 words; `*word*` gets the accent |
| one sentence that matters | `statement` | karaoke: words light up as spoken |
| one number | `stat` | `style: serif` (editorial), `counter`, `odometer` |
| 2–4 metrics | `kpis` | delta chips know which direction is good |
| before → after | `delta` | the change % is computed for you |
| a comparison of values | `bars` | focus dims the rest; horizontal automatically on 9:16 |
| a trend over time | `line` | marks, bands, dashed baseline; value rides the tip |
| a share / a probability | `waffle` (countable) · `ring` (one share) · `share` (a whole split into parts) | prefer `waffle` for risk |
| a score with bands | `gauge` | label the zones |
| magnitude (10×+) | `circles` | area ∝ value |
| drop-off through stages | `funnel` | conversion % between steps |
| spread, not average | `distribution` | marker line + highlighted tail |
| activity over months | `calendar` | streak outline; transposes on 9:16 |
| a sequence of events | `timeline` | "now" pulses |
| a process | `steps` | icons optional; current step highlighted |
| how a system works | `flow` | columns, curved edges, packets in motion, focus |
| options side by side | `compare` · `table` | same criteria on both sides |
| a list that gets done | `checklist` | ticks on the spoken word |
| takeaways | `points` | numbered rows, one per phrase |
| a person's words | `quote` | attribute precisely; fictional names in demos |
| a term | `definition` | before you use jargon |
| the turn of the argument | `question` | wrong question struck, better one rises |
| code | `code` | highlight ranges step through with notes; ≤ 16 lines |
| a conversation | `chat` | typing indicator, auto-scroll |
| a product UI | `browser` | screenshot, HTML or a skeleton mock; spotlight, cursor clicks, zoom |
| a place / texture | `image` | Ken Burns plus scrim; the words carry the meaning |
| who's speaking | `lower-third` | over an image or clip |
| features / pillars | `icons` | 3–6 Lucide icons that draw on |
| the ending | `end` | verdict, CTA, source, AI-voice disclosure (auto) |

## Sequences that work

Each is a proven arc. Swap blocks, but keep the rhythm.

- **Number story:** `stat` → `statement` → `waffle` → `question` → `points` → `end`
- **Update:** `title` → `kpis` → `line` (with a mark) → `bars` (drivers, focus) → `timeline` (next) → `points` → `end`
- **Explainer:** `stat` (hook) → `statement` (thesis) → `definition` → `flow` or `steps` (mechanism) → `question` (turn) → `end`
- **Decision:** `title` (the ask) → `delta` (cost of inaction) → `compare` → `table` → `statement` (recommendation) → `end`
- **Product:** `title` → `browser` (2–3 callouts) → `icons` (what you get) → `checklist` (setup) → `end`
- **Research:** `title` → `quote` (a voice) → `distribution` (the data) → `ring` (the share) → `points` (recommendations) → `end`
- **Incident:** `title` → `timeline` → `stat` (impact) → `flow` (cause, focus) → `checklist` (fixes) → `end`
- **Vertical short (20–30 s):** `stat` → `statement` → one chart (`circles` / `waffle` / `delta`) → `end`. Captions come on automatically.

## Rhythm rules

1. **Alternate dense and spare.** Follow every data block with a spare one (`statement`, `question`, `title`) or a very simple one. Never put three charts in a row.
2. **Vary the layout.** Centred (`stat`, `title`, `question`), left-aligned (`statement`, `points`, `line`), grid (`kpis`, `icons`, `compare`). Two centred blocks in a row feel like slides.
3. **One snap per film.** A hero number with `style: serif` gets the punch; everything else settles.
4. **Every cue is a spoken word.** `say`, `land`, `growSay`, `toSay` and the rest must be words in that beat's `vo` (matched fuzzily, as written). Without cues, items spread evenly across the narration.
5. **Give payoffs room.** Each block has a default `tail` (hold after the last word). If `clearframe check` says `animation runs Xs past the beat`, raise that beat's `tail` or land the item earlier.
6. **Numbers come from sources.** Put every figure in `storyboard.sources`, or into `data.json` if you build custom scenes.

## Look (top-level storyboard settings)

| Setting | Values | Default |
|---|---|---|
| `theme` | `paper` · `ink` · `ember` · `editorial` · `slate` · `signal` | `paper` |
| `backdrop` | `dots` · `grid` · `ruled` · `topo` (contour lines) · `aurora` (soft light, sparingly) · `none` | `dots` |
| `grain` / `vignette` | `true` / `false` / grain opacity | on |
| `chrome` | `'auto'` (chapter label, `02 / 05`, progress rail when there are ≥ 2 chapters) · `true` · `false` | `'auto'` |
| `captions` | `'auto'` (on for 9:16) · `true` · `false` | `'auto'` |
| `transition` | `'auto'` (rise across chapters, fade within) · `fade` · `rise` · `push` · `wipe` · `blur` · `zoom` · `cut` | `'auto'` |
| `sfx` | `true` gives blocks their soft cues (ticks, pops, a chapter whoosh, one chime at the end) | `false` |

Per beat, `"transition": "cut"` (or any kind) overrides the transition into that beat.

Pairings that work:
- `paper` + `dots` for a calm default.
- `editorial` + `topo` for research and essays.
- `slate` + `ruled` for decisions and board memos.
- `ink` + `grid` for technical and product films.
- `signal` + `none` for a stark vertical short.

## Sound design

Enable it with `"sfx": true`. The cues are synthesized by ffmpeg, royalty-free, and quiet by design: `tick`, `tock`, `pop`, `click`, `type`, `whoosh`, `chime`, `thud`, `rise`. Blocks use them sparingly: a tick when a counter lands, a pop when a card arrives, a whoosh on a chapter change, a chime on the end card. In custom scenes, call `CF.sfx('tick', t, { volume: 0.3 })`, or use a project file path. Keep cues at volume ≤ 0.4; the voice must always win. Audition the whole mix in `clearframe preview` before you deliver.

## Icons

There are more than 2,000 Lucide icons (ISC licence). Find names with `clearframe icons <words>`. Good professional defaults:
- **Security and quality:** `shield-check`, `lock`, `badge-check`
- **Speed and delivery:** `gauge`, `timer`, `zap`, `rocket`, `truck`
- **Data and infrastructure:** `database`, `server`, `network`, `cloud`
- **Analytics:** `chart-line`, `chart-bar`
- **People and communication:** `users`, `user-check`, `messages-square`, `mail`
- **Planning:** `calendar-check`, `list-checks`, `sliders-horizontal`, `target`
- **Documents and money:** `file-text`, `receipt`, `wallet`

Avoid clichés: `lightbulb` for "ideas", `puzzle` for "fit", `rocket` for everything.

## Customise, in this order

1. **Props:** most needs stop here.
2. **Theme and look settings:** the whole film changes coherently.
3. **CSS overrides** in your own `index.html` (copy `engine/runtime/default.html`). Target `.cf-block-<name>`. For example, `.cf-block-stat .n { font-size: 400px }`.
4. **Compose blocks inside a custom scene.** `await CF.mount('stat', el.querySelector('.left'), { value: 42 }, b)` puts two blocks side by side.
5. **Fork a block.** Copy `engine/runtime/blocks/<name>.js` to `scenes/my-<name>.js`, edit it, and point the beat's `scene` at it. Change `import … from './_lib.js'` to `'/_cf/blocks/_lib.js'`.

## Adding a block to the library

Create `engine/runtime/blocks/<name>.js`. It exports:
- `meta`: `{ tail, summary, use, props, defaults, example: { vo, props } }`
- `css`: a string, injected once
- `html(props, ctx)`: the initial markup
- `default async function (ctx)`

`ctx` holds `el`, `b` (beat), `props`, `kit`, `tl`, `cue(spec, fallback)`, `sound(name, t)`, `format` and `beat()`. Use `_lib.js` helpers: `head`, `animateHead`, `finish`, `itemTime`, `words`, `wordTimes`, `formatter`, `tone`, `md`, `esc`.

Rules:
- Size in `calc(Npx * var(--u))`.
- Use theme tokens only.
- Every tween goes on `tl` with `at` times from `cue`, `itemTime` or `b.*`.
- Support 9:16 with `:root[data-format='vertical']` CSS or a `ctx.format` branch.
- Run `clearframe gallery` and `clearframe gallery --vertical`, read both images, and fix what `check` reports.
- Regenerate the reference with `clearframe blocks --md > skills/clearframe-library/references/blocks.md`.
