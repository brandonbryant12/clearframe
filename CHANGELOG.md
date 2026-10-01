# Changelog

## 0.5.0 — unreleased

Travel instead of cutting, type with a voice, and fewer false alarms.

- **A frame audit that fails `check`.** The renderer inspects four held moments of every beat, ignoring text in motion. It refuses:
  - type cut off by the frame edge or by letterbox bars;
  - type printed over other type or over a 3D solid;
  - type under 14 px at 1080p (it warns under 20 px).
- **Titles that fit.** Canvas text takes `fit` (the widest a line may be) and shrinks instead of running off the frame. The title sketch fills the frame and fits any title.
- **Charts without headings.** `chart` bars, stacks and numbers fill the frame. `chart.note: {text, to, say}` is the annotation that replaces a heading: an accent line under the value, arriving on the stressed word.
- **Report playbooks rebuilt as films.** Each now runs on one consistent dataset, with no heading on every chart and no empty "pause" beat.
  - `data-story` opens on a queue world in depth, then shows the average, its split into hours and its spread.
  - `research-digest` draws its mechanism (buses bunching).
  - `concept-explainer` draws a brake rippling back through full traffic, then the queueing curve (computed, so its source is the formula).
- **End cards without web buttons.** `action` is accent type over a drawn rule, not a pill.
- **No bloom on light palettes**, where it only softened the shapes.
- **Kinetic phrases never end on a leaning word** ("the", "of", "too"): the break moves one word early or late.
- **A breath before a graphic transition.** Timing gives the outgoing beat the time its panel, iris or whip needs, even inside a continuous take, instead of falling back to a fade.
- **Ambient motion that does not hold the beat.** A key with `hold: false` (traffic, drifting cloud) runs on past the cut.
- **`props.sketch` works in any storyboard** (with `sketchText` and `seed`), not only through `new`.
- **Honest critique.** It stops scoring slideshows 100:
  - It shows `check` errors first.
  - Headings count wherever they sit, and a handheld wobble no longer counts as life.
  - A graphic wipe earns only half credit for continuity.
  - A new tell flags a film that opens on an empty frame.
- **Checkpoints read real direction files.** They accept `Audience:`, `Takeaway:` and `Question:` lines and the `## Decisions` log. A one-shot film without a budget can close Narration on the draft voice and Spend with a logged decision.
- **Cleaner `ingest` briefs.**
  - It skips dates, version numbers ("Opus 5.5", "Route 12"), codes (R128) and hex colours, and keeps 2.5M, series (8 → 34) and units.
  - Links trailing a bullet source its sentences, and reference titles keep their words.
  - DIRECTION.md starts with the brief's tensions, sourced figures and quotations.
- **Fixed: the draft music bed turned into a full-scale DC wall after about 10 s.** A NaN from `pow()` of a hair-negative sine poisoned the filter state. The loudness normaliser then pushed the voice down to make room for it.
- **Films have a score and sound by default.** Playbooks scaffold a music bed (free as a draft, paid Lyria only after `plan`) and subtle sound design that follows the picture. Render writes the cue sheet to `build/cues.json`.
- **An honest review loop.** `scripts/bench.mjs` drafts ten fixed films, and a fresh reviewer scores them against top studio work (`docs/review.md`). Round 1 scored 3.1/5. The bench also renders a draft voice and bed for every film, then reports loudness and a waveform with the cuts and sound cues marked.

- **A lens for the whole film.** `lens` (film-wide, overridable per beat) adds:
  - `letterbox`: animated black bars (2.39, 2, 1.85). Headings, sources and captions move inside the picture.
  - `grade`: tone curves per channel (`teal-orange`, `warm`, `cool`, `bleach`, `mono`, `noir`, `sepia`).
  - `bloom`: light on the highlights.
  - `aberration`: red and blue slipping apart.
  - `leak`: drifting warm light leaks.
  - `handheld`: a seeded operator sway.
  - `blur`: motion blur on world camera moves.

  Everything is one GPU filter over the composed frame and stays a pure function of the frame.
- **Depth.** Canvas elements take `z`, a distance drawn in true perspective around the camera, which gives real parallax. `dolly` flies the camera through z, so layers grow past the lens and are gone once passed. `focus` adds depth of field with rack-focus keys on spoken words. `blur` (static or keyed) sets focus by hand, and `shine` sweeps light across a title. See `docs/canvas.md`.
- **Film genres in the library.**
  - Treatments: `cinematic`, `trailer`, `documentary`, `keynote` and `cutpaper`, with the `cinema`, `stage` and `bass` palettes.
  - Playbooks:
    - `trailer`;
    - `cold-open`;
    - `product-reveal`;
    - `cinematic-explainer`;
    - `title-sequence`, where shapes become each other across cuts;
    - `zoom-journey`, one camera from a planet to a single window across four scales.
  - Set pieces built on depth: `void`, `tunnel`, `skyline`, `horizon`, `title`, `terrain`, `landscape`, `ocean` and `pause`.
  - A `desk` set piece: someone working late, lit by a laptop, with a night window behind and a soft plant in front. People in depth plates are always anonymous (from behind, in silhouette, hands).
  - A `road` set piece: a night highway whose dashes and streetlights rush past as the camera drives.
  - A `crowd` set piece: anonymous silhouettes in depth, one lit, with focus racking to them.
  - A `globe` solid, with `marks` at [lat, lon] and great-circle `arcs` that lift off the surface and draw on in turn, plus a `globe` set piece.
  - A `flash` cut.

  A treatment can name the playbook it suits, so `new`/`ingest --treatment cinematic` starts from shots rather than a deck. Playbook beats can name a sketch (`"sketch": "tunnel"`, with `sketchText` for its placeholder type) and set the film's `lens`, `heading`, `textMotion` and `transition`.
- **`critique` scores cinema.** It adds a 0–100 score from the eight tells of a slideshow; each tell names the fix. It also warns when frame-pixel type sits under letterbox bars. A run of world beats counts as one shot, and silent beats and moving-camera canvases count as distinct shots.
- **The report playbooks are films now.** `research-digest` (what `ingest --markdown` starts from), `data-story` and `concept-explainer` (what `new` starts from):
  - open on a question or an establishing shot;
  - show figures as full-frame inserts;
  - set charts under lower thirds with a moving camera;
  - pause in silence before the turn;
  - set the turn as poster type;
  - add a subtle lens.

  They score 100 on the cinema score, up from 25–63. A beat's `art` can name a sketch (`{"sketch": "ambient"}`).
- **Fixed:** `view: "auto"` on a canvas was mistaken for a camera rect (the string has four characters) and failed to render.
- **One shot or guided.** `docs/collaboration.md` breaks down where a human changes the outcome: intent, truth, story and look, narration, spend, picture and final. Timing, layout, cues and sound placement never need a human. `clearframe checkpoints DIR [--mode guided|one-shot]` reports each checkpoint's state and the question to ask, or tells a one-shot agent to decide and log under `## Decisions`. The `clearframe` skill and AGENTS.md set guided as the default. Fixed along the way: `plan` now recognises voices recorded as continuous takes, which it had counted as still owed.
- **A creative seed.** `clearframe muse --seed N` draws a brief from curated options:
  - a structural twist and a recurring motif;
  - camera and cut signatures, and type motion;
  - a palette and a grade;
  - two set pieces;
  - a music feel.

  `new DIR --seed N|random` applies the look on top of the playbook and treatment, writes the brief into DIRECTION.md, and seeds every set piece's layout, so two films never share a skyline. The same seed reproduces the same draw. Models default to the same choices; a seed starts each film somewhere different, without leaving the curated options.
- **Charts that become each other.** `chart` on a canvas draws a `number`, a `stack` or `bars` as shapes with ids computed from the labels, so consecutive canvas charts morph across the cut. A headline figure's bar slides into its segment of a stacked bar, and the segments stand up as bars. It removes the last card-to-card habit of data films; geometry follows the values.
- **Music composed to the edit.** A film with silent beats sends its composed bed (Lyria) a brief timed to its own edit: an intro, a build that climbs into the silence, the silence, then an impact and a sustained chord. The mixer gates any bed, composed or draft, to nothing through silent beats with 60 ms ramps. In the real trailer final, the build sits at −18 dB, the silence at −32 dB and the title at −18 dB. The trailer playbook carries a score prompt.
- **Generated depth plates.** Image generation is now a regular tool for places. An asset with `layers: true` generates:
  - a painted far layer;
  - a cut-out subject;
  - a cut-out foreground.

  Cut-outs are generated on chroma green and keyed to transparency, sampling the real key colour. `"plates": "ID"` on a canvas stages the layers at three depths with a slow push, so dolly, parallax and rack focus work on generated art. The first test is a harbour at dusk with a sharp boat, a bokeh harbour behind it and soft foreground framing, for about $0.20 a scene at 1K. It taught that cut-out layers must describe objects: asked for a scene "on green", the model paints a framed picture.
- **Drafts predict the final.** The first real final (the trailer, voiced by Gemini TTS as Orus, with words measured by Whisper) showed two ways drafts had been wrong:
  - **The voice's reading speed.** A deliberate trailer read runs at about 95 wpm, not 150. ClearFrame now remembers each voice's measured speed per model, voice and style after every real take. Drafts use it unless the storyboard sets `voice.wpm`.
  - **The gaps between lines.** Drafts padded every line with lead and tail, but a continuous take plays back to back. Estimated timing now follows the planned takes.

  Draft beat starts now land within about a second of the final's. The stricter timing caught a brand-spot cue that could never have played in a real take.
- **Lit solids.** `shade` on a `solid` draws lit faces: back faces culled and far faces first, a key light over an ambient fill, a specular glint and highlighted edges. The product-reveal playbook's hero object is now lit.
- **Fixes from a fresh model's first film** (a test: a new session made "The Last Mile" from the docs alone):
  - Film looks strip the pencil strokes an arc was scaffolded with (`beats.rough: false`).
  - Filled `path` and `poly` shapes no longer get an ink outline by default.
  - A world beat may only move the camera (`elements: []`).
  - The "no room for the panel transition" warning names the real cause (an element still moving, or the line).
  - `doctor` checks disk headroom against the real thresholds (10 GiB warm, 25 GiB cold).
  - `docs/canvas.md` now explains:
    - how `viewAt`/`viewDur` time a world move;
    - how `z` parallax is measured in worlds;
    - why `behind` hides under an opaque sky;
    - how long beats last;
    - that element times are scene seconds.
- **Every report playbook got film grammar.** The 21 remaining arcs (quarterly update, incident review, tutorial, science lesson and so on) now have:
  - lower-third headings instead of slide titles;
  - a subtle lens and texture (no handheld on calm genres);
  - a push-in on number scenes, and ambient life under the opening;
  - a silence before the closing beat, with a graphic cut into the turn.

  The cinema score across all 35 playbooks is now 63–100, where 17 were at 25 or below.
- **Motion blur on moving elements.** With `lens.blur` set, an element moving fast on its keys smears along its path by how far it travelled while the shutter was open, as a camera sees it. Static elements stay sharp.
- **Push to a detail.** `camera: {to: [x, y, w, h], say}` on any beat pushes the picture into a frame-pixel rect on a spoken word, a close-up on the bar or the part that matters. The heading fades as the camera moves in, and the source line stays. The research digest's evidence chart now ends as a close-up on its outlier.
- **A trailer bed that follows the edit.** `music: {style: "pulse", bpm}` (free, local) builds a sub drone and a beat pulse toward the first silence, cuts dead through every silent beat, and carries the title on a low chord. The trailer playbook uses it. In its draft, the montage sits at −18 dB, the silence drops to −30 dB, and the title hit lands at −11.5 dB. Room tone under silences is quieter.
- **Sound for cinema.** New synthesized cues are placed by the picture:
  - a `hit` on every `flash` cut;
  - a `riser` that ends exactly where a silent beat begins;
  - `drone` room tone under the silence;
  - a `shimmer` as `shine` sweeps a title.

  Whooshes now play only for fast camera moves, not slow creeps. Playbooks can set `sfx`, and the genre playbooks do.
- **Held block scenes push in visibly** (about 2% over a beat instead of about 1%).
- **`docs/cinema.md` and `docs/scorecard.md`.** A film-grammar guide covers:
  - shot scales;
  - three planes;
  - motivated camera moves;
  - continuity across cuts;
  - light and lens;
  - rhythm and genres.

  The scorecard is an honest running assessment of where ClearFrame stands (2.8 / 5 at baseline) and what each loop moves.

- **The library is files.** Palettes, treatments, sketches and playbooks moved out of code into `library/`, one file per item (JSON, and `.mjs` for built-in sketches that lay out per frame size). The engine validates every item on load, including palette contrast. A project's own `library/` and shared libraries (`--library DIR` or `CLEARFRAME_LIBRARY`) add or override items by id; they are JSON only. `new` copies any shared palette or treatment it uses into the project so the project renders without the shared library. Palettes now have one source: the renderer's copy is gone (it keeps a paper fallback), and its tests read `library/palettes/`. Tests and docs no longer pin item counts. See `library/README.md`.
- **Sizzle toolkit.** A `solid` canvas element draws 3D wireframe polyhedra (tetra, cube, octa, icosa, dodeca) turning in space, with perspective, depth-dimmed back edges and draw-on. Particles gain `stars` and `warp`. Also a `neon` palette, a `tech` treatment and a `sizzle` playbook (a brand reel: claim, numbered chapters, a contrast, a colour-block question, a wordmark). Chapter numbers like "01 · Software" no longer read as unsourced figures.
- **The picture keeps pace with the voice.** A scene no longer sits empty while the narration talks. A drawing whose elements are all cued to late words has its first element pulled forward to the first word, and number blocks enter with the voice while their count (`count_seconds`) still lands on its word. `check` reports every case, and `pace: "hold"` keeps a deliberate wait.
- **One continuous take for the voice.** The narration is recorded as one Gemini 3.8 TTS take for the whole film by default (`voice.takes: "film"`), sent as one text part with one short style, then cut into beats by measured word timings. Stitched per-line styles made the voice drift. Per-beat `style` is ignored in continuous takes (`voice.perBeatStyle` opts back in). `critique` warns about long style strings, stage directions in the text, heavy tag use and per-line recording. The `gemini-tts` and `clearframe-script` skills and the guide cover how to prompt 3.8: cast, one short style, delivery written into the words, and tags used sparingly.
- **Mosaic craft, round two.** `flow: "contour"` lays rows parallel to the outline. Later shapes knock out the tiles beneath them and bend the nearest `halo` rows around themselves. Recolour state carries across world beats (it used the beat's clock). Calmer cuts (±4° turn) and fewer pale tiles. Shapes are capped at about 12,000 tiles, and canvas-wide mosaics leave backdrop-sized shapes flat. There is a new `niche` sketch.
- **Mosaic.** `mosaic` on any canvas shape (or the whole canvas) lays it in hand-cut tesserae (slanted corners, varied widths, pale pieces, a lit bevel, one dark grout bed that appears only under placed tiles): fills tile in running-bond rows or concentric rings on a grout bed, with an outline row following the contour. Strokes become beaded lines, and gradient fills are sampled per tile. `enter: assemble` builds a shape tile by tile (dropping in, or `build: fly` swarming in from a point) and `exit: scatter` throws the tiles loose. `recolor` fronts flip tiles to new colours (dusk to night, or a seeded share of them for data), and `glint` makes held tiles shimmer. A `mosaic` palette, a `mosaic` backdrop (static, cached tiles) and a `mosaic` treatment complete the look.
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
