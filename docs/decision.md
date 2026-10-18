# Decision: a rule, a case and what changes it

`canvas.props.decision` draws a stated rule as yes/no questions that lead to outcomes, then walks a case through it. A second case with one answer changed (the counterfactual) shows what that answer does. `return` brings the first case back.

```json
{"block": "canvas", "props": {"decision": {
  "id": "claim", "title": "Which route a claim takes", "source": "Example rule for illustration",
  "ask": [{"id": "amount", "label": "Over $500?"}, {"id": "receipt", "label": "Itemised receipt?"}],
  "tree": {"ask": "amount", "yes": "manager", "no": {"ask": "receipt", "yes": "auto", "no": "returned"}},
  "outcomes": [{"id": "manager", "label": "Manager approves"}, {"id": "auto", "label": "Approved automatically", "tone": "positive"}, {"id": "returned", "label": "Returned to you", "tone": "negative"}],
  "cases": [{"label": "A $120 taxi", "answers": {"amount": "no", "receipt": "yes"}, "say": "taxi"},
            {"label": "Same taxi, no receipt", "answers": {"amount": "no", "receipt": "no"}, "say": "Take"}],
  "return": {"say": "Keep"}
}}}
```

## The rule

- **Size.** 1–4 questions (`yes`/`no` labels can be renamed) and 2–5 outcomes.
- **Every node is reachable.** Every outcome and every question must be reachable, and no question is asked twice on one path.
- **The rule is the author's.** Copy its questions and outcomes from the rule's own text. The source line says "Example rule for illustration" unless `source` names the real one. A storyboard `sources` entry is required.

## The cases

- **Answering.** A case answers what its path asks. A question its path never reaches needs no answer: a $900 hotel goes to the manager without being asked for a receipt.
- **The case line.** Under the title, a line names the case and every answer it gives. Only one case line is ever on screen.
- **The walk.** The walk draws over the chosen connectors, hop by hop, and lights each question and the outcome it reaches.
- **The counterfactual.**
  - It must change an answer the rule actually asks, and must not take the same path to the same outcome.
  - Its changed answers are marked in its case line, but only answers that line actually shows.
  - It walks in a second, dashed colour. The first walk stays as a ghost, so both outcomes can be compared.
- **`return`.** The first case's walk comes back; the counterfactual's shared hops step aside and its divergent part stays as a ghost.

## Layout and identity

- **Wide frames** run the rule left to right with outcomes in a column at the right. **Tall frames** run it top to bottom with outcomes along the foot. Long labels wrap to two lines rather than shrinking.
- **Stable ids.** The rule's cards and connectors keep their ids across beats (`dc-ID-node-…`, `dc-ID-out-…`), so they carry across a cut.
- **Per-beat ids.** Case lines and walks are the beat's own (their ids carry the beat id), so a cut never re-times them.

Tests: `node --test test/decision.test.mjs`. Example: `examples/which-route`; playbook: `which-route`.
