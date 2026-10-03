# Research studies

Two editable native chart studies and one original Blender access mechanism, each composed separately for landscape and vertical. Open [the offline preview](preview.html) to inspect the six retained clips. Videos do not autoplay.

**Status: prototype.** Source arithmetic, rendered positions, native checks, encoded phases and independent review have separate evidence. Subjective continuous playback is unverified; these are not accepted finished-film assets. Square and 4:5 have not been reviewed.

The comparison uses fictional capacity and demand indices. The second study uses fictional delay hours, a precisely bounded descriptive date window and a computed endpoint percentage. Future dates are illustrative, not forecasts. The six-second porcelain gate is qualitative: no liquid, quantity, flow rate or probability is encoded. Its closed hold, one opening and open hold are authored motion. Use native graphics for measured amounts.

## References and editable pieces

[SOURCES.md](SOURCES.md) distinguishes the observed chart details from our adaptations. Three images on one publisher page were inspected; direct original social-post provenance remains unverified. Source screenshots, market data and publisher branding are not included. The original gate translates color and hierarchy into materials; no Timmer 3D practice or endorsement is implied.

- `source/inputs.json` holds original chart values, dates, units and interval meaning. `build.mjs` generates native line, point, text and interval geometry using the existing plot contract.
- `library/palettes/research-paper.json` and `library/treatments/research-study.json` at the repository root define the reusable palette and direction.
- `library/sculptures/reserve-gate.py` and its JSON brief define the trusted optional Blender recipe. `media/{landscape,vertical}` retain the exact recipe, artkit source, configuration, baked scene, poster, clip and receipt used here.
- `build-gate.mjs` adds native type to the prepared clips. Native text, timing and chart data stay editable. Materials, gate geometry, lighting and camera changes require a new Blender pass.
- `kit.json` records all retained file hashes, including reports, original sources and previews. Pipeline IDs and source-bound receipts identify the native outputs. Paths in original render receipts describe this machine; they are provenance, not portable output destinations.

## Reproduce

From the repository root, with the existing native renderer setup:

```sh
node examples/library-kits/research-study/build.mjs
node examples/library-kits/research-study/build-gate.mjs
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node examples/library-kits/research-study/verify.mjs
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 python3 examples/library-kits/research-study/check-encoded.py
```

The gate compositions reuse included media and do not require Blender. To revise the sculpture, use fresh output directories:

```sh
node engine/cli.mjs sculpture reserve-gate --duration 6 --fps 24 --out /tmp/reserve-gate-landscape
node engine/cli.mjs sculpture reserve-gate --duration 6 --fps 24 --vertical --out /tmp/reserve-gate-vertical
```

Both commands enter the shared resource gate. Check disk space first and inspect a draft still before an expensive revised pass. Preserve the source-bound master outputs, replace the relevant `media` files, rebuild both compositions and repeat review. The original full PNG sequences are disposable intermediates; compact scene/media/receipt evidence is retained.

## Evidence and limits

Read [REVIEW.md](REVIEW.md), [native summary](evidence/summary.json), [encoded proportions](evidence/encoded-proportions.json), and the [landscape](evidence/sculpture-landscape.json) / [vertical](evidence/sculpture-vertical.json) Blender reports. `check-encoded.py` independently maps original data to native positions, tests tick and interval geometry, then probes visible observation centers and shared-clock reveal fronts in every eligible decoded chart frame. Its three-pixel 720px tolerance covers antialiasing and compression; overlapping observations and first/last half-seconds are excluded. It is a bounded point/line check, not a proof of every pixel or arbitrary future inputs.

Gate verification checks identity, geometry, color tags, visible motion, final settlement and scene reproduction with Python auto-execution disabled. Native seek checks compare forward and shuffled requests. Decoded phase and phone reviews complement these mechanical checks; none substitutes for subjective continuous playback. Silent reading holds are intentional.
