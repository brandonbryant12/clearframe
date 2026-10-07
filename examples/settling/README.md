# Settling: why a few reviews can mislead

A 38-second explanation built from two explanation primitives, `estimate` and `graph`: reviews arrive, their average settles by a rule you can see, and the rule's limit is drawn too. Use it as a model for any "how much can I trust a few of these" film: survey answers, sensor readings, test results, a poll's sampling error. It was curated by hand on the `explanation` treatment; it is an original composition, and every number on screen comes from a stated formula or a labelled, seeded simulation, never from review data.

| Beat | Narration | Picture | Piece, and why |
|---|---|---|---|
| `arrive` | "**Reviews** arrive one at a time, each one person's experience, a little off the truth. With a few, the average jumps. With more, it settles, and the band narrows. **Gather** them up: that is the spread." | Reviews start arriving on the first word, as dots around a dashed "What it is really like" line. The average draws through them inside a band of ±1 standard error that narrows. On "Gather" the same dots slide into the spread beside the plot. | `estimate` (`find --id mechanism:estimate`): noisy evidence settling, labelled Simulated. |
| `rule` | "That **narrowing** follows a simple rule: the average's wobble **shrinks** with the square root of the count. **Four** reviews wobble **half** as much as one; **sixteen**, half as much as four." | The curve 1/√n draws; a point rides it as the count sweeps up; marks at one, four (half) and sixteen pop on their words. | `graph` with `fn: {kind: power, a: 1, p: -0.5}`: the exact rule behind the band. The curve takes the band's colour, so the colour keeps one meaning: the wobble. |
| `bias` | "The **rule** assumes a fair sample. If mostly unhappy people write, the average settles just as calmly, in the **wrong** place; more reviews will not move it." | The first beat's plot again, the same scatter, with `bias: -1.2`. The average settles below the truth line, and on "wrong" the dots gather into a spread centred off the truth. | `estimate` with `bias`: more samples shrink chance, not bias. Without this beat the film would claim more than the rule does. |

## How it applies the grammar (`skills/clearframe-explain`)

- **Intuition before symbols.** The audience sees the average settle before they hear the rule, and the rule is drawn before it is named in numbers.
- **One change at a time.** Each beat moves one thing: the dots, then the point on the curve, then the same dots shifted.
- **Same place, same colour.** Both estimate beats use one plot, so the third reads as the first, changed. The accent always means the wobble.
- **Picture keeps pace.** The first review lands within a second of the first word, not after a sentence of setup.

## Checks and limits

- **`check`:** both shapes report 0 errors and 0 warnings (1137 frames, with the draft OS voice; about 14 s to render each on this Mac).
- **Review.** Motion sheets of each beat were made with the studio agent's `lookImage` handler at full size and at 360 px phone width, and read.
- **Critique: cinema 45/100.** It names deliberate choices: held frames after each change, a locked plot camera, and three drawings that cut rather than share a world. An explanation needs a steady frame to be read; the score is a heuristic for films, not a verdict here.
- **Phone.** On the tall frame the third graph mark is labelled "sixteen" rather than "sixteen: half again". A long label on the curve's flat stretch rises to clear it and drifts away from its mark.
- **Voice.** The storyboard asks for Charon, "warm, curious, measured", the treatment's provisional pick from published descriptions. The draft used the local OS voice; no synthesis was paid for.

`node examples/settling/build.mjs` writes `storyboard-landscape.json` and `storyboard-vertical.json`. Copy one into a project directory as `storyboard.json` and run `node engine/cli.mjs draft DIR`.
