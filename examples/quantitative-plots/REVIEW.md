# Independent quantitative specimen review

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
