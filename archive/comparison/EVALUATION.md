# Evaluate quality and time

The question is **which renderer helps an agent produce an accepted video sooner, for
which kind of work?** Render FPS alone cannot answer it. Initial local paired results
and their quality limitations are in [STATUS.md](STATUS.md).

## Two complementary experiments

1. **Matched implementation:** identical script, recorded sound, timing, font, geometry,
   easing, resolution, frame rate and comparable encoder settings. Use the supplied
   paired fixture to isolate the renderer as far as practical.
2. **Best work within a fixed budget:** same brief, source facts, assets, requested style,
   duration and time budget, but allow each renderer's natural authoring tools. Record
   agent authoring time, repair loops, generation spend and reviewer preference. This
   tests creative usefulness and iteration friction, not pixel equivalence.

Keep these results separate. A beautiful native redesign versus an unpolished browser
baseline is not evidence that one rasterizer is better.

## Inputs and controls

- Run `prepare` once. Use its `browser/`, `native/` and `inputs/mix.wav`. Verify the bundle
  before each trial. New narration/data/font changes require a new input ID.
- Record commit/dirty state, FFFrames revision, Cargo.lock, native source hashes, Node,
  Chrome, Rust, ffmpeg/libav versions, OS, hardware and backend. `measure` collects a
  subset automatically; add Chrome and native libav details to the review notes.
- Use release Rust builds. Label Metal and CPU separately. Use two Chrome workers,
  one Cargo job, two make/Ninja/Rayon/native encoder workers, one codec thread per
  encoder worker on both paths, one Skia pipeline, and the
  shared process gate. Cargo's limit alone does not constrain upstream native build scripts.
- Freeze full-resolution settings. The starter's `finish` intentionally rejects
  half-resolution drafts. Make a separate 16:9 low-resolution source/bundle for preview
  timing; never compare it with the other path's full-resolution output.
- Both default paths target libx264 medium/CRF 16. Compare output size and quality too:
  equal CRF is not equal bitrate or identical processing. Record pixel/color metadata.
  Use the experiment's `FFMPEG_PATH` wrapper for the browser path. The native template
  aligns GOP 250 and quantizer bounds 0–69; verify `threads=1`, `keyint=250`, `qpmin=0`,
  `qpmax=69` and `crf=16.0` in the encoded x264 parameter string for both outputs.
- Pinned FFFrames writes a silent AAC track even with `AudioMap::none()`. Its raw render
  timing includes that small extra encoding step. Remove the track with stream copy
  before `finish`, time that removal separately, and preserve the raw output.
- Run sequentially and alternate order (JS/native, native/JS). Log other activity that
  might cause memory pressure. Do not terminate other tasks to make a benchmark clean.

## What to measure

| Measurement | Boundary |
|---|---|
| Setup | Downloads + tool/dependency installation, separately from compilation |
| Cold build | New target directory; label whether registry/source/Skia caches were warm |
| Warm rebuild | One defined source edit through successful release compilation |
| First review | Time to a useful reviewed contact sheet, including compile/startup |
| Warm render | Ready binary/browser dependencies → silent encoded video |
| Finishing | Common mix generation once, per-renderer mux + decoded-frame validation |
| Revision | Same requested edit (e.g. revise headline and change one value) → reviewed new output |
| Total effort | Brief → accepted MP4, including failed commands, fixes and critique rounds |
| Resources | Peak RSS, free disk before/after, cache size; measure externally when needed |
| Spend | Shared generation cost once; agent cost only if usage data is available |

`measure` writes child-command wall time, status, input identity, native source hashes and
versions to JSON and captures stdout/stderr in `.log`. Put it **inside** `codex-heavy` so
queueing does not inflate renderer time. It does not infer cold caches, measure peak RSS,
count tokens, verify the claimed renderer label, or automatically validate the resulting
MP4. Check the log's backend line and use `finish`. A zero exit code alone is insufficient.

For peak RSS, use `/usr/bin/time -l` on macOS inside the measured command; its diagnostics
will appear in `.log`. Annotate units/platform and whether child memory is included. Do
not mix that result with samples collected using a different method.

Use one warm-up plus at least three measured trials in each order where time permits.
Report all trials, median and range. Do not call three samples a statistical performance
guarantee. Record cache-warm-up separately and retain failed/aborted runs.

## Quality gate before speed claims

First verify decoded frame count, dimensions and fps (`finish`), then audio stream,
duration and start/end sync with ffprobe/listening. Confirm the final mix hash matches.
Read matching full-size stills and contact sheets at the **same absolute times**, including
first/last frames of every scene. Blind the output names during preference review if useful.

Score each item 1–5 with concrete frame/time evidence; factual/sync failures fail the trial
regardless of average score:

| Dimension | Evidence |
|---|---|
| Truth and clarity | Exact values, units, source labels, understandable argument |
| Typography | Font match, shaping, readable sizes, unclipped labels, safe areas |
| Composition | Focal point, alignment, whitespace, informative visual variety |
| Motion | Smoothness, intended easing, no flicker/pop, readable settled holds |
| Narration sync | Reveals follow the words; ending does not cut speech |
| Sound | Same mix, intelligibility, no clicks/silence/truncation |
| Image fidelity | Text edges, thin rules, gradients/color, compression artifacts |
| Editability | How easily the agent performs the same requested revision |

The initial fixture is intentionally simple. It is enough to smoke-test the path, not to
rank frameworks for all videos. Then add title-heavy, data-dense, 45–90 second narrative,
vertical/captioned, and video/image-heavy cases. The latter cases are not implemented by
this starter; author them before measuring them.

## Save the conclusion alongside the evidence

Use a short report with: brief/input ID, source revisions, exact commands, machine/backend,
cold/warm timings, failure history, artifact sizes, quality scores/review notes, total
authoring time, and the next relevant fixture. State the scope of any preference:
“Metal reduced warm render time for this vector chart” is different from “FFFrames makes
better videos” or “FFFrames is faster overall.”

Retain the unfavorable result. If setup cannot complete on this Mac, report the blocker
and measured setup work; leave quality/render entries unmeasured. Never insert the
upstream website's speed example as a local benchmark.
