# Podcast pictures: a picture for every idea

An 89-second vertical clip of a recorded conversation (Money at Work: host Maya asks, guest Sam explains how much cash to keep) in which every idea Sam explains gets its own small picture, and readable pop captions carry the words underneath. It is the worked answer to "last time it was just text on a background": the recording is imported exactly as recorded, and then the beats that carry an idea have their kinetic captions replaced with drawings of Sam's own objects and numbers. Only one line stays as type, the one the host repeats. Everything in it is fictional: the episode is a local text-to-speech mock (`bench/enterprise/podcast/`).

The direction is `podcast-picture` (`packages/engine/src/library/directions/podcast-picture.json`): pictures carry the idea, captions carry the words, host lines stay short poster type, and one or two objects come back across the clip. Here those objects are a glass jar (the cash) and a set of calendar pages (the months).

## The picture for each idea

The frame is 1080 × 1920. Every picture lives in the upper part (y 150–1420); the speaker chip (with "Sam, on air" on its row, right-aligned) and the pop captions take the band below it. Nothing in the pictures or the source line is smaller than 36 px (about 12 px on a 360 px phone; the engine's speaker chip is smaller), the big figures are 120–210 px and the chart's values 84 px.

| Beat | Who: what they say | Picture | Why this picture |
|---|---|---|---|
| `s001` | Maya: the welcome | The question as poster type from the first frame, over an empty glass jar | The recording opens on a greeting, so the picture opens on the question (the hook) instead. The jar is the film's object. |
| `s002` | Maya: "one question we get every single week: how much cash should you actually keep?" | "?" bubbles pile up on *question, every, single, week*; the jar fills on *cash*; a dashed level searches up and down on *keep* | The question drawn as a level nobody knows where to set |
| `s003` | Sam: "more than most people have, and less than some people hoard" | The jar becomes the middle of three: most people (low), enough (between), some people (overflowing, coins spilling) | His answer is a comparison between two levels; three jars show it at a glance |
| `s004` | Maya: "Okay, unpack that." | Poster type; the middle jar's lid pops open; the other two dim | A host line stays short type, but on the picture it is about |
| `s005` | Sam: "three to six months of essential expenses" | **Cast:** six empty month slots from the first frame; three calendar pages land on *three*, three more on *six*; "3 to 6 months" in big figures | Calendar pages that count months: the unit of his rule |
| `s006` | Sam: "Not your salary. Rent, groceries, insurance, the car." | **Cast:** a paycheck drops in and is crossed out on *salary*; rent, groceries, insurance and the car land on their words under "each month" | What a month is made of, each thing on its word |
| `s007` | Sam: "twelve to eighteen thousand dollars" | **Chart:** two bars that grow on *twelve* and *eighteen*, under "3 to 6 months, in dollars" and the six pages, small | The months become dollars; a value per spoken figure |
| `s008` | Maya: "That sounds like a lot when you're starting out." | The same bars (they carry across the cut) with her reaction as poster type | Her reaction is to that $18,000 |
| `s009` | Sam: "It is. So don't start with six months." | **Cast:** the month's costs fold into the first page; pages two to six are crossed out on *six*; "6 months" struck through | His advice is to undo the six: cross them out |
| `s010` | Sam: "Start with one. One month turns a car repair from a crisis into an annoyance." | **Cast:** the other pages fly off, the first steps forward as "One month"; the car comes back; *Crisis* turns into *Annoyance* | His own example, as a before and after |
| `s011` | Maya: "I like that. Crisis into annoyance." | **The one kinetic line**, poster type on a red field | The host repeats it, so it is the line worth repeating |
| `s012` | Sam: "the second thing, where people go wrong, is the opposite" | The three jars again; a ring marks too little, then moves to too much on *is the opposite* | A callback: the opposite mistake is the other end of the same picture |
| `s013` | Sam: "forty thousand dollars in a checking account earning nothing, because it feels safe" | The overflowing jar comes forward and fills with 100 coins as "$40,000" counts up; a CHECKING tag; "earning nothing"; a lock on *safe* | His number, and the feeling he names, on the jar from the opening |
| `s014` | Maya: "And it isn't?" | The lock wobbles and a question mark lands | One second: the picture answers her doubt |
| `s015` | Sam: "safe from the stock market… not safe from prices going up" | A jagged market line held off (a tick); prices climbing at the jar (a cross) | Two threats, one picture: one handled, one not |
| `s016` | Sam: "If prices rise three percent a year, that pile buys about three percent less every year it sits there." | Three coins in every hundred go grey on *less*, *every* and *sits*; the figure counts down from $40,000 to $36,500, "what it buys after 3 years" | His 3% drawn literally (3 of 100 coins a year) and computed from his own numbers (40,000 × 0.97³) |
| `s017` | Maya: "So where should the emergency money live?" | Poster question; the checking jar moves aside and a dashed empty place waits beside it | The question, as an empty space |
| `s018` | Sam: "Somewhere boring, separate, and paying interest." | A plain jar with a grey lid fills the empty place on *boring*; forty coins move into it and a wall goes up on *separate*; interest coins drop in | Each of his three words does something to the picture |
| `s019` | Sam: "A high yield savings account is fine." | The new jar is named SAVINGS, high-yield; a tick on *is fine* | The answer, named |
| `s020` | Sam: "…if it's in your checking account, you'll spend it on a Tuesday." | The wall pulses on *matters*; the checking jar is ringed on *checking*; five coins fly out of it into a shopping cart on *spend*; "Tuesday" | Why separate matters: money left in checking leaves |
| `s021` | Maya: "Spend it on a Tuesday. That's going on a mug." | The line is printed big, then a mug draws itself round it on *going* and *mug*, with steam | She makes the joke; the picture takes her at her word |
| `s022`–`s023` | Maya: "Sam, thank you." Sam: "Anytime." | The mug stays; "Start with one month." and "Keep it separate." land under it; a 1.5 s hold | The two things to remember, on the object people will remember |

Every figure Sam says carries one short line, "Sam, on air", and the storyboard's `sources` names him and says the $36,500 is computed from his $40,000 and 3% a year. There are no disclaimers on screen.

## How the script works

`node examples/podcast-pictures/build.mjs [OUT]` (default `build/podcast-pictures`), from a fresh checkout, with free local tools only:

1. makes the mock episode if it is missing (`bench/enterprise/podcast/make-episode.mjs`, the macOS `say` voice; the `.wav` is git-ignored);
2. imports it with `ingest --audio … --script bench/enterprise/podcast/turns.txt --speakers host=Maya:Host,guest=Sam:Guest --vertical --direction podcast-picture` (local Whisper measures the words; an existing import in OUT is reused);
3. checks that each beat still says the words its picture was made for, and stops with a list of the beats that moved if any did, changing nothing. Then it replaces each beat's `block` and `props` (plus `tone`, `transition`, `pace` and `hold` where a beat needs them), and never touches `vo`, `speaker`, `note`, the recording or its timing;
4. prints the next command: `pnpm cf draft OUT`.

Then open `OUT/build/sheet.png` and `OUT/build/qa/phone.png`.

To make a new podcast clip from this, keep its shape rather than its jars: the check that pictures match words, one helper per recurring object (`jar`, `coinGrid`, `twoJars`, `mug`), every picture above the caption band, every change cued to the word that names it (`say`), and one kinetic line.

## Measured result

`draft` on the result: **motion: READY · 3.31 change/s; still under the voice 0 s of 88.83 s (0%)**. Type alone (a kinetic beat, or a canvas of nothing but words) is 2.8 s of 88.8 s (3%): `s011` only. Every host line also has a picture under its poster type. `critique` scores cinema 100/100; `check` finds 0 errors; `qa` finds no pops, no held stretches and no other findings, at −14.1 LUFS integrated (peak −1.6 dB). The film is the recording's 87.3 s plus a 1.5 s hold on the last frame; no other silence is inserted.

## Lessons from building it

- **A word-cued line stretches a recorded beat.** The engine keeps any text cued with `say` on screen for a reading time (about 1.3 s or more) inside its own beat. In a continuous recording that inserts silence between turns. A line that stays on screen into the next beat (it morphs across the cut by `id`) is cued by time (`at`) instead. The engine does not count that carry-over.
- **Casts lay themselves out over the whole frame**, captions included. Give every formation a `center` in the picture area. Limit a `hero` to its own object (`ids`), or objects not yet introduced join its quiet ring before their words.
- **The savings jar is drawn before the coins that land in it**, otherwise its glass covers them. Coins that moved by keys in one beat take new ids in the next, because a morph starts from the unkeyed position.
- **Attribution goes on the chip's row.** The engine's source line sits just above the pop captions and runs into a two-line caption. The script turns each beat's `source` into a `sourceElement`: a static 36 px ink line, right-aligned on the speaker chip's row, with an id of the beat's own (a shared id would morph across the cut and link the two beats).
- **A stock sketch did not fit this frame.** `choose` (two account cards, rows ticked) was tried for `s019`. In a 9:16 frame with pop captions it sits in the lower half and meets the speaker chip, leaves the top 700 px empty, and its moments stretch the recorded beat by 0.7 s. The four-beat jar sequence tells the same thing without a cut. In landscape, or for a script written to fit, the workplace sketches are the quicker route (`examples/workplace-401k`).

## Limits

- Draft only: the voices are the macOS `say` mock, and Whisper hears "Spend" at the start of `s021` as something else, so that beat's words are interpolated (estimated). `draft` accepts that; a final render needs the word measured.
- The burned pop captions themselves trip about 26 title-safe warnings, for words near the frame edge. The chart's category labels ("Low end", "High end") are fixed at 36 px and the speaker chip is small; neither size can be set from the storyboard.
- The opening is the recorded greeting. The picture leads with the question, but `critique` still notes the greeting; cutting it (`cut`) is the person's call, not the example's.
