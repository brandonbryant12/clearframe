# Independent review: physical mechanisms

Reviewed 2026-10-03. Verdict: **prototype; no remaining material finding in the four source variants or eight final native compositions.** Continuous subjective playback and final master preparation have not been observed. This is a source, geometry-report, artifact-identity and sampled encoded review of the retained fixtures, not physical or financial validation.

## Scope and explanatory contract

Read `DIRECTION.md`, `SOURCES.md`, `inputs.json`, both recipe JSON/Python pairs, the `artkit.py` opacity/framing changes, renderer framing metadata, `build.mjs`, `verify.mjs`, `check-mechanisms.py`, `check-holds.mjs`, phase bindings and retained receipts/reports. The two reservoir subjects reuse one authored mechanism; the warehouse and network subjects reuse the conveyor mechanism. They are four explanatory subjects, not four independently simulated systems.

The limitations remain explicit in native copy. Reservoir levels represent a qualitative access/transfer mechanism, not money, measured volume, pressure or a forecast. Four conveyor packets are graphical actors, not a measured queue; their count, speed and spacing do not encode throughput or latency. There is no quantitative perspective or camera encoding. The implementation uses authored geometry and pose changes rather than a fluid, rigid-body or network simulation. The sources document original procedural work and do not claim these objects reproduce a reference video.

## Mechanism and framing review

The reservoir preserves equal chamber floor areas and a constant sum of authored fill heights: `1.36 − 0.54u` and `0.28 + 0.54u`, totaling 1.64. The six connecting strips interpolate the levels with a constant combined volume. Fill bases stay on the common floor. The gate clears the higher level before transfer and starts closing after equalization. Its stem remains attached to the gate top while its upper endpoint stays at the fixed yoke. The transparent panels and contrasting level edges make the two levels readable in both reviewed formats. The strips are an analytic connecting surface, not a modeled liquid stream.

The conveyor uses one path-distance coordinate for all four round packets, offset by 0.85. They approach and wait before the narrow main neck, then take the separately opened bypass. The main opening remains narrower than the 0.54 packet diameter. The alternate gate opens before packets cross it. Shared arclength avoids independent easing into coincident positions; the reviewed turn samples preserve distinct packets. This remains a stylized right-angle route, with no claim of real transit dynamics.

The opt-in camera fit leaves existing callers unchanged. It fits declared mesh bounds for a fixed orthographic camera, stores its safe rectangle and subject names, and relies on the separate baked-frame check to validate animated extents. In these four variants the plinths and mechanism remain contained. The new panel opacity is explicitly stylized alpha blending, not optical glass. Camera projection bounds cannot establish rendered occlusion, so they were supplemented by actual decoded frame inspection.

Reviewer ran the focused `test/physical-mechanisms.test.mjs`: **1/1 passed**, covering 10,001 deterministic phase samples in forward/reverse order, conserved positive chamber levels, gate sequencing, packet separation, final destination and phase-contract defaults. This is a pure source test, not a new Blender render.

The reviewer inspected the baked geometry checker and matched all four reports to their exact source/clip identities. Each checks **193 frames**, including the unencoded endpoint. Reservoir maximum summed-volume drift is `4.68889855e-7`; maximum floor drift is `3.33786010e-8`, below their `2e-5` / `1e-5` bounds. Both conveyor variants report minimum center separation `0.6010472012`, greater than diameter 0.54, plus clearance from the neck/guide obstacles and the alternate gate. All projected boxes lie within the declared safe rectangle. Declared world-transform holds have zero reported error. These geometry and transform reports were read and identity-checked; the reviewer did not rerun Blender. They do not prove physical contact/friction, fluid dynamics, deformation/material stability or exhaustive pixel visibility.

## Source identity and saved-scene reproduction

Reviewer independently hashed each retained source clip, scene and poster against its receipt. Retained source files also match both receipt hashes and the current repository files. Four eight-second, 192-frame, 24 FPS draft clips are in `media/`:

| Variant | Clip SHA-256 |
| --- | --- |
| reservoir-landscape | `309050de4eec62c901c215cf91c25989f510bd55215bce0fd746c57e07cc0c46` |
| reservoir-vertical | `619f4501808f04d8b19a9e2d16e673c20667cfd2f4fc927074304bf3e481ace0` |
| conveyor-landscape | `f42e7aa4c7b88a1e03cdbbb05854490c27f940787b4c650ee3e952988c5942b6` |
| conveyor-vertical | `3b3c92c050a195f73116991e1a45f8384adde3849e3d5660eb6f64989cf28187` |

All saved-scene reproduction reports pass tolerance. **Reservoir landscape is not pixel-exact:** one channel differs by one 8-bit level (1/255), changed fraction `6.43004115e-7`. Reservoir vertical and both conveyors report exact poster-pixel equality. Do not collapse these four results into an unqualified pixel-exact claim.

Independently decoded and visually inspected 32 source frames at 360-pixel width: reservoir frames 0, 24, 53, 100, 137, 155 and 191 in both formats; conveyor frames 0, 40, 64, 84, 100, 124, 140, 155 and 191 in both formats. The samples cover initial/queued states, action, gate movement, transfer/route travel and settled terminal poses. No sampled clipping, disconnected stem, misleading level order, packet overlap or incorrect gate sequencing was found.

## Native composition and reading hold

All eight final native outputs are ten seconds at 30 FPS: eight seconds of prepared action followed by a two-second static **video** hold. The hold is derived directly from source frame 191 in decoded YUV, then encoded losslessly. The retained PNG is a reference, not the final native hold plate. The reviewer independently decoded source frame 191 and all **48 frames of each of the four hold clips**: every held YUV frame matches its source frame exactly. This source/hold equality does not imply that the later native video is pixel-identical across its cut.

Current bindings match the input hash `408ddfb59e72aec998963ff29c426cb2dc0cdf50334369103fcbaf2309858fd8`, each storyboard, source clip and hold clip. Captions begin at resolved source phase-frame times, not rounded requested seconds. Their outgoing 0.12-second fades end at the next cue. Both mechanisms' final caption starts at 6.4166667 seconds and remains through the second beat, giving 3.5833333 seconds overall. The title, source and final caption do not re-enter at the eight-second boundary. Converting prepared motion from 24 to 30 FPS does not introduce a new simulation or interpolated physical state.

The author corrected an early subject baseline/layout rejection, then found a footer scrim re-entry at the eight-second cut and a PNG/video color-path discrepancy. The final build removes the unnecessary identity view and uses a direct YUV held clip. Reviewer sampled the earlier layout and preserved 16 historical boundary captures in `evidence/independent-review/before-hold-fix/`; they are not final evidence. The final runs below supersede them.

Independently decoded and visually inspected **68 final native frames** at 360-pixel width. Reservoir subjects use frame indices 12, 45, 90, 174, 207, 239, 241 and 297. Conveyor subjects use 12, 45, 78, 102, 141, 207, 239, 241 and 297. Across all eight outputs these cover every caption phase, both sides of the eight-second cut and the terminal reading hold. Subject/title/phase text remains separated and readable; longer portrait titles wrap cleanly. The mechanism, native copy and source limitations remain clear, and the terminal composition persists without a visible restart in the sampled boundary frames. The native source line sometimes lies over the object's soft stage shadow; it does not obscure the mechanism in these samples.

All current native receipts match their storyboard and media hashes. Native checks have no errors/warnings, QA detects zero pops, and sequential/shuffled seeks match. Runs under `specimens/<variant>/build/pipeline/`:

| Variant | Pipeline ID |
| --- | --- |
| packet-routing-landscape | `2026-10-03T05-30-15-126Z-1de827e3` |
| packet-routing-vertical | `2026-10-03T05-30-20-625Z-473d712c` |
| resource-release-landscape | `2026-10-03T05-30-25-976Z-89ba7f54` |
| resource-release-vertical | `2026-10-03T05-30-31-276Z-c34462cd` |
| warehouse-bypass-landscape | `2026-10-03T05-30-36-610Z-f6fb1f26` |
| warehouse-bypass-vertical | `2026-10-03T05-30-41-962Z-5a85b8d4` |
| water-transfer-landscape | `2026-10-03T05-30-47-383Z-1642f4df` |
| water-transfer-vertical | `2026-10-03T05-30-52-671Z-72190ee2` |

Reviewer matched every encoded-hold report to the current pipeline ID, storyboard SHA, video SHA and source/hold clip SHA. The checker decodes all 300 frames, crops the projected subject bounds, scales that crop to 96 × 96, then compares mean absolute RGB channel differences. Each report checks frames 225–299 against frame 225 and compares frames 239/240 at the cut. Across the eight final reports, the maximum hold difference is `0.378110533` (threshold <0.5); the maximum boundary difference is `0.006835938` (threshold <0.1). Initial-versus-settled differences exceed 1 in every case, distinguishing action from a static whole film. This is a bounded subject-region probe, not exhaustive pixel identity, a whole-screen footer test, or subjective playback. The reviewer inspected its source and matched the reports; the full native RGB probe was not rerun independently.

The 100 final source/native images and `artifact-checks.json` are retained in `evidence/independent-review/`, separately from historical captures. The JSON records exact identities and independent decoded-hold checks.

## Remaining boundaries

No further implementation change is requested for these fixtures. Keep prototype status until continuous playback and final master review are recorded. Sampled phase/hold frames cannot settle cadence, corner-turn smoothness or the full viewing experience. World-transform holds exclude material/optical/deformation changes, and volume-box consistency is not a fluid-physics proof. Recheck framing, occlusion, contacts/clearances, phase cues, reading time and actual encoded boundaries when changing geometry, source data claims, formats or timing. These four variants establish a reusable fixed-framing and phase-binding foundation; they do not approve moving-camera variants, additional aspect ratios or measured physical/financial encodings.
