# Financial stories as films

These arcs turn an approved financial explanation into a short film. They begin with a question, draw the mechanism, give evidence its own space and end with a decision. They use deterministic native graphics and require no generated imagery or paid media.

| Playbook | Story | Native metaphor | Bring before publishing |
|---|---|---|---|
| `cash-flow` | A payment can exist before its cash is available; the sample balance carries the timing gap | `cash-lock`: a payment waits at a clearing gate, then moves into available cash | Actual availability rules, dates, same-period flows and reconciled opening/closing balances |
| `scenario-lab` | A decision depends on assumptions; compare possible outcomes on one basis | `scenario-origin` then `scenario-outcomes`: one camera pulls back from a common origin to reveal the possibilities | Defined assumptions, comparable scenario inputs, limits and the signal that would trigger a review |
| `risk-tradeoffs` | A headline benefit needs equally visible conditions and limitations | `risk-lens`: a lens inspects access, price and potential loss | Approved benefit/risk statements, current terms, fees and access conditions |

The drawings are qualitative. Path lengths, positions, marker sizes and animation timings do not represent amounts, probabilities, time to settlement or risk scores. Scenario branches have equal-size markers and no probability shading. Native chart blocks carry the quantitative evidence. The `scenario-fork` sketch offers the complete diagram as one shot; the playbook splits it into a close origin shot and a wider outcomes shot in the same world so narration continues to reveal the picture.

## Start a draft

```sh
node engine/cli.mjs new /tmp/cash-flow-demo --playbook cash-flow
node engine/cli.mjs new /tmp/scenario-demo --playbook scenario-lab
node engine/cli.mjs new /tmp/risk-demo --playbook risk-tradeoffs
node engine/cli.mjs new /tmp/scenario-vertical-demo --playbook scenario-lab --vertical
node engine/cli.mjs critique /tmp/cash-flow-demo
node engine/cli.mjs voice /tmp/cash-flow-demo --draft
node engine/cli.mjs sheet /tmp/cash-flow-demo --draft
```

Choose a fresh destination for each `new` command. The landscape and vertical scaffolds redraw the mechanism for their frame. Individual sketches also support square and portrait via the library API. A treatment can set a different art direction; brand palettes and type voices can be supplied through `--library` or the project's `library/`.

The cash example reconciles as **$60k opening + $40k collections - $70k payments = $30k closing** during one illustrative month. The scenario example uses **$80k, $100k and $120k** of illustrative revenue for the same month. These are authored arithmetic examples, not company results or forecasts. Replace the entire dataset, its narration, visible sources and `sources` entries together. Keep every comparison on the same units, period, fee basis and assumptions.

## Direct the adaptation

Start with the audience's question and keep only the scenes that answer it. A settlement explanation needs the gate; a product risk story needs the lens. Use approved documents to replace placeholder statements before directing the narration. The opening and final questions are prompts to adapt, not a recommendation to buy, sell or select a financial product.

The financial drawings use local animation times for their reusable reference motion. After changing the narration, cue the important gate opening, branch reveal or lens move to an exact spoken phrase with `say`; review before and after the action. Keep the initial ground visible at `at: 0` and `enter: "none"`. Preserve short silence before the final question. A slow camera push supports inspection; a graphic wipe marks a change of argument.

Keep material limitations as visible and audible as the benefit. `scenario-lab` gives its uncertainty a full spoken scene. `risk-tradeoffs` puts benefit questions and limitation questions in equal columns. Sources in a footer do not replace a readable disclosure. Before publishing, review the actual terms and narrative through the appropriate approval process for the intended audience.

## Review the film

Run `critique`, inspect a draft sheet, then run `check`, render and review the complete video. Use `qa` to inspect temporal issues and the 360 px phone sheet. A passing native job contract confirms valid authoring data; it does not establish legibility, financial accuracy, pacing or an approved communication. The test file `test/financial-playbooks.test.mjs` checks native compilation, deterministic geometry, evidence preservation and the sample's reconciliation.

On the shared 8 GB Mac, use the heavy-work gate for a full render:

```sh
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node engine/cli.mjs render /tmp/cash-flow-demo --draft
node engine/cli.mjs review /tmp/cash-flow-demo
node engine/cli.mjs qa /tmp/cash-flow-demo
```
