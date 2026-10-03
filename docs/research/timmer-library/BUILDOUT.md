# Library build-out goal

Authorized October 2, 2026: extend the general library with retirement, build the reusable assets and tools, and commit/push validated milestones to `main` periodically. Quality takes precedence over inventory count. This is an active build, not a claim that every proposal already exists.

Additional user direction: include a small set of [Timmer-inspired style studies](STYLE-STUDIES.md) using actual chart imagery from posts/publications: two native examples and one Blender interpretation. Keep the existing build direction. Actual image inspection must precede any claim of extracted styling.

## Milestones

| Milestone | Scope | State |
|---|---|---|
| 0 — Durable inventory | Original package and 62-item macro inventory; add nine retirement recipes and primary references | Source validated; visual status unchanged |
| 1 — Calculation contracts | T02 foundation: contribution ledger, tiered match, ownership, fee comparison, pension formula and cashflow fixtures | Implemented; focused calculation checks pass |
| 2 — Quantitative drawings | T01/C01 explicit scales, multiseries comparison, missing data, dates, annotations and native labels | Engineering foundation implemented; rendered prototypes fail phone/phase-label review |
| 3 — Retirement specimens | R01–R09: reusable native recipes, two distinct example subjects, landscape/portrait compositions | Planned |
| 4 — Drivers, participation and flows | Reconciled decomposition, breadth/count versus weight, relative performance and stocks/flows | Planned |
| 5 — Physical mechanisms and cameras | Curate existing B01–B03; build reservoir/gate/conveyor and reusable camera/phase contracts | Planned |
| 6 — Remaining collections | Curves, relationships, uncertainty, long horizons, delayed payoff and supporting tools | Planned |

Use inventory IDs to track individual deliveries. Each milestone can contain several small commits; push only after its relevant checks pass. Fetch `origin/main` before each push, integrate concurrent commits in this isolated checkout, and never force-push. Do not sweep another chat's edits into a commit. Record the pushed commit and evidence here or in a linked milestone report. Keep the worktree while this goal needs it.

## High asset quality bar

An accepted asset must pass every applicable requirement below. A polished poster cannot substitute for motion review; passing tests cannot substitute for a readable picture.

1. **Explanatory value.** Name the question the asset answers. Demonstrate two substantively different subjects or scenarios. Show why the mechanism helps the explanation. Variations must change more than color.
2. **Truthful quantities.** Use auditable input data, independent calculation fixtures, declared units/dates/scales and visible sample/source labels. Disclose assumptions and missing values. Preserve negative returns and shortfalls. Keep pension promises, account balances, ownership and withdrawal eligibility distinct.
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

Next: fix quantitative presentation at 360 px, establish series identities and missing-data context before the reveal, make the growth explanation explicit, and review motion plus long/near-coincident labels. Add logarithmic/annotation specimens and arbitrary-seek evidence before promotion. Then build the retirement recipes on the accepted foundation. Rendering remains subject to the disk reserve; no generated visual candidate is accepted yet.
