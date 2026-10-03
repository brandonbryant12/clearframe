# Library build-out goal

Authorized October 2, 2026: extend the general library with retirement, build the reusable assets and tools, and commit/push validated milestones to `main` periodically. Quality takes precedence over inventory count. This is an active build, not a claim that every proposal already exists.

Additional user direction: include a small set of [Timmer-inspired style studies](STYLE-STUDIES.md) using actual chart imagery from posts/publications: two native examples and one Blender interpretation. Keep the existing build direction. Actual image inspection must precede any claim of extracted styling.

## Milestones

| Milestone | Scope | State |
|---|---|---|
| 0 — Durable inventory | Original package and 62-item macro inventory; add nine retirement recipes and primary references | Source validated; visual status unchanged |
| 1 — Calculation contracts | T02 foundation: contribution ledger, tiered match, ownership, fee comparison, pension formula and cashflow fixtures | Implemented; focused calculation checks pass |
| 2 — Quantitative drawings | T01/C01 explicit scales, multiseries comparison, missing data, dates, annotations and native labels | Engineering foundation and proportion checks implemented; sampled defects resolved; continuous playback still unverified |
| 3 — Retirement specimens | R01–R09: reusable native recipes, two distinct scenarios, landscape/vertical compositions | Native prototypes and review evidence implemented; continuous playback and promotion pending |
| 4 — Drivers, participation and flows | Reconciled decomposition, breadth/count versus weight, relative performance and stocks/flows | C02/C03/C05/C08/C16 native prototypes implemented; continuous playback and promotion pending |
| 5 — Physical mechanisms and cameras | Curate existing B01–B03; build reservoir/gate/conveyor and reusable camera/phase contracts | 5a timing, 5b reservoir/conveyor and 5c authored camera prototypes implemented; broader camera tools and existing-object curation remain open |
| 6 — Remaining collections | Curves, relationships, uncertainty, long horizons, delayed payoff and supporting tools | Dated transforms and C09/C10/C11 prototypes implemented in 4c; remaining inventory stays planned |

Use inventory IDs to track individual deliveries. Each milestone can contain several small commits; push only after its relevant checks pass. Fetch `origin/main` before each push, integrate concurrent commits in this isolated checkout, and never force-push. Do not sweep another chat's edits into a commit. Record the pushed commit and evidence here or in a linked milestone report. Keep the worktree while this goal needs it.

## High asset quality bar

An accepted asset must pass every applicable requirement below. A polished poster cannot substitute for motion review; passing tests cannot substitute for a readable picture.

1. **Explanatory value.** Name the question the asset answers. Demonstrate two substantively different subjects or scenarios. Show why the mechanism helps the explanation. Variations must change more than color.
2. **Truthful quantities and mathematical proportion.** Every length, area, angle or volume that encodes a quantity must map to the underlying data and declared scale, including intermediate animation frames. Use square-root dimensions for area encoding and cube-root dimensions for volume encoding; do not scale radii or object dimensions linearly and imply proportional areas/volumes. Verify both calculations and rendered geometry with independent fixtures. Label logarithmic or indexed scales explicitly, preserve shared baselines/domains, and keep camera/perspective from creating a false quantitative comparison. Qualitative mechanisms must not imply unencoded amounts.  Use auditable input data, independent calculation fixtures, declared units/dates/scales and visible sample/source labels. Disclose assumptions and missing values. Preserve negative returns and shortfalls. Keep pension promises, account balances, ownership and withdrawal eligibility distinct.
3. **Art direction.** Choose a coherent palette, type voice, materials and lighting. Review silhouette, spacing, hierarchy, texture and contrast. Avoid default primitive clutter, incidental labels and decorative movement that obscures the idea.
4. **Motion.** Inspect an encoded pass through anticipation, action, settlement and reading hold. Check joins, occlusion, easing, tracking, temporal pops and loop/reveal behavior. Seek representative frames in arbitrary order to verify deterministic output.
5. **Format and legibility.** Review landscape and a deliberately composed portrait version, long labels and phone-size output. Reserve source/caption space. Mark unsupported formats explicitly.
6. **Editable and reproducible.** Retain original recipe/source, declared parameters, seed, version, dependencies, license, receipts and output hashes. Keep exact text and evidence native. Replacing copy must not require a Blender rerender.
7. **Independent critique.** Before promotion, request a fresh reviewer to inspect the brief, contact sheet and actual motion evidence. Resolve substantive issues and retain the review. This authorizes review delegation for completed candidates, not parallel heavy rendering.

## Evidence and lifecycle

- `idea`: inventory proposal only.
- `prototype`: source/calculation/composition exists; some checks or visual evidence are missing.
- `ready-for-review`: all applicable automated checks and output preparation passed; actual review is pending.
- `accepted`: visual/motion review and calculation checks are recorded for each supported variant; no unresolved material defect.
- `deprecated`: retained for provenance, excluded from recommended reuse.

Every candidate report records: inventory IDs, source revision, input fixture, calculation checks, generated outputs/hashes, reviewer findings, supported formats, unresolved limitations and lifecycle. A source-validated helper is usable engineering work but is not accepted artwork. No self-promotion based solely on file existence.

## Execution constraints

Use existing native primitives before extending the renderer. Preserve the warm Rust/Blender caches. Gate full builds/tests/renders with `codex-heavy`; one Cargo job and at most two supported workers. Check free disk before heavy work and retain the 20 GiB minimum; 50 GiB remains the target. The initial reading was approximately 19 GiB, so the first work is source/data validation. No paid generation is authorized by this goal alone.

## Current evidence

Original delivery: [verification](VERIFICATION.md). It contains source/compile checks and retained-media hashes, not new motion acceptance. Browser preview inspection was blocked in that delivery. Future reviews must record what was actually inspected.

Milestone 0 validation: inventory generation resolves all 71 entries and 27 source references (24 macro + 3 retirement); existing focused library tests pass 8/8. No new visual acceptance is asserted.

## Published milestones

- **0:** `470159b` pushed to `main`; remote branch verified at that commit. Package, 71-entry inventory, nine retirement recipes and acceptance criteria.
- **1:** `d31f269` pushed to `main`; calculation implementation in `engine/lib/finance.mjs`; [contract and reproduction](../../finance-calculations.md). Ten focused checks pass, including closed-form annuity fixtures, hand-calculated matching and fees, loss/depletion cases, and ordering/validation. Five generated examples retain their input SHA-256. T02 remains partial: statistical transforms are still planned. R01–R09 remain unreviewed visual proposals.
- **2a:** `8fe105e` pushed to `main` and remote hash verified; quantitative input/native drawing foundation, [prototype evidence](../../../examples/quantitative-plots/README.md). Full Node suite 151/151, native suite 64/64, both 90-frame native audits clean; two 23-second 690-frame clips pass encoded QA with zero detected one-frame pops. Independent review retains **prototype** status: phone text is too small, series identities appear late, and playback/edge-case review is incomplete. Source hashes, clips, receipts and critique are retained. These are engineering results, not accepted artwork.

Milestone 2b (`5d3bd0c`, pushed to `main`, remote hash verified) evidence: the two main examples now show readable source/assumptions and stable series names. Long labels, close values, log scales and annotation are rendered in four shapes. Three independent review rounds found no remaining material defect in the inspected frames. Six clips pass native audit/QA; shuffled native seeks match. A bounded independent checker streams 3,300 encoded frames with 276 source/native coordinate checks, 23,208 visible observation checks, 4,060 reveal-front checks and 2,368 future-column checks, with zero failures. Exact tolerances/exclusions are in the linked prototype evidence. These line checks do not establish area/volume correctness for future infographics.

Next: complete continuous playback review when the native player is responsive, and review three/four-series arrangements. Keep building the retirement recipes and other collections with the same mathematical-proportion requirements. The scoped style studies are tracked in milestone 3b. Rendering remains subject to the disk reserve; no generated visual candidate is accepted yet.

## Milestone 3 — native retirement mechanism kit

Published as `696d0e0` on `main`; exact remote hash verified.

The [retirement kit](../../../examples/library-kits/retirement/README.md) implements original reusable compositions for all nine recipes with two fictional scenarios each and 18 separate landscape/vertical specimens. Matching bands, ownership compartments, balance reservoirs and a signed fee-gap waterfall retain exact value-to-length/rectangle-area relationships. Formula and quotation scenes keep units and conditions separate. The purchasing-power equation exposes its price-index base; return-order cases expose unequal funded payments after depletion.

The full Node contract suite passes 156/156; five focused retirement tests check independent arithmetic, negative/depleted outcomes, and actual authored geometry. The independent reviewer also reproduced 42 numeric results and 80 rectangle mappings. All 18 native pipelines pass with zero layout findings and zero detected one-frame pops. Review-driven changes identify the inspected reservoir year, separate employee/employer contributions, state fee return assumptions, and show the deflation operation. The 18 clips total 17,580 frames. A bounded checker decoded 12,420 frames in the 12 variants with rectangular quantities and passed 32,836 edge probes, including 464 during visible fades. The manifest retains output hashes, receipts, phone/boundary sheets, shuffled-seek results and exact probe tolerances/exclusions.

Status remains **prototype**. Encoded sampling and automated checks do not establish subjective continuous playback or finished-film pacing. Landscape and vertical are the demonstrated forms; square/4:5 and arbitrary new copy need review. The original inventory's broader 3D metaphors remain work, and the small Timmer image-derived style study is documented separately below. No source chart imagery was used to claim a derived look in the retirement milestone.

## Milestone 3b — source-informed research studies

Published as `10fdc4c` on `main`; exact remote hash verified.

The [research-study kit](../../../examples/library-kits/research-study/README.md) adds two native chart studies and an original Blender reserve gate in landscape and vertical. Three actual chart images were inspected from one publisher page; direct social-post provenance and broader post coverage remain open. Source images and market values are not redistributed. The source-to-adaptation table distinguishes observed hierarchy/color from our native simplification and original 3D interpretation.

The palette/treatment use the existing library system. Explicit date/value geometry and a derived endpoint percentage preserve mathematical meaning; the gate encodes access qualitatively. The native pipeline, encoded probes, scene reproduction and independent review have separate retained reports. All remain prototypes while continuous playback is unverified. B04 is only partial: the new gate has no transparent chambers, fill planes or quantity transfer. Full seven-collection build-out remains active.

Validation: the full Node suite passes 157/157. Six native clips total 60 seconds / 1,800 frames; all pipeline checks and encoded QA pass with zero layout findings or detected one-frame pops, and forward/shuffled seeks agree. The four chart clips pass 116 independent native coordinate/tick/window checks and bounded pixel probes across 1,440 decoded frames: 15,228 visible observation probes, 2,376 reveal-front probes and 944 future-column checks, zero failures. Both 144-frame Blender masters reproduce their poster pixels exactly after reopening with Python auto-execution disabled and settle at the end. The independent review and exact probe exclusions remain in the kit.

## Milestone 4a — drivers and flows

Published as `ec55151` on `main`; exact remote hash verified.

The [drivers-and-flows kit](../../../examples/library-kits/drivers-and-flows/README.md) implements C02/C03/C16 with six original fictional subjects and twelve native landscape/vertical clips. Original dates and units remain visible before event alignment. Two-factor product changes expose interaction and separate additions. Signed bridges reconcile observed closing stocks with supplied changes and explicitly unexplained residuals. Shared domains and equal bar thickness preserve value-to-length and rectangle-area ratios through fades; missing observations remain gaps.

T02 now includes [observed-anchor rebasing, product decomposition and stock reconciliation](../../data-transforms.md). Helpers reject unsupported inputs, retain input hashes and avoid intermediate display rounding. These are bounded algebraic models; they do not implement reinvested total-return indices, causal attribution, rolling statistics, annualization or vintage alignment. Broader participation and relative-performance work remains.

Status remains **prototype** while subjective continuous playback is unverified. Native source-bound pipeline reports, independent encoded proportions and sampled reviewer evidence are retained in the kit. The full Node suite passes 162/162. All twelve native pipelines pass with zero layout findings or detected one-frame pops, and forward/shuffled seeks agree. Independent encoded checks stream 8,760 frames and pass 160 native mappings, 29,820 rectangle-edge probes (344 during visible fades), 11,226 observation probes, 3,062 reveal-front probes, 2,036 future-column checks and 782 missing-column checks, with zero failures. Exact exclusions and tolerances are retained in the kit; this is bounded geometry evidence, not subjective continuous playback.

## Milestone 4b — participation and benchmarks

Published as `a941e07` on `main`; exact remote hash verified.

The [participation-and-benchmarks kit](../../../examples/library-kits/participation-and-benchmarks/README.md) implements C05 and C08 with four original cases and eight separately composed native landscape/vertical specimens. Count tiles have equal area; the weighted view keeps the full membership and missing weights. The signed branch uses percentage-point positions and a separate circle-area measure, with square-root radii. Zero size gets an unfilled locator cross; a missing metric has no endpoint. Holdings and end-period open cases are independent of the period metric they accompany.

Independent review found and resolved ambiguous category/count grouping, crowded landscape value/source text, and a size definition that made a zero amount incompatible with an observed completion rate. The final definitions, native arithmetic, encoded mark probes and phase review remain separately recorded. These are **prototypes**, with continuous playback and finished-film promotion still unverified. The helper layer remains partial for T02; rolling statistics, annualization and vintage alignment are future work.

Validation: the full Node suite passes 166/166. All eight native pipelines pass with zero errors, warnings or detected one-frame pops; forward/shuffled native seeks agree. The encoded audit streams 5,520 frames and passes 48 equal-tile, 10 weighted-area, 10 circle-area, 40 position and eight absence checks against native geometry. Decoded probes pass 30,672 rectangle edges, 11,160 circle chords (718 combined probes during visible fades), 1,378 zero markers and 782 missing-endpoint checks, with zero failures. Timing filters, native/pixel tolerances and sampled-review limits are retained in the kit. These probes do not establish an exhaustive painted-area census or subjective continuous playback.

## Milestone 5a — motion phase and retiming foundation

The [motion timing examples](../../../examples/motion-phases/README.md) add T05 and part of M10: all nine sculpture recipes expose explicit frame intervals and loop intent. Three one-way reveals declare initial/action/final holds; six continuously moving recipes retain one whole cycle. Custom phase durations bake the same canonical pose function on an explicit frame schedule. The separate clip planner returns exact encoded source-frame selections and protects all action, minimum phase durations and an optional final reading hold. It does not encode a new clip, simulate physics or automatically align a native storyboard.

Two four-second, 48-frame draft clips exercise a landscape gate and portrait bridge, each with a two-second final hold. The bridge's portrait framing now retains its plinth corners. Blender checks all object transforms during the declared holds; all four holds have zero measured transform movement. Both saved scenes reopen with Python auto-execution disabled and reproduce their poster pixels exactly. Independent review inspected 14 encoded phase/boundary frames, checked 189 serialized timing round trips and found an empty CLI timing path that now correctly fails. No remaining material finding is recorded. The full Node suite passes 170/170.

The evidence stays **prototype**. These are 12 fps timing fixtures, with continuous playback and native evidence composition unverified. The planning examples are hash-bound plans only, not encoded retimed derivatives. Transform holds exclude animated materials/deformation/optics. T05 still lacks automatic native cue integration; M10 lacks broader reusable anticipation/settle choreography. Reservoir fill/transfer, conveyor behavior and camera tools remain the next physical-asset work.

## Milestone 5b — physical mechanisms and fixed copy-safe framing

Milestone 5a was published as `45c32d9`. The [physical-mechanisms kit](../../../examples/library-kits/physical-mechanisms/README.md) adds B04 reservoir transfer and B09 conveyor bypass. Four separately framed Blender drafts support eight native adaptations in landscape and vertical. Fixed orthographic fitting begins M07; source phase cues and explicit two-second final-frame clips extend the T05 examples.

Baked-scene checks cover 772 frames including endpoints: reservoir volume/floor/gate/stem constraints, conveyor spacing/obstacle/gate clearance and all subject bounds. Three saved scenes reproduce their poster exactly; reservoir landscape differs by one color channel at most 1/255. These are bounded geometric and sampled rendered checks, not physics or exhaustive occlusion proofs. The kit retains source hashes, decoded final frames, native diagnostics, shuffled-seek checks and encoded hold measurements.

Both mechanisms remain prototypes pending continuous subjective playback and final master review. M07 is partial fixed framing; moving cameras, quantitative perspective matches and general reframe presets remain open. Existing B01–B03 curation and other camera recipes are also outstanding. The full build-out goal stays active.

Validation for 5b: all eight native runs have zero layout errors/warnings and zero detected pops; shuffled seeks reproduce their sampled frames. The encoded final-hold boundary is below 0.007 mean RGB channel levels in the bounded subject crop. All 171 Node checks passed across the full suite (170 passes, one disk-preflight skip) and the subsequently passing focused skipped check. Exact decoded YUV endpoints bind each static hold clip to its source final frame.

## Milestone 5c — authored camera paths and native qualifications

Milestone 5b was published as `8c0242d`. The [camera-studies kit](../../../examples/library-kits/camera-studies/README.md) adds M01 detail-to-system and M02 hero-to-field perspective pullbacks plus M03 fixed-camera focus transfer. Three original recipes support six illustrative subjects and twelve independently composed landscape/vertical specimens. T04 now has a partial trusted-recipe rig: complete deterministic poses, a Blender bake adapter and perspective endpoint fitting. M07 gains moving-path examples with separately fitted formats; it is not arbitrary automatic reframing.

A separate baked-scene check covers 1,158 frames including endpoints. It compares sampled poses to the declared paths, verifies static noncamera transforms, checks hero bounds throughout and full mesh/curve bounds in the final hold, then revisits frames out of order. Both pullbacks retain constant focal length. The focus camera keeps its transform and other optics fixed. All twelve declared source holds have zero measured transform or optical drift. The renderer now rejects focus changes hidden inside a claimed hold or closed loop; two negative integration fixtures prove those rejection paths before any scene or pixels are rendered.

Three saved scenes reproduce their posters exactly. The landscape system and two focus variants differ in one, fourteen and eighty-one color channels respectively, each by at most 1/255. Exact hashes and changed fractions remain in the source reports. The full Node suite passes 172/172; focused checks cover the final recipe revision. Twelve native pipelines have zero layout errors/warnings or detected one-frame pops, and shuffled seeks agree. All 3,600 native frames decode; 900 final-hold comparisons pass the bounded subject-crop check. The largest hold variation is below 0.30 mean RGB channel levels, and the largest join step is below 0.008. The explicit hold clips clone final source YUV pixels.

Independent phone review found the initial landscape focus transfer too subtle. The revised stylized f/0.10 treatment resolved that finding in new encoded clips. The unchanged sharpness probe passes both source clips and all four native focus adaptations; the smallest sharp/soft detail-gradient ratio exceeds 1.94 against a 1.25 requirement. This is a bounded relative image-detail test, not calibrated optics. Crisp native qualifications explicitly separate illustrative geometry from measured evidence.

The kit stays **prototype**. Independent sampled review and encoded probes do not establish subjective continuous playback or final master acceptance. Stable close-up grain on field marker bases/crowns is retained as a master surface-quality item. Square/4:5, quantitative perspective matching, collision/occlusion solving, camera chases, broader orbit/truck presets and existing-asset curation remain open. The full library build-out goal remains active.

## Milestone 4c — dated transforms and linked native panels

Milestone 5c was published as `ee9f931`. The [time-series studies kit](../../../examples/library-kits/time-series-studies/README.md) adds C09 nominal-to-real comparisons, C10 discrete level/growth/change-in-growth, and the observed drawdown/volatility branch of C11. Six original fictional cases have twelve separate landscape/vertical compositions. [Time-series helpers](../../time-series.md) extend T02 with dated price-basis conversion, anchored period validation, lagged growth and explicit compounded annualization, complete-window mean/sample SD, and observed drawdown/recovery episodes.

Each source snapshot retains unrounded calculation outputs and dated nulls. The native panels share elapsed-date x positions but have explicit distinct y units and domains. The price-basis pair shares a common currency scale and finishes on the nominal-minus-real difference. Underwater fill retains the same zero/boundary as its drawdown line. `sourceElement` supports explicit static native attribution placement, with opaque ink, no effects/transforms/exits, a minimum declared size and a required storyboard source record; regular frame audits still check its actual layout.

Validation: 178/178 Node checks pass. All twelve 40-second native clips have zero check errors/warnings and zero detected one-frame pops; sampled out-of-order native seeks match. Independent Python calculations verify native coordinates, and bounded encoded probes inspect 1,008 sampled frames with 1,488 source/native mappings, 5,830 settled point checks, 78 exact-frame linear-front checks and 1,950 missing-column checks, with zero failures. Four coincident blue/orange fronts are explicitly excluded only after exact source-front coincidence and visible later-color evidence; all exclusions/tolerances are retained.

Independent review covers 84 actual encoded 360-pixel frames across explanation, shared-clock action, the cut and final hold. It also checks the twelve audit results against independent rational arithmetic/sample SD and retains the source-validator defect and its repair. A final reading-rate critique extended both beats to twenty seconds; all twelve critiques now have no reading-rate warning. The kit remains **prototype**: subjective continuous playback and final master acceptance are unverified. Smoothing, risk-adjusted metrics/risk-free comparisons, vintage alignment, square/4:5 and the remaining library inventory stay open. No borrowed dataset, paid generation or full-goal completion is claimed.


## Milestone 6a — discovery and declared creative choices (source prototype)

Milestone 4c was published as `7911b8f`. The [library browser](../../library-browser/README.md) implements T06's source prototype and the ledger/report branch of T08. Eight retained packages map explicitly to 39 examples (76 native format variants plus one prepared Blender insert) and 71 inventory items. Seven collection filters, operation/topic search, medium/purpose/state filters, one controlled preview and source/review links make existing work discoverable. The planning view preserves each proposal's full readiness text and distinguishes linked examples, source-only ingredients and planned work.

The catalog checks all 2,384 manifest file identities without changing lifecycle. It disables missing/changed links and disables native previews when their storyboards are missing or changed. Explicit case mappings prevent a missing audit from broadening an example to unrelated operations. Receipt frame count/FPS establishes clip duration; encoder elapsed time does not. The Balance study stays a prepared insert with an unrendered native integration source.

`library-log` records declared mechanism, material, camera and story labels against the actual storyboard bytes, with an exclusive writer lock and atomic replacement. `library-variation` groups recent normalized mechanism/story declarations while retaining material/camera context. Example decisions stay separate from project history. The browser build checks each initial ledger source hash, while imported ledgers remain unchecked declarations. The bundled contact view is a review aid for four real example decisions, including intentional reservoir reuse; semantic novelty inference and general candidate-sheet review remain open.

Independent source review resolved duration, naming, missing-audit mapping, format-focus, normalized-label and initial-ledger provenance issues. The full Node suite passes 182/182, four focused tests and 17 independent regressions pass, and both ledger CLI smoke checks pass; exact evidence lives in [the review folder](../../library-browser/evidence/). This is source validation, not visual acceptance.

**Browser review remains pending.** The browser tool rejected local `file:` navigation under its URL security policy. The requested scoped localhost HTTP preview awaits user authorization; no alternate browser route was attempted. Actual desktop/phone composition, keyboard interaction, video controls, source-link navigation, JSON import/export and visual accessibility must still be inspected. T06 remains a source prototype; T08 remains partial. No film's acceptance state changed.


## Milestone 4d — information dates, maturity quotes and scenario envelopes

Milestone 6a was published as `3e27484`. The [expectations studies kit](../../../examples/library-kits/expectations-studies/README.md) adds C04 forecast vintages and actual revisions, the supplied-quote branch of C06, and C12 descriptive scenario bands. Six original fictional cases have twelve native landscape/vertical compositions. [Expectation helpers](../../expectations.md) extend T02 with inclusive publication cutoffs, strict maturity normalization and complete-ensemble min/max or type-7 quantiles.

The vintage views retain issue dates and fixed target-date scales across two information cutoffs. A deliberately unpublished future vintage cannot leak into either view. Actual revisions respect their release dates, including null withdrawals. Maturity quotes retain nonuniform month spacing, signed yields and null gaps; connecting segments are visual guides. Scenarios start at the final observed point. Bands join only consecutive complete dates and never enter history or bridge a missing member. Equal-weight descriptive quantiles carry no probability or confidence claim.

Validation: the full Node suite passes 185/185. Independent review checks 1,204 chronology, maturity and quantile assertions, including repairs for normalized-tenor collapse and equal-endpoint interpolation at numerical extremes. All twelve native clips have zero layout errors/warnings and zero detected one-frame pops; sampled shuffled seeks agree. Independent Python calculations and encoded probes pass 1,764 native mappings, 1,216 sampled frames, 7,578 point checks, 118 linear-front checks, 1,224 missing-column checks, 2,050 band-interior checks and 246 missing-band checks. The reports retain 186 occluded samples and one palette-near gray-front proof; no positional tolerance was enlarged.

Independent sampled phone review covers 116 decoded frames, plus the exact gray-front diagnostic. The full reading-rate critique has no reading warning. C04 views last 52 seconds; C06/C12 clips last 46 seconds, with at least twenty seconds of settled quantitative geometry in each chart. The library browser catalog now includes nine packages and 45 examples with 88 native variants plus one prepared insert. Catalog changes receive source checks; interactive browser authorization remains pending.

The kit remains **prototype**. C06 remains partial: fitted curves, discount-factor/forward-rate models and their assumptions are not implemented. Weighted/calibrated scenario probabilities, square/4:5 layouts, subjective continuous playback and final master acceptance also remain open. The larger library build-out goal stays active.

## Milestone 5d — static prepared-asset anchors and native copy

Milestone 4d was published as `5c2e56e`. The [anchor-studies kit](../../../examples/library-kits/anchor-studies/README.md) implements the static branch of T03. Four cases reuse the original reservoir and conveyor sources in eight separately composed landscape/vertical specimens. The new [asset-anchor contract](../../asset-anchors.md) exports named object-local points, conservative subject bounds and copy rectangles with padding. Native text, leaders and anchor marks remain editable.

The exporter checks all 152 claimed static source frames across four prepared scenes and binds the scene, clip, receipt, definition and exporter. A separate real Blender camera-matrix calculation agrees at all 304 anchor/frame positions within 3.54e-8 normalized units. All 192 frames across the four explicitly looped hold clips exactly match the original final YUV frame. Real saved-scene negatives reject a moving range and overlapping copy rectangle without writing output. The eight-second action is not looped; annotations settle into a twenty-second held pose.

The full Node suite passes 188/188 with no skips. Independent review passes 501 contract assertions and 14 limited exporter control fixtures. All eight native pipelines have zero layout errors/warnings and zero detected pops; shuffled seek samples match. Encoded checks pass 104 native mappings, 336 sampled frames, 1,216 ring probes, 2,128 leader probes and 24 drawing-front probes, alongside bounded source-plate registration and held-image stability comparisons. An exact-frame diagnostic confirms antialiased leader pixels against the original source; positional tolerance was not enlarged. Independent phone review covers 80 decoded images plus that diagnostic. Every reading-rate critique is warning-free.

The library catalog now includes ten packages and 49 examples, with 96 native variants plus one prepared insert. The catalog and recording/report CLI receive current source checks. Interactive browser authorization remains pending.

T03 remains **partial prototype**. Geometry clearance does not establish rendered visibility, occlusion, shadow/blur clearance, material stability, face/edge connectivity or glyph fit. The current clips have sampled encoded review; moving tracking, occlusion intervals, general cross-renderer matching, square/4:5, subjective continuous playback and final master acceptance remain open. This milestone does not implement C18 small multiples. The full library build-out goal stays active.

## Milestone 4e — ranked small multiples with a stable comparison

Milestone 5d was published as `4616757`. The [small-multiples kit](../../../examples/library-kits/small-multiples-studies/README.md) adds C18 with four native specimens: two fictional cases, each in landscape and vertical. [Shared helpers](../../small-multiples.md) order a complete dated record by one declared same-date value, preserve competition ties and retain missing members without carrying earlier values forward. Compact panels use identical plot rectangles and domains. A selected panel enlarges uniformly, including its axes and labels; its data and domains do not change.

Delivery durations rank ascending and expose a tie plus an unranked June member. Household net flows rank descending and focus on a negative member. Each 78-second clip first shows the full January–June history ranked by January, then the same history ranked by June, then expands one panel. The ordering change is a deliberate cut between declared snapshots. It does not imply a forecast vintage or an interpolated ranking trajectory.

The full Node suite passes 192/192 without skips. Independent contract review checks 76,588 assertions across 9,344 rank cases and geometry/label guards. It resolved misleading multiyear labels and rounded ranking values; residual precision loss is explicitly marked approximate. Native sheet review also resolved compact landscape header overlap and portrait header spacing. All four final native clips have zero layout errors/warnings and zero detected pops, with matching shuffled-seek samples.

Independent Python checks pass 2,572 native mappings, 724 sampled encoded frames, 11,426 observation probes, 210 reveal fronts, 736 missing-column probes, 3,808 faded-panel probes and 176 point positions during expansion. Independent phone review covers 52 decoded frames across reveal, rank cuts, fading, expansion and settlement. Stable holds are intentional reading time; all critiques have zero reading warnings. No paid generation or external dataset is used.

The catalog expands to eleven packages and 51 examples, with 100 native variants plus one prepared insert. C18 remains **prototype**: more than four panels, independent scales, arbitrary layouts/copy, square/4:5, continuous subjective playback and final master acceptance remain unreviewed. The larger library build-out goal stays active.

## Milestone 4f — correlation windows and paired return histories

Milestone 4e was published as `2d8c79c`. The [correlation studies kit](../../../examples/library-kits/correlation-studies/README.md) adds C07 through [monthly Pearson helpers](../../correlations.md). Two original fictional three-member cases have four native landscape/vertical specimens. Each 94-second clip shows two explicitly dated six-month matrices, then the supplied returns behind an outlined pair. Matrices preserve member order and the signed color domain; selected charts share percent/date axes and a calendar-time reveal.

The contract retains every month-end, with null for missing returns. Each pair records its count and contributing/missing dates. Too few pairs and zero variance are separate undefined reasons, including diagonal cells. A valid zero remains zero. No data filling, price-level conversion, annualization, significance, prediction or causality is inferred. Pairwise matrices are descriptive and can be non-positive-semidefinite.

The full Node suite passes 196/196 with no skips. Independent review passes 32,489 assertions across 297 matrices and 2,531 cells, using exact IEEE-754 dyadic integers and a separate BigInt covariance formula. All four final native clips have zero layout errors/warnings and zero detected pops; sampled shuffled seeks agree. Source review and frame inspection caught and resolved a portrait footer placement issue and lines painting through hollow markers. Marker radii were enlarged to remain distinguishable after compression, without relaxing the pixel predicates.

Independent Python checks pass 540 arithmetic assertions, 1,424 native mappings and 840 sampled encoded frames: 19,968 cell-fill checks (including 5,280 undefined fills), 768 hidden-cell checks, 2,428 return-point checks, 72 drawing fronts, 192 missing-column checks and 220 hollow-center/rim checks. All are bound to current source and clip hashes. Independent phone review covers 44 decoded frames, with additional exact-frame diagnostics for the repaired markers. Intentional reading holds retain zero critique warnings.

The catalog expands to twelve packages and 53 examples, with 104 native variants plus one prepared insert. C07 remains **prototype**: other frequencies/methods, four-member visual acceptance, arbitrary new copy, square/4:5 layouts, subjective continuous playback and final master acceptance remain open. The larger library build-out goal stays active.

## Milestone 4g — explicit distributions and exact observed thresholds

Milestone 4f was published as `a837e90`. The [distribution studies kit](../../../examples/library-kits/distribution-studies/README.md) adds C13 through [sample histogram helpers](../../distributions.md). Two original fictional cases have four native landscape/vertical specimens. Each 64-second clip builds a histogram from supplied observations, then retains that complete context while drawing a threshold and outlining qualifying observations.

Equal-width signed-change bins use counts. Unequal service-delay bins use density with total area one. Both retain original member indices, explicit missing counts and exact threshold equality. Bar widths reflect the supplied edges; all positive bars must occupy at least one native pixel. A dot strip preserves x values while collision packing only separates rows. Exact numerator/denominator text replaces any assumed partial-bin area. These are descriptive samples, with no fitted bell curve or predictive tail probability.

The full Node suite passes 201/201 with no skips. Independent review passes 284,219 assertions over 10,212 model cases and native geometry guards. It resolved collapsed positive bars and insufficient selection-outline spacing. Native frame review resolved footer clearance and threshold lines crossing count labels. Compressed-frame inspection prompted thicker outlines; the final probes retain the original ink and positional thresholds.

All four final native pipelines have zero layout errors/warnings, zero detected pops and matching shuffled-seek samples. Independent Python checks pass 128 arithmetic assertions, 1,534 native mappings and 596 sampled encoded frames, including 2,285 bar interiors, 92 linear reveal fronts, 92 above-front exclusions, 14,304 observation marks, 4,488 outline-edge probes and 252 threshold probes. Complete source, native-job and video hashes bind those results. Phone review includes the cut, baseline growth, threshold drawing, settled labels and an exact-frame recheck of the repaired outline. Intentional reading holds have no critique warnings.

The catalog expands to thirteen packages and 55 examples, with 108 native variants plus one prepared insert. C13 remains **prototype**: arbitrary new copy/data density, weighted samples, fitted distributions, square/4:5, subjective continuous playback and final master acceptance remain open. Interactive browser authorization is still pending. The larger library build-out goal stays active.

## Milestone 4h — declared valuation grids and controlled slices

Milestone 4g was published as `b0f1fc8`. The [valuation studies kit](../../../examples/library-kits/valuation-studies/README.md) adds C14 through [annual cash-flow helpers](../../valuations.md). Two original fictional cases have four native landscape/vertical specimens. Each 72-second clip shows a flat grid of evaluated growth/discount assumptions, then a slice that holds every other assumption fixed. Cells preserve numeric rate spacing; the slice reuses the exact evaluated cells.

A growing perpetuity retains its explicit discount-greater-than-growth domain, including three undefined cells. A five-year project subtracts its initial outlay once and has no terminal value. Its negative, zero and positive outcomes remain distinct. The first future payment grows from the annual time-zero basis and arrives at the first year end. Native copy states those assumptions. Connecting segments are guides; intermediate cases are not evaluated or presented as evidence.

The full Node suite passes 206/206 with no skips. Independent exact-ratio review passes 33,154 comparisons, 30 rejection checks and 306 geometry checks. It resolved nonuniform-cell label placement and guarded crowded axes. Native phone review prompted clearer value-axis ticks. All four final pipelines have zero layout errors/warnings, zero detected pops and matching shuffled-seek samples. Storyboards and the audit reproduce byte-for-byte.

Independent Python checks pass 1,020 arithmetic assertions, 1,002 native mappings and 676 sampled encoded frames, including 19,104 cell fills, 1,960 undefined fills, 1,776 hidden cells, 986 point probes, 36 reveal fronts and 128 invalid-column probes. Source, native-job, checker and clip hashes bind those results. Independent phone review covers 48 decoded frames. Intentional reading holds have no critique warnings.

The catalog expands to fourteen packages and 57 examples, with 112 native variants plus one prepared insert. C14 remains **prototype**: new data/copy density, two-stage terminal models, broader financial assumptions, square/4:5, subjective continuous playback and final master acceptance remain open. Interactive browser authorization is still pending. The larger library build-out goal stays active.

## Milestone 5e — bounded orbit and truck moves

Milestone 4h was published as `2a11fc7`. The [camera travel studies](../../../examples/library-kits/camera-travel-studies/README.md) extend T04 with analytic orbit and equal-translation truck presets. Two original Blender scenes support four illustrative subjects and eight native landscape/vertical specimens. Each 18-second composition uses eight seconds of source motion and a ten-second explicit held-frame clip; native labels follow the source phase clock.

The orbit keeps a fixed target, cylindrical radius, height and optics through one 68-degree arc. The truck translates camera and target equally, preserving orientation and optics. Noncamera geometry stays fixed. Portrait truck was recomposed with a narrower bench, closer screens and shorter travel after review found its initial phone image too small. These qualitative arrangements do not claim dimensional equivalence or complete visibility: the rear marker passes beside, behind and then to the other side of a foreground screen.

Independent pure-model review passes 1,308,504 assertions across 288 cases and 53 rejected inputs, plus 2,412 exact comparisons against the committed version-1 sampler. It resolved acceptance of extra nested pose fields. The full Node suite passes 207/207 without skips. All 772 baked source samples pass camera, static-geometry, subject-bounds and shuffled-seek checks. Foreground/rear truck displacement agrees with the inverse-depth ratio within 6.60e−8. Three saved scenes reproduce posters exactly; orbit portrait differs in one color channel by 1/255.

All eight native pipelines have zero layout errors/warnings, zero detected pops and matching shuffled seeks. Encoded checks decode 4,320 frames and pass 2,520 final-hold comparisons; the largest mean hold variation is 0.228 and the largest join step is 0.00655 RGB levels. Source/native registration passes 168 shared-clock samples within 1.5 mean RGB levels. Source and native frames are normalized to the same pixel dimensions before cropping; this corrected a crop-grid mismatch without relaxing the threshold. Independent visual review covers 32 source and 88 native phone frames, including cue changes, the held-frame join and ending copy. All critiques have zero warnings.

The catalog expands to fifteen packages and 61 examples, with 120 native variants plus one prepared insert. The kit stays **prototype**. New geometry, optics, timing, copy, square/4:5, arbitrary collision/occlusion solving, subjective continuous playback and master acceptance remain open. M07 remains partial: these are authored format-specific compositions, not arbitrary automatic reframing. Interactive browser authorization is still pending; the full library goal stays active.

## Milestone 4i — dated phase trails and exact reference boundaries

Milestone 5e was published as `3064551`. The [phase studies kit](../../../examples/library-kits/phase-studies/README.md) adds C15 through [paired-observation helpers](../../phases.md). Two original fictional cases have four native landscape/vertical specimens. Each 72-second clip reveals dated observations, then inspects one supplied pair. Explicit x/y definitions, fixed axes and elapsed calendar days preserve the input meaning.

Missing either coordinate breaks both adjacent guides; no skipped-null connection is drawn. Unlisted dates remain unobserved. Actual markers appear at their supplied coordinates without traveling along a fitted path. Strict quadrant membership stays separate from exact x, y or both-reference equality. The machine comparison references are not operating limits. Straight segments are guides without measured intervening states, periodicity, prediction or causation.

The full Node suite passes 212/212 without skips. Independent review passes 81,655 assertions across 1,043 model cases, 144 scenes, 49 rejected inputs and 576 copy zones. It resolved crowded axis-label guards, display-equivalent quadrant labels and misleading inventory wording. Native frame review resolved landscape footer and portrait header placement. All four final pipelines have zero layout errors/warnings, zero detected pops and matching shuffled-seek samples. Storyboards and the audit reproduce byte-for-byte.

Independent Python checks pass 680 arithmetic assertions, 1,352 native mappings and 680 sampled encoded frames: 17,584 point-core probes, 4,396 observed date marks, 804 missing-date centers, 920 pre-arrival exclusions, 58 guide fronts, 5,088 outline probes and 624 separated gap probes. An initial color probe hit the downsampled rim; core sampling now avoids that rim without changing the RGB tolerance. Native radius checks and actual visual inspection retain separate shape evidence. Independent phone review covers 64 decoded frames through arrivals, missing intervals, the focus cut and ending hold. All critiques have zero warnings; reading holds are intentional.

The catalog expands to sixteen packages and 63 examples, with 124 native variants plus one prepared insert. C15 remains **prototype**. New dense data/copy, smoothing, inferred cycle models, square/4:5, subjective continuous playback and final master acceptance remain open. Interactive browser authorization is still pending; the full library goal stays active.

## Milestone 6b — conserved allocation trays

Milestone 4i was published as `73ab864`. The [allocation studies kit](../../../examples/library-kits/allocation-studies/README.md) adds I04 through [fixed-quantum ledger and scene helpers](../../allocations.md). Two original fictional plans have four native landscape/portrait specimens. Equal-value tiles visibly leave a source, cross an empty lane and enter a destination, followed by paired exact count bars on a declared zero-to-total scale. B13 remains a separate unbuilt Blender proposal.

The household example moves four 100 USD tiles within an unchanged 2,000 USD pool. The work-hour example preserves 48 hours and includes a round trip, so eight transfers produce four changed token owners and the final 8/8/8 allocation. The model stores exact integer minor units, stable token IDs, explicit transfer groups, slot identities and separate parked/transit states. No token scales, duplicates or fades. Source debits occur at departure; destination credits occur at arrival. This is an authored plan, not an optimizer or a model of returns, spending, risk or productivity.

The full Node suite passes 217/217 without skips. Independent review passes 481,271 assertions across 324 model cases, 32 default/retimed scene cases and 70 negative fixtures. It checks 24,121 ledger-clock states, 5,376 analytic swept-route pairs and 211,206 sampled simultaneous-token pairs. Review resolved coerced array-valued bucket IDs and a misleading final caption for pure round trips. Default storyboards and the audit reproduce byte-for-byte after exposing custom editorial timing. All four native pipelines have zero layout errors/warnings, zero detected pops and matching shuffled seeks.

The Python/NumPy checker independently verifies 1,028 arithmetic assertions and 2,048 native mappings. It decodes every one of the 3,360 tray frames and 200 additional comparison frames. All frames retain the expected 20 or 24 connected whole tiles, with 75,360 matched token poses, 376,800 core-color probes and 3,600 comparison probes. No blue pixels occur outside the expanded expected token bounds. The largest observed center error is 1.223 px at 720 px width. Native geometry and the ledger establish exact sizes and identities; compressed pixel areas are approximate.

Independent picture review covers 72 actual decoded phone frames, including both directions of the work-hour round trip. One reading-density heuristic warning per clip is retained with explicit rationale: critique accumulates 118 or 128 words from successive mutually exclusive readouts, while an actual state contains 63–66 whitespace-delimited words with mostly persistent wording. This supports a bounded silent component study, not continuous reading-pace or final-film acceptance. Long ending comparison holds are intentional.

The catalog expands to seventeen packages and 65 examples, with 128 native variants plus one prepared insert. I04 remains **prototype**. New copy, units, timing, denser trays, square/4:5, fractional-token allocations, continuous subjective playback and final master acceptance remain open. Interactive browser authorization remains pending; the larger library goal stays active.

## Visual quality correction — October 3, 2026

The user rejected the counterbalance direction as cheap and low quality and emphasized that details matter. The [counterweight craft review](reviews/counterweight-2026-10-03/README.md) retains the actual draft stills, mechanically passing evidence and interrupted render receipt. The framing experiment was withdrawn; the published recipe and historical assets remain unchanged. No new asset or acceptance is claimed.

For subsequent candidates, art-directed still and close-detail review precede substantial motion rendering and packaging. Review explanatory purpose, designed form, construction/contact details, coherent materials, lighting, composition and native typography. Then inspect a short encoded motion pass. Numerical and deterministic checks remain required, but their success cannot satisfy this craft gate. Prioritize improving one convincing exemplar over expanding more unapproved variants.
