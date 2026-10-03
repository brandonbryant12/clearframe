# Motion timing evidence

Two existing qualitative mechanisms exercise the new [motion contract](../../docs/motion-phases.md). This is milestone 5a's engineering evidence for T05 and part of M10. It does not complete the reservoir, conveyor or camera collection.

Open [the offline clip gallery](assets/index.html). The gate is a 960 × 540 draft; the bridge is a separately framed 540 × 960 draft. Both are four seconds at 12 fps, with 48 encoded frames. They contain no quantitative values, native text or audio. Each ends with a two-second static hold. The portrait bridge's wider framing keeps its plinth corners visible.

| Operation | Initial hold | Action | Final hold |
|---|---:|---:|---:|
| Gate opening | Frames 0–11; 1 second | Frames 12–23; 1 second | Frames 24–47; 2 seconds |
| Bridge insertion | Frames 0–5; 0.5 seconds | Frames 6–23; 1.5 seconds | Frames 24–47; 2 seconds |

Displayed ranges above are inclusive for reading; machine manifests use zero-based half-open intervals. Blender frame 1 corresponds to encoded frame 0.

The exact recipes, renderer, configuration, baked scenes, posters, clips and receipts live in `assets/`. All output/source hashes are verified by the sculpture packager. Both recipes retain one-way reveal intent; neither is loopable. The pure module also preserves whole-cycle loop intent and rejects internal cycle trims, with unit coverage across all nine recipe contracts. There is no new loop render in this evidence set.

`verification/verification.json` and [its report](verification/REPORT.md) record frame geometry, color tags, decoded motion/settlement and saved-scene poster reproduction with Python auto-execution disabled. Each render receipt also records zero transform movement during both declared holds. Transform checks do not establish static materials, deformation or optical settings for arbitrary future recipes.

The [independent review](REVIEW.md) records its exact sampled frame scope and limitations. Continuous subjective playback and finished-film promotion remain unverified; these assets remain **prototypes**. 12 fps is a bounded timing test, not a default recommendation for final delivery. No new claim of artistic acceptance is made for the previous gallery.

## Reproduce

Run from the repository root with Blender installed and at least 20 GiB free. The shared gate bounds local resource use. Destinations must be new:

```sh
node engine/cli.mjs sculpture reserve-gate --draft --fps 12 \
  --phase-seconds examples/motion-phases/timings/reserve-gate.json \
  --out /tmp/motion-clips/reserve-gate
node engine/cli.mjs sculpture gap-bridge --draft --vertical --fps 12 \
  --phase-seconds examples/motion-phases/timings/gap-bridge.json \
  --out /tmp/motion-clips/gap-bridge
node scripts/verify-sculptures.mjs /tmp/motion-verification --assets /tmp/motion-clips
node scripts/package-sculptures.mjs /tmp/motion-clips /tmp/motion-gallery
node --test test/motion-phases.test.mjs
node examples/motion-phases/build-plans.mjs
```

`plans.json` binds two **unencoded** playback plans to the retained clip hashes. The gate plan trims half a second from each end and plays the remaining three seconds at half speed, yielding six seconds at 24 fps with a three-second final hold. The bridge plan plays the full clip at double speed, yielding two seconds at 24 fps with a one-second final hold. These examples validate the frame-selection map; applying a plan and judging its new cadence remain separate work. The helper does not automatically modify native storyboards.

No external artwork, copied model or paid provider is used. The independent geometry follows the repository MIT license, retained in `assets/LICENSE`.
