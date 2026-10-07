# Fewer steps: faster without inventing a number

An 11-second study of speed shown as a mechanism. A person (the request) and a check (the result) are joined by an old winding route that stops at four waits. A straight new route draws across. Two tokens leave together at the same speed, one on each route, and the one on the new route arrives first only because its way is shorter. It was curated by hand to demonstrate the `shortcut` sketch; it is not agent output.

**What it feels like:** clear and a little satisfying, like watching a race whose result you can predict. The picture says *fewer steps*, so it never claims a speed-up it cannot show. Both tokens move at the same speed, measured along each route.

**Ideas it helps show:**

- a faster checkout or onboarding;
- fewer handoffs or approvals;
- a direct integration;
- "we cut out the waiting".

If you have a measured number, follow with a sourced `stat` or `delta` beat.

| Narration | Picture |
|---|---|
| "Checkout used to stop and wait four times." | The old route draws through four clocks, and the label reads "Four waits". |
| "The new path **skips** the waits." | A straight route draws across, labelled "Direct". |
| "Both **leave** together, at the same speed." | Two tokens leave the start together. |
| "The new one is there **first**." | The direct token reaches the end, and the finish lights. The other is still winding through its waits. |

The beat is one sketch with words:

```json
{ "block": "canvas", "props": {
  "sketch": "shortcut",
  "sketchText": { "OLD": "Four waits", "NEW": "Direct" },
  "sketchSay": { "SHORTCUT": "skips", "GO": "leave", "ARRIVE": "first" } } }
```

Cue `ARRIVE` on a word spoken after the direct token arrives, about 1.6 s after `GO` on a wide frame. It works on light and dark palettes, and on a tall frame the routes run top to bottom.

## Make it

```sh
node examples/fewer-steps/build.mjs     # writes storyboard-{landscape,vertical}.json
mkdir -p build/steps && cp examples/fewer-steps/storyboard-vertical.json build/steps/storyboard.json
node engine/cli.mjs draft build/steps    # free local draft voice
```

Each shape is 352 frames, about 3 s to render on this Mac, and `check` reports 0 errors and 0 warnings.

Find it with `node engine/cli.mjs find "our checkout is faster now"`.
