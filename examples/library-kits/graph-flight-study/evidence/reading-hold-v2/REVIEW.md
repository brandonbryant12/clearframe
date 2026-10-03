# Revised chart-flight draft review

Status: exploratory draft with checked geometry and sampled encoded review; not a cataloged kit or accepted master.

Four 18.5-second clips cover two original fictional datasets in landscape and portrait. Source rendering uses 24 fps, 444 frames and two workers. The full-chart phase lasts five seconds; native labels are fully visible for 114 frames (4.75 seconds). Source scenes, editable storyboards, clips, native jobs/audits and evidence remain separate and hash-bound.

- Baked geometry: 445 sampled poses and 11,125 stage ray casts per case; connected, closed, convex backdrop; near/far containment and ceiling exclusion pass. No arbitrary continuous-frustum or unobscured-flight claim.
- Native diagnostics: zero errors; both landscape variants have no warnings. Portrait retains middle-80%-title-safe warnings, reviewed against full-frame and 360px samples, without a destination-player safe-area acceptance.
- Ending values: 3,192 centerline checks over 456 frames, maximum edge residual 2.304 draft pixels at the unchanged 3-pixel tolerance. The two parallel depth planes are calibrated from their zero baselines. Native source/job strings match fixture values/months; this is not OCR.
- Timing: 36 sampled same-time comparisons and 72 neighboring comparisons are consistent with the source clock. Constant channel bias is removed only for spatial comparison; raw color differences remain, and color fidelity is unaccepted. Near-stationary ties limit timing conclusions.
- QA: zero one-frame pops; flagged near-bar changes and an intentional five-second reading hold. Sampled pictures show sparse edge-on views around 7–9 seconds; human normal-speed judgment remains open. Fixed header/footer bands cover portions of the chart during flight. Only the settled ending is for quantitative reading.
- Verification: 218/218 smoke tests pass outside the sandbox. The initial sandbox run failed only macOS SVG rasterization; no product code was changed for that environmental failure.

See `../review-native-motion` for independent sampled visual/method review and `registration-investigation.json` for the first failed criteria and their corrected interpretation. Rejected open-backdrop and overlapping-label revisions remain explicitly marked. No quantity or catalog status increases.
