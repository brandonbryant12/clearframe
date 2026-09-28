# Changelog

## 0.3.0 — 2026-09-28

A redesign of the native renderer's visual language, a larger vocabulary, and new checks that stop a film from being quietly wrong.

### Design system
- **Typography.** Inter Display (300/600/700) at the 32 pt optical master for display sizes; Inter 400/600 for text. A tabular-figures face (Inter's own `tnum` glyphs baked in) for every counter, so digits never jitter. Text is measured with rustybuzz on the bundled fonts — the shaper that draws it — with kerning and tracking, replacing integer per-glyph estimates.
- **Layout.** Balanced headline wrapping (no orphaned last word), bisection font fitting with a cached layout per text/box, vertically composed scenes instead of fixed fractions, cards, rails and rounded plates.
- **Palettes.** Eight contrast-checked presets (new: `midnight`, `forest`, `ember`, `mono`) and a secondary `accent2` token. New `glow` backdrop. `looks` now tiles every palette.
- **Motion.** Preset curves (quartic, exponential, damped spring with no overshoot on opacity or values), masked line reveals, pops, drawn rails and connectors, count-ups synced to bars and arcs, and a slow push-in on held hero text. Scene exits mirror the next entrance (`exit` per beat to override); the film ends on a fade.

### Blocks and playbooks
- New blocks: `chapter`, `highlight` (marker sweeps on cue), `donut`, `magnitude` (area-true squares), `checklist`, `annotate` (numbered pins, legend and focus region on a screenshot). 32 in total.
- New props: `emphasis` on hero text, `icon` on `callout` and `waffle` (pictograms), `better` on `delta`, `highlight` on `matrix`, `rates` on `funnel` (derived step rates), `fit`/`drift` on `image`/`video`.
- Every existing block restyled; the line chart gains round-number ticks (previously labels could round 7.5 to "8"), an area wash and a final-value tip label.
- 95 MIT Tabler icons at the pinned revision (was 24), fetched and verified by `fetch-icons.py`.
- Five new playbooks: `data-story`, `screen-walkthrough` (ships a generated, text-free wireframe placeholder), `checklist-guide`, `year-in-review`, `scale-explainer`. 24 in total.

### Integrity and robustness
- `check` fails a final render when a beat ends before its numbers finish counting (drafts warn).
- Staged items in every sequence block are scheduled inside the beat; late authored cues fail instead of being hidden.
- Displayed text is checked against the bundled fonts' coverage; unsupported characters fail with the character, code point and prop.
- Fixed: at some lengths (e.g. 451 frames) the final frame was dropped because the upstream MP4 edit list ended one frame early. The raw output's timeline is now rebuilt from its packets; a regression is part of `verify-native.mjs`.
- Fixed: playbooks that replaced a block's text could inherit an example's emphasis phrase.
- Scene exits never start before counts, labels and staged items have settled: each beat carries `settle_seconds`, computed from the same timings the renderer uses (including line tip labels, legend rows and bar focus notes).
- Numerals put the sign before the prefix (−$3), matching chart labels and legends.
- `magnitude` fits its value type to the canvas instead of running off vertical frames.
- Prop combinations that would silently hide authored text (`text` with `title` on headline blocks, `title` on `highlight`, `context` with `support` on `stat`) are rejected; playbooks no longer inherit hidden example headlines.
- Checklist ticks, highlight sweeps and annotate legends are scheduled with their full durations.
- Glyph checks ignore invisible format characters (soft hyphen, joiners, variation selectors), confirmed by rendering them.
- Hand-written jobs can no longer panic the renderer with an empty phrase or a non-ASCII color.
- Single-column KPI cards (square, portrait, vertical) place the label beside the numeral and fit the card.
- Highlight markers are translucent, so they stay visible over the glow backdrop.
- Kinetic `word` mode holds a word through pauses shorter than `maxGap` instead of blinking; kinetic type is larger.
- `looks` tiles all eight palettes (the fixed 2×2 grid would have shown four); `timing.json` no longer records browser-era look defaults.
- Renderer/catalog parity tests for block names and palette values; provenance tests for every font instance.

### Efficiency
- `render --draft` and `preview` use the native fast review encoder at the authored size: the 32-block gallery (4,410 frames) renders and finishes in about 37 s, roughly 8.5 ms per frame, versus about 11 ms per frame for the previous final-quality draft path. Final renders keep x264 medium at CRF 16.
- Hidden elements are skipped rather than drawn transparent, and clip paths are emitted only while a transition needs them.

## 0.2.0

FFFrames becomes the only active renderer: 26 native blocks, 19 playbooks, measured speech timing, continuity-aware Omni inserts. The browser engine is archived.
