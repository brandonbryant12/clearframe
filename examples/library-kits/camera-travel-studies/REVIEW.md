# Independent review — bounded orbit and truck

**Verdict: prototype; no remaining material finding in the reviewed candidates.** Four prepared source clips and eight native specimens pass this bounded source, model, geometry-report, artifact-binding and encoded phone-frame review. Continuous subjective playback and final master acceptance were not observed. New scenes, copy, travel, optics or aspect ratios require fresh review. No general collision or occlusion guarantee is established.

Reviewed 2026-10-03 separately from implementation. Scope: the version-2 analytic camera helper, both source recipes/manifests, focused tests, inputs/builder, framing and replay evidence, native jobs, hold/registration checkers, documentation and actual decoded frames. The reviewer changed only this report and `evidence/independent-review`. No Blender render, browser or server was started by the reviewer.

## Current source and native artifacts

Input SHA-256: `575b16ac3ffe663dad0da93fd08d4fc14123ed09fbce5c99e49b83f5c8b25b16`.

Camera-helper SHA-256: `8b69c6bcfc913a7fe6e3a3013404422fb73463cc7ab4948ce84fce2ee932ffe4`.

Orbit-recipe SHA-256: `6e57373a31cdbd03317e480efcea7063b6813f1f1a88cd51d9d0cc5618dda006`.

Truck-recipe SHA-256: `bf21c28b125c56cfb25533c144132f94c7bee88170615d2d38b8bb6931148c55`.

The four prepared clips each contain **192 encoded frames at 24 FPS, eight seconds**. They retain a baked endpoint at frame 193 in addition to the encoded frames. These draft sources are 960×540 or 540×960. Native composition at 1920×1080 or 1080×1920 preserves their prepared image detail; it does not create a higher-detail Blender master.

Each native specimen contains **540 frames at 30 FPS, eighteen seconds**: eight seconds of source playback, followed by a ten-second explicit final-frame clip. The native hold preserves decoded YUV pixels from actual source frame 191. The reviewer independently decoded twelve endpoint frames across the four sources and holds and verified exact YUV hashes. Native output remains separately encoded, so its pixel equality is assessed with the bounded checks below. Encode elapsed time is separately named `encodeSeconds` and is not media duration.

`source-artifacts.json` binds current recipe/helper/render sources, copied source bytes, source clips, scenes, receipts, baked camera reports, replay reports and inspected source images. `artifact-checks.json` binds all eight current native storyboards, source/hold inputs, native jobs, receipts, videos, inspected captures and final registration/hold reports. Current source, documentation, tests, checker and review hashes are retained in `source-bindings.json`.

| Native specimen | Final pipeline |
| --- | --- |
| another-view-landscape | `2026-10-03T11-54-09-374Z-5f8dc856` |
| another-view-vertical | `2026-10-03T11-54-17-522Z-eeccf575` |
| partial-route-landscape | `2026-10-03T11-54-25-746Z-c5770357` |
| partial-route-vertical | `2026-10-03T11-54-33-838Z-bb6e0bc0` |
| partial-summary-landscape | `2026-10-03T11-54-41-623Z-b7056c73` |
| partial-summary-vertical | `2026-10-03T11-54-49-851Z-2fb68147` |
| side-connection-landscape | `2026-10-03T11-54-57-619Z-cc74eb4f` |
| side-connection-vertical | `2026-10-03T11-55-05-738Z-67f72a40` |

All eight native reports contain zero layout errors/warnings, zero QA pops and equal shuffled sampled seeks. The retained critique reports contain zero warnings or ideas. The reviewer independently ran the focused camera/path/phase tests: **6/6 pass**. The producer’s retained gated full-suite log reports **207/207 pass, zero failures or skips**; the reviewer inspected that log without rerunning the full suite.

## Independent model and compatibility checks

The retained pure-Python checker passes **288 orbit/truck cases, 1,308,504 assertions, 53 invalid schema/domain cases, and 2,412 exact version-1 sample comparisons** against committed baseline `2a11fc79a6dfde57ce23fa545d28a601ddfc2622`.

For orbit, the independent reference derives initial radius and polar angle using `hypot` and `atan2`, then adds the signed authored angle times eased progress. Both signed limits, ±170°, and the minimum supported ±0.01° are covered. Target, camera height, cylindrical radius, distance to target and optics remain constant. The full-circle world envelope is conservative; it need not accept every narrower arc that might geometrically fit.

For truck, each camera/target coordinate changes by the same authored translation times progress. Look direction, target distance and optics remain constant. Tests include lateral, vertical and mixed translations, both projection modes and both easing modes. Perspective parallax is a property of the supplied scene; an orthographic truck does not imply differential parallax.

Both presets have exact start and end holds. Checks include declared boundaries and adjacent floating-point phases, out-of-order sampling, JSON round trips and isolation from mutation of returned samples. Numeric comparisons permit 2e-12 relative or 2e-10 world-unit absolute error. Version-1 comparisons require exact equality with the baseline implementation, including existing timing and interpolation behavior.

Negative fixtures cover unsupported schema/version/clock/projection/easing, incomplete or surplus nested pose fields, booleans and nonfinite values, invalid optical ranges, target coincidence and vertical poles, empty or reversed holds, zero/tiny/oversized angles or translations, out-of-range sampling, and exceeded world bounds. Near a rejection threshold, floating-point subtraction can conservatively reject an exact-boundary truck pose; positive fixtures use a margin above the minimum look radius. No supplied scene uses that boundary.

## Baked scene, replay and encoded checks

The producer’s independent Blender checker covers **193 baked frames per scene, 772 total**, including shuffled seeks. It derives orbit positions with polar coordinates and truck positions with equal translation, checks camera optics, static noncamera world matrices and complete mesh/curve subject bounds within the authored safe rectangle. The reviewer inspected this checker and its final reports, independently recomputed recorded camera positions and verified each report’s scene/receipt identities. Maximum recorded camera-coordinate error is about **9.47e-7 world units**, and static world-matrix drift is zero. These report comparisons do not constitute a second Blender execution by the reviewer.

The supplied truck’s foreground horizontal displacement exceeds the rear marker’s displacement. Their ratio is **1.0797159 landscape** and **1.0830899 portrait**. Each agrees with the independently computed inverse-depth ratio within **1.33e-8** and **6.60e-8**, respectively. This establishes projected depth parallax in these authored lateral moves, not arbitrary visible-surface or collision safety.

Saved scenes reopen with automatic script execution disabled. Three poster replay comparisons are pixel-exact. Orbit portrait differs in **one channel by 1/255**, a changed-channel fraction of **6.43e-7**, and passes the producer’s retained replay tolerance. This is explicitly recorded rather than described as four exact replays. Declared opening and ending holds have zero transform and optical drift in the retained Blender evidence.

The producer’s native hold checker decodes **4,320 frames** and compares **2,520 final-hold frames** with settled frame 225 in a 96×96 subject crop. Maximum mean absolute RGB hold difference is **0.22729** against the unchanged 0.5 threshold. Maximum 239→240 cut difference is **0.00655** against 0.1. Opening-to-settled action difference is at least **7.27174**, above the required 1. These are codec-tolerant crop statistics, not exact native pixel equality or a subjective playback judgment.

The final source/native registration checker passes **168 exact shared-clock samples**, 21 per native clip. At half-second positions, both the 24 FPS source and 30 FPS native clocks land on integer frames; post-eight-second samples use the last actual source frame. The checker first normalizes both sources to identical source resolution, then compares the same subject crop. Maximum mean absolute RGB difference is **1.47421**, below the unchanged 1.5 threshold. The initial checker compared different pixel grids; matching the grids fixed that methodological error without relaxing tolerance. The reviewer read both checker implementations and final reports and bound them to current bytes; their full decode runs were not repeated.

## Independent encoded visual review

The reviewer decoded and viewed **120 actual 360px-wide PNGs**: 32 source frames and 88 native frames. Source samples are at 0.1, 1.2, 2, 3.6, 4.5, 5.95, 6.5 and 7.95 seconds for every source. Native samples are at 0.1, 1.2, 1.4, 3.6, 5.8, 6.1, 7.966667, 8.033333, 8.3, 12 and 17.9 seconds for every native specimen. Exact video/image hashes and inspected flags are retained in `source-frames.json` and `native-frames.json`.

The orbit exposes a different view of the unchanged assembly and its side outlet; its target and final inspection pose remain stable. The truck’s amber junction is visible beside the central screen initially, nearly hidden at the midpoint, and visible on the opposite side at the end. Some route occlusion remains. That is consistent with the native claims, including “Some occlusion remains” and “Still a partial view.” The reporting and methods-review cases are expressly labeled metaphors or invented models, not findings derived from data.

Native titles, phase cues and qualifications fit in both formats without covering the subject. Cue changes follow the actual source phase boundaries. The pose and final cue continue across the eight-second cut into the explicit reading hold; no source restart or visible camera jump was found in the sampled joins and endpoints. Landscape inspection details are compact at phone width; portrait gives the stronger inspection view. The revised portrait truck’s partial visibility now reads at that scale. No additional framing or copy change is requested for these supplied prototypes.

## Findings and resolutions

**Surplus nested pose fields, resolved:** the initial v2 validator delegated pose validation through `make_path`, which overwrote nested `pose.phase` and `pose.ease` while validating. Those unsupported fields survived in v2 sampled outputs. An exact-key check now rejects them before delegating to the unchanged v1 validator. Independent negative fixtures pass.

**Portrait truck scale, resolved for the supplied candidate:** the first portrait subject occupied only about 187×73 pixels at 360px width, with a roughly 10px junction. Its whole travel already filled the horizontal safe envelope, so zoom alone would clip. The producer narrowed the illustrative portrait bench, screen spacing and route, halved lateral travel and refit the camera. The final subject occupies about 196×131 pixels, while preserving the foreground/rear depth mechanism. Both all-frame bounds and independently inspected encoded partial occlusion pass. Portrait dimensions intentionally differ from landscape and carry no quantitative equivalence claim.

**Parallax evidence, resolved:** the first baked checker recorded only the rear marker. It now records foreground projection/depth and checks signed end-to-start displacements and their inverse-depth ratio. The resulting evidence supports the stated supplied-scene parallax claim without promising complete visibility.

**Reporting copy, resolved:** the producer shortened the reporting title, source qualification and cues before the final native render. The current input hash, native artifacts, zero-warning critique and inspected frames all reflect that revision.

No further change is requested within this T04 prototype scope. The evidence supports deterministic bounded camera operations and these illustrative compositions. It does not establish continuous subjective pacing, narration/audio quality, calibrated measurements, arbitrary-scene safety, other aspect ratios or final publication acceptance.
