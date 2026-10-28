# Workplace 401(k): free money, every paycheck

A 45-second benefits film made only from the workplace kit (`skills/clearframe-workplace`): no hand-drawn canvas, no imagery, no paid generation. It is the bar the kit aims at when a model fills its blanks from a plan summary: every fact gets the picture that shows it, each moment lands on the word that names it, and the film ends on the step done in the app. Use it as the model for any benefit with a match, a vesting schedule and a portal step. Everything in it (Alder Street, the plan, the figures) is fictional, from `bench/enterprise/401k-match.md`.

| Beat | Narration (moments in bold) | Picture | Piece |
|---|---|---|---|
| `raise` | "Most new hires leave free money on the table. Right now you **save** three percent, and Alder Street **adds** three. Raise it to **five**, and they add **four**. That is **nine** percent of your pay, **every** paycheck." | Alder Street's four coins on offer wait as faint outlines on its plate from the first frame (the free money on the table); today's coins drop in (3 of yours on "save", 3 of theirs on "adds", filling three outlines); two of yours drop in, and the last outline, the money a 3% saver leaves, fills on "four"; the stacks merge into 9%; three more stacks line up for every paycheck | `match` with `fromYou`/`fromMatch` (what if) and `again`, plus four outline coins as canvas `elements` with `exitSay` |
| `dollars` (arriving with a `push`) | "On a sixty thousand dollar salary, the match goes from **eighteen** hundred dollars a year to **twenty-four** hundred. **Six** hundred more, for two points." | Two bars grow on their words; a note marks +$600 | canvas `chart` bars with `say` on each value and a `note` |
| `keep` | "A third of the match is yours after the **first** year, two thirds after the **second**, and **all** of it after the third." | A timeline whose locks open as the column grows to each share | `vesting` |
| `step` | "It takes two minutes. Open **Benefits**, then **Retirement**. Set your rate to **five** percent, and **save**. Free money, every paycheck after." | The portal: the cursor opens Benefits, picks Retirement, changes 3% to 5%, saves; the window leans in on the new value | `portal`, arriving with a `push` (the next step) |

`node examples/workplace-401k/build.mjs` writes `storyboard-landscape.json` and `storyboard-vertical.json` (pop captions on the tall frame). Copy one into a project directory as `storyboard.json` and run `pnpm cf draft DIR`.

## Checks and limits

- Drafted with the local OS voice and whisper.cpp word timings; no synthesis was paid for. `align --whisper` measures every word, so the final renders; `draft` and `qa` report the picture still under the voice for 0 s of 41 s, with about 3.5 s declared as reading holds (the app step).
- Figures come from the fictional plan summary and are named in each beat's source line; the salary is labelled as an example once.
- The film opens on its picture (the coins on offer), not on a card of words, and its cuts carry the film: the coins and the dollars chart move as one strip (a `push`, the next step of one idea), and the app arrives with a push. Going `into` the coin stack was tried and dropped: it overfilled the frame with a teal blur, then cut to the cream chart.
- On the tall frame the dollars chart has its own box, so the top value stays clear of the lead-in.
- Greyed B-roll behind the opening (`plate` with `treatment: "mono"`, see the skill) suits this film but needs footage; the example ships without it.
