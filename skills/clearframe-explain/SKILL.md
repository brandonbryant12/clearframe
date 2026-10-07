---
name: clearframe-explain
description: 'Explain how or why something works, on any subject, with a picture that changes: how an input changes an output (graph), small amounts adding up (accumulate), noisy evidence settling into an estimate and its spread (estimate), where things flow (field), plus word-cued moves (`after`) and Manim-derived rate functions. Use for explainers, teaching and "why does…" films. For reporting sourced figures use clearframe-dataviz.'
---

# A picture that changes

The four primitives are canvas props (`docs/canvas.md`, "Explanation primitives"). `find "how an input changes an output"` and `find --id mechanism:estimate` print each one's uses outside maths, with an example beat. Start from the `explanation` treatment (`new DIR --treatment explanation`). `examples/settling` is a worked example: three beats, both shapes.

## The grammar

- **Intuition before symbols.** Show the picture change, then name it. A formula, if you show one at all, comes after the viewer has seen what it describes.
- **One idea changes at a time.** Everything else holds still. If two things move, the viewer has to choose which one to watch.
- **A colour means one thing for the whole film.** In `settling`, the accent is "the wobble": the band in the first beat and the curve in the second.
- **Keep the same object in the same place.** Two beats that show one plot should use one `box`, so the second reads as the first, changed. An `estimate` with `gather` and one without get different default boxes.
- **Hold after a change.** Give the viewer time to see what it did. Use `hold`, or `tail` for a breath after the line. The beat's lines ask for this; it is not dead air.
- **Cue each move to the word that names it.** Use `say` on `draw`, `sweep`, `show`, `gather`, `fill`, `stack`, `flow` and marks, and `after` for "just after that word". Land something meaningful in the first 1–3 s: cue the first move to the opening word, not to a word halfway through the line.

## Precise graph, or a metaphor?

- Use a **graph** when the shape is the point and you can state the formula, such as 1/√n, a saturating response or an M/M/1 queue. Say what the formula assumes in the narration. The picture shows a shape, not data, and carries no tick numbers.
- Use an **estimate** for chance and spread. It is always a simulation, labelled Simulated. More samples shrink random error, assuming independent, fairly drawn samples; they do not remove bias. Show `bias` when the scope matters (a poll's sampling error, but not who was asked; reviews, but not who writes them).
- A **field** is a qualitative picture. Its kinds are textbook shapes, not models fitted to a crowd, a market or traffic. Say so if the subject sounds measurable.
- **Never present invented numbers as evidence.** Real figures go in chart blocks, with a source. A primitive explains how something behaves; it does not report how much.

## Motion

- **Rate functions** adapted from Manim (MIT; `scene/native/THIRD_PARTY.md`) are available on any key: `thereAndBack` to point or nudge and return, `wiggle` to draw the eye, `runningStart` for anticipation, `overshoot` to settle, `smooth`, and `lingering`. Use them where the character fits, not everywhere.
- **Boards.** `place` makes any primitive a panel of a board, so the camera can hold close on each and then pull back to the whole (`docs/canvas.md`, "Worlds").

## Voice

The `explanation` treatment sets Charon with the style "warm, curious, measured". This is a provisional choice made from the voice's published description, not from listening. Iapetus and Schedar are the alternatives to audition. Direct the voice by generic traits, never by naming or imitating a real presenter.

## Review

Draft, then read a motion sheet at phone size: `qa DIR`, or `clearframe_look` with `phone` in the studio. Check that each move lands on its word, labels stay clear of dots and curves, and nothing important is too small at 360 px. `critique` scores explanation films low on held frames and a locked plot. Weigh each warning against the grammar above, and record deliberate holds; don't add motion to raise the score.
