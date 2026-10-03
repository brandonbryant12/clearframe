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
| 5 — Physical mechanisms and cameras | Curate existing B01–B03; build reservoir/gate/conveyor and reusable camera/phase contracts | 5a phase/retiming foundation implemented; physical expansion and camera tools remain planned |
| 6 — Remaining collections | Curves, relationships, uncertainty, long horizons, delayed payoff and supporting tools | Planned |

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
