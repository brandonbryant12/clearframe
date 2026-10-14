# Workplace 401(k): free money, every paycheck

A 45-second benefits film made only from the workplace kit (`skills/clearframe-workplace`): no hand-drawn canvas, no imagery, no paid generation. It is the bar the kit aims at when a model fills its blanks from a plan summary: every fact gets the picture that shows it, each moment lands on the word that names it, and the film ends on the step done in the app. Use it as the model for any benefit with a match, a vesting schedule and a portal step. Everything in it (Alder Street, the plan, the figures) is fictional, from `bench/enterprise/401k-match.md`.

| Beat | Narration (moments in bold) | Picture | Piece |
|---|---|---|---|
| `raise` | "Most new hires leave free money on the table. Right now you **save** three percent, and Alder Street **adds** three. Raise it to **five**, and they add **four**. That is **nine** percent of your pay, **every** paycheck." | Today's coins drop in (3 of yours on "save", 3 of theirs on "adds"); two of yours and one of theirs drop in; the stacks merge into 9%; three more stacks line up for every paycheck | `match` with `fromYou`/`fromMatch` (what if) and `again` |
| `dollars` (going `into` the company's coins) | "On a sixty thousand dollar salary, the match goes from **eighteen** hundred dollars a year to **twenty-four** hundred. **Six** hundred more, for two points." | Two bars grow on their words; a note marks +$600 | canvas `chart` bars with `say` on each value and a `note` |
| `keep` | "The match becomes yours over three years: a third after the **first**, two thirds after the **second**, and **all** of it after the third." | A timeline whose locks open as the column grows to each share | `vesting` |
| `step` | "It takes two minutes. Open **Benefits**, then **Retirement**. Set your rate to **five** percent, and **save**. Free money, every paycheck after." | The portal: the cursor opens Benefits, picks Retirement, changes 3% to 5%, saves; the window leans in on the new value | `portal`, arriving with a `push` (the next step) |

`node examples/workplace-401k/build.mjs` writes `storyboard-landscape.json` and `storyboard-vertical.json` (pop captions on the tall frame). Copy one into a project directory as `storyboard.json` and run `node engine/cli.mjs draft DIR`.

## Checks and limits

- Drafted with the local OS voice and whisper.cpp word timings; no synthesis was paid for. `draft` reports the picture still under the voice for about 30% of the film (the dollars bars and the vesting schedule hold to be read), under 20% outside them.
- Figures come from the fictional plan summary and are named in each beat's source line; the salary is labelled as an example once.
- The film opens on its picture (today's coins), not on a card of words, and its cuts carry the film: the camera goes into Alder Street's coins to arrive at their worth in dollars, and the app arrives with a push.
- Greyed B-roll behind the opening (`plate` with `treatment: "mono"`, see the skill) suits this film but needs footage; the example ships without it.
