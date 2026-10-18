# A table with audience views

`canvas.props.table` draws an editable table with fixed rows and columns. Use it for approval records, plan comparisons or a workflow where each audience receives different fields. [The example](../examples/audience-views/storyboard.json) shows managers reading three claims, contractors seeing their status, then the full view returning. Start an editable film with `new DIR --playbook audience-views`.

```json
{
  "table": {
    "id": "claims", "title": "Who sees a claim",
    "source": "Illustrative expense records",
    "columns": [
      {"id": "person", "label": "Employee"},
      {"id": "amount", "label": "Amount", "align": "right"},
      {"id": "status", "label": "Status"}
    ],
    "rows": [{"id": "r1", "cells": {"person": "Alex Morgan", "amount": "$120", "status": "Approved"}}],
    "views": [
      {"id": "manager", "label": "Managers see the full claim"},
      {"id": "contractor", "label": "Contractors see claim status", "hide": ["person", "amount"]}
    ],
    "show": [{"view": "contractor", "at": 3}, {"view": "manager", "at": 6}]
  }
}
```

Each cell is authored text: format amounts with their units. `align: "right"` uses tabular figures. Column `weight` (0.5–4, default 1) allocates relative width. Every row needs exactly one cell per column. A source line and the storyboard's `sources` entry attribute the data; `asOf` optionally adds a date.

The first audience is shown initially. `show` changes the view at an increasing sequence of scene seconds, narrated words (`say`) or named moments (`cue`), with optional `after` for a word or cue. Omit `views` and `show` for a plain table. Changes use an immediate swap so a concealed value does not fade through a redaction bar. A hidden cell draws a neutral bar and keeps its slot. Its real text is absent from the drawing for that interval. Values remain in the editable source: audience views are a presentation device, not an access-control boundary.

Cells retain IDs of the form `tbl-claims-r1-amount`. These identify real cell rectangles, including hidden cells, for framing and pointing. Column labels remain visible when their values are hidden.

The limit is eight rows and six columns; portrait frames take at most three columns. Difficult copy must fit at a readable size: the compiler refuses crowded cells rather than silently truncating them. For dense tables, begin with a readable cell close-up, then reveal the overview with `props.reveal: {from: ["tbl-claims-r1-person", "tbl-claims-r1-amount"], at: 2, dur: 1.2}`. An eight-by-six overview is a context shot; its smallest text is not legible at phone size. Split the reading work into shots, shorten labels or change column weights. Native shaping and the frame audit verify the resulting fit. Keep the title and audience label short enough to leave room for the data and captions.

Validation: `node --test test/table.test.mjs`. The rendered fixture is `test/fixtures/library-bar/audience-table.json`; run it through `node scripts/library-bar.mjs … --out NEWDIR`. It covers landscape, portrait, an eight-by-six table, first/last-column hiding, changed amounts, caption clearance, a cell-to-table reveal and a portrait-width refusal. The reference is [Carbon's table anatomy](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines#anatomy): a clear title, quiet header, aligned cells and restrained rules. No reference code or assets are imported.
