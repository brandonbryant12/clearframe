# The enterprise bench: weaker models, workplace films (October 2026)

A night of brute-force iteration on the films ClearFrame is mostly asked for: benefits, retirement, policy, training and client updates at a company or financial firm, plus a podcast clip. Haiku 4.5 and Sonnet 5.5 agents made films from mock source documents (`bench/enterprise/`) using only the repository's docs and skills, logged their trajectories, and a fresh Sonnet reviewer judged every film from its frames (`bench/enterprise/JUDGE.md`). Each round's failures became harness changes before the next round. Everything was local: the OS voice, whisper.cpp word timings, no paid generation (except one $0.80 B-roll test).

## Method

- **Briefs.** Twelve fictional briefs with a source document, an audience, an action and a length (`bench/enterprise/*.md`), plus a two-voice mock podcast built with `say` (`podcast/make-episode.mjs`).
- **Agents.** One agent per film, told only "make this film, one-shot, free and local, don't edit the repo, log what happened" (the round prompts are in the bench README's spirit). No mention of the features being tested: the routing in AGENTS.md and the skills had to find them.
- **Measures.** The fresh judge's seven-point rubric (not a slideshow, clear, readable, craft, delight, fit, distinct; 1–10 each), `qa`'s motion on the encoded film (seconds the picture sits still under the voice), `critique`'s cinema score, and the agents' own logs (`TRAJECTORY.md`, `runlog`). `scripts/bench-enterprise.mjs` tabulates a round.

## Results

Judge means (1–10):

| Film | Model | Round 1 | Round 2 | Round 3 |
|---|---|---|---|---|
| 401(k) match | Haiku | 3.1 | 6.6 | |
| Phishing training | Haiku | 5.0 | 5.9 | |
| HSA or FSA | Haiku | | 3.7 (all kinetic words) | 6.9 |
| Expense policy | Haiku | | | 6.1 |
| Open enrollment | Sonnet | 6.4 | | |
| Client market update | Sonnet | | 6.9 | |
| Podcast clip (vertical) | Sonnet | 7.7 | | 7.4 |
| Reference: the kit used by hand (`examples/workplace-401k`) | Opus | | 7.0 | |

Haiku's mean rose from 4.1 to 5.4 to 6.5 across the rounds. Sonnet stayed around 7. The reference film shows the ceiling of the kit as it stands: clear (9) but not yet distinctive (5).

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

## Greyed B-roll

The one paid test: two Veo 3.1 Lite clips (an office morning, a city street; $0.80). A full-bleed `plate` with `treatment: "mono"`, a light scrim and no drift under a kinetic hook reads as a premium corporate film. Under a detailed sketch it competes with the labels. The workplace skill now says where it belongs (hooks, closes, people moments) and that generic clips are reusable across films.

## Open problems

- **Sketch tails.** A sketch's last moment often comes well before its narration ends, so the beat sits. `match` gained `again` (more stacks for "every paycheck"); the other sketches need closing moments or idle life.
- **Late cues.** A moment cued on the last word, with offsets after it, runs past the beat and fails `check`; beats should extend to fit instead of refusing.
- **Distinctiveness beyond looks.** Variants change the face; a film's central metaphor still mostly comes from the kit. The best films (the podcast's mug, the jar that drops to $660) invented one object and returned to it.
- **Critique and the verdict disagree** in ways agents find confusing; the verdict is the one to trust.
