# Framework fixes and adjacent findings — 2026-09-28

The reported bugs reproduced in the shared ClearFrame repository. The browser blocks are used by the JavaScript renderer; music generation and timing also feed the FFFrames path. Existing FFFrames work was preserved.

## Fixed

| Area | Cause | Change |
|---|---|---|
| Horizontal bars | Each row sized its own label column; flex layout shrank a bar to fit its value text. This shifted zero baselines and distorted proportions. | Shared column widths and equal reserved value space. Bar geometry is independent of text width. |
| Vertical bars | Wrapped labels and flexible bar heights shifted baselines and changed scales. | A shared plot height, common label area, and separate positioned value labels. |
| Chart annotations | A focus note could occupy the same space as a value; portrait sources could touch wrapped category labels. | Notes have a layout row; portrait source space is reserved. |
| `stat` and `kpis` | The counter replaced its parent's `textContent`, removing the appended long suffix on the next frame. | A dedicated numeric span owns the counter; the styled suffix is its sibling. Odometer styling remains intact. |
| Bar focus | The block did not forward opacity settings to the kit. Repeated focus calls also left the newly selected bar dimmed. | `focus.dim` accepts 0–1, defaults to 0.28; `focus.dur` defaults to 0.5 seconds. Moving focus restores opacity and original colors. |
| Invalid bar data | All-zero data divided by zero; negative/nonfinite values and an undersized maximum could silently misrepresent the chart. | All-zero data has zero-size bars. Other unsupported values fail with actionable errors. |
| Lyria request | The script and engine explicitly requested WAV. | Both use MP3; the Interactions request is `response_format: { type: 'audio' }`. The CLI defaults to `music.mp3`. |
| Music response | An unrecognized MIME type was silently saved with an MP3 extension. | MP3 aliases are recognized; known alternate response formats retain their real extension; unknown/empty output fails. |
| Music cache | Matching metadata could suppress regeneration even with no audio file. The plan ignored changed prompts. A stale WAV could shadow an MP3. | Plan and generation check the same intent hash plus an existing nonempty bed; timing follows the recorded file. Existing valid paid beds remain reusable. Legacy OGG is discoverable. |
| Music replacement | Alternate beds were removed before replacement bytes were safely written. | Stage the new audio and metadata before replacing files, then remove alternate formats. Failed requests and staged-write failures preserve the existing bed. |
| Prompt CLI | `--prompt` ignored `--seconds`, BPM and key unless `--style` or sections were also provided. Timestamp rounding could produce `0:60`. | Structured options now apply with either prompt form; timestamps normalize across minute boundaries. |

Example focus configuration:

```json
"focus": { "label": "Routing", "dim": 0.65, "dur": 0.4, "note": "Largest improvement" }
```

`focus.index` refers to displayed order after sorting. Prefer a label when data may be reordered. Negative bars require a separately designed diverging chart; they are not silently clamped to zero.

The [Google music guide](https://ai.google.dev/gemini-api/docs/music-generation#output-format) describes MP3 as the default. Its WAV prose and examples are inconsistent. ClearFrame follows the MP3 request examples; this change does not establish live WAV support. TTS, local draft beds, RealTime PCM-to-WAV, and the final mix continue to use WAV where appropriate.

## Verification

- New browser tests failed against the previous implementation for all three chart layouts, suffix persistence and focus configuration; they pass after the changes.
- 42 tests passed, including the existing render smoke test, landscape/portrait block QA, FFFrames bridge tests, forward/backward seeks, focus changes, zero/invalid bars, mocked Lyria generation and cache/write failures.
- Full suite: `FFMPEG_PATH="$PWD/fframes/tools/ffmpeg-limited" /Users/brandon/.local/bin/codex-heavy -- node --test --test-concurrency=1 test/*.test.mjs fframes/test/*.test.mjs`.
- Reviewed contact sheets for five representative beats in each orientation, under `build/framework-regressions/{landscape,vertical}/contact-sheet.png`. Their automated QA reported no errors or warnings. This also exposed the portrait source overlap, now covered by a dedicated test.
- No paid Google generation was performed. Request tests prove client behavior, not live provider availability.

## Additional audit candidates

These separate number-widget behaviors were found in source review and are not changed by this patch:

- `cf-kit-plus.js`'s odometer uses absolute values for both its digit template and animation, so negative input has no sign. Its digit-column count is also fixed at creation; chaining a larger value can outgrow it. A useful next regression is `0 → -4.2`, plus `9 → 120` via `.to()`.
- `_lib.js`'s `decimalsOf` counts characters after a decimal point without parsing an exponent. Scientific notation such as `1e-7` can be rounded to zero by auto precision. `bars.js` has the same precision inference pattern. Explicit `decimals` is the current workaround.
- `delta.js` substitutes a zero percent change when the initial value is zero; it also chooses the minus sign for unchanged values. Define the zero-baseline presentation explicitly (for example, “from zero”) rather than implying a calculable percentage.

The current general QA checks do not establish that every pair of text boxes is free of overlap. The dedicated chart test now checks focus-note/value and category/source separation; other blocks still benefit from contact-sheet review.

## Full FFFrames changeover follow-up

The browser-specific fixes above are preserved under `archive/browser`. The active renderer now implements native counters, zero-based bar geometry and configurable focus. The migration also exposed and corrected these adjacent issues:

- Native SVG conversion dropped dynamic decoded video images unless `compile-time-svgtree` was enabled. A regression covers the image node's survival.
- The pinned media decoder did not drain delayed B-frames at EOF, losing valid final video samples. A small vendored patch documents the upstream revision and regression.
- Timeline time labels were lost while titles remained; native rendering now retains both.
- Video source offsets were mistakenly treated as timeline delay. Native source-frame selection now preserves the scene clock.
- Variable-font default weight could flatten the hierarchy. Bundled static Inter400/600 instances now give metric and rendering queries the intended weight.
- Spoken cues matched prefixes, allowing the wrong word to trigger motion. They now use normalized complete-word/phrase matching, including Unicode.
- Imported voice could be replaced by a draft generation command. Matching imported recordings are preserved unless explicitly forced.
- Measured timestamps could become stale when the recording changed. They are tied to the WAV hash, exact transcript and validated intervals; final speech-following scenes reject estimates.
- Caption exports no longer add arbitrary overlap, and require measured timing unless `--draft` is explicit.
- Omni caches include reference bytes, palette and continuity instructions; a successful-looking metadata record without the actual clip is not a cache hit.

See `docs/verification.md` for the exact test/render evidence and limits of paid-provider verification.
