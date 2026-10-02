# Produce and improve films through the CLI

The priority is a mature standalone production workflow. Prove it on real videos and repeatable local runs before moving the pipeline into another product. ClearFrame's current CLI and native renderer own this work; Content Studio integration is deferred.

## Working method

1. **Prepare the material once.** Use `start` for an idea, document and brand kit, or `ingest --audio` for an existing recording. Read the source brief, record the audience and takeaway, compare three different narrative/visual approaches and choose one. `directions research` and `directions podcast` provide optional starting points; custom direction files and original scene authoring keep the space open. Keep supplied brand assets unchanged.
2. **Author a complete first pass.** Write the question, tension, turn and payoff. Give each sequence a visual purpose; use reusable mechanisms where they clarify the story. Concentrate custom work on the opening, hardest explanation and payoff. Replace every sample claim together with its source. Keep later polish ideas in an improvement queue so they do not block a complete draft.
3. **Run a smaller review copy.** `pipeline FILM --draft --scale 0.5` generates free local narration only where needed, checks the film, writes an authored-size sheet, renders a review MP4, runs encoded QA and decodes boundary frames. Imported recordings and real takes are preserved. The run saves stage times, receipts, warnings and a review queue.
4. **Review the complete film, then revise deliberately.** Watch and listen once for the argument and rhythm. Inspect marked holds, boundaries and the phone sheet. Fix factual errors, confusing mechanisms and readability first. Spend subsequent craft time on specific shots. Record why a slow hold is intentional rather than adding motion just to satisfy a metric.
5. **Freeze and finish.** Finalize narration, source attribution, brand placement and assets. Measure speech timing when required by speech-following text/captions. Run `pipeline FILM` at full authored resolution. This uses prepared inputs and never purchases/generates provider media. Review the final encode and record the delivered MP4 hash with its sources and acceptance notes.

An early complete draft is a milestone. A finished film is a separate milestone. Render timing is not time-to-first-draft: capture the time spent on evidence, story direction, scene authoring and revision alongside the harness's measured stages.

## Production command

```sh
node engine/cli.mjs pipeline film --draft --scale 0.5
node engine/cli.mjs pipeline film --draft --no-render
node engine/cli.mjs pipeline film --json
```

`pipeline` enters the local `codex-heavy` gate automatically when it is installed. An existing outer gate is inherited without nesting. Resource caps in native rendering remain unchanged. Keep 20 GiB free before expensive work; preserve earlier evidence.

QA shares one decode for its timeline and phone sheets. Final encoding checks the complete muxed video's decoded frame count before publishing it. The [performance measurements](performance.md) document the saved work, worker limits and byte-for-byte comparisons.

Each invocation gets a fresh `film/build/pipeline/<run-id>/` directory. The prior run is retained. Outputs include:

- `REPORT.md` and `report.json`: result, elapsed time by stage, errors and the review queue.
- `check.json`, a storyboard snapshot and the prepared-input manifest embedded in the report.
- `sheet.png` with its receipt.
- `video.mp4` with its render receipt, dimensions, input/output hashes and voice provenance.
- `qa.json`, a full-film timeline and a phone sheet.
- `boundaries/index.html`: the encoded picture at cuts and first/last word boundaries, with video playback.

The snapshot, sheet and video must match the checked input identity. The boundary review rechecks video and input bytes. If a stage fails, the report records the failed stage and the command exits nonzero. It never returns a success status for an earlier run's video. `--json` puts the machine-readable result on stdout and progress on stderr.

Statuses have deliberately narrow meanings:

| Status | What was established |
| --- | --- |
| `running` | This run has not completed; an interruption may leave this state |
| `failed` | A recorded stage failed; inspect the error and retained evidence |
| `checked-no-render` | Story critique, input/layout checks and the matching sheet completed |
| `ready-for-review` | Checks, encode, encoded QA and boundary evidence completed |

`ready-for-review` does not mean the story, factual claims or artistic quality were approved. Cinema scores, held-frame diagnostics and layout advisories guide review; they do not replace it. A final encode can still contain local synthetic narration or illustrative data; voice/source provenance remains visible in the receipt and storyboard.

## Reusable regression harness

```sh
npm run verify:pipeline -- /path/to/new-evidence --quick
npm run verify:pipeline -- /path/to/new-evidence
```

The quick run exercises the cash-flow fixture. The full run also exercises scenario, risk, research-investigation and podcast-thread films in landscape and vertical. Both run the actual CLI and verify:

- document/brand intake survives removal of its original kit;
- each pipeline report parses as JSON, stages pass and artifact files exist;
- checked inputs, storyboard snapshot, sheet and encoded video agree;
- full/half-size drafts share the same inputs, frame clock and decoded PCM audio;
- reduced final output is refused;
- the full-resolution final encoder passes the production chain and preserves the earlier draft;
- a broken input creates a durable failed-stage report and no claimed output.

The harness is serial, uses the shared heavy gate and needs no provider API. It refuses an existing evidence directory. Native/tool failures fail the run; warnings remain in the saved review queues. `verification.json` and `REPORT.md` record the Git revision, dirty-work state, timings, artifacts and benchmark limits. The illustrative ledger and brand fixture live in `examples/financial-intake/`.

Use this suite after changing intake, production orchestration, render geometry or these financial/source library primitives. Keep the broader `verify-native.mjs` for renderer/block changes. Compare the same frozen source and audio across versions; do not claim a general speedup from a single short film.
