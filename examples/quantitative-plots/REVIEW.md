# Independent quantitative specimen review

Earlier rounds are retained below. The current findings are in **Round 3** at the end of this document; they supersede earlier presentation findings only for the identified output revisions.

## Round 1

Reviewed 2026-10-02 against `DIRECTION.md`, the fresh-review rubric in `skills/clearframe-direction/SKILL.md`, and the high asset bar in `docs/research/timmer-library/BUILDOUT.md`.

**Verdict: retain prototype.** The quantitative foundation is promising and the two subjects are substantively different. The present output does not meet the phone-legibility or complete motion-review bar. This is not final asset acceptance.

## Evidence actually inspected

- Landscape run: `landscape/build/pipeline/2026-10-03T00-16-16-591Z-3eda8fd5/`.
- Portrait run: `vertical/build/pipeline/2026-10-03T00-16-51-500Z-b3b0afe8/`.
- Both runs' contact sheets, phone sheets, timelines, boundary strips and QA findings; source recipe, ledger, plot expansion and direction.
- Additional frames decoded from each actual MP4: 5.0 and 15.0 seconds at exactly 360 pixels wide; 12.0 and 13.2 seconds at 720 pixels wide. Decode outputs are temporary review aids at `/tmp/quantitative-independent-review/` and should not be treated as durable delivery artifacts.
- **No continuous real-time playback was observed.** Discrete decoded frames establish sampled geometry and reveal states, not smooth temporal behavior, all-frame absence of pops, or speech synchronization. These silent specimens do not claim speech synchronization.
- This review did not render new native output or rerun automated suites. The QA summaries report zero pops but are not a substitute for playback judgment.

## Five highest-impact changes

1. **Make the source and assumptions readable at phone width.** At 5.0 and 15.0 seconds, the 360-pixel landscape frame has effectively unreadable source/date text and very small endpoint labels. Portrait improves titles and endpoint values, but the source remains approximately seven pixels high, with substantial empty space available above and below the plot. Give source/assumptions a deliberate multiline region and a minimum display size; increase secondary text contrast. Shorten or wrap instead of fitting to smaller text. Recheck at native 360-pixel viewing size. This is primarily a **tool layout/type problem** in the common source treatment and plot sizing, with **composition copy choices** needed. Do not claim landscape is phone-supported until this is resolved or explicitly mark that use unsupported.

2. **Identify the series while they reveal.** At 1–4 seconds and 11–14 seconds, the sampled sequences show colored lines without series names; the current expansion intentionally delays names until 4.5/14.5 seconds. The missing-data explanation also waits until settlement. A viewer cannot reliably distinguish contributions from total balance during the explanatory action. Show a stable color key or series names from the first observation while withholding final numeric values until settlement. Show the gap explanation during the sensor reveal. This is a **tool timing/label behavior problem**; composition could supply a reviewed temporary legend.

3. **Explain the retirement difference and expose the model assumptions.** At 5.0–9.97 seconds, “Account balance 712” versus “Contributions 270” is accurate, but the title alone leaves the reader to infer that the roughly 442-thousand difference is hypothetical growth. The visible source does not state the annual $9,000 combined contribution, no fees, or no withdrawals; those facts exist only in retained source. Add a concise growth callout and a readable assumptions line, preserving the same scales and clearly fictional status. Consider explicit endpoint units such as `$712k` and `$270k` if that reduces reliance on the small unit header. This is a **composition choice**, not a calculation defect.

4. **Give portrait enough horizontal plotting space and locate the missing observation.** At 15.0 seconds the portrait chart uses only about 140 of the 360 displayed pixels for the x domain. Only Jan/Apr are labeled, so the Feb missing observation and Mar restart cannot be located confidently from the picture. Rebalance the reserved label column, improve the plot width, and add a readable missing-date cue or suitable intermediate tick labels. Keep leaders attached to exact data and do not bridge the gap. This is a **tool layout constraint** plus a **composition annotation choice**. The tall frame is deliberately recomposed, but it currently spends too much of its area on blank margins.

5. **Complete the remaining acceptance evidence after revisions.** Review actual playback through the 0.5–4.5 and 10.5–14.5 second reveals, the 10-second cut, holds, and final fade. Also retain a visual stress specimen with genuinely long series names and nearly coincident endpoints; the current short names and separated endpoints do not establish that requirement. Check at 360 pixels and inspect leaders/labels without moving data. The last boundary at 22.97 seconds is nearly faded to paper, which should be deliberate if these clips will be reused as assets. This is an **evidence gap**, not a demonstrated interpolation or collision bug. Keep lifecycle at prototype until the material issues are resolved and reviewed.

## Findings that passed in the sampled evidence

- Retirement uses a fixed 0–30-year x scale and 0–800-thousand-USD y scale across both series. A separate ordinary-annuity calculation, `9000 * ((1.06 ** 30 - 1) / 0.06)`, gives $711,523.6759369888; the retained ledger closes at $711,523.6759369875. The displayed 712 and 270 are correct rounded thousands. This verifies the endpoint, not every calculation contract in the library.
- Sensor values retain the negative reading. The y domain is fixed at -10 to 30, and the zero reference is visibly distinct. The source uses calendar dates with unequal month spacing.
- At decoded 12.0 seconds the blue series stops after its Jan 12 observation; at 13.2 seconds it resumes only at its March observation. Neither inspected frame inserts a zero reading or bridges the missing region. Simultaneously visible reveal fronts align in x at the March restart sample, consistent with a shared reveal clock.
- Final labels are attached to the correct series, and the inspected endpoint leaders do not confuse the two traces. This does not establish the near-coincident or long-label stress case.
- The palette, sparse rules and typography are coherent. There is one chart per frame, and no decorative motion competes with data. Titles read at 360 pixels in both formats; portrait endpoint values are readable. The larger source/label sheet is not proof of phone readability.
- These are library specimens, so two chart scenes, silent output and intentional reading holds are appropriate. The QA static-hold advisories are not reasons to add arbitrary motion. A narrated-film hook/story/shot-variety rubric does not override the stated specimen brief.

## Acceptance boundary

No substantive arithmetic or scale defect was found in the bounded checks above. Readability and explanatory labeling still require work, and continuous playback plus the requested label stress cases remain unverified. Use the engineering primitive experimentally; do not label these rendered specimens accepted yet.

## Round 2

Reviewed the six current entries in `build/verification.json`, not the earlier round's retained artifacts:

| Variant | Pipeline run |
|---|---|
| landscape | `2026-10-03T00-34-04-056Z-cb71383b` |
| vertical | `2026-10-03T00-34-13-005Z-26a1276e` |
| stress-landscape | `2026-10-03T00-34-21-232Z-c95d5f2a` |
| stress-vertical | `2026-10-03T00-34-27-514Z-cfb88d28` |
| stress-square | `2026-10-03T00-34-33-536Z-9e11797f` |
| stress-portrait | `2026-10-03T00-34-37-283Z-eca6e4ca` |

**Verdict: substantial improvement; retain prototype pending one material annotation correction and complete playback review.** No new arithmetic, scale, or missing-data defect was found in the inspected evidence. The two-series foundation is useful engineering work. This is still not blanket artwork acceptance.

### Evidence and limits

Inspected all six current contact sheets and phone sheets. Independently decoded the actual MP4s and inspected every variant at 5.0 and 13.2 seconds at exactly 360 pixels wide, plus landscape and stress-vertical at 1.0 seconds, vertical at 12.0 seconds, and stress-square at 12.0 seconds. Temporary decoded review aids are under `/tmp/quantitative-independent-review-round2/`.

The current verification manifest records no native-audit errors or warnings, zero QA pops, and equal native PNG hashes between forward and shuffled seeks at 1, 3, 5, 9 and 12 seconds for all six variants. This is bounded automated and deterministic-seek evidence; I read the recorded results rather than rerunning these checks.

**Continuous real-time playback was not observed in this review.** The sheets and decoded states provide bounded encoded-sequence evidence: names precede numeric settlement, data progresses between samples, the gap survives intermediate states, and the resulting picture is stable across the sampled hold. They do not establish smooth motion between every frame, subjective pacing, or continuous-playback acceptance. Three- and four-series compositions were not visually covered and receive no visual acceptance from these two-series specimens. Retirement and sensor examples were inspected only in landscape and vertical; the additional square and portrait evidence concerns the stress examples.

### First-round issues revisited

1. **Source/assumptions readability: resolved in these samples.** The decoded 360-pixel frames now carry readable dark source text and dates. Landscape is dense but decipherable; the source no longer requires zooming into the contact sheet. Portrait no longer hides these facts in very small gray type.
2. **Series identification during reveal: resolved.** At 1.0 seconds, the lines have named colored keys while final numbers are absent. Phone-sheet progression shows numbers arriving after the reveal. Sensor source copy includes the missing date during the action.
3. **Retirement explanation: resolved.** The title names the derived $442k growth, the key gives $712k and $270k, and visible assumptions state $9k/year, 6% return, no fees/withdrawals, and year-end deposits. The illustration framing remains visible.
4. **Portrait width/missing date: substantially resolved.** At 360 pixels the plot now spans roughly 236 pixels rather than 140. The source states the absent 2026-02-01 observation. The two-tick date axis is sparse but adequate for these specimens. At 12.0/13.2 seconds the blue line remains broken, preserves its negative observation, and restarts at the correct part of the date domain.
5. **Stress and motion evidence: partly resolved.** Long names wrap without clipping and 50% versus 49% remain clearly attached to named key entries across all four stress shapes. The actual plotted endpoints remain close instead of being displaced to accommodate labels. Log ticks at 1/10/100/1000 are evenly spaced and explicitly labeled as log scale. Deterministic seek evidence is now recorded. Continuous playback is still unreviewed, and the log annotation introduces the defect below.

### Remaining material presentation defect

**The log annotation crosses the blue data line.** At 12.0 seconds in stress-square and 13.2 seconds in all four stress variants, the blue stroke runs through the “10 cells” label; its leader also follows the same data segment closely. The text is still decipherable but this is an avoidable collision in an asset specifically meant to demonstrate accurate native annotation. Move the callout into clear chart space and route its short leader back to the ring at the actual x=1, y=10 observation. Do not move the data or change the log mapping. Verify the corrected callout at 360 pixels in all four shapes.

This is primarily a **composition choice** in the shared stress annotation's `dx`/`dy`. The audit passing illustrates a **tool limitation**: bounds checks alone do not prove annotation/data separation. A generalized collision detector is not required to fix this specimen.

### Nonblocking craft observations

- Landscape trades plotting height for much better text. The near-coincident battery traces visually merge at parts of the 360-pixel picture, but the key preserves both identities and their exact final values. A future explanation of tiny differences may warrant a separate zoomed or difference panel; changing this truthful shared scale is not required here.
- Tall formats retain generous vertical spacing. They are now legible and deliberately composed, so additional tightening is optional rather than an acceptance blocker.

After the callout correction, recheck only the affected stress presentation and preserve the explicit continuous-playback and series-count limits. Do not infer acceptance of arbitrary labels, arbitrary annotation offsets, or three/four-series compositions from these cases.

## Round 3

**Verdict: the remaining annotation defect is resolved in the four inspected shapes. No material presentation defect remains in this bounded review. Keep prototype status because continuous playback remains unverified.** This is not artwork acceptance or coverage of arbitrary plot configurations.

The current stress revisions in `build/verification.json` are:

| Variant | Pipeline run |
|---|---|
| stress-landscape | `2026-10-03T00-40-50-306Z-2de0626a` |
| stress-vertical | `2026-10-03T00-40-56-771Z-fdced289` |
| stress-square | `2026-10-03T00-41-02-892Z-48d9d504` |
| stress-portrait | `2026-10-03T00-41-06-705Z-10f0444a` |

The landscape and vertical subject clips retain their Round 2 run IDs. Their previous findings stand; this follow-up does not repeat the complete six-clip review.

### Corrected annotation

Independently decoded each revised stress MP4 at 13.2 seconds to exactly 360 pixels wide and inspected the result. “10 cells” now sits clear of the blue line in all four shapes. The leader returns to the outlined observation at x=1, y=10. The data point and log scale remain in place. The former text/data collision is resolved; no additional composition change is requested from these inspected frames. Temporary review images are at `/tmp/quantitative-independent-review-round3/`.

### Proportionality evidence

Read the recorded `build/encoded-proportions.json` results for all six current clips. The report records 3,300 frames decoded in total, zero failures in each clip, source-to-native point/tick coordinate checks at `1e-7` pixel tolerance, and encoded visible-observation, reveal-front, and future-stroke checks at 720-pixel width with a 3-pixel tolerance. Occluded samples are explicitly excluded. These results strengthen the evidence that mapped values and shared-clock intermediate states preserve their intended positions.

This review did not independently rerun or audit the implementation of that checker. Every frame being decoded does **not** mean every possible geometry or every encoded pixel was proved. The declared checks concern two-series point centers, both-axis ticks, visible observations and reveal behavior in these fixtures. They do not establish area, angle, or volume encodings, arbitrary annotations, or three/four-series compositions. Mathematical proportionality remains a hard requirement for any later asset using those encodings, with its own applicable evidence.

### Remaining acceptance limits

- **Continuous playback remains unverified.** The author reported that the native-player attempt timed out. Decoded frame inspection, encoded-stream checking, zero-pop QA, and deterministic seeks are distinct from successful real-time playback review. No successful playback is claimed here.
- **Three- and four-series visual layouts remain unreviewed.** Passing a source contract or two-series stress case is not visual evidence for those combinations.
- Subject specimens remain reviewed in landscape and vertical; the four-shape review applies to the stress specimens. No broader format/fixture acceptance is implied.

Retain the tested native/data foundation and the honest bounded visual evidence. Promotion to accepted artwork requires the remaining applicable motion review and should name the exact supported configurations.
