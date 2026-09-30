# Changelog

## 0.5.0 — unreleased

Travel instead of cutting, type with a voice, and fewer false alarms.

- **One continuous take for the voice.** The narration is recorded as one Gemini 3.8 TTS take for the whole film by default (`voice.takes: "film"`), sent as one text part with one short style, then cut into beats by measured word timings. Stitched per-line styles made the voice drift. Per-beat `style` is ignored in continuous takes (`voice.perBeatStyle` opts back in). `critique` warns about long style strings, stage directions in the text, heavy tag use and per-line recording. The `gemini-tts` and `clearframe-script` skills and the guide cover how to prompt 3.8: cast, one short style, delivery written into the words, and tags used sparingly.
- **Mosaic.** `mosaic` on any canvas shape (or the whole canvas) lays it in hand-cut tesserae (slanted corners, varied widths, pale pieces, a lit bevel, one dark grout bed that appears only under placed tiles): fills tile in running-bond rows or concentric rings on a grout bed, with an outline row following the contour. Strokes become beaded lines, and gradient fills are sampled per tile. `enter: assemble` builds a shape tile by tile and `exit: scatter` throws the tiles loose. A `mosaic` palette, a `mosaic` backdrop (static, cached tiles) and a `mosaic` treatment complete the look.
- **Worlds in any frame shape.** Camera rects authored for landscape are re-framed for vertical or square cuts on each beat's own foreground (for all canvases, not just the journey playbook). `viewTall` sets a vertical camera explicitly where a side-by-side composition cannot survive the crop. The text-size warning uses the real zoom for any frame.
- **Glow and shadow.** `glow` (in the element's own colour or a set `color`) and `shadow` on any canvas element or group, as one filter per group.
- **Podcast ingests keep the words on screen.** `ingest --audio` defaults to `captions: "pop"` for vertical clips and plate captions otherwise, so beats that become pictures still follow the speech. The brief suggests worlds for explanatory stretches.
- **`world DIR`** renders a canvas world's plan: everything drawn, with every beat's camera rect outlined and numbered.
- **Zero-length keys apply on their own frame.** A `dur: 0` key used to show the old state for one frame, which caused single-frame flashes. Camera pre-roll leaves once the outgoing line has been said, and travels faster (down to 0.8 s) rather than landing late.
- **The camera lands on the words.** World moves pre-roll into the outgoing beat's settled tail and arrive by the new line's first word or drawing; both beats share one move curve across the cut. Graphic transitions between world beats cut under the cover. `depth` below 1 gives far layers parallax.
- **Living worlds.** World beats drift slowly after the camera arrives (`viewDrift`, default 0.03), and the next move starts from the drifted view. `behind: true` puts an element under everything already drawn, such as a sky that lights up by day. The source line waits for the camera and sits on a soft scrim. `pulse` on bare strokes throbs in brightness instead of changing length. Text bounds are estimated from length and anchor.
- **Example: `examples/night-city`.** A research brief turned into one continuous world, refined over four review rounds.
- **Worlds persist across interruptions.** A world beat after a kinetic card or chart returns to where the camera left off and travels on; exits timed after a beat (tidying the world while the camera is away) do not hold that beat. `check` accepts the camera cropping a world and instead warns when a beat's own text falls outside its view. Keys gain `scaleX`/`scaleY` for levels and gaps. `critique` judges the hook by when its first cued idea lands.
- **Worlds.** Consecutive canvas beats that share `props.world` form one continuous drawing: each beat draws only what is new, inherits earlier drawings on their original clocks (loops and exits carry on), cuts invisibly, and the camera travels between camera rects (`view: [x, y, w, h]`, `viewFrom`, `viewAt`, `viewDur`), zooming at a constant pace. A soft whoosh marks each move. The new `journey` playbook is a worked example.
- **Text motion.** `textMotion` (film default or per beat) makes display type arrive by `lines`, `words`, `letters` or `cascade` (letters dropping in with an alternating tilt). Serif rich headlines follow the same mode; body copy keeps the line rise. The kinetic treatment uses cascade; the sketchbook, audiogram and mosaic treatments use words.
- **Lower-third headings.** `heading: "bottom"` (film or beat) sets the kicker and title under the picture with an accent rule; the picture gets the top of the frame. `critique` warns when a frame-pixel drawing would collide with it.
- **Particles.** A seeded, deterministic `particles` canvas element (`dust`, `embers`, `rain`, `snow`, `bubbles`) for atmosphere under a scene.
- **Pop captions.** `captions: "pop"` sets social-style captions: heavy outlined phrases of three or four words, the spoken word on a tilted accent pill.
- **Numbers land on the word.** `stat`, `delta` and `ring` counts cued to a spoken word pre-roll, so the figure finishes as it is said. Number words and digits now match either way ("18" finds "eighteen"; Whisper's "7" aligns with a scripted "seven").
- **Fresh-review fixes (systemic).** Scene headings always rise as a line (never word by word, which read as speech-synced) and are already in place on a hard cut, so cuts land on a composed frame. Waffle counts pre-roll to finish on their word. `check` warns when a scene's last element lands under 0.45 s before the cut; text-motion settle is computed from the actual word/letter count. Kinetic stacks keep one normal word space after large emphasis words. `critique` warns when a frame-pixel drawing reaches the source line.
- **Critique.** A titled canvas is no longer treated as full frame. Small drawings get a `view: "auto"` hint, runs of separate drawings get a world hint, and style keys are no longer counted as on-screen words.
- **Hand-drawn scenes render about 14× faster.** Hachure is clipped to the shape analytically (a scanline, as in Rough.js) instead of through a clip mask, each hatch line is one bowed curve, and jittered geometry is cached per element and seed; a rough 24 s film went from 113 s to 8 s, close to its crisp cost.
- **Canvas** holds up to 600 elements. `check` ignores "cut off by the canvas edge" while a world camera is moving. The build step names the heavy-lock holder while it waits.

## 0.4.0 — 2026-09-29

From narrated slides to motion graphics, and from source material to films. This round was run as loops with different lenses: visual language, inputs and story, voice and performance, then the creative system and efficiency. It borrows ideas, not code, from FFFrames' own examples (MIT), Manim's indication vocabulary, Rough.js, flubber, Magic Move and editorial motion design.

### Visual language
- **`canvas` block and `art` layers.** Author-drawn shapes, paths, text, icons and images with entrances (draw-on, pop, rise, grow, wipe, type, scramble, blur), keyframes, motion along paths (optionally looping), ambient loops (spin, pulse, float, sway, orbit, dash, blink, voice level), exits and spoken cues. Also: echo trails and stepped copies with colour shifts, morph by id across cuts (outlines resampled and aligned), stepped "on twos" time, spotlights, audio meters, gradients, blends and palette-token colours. Path data is parsed and re-serialized by kurbo, which is already in the lock graph. See `docs/canvas.md`.
- **Hand-drawn strokes:** `rough` renders multi-pass pencil lines with hachure fills and an optional line boil. Together with the `sketchbook` palette, the `paper` backdrop and the `hand` font, this gives a whiteboard/notebook look.
- **Sketches:** `clearframe sketch` gives eight starting compositions (route, orbit, pipeline, network, balance, versus, burst, ambient), each laid out for landscape or vertical. `gallery --sketches` renders them all.
- **Beat layers:**
  - `plate`: image or clip full-bleed with a scrim, or split left/right (top/bottom on tall frames), with duotone, tint, mono and blur treatments, drift and focus.
  - `tone`: a colour-blocked scene with re-derived readable colours.
  - `camera`: a slow move on every scene by default.
- **Graphic transitions:** `panel`, `iris` (with origin and colour) and `whip` carry one movement across a cut. Scenes that cannot fit the cover fall back to a fade, with a warning.
- **Editorial frame:** a serif-italic brand mark, mono section labels and footers, and a progress rail.
- **Texture:** static or animated grain and a vignette.
- **Typography:** Instrument Serif (and italic), IBM Plex Mono and Architects Daughter, all OFL at pinned google/fonts revisions with hashes and glyph coverage. Adds serif accent words in headlines (`emphasisStyle: serif`), centred compositions (`align: center`), and poster kinetic type (`kinetic` mode `stack`) that builds word by word and breaks at sentences.
- **Palettes:** 14 (new: pop, electric, blueprint, clay, noir, sketchbook).
- **Review aids:** `still --grid` / `sheet --grid` overlay a labelled coordinate grid for placing art.

### Inputs and story
- `ingest --markdown` (also HTML, DOCX, RTF, text, and PDF via pdftotext) writes an evidence brief: every figure with its sentence and source, tensions, questions, quotes, chart-ready tables and sources. It also scaffolds a question-led `research-digest` storyboard.
- `ingest --audio --words [--script]` imports a podcast or talk as gapless beats, cut on frame-aligned pauses. Word timings are measured; a script supplies spelling and speakers, and any word the recognizer missed is labelled estimated. Speaker tags carry live level meters, and prepared voice levels drive meters and `level` loops.
- `reference VIDEO` breaks a reference down: hard cuts and designed transitions, a keyframe sheet, an opening strip, palette with the nearest theme, and motion energy.
- **Treatments** (`clearframe treatments`, `new --treatment`) set palette, texture, frame, motion, transition grammar, voice direction, sound and rules in one word. `new` writes a DIRECTION.md brief.
- `critique` lints a storyboard for deck-like runs, stillness, text density, weak hooks, "and then" story chains, overused punctuation and flat delivery.
- New playbooks: `research-digest`, `podcast-clip`, `brand-spot` (27 in total).
- Skills: `clearframe-direction` (material → film, with a fresh-reviewer rubric), `clearframe-canvas`, a rewritten `clearframe-motion`, performance writing in `clearframe-script`, and `docs/ideas.md` (pictures for narrative moves).

### Voice and sound
- **Continuous takes** (`voice.takes: "chapter"`): a chapter is recorded in one call, with a per-beat `style` energy map, then split back into gapless beats. Word timings come from local Whisper when it is installed.
- **Two voices:** `voice.cast` with conversational TTS requests (dry-run contract only; no paid calls were made).
- `align --whisper` measures word timings locally for free. `word-align` maps script words onto recognizer timings and never labels interpolated words as measured.
- **Sound follows picture:** with `sfx: subtle|normal|punchy`, whooshes lead into graphic transitions, thuds land with hero numbers, and ticks, tocks and pops land on counts, checks and arrivals, thinned so they never smear.
- **Generated plates:** prompts now carry the film's palette and continuity, composition hints from how the image is used (split or full plate), and a strict no-text rule.

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
