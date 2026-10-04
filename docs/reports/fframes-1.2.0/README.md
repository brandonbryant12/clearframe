# FFFrames 1.2.0 upgrade verification

The stable upstream release is pinned at `055bb6b9dcbbcca6532206847d43ea8e81fa2a0b`
([release](https://github.com/dmtrKovalenko/fframes/releases/tag/v1.2.0)).
The MIT notice is retained in `fframes/UPSTREAM-LICENSE.txt`. The encoder remains
libx264, with one Metal pipeline and two encoder workers. Skia's new geometry
cache and automatic GPU YUV export use upstream defaults.

- Final Node suite: **218 passed, no skips**.
- Final native suite: **65 passed, no skips**.
- New 49-frame/24 fps regression fails at output offset 61 on unpatched 1.2.
  The updated vendor patch changes only the output-duration conversion to round
  upward, then all 65 tests pass. Upstream draining/seeking code remains intact.
- Encodes: 4560 frames at 30 fps for the full block gallery; 180 at 60 fps; 451 at 30 fps;
  and 90 at 30 fps with 48 kHz stereo AAC. Receipts bind sources and output hashes.
- Eight static interior color swatches and the full sampled 640×360 frame match
  the prior 1.0.1 encode exactly after RGB decoding. This is a bounded comparison,
  not a general calibrated color-fidelity claim. Audio is structurally present
  and non-silent; no listening review is claimed.
- Independent review inspected six sheets and 16 full landscape frames. It found
  no obvious sampled missing-content regression. Dense vertical secondary copy
  remains small; this is not blanket phone readability or continuous-playback
  acceptance.

## Existing audit limitation

The ordinary full verification script stops on the vertical quote's conservative
logical text-box overlap error. Running the retained 1.0.1 binary on the exact same
prepared job produces the identical error. Actual 56.4 s and 57.6 s images show the
quote mark and text visibly separated. Production checks remain unchanged.
The retained verification harness permits exactly this one matching baseline
error to continue the remaining fixtures and records it in `verification.json`;
it fails on any different error. Other aspect-ratio and dense checks have no
errors. This does not claim the normal unmodified full harness passes.

The first synthetic audio fixture used a 3-second beat with no voice. Existing
mix rules muted its bed and normalization failed on the resulting silence. The
final audio fixture uses five 0.6-second beats so its synthetic tone is audible.
That existing silent-mix limitation is outside this renderer upgrade.

The full source/render workspace is retained under
`build/fframes-1.2-final/`. `verification-harness.mjs.txt` records the exact local
harness (its relative imports assume it is copied back into `build/`).
No paid generation or external customer data was used.

The retained harness resolves its baseline from this report by default when run from the repository root. Set `CLEARFRAME_BASELINE_AUDIT` to override it. Reviewed JPEGs are preserved in `review-frames/`; each image has a `retained_path` in the review report.

The retained failure log has trailing whitespace removed. The source diff uses zero context; changed code is unchanged.
