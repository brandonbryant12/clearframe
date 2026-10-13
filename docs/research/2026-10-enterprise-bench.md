# The enterprise bench: weaker models, workplace films (October 2026)

A night of brute-force iteration on the films ClearFrame is mostly asked for: benefits, retirement, policy, training and client updates at a company or financial firm, plus a podcast clip. Haiku 4.5 and Sonnet 5.5 agents made films from mock source documents (`bench/enterprise/`) using only the repository's docs and skills, logged their trajectories, and a fresh Sonnet reviewer judged every film from its frames (`bench/enterprise/JUDGE.md`). Each round's failures became harness changes before the next round. Everything was local: the OS voice, whisper.cpp word timings, no paid generation (except one $0.80 B-roll test).

## Method

- **Briefs.** Twelve fictional briefs with a source document, an audience, an action and a length (`bench/enterprise/*.md`), plus a two-voice mock podcast built with `say` (`podcast/make-episode.mjs`).
- **Agents.** One agent per film, told only "make this film, one-shot, free and local, don't edit the repo, log what happened" (the round prompts are in the bench README's spirit). No mention of the features being tested: the routing in AGENTS.md and the skills had to find them.
- **Measures.** The fresh judge's seven-point rubric (not a slideshow, clear, readable, craft, delight, fit, distinct; 1–10 each), `qa`'s motion on the encoded film (seconds the picture sits still under the voice), `critique`'s cinema score, and the agents' own logs (`TRAJECTORY.md`, `runlog`). `scripts/bench-enterprise.mjs` tabulates a round.

## Results

Judge means (1–10):

| Film | Model | Round 1 | Round 2 | Round 3 | Round 4 | Round 5 | Round 6 | Round 7 | Round 8 | Round 9 | Round 10 | Round 11 | Round 12 | Round 13 | Round 14 | Round 15 | Round 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 401(k) match | Haiku | 3.1 | 6.6 | | | | | | | | | | | | | | |
| Phishing training | Haiku | 5.0 | 5.9 | | | | | | | | | | | 5.1 | 5.6 | 5.7 | 5.4 |
| HSA or FSA | Haiku | | 3.7 (all kinetic words) | 6.9 | | | | | | | | | | | | | |
| Expense policy | Haiku | | | 6.1 | | | | | | | | | | | | | |
| MFA rollout | Haiku | | | | 5.3 | | | | | | | | | | | | 4.7 |
| Parental leave | Haiku | | | | 6.1 | | | | | | | | | | | | |
| Fraud alert (vertical) | Haiku | | | | 5.7 | | | | | | | | | | | | |
| Open enrollment | Sonnet / Haiku | 6.4 (Sonnet) | | | | 6.1 (Haiku) | | | | | 6.0 (Haiku) | | 5.9 (Haiku) | | 5.6 (Haiku) | 5.6 (Haiku) | |
| Client market update | Sonnet / Haiku | | 6.9 (Sonnet) | | | 5.6 (Haiku) | | | | | | | | | | | |
| Mortgage rate lock | Sonnet | | | | 6.7 | | | | | | | | | | | | |
| Podcast clip (vertical) | Sonnet / Haiku | 7.7 (Sonnet) | | 7.4 (Sonnet) | | 5.7 (Haiku) | | 5.3 (Haiku) | 4.9 (Haiku) | 6.1, 4.7 (Haiku ×2) | 4.7, 4.1 (Haiku ×2) | 5.1, 3.9 (Haiku ×2) | 5.0, 3.9 (Haiku); 7.4 (Sonnet) | | | | |
| Share purchase plan | Haiku / Sonnet | | | | | | 4.7 | 5.4 | 3.7 | 4.9, 4.3 | | 5.6, 5.1 | 5.0 (Haiku); 6.6 (Sonnet) | | | | |
| First week (vertical) | Haiku | | | | | | 5.4 | 2.7 | 5.3 (Haiku), 6.4 (Sonnet) | 6.1 | 4.6 | 4.9 | 5.0 | | | | |
| Client data rule | Haiku | | | | | | 6.3 | 4.6 | 5.7 | 5.6 | 4.1 | 5.1 | 3.7 | 5.4, 4.4 (Haiku ×2) | 4.7 (Haiku); 6.0 (Sonnet) | 4.4 | 4.6 |
| Reference: the kit used by hand (`examples/workplace-401k`) | Opus | | 7.0 | | | | | | | | | | | | | | |

Haiku's mean rose from 4.1 to 5.4 to 6.5 on the briefs the kit was tuned on, then sat at 5.5–5.8 on new briefs (rounds 4–6), fell to 4.5 in round 7 and came back to 4.9 in round 8 (where Sonnet made the same first-week brief at 6.4) and 5.3 in round 9, where the first Haiku podcast with pictures scored 6.1. Sonnet stayed around 7. The reference film shows the ceiling of the kit as it stands: clear (9) but not yet distinctive (5). Rounds 4 and 5 were the test of generalisation, and they found the next layer of problems: not the pictures themselves, but how agents fill them in, when they stop, and what they invent.

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

17. **Round 9: a worked example moved the podcast.** With `examples/podcast-pictures` in the routing, one of two Haiku podcast agents copied its pattern (a jar through all 23 beats, its own `build.mjs` setting props by beat id) and scored 6.1, the best Haiku podcast of the night; the other read only `qa`'s summary line, never saw NOT READY and handed over captions (4.7). The verdict's READY tracked the reviewer: the two films handed over at NOT READY scored lowest.
    → `qa` ends with the verdict too, a NOT READY `draft` exits with code 2, `qa` finds near-empty frames under the voice, and different drawings in a row no longer count as a slide run (agents had been breaking runs of sketches with kinetic type).

18. **Round 10: the same briefs, worse films (4.7).** Run to run, one Haiku agent copies the worked podcast and another types the transcript; the verdict was NOT READY on four of five and the agents handed them over anyway, three saying a picture would cost "45 more minutes". Open enrollment (6.0) was the exception: a jar draining to zero for the FSA reset. Round-to-round means of three to six Haiku films move by ±0.6 on noise alone; the steady signal is that films the verdict calls READY score higher.
    → Paste-ready casts in the verdict (months as calendar pages, money kept apart as jars), `cast.fresh`, icons that answer to common names, positions that must be numbers, an empty `sketchText` that removes its line, speakers that read as their roles, and a source line that is a file path flagged.

19. **Round 11: a picture for the hard idea moved the hardest brief.** With `lookback` the two share-plan films drew "the lower of two prices" (5.6 and 5.1, from 3.7–4.9), and the reviewer's best moment of the round was its price line with the lower price ringed and "You pay $34". The podcast agent that pasted the verdict's casts (calendar pages, jars) scored 5.1; the one that stayed with captions 3.9. Mean 5.0. Two "vertical" films came out 4:5 because agents read `portrait` as vertical.
    → `critique` says what `portrait` is; a sketch's name used as a block says how to draw it; a vertical film's speaker chip is readable on a phone.

## The studio's free model

The in-page agent (OpenCode, free model) made the open-enrollment film from the same brief: a complete 59-second cut with every fact and the right dates, using `choose`, `deadline` and `portal`, but `kpis`, `delta`, `stat` and `endcard` cards for the figures; 58% still under the voice. It first stalled for twelve minutes on a shell permission nobody was watching (reading `storyboard.json`; declining it pointed it back to the ClearFrame tools, and it carried on). It had no motion verdict to read. With the verdict added to its job tool and one note from a person ("it feels like a slideshow"), it cued the bars to their figures, moved its cast, counted the sessions and built the close word by word: 57% still to 16% in one pass, with no paid model. Its revised opening still put a few small coins in a corner of the frame, which is why `qa` now measures how much of the frame a picture fills.

## Greyed B-roll

The one paid test: two Veo 3.1 Lite clips (an office morning, a city street; $0.80). A full-bleed `plate` with `treatment: "mono"`, a light scrim and no drift under a kinetic hook reads as a premium corporate film. Under a detailed sketch it competes with the labels. The workplace skill now says where it belongs (hooks, closes, people moments) and that generic clips are reusable across films.

20. **Round 12, with every fix: Haiku 4.75, Sonnet 7.0.** Sonnet's podcast (7.4) drew a six-cell "months of cash" battery that turns into rent, groceries, insurance and the car while a counter runs in step with the voice, the reviewer's best moment of the night; its share plan (6.6) used `lookback`. Haiku's share plan, open enrollment and one podcast were READY and pictured (5.0–5.9); the client-data brief, whose central idea ("the same email, one different button") still had no picture, scored lowest (3.7).
    → A `compose` sketch for that picture; a file name as a source line ("import.mjs") makes the verdict NOT READY.
21. **Round 13: the new picture was found, then the agents stopped.** Both client-data films used `compose` unprompted (5.4 and 4.4, from 3.7), and the reviewer's best moment was Attach struck through as Share securely lit and the PDF became a link. All three Haiku agents handed over NOT READY films after ten to thirteen minutes of a 75-minute time box, two calling them "functionally complete" at about half the length asked. The phishing film had moved its action, response and close into canvas text elements, past the type-only checks; one film drew a link that expires as the `expire` jar. The free OS voice read "button:" as "button colon".
    → Type drawn on a canvas counts as type on its own and is offered a picture; a NOT READY verdict ends on one spelled-out edit; a chart missing a spoken figure gets the value to paste; a cast for mail sent to the wrong person; link expiry routes to `compose`; refused fields name their replacement (`font: "bold"`, `anchor`); the draft voice reads a colon as a pause.
22. **Round 14: Haiku 5.3, Sonnet 6.0, and the first Haiku agent that kept going.** The phishing agent worked sixteen minutes, followed the overlap note to `"fresh": true` and grew its film from 28 to 51 s (5.6); the two others stopped at 29 and 32 s of 50 and 75. Sonnet's client-data film (6.0) was READY with a padlock carried large from its opening under a new row of objects, labels colliding; a chart written with `rows` crashed `critique` for half an hour; an enrollment film made without a source document narrated a $3,000 the brief never states. The reviewer's best moment was again `compose`.
    → Cast objects standing on each other make the verdict NOT READY; a short film is quoted the source's facts it never states; the `rows` crash is fixed; figures with no source document to check are named; `inspect` presses Report on the email it marked (`report: true`), so phishing films' action is the same email.
23. **Round 15: two of three Haiku films READY, and one READY film the reviewer called a slideshow.** Phishing (5.7, eleven beats, 48 s) and client data were handed over READY, the first Haiku READY films since round 12; enrollment stopped at 34 s of 75 (5.6). The client-data film passed with three one-value `number` charts, a title and a list around its one `compose` beat (29 of 38 s), one of them a declared reading hold; the reviewer scored it 3 for slideshow and 4.4 overall. Two agents lost half an hour each to `critique` crashing with a bare TypeError on a shape it did not expect (`rows` for `values`, `emphasis` as one word).
    → A single figure on a card counts as type on its own (that film now reads NOT READY; films the reviewer scored 5 and up keep their verdicts); `critique` never ends in a bare TypeError.
24. **Round 16: none READY, and a new way to be short of pictures.** All three Haiku films reached or neared their length (phishing 60 s, MFA 48 s) by stretching narration over the same pictures: five beats of 10–14 s in phishing, whose closing "0" held for 12 s (5.4); MFA (4.7) left a caption alone on screen while the voice explained hardware keys, though its password coin gaining a "one tap" coin to make "2 = Protected" was the reviewer's best moment; client data stopped at 22 s (4.6). Phishing used `inspect`'s new Report step. The verdict named each long beat and its fix; the agents stopped anyway.
25. **Round 17 (not judged): from long beats to figure cards.** With `critique` warning about long beats, the MFA agent went the other way: six short beats of figure cards (66% type, 25 s of 50), NOT READY. The phishing agent put `inspect`'s Report step in a three-word beat of its own, where it waited behind the marks and ran past the cut; it dropped the beat and stopped at 16 s of 60. A sketch moment's earliest time should be stated where it is chosen: REPORT belongs in the beat that marks the signs.

## Opus rounds: what an excellent film needs (from round 18)

After round 17 the bench changed purpose: Opus agents make the films, to a stated bar ("a film a head of comms would be proud to send"), with about 90 minutes and the free local voice, and each writes LEARNINGS.md: its best moments and exactly how they are built, what it could not make, its weakest beat, and the kit changes that would have helped. The same reviewer scores them.

| Film (Opus) | Round 18 | Notes |
|---|---|---|
| Share purchase plan | 7.3 | The plan guide's example chart flips in place to the opposite case while "You pay $34" stays; a crowd of 44 colours in under "Managers only", struck out |
| Phishing training | 6.7 | "Spot the hook": the fake email lowered into the inbox on a fishing line and yanked out on "bit"; the hook stays through the film |
| Client market update | 6.1 | One world on a desk, one camera; only the letter's three points on a real-day axis; flat second half |

Mean 6.7, against 4.9 for Haiku in round 16 and the 7.0 of the kit used by hand. Every Opus film found its own idea (a hook, a flip, a desk) and drew it beat by beat in a generator script; each also ran its own fresh reviewer mid-way and acted on it.

What their learnings changed the same morning:
- **Bugs only a frame decode shows**: `enter: "none"` elements waited for the scene cue, so every cut opened on an empty frame.
- **Recipes the films built by hand**: `inspect` across two beats (`end`/`start: "marked"`) with don't click / don't delete / report (`choices`); a `drawdown` sketch for a market letter's fall and recovery; `sound` on an element or a key; `exitAfter`; a `trash` icon; `voice.pronounce` for names the free voice says wrong.
- **Advice that cost drafts**: the verdict now says when a change was too faint rather than absent (two agents lost three and four drafts to it); a palette whose accent is its warning red, trailer transitions (`iris`) in a calm film, playbook narration that asserts what a source rarely says, polyline coordinates read as figures, and a brief's header read as evidence are all named or fixed.
- **Truth**: the mock market letter's figures did not reconcile (60% flat equities and 35% bonds at +1.3% cannot make +2.1%); every earlier film had charted them. The brief is corrected, and the skills say to reconcile a letter's parts before charting them together and to land financial figures rather than count up to them.

## What fifteen rounds say

- **A missing picture is the first ceiling, and the cheapest to lift.** Every brief that gained a picture for its central idea moved: the share plan from 3.7–4.9 to 5.1–5.6 once `lookback` drew "the lower of two prices"; the podcast from all-caption films to pictured ones once a worked example and paste-ready casts existed. Agents of every size type the idea they cannot draw.
- **Weaker models act on concrete edits, not on scores or principles.** The verdict that moved films names the beat, quotes what is said over it and hands over the props to paste. Generic advice ("land a later moment", "give the ideas pictures") was read as optional or as a cost ("45 more minutes").
- **Every strict check teaches a shortcut until the next one closes it.** Agents declared every beat a hold, made every beat kinetic, cut films to half their length, reported the one good number off the verdict, and read `qa`'s first line instead of the verdict. Each became a rule: hold budgets, a words share, a length floor, READY first, exit code 2.
- **The verdict tracks the reviewer.** Films handed over at NOT READY scored lowest in every round from 8 on; the scores move ±0.6 round to round on three to six Haiku films, so the per-brief trend is the signal, not one round's mean.
- **Concrete, quoted edits buy persistence too.** In rounds 13 and 14 Haiku agents stopped after ten to sixteen minutes, usually at half the length asked, calling the film complete. After the verdict began to end on one spelled-out next edit and to quote the source's facts the film never states, two of three round-15 films reached READY (one by growing from three beats to eleven). A pass/fail line is only as good as what it counts: the one READY film the reviewer disliked was made of figure cards the verdict counted as pictures.
- **The ceiling is the model, not the kit, for persistence.** Sonnet made READY films on the hardest briefs (share plan, podcast) with its own pictures, in about half the time box; Haiku still hands over NOT READY films about half the time and leaves films short of the length asked.

## Open problems

- **Length by talking longer.** Once short films were told what they left out, agents met the length with longer narration over the same pictures (round 16: beats of 10–14 s). `critique` now warns before rendering when a beat runs over 9.5 s with two or more sentences on one picture; whether agents act on a warning (rather than a NOT READY) is untested.

- **Haiku persistence.** About half of Haiku's films are handed over at NOT READY even when the verdict lists each edit and pastes the props; Sonnet rarely does. A rough-cut-and-notes loop driven by the harness (render, read the verdict, apply the pasted edits, render again) may need to be a command rather than advice.
- **Length versus pictures.** Agents keep films short rather than find more pictures; the paste-ready beats cover months, money kept apart, figures and price comparisons, and nothing else yet.
- **Sketch tails.** A sketch's last moment often comes well before its narration ends, so the beat sits. `match` gained `again` (more stacks for "every paycheck"); the verdict now asks for the rest of the line in a beat of its own.
- **Distinctiveness beyond looks.** Variants change the face; a film's central metaphor still mostly comes from the kit. The best films (the podcast's mug, the jar that drops to $660) invented one object and returned to it.
- **Critique and the verdict disagree** in ways agents find confusing; the verdict is the one to trust.
