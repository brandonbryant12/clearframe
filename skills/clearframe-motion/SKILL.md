---
name: clearframe-motion
description: Design native FFFrames motion, color, typography and scene rhythm for explainers, lessons, personal stories and practical guides. Use for visual variety, cue timing, entrances and readable speech-following text.
---

# Motion that serves the story

Read `docs/style.md` and use the active native catalog. The audience and subject set the mood: an energetic lesson, quiet memory and analytical report should not all feel the same. Keep factual graphics legible and each scene focused on one visual idea.

## Compose for a video frame

The renderer ships Inter (text, 14 pt optical master), Inter Display (300/600/700, 32 pt master) and Inter Display Figures (tabular digits for counters), measured with the same shaper that draws them. Do not prescribe fonts the renderer does not ship. Use `emphasis` or `highlight` to point at the words that matter instead of adding more text. A headline, graphic, source and optional captions need distinct space. Check portrait layouts at phone size, including the intended platform's overlays; the native header reserves 11% at the top, but this is not a universal platform safe-area guarantee.

Film output has no slide fraction or scene counter. `chrome` defaults off; its optional title/progress rail does not add numbering. Keep source labels meaningful and readable.

Use charts for evidence, `magnitude` for orders of magnitude, `flow` for an ordered mechanism, `cycle` for repetition, `icon-grid` for related concepts, `checklist` for a routine, `chapter` to open a section, `annotate` to walk through a screenshot, `breathing` for a continuous paced visual, and `kinetic` for speech. Mix these with real media when it carries information. Avoid a sequence of static title-and-bullet scenes: vary the block, the layout direction and the pace.

## Choose motion explicitly

`motion.preset` is `gentle` (0.55 s quartic), `snappy` (0.30 s exponential) or `spring` (0.72 s damped spring); `intensity` 0–1 scales travel, and 0 keeps fades only. Entrances are `cut`, `fade`, `rise`, `wipe`, `push` and `zoom`, applied over the persistent background; each scene's exit automatically mirrors the next entrance (override with a beat `exit`), and the film ends on a fade. Scenes never cross-dissolve. Use coherent entrances within a sequence; a cut is often sufficient, and elements still animate in.

Native counters and chart growth remain monotonic even with spring entrances. Keep scale, sign and suffix truthful throughout motion. A focused bar uses authored `dim` and `dur`; do not hardcode them in new blocks.

`land`, `growSay`, `drawSay`, item/node `say` and bar `focus.say` can reference an exact spoken word/phrase or local seconds. Cues must exist. Stagger related items so viewers can follow the order. For `flow`/`icon-grid`, `stagger` controls spacing; explicit cues take precedence.

Cycle `period` and direction are editable. Breathing phases carry their own label, duration and expand/hold/contract behavior; `ring` controls the fixed guide. Set sufficient beat duration to show the intended motion. These are authored pacing visuals, not health promises.

## Let the words lead

Kinetic highlight/reveal/word modes use measured, audio-bound intervals. `maxWords`, `maxGap` and `maxDuration` keep phrases readable across pauses. A word is never split to fit a phrase duration. Preserve silence and end-exclusive timing. Final speech-following output must reject estimated or stale alignment; see `docs/speech.md`.

## Compare and inspect

Choose among `paper`, `ink`, `editorial`, `signal`, `midnight`, `forest`, `ember` and `mono` (`clearframe themes`), then override palette tokens. The `glow` backdrop adds slow-drifting light for dark palettes. Use `looks DIR --beat ID` to compare the same moment across all eight presets. Its JSON sidecar identifies each tile. Media retains its own colors; palette comparison is not automatic footage recoloring.

Run `sheet`, open it, then `check` and `render`. Use `review DIR` to inspect actual encoded frames around cuts and word boundaries. Listen to the mix and check the first/last spoken words. Numeric diagnostics cannot establish factual accuracy, readable composition or perceptual audio quality.

When borrowing from GitHub, use MIT-licensed imports at pinned revisions, keep notices, and preserve the simple Node/JSON/FFFrames stack. See `docs/research/2026-github-video-patterns.md` for reviewed recent projects and adopted ideas.
