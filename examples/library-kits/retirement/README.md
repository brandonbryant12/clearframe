# Retirement mechanisms — native source kit

Nine reusable recipes with two fictional scenarios each, independently composed in landscape and vertical. This is a **prototype** kit of silent explanatory scenes. The [preview](preview.html) lets you inspect every retained clip; [review](REVIEW.md) distinguishes calculation and rendered evidence from remaining acceptance work.

| ID | Operation | Different scenarios |
|---|---|---|
| R01 | Account trace and one-period reconciliation | Steady additions; additions with losses |
| R02 | Marginal matching bands | Single rate; multiple rates and unmatched contributions |
| R03 | Shared-total ownership compartments | Graded schedule; cliff schedule |
| R04 | Fee paths and reconciled gap waterfall | Steady return; mixed returns with contributions |
| R05 | Payment request, funded amount and shortfall | Depleted account; fully funded requests |
| R06 | Salary/service factors and annual/monthly result | Adjusted benefit; unadjusted benefit |
| R07 | Quoted amounts beside their units and conditions | Fixed quotations; guarantee/COLA conditions |
| R08 | Nominal/real traces and explicit deflation equation | Rising prices; falling prices |
| R09 | Identical returns reordered under withdrawals | Positive ending balances; depletion and unequal shortfalls |

## Adapt and replay

Edit the explicit inputs in `source/fixtures.mjs`, then run `node examples/library-kits/retirement/build.mjs` from the repository root. The builder emits native storyboards, retained inputs and an audit ledger. `buildCase(fixture, 'landscape' | 'vertical')` in `source/recipes.mjs` returns editable beats, calculations and geometric records. Copy selected beats into an existing film with their source entries; this package does not add a loader, renderer or executable plugin. It needs the repository's native `canvas.props.plot`, readable canvas source footer and finance helpers. No Blender, network service or paid generation is required.

Run focused checks with `node --test test/retirement-kit.test.mjs`. After checking the disk reserve, use the shared resource gate:

```sh
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node examples/library-kits/retirement/verify.mjs --inspect
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node examples/library-kits/retirement/verify.mjs
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node examples/library-kits/retirement/seek.mjs
/Users/brandon/.local/bin/codex-heavy -- python3 examples/library-kits/retirement/check-encoded.py
node examples/library-kits/retirement/package.mjs
```

The native setup must already be installed. An offline source cache can be supplied through `SKIA_SOURCE_DIR` as documented by the native build tool; this is an environment configuration, not a hardcoded kit dependency. Native compilation uses one Cargo worker and encoding/decoding at most two workers. `verify.mjs` optionally takes specimen names to rerun a subset. It retains per-project failures instead of confusing an incomplete run with success.

## Quantitative contract

Calculations use [the explicit finance contracts](../../../docs/finance-calculations.md), without intermediate rounding. Labels round only for display. Common domains, equal bar thickness and equal reservoir width make length and rectangular area proportional to the values. Zero balance has no fill. Values preserve losses and unpaid requests. Quantitative shapes fade at their exact dimensions; they never grow through false amounts. Native chart reveals use one linear data-time clock. Reservoir connectors encode order only, not the size of cashflows. No 3D volume, perspective, probabilistic or actuarial meaning is implied.

R03 snapshots hold balances fixed to isolate ownership. R06 implements only the supplied salary/service formula. R07 retains supplied quotations; it does **not** compute present values, lifetime totals, suitability or legal entitlements. All rules and numbers are fictional examples. Actual plan documents and sourced data must replace them before factual publication. R08 states the price base and preserves monthly units. R09 keeps the return multiset and withdrawal convention identical, and shows unequal funded payments when accounts deplete.

## Evidence and limits

`kit.json` hashes the retained sources, clips, receipts and reports. `evidence/summary.json` summarizes native audits and encoded QA; individual folders retain full-size draft clips, phone/timeline sheets and boundary reports. The word *draft* describes the silent preparation mode, not reduced native output dimensions. Renderer revision in native receipts identifies its pinned upstream package; file hashes bind the exact prepared inputs.

Focused fixtures check independent arithmetic and the actual authored rectangle geometry. `check-encoded.py` independently verifies source/native ratios and probes horizontal/vertical edges in every eligible decoded frame at 720px width. It includes visible fades and holds, with explicit antialiasing tolerance and exclusions. This is bounded edge evidence, not every-pixel area measurement, proof of arbitrary future data, chart-path validation for this kit, or subjective continuous playback. `seek.mjs` compares five frames per specimen in forward and shuffled order.

Only landscape and vertical are demonstrated here. Square and 4:5 layouts, arbitrary long copy, new input domains, continuous playback review and finished-film pacing remain separate work. Reading holds are deliberate in this silent specimen set. A native pipeline's `ready-for-review` result does not promote the package to accepted. Review the [brief](DIRECTION.md) and [independent findings](REVIEW.md) before reuse. Timmer image-derived style studies remain separately planned; this kit is original composition, not a claimed extraction of his graphics.
