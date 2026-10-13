---
name: clearframe-workplace
description: Make a workplace or financial-services film that people actually watch (benefits, a 401(k) or pension, open enrollment, pay, an expense or security policy, compliance training, onboarding, a client market update) — a short recipe with one treatment, a fill-in-the-blank picture for each kind of fact, and a measured check that it is not narrated slides. Start here for any HR, finance, compliance or internal-comms video, before the other ClearFrame skills.
---

# Workplace films

The people watching were sent this film; they did not choose it. They give it five seconds, then decide. A slide with a sentence on it loses them, however clean it is. What keeps them is a picture that changes while the voice talks: coins that stack, a lock that opens, a window closing on a calendar, the value changed in the app they will use. This page is the whole recipe. Read the others only when it sends you there.

## 1. Find the three facts and the one action

From the source document, write in `DIRECTION.md`:

- **The action**: what the viewer does afterwards, where and by when ("raise your rate to 5% in the benefits portal"). Show it briefly; it is not the ending.
- **The hook**: what they lose or gain if they don't, in one line. Open on it in the first five seconds. Never open on a welcome or the company's name.
- **Three facts** that make the action obvious. More than four and the film becomes a policy document; leave the rest to the guide it links to.

## 2. Scaffold

```
node engine/cli.mjs start DIR --document SOURCE.md --playbook PLAYBOOK --treatment workplace --length SECONDS --audience "…" --takeaway "…"
```

`start` copies the source document into the project (`source/`) and lists every figure in it in `EVIDENCE.md`; `critique` then names any figure you typed (a word, a chart value, a sketch number) that the document never states, and `draft` says when the film falls well short of the length asked for (a short film usually dropped the brief's facts). With no document, `new DIR --treatment workplace --playbook PLAYBOOK --length SECONDS`.

Playbooks: `benefit-explainer` (a benefit and how to use it: a match, a share plan, an HSA), `day-in-the-life` (one person and one object of theirs through the moments a benefit touches; onboarding and a new hire's first week), `policy-change` (what changed and what to do: a new rule, a deadline, a new tool), `client-update` (a calm market or portfolio update for clients), `training-moment` (a threat or mistake, the signs, the habit). Use one of these five: the other playbooks (product walkthroughs, explainers) are cards and statements that read as slides in a workplace film. They are starting arcs: if yours is a decision, a story or a comparison, reorder or swap beats rather than forcing it into one. Each beat already has a picture with placeholder words: replace the words, keep the pictures. Each playbook also has three endings (the step in the app then the film's object; a bookend where the opening picture comes back changed; the step on a phone then a close of its own), one picked per project and named in DIRECTION.md; `--ending NAME` chooses another. The treatment gives each project one of six looks (clean, notebook, brief, meadow, poster, daylight: a palette, a type voice and clean, hand-drawn or printed lines), picked from the folder name and written into DIRECTION.md, so films from the same playbook don't share a face. Keep it, or choose by subject with `--theme` (`meridian` financial, `meadow` benefits and health, `briefing` training, security and policy); a brand kit overrides all of them. Screens (`portal`, `inspect`, `compose`) stay crisp in a drawn or printed film.

## 3. One picture per fact

Each fact gets the mechanism that shows it. These are sketches: fill `sketchText` (words from the source), `sketchSay` (the narration word each moment lands on) and `sketchParams` (the figures). `node engine/cli.mjs sketch NAME` prints the beat to paste with every slot named.

| The fact says… | Picture | Fill |
|---|---|---|
| "You put in X, they add Y" (a match, a grant, a top-up) | `match` | params `{you, match, suffix}`: one coin per unit |
| "If you raised it from 3% to 5%…" (what if: one change, its consequence) | `match` with `fromYou`, `fromMatch` | opens on today's coins; only the added ones drop |
| "It becomes yours over time" (vesting, eligibility) | `vesting` | params `steps` (percentages) |
| "Between these dates" (enrollment, a deadline) | `deadline` | params `days, firstWeekday, start, end` |
| "Three things by Friday" (a week with a due day: onboarding, "due this week", "miss Friday and it's the 30th") | `week` | params `today, due, tasks` (day indices, 0 = Mon), `after: true` for the consequence; no month or dates to invent |
| "It doesn't carry over" (use it or lose it, a reset to zero) | `expire` | params `total, keep` |
| "Go to the app and change X" (the action, almost always) | `portal` (`device: "phone"` for a mobile app) | words for the menu, the field, old and new values; one sentence of narration |
| "Look for these signs" (phishing, a receipt, a clause) | `inspect` | words for the message and the three marks; params `report: true` for the Report phish step on the same email (REPORT, after the marks: its button pressed, the message sent to Security, a confirmation), instead of a slide that says "click Report"; `choices: true` for don't click / don't delete / report (CLICK and DELETE before REPORT: a no sign on the link, then on a bin); `start: "marked"` to continue the same card on a second beat (only CLICK, DELETE, REPORT left), after a beat with the same params plus `end: "marked"` and `camera: "none"` |
| "The same email, one different button" (a secure link instead of an attachment, encrypt before sending: mail being sent; Report phish on a message received is `inspect` with `report: true`) | `compose` (`device: "phone"` for a mail app) | words for the draft (recipient, subject, a body line, the file), the old and new buttons and what the file becomes; params `expires: true` for the tag on the link, `send: true` for Send and its confirmation |
| "Option A or option B" (plans, accounts) | `choose` | rows won by a or b, the pick |
| "Where the money goes" (a paycheck, a fee, an allocation) | `split` | params `parts` (values that add up) |
| "It grows over time" (compounding, starting early, what a habit adds up to) | `growth` | params `years, perYear, rate` (a fraction: 0.05); the last column splits into what you put in and what it grew |
| "Locked in, whatever the market does" (a rate lock, a price guarantee, a fixed premium) | `hold` | params `lock, rise, fall, floatDown, days`: the market moves, the lock holds, and the gap is what you kept |
| "The lower of two prices, then a discount" (a share purchase plan's lookback, a price protection offer) | `lookback` | params `start, end, discount` (a fraction: 0.15), `decimals` as the source prints prices, `gain: true` for the gap to the last day's price: the lower price is circled and a bar drops from it to what you pay, worked out from the params |
| A figure to remember, then compared | canvas `chart` number, then bars in the next beat (they morph) | `clearframe-dataviz` |
| Several figures in one line ("14% clicked, 3% typed a password, 22% reported") | canvas `chart` with `say` on each value: a `number` steps through them as each is spoken, `bars` grow on their words | one value per figure |
| A sequence or a group of things | a `cast` of the film's objects (`docs/cast.md`) | objects and formations |
| "Would you spot it?" (training: a quick check before the answer) | a `teaching` question beat, then its answer beat (`docs/teaching-sequences.md`) | `prompt`, three `options`, `correctIndex`, a one-line `explanation`; a reading hold on the question. It is type on its own: once in a film at most, after the signs have been shown as pictures |

A picture must keep up with its narration: every figure or idea the voice names gets its own moment (a cue, a value's `say`, a sketch moment). Three figures said over one still number is a slide. A pointer gliding across the frame is not motion, to the verdict or to a viewer: when it reaches something, move the thing it touches (the card tugs toward the link, the email flinches toward the bin, the button presses).

Give the film one object of its own, and keep it across cuts: a `cast` of the film's objects (`paycheck`, `jar`, `calendar`, `badge`, `house`, `umbrella`, `receipt`, `person`, `coin`) that opens the film and comes back at the end (a paycheck that splits, a jar that fills, a badge for a new hire). It is what makes this film this film and not the last one. Two beats on the same idea share a cast or a world, so the cut is invisible; a new idea can cut hard (`panel` at a chapter; not `iris`, `flash` or `whip`, which are a trailer's punctuation and read as glitches here). Show the step done (`portal`) in one sentence, not a held screen: every film that ends on the same app mock-up looks like the last one. Then close on the film's own picture (its object changed: the jar full, the calendar checked, the person with the paycheck), with the deadline or the line to repeat in the voice. One kinetic line (`kinetic` `stack`) for the sentence people should repeat is plenty.

## People and places: greyed B-roll

Workplace films are about people, and the sketches have none. A few seconds of footage behind the hook, a close or a turn, greyed out so the type reads, puts the film in a real office or a real morning:

```json
"plate": { "file": "assets/clips/office-morning.mp4", "side": "full", "treatment": "mono", "scrim": 0.75, "drift": "none", "offset": 0.5 }
```

Put it under big type (a kinetic hook or close) or a simple picture. Under a detailed sketch with small labels it competes: raise `scrim` to 0.85 or keep that beat on plain ground. Footage never carries a figure or a word; generic clips (an office, a street, a kitchen table) are reusable across films, so keep a local folder of them. Generating one costs money (`veo-video`, about $0.20–0.40 a clip at 720p); with no budget, leave it out.

## 4. Narration

One idea per beat, written for the ear: short sentences, figures as digits, the word that names each moment said where the picture should move (that word goes in `sketchSay`). `voice DIR --draft` is free and local; it measures its words with Whisper, which takes about a minute per minute of speech, longer while other work runs. Wait for it.

## 5. Draft and read the verdict

```
node engine/cli.mjs draft DIR
```

It ends with a **motion verdict** that starts READY or NOT READY (a NOT READY draft exits with code 2). **The film is done only when it says READY**: a NOT READY film is not handed over, whatever the time box, and the verdict lists each edit (each is one change to one beat): the stillest beats and what to land on which words, the beats that are only words (a single figure on a card counts: a `number` chart with one value is a stat card; step it through several spoken values or give the figure a picture) and the picture for each, objects standing on each other, the source's facts a short film never states, a voice over an empty frame, pictures too small for the frame, and a film well short of the length asked for. Under 20% still is a film; over 40% is narrated slides, whatever the cinema score says. A real reading hold (a figure people must read, the action) is fine: mark that beat `pace: "hold"`. Then open `build/sheet.png` and `build/qa/phone.png` and look at every frame. A longer film needs more pictures, not longer narration over the same ones: each added fact gets its own beat and picture.

## 6. Truth and tone

- Every figure comes from the source document and its beat names that document in `source` ("Alder Street Retirement Plan, 2027"). Counts and scales come from `sketchParams`, never from the drawing, and a sketch number is a figure too: never invent an amount to make a sketch draw money (if the page says "resets to $0", show the reset, not a balance).
- Keep the brief's must-haves: what it says people must not miss, the dates, the place to act, anything new this year. A film half the length asked for has usually dropped one of them.
- Attribution is short and in the film's words. No disclaimers on screen ("illustrative only", "not advice"); an example is labelled once ("Example: a $60,000 salary").
- Warm and plain, a little wit, never fear. Explain jargon with the picture, not a definition.

Commands, timing and delivery: `clearframe-engine`. Numbers and charts: `clearframe-dataviz`. Drawing beyond the sketches: `clearframe-canvas`.
