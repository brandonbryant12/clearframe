# Independent review: motion phases

Reviewed 2026-10-03. Verdict: **prototype; no remaining material finding in the reviewed timing foundation or two retained fixtures.** Continuous playback has not been observed. The review covers source contracts, pure timing checks, sampled encoded phases and reported saved-scene reproduction; it does not approve a finished film or a data encoding.

## Scope and resolved finding

Read `engine/lib/motion-phases.mjs`, sculpture preparation, CLI argument handling, the Blender render driver, all nine recipe phase declarations, the portable packager, focused tests and `docs/motion-phases.md`. The contract consistently describes qualitative authored pose time. No financial time, amount, causal model or physical simulation is inferred from these durations or dimensions.

The initial CLI silently ignored an explicitly supplied empty `--phase-seconds` argument and prepared the default timing. The author changed the presence check and added regression coverage. Reviewer reran `node engine/cli.mjs sculpture reserve-gate --phase-seconds '' --dry-run`: it now exits 1 while trying to read the empty path. The error could be friendlier, but the malformed request no longer succeeds with unintended timing. No remaining material source defect was found.

## Timing and planning checks

Reviewer-run focused tests passed **4/4**, including default phase boundaries, explicit phase retiming, encoded frame planning and malformed partition rejection. Additional reviewer checks exercised **189** successful original/custom serialized identity round trips across the nine recipes, FPS values 12, 17, 24, 30 and 60, and durations 1, 1.5, 4 and 12 seconds. Six short default combinations correctly failed the declared minimum hold constraint. These are pure contract checks, not additional rendered specimens.

Default encoded frame `i` still evaluates the original `i / frames` pose. The extra endpoint at `i = frames` is baked for closure checks and is not an encoded frame. Resolved phase ranges are zero-based and half-open; Blender frame 1 corresponds to encoded frame 0. Default boundaries select the first frame within the authored interval. Custom timing rounds cumulative boundaries and maps those exact frames to authored phase boundaries. Thus native cues must use resolved times rather than unrounded requests.

The planning helper returns source-frame selections; it does not encode a retimed clip, interpolate poses, recompute physics or modify a storyboard. Trims retain all non-hold phases and cut only within declared holds. Minimum phase durations and optional final reading hold are checked on the selected plan. Faster plans can omit source frames, including the last encoded source frame; repeated frames are an intentional slower-playback mechanism. A loop flag remains intent, not seam acceptance. The nine declarations distinguish six whole-cycle loops from the three one-way reveals; they do not invent static internal holds for moving cycles. Assets without a motion manifest remain supported.

## Exact retained artifacts

Both fixtures are draft 48-frame, 12 FPS, four-second clips. Reviewer compared the packaged files in `assets/` with `build/clips/` and with their receipt hashes: clip, scene and poster hashes match; render configurations match between copies.

| Fixture | Format | Resolved phases | Clip SHA-256 |
| --- | --- | --- | --- |
| reserve-gate | 960 × 540 | closed `[0,12)`; opening `[12,24)`; hold `[24,48)` | `0e8f5369ef3c13890adf08a32440fd1aa322a99f40b9e9f9464384cf5a092838` |
| gap-bridge | 540 × 960 | question `[0,6)`; insertion `[6,24)`; answer `[24,48)` | `af1fb9621965b8b68347f3987e225369eadf4a90965d15bad68782cedc2b128a` |

Independently decoded and visually inspected fourteen actual encoded frames at 360-pixel width, retained in `review/`: gate frames 0, 11, 12, 18, 23, 24 and 47; bridge frames 0, 5, 6, 15, 23, 24 and 47. These cover both sides of phase boundaries, intermediate action and terminal holds. The gate clearly changes from closed to open and retains a settled terminal pose. The bridge keeps its separated question state, inserts the span and retains the joined answer. The wider portrait framing contains the plinth corners and mechanism in these samples. No sampled clipping, incorrect phase order or changing terminal pose was found. These are clean sculpture plates, without a native evidence overlay; overlay legibility and cue integration remain a composition-level check.

The retained Blender receipts report zero world-transform error for both holds in each fixture: gate 12/24 frames and bridge 6/24 frames. Source review confirms the hold check includes every object's world matrix, including camera and light transforms, at each encoded hold frame. It excludes material animation, deformations, optical settings and rendered shading. The documentation states that limitation correctly; a transform hold is not a complete pixel-static guarantee.

`verification/verification.json` reports both saved scenes reopening with exact poster-pixel equality: zero changed channels and zero maximum difference. Gate final encoded hold-step score is 0.0026041667; bridge is 0.0011574074. The reviewer read the completed report and matched retained artifacts, but did not independently rerun Blender. Their nonzero start/end differences are consistent with one-way reveals and must not be interpreted as failed loop closure. The verification report's mechanical continuity metric is not an observed playback pass.

## Remaining acceptance boundaries

No further implementation change is requested for the reviewed foundation. Keep these examples at prototype status until continuous playback and final composition are reviewed. Draft 12 FPS fixtures demonstrate phase wiring and portable scenes, not final motion cadence. Applying a playback plan still requires an actual output and review of dropped/repeated-frame cadence, boundary cuts, reading duration and any intended loop seam. Native films do not consume the sidecars automatically. The 0.5-second minimum terminal hold is a mechanical lower bound, not a promise that future evidence is readable. Other formats, recipes, timing requests and replacement visual effects need their own rendered checks.
