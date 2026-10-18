# Named moments: one event, many responses

A canvas beat can name its moments once and have many things respond to each one. A parcel *lands*: the box drops, squashes and settles, a ring spreads, a label appears and a thud sounds, all on the same event. Retime the word, and every response and its sound moves with it.

```json
{
  "block": "canvas",
  "vo": "The parcel lands on the step, and the bell rings once.",
  "props": {
    "moments": {"LAND": "lands", "SETTLE": {"cue": "LAND", "after": 0.4}, "RING": {"say": "rings"}},
    "elements": [
      {"id": "step", "type": "rect", "x": 600, "y": 700, "w": 600, "h": 24, "fill": "ink", "at": 0, "enter": "none"},
      {"id": "box", "type": "rect", "x": 800, "y": 500, "w": 200, "h": 200, "fill": "accent", "cue": "LAND", "sound": "thud",
       "keys": [{"cue": "LAND", "after": -0.1, "dur": 0.1, "scaleY": 0.8}, {"cue": "SETTLE", "dur": 0.3, "scaleY": 1}]},
      {"id": "ring", "type": "circle", "cx": 900, "cy": 600, "r": 160, "fill": "none", "stroke": "accent", "width": 4, "cue": "LAND", "after": 0.05, "exitCue": "SETTLE", "exitAfter": 0.5},
      {"id": "label", "type": "text", "text": "Delivered", "x": 900, "y": 860, "size": 60, "anchor": "middle", "cue": "SETTLE"}
    ]
  }
}
```

## Defining moments

- **The forms.** Each moment is a word of the narration (`"lands"` or `{say, after}`), seconds (`{at}`), or another moment plus a delay (`{cue, after}`).
- **Measured timing.** Words are resolved from the measured word timings, exactly like every other spoken cue. A word the line does not say is refused, quoting the line.
- **Limits.**
  - Names are a letter followed by letters, digits, `_` or `-`.
  - A chain that loops (`A → B → A`) is refused, as is a moment that lands outside the beat.

## Landing on a moment

`cue: NAME` works on:

- an element's entrance
- a key
- an `along` route
- an exit (`exitCue`, with `exitAfter`)
- a mark on text
- a document scroll
- a shine
- receipts, apps and crumbs
- the structured pictures: a [breakdown](breakdown.md)'s parts and opening, a [process](process.md)'s runs, a [decision](decision.md)'s cases and return, a [table](table.md)'s views, and a [reveal](target-camera.md)

`after` is seconds from the moment. It can be negative (−3 to 10) to anticipate the moment: a squash before a landing.

A moment-linked element takes the moment's exact time. Text on a moment does not take the usual early start that word-cued text gets.

## Checks

- **Bad references.** A `cue` naming a moment the beat does not declare is refused, listing the moments it has. A moment nothing lands on is reported.
- **Too late.** A response landing after the beat ends is refused, naming the moment and its `after`.
- **Pacing keeps the event shared.** If the voice talks over an empty scene before the first moment, the drawing is **not** pulled forward, because that would split the event. `check` reports the empty opening instead; draw the ground or the setting from the cut (`at: 0, enter: "none"`).
- **Stepped drawings.** A drawing on twelves (`fps: 12`) shows its moment on its next drawing, and its sound plays on that drawing.

Tests: `node --test test/moments.test.mjs`.
