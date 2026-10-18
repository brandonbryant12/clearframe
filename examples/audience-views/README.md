# One claim, two audiences

A native table changes which columns are visible while keeping each claim in its original row. The three records and visibility policy are illustrative. Replace the rows, audience policy and visible source before using real material.

Run `node engine/cli.mjs check examples/audience-views --draft`, then `node engine/cli.mjs render examples/audience-views --draft`. Outputs stay in `build/`. Use `new DIR --playbook audience-views` for a narrated starting point whose changes follow words. The complete authoring contract is in [the table guide](../../docs/table.md).

The review fixture, `test/fixtures/library-bar/audience-table.json`, adds portrait, captions, an eight-row/six-column overview, a detail-to-context reveal, a changed amount and an over-wide portrait refusal. Dense overview text needs close-ups for phone reading. Mechanical checks and human acceptance are separate.
