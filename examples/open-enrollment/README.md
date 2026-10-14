# Open enrollment: the one thing that does not carry over

A 40-second open-enrollment film made only from library pieces, and the worked example for `carryover` (what rolls into next year and what does not) and its `bookend`. It also goes `into` the `$0` to arrive at the guide's own sentence, marks a wrapped phrase with a `box`, and does the step in an `app` that changes pages with a `pointer`. Captions are on, as on every narrated film. Everything (Northwind, the plan, the dates) is fictional.

| Beat | Narration (moments in bold) | Picture | Piece |
|---|---|---|---|
| `board` | "Do nothing this open enrollment, and your **medical**, **dental** and **vision** carry over into next year. Your health **FSA** does not. It goes back to **zero**." | Four elections under "This year", next year's slots dashed; each card crosses on its word and is ticked; the FSA card hits the line, which turns red, and comes back; $0 lands in its empty slot | `carryover` (`stays: [4]`) |
| `clause` | "The benefits guide says it **plainly**. Your FSA election does not **carry** over. You must make it **again**, every year." | The camera goes through the $0 into the guide, which scrolls to "If you do nothing"; "does not carry over" is highlighted and the sentence that follows is boxed, line by line | `into: "carryover-reset-4"`, `document` with `scroll` and `marks` |
| `when` | "Enrollment opens on November **third**, and closes on the **nineteenth**." | November 2027; the window sweeps from the 3rd and the 19th is circled | `deadline` |
| `step` | "So in Northwind Hub, open **Benefits**, then **Enroll**. Tap Health **FSA**, choose your **amount**, and press **Save**." | The pointer presses Benefits, then Enroll for 2028, each screen sliding in on its word; the elections screen says what the board said (three "Carries over", the FSA "Not elected"); the pointer taps it, the amount types in and Save becomes "Saved for 2028" | `app` with `pages` and row badges, `pointer` |
| `close` | "Make your FSA **election** by the nineteenth, and all four come with you." | The opening board where it was left; the $0 clears and the FSA card crosses and is ticked with the others | `carryover` with `bookend: true` |

`node examples/open-enrollment/build.mjs` writes `storyboard-landscape.json` and `storyboard-vertical.json` from one storyboard. Copy one into a project directory as `storyboard.json` and run `node engine/cli.mjs draft DIR`.

## What to copy

- **Open and close on one board.** The close is the hook's board with `bookend: true` and the same words: it opens where the hook left off, and the one card that stayed behind crosses on the word that fixes it. The film ends on the picture it promised, not on a slogan.
- **Go into the thing that changed.** The reset chip carries an id, so the next beat goes through the $0 and arrives at the sentence that put it there. The rule is seen, then read in the plan's own words.
- **Mark the sentence, not the page.** The guide scrolls to the section on its word and the rest of the page steps back; a `box` round a phrase that wraps draws one box per line.
- **Do the step.** The app's pages change on their words and the pointer presses each one by id, so "Benefits, then Enroll" is two screens, not a list. Row badges (`{label, badge, tone}`) let the app's own screen repeat the rule.

## Checks and limits

- Drafted with the local OS voice; no synthesis was paid for. `check` passes in both frames, with no type under the captions.
- The rule, dates and path come from the fictional guide named in the source line; the FSA amount typed into the app is an example.
