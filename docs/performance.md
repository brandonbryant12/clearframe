# Measured pipeline efficiencies

The October 2, 2026 pass removes repeated decoding while preserving review evidence and the final export check. QA makes its timeline and phone sheets from one shared decode and one-second sampler. Each output retains its original size, grid and padding. Analysis and loudness workers are capped at two; each PNG encoder uses one worker.

Rendering now counts decoded frames once, on the complete muxed file. Dimensions, frame rate, decoded frame count and unchanged-input validation must still pass before the final file is published. The preliminary silent-file count was redundant. Native rendering, resolution, frame timing, audio, encoding quality and Blender sampling are unchanged.

## Local measurements

Same prepared inputs, warm native cache, serial runs through `codex-heavy`, on the 8 GB iMac. Baseline: `f00c6de3cfba045cf78aeebdd75f67361a2f1110`. Times include the named operation, not research, creative authoring, narration preparation or earlier Blender rendering.

| Operation | Before, seconds | After, seconds | Result |
| --- | --- | --- | --- |
| Encoded QA, 53.47-second 1080p Coca-Cola film, three runs | 7.889, 7.510, 8.364 | 6.291, 6.204, 6.323 | Median 7.889 → 6.291; 20% less time |
| Complete final pipeline, 30-second 1080p feature launch, two runs | 33.481, 33.323 | 31.692, 31.732 | Mean 33.402 → 31.712; 5% less time |

These are small local samples, not a universal speed guarantee. An intermediate candidate left analysis workers unbounded and completed QA faster; the retained version honors the two-worker limit.

The final files from both pipeline runs match both baseline exports byte for byte: SHA-256 `76d732fbff03b5b36f90134e7d184ca7d098c00ee97256a6bc6c0c5b1bb6a5a2`, 900 frames at 30 fps, 1920 × 1080, with audio. The longer film's complete QA JSON, timeline PNG and phone PNG also match exactly. The encoded tests compare shared sheets against independent decodes in landscape and portrait, including fractional duration and partially filled rows. The 451-frame mux regression and incorrect-frame-count rejection pass.

## Blender experiments

Two candidates were measured and left out:

- A single animation render instead of individual frame renders took 14.801 seconds versus 15.276 on a 24-frame draft sculpture. Twelve RGB channels out of 37,324,800 differed by one 8-bit step. A roughly 3% single-pair gain did not justify changing the saved rendering workflow.
- Copy-on-write requests for retained Blender files fell back to ordinary copies on this host. Six alternating passes over 24 real files, 24.97 MB total, measured 35.25 ms with the optional clone flag versus 33.23 ms with ordinary copying. There is no measured speed or disk saving to ship here.

Blender scene construction, material quality, sample counts, saved scenes and existing reuse behavior remain unchanged.

## Repeat the checks

Prepare a fresh [feature-launch project](../examples/feature-launch/README.md), then run `pipeline PROJECT --json` against the same prepared input on each revision. Keep each run directory and compare stage times, input IDs, output SHA-256 values, QA reports and sheets. For the longer QA case, use a retained finished film with `qa PROJECT --video VIDEO`; the original source assets need not be fetched again. Keep expensive jobs serialized and the native cache warm.

Run `npm test` through the local heavy-job gate. The existing `scripts/verify-native.mjs` includes the 451-frame mux regression. Exact artifact equality establishes that these changes preserve the tested outputs; it does not substitute for reviewing a newly authored film.
