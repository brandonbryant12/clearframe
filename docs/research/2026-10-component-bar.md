# The component bar: what earns a place in the library

Review of the research tracked in [issue #9](https://github.com/brandonbryant12/clearframe/issues/9) (32 entries, October 10–14), the [fframes-components](https://github.com/Bilaal0x/fframes-components) gallery at [`6730690d`](https://github.com/Bilaal0x/fframes-components/tree/6730690d3d61123214b2bc01b8b1fbc357d51472) (47 components, crate v0.1.2), and an audit of ClearFrame's own library against what came out of it. No code was copied. Where an idea was taken, it was implemented independently in the scene engine.

## What the research says a good component is

The sources that taught the most agree on a short list. A component's polish matters less than whether it does one job with real content and stays honest when that content changes.

- **One job, tied to what is said.** [awesome-ai-motion](https://github.com/gongnyang/awesome-ai-motion/tree/1e3c249073c61b42ceb556d7800f628d565d9312)'s cards start from the communication intent ("motion hierarchy: one first thing to read"), give timing defaults, and show a failure example next to the good one. A card with no intent is decoration.
- **Real controls, not baked copy.** fframes-components' `answer-highlight` exposes the question, the answer, the selected phrase and the timing as configuration. Its `logo-assemble` takes a logo field and then draws a monogram, and its `text-marker` hard-codes colour, roughness and width. The second kind looks fine in a gallery and fails on the first real brief.
- **Attached to its target.** The selection in `answer-highlight` stays on the words across a line break. Snapcn's AnswerStream reserves every word's final position before revealing it, so nothing reflows. Annotation that is placed by coordinates drifts the moment copy, font or format changes.
- **Holds survive revision.** Leon's product-shot article and the TimelineBench validation notes make the same point from two sides: test the longest copy in the real font, and judge a scoped edit on the whole cut, not only the repaired frame.
- **Restraint is the register.** Stephen Wu's rejected first cut of the column-permissions trailer (oversized tilted title strips) and published cut (one stable table, changing what each audience sees) is the clearest before/after in the tracker. Visual excitement did not satisfy accuracy or house style. Miles's reel makes the same point positively: one silhouette and a two-colour inversion carry more change than particle density.

## The bar

Every block, sketch, treatment, palette, playbook, transition, entrance and example now has to meet all six. It is written into `library/README.md`.

1. **One job.** It shows something the narration says changing (a mechanism, a comparison, a step), or it is a necessary neutral surface. Decoration-only fails.
2. **Reads on a phone.** The settled frame reads at 360 px wide: one first thing to read, nothing cut off, overlapping or empty.
3. **Restrained motion.** Arrivals and travel have a purpose. Information never bounces past its size, and nothing flashes, glitches or shakes for emphasis.
4. **Real content.** Copy and numbers are props, and annotations are attached to their target.
5. **Professional register.** No comic bursts, halftone pop art, synthwave grids, hyperspace tunnels, retro sunbursts, neon, lens flares or trailer looks. No muddy blur standing in for depth, and no placeholder titles.
6. **Works and is distinct.** It validates and renders, its cues fit its beat, and it is not a near-duplicate of a better sibling.

## fframes-components, component by component

Most of the 47 are generic text entrances, which ClearFrame's `kinetic` block and canvas text entrances already cover, or showpieces that fail bar 5. The one family that earns a place is the one that marks the exact words it points at.

| Verdict | Components | Why |
|---|---|---|
| **Adopt the idea** | `text-marker`, `circle-marker`, `strike-through`, `crossed-off`, `answer-highlight` | Emphasis attached to measured words: the job workplace films need (the clause of a policy, the button to press, the old way struck out). Bench agents were hand-placing rings by guessing `rx = w/2 + 16`. Rebuilt natively as canvas text `marks`, below. |
| Already covered | `type-writer`, `multi-text-typewriter`, `word-by-word`, `staggered-fade-up`, `slide-in-text`, `short-slide-right`, `soft-blur-in`, `tracking-in`, `per-character-rise`, `top-down-letters`, `bottom-up-letters`, `text-reveal`, `text-build`, `text-highlight`, `typing-code-block`, `channel-thread`, `text-messages`, `prompt-zoom`, `cursor-flyover` | Canvas `type`, `rise`, `blur`, `wipe` entrances, the `kinetic` block, the `highlight` block, stages' commit-grounded code, and the `chat`, `portal` and `compose` sketches. |
| Skip | `cinematic-text-swap`, `glitch-cycle`, `confetti`, `inflating-text`, `echo-stack`, `squeeze-in`, `period-drop`, `spring-scale-in`, `spinning-text-wheel`, `word-flip`, `text-swap`, `text-rewrite`, `text-swell`, `word-gather`, `lines-to-text`, `check-cycle` | Fail bars 3 or 5: glitch, bounce, confetti, outline echoes and rotating marketing words. |
| Skip | `logo-assemble`, `reel-collage`, `carousel-3d` | Photo-collage brand openers (bar 1); `logo-assemble` does not draw the supplied logo, and `carousel-3d` is a 2.5D squeeze. |
| Skip | `youtube-comment-highlight`, `youtube-end-card`, `youtube-subscribe-nudge` | Creator-channel furniture (bar 1). They are also ports of Remotion Elements whose component licence was not established. |
| Defer | `map-flyover` | A route between cities is a real job for client and market films, but it pans one 4096 px satellite JPEG with no zoom, and the asset would be the largest binary in the repo. Revisit with a vector basemap. |

Licensing: the crate is MIT. The rough-notation recipes it ports are MIT (roughjs, @remotion/rough-notation). The nine newest components cite Remotion Elements, whose licence for those files was not established. ClearFrame's marks reuse its own rough stroke (`rough_contour`, written for the canvas `rough` field) and take only the vocabulary of styles, not code.

## What changed in ClearFrame

**New: `marks` on canvas text.** `marks: [{words, style, say|at, after, dur, color, width, pad, rough}]`, 1–4 per text element. The renderer finds the words in the laid-out text (whole words, across line breaks, honouring `width`, `anchor`, `fit` and `upper`). It sweeps a `highlight` band behind them, or draws an `underline`, `circle`, `box`, `strike` or `cross` over them as one confident hand stroke. Marks are part of the text's node, so they move, tilt and exit with it. Validation refuses words that are not in the text. Stages refuse marks by name, as they do every canvas-only feature.

**Pop no longer bounces.** The `pop` entrance, the default for icons and circles and the most-used explicit entrance in round 18–19 bench films (44–90 per film), scaled from 55% with an expo or spring curve. It now settles from 86% and never passes full size under any preset. Block badges and markers settle from 86% too, down from 60%.

**Sound stops scoring trailers.** Every pop arrival used to add a pitch-dropping "bloop" (up to four a beat, eight when punchy). Every wordless beat after 3 s got a 2.5 s riser into it and a drone under it, and every `flash` cut got a deep hit. All three were automatic. They are gone; an author who wants a sound names it with `sound` on an element or key.

**New: `document` and `pointer`.** Two more pieces in the same vein, chosen from what bench agents kept hand-building badly. A `document` is a page of real text: sections laid out by the shaper that draws them, scrolled to the clause the voice names, and marked. It replaces grey placeholder bars, which the audit flagged in several playbooks. A `pointer` presses elements by id. It arrives just before each word on a gentle curve, rests beside the label and dips with its target, so it replaces the per-sketch cursors placed by coordinates. `examples/fsa-deadline` uses both.

**Captions to a broadcast standard.** Not from the component research but from the same bar: on by default, segmented and timed after Netflix's English timed-text guide, boxed so they read over light pictures, and moved off the picture's type.

**Deferred: `map`.** A route between places on a clean vector basemap is a real job for client and market films (fframes-components' `map-flyover` had the right idea and the wrong build). Natural Earth outlines would serve, but they are public domain rather than MIT, so importing them is a decision for the owner under the AGENTS.md asset rule.

The library cull, with each item's verdict, is listed in the CHANGELOG entry for this change.

## Second pass: what two bench films asked for

Two Opus bench films were made with the new pieces (an expense policy and a parental-leave policy, both local voice and Whisper only), each writing down where the pieces fought it. Everything below answers a named defect or a piece the film had to hand-build; nothing was added for completeness.

| The film reported | What changed |
|---|---|
| A document scroll that could not move did nothing on its word; a half line at the page edge; specks of scrolled-past descenders; captions sat on dimmed page text | A scroll key brings its section into focus and the rest of the page steps back; text stays inside the margin and the fades end in solid paper drawn over it; caption placement counts stepped-back type |
| A circle round a phrase cut its letters; a stamp over type was refused, then sized from its label and see-through | A phrase gets a loop with round ends; `stamp` marks cover the words they rule on, opaque |
| The fingertip read as a stray dot; the pointer covered what it had pressed | A pale disc with a ring and shadow, a ring on each press, and the pointer moves off after its last press |
| `limit`'s labels at the 20 px floor, its amount drawn ahead of the fill | Larger type, the amount rides the fill's end |
| Forty lines for a receipt, a hundred rects for a share, a phone form and forty cues for a path through an app, a breadcrumb row by hand | `receipt` (drawn from its lines, total checked), `share` (one tile each, also a year of weeks), `app` (fields, upload slot, a button that becomes its confirmation, `pages` with rows to tap), `crumbs` |
| "Was 60, now 30" had no picture | `was-now` |
| A coordinate scaler written by hand; a scaled group that did not grow across a cut | Static `scale`, carried by a morph |
| `say: "New"` landed four seconds early on an earlier "new" | `check` names a cue said twice and suggests the phrase said once |
| Canvas headlines ignored the film's type voice | `display` follows it |

Two of the films' own suggestions were declined: a tiers mode for `limit` (one job per sketch; two caps are a chart) and squares for `was-now` (`share` draws a year of weeks).

## Transitions

Judged frame by frame across the same cut, every transition except `wipe` passed through an empty frame: the outgoing scene vanished and the incoming one built itself up from nothing, which is exactly a slide coming in, and new projects defaulted to a `fade` between every line. Professional explainers mostly cut, and the cut carries the film when something crosses it (a shared id that morphs, a camera travelling one world). So:

- **Cut is the default.** `auto` fades only where the chapter changes.
- **`into: "id"`**, the one transition added: the camera goes forward through an element of the last scene (an app screen, a page, one tile of a share) until it overfills the frame, the old scene fades behind it, and the new one comes up from slightly closer and settles. Its first version cross-dissolved too early and double-exposed the two scenes' type; the dissolve now starts only once the old scene is mostly gone. Its reverse, a pull-back from inside one of the scene's own elements, is already the canvas camera (`viewFrom`), so it got documentation, not vocabulary.
- **`push` is a real push**: both scenes move as one strip, drawn by the frame compositor the way `wipe` already was.
- **Captions and the source line hold still** across every transition; only the pictures move.
- **Retired**: `rise` and `zoom` (and the `zoom` exit), the two build-ins from an empty frame.

## Third pass: the open-enrollment bench film

The third bench film (open enrollment, local voice and Whisper) ranked what it had to hand-build. Each item was judged against the same bar and its frames checked in both shapes:

- **Built:** `carryover` (its first-ranked gap; the reset lands in next year's empty slot, and `bookend` closes on the same board), `deposit` (the employer's money landing in an account: a deposit line, then the balance, never a count through unstated figures), app row badges, `was-now` and `match` openings that move on the figures the line names first, and an `open-enrollment` example.
- **Fixed in the renderer:** a panel under the captions; an `into` through type blurs instead of showing a fragment of a word; a box per wrapped line; dimmed type counted by the caption check; an opaque stamp face.
- **Fixed in the engine:** a sketch moment bound to a word kept only its first part on the word and collapsed the rest of its sequence onto it; morphs now start where keys left an element; draft takes are cut in the real pause; a name heard as two words is measured; casts keep above the captions.
- **Declined: `fade` as a cross-dissolve.** The film said the dip through the ground left the voice over an empty frame for about 0.2 s. A dissolve was built and reverted: two scenes' type overprinting is the double exposure the library retired (`dissolve`), the dip is short and only used at a chapter change, and `into` already carries a turn without one.
- **Also built:** `every`, for the per-paycheck delta ("$6 more on each of 26 paychecks", $156 a year).
- **Left for later:** the `journey` sample's stops that open on a nearly empty frame while the camera travels.
