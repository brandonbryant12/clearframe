# Review a reusable piece

Run `node scripts/library-bar.mjs FIXTURE.json --out NEW_DIRECTORY`. On this Mac the runner enters the shared resource gate automatically; an outer `codex-heavy --` is also supported. Render workers and codec threads stay at two or fewer. It creates one review page, `index.html`, linking each short film, phone sheet, checks, QA and original case storyboard. A failed check exits nonzero while preserving the evidence. Use a new output directory for each iteration. The report hashes the implementation and refuses a run whose source changes while it is executing.

```json
{
  "name": "cost-breakdown",
  "reference": "A professional reference URL and the visual lesson being compared",
  "cases": [
    {"id": "wide", "storyboard": "wide.json", "at": [0.5, 2, 6], "takeaway": "The parts form the stated total."},
    {"id": "changed", "storyboard": "changed.json", "at": [6], "takeaway": "A changed source value changes its proportional part."},
    {"id": "tall", "storyboard": "tall.json", "at": [2, 6], "takeaway": "The same explanation remains readable on a phone."}
  ],
  "refusals": [
    {"id": "wrong-total", "storyboard": "wrong-total.json", "match": "specific validation error"}
  ],
  "sensitivities": [
    {"id": "value-is-drawn", "base": "wide", "changed": "changed", "at": 6, "minChangedFraction": 0.001}
  ]
}
```

`storyboard` can also be an inline object. Paths are relative to the fixture file. A case can supply source files with `files: {"assets/image.png": "source-image.png"}`; the runner copies only those explicit files and the storyboard into its case project. Supply any project-local library override the same way. It does not copy a source folder's caches or generate missing media. Audio is omitted by default; `audio: true` uses available project sound and narration without generating any.

Keep the matrix focused: 1–12 cases, at most 30 seconds and 1920×1920 pixels each, with at most six sampled times including sensitivity times. Include landscape and portrait, difficult labels, extreme but supported values, the relevant palette/caption variants, and at least one change to the field the piece promises to draw. A sensitivity compares two cases at the same size and frame rate. Alter only the field under test so a different background or unrelated text cannot satisfy the check.

The runner performs native inspection and frame audit, a full draft encode, bound QA, native-versus-decoded sample comparisons, 360-pixel phone sheets, named refusals and declared prop sensitivities. PSNR compares a native still with the lossy encoded frame at the same frame index; the default floor is 32 dB (`minPsnr` can document a fixture-specific floor). It is not an equality test. Sensitivity counts RGB pixels whose channel difference exceeds three levels; its default minimum changed fraction is 0.001. Neither number establishes visual quality or comprehension.

For an independent comprehension review, open `blind.html` first: it shows the films without their intended takeaways. Write what changed, what stayed the same and the conclusion you understood, then compare with the main report. No comprehension result is invented by the runner.

For a craft review, inspect all phone frames and the complete film, including both sides of transitions. Check text hierarchy, small labels, awkward wrapping, quantity conservation, reading time and whether motion explains the change. The report always leaves **visual and comprehension judgements open**, even when all mechanical checks pass. Record the actual review and remaining limits alongside the example; never turn the runner's exit status into a person's acceptance.

## Check the runner itself

`test/fixtures/library-bar/runner-controls.json` intentionally fails. The existing `split` sketch should pass in landscape and portrait; changing its parts should change pixels; negative parts should be refused. A metadata-only change is deliberately presented as a visual change, and a portrait text line is deliberately clipped. The runner must flag the unchanged sensitivity and the clipped text. The October 18 calibration did so, while the native/encoded samples measured 40.51–44.51 dB. These measurements describe this fixture, not the entire library.
