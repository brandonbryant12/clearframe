# Independent review — static anchor studies

**Verdict: prototype; no remaining material finding in the reviewed candidates.** The eight current 28-second silent draft specimens pass this bounded source, geometry, artifact-binding and encoded phone-frame review. Continuous subjective playback was not observed. Moving-label tracking, occlusion intervals, arbitrary-camera coverage and final master acceptance remain open. This is the static branch of T03, not the completed tracking feature.

Reviewed 2026-10-03 separately from implementation. Scope: the asset-anchor API and focused tests, Blender exporter, command contract, kit direction/README, original definitions and manifests, native builder and audit, source/projection/encoded checker implementations and retained reports, native diagnostics and the current MP4-decoded images. The reviewer changed only REVIEW.md and evidence/independent-review artifacts. No browser, server, Blender process or heavy render was started by the reviewer.

## Current artifacts

Input SHA-256: `24516f048b4aada3af1f52a1454f21e49612f84f905df2e0616a92a5e2f20b29`.

Model SHA-256: `5831b4dd3eb3a43f8ddc60cb6ddf0999721a9e4acdaaddc7af97b58ce9cba4bf`.

`evidence/independent-review/artifact-checks.json` binds each inspected video, storyboard, anchor manifest, native job, receipt, model, input, audit and final encoded report. Every native receipt represents 840 frames at 30 FPS: 8 seconds of action followed by 20 seconds of annotation hold. All eight native reports contain zero errors and warnings; QA reports zero pops; shuffled sampled seeks match. Render elapsed time is not treated as clip duration.

`source-artifact-checks.json` binds all four source scene/clip/receipt/definition/manifest/hold chains and their source/projection reports. `source-bindings.json` records the reviewed source/document/checker/report bytes. The two reservoir cases reuse the same prepared reservoir assets; the two conveyor cases reuse the same prepared conveyor assets. Landscape and portrait have separately prepared source compositions. Native labels and leaders change without rerendering those sources.

| Specimen | Current pipeline |
| --- | --- |
| access-gate-landscape | `2026-10-03T08-49-57-840Z-569c2151` |
| access-gate-vertical | `2026-10-03T08-50-08-708Z-2e3f797f` |
| alternate-route-landscape | `2026-10-03T08-59-04-346Z-3905373e` |
| alternate-route-vertical | `2026-10-03T08-59-15-571Z-415ab5d4` |
| fixed-bottleneck-landscape | `2026-10-03T08-59-27-303Z-101925ba` |
| fixed-bottleneck-vertical | `2026-10-03T09-02-02-296Z-17e48234` |
| settled-level-landscape | `2026-10-03T08-54-46-296Z-96d609ca` |
| settled-level-vertical | `2026-10-03T08-54-57-141Z-31bada89` |

## Contract and source evidence

The focused anchor suite passed 3/3. The reviewer's retained `contract-review.mjs` passes **501 independent assertions**, including center-based reference geometry over 32 contain/cover boxes, left/center/right label alignment, source-frame endpoints, cropped-zone rejection, changed scene/clip/receipt bytes, unsafe source filenames, occupied-output preservation, pre-Blender receipt mismatch rejection and numeric-collapse regressions.

The retained `exporter-control-review.py` passes **14 control-flow cases** using fake Blender data. They exercise exact zero-based half-open traversal, nonzero and single-frame ranges, an interior moving frame despite matching endpoints, a changed evaluated vertex count, camera movement even with a fixed fake projection, clipping, padded copy-region overlap and source format mismatch. Asymmetric points also check the top-left y-coordinate conversion. These are control-flow checks, not real Blender projection or saved-scene replay. They do not prove face/edge connectivity or material stability.

The four current source manifests all declare `[154,192)`, meaning source frames 154 through 191, inclusive. The exporter evaluates each of those 38 source frames as Blender frame 155 through 192. Its signature compares projected evaluated vertex coordinates and depth, projected bounding-box corners, attachment points and camera transforms/parameters; signature length changes are rejected. The current manifests report zero drift, with 3,088 evaluated vertices per frame for each reservoir and 6,112 for each conveyor. Copy regions exclude the declared subjects' conservative projected boxes plus normalized padding.

The producer's actual saved-scene checks reject a moving reservoir range at source frame 24 and reject a copy rectangle over subject geometry. Neither rejected export creates an output artifact. An independent matrix implementation uses camera projection × inverse camera world transform × object/local point, rather than calling the exporter's projection helper. Its **304 anchor-position comparisons** cover both anchors across all 38 frames of each source. The maximum normalized difference is **3.5391e−8**, below its 2e−6 threshold. All current scene and manifest hashes match those reports.

The displayed annotation hold uses source frame **191**, inside the checked range. The producer's decoder checked every frame of each 48-frame lossless hold clip: **192 decoded YUV frames** all equal their corresponding original source frame. The reviewer inspected that checker and report and independently verified the actual source and held-file hashes; the full Blender/decode runs were not rerun by the reviewer. Source action is one-way and unlooped. Only the proven repeated still clip is looped for the longer reading hold. Each specimen retains hash-checked local media copies.

The source contract is intentionally narrower than image visibility. Conservative boxes do not establish silhouettes, transparent surfaces, shadows, blur, glyph fit or contrast. The exporter does not compare face/edge connectivity or material animation. All anchor records retain `visibility: unassessed`. A cropped anchor flag describes frame inclusion, not visibility through intervening geometry. Current on-screen placement was inspected separately; it does not turn the general contract into an occlusion solver. The actual prepared-scene tests use orthographic cameras; perspective support in the source API has not received equivalent retained real-scene coverage here.

## Encoded visual review

The reviewer independently decoded and inspected **80 actual 360px-wide PNGs**, ten per current specimen, at 0.1, 2.5, 5.5, 7.9, 8.033333, 8.4, 8.9, 9.4, 15 and 27.9 seconds. These cover the mechanism, late action, pre/post cut, copy arrival, partial and completed leader, attachment ring and final hold. One additional exact 720px diagnostic image of access-gate landscape frame 270 was inspected.

All four editorial cases remain readable in both formats. Reservoir labels distinguish gate closure from the settled level edge. Conveyor labels distinguish the alternate passage from the unchanged main connection. Attachment rings resolve to the intended visible surfaces in the sampled current views. Text stays within reserved regions; longer portrait callouts wrap cleanly. Leaders remain restrained, and the original source pose stays aligned through the sampled action-to-hold cut. The qualifications keep the geometry qualitative: no account balance, measured volume, throughput or capacity is inferred. The 20-second held section leaves ample reading time; this does not establish subjective pacing in continuous playback.

The final producer-run encoded checker is bound to these exact artifacts and reports **104 native mapping checks, 336 decoded frame samples, 1,216 ring probes, 2,128 leader probes and 24 front probes, with zero failures**. It checks bright centers plus three dark ring edges, declared leader positions and linear reveal fronts. A front requires dark support within the unchanged two-pixel radius at 720px width and at least 35 RGB mean levels of darkening against the original plate. Subject-area grid probes exclude the annotation corridor and compare against the original held source image; maximum reported frame mean error is 2.052 and maximum reported frame P95 is 5.334, below the respective 8/18 thresholds. Held-region drift is also bounded by the checker. These are sampled comparisons, not an exhaustive image census. The reviewer inspected the checker and evidence without rerunning its complete decode pass.

The retained critique covers all eight current 28-second specimens and has zero warnings. An automated score does not substitute for visual review, continuous playback or master acceptance.

## Findings and resolutions

**Numeric contract issue, resolved:** a positive subnormal destination box could underflow to a zero-sized transformed image while reporting anchors and copy zones in frame. The API now rejects unrepresentable destination edges and nonpositive/invalid transformed dimensions and scale. Both the subnormal and large-origin/tiny-width regressions pass.

**Layout issue, resolved and re-reviewed:** the first access-gate candidate placed title/source copy outside the native title-safe area. The declared copy zones were moved inward, all four anchor manifests were re-exported from the unchanged scenes, and the native compositions were rebuilt. Current text uses the full reserved height for wrapping. All eight current diagnostics and refreshed decoded samples are clear; the superseded candidates are not the basis of this verdict.

**Media-contract preparation, resolved:** the initial builder referenced external relative media and treated the short hold clip as nonlooping. Current specimens retain verified local copies, keep the original action unlooped and explicitly loop only the static repeated-frame hold. The all-frame YUV report supports that hold identity.

**Encoded diagnostic issue, resolved:** the first dark-pixel predicate rejected a correctly located antialiased leader tip in access-gate landscape frame 270. The reviewer independently confirmed pixel (367,196) as RGB [102,102,102] against source [215,215,215], a 113-level darkening, near the calculated front (367.1479,197.1924). The final predicate requires channels below 160 plus source darkening of at least 35 without increasing the two-pixel position radius. The retained front proof and full eight-clip rerun pass. Bright-center-only ring checking was also strengthened with left/right/bottom edge probes so an unmarked pale surface cannot alone satisfy the ring check.

No further change is requested within the declared static prototype scope. The kit demonstrates reusable native annotation of retained prepared geometry. It does not establish moving-label tracking, general visibility, continuous subjective playback, narration/audio quality, square/4:5 composition or final publication acceptance.
