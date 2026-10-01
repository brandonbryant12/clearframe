# Material studies — October 2026

This pass evaluates the project as a reusable motion system, with a bias toward light professional work plus expressive playful forms and a smaller dark range. [Open the visual atlas](index.html). [Image direction workflow](../../image-direction.md).

## Findings and changes

- The native foundation already has broad capabilities: canvas geometry, deterministic frame evaluation, palettes, treatments, layered imagery, camera motion and QA. The most useful improvement was authored material variety and easier reuse, rather than another renderer.
- The earlier sheets leaned on dark staging or pale cards with similar composition. Added ten original parametric background sketches: `lightwell`, `contour-field`, `paper-fold`, `glass-orbits`, `bubble-cluster`, `ribbon-wave`, `petal-burst`, `inflated-loop`, `arena-grid`, `prism-shards`. They reserve a copy region and adapt to four built-in formats.
- Added `daylight` and `sorbet` palettes, validated for text contrast, and `studio`, `buoyant`, `arena` treatments. Existing `neon` supplies the dark family.
- Promoted the playbook-only `art.sketch` shorthand to ordinary storyboards. Authored under/over layers survive expansion; opacity controls the generated art group. Invalid scene-camera sketches fail clearly. Custom dimensions reach the parametric builders.
- Refreshed schema references for the new art fields and current canvas sketch vocabulary. `catalog:sync -- --references-only` avoids regenerating unrelated recipes.
- Independent review (Claude Code, `claude-opus-5-5`): the materials ignored `seed`, although the docs passed `seed: 17`, and the previews barely moved (0.3 grey levels per second for the daylight study, held for 12.4 of 12.8 s). Every material now reads `seed` through `jitter(seed)` in `_material-kit.mjs` (fold corners, lens angles, petal count, lobe direction, gate shape), with the unseeded layout unchanged and copy clearance tested across 40 seeds and four formats. New `art.drift` adds a frame-keyed push-in about the frame centre over the beat, with seed-chosen sideways travel, that never holds the beat. The examples use per-beat seeds and drift 0.5 / 0.8 / 0.8; change per second is now 0.77 / 5.46 / 4.11.
- Retained the cinematic safeguards from the earlier feedback pass: actual staged-item cue warnings, explicit outline-fill advice, picture-area held detection and resumable long-render guidance.

## Imagegen iterations and native refinement

The built-in imagegen tool produced `concept-01.png`: paper, glass and inflated materials. `concept-02.png` refined those into simpler geometry and clearer layers. Exact prompts are in `prompts.json`. They are inspiration records, not runtime dependencies, exact brand-colour references or claims of physically accurate materials.

Native reconstruction added broad folds, double optical rims and a layered hollow ring/capsule. An independent reviewer inspected the first native sheets. We corrected over-spaced small type, the ring's gradient seam, a metallic-looking bead, faint paper edges and an overly dense ribbon. The final independent review found no remaining visual blocker for reusable assets, including the portrait adaptations and decoded phone sheets. These are intentionally stylised 2.5D approximations; they do not reproduce the generated image's photorealistic paper fibres or refraction.

The three examples are library studies, not complete narrative films. Their repeated label layout makes materials comparable. In a real film, select a few relevant forms and mix them with mechanisms, evidence and changes in shot scale. Ambient motion alone does not make a story cinematic.

## Reproduce

```sh
node examples/material-studies/make.mjs
node engine/cli.mjs check examples/material-studies --draft
node engine/cli.mjs sheet examples/material-studies --draft
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node engine/cli.mjs render examples/material-studies --draft
node engine/cli.mjs qa examples/material-studies
```

The maker also writes `examples/material-play` and `examples/material-arena`. Pass `--vertical` to write portrait copies under `build/material-vertical/` without changing the landscape examples. Save manual edits before regenerating the landscape examples. All examples are silent to isolate visual motion. Their renders do not assess speech, sound or factual storytelling.

## Evidence and remaining limits

See `verification.json` for the executed checks and artifact paths. Contract checks, native rendering and decoded-frame QA are separate from aesthetic review. No new overall project score is asserted; the historical scorecard remains historical. The benchmark suite was inspected for recurring patterns but was not fully rerendered in this bounded pass. Exact external brand fonts still require an approved font asset and supported role mapping; prompting imagegen with a font name cannot guarantee it.
