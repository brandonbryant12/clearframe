# By morning: a person, a product and a city

A 15-second launch film built from three of the library's existing set pieces, each chosen for one part of a human story and adapted where the brief needed it. It was curated by hand to show the path from discovery to adaptation; it is not agent output, and "Penny" is a made-up product.

**The brief:** "A launch film for a small budgeting app that one person built late at night. By morning, the city is using it."

**What it feels like:** quiet, then hopeful. One lit screen in a dark room becomes a city of lit windows. The light is the through-line: the person's screen, the app, then everyone's windows.

| Beat | Narration | Picture | Piece, and why it suits this brief |
|---|---|---|---|
| `night` | "At two in the morning, one person was still at the desk, **building** the app they wished they had." | A seated silhouette and a night window; the laptop's light comes on at "building"; a slow push. | `desk`: "the human moment in a work story: a founder… one person, one screen". **Copied and adapted:** the screen's light is cued to "building", as the sketch itself advises. |
| `app` | "Penny. A budget you keep in one minute a day." | An iris opens on a window that swings in over a sky with the product's name and line, and chips floating around it. | `device`: "launches and product beats: here is the app". **Slots only:** `sketchText` `PRODUCT` and `LINE`. |
| `morning` | "By **morning**, the whole city was opening it." | Rooftops at sunrise; the windows come on across the city, starting on "morning". | `rooftops`: "mornings, cities… windows coming on as the city wakes". **Copied and adapted:** its windows, which light at scattered fixed seconds, are gathered into one group cued to "morning", in a seeded order. |

## How these were found and adapted

These are real outputs, from `node engine/cli.mjs` or the studio agent's `clearframe_catalog`.

1. **`find`** on the brief. `find "launch film for a small app one person built late at night; by morning the whole city is using it"` gives `playbook:product-reveal`, `cast-shape:phone`, `cast-shape:flag`, **`sketch:desk`**, `playbook:vertical-short`, **`sketch:device`**, `palette:midnight`, **`palette:cinema`** and others.
2. **Narrow per concept,** for the city waking. `find "the city wakes up in the morning, windows coming on" --kind sketch` gives **`sketch:rooftops`**, `sketch:skyline` and `sketch:citygrid`.
3. **`find --id`** for each:
   - `sketch:device` lists `sketchText PRODUCT, LINE`, so slots are enough.
   - `sketch:desk` and `sketch:rooftops` list no slots or moments. Their timing is fixed, so changing *when* something happens means copying the drawing.
4. **Copy the drawing.** `sketch('desk', shape)` and `sketch('rooftops', shape)` in [build.mjs](build.mjs) return the elements; in the studio, `clearframe_catalog` topic `sketch` returns them; by hand, use `node engine/cli.mjs sketch NAME --vertical`. The script changes only what the story needs (the light's cue, and the windows' start), keeps each sketch's camera (`dolly`, `view`), and puts the elements in `props.elements`.

## Checks and limits

- **`check`:** both shapes report 0 errors and 0 warnings (about 450 frames each, under 8 s to render on this Mac).
- **Critique:** the cinema score is 100/100, a heuristic; it does not establish visual quality.
- **Phone size:** both motion sheets were read.
- **Limit:** `desk` is a wide composition. On a tall frame it sits small in the middle of the frame, with empty space above and below. A tall layout for `desk` is the obvious next step. `rooftops` and `device` fill a tall frame well.
- **Limit:** the windows wake in a seeded random order, not from one point outward.

## Make it

```sh
node examples/by-morning/build.mjs     # writes storyboard-{landscape,vertical}.json
mkdir -p build/by-morning && cp examples/by-morning/storyboard-landscape.json build/by-morning/storyboard.json
node engine/cli.mjs draft build/by-morning
```
