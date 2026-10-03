# Drivers and flows

Six original fictional cases, with separate landscape and vertical compositions: event-aligned adoption and project recovery, earnings/income and price/volume decompositions, and fund-assets and warehouse-stock reconciliations. Open [the offline preview](preview.html) for all twelve retained clips.

**Status: prototype.** Native checks, source calculations, encoded quantitative probes and independent sampled review have retained evidence. Subjective continuous playback remains unverified. Square and 4:5 have not been reviewed.

## What the scenes explain

- **C02 — event alignment:** preserve actual dates and original units, rebase each observed start to 100, then compare on one elapsed-day axis. The violet region shows older history beyond the newer record. It is not a forecast. Recovery includes an explicit missing older observation at day 120.
- **C03 — drivers:** reconcile an exact two-factor product change with a separate interaction and additive amount. Contributions are percentage points; the closing value is percent change. Cash in the earnings case is separate and not reinvested. Factor decomposition is an accounting identity, not causal attribution.
- **C16 — stocks and flows:** connect an observed opening stock to an independently observed closing stock using supplied signed changes and a visible unexplained residual. The warehouse case includes a negative residual. Row order is arithmetic, not event timing.

## Edit and reproduce

`inputs.json` supplies dated bases, raw units, factors, signed changes and declared plotting domains. `build.mjs` generates all twelve native storyboards and `audit.json`, which binds the results to the input SHA-256. `source/bridge.mjs` is the reusable native bridge composition. The shared [data helper contract](../../../docs/data-transforms.md) describes exact formulas, validation and limits. The scenarios are original demonstrations, not market data.

From the repository root, with the existing native renderer setup:

```sh
node examples/library-kits/drivers-and-flows/build.mjs
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node examples/library-kits/drivers-and-flows/verify.mjs
/Users/brandon/.local/bin/codex-heavy -- python3 examples/library-kits/drivers-and-flows/check-encoded.py
```

Change inputs, labels, timing and palette in native source. Keep domains shared and bars equally thick; review any new copy or values for overflow, clipping and legibility. Check disk reserve before rendering. There are no Blender or paid-generation dependencies. Original receipts contain machine paths as provenance; regenerate outputs in your own checkout.

## Evidence and limits

[Independent review](REVIEW.md), [pipeline summary](evidence/summary.json), [encoded proportions](evidence/encoded-proportions.json), and [file manifest](kit.json) retain separate results. The manifest hashes original source, native clips, sheets, phase evidence and reports. Native seek requests are compared in forward and shuffled order at four phases of each beat.

The encoded checker independently recomputes the input identities and native mappings. At 720px width it probes rectangle edges within 2.5px, observation centers and reveal fronts within 3px, future columns and the missing-observation column. It streams every frame, probes the quantitative beat, and excludes first/last half-seconds, faint or under-four-pixel bars and overlapping observations/fronts. Equal bar thickness and independently checked lengths establish native rectangle-area ratios; the encoded check is bounded sampling, not a full pixel-area census. Encoded phases and phone sheets do not establish subjective continuous playback or final-film pacing.
