# Independent review: camera studies

Reviewed 2026-10-03. Verdict: **prototype; no remaining material finding in the six final source variants and twelve native fixtures.** Continuous subjective playback and final master review remain unverified. The final focus treatment resolves the earlier weak phone-size focus change. Stable field-surface grain remains a draft-quality item for master review.

## Scope and contract

Reviewed `DIRECTION.md`, `SOURCES.md`, `docs/camera-studies.md`, original inputs, all three recipe JSON/Python pairs, `camera_rig.py`, renderer optics checks, source packaging, native build/verification, camera/focus/hold checkers and optical guard fixtures. These are three original camera operations, each reused with two explanatory subjects. Geometry, marker count, apparent scale, depth, paths and timing are qualitative. The fixtures do not establish measured flow, capacity, population, optical response or evidence strength.

The pure path contract has complete poses and a shared interpolation parameter for camera location, explicit target and optics. It rejects incomplete keys, invalid numeric values, non-increasing phases and look directions that cross the target or vertical roll pole. The two context reveals move the camera with constant focal length; they do not substitute a zoom. The focus study keeps camera framing fixed and changes focus distance. Named start/action/end phases distinguish camera movement or focus transfer from actual holds.

The endpoint fitter preserves authored direction/lens while adjusting distance and shift. Its projected bounds are not a visibility or collision solver. Close openings deliberately crop context; the selected subject remains inside the reserved region and the complete system fits in the final hold. Portrait endpoints are independently fitted. Native opaque bands protect copy from intentionally cropped scene content without concealing the selected subject in reviewed samples.

The reviewer ran `test/camera-paths.test.mjs`: **1/1 passed**, including 1,001 serialized forward/reverse seek samples and malformed-path rejection. The author separately reported 172/172 full-suite and 7/7 final focused checks; those broader commands were not reviewer-run.

## Findings and resolution

**Resolved: the initial landscape focus change was too weak at phone size.** In the f/0.20 clip, both panels remained largely legible at both endpoints. Near softening and far sharpening could be detected side by side, but the action was insufficiently clear. The original whole-panel sharpness metric corroborated the weakness: near ratio 1.37, far ratio 1.15 against a 1.25 requirement. The author strengthened the actual treatment to f/0.10. Neither the projected regions nor the 1.25 threshold was weakened to obtain a pass.

The reviewer inspected the stronger endpoint candidates, then the actual final encoded source and native frames in both formats. Near bars now soften clearly while deeper ribs become crisp; intermediate frames preserve the ordering and fixed framing. The source landscape ratios are 2.756/1.950 and portrait ratios 2.987/3.095. All four final native focus compositions also pass the same metric. Seven historical f/0.20 landscape frames remain under `evidence/independent-review/before-focus-strength-fix/`; they are superseded and excluded from final sampled counts.

**Tracked for master review: stable surface grain in the hero field.** The close landscape view shows grain on the front-right base; the portrait hero has a textured shadow beneath its crown. It does not obscure the silhouette or selected identity and becomes unobtrusive after the pullback. Reviewer compared the opening hold and measured 31 frames in each bounded 64 × 64 crop: maximum mean RGB differences from frame zero are 0.217 and 0.364 channel levels. This corroborates limited opening-hold variation; it is not a continuous-playback or whole-action flicker assessment. Keep the surface treatment on the final-master checklist rather than calling these draft materials pristine.

## Source identity, camera geometry and replay

Each final source is eight seconds, 192 frames at 24 FPS. Reviewer independently matched retained clip, scene and poster hashes to receipts, and retained source files to both receipts and current repository files. Exact identities and checks are retained in `evidence/independent-review/artifact-checks.json`.

| Source variant | Clip SHA-256 |
| --- | --- |
| linked-system-landscape | `0af2eb406328cc64f9fc32daffa678cdc008690a68ce66b9c8301b7bbfb40c3e` |
| linked-system-vertical | `767d07bc7b367cd75411da6babf858ef1d8412f8dab3297b47d1316d468df0e9` |
| hero-field-landscape | `23f3448317a805ed4e174b99093296b5015aa57ddd99a6f5f83ca5c7b2ffcb08` |
| hero-field-vertical | `fd62c41c9c3c9c83a8a32270cab09205ced87326ed267a77da46a3ac4345a8e9` |
| focus-depth-landscape | `d01f0e9ed3da8d8c9f901a9615c82fcc1295b28c8cd0c218765cd1c549407f67` |
| focus-depth-vertical | `62da8499d4f6746522f02ba1e15778e11518b7b8bb25bf1398a68b23456a60f3` |

All six camera reports match these clips and retained sources. Each checks **193 baked frames**, including the unencoded endpoint, and revisits frames out of order. Maximum pose error is below `1.86e-6`; noncamera world-transform drift is zero; seek snapshots match. Hero bounds stay inside the safe region throughout, and final mesh/curve bounds fit. Pullback focal lengths remain constant. Reported camera-distance ratios range from 3.876 to 8.076 and apparent hero-width ratios from 3.398 to 7.051. These are internal camera checks, not audience-facing quantities.

Each recipe has a 31-frame initial hold and 49-frame final hold. Reported world-transform and checked camera-optics errors are zero in those holds. The renderer checks lens, scale, shift, focus, aperture and other enumerated camera settings in addition to world matrices. The retained negative fixtures deliberately mark moving focus as a hold or loop; both report rejection before rendering. Reviewer inspected the fixture construction and matched the two retained config hashes plus renderer, artkit, rig and focus source hashes. These Blender checks were not independently rerun. They do not establish shader/material/particle stability or arbitrary optical settings outside the enumerated checks.

Saved-scene reproduction passes tolerance for all six. Both hero-field variants and linked-system portrait are pixel-exact. Linked-system landscape differs in one channel; focus landscape differs in 14 channels and focus portrait in 81. Every nonexact channel difference is one 8-bit level. Do not describe all six reloads as pixel-exact. Historical report directories may refer to pruned render scratch; the reviewed retained media are under `media/<variant>/`.

## Encoded visual review

Reviewer independently decoded and visually inspected **42 final source frames** at 360-pixel width: indices 0, 30, 64, 96, 128, 144 and 191 for each variant. The amber junction remains recognizable while branches appear; the amber marker remains identifiable while its surrounding field enters view. Opening/mid-move context crops match the brief, and final systems/plinths are contained. The focus variants visibly transfer attention without camera movement. No sampled selected-subject occlusion or mistaken focus ordering was found.

Reviewer also decoded and visually inspected **84 final native frames**, seven per fixture: indices 12, 60, 120, 195, 239, 241 and 297 at 30 FPS. These cover opening, early/middle action, settled interpretation, both sides of the eight-second boundary and the terminal hold. Native subject, title, phase caption and qualification stay sharp and readable in both formats. Longer portrait titles wrap without collision. The final camera view remains visible, with no sampled restart or new caption entrance at the reading-hold boundary.

All 126 final source/native PNGs are retained beneath `evidence/independent-review/`. No extra source video copies were created for this review. The current input SHA is `5f59d5a7a6ab496d1bebb8aa4b3c28039a1281bb1280ded332d6a597d96bd62b`.

Current native runs, retained compactly under `evidence/<fixture>/`:

| Fixture | Pipeline ID |
| --- | --- |
| shared-infrastructure-landscape | `2026-10-03T06-03-33-625Z-78aad40d` |
| shared-infrastructure-vertical | `2026-10-03T06-03-40-396Z-eeec5c76` |
| approval-network-landscape | `2026-10-03T06-10-05-465Z-77883615` |
| approval-network-vertical | `2026-10-03T06-10-12-045Z-78aaa7f2` |
| location-network-landscape | `2026-10-03T06-10-18-646Z-b9fd1376` |
| location-network-vertical | `2026-10-03T06-10-25-288Z-33084dcd` |
| specimen-field-landscape | `2026-10-03T06-10-31-908Z-462cd2bc` |
| specimen-field-vertical | `2026-10-03T06-10-38-621Z-a6ea412e` |
| surface-inspection-landscape | `2026-10-03T06-10-45-439Z-3a0e2899` |
| surface-inspection-vertical | `2026-10-03T06-10-50-437Z-7ed68b07` |
| research-context-landscape | `2026-10-03T06-10-55-598Z-e83df9fb` |
| research-context-vertical | `2026-10-03T06-11-00-699Z-852c228a` |

All twelve receipt/storyboard/media identities match. Native checks report zero errors/warnings, zero QA pops and equal shuffled/sequential seeks. Reviewer independently checked phase starts against resolved source frame times, outgoing fade endpoints, and final-caption reuse in the second beat. The final caption starts at 5.958333 seconds and remains through ten seconds, a 4.041667-second interval.

## Hold and focus probes: exact scope

Reviewer independently decoded source frame 191 and **all 48 frames in each of six lossless hold clips**: all 288 held YUV frames exactly match their corresponding source frame. Native compositions use these two-second static video clips, preserving the video decoding path. This does not imply exact pixel identity after native compositing and final encoding.

All twelve final native hold reports were matched to current pipeline IDs, storyboard/video SHA-256 values and source/hold hashes. They decode 300 frames into a fixed normalized subject region `[.08,.17,.92,.68]`, scale it to 96 × 96, compare frames 225–299 with frame 225, and compare frames 239/240 at the cut. Maximum hold difference is 0.290075 channel levels (<0.5), largest cut difference is 0.007993 (<0.1), and the smallest initial-versus-settled difference is 1.88368 (>1). This is a mean RGB region probe, not exhaustive pixel equality or a whole-screen footer test.

All six final focus reports—two source clips and four native compositions—match current video hashes and pass the unchanged 1.25 ratio threshold. The checker measures RMS two-pixel grayscale gradients in projected panel regions after 128 × 128 scaling, comparing opening and final frames. The smallest final ratio is 1.94997. It corroborates relative detail sharpness in these fixtures; it is not physical optical calibration, an intermediate-frame sharpness proof or a substitute for the phone-size visual review. The reviewer inspected and identity-checked the native hold and focus reports rather than rerunning their complete probes.

## Remaining acceptance boundaries

No further implementation change is requested for these final fixtures. Keep **prototype** status until continuous subjective playback and final master review are recorded. In particular, review full-motion cadence, intermediate occlusion, surface grain and the exaggerated optical treatment at delivery quality. Source/native frame samples and geometric bounds do not prove every moment of an arbitrary new camera path. Recheck framing, selected-subject visibility, copy bands, focus treatment and reading-hold boundaries after geometry, timing, format or camera changes. This milestone does not establish collision avoidance, an explosion/chase camera, quantitative perspective matching or a portable camera contract shared with the native renderer.
