# One shot or guided: where a human matters

A model can make a whole ClearFrame film alone, and a person can steer every frame. Neither extreme is right. This page says where human judgement changes the outcome most, so that a one-shot film is safe and a guided film never wastes the person's time.

The rule of thumb: **the person sees something they can react to before the expensive, hard-to-reverse work**, and every note they give has a durable address. `clearframe checkpoints DIR` shows where a project stands; use `--mode one-shot` or the default `guided`. Notes, revisions, previews and acceptance are described in `docs/editing.md`.

## The journey: Plan, Rough cut, Final

1. **Plan.** Material in (`ingest`), the story and look decided, and a **paper edit** (`paper DIR`): chapters, beats with timecodes, who speaks, the picture each beat is meant to get, the transcript. For an imported recording the narration *is* the recording: preserve it by default and propose cuts only when asked (`paper DIR --suggest-cuts` lists filler words, doubled words and long pauses as proposals). A short motion sample of the hardest passage under two looks helps the person choose.
2. **Rough cut.** The whole film, full length, on the real renderer and the recording's measured clock, made with existing blocks, basic motion and **declared placeholders** for pictures that are not drawn yet (`draft DIR --rough`). No per-beat bespoke drawing across the whole film yet, no paid media, no rounds of self-review. A few deliberate visual ideas are enough; most beats can stay the captions they were imported as. For a long film, publish a chapter as soon as it is ready (`preview DIR --chapter NAME`) while the rest develops, and track full-film coverage separately: `checkpoints DIR` lists each chapter's beats, how many have a picture beyond their captions, placeholders, unfinished elements and what the person has accepted.
3. **Notes and targeted edits.** The person watches (`review/index.html`) and says what feels wrong: "at 2:13 the diagram is confusing, keep the voice". Each note is recorded against the cut they watched (`note`), the edit is made, and `revise` returns a candidate with a before/after preview of just that stretch and a plain account of what else changed. The person accepts, refines or rejects.
4. **Fine cut.** Within the budget, add worlds, plates and drawn mechanisms; now run the self-review rounds (critique, a fresh reviewer, `qa`), then a full render.
5. **Final.** The person watches the whole film and accepts it (`accept DIR rNNN --checkpoint final`). Captions and `qa` close it.

More reviewable artifacts do not mean more mandatory questions: in one-shot mode the same artifacts are published and work continues.

## The checkpoints

| #   | Checkpoint         | What the person decides                                         | Why a human                                                                     | Cost of getting it wrong                            |
| --- | ------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | **Intent**         | Who it is for, and what they should understand or do afterwards | Only the person knows the purpose; everything downstream serves it              | A polished film about the wrong thing               |
| 2   | **Truth**          | Which claims, and whether the figures and sources are right     | Models can misread a report or invent a plausible number                        | A confident falsehood with a source line under it   |
| 3   | **Story and look** | The spine (question, turn, payoff) and the treatment or genre   | Taste and brand: several good answers exist, and only one is theirs             | A good film in the wrong voice                      |
| 4   | **Narration**      | The words, read aloud before the voice is recorded (for a recording: what, if anything, to cut) | Words are the cheapest thing to change before recording and the costliest after | Paid takes redone; a line that says the wrong thing |
| 5   | **Rough cut**      | Watching the whole film in motion: what feels wrong, and where  | Pacing, comprehension and what deserves a picture only show in motion           | Bespoke drawing for every beat, then structural notes |
| 6   | **Spend**          | Paid generation: voice, images, music, footage                  | Money, and the person's budget                                                  | Surprise costs                                      |
| 7   | **Picture**        | The fine-cut sheet: is this the film they imagined?             | Taste, and the person's eye for their brand and audience                        | Rendering and re-rendering a film nobody wanted     |
| 8   | **Final**          | Watch it: ship it?                                              | It goes out under their name                                                    | Publishing a mistake                                |

**Rough cut and Final close on a recorded decision, not on a file's age**: a person's `accept` (or, for the rough cut, notes the person gave on it) in guided work; a labelled agent `decide` in one-shot work. A current file proves the artifact exists; only an acceptance proves someone said yes, and `checkpoints` shows which is which.

**What never needs a human:** timing and cues, layout and composition, camera moves, sound placement, fixing what `check` and `critique` report, render settings, and drafts. The tools and the model handle these well, and asking about them wastes the person's attention.

## Guided

1. **Plan: ask at checkpoints 1–4 together, in one message.** Propose the intent, the claims, the spine and two or three looks (with a `muse` seed if they want something unexpected), with the paper edit. For a recording, say that the words stay as recorded unless they want cuts.
2. **Rough cut: ask at 5,** with the review page (`review/index.html`). Ask for notes with times and anything to keep; don't ask them to approve every beat.
3. **Ask at 6,** with the `plan` total, before paid generation.
4. **Ask at 7,** with the fine-cut sheet.
5. **Ask at 8,** with the final.

A guided film usually needs five short exchanges. Make each easy to answer: offer choices, show the evidence, never ask about something on the "never needs a human" list.

## Notes and edits in the conversation

- **Record the note against what they watched.** "At 2:13 …" means 2:13 of the cut they saw: `note DIR "…" --at 2:13 --rev rNNN --by NAME`. Pasted lines from the review page carry the revision and time already. Several notes in one message become several notes.
- **State your reading, then act.** "This section" is whatever the person's words and the stretch around the time point to, not automatically a chapter: say the range you'll change. Ask only when the readings would change materially different things.
- **Apply unambiguous, authorized edits without another permission round.** Make the edit, `revise DIR --note nNNN`, and send the compare page in one line: what changed, what else it touched, and the preview.
- **Ask only for** material ambiguity, a conflict with something they asked to keep, missing authority, or paid work beyond the budget they gave. "Keep the voice" means the recording stays the recording and is cut only when they ask (see `docs/editing.md`); say so when it matters.
- **Applied is not accepted.** A candidate is applied; it is accepted only when the person says so: `accept DIR rNNN --note nNNN --by NAME --said "their words"`. Never record acceptance because time passed, because they moved on, or because nobody objected. Rejection undoes the candidate where nothing changed since (`reject`).
- **Old notes on newer cuts.** Notes keep their place by content: `notes DIR` says whether each is current, moved, changed (may already be fixed), stale or orphaned. Bring stale and orphaned notes back to the person with the old moment; never apply them to whatever is at that timestamp now.

## One shot

Decide every checkpoint yourself, and **log each decision** under `## Decisions` in DIRECTION.md: what you chose, the alternatives, and why. For the rough cut and the final, also record it with `decide DIR rNNN --checkpoint rough|final --reason "…"`; it is displayed as an agent decision, never as acceptance. Publish the same artifacts as guided work (the paper edit, the rough cut's review page, the final) so a person can review any of them later and leave notes against that exact revision.

Hard rules still apply in one-shot mode:

- **Truth:** use only claims from the source material, with their sources. If a claim can't be sourced, leave it out. Never fill a gap with a sample figure.
- **Spend:** only within a budget the person gave. Without one, deliver the free draft (local voice and music) and say what a final would cost.
- **Review yourself after the rough cut, before delivering:** `critique`, the sheet, a fresh reviewer on the fine cut, `review` on cuts and `qa`.

Deliver with the decision log, the open questions a person should check (claims, names, the final watch), what is still estimated, and the review page.

## Choosing a mode

| Use one shot                               | Use guided                                  |
| ------------------------------------------ | ------------------------------------------- |
| A first draft to react to                  | Anything published under a name or a brand  |
| A series in an established format and look | A new format, look or audience              |
| Internal or exploratory films              | Films with figures someone will rely on     |
| A clear brief and good source material     | A vague brief, or source material with gaps |

A common pattern is a one-shot rough cut, then one guided pass on checkpoints 2 (truth), 5 (rough cut) and 8 (final).
