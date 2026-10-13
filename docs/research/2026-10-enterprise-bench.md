# The enterprise bench: weaker models, workplace films (October 2026)

A night of brute-force iteration on the films ClearFrame is mostly asked for: benefits, retirement, policy, training and client updates at a company or financial firm, plus a podcast clip. Haiku 4.5 and Sonnet 5.5 agents made films from mock source documents (`bench/enterprise/`) using only the repository's docs and skills, logged their trajectories, and a fresh Sonnet reviewer judged every film from its frames (`bench/enterprise/JUDGE.md`). Each round's failures became harness changes before the next round. Everything was local: the OS voice, whisper.cpp word timings, no paid generation (except one $0.80 B-roll test).

## Method

- **Briefs.** Twelve fictional briefs with a source document, an audience, an action and a length (`bench/enterprise/*.md`), plus a two-voice mock podcast built with `say` (`podcast/make-episode.mjs`).
- **Agents.** One agent per film, told only "make this film, one-shot, free and local, don't edit the repo, log what happened" (the round prompts are in the bench README's spirit). No mention of the features being tested: the routing in AGENTS.md and the skills had to find them.
- **Measures.** The fresh judge's seven-point rubric (not a slideshow, clear, readable, craft, delight, fit, distinct; 1–10 each), `qa`'s motion on the encoded film (seconds the picture sits still under the voice), `critique`'s cinema score, and the agents' own logs (`TRAJECTORY.md`, `runlog`). `scripts/bench-enterprise.mjs` tabulates a round.

## Results

Judge means (1–10):

| Film | Model | Round 1 | Round 2 | Round 3 | Round 4 | Round 5 | Round 6 | Round 7 | Round 8 |
|---|---|---|---|---|---|---|---|---|---|
| 401(k) match | Haiku | 3.1 | 6.6 | | | | | | |
| Phishing training | Haiku | 5.0 | 5.9 | | | | | | |
| HSA or FSA | Haiku | | 3.7 (all kinetic words) | 6.9 | | | | | |
| Expense policy | Haiku | | | 6.1 | | | | | |
| MFA rollout | Haiku | | | | 5.3 | | | | |
| Parental leave | Haiku | | | | 6.1 | | | | |
| Fraud alert (vertical) | Haiku | | | | 5.7 | | | | |
| Open enrollment | Sonnet / Haiku | 6.4 (Sonnet) | | | | 6.1 (Haiku) | | | |
| Client market update | Sonnet / Haiku | | 6.9 (Sonnet) | | | 5.6 (Haiku) | | | |
| Mortgage rate lock | Sonnet | | | | 6.7 | | | | |
| Podcast clip (vertical) | Sonnet / Haiku | 7.7 (Sonnet) | | 7.4 (Sonnet) | | 5.7 (Haiku) | | 5.3 (Haiku) | 4.9 (Haiku) |
| Share purchase plan | Haiku | | | | | | 4.7 | 5.4 | 3.7 |
| First week (vertical) | Haiku | | | | | | 5.4 | 2.7 | 5.3 (Haiku), 6.4 (Sonnet) |
| Client data rule | Haiku | | | | | | 6.3 | 4.6 | 5.7 |
| Reference: the kit used by hand (`examples/workplace-401k`) | Opus | | 7.0 | | | | | | |

Haiku's mean rose from 4.1 to 5.4 to 6.5 on the briefs the kit was tuned on, then sat at 5.5–5.8 on new briefs (rounds 4–6), fell to 4.5 in round 7 and came back to 4.9 in round 8, where Sonnet made the same first-week brief at 6.4. Sonnet stayed around 7. The reference film shows the ceiling of the kit as it stands: clear (9) but not yet distinctive (5). Rounds 4 and 5 were the test of generalisation, and they found the next layer of problems: not the pictures themselves, but how agents fill them in, when they stop, and what they invent.

## What the trajectories showed, and what changed

1. **Weaker models fall back to a sentence per card.** Haiku read "business: locked camera, reading holds" as permission for title → statement → bars → stat → end card, then explained every critique warning away as "clarity over cinema". It discarded the playbook scaffold because its drawings were about another topic (traffic ripples) and adapting them was harder than writing statements.
   → `clearframe-workplace`: one short skill instead of twenty, a `workplace` treatment, four playbooks whose every beat is a fill-in-the-blank picture, and a table from each kind of fact to the sketch that shows it (`match`, `vesting`, `deadline`, `expire`, `portal`, `inspect`, `choose`, `split`). Sketches marked `keep` stay one short reference in the storyboard (`sketch`, `sketchText`, `sketchSay`, `sketchParams`) instead of hundreds of copied shapes.
2. **The cinema score measured structure, and was gamed.** A film converted from blocks to drawn worlds went from 12 to 100 with no visible change; it sat still for 31 of its 60 seconds. Agents only saw the score.
   → `draft` now runs `qa` and ends with a motion verdict (seconds still under the voice, the stillest beats, the fix), `qa` counts a declared `pace: "hold"` as a reading hold, and the held test looks at small regions too (a coin dropping or a value typed was invisible to the frame average). The verdict also reports the share of the film that is type on its own: an all-kinetic film passed the old test at 7% still.
3. **Numbers broke sketches and alignment.** Haiku passed dollar amounts to a sketch that counts coins, got "must be 1–12", and abandoned sketches for kinetic text. Most beats of a market film were "estimated" because "60%" was heard as "sixty percent".
   → `sketchParams` with ranges, choices and a `hint` that explains the units in the refusal; number-aware alignment; take words that always fit their slice; chart values that land on their own words (`say`), and a number that steps through several values as each is spoken.
4. **Queues looked like hangs.** Agents killed voice takes and renders that were waiting for the heavy-job lock or for Python Whisper (up to 25 minutes under contention).
   → whisper.cpp with a local model (a 43 s take measured with 3 s of CPU instead of 229 s), heartbeat messages while queued, renders that take turns on the GPU and keep the renderer's error output, and `ingest --audio` that measures words itself.
5. **Integrity rules turned into on-screen disclaimers** ("said on air; not research", "bars drawn to that rate").
   → Attribution in the film's own words, one plain label for an example, and a lone digit no longer counted as a figure.
6. **Everything looked the same.** In rounds 2–3 every film used the treatment's default palette and type, and the same coins, vest bars and portal mock. The judge scored seven of eight films 5/10 for "distinct".
   → Treatment look variants (six for `workplace`: clean, notebook, brief, meadow, poster, daylight), picked per project; screens stay crisp in drawn and printed looks; cast objects for workplace films (`paycheck`, `calendar`, `jar`, `house`, `badge`, `umbrella`, `receipt`) and a skill step that asks for one object of the film's own.
7. **Podcast text was too fast.** Pop captions changed every three words (about once a second).
   → Pop captions hold five or six words for up to 2.6 s; `critique` warns when kinetic type changes faster than every 0.9 s across a passage; docs/speech.md says when words should be the picture and when captions should carry them under a drawing. The round-3 podcast clip gave a picture to every line and sat still for 3% of 97 s.

Also from the research tracker (issue #9): the wrapped-typewriter re-layout (typing now happens inside the finished layout), the product-UI recipe (`portal`: action, response, enlarged result), the parent–child data split (`split`), the counterfactual beat (`match` with `fromYou`/`fromMatch`: today's coins, then only the change), and fframes as the runtime (merged: parallel GOP-aligned encoding, 52–60 dB parity, about a third faster on encode-bound films; `docs/fframes-return.md`).

8. **Every film ended the same way** (round 4: four of four; round 5: three of three): the step in the `portal` mock-up, then a row of cast icons. Every workplace playbook ended portal + cast, and agents keep the scaffold's ending.
   → Playbook `endings`: alternative closing beats picked per project like the treatment's looks (`--ending NAME` chooses), recorded in DIRECTION.md. The workplace playbooks gained bookends (the opening picture returning changed), a phone step, a calendar close and a what-it-adds-up-to close.
9. **Sketches ran backwards.** `sketch NAME` listed moments in the order the sketch's source draws them (match: TOTAL, YOU, MATCH; expire: YEAREND before FILL). Agents filled them with narration words in that order; the coins left before they arrived, `check` refused "an element exits before it enters", and two of three round-5 films replaced the sketch with plain bars. Others left "STEP4" on screen after adding a step, or put a moment in `sketchText`.
   → Moments listed in time order with a line saying so; `critique` warns when sketchSay words are said out of order, when a placeholder word would show, and when a moment sits among the words; an exit word before a seconds-timed entrance waits for it.
10. **Agents stopped at "narrated slides".** A Haiku agent read 55% still, called it "a polish issue for later" and handed over five minutes into an hour. The free studio model saw "complete" on its render and stopped at 58%.
    → The verdict quotes what the voice says over each still stretch and names the fix that fits the beat (a later sketch moment, a `say` on each chart value, a cast move, a picture for type, a chart for a number card), ends "not ready to hand over" above 40%, and the studio's job tool now reports it after a draft.
11. **Invented figures and dropped facts.** A sketch drew "−$2,400" from an invented `each: 800` (the page says the FSA resets to $0); films ran 30–41 s against 75–90 s briefs and lost the dates and the new benefit the brief named.
    → `critique` checks every typed figure (words, chart and stat values, sketch params) against the source document in the project, and the workplace path starts from it (`start --document … --length …`); `draft` says when a film falls well short of the length asked for.
12. **A podcast played as a music bed.** Scaffolding `podcast-clip` with `new` gave sample narration; the agent put the real episode under it as `music`, so no word on screen matched the voice.
    → `new` refuses a recording playbook and prints the `ingest --audio` line (`--sample` to read the sample).

13. **What reviewers called render glitches were scenes starting empty.** A sketch's card rising from nothing after every hard cut left blank frames; a bar chart with one value filled its box with a block of colour; a number cued to a late word left its beat empty.
    → A cut lands on the drawing's ground (cards and panels at the start are there on the first frame); one bar draws as a number; a single number lands on its word with its label already there.
14. **Agents read the good number.** "Still 0 s (0%)" was quoted as success off a verdict that went on to say the film was 71% type, 18 s short and not ready. The verdict now leads with READY or NOT READY, repeats it as `draft`'s last line, names each words-only beat with a picture for it, and the workplace skill says the film is done only at READY.

15. **A stricter verdict taught agents to cut.** In round 7 the two agents that iterated reached READY by shrinking their films (a 60-second brief to 27 s, a 45–60 s brief to 14 s), because the picture they had ran out before the narration; a third built an onboarding film from `product-walkthrough`, six title and statement cards at 96% still (2.7). Round 7's mean fell to 4.5.
    → Under 60% of the length asked for is NOT READY; a drawing whose moments have landed while the voice starts another sentence gets "give that sentence a beat and a picture of its own" instead of "land a later moment"; the workplace treatment names its five playbooks and `new`/`start` say when another is chosen; `start --document` writes a "Pictures for this document" map from the source's own lines.

16. **Round 8: the verdict worked when it named a concrete edit.** The client-data agent took its film from 41% to 28% still by splitting its hook and cueing its chart values, as the verdict said. The share-plan agent read "a chart with a `say` on each value" as "a custom canvas bars chart" and stopped at 100% type; the podcast agent never imported the episode and handed over captions over sound effects; another left "LINE2" on screen past a `critique` warning.
    → The verdict pastes a ready chart read from the line's own figures, calls unvoiced narration and on-screen placeholders NOT READY, and AGENTS.md routes recordings to `ingest` in their own line. Workplace playbooks cut instead of wiping (three reviewers called a frame caught mid-wipe a glitch).

## The studio's free model

The in-page agent (OpenCode, free model) made the open-enrollment film from the same brief: a complete 59-second cut with every fact and the right dates, using `choose`, `deadline` and `portal`, but `kpis`, `delta`, `stat` and `endcard` cards for the figures; 58% still under the voice. It first stalled for twelve minutes on a shell permission nobody was watching (reading `storyboard.json`; declining it pointed it back to the ClearFrame tools, and it carried on). It had no motion verdict to read. With the verdict added to its job tool and one note from a person ("it feels like a slideshow"), it cued the bars to their figures, moved its cast, counted the sessions and built the close word by word: 57% still to 16% in one pass, with no paid model. Its revised opening still put a few small coins in a corner of the frame, which is why `qa` now measures how much of the frame a picture fills.

## Greyed B-roll

The one paid test: two Veo 3.1 Lite clips (an office morning, a city street; $0.80). A full-bleed `plate` with `treatment: "mono"`, a light scrim and no drift under a kinetic hook reads as a premium corporate film. Under a detailed sketch it competes with the labels. The workplace skill now says where it belongs (hooks, closes, people moments) and that generic clips are reusable across films.

## Open problems

- **Haiku plateau.** New briefs score about 5.8 with Haiku and 6.7–7 with Sonnet. The remaining gap is persistence (fixing what the verdict names) and judgement (which fact deserves which picture), not missing pictures.
- **Sketch tails.** A sketch's last moment often comes well before its narration ends, so the beat sits. `match` gained `again` (more stacks for "every paycheck"); the other sketches need closing moments or idle life.
- **Distinctiveness beyond looks.** Variants change the face; a film's central metaphor still mostly comes from the kit. The best films (the podcast's mug, the jar that drops to $660) invented one object and returned to it.
- **Critique and the verdict disagree** in ways agents find confusing; the verdict is the one to trust.
