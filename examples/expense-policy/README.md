# Expense policy: 30 days, itemised, in the app

A 35-second policy-change film made only from library pieces, and the worked example for two of them: `share` (one tile each, for a figure that is a share of claims) and `was-now` (a rule's number that changed). It also uses the `into` transition (through one tile into the next scene), a `receipt` with a `stamp` mark, an `app` with a `pointer`, and a receipt carried across a cut by its id. Captions are on, as on every narrated film. Everything (Fairhaven, the policy, the figures) is fictional.

| Beat | Narration (moments in bold) | Picture | Piece |
|---|---|---|---|
| `hook` | "Last year, we sent back **thirty-one** percent of expense claims. **Almost** always, for the receipt." | A hundred claims, one tile each; 31 fill in reading order as 31% counts up; the rest step back | `share` (`count: 31, tone: "negative"`) |
| `slip` | "A card slip is **not** a receipt. Over twenty-five dollars, we need the **itemised** one: what you **bought**, and what it **cost**." | The camera goes into the 31st returned claim and comes out at the card slip, which is stamped NOT A RECEIPT; the itemised receipt rises beside it, its items highlighted and its total boxed | `into: "share-31"`, `receipt` (`slip: true`, a `stamp` mark), `receipt` with `marks` |
| `app` | "So use the app. **Photograph** the receipt, check the **amount**, and press **Submit**." | The same receipt slides aside as the app appears; its photo lands in the upload slot, the amount and date type in, Submit becomes Sent | `receipt` carried by id, `app`, `pointer` |
| `window` | "And from January first, you have **thirty** days to do it, not sixty. After that, a **director** has to approve it." | Sixty days drawn to scale; the second thirty fall away and stay as an outline, 60 days is struck, 30 days lands; the note sits in the span that was cut | `was-now` (`was: 60, now: 30, note: true`) |
| `close` | "**Thirty** days, an itemised **receipt**, the app. Then **none** of these come back." | The opening's 31 tiles again, then turned to the good colour as last year's figure steps back | `share` with `fix: true` |

`node examples/expense-policy/build.mjs` writes `storyboard-landscape.json` and `storyboard-vertical.json` from one storyboard. Copy one into a project directory as `storyboard.json` and run `pnpm cf draft DIR`.

## What to copy

- **Open on the figure as a picture.** A share is one tile each, so "nearly a third" reads before the number does; ending on the same tiles turned to the good colour closes the loop without a slogan. `fix` shows what the film asks for, not a result, and the narration says so ("Then none of these come back").
- **Show the paper.** The slip and the receipt are drawn from their lines, so the total is right by construction; the stamp sits over the line it rules on.
- **Go into the thing the story is about.** The slip beat sets `into: "share-31"`: the camera goes through one of the 31 claims that came back and arrives at the paper that sent it back. Every other cut is a cut.
- **Carry the object across the cut.** The receipt keeps its id (`lunch`) from the slip beat to the app beat, drawn at the same size and given a `scale`, so the cut is one move.
- **Draw the change to scale.** `was-now` keeps the part that no longer counts on screen as an outline, so "not sixty" is seen, not only said.

## Checks and limits

- Drafted with the local OS voice; no synthesis was paid for. `check` passes in both frames, with no type under the captions.
- The figures come from the fictional policy and claims review named in each beat's source line; the receipt is labelled as an example.
