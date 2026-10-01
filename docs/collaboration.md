# One shot or guided: where a human matters

A model can make a whole ClearFrame film alone, and a person can steer every frame. Neither extreme is right. This page says where human judgement changes the outcome most, so that a one-shot film is safe and a guided film never wastes the person's time.

`clearframe checkpoints DIR` shows where a project stands at each point. Use `--mode one-shot` or the default `guided`.

## The seven checkpoints

| #   | Checkpoint         | What the person decides                                         | Why a human                                                                     | Cost of getting it wrong                            |
| --- | ------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | **Intent**         | Who it is for, and what they should understand or do afterwards | Only the person knows the purpose; everything downstream serves it              | A polished film about the wrong thing               |
| 2   | **Truth**          | Which claims, and whether the figures and sources are right     | Models can misread a report or invent a plausible number                        | A confident falsehood with a source line under it   |
| 3   | **Story and look** | The spine (question, turn, payoff) and the treatment or genre   | Taste and brand: several good answers exist, and only one is theirs             | A good film in the wrong voice                      |
| 4   | **Narration**      | The words, read aloud before the voice is recorded              | Words are the cheapest thing to change before recording and the costliest after | Paid takes redone; a line that says the wrong thing |
| 5   | **Spend**          | Paid generation: voice, images, music, footage                  | Money, and the person's budget                                                  | Surprise costs                                      |
| 6   | **Picture**        | The contact sheet: is this the film they imagined?              | Taste, and the person's eye for their brand and audience                        | Rendering and re-rendering a film nobody wanted     |
| 7   | **Final**          | Watch it: ship it?                                              | It goes out under their name                                                    | Publishing a mistake                                |

**What never needs a human:** timing and cues, layout and composition, camera moves, sound placement, fixing what `check` and `critique` report, render settings, and drafts. The tools and the model handle these well, and asking about them wastes the person's attention.

## Guided

1. **Stop and ask at checkpoints 1–3 together, in one message.** Propose the intent, the claims you found, the spine and two or three looks (with a `muse` seed if they want something unexpected). Let them pick.
2. **Ask at 4:** paste the narration. Ask for edits before any paid voice.
3. **Ask at 5,** with the `plan` total.
4. **Ask at 6,** with the sheet image. Collect notes, then fix and re-sheet.
5. **Ask at 7,** with the final.

A guided film usually needs four short exchanges. Make each one easy to answer: offer choices, show the evidence, and never ask about something on the "never needs a human" list.

## One shot

Decide every checkpoint yourself, and **log each decision** under `## Decisions` in DIRECTION.md: what you chose, the alternatives, and why. For example, "Intent: city staff who haven't read the report; takeaway: target the hottest blocks first", or "Look: cinematic, because the report is about a place at night".

Hard rules still apply in one-shot mode:

- **Truth:** use only claims from the source material, with their sources. If a claim can't be sourced, leave it out. Never fill a gap with a sample figure.
- **Spend:** only within a budget the person gave. Without one, deliver the free draft (local voice and music) and say what a final would cost.
- **Review yourself before delivering:** `critique`, the sheet, a fresh reviewer on the draft, and `review` on cuts.

Deliver with the decision log, the open questions a person should check (claims, names, the final watch), and what is still estimated.

## Choosing a mode

| Use one shot                               | Use guided                                  |
| ------------------------------------------ | ------------------------------------------- |
| A first draft to react to                  | Anything published under a name or a brand  |
| A series in an established format and look | A new format, look or audience              |
| Internal or exploratory films              | Films with figures someone will rely on     |
| A clear brief and good source material     | A vague brief, or source material with gaps |

A common pattern is to make a one-shot draft, then run one guided pass on checkpoints 2 (truth), 6 (picture) and 7 (final).
