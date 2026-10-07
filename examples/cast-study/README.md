# One cast, five moves

A 17-second study of a [cast](../../docs/cast.md): the same six objects carry a short across every cut instead of a new card per line. It tells how a ClearFrame film comes together, using the pieces of a film as its subject.

| Beat | Narration | The move |
|---|---|---|
| `pile` | "Every film starts as a pile of material." | Report, chart and voice are already on frame one; a quote and a photo drop in and an idea pops up: a loose scatter. |
| `order` | "So the agent pulls what matters into an order." | On "pulls" the idea leaves the frame and the other five slide into a line (a column on vertical); a thread draws through them. |
| `moment` | "One piece becomes the moment on screen." | On "becomes" the chart steps forward and the rest recede into a quiet ring; "the moment" types under it and fades before the cut. |
| `note` | "But a note lands, and only that moment changes." | A pencil note drops in beside the chart, walks onto its corner and scribbles; the chart gives under each stroke, then turns into a line chart on "changes". |
| `plays` | "So the film plays on, with one moment new." | The note leaves, the five line up again with the new chart in second place, and on "new" a pulse runs down the sequence like a playhead. |

## What carries the story

- **What persists.** Six objects with fixed identities (the report, the chart, the quote, the voice, the photo and the idea), plus the line chart that replaces the chart and the note that causes it. Every beat starts each object at the place, scale, opacity and depth where the last beat left it. A settled thread stays until the next move.
- **What changes.** The arrangement (pile, sequence, hero, sequence) and one object's identity (bar chart to line chart). The change has a visible cause: the note.
- **Why the next shot happens.** Each move is the consequence of the one before. A pile needs an order, and an order has a moment that matters. A note on that moment changes it, and the sequence plays on with the change in place. The narration says it causally ("so", "but", "so").
- **What the audience learns.** How a ClearFrame film is made and revised: material becomes a sequence, a note changes one moment, and the rest of the film is untouched.

Compared with the earlier PR film (`examples/pr-film`), which is still a series of separate compositions, nothing here is redrawn between beats. The cuts fall where the voice moves on, and the picture keeps going.

## Make it

```sh
node examples/cast-study/build.mjs                 # writes storyboard-landscape.json and storyboard-vertical.json
mkdir -p build/cast-study && cp examples/cast-study/storyboard-vertical.json build/cast-study/storyboard.json
node engine/cli.mjs draft build/cast-study         # free local draft voice; renders go to build/
node engine/cli.mjs qa build/cast-study            # build/cast-study/build/qa/phone.png
```

## Measured

Measured on the 8 GB iMac with a warm renderer cache:

- **Render time.** 520 frames in 6.3 s in each shape. A whole draft pass took 8.5 s with the voice cached and 19.9 s when the voice was recorded fresh.
- **Checks.** `check`: 0 errors and 0 warnings in both shapes.
- **`qa`.** 0 pops in both shapes, and about 2.9 changes per second.
- **Holds.** Landscape has no held stretch. Vertical has one advisory: 2.5 s while the small note drops and walks onto the chart. It was reviewed in motion and kept.
- **Critique.** The cinema score is 67. The remaining notes are the locked camera and the single scene family, which are what holding one continuous shot costs.
