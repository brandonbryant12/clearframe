---
name: clearframe-workplace
description: Make a workplace or financial-services film that people actually watch (benefits, a 401(k) or pension, open enrollment, pay, an expense or security policy, compliance training, onboarding, a client market update) — a short recipe with one treatment, a fill-in-the-blank picture for each kind of fact, and a measured check that it is not narrated slides. Start here for any HR, finance, compliance or internal-comms video, before the other ClearFrame skills.
---

# Workplace films

The people watching were sent this film; they did not choose it. They give it five seconds, then decide. A slide with a sentence on it loses them, however clean it is. What keeps them is a picture that changes while the voice talks: coins that stack, a lock that opens, a window closing on a calendar, the value changed in the app they will use. This page is the whole recipe. Read the others only when it sends you there.

## 1. Find the three facts and the one action

From the source document, write in `DIRECTION.md`:

- **The action**: what the viewer does afterwards, where and by when ("raise your rate to 5% in the benefits portal").
- **The hook**: what they lose or gain if they don't, in one line. Open on it in the first five seconds. Never open on a welcome or the company's name.
- **Three facts** that make the action obvious. More than four and the film becomes a policy document; leave the rest to the guide it links to.

## 2. Scaffold

```
node engine/cli.mjs new DIR --treatment workplace --playbook PLAYBOOK
```

Playbooks: `benefit-explainer` (a benefit and how to use it), `policy-change` (what changed and what to do), `client-update` (a calm market or portfolio update for clients), `training-moment` (a threat or mistake, the signs, the habit). Each beat already has a picture with placeholder words: replace the words, keep the pictures. The treatment gives each project one of six looks (clean, notebook, brief, meadow, poster, daylight: a palette, a type voice and clean, hand-drawn or printed lines), picked from the folder name and written into DIRECTION.md, so films from the same playbook don't share a face. Keep it, or choose by subject with `--theme` (`meridian` financial, `meadow` benefits and health, `briefing` training, security and policy); a brand kit overrides all of them. Screens (`portal`, `inspect`) stay crisp in a drawn or printed film.

## 3. One picture per fact

Each fact gets the mechanism that shows it. These are sketches: fill `sketchText` (words from the source), `sketchSay` (the narration word each moment lands on) and `sketchParams` (the figures). `node engine/cli.mjs sketch NAME` prints the beat to paste with every slot named.

| The fact says… | Picture | Fill |
|---|---|---|
| "You put in X, they add Y" (a match, a grant, a top-up) | `match` | params `{you, match, suffix}`: one coin per unit |
| "If you raised it from 3% to 5%…" (what if: one change, its consequence) | `match` with `fromYou`, `fromMatch` | opens on today's coins; only the added ones drop |
| "It becomes yours over time" (vesting, eligibility) | `vesting` | params `steps` (percentages) |
| "Between these dates" (enrollment, a deadline) | `deadline` | params `days, firstWeekday, start, end` |
| "It doesn't carry over" (use it or lose it, a reset to zero) | `expire` | params `total, keep` |
| "Go to the app and change X" (the action, almost always) | `portal` | words for the menu, the field, old and new values |
| "Look for these signs" (phishing, a receipt, a clause) | `inspect` | words for the message and the three marks |
| "Option A or option B" (plans, accounts) | `choose` | rows won by a or b, the pick |
| "Where the money goes" (a paycheck, a fee, an allocation) | `split` | params `parts` (values that add up) |
| "It grows over time" (compounding, starting early) | canvas `graph` with `exponential` | `clearframe-explain` |
| A figure to remember, then compared | canvas `chart` number, then bars in the next beat (they morph) | `clearframe-dataviz` |
| Several figures in one line ("14% clicked, 3% typed a password, 22% reported") | canvas `chart` with `say` on each value: a `number` steps through them as each is spoken, `bars` grow on their words | one value per figure |
| A sequence or a group of things | a `cast` of the film's objects (`docs/cast.md`) | objects and formations |

A picture must keep up with its narration: every figure or idea the voice names gets its own moment (a cue, a value's `say`, a sketch moment). Three figures said over one still number is a slide.

Give the film one object of its own, and keep it across cuts: a `cast` of the film's objects (`paycheck`, `jar`, `calendar`, `badge`, `house`, `umbrella`, `receipt`, `person`, `coin`) that opens the film and comes back at the end (a paycheck that splits, a jar that fills, a badge for a new hire). It is what makes this film this film and not the last one. Two beats on the same idea share a cast or a world, so the cut is invisible; a new idea can cut hard (`panel` at a chapter). Let the action beat show the step done (`portal`), with the deadline in the voice or on screen, rather than an end card listing it. One kinetic line (`kinetic` `stack`) for the sentence people should repeat is plenty.

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

It ends with a **motion verdict**: how long the picture sits still while the voice talks. Under 20% is a film. Over 40% is narrated slides, whatever the cinema score says: fix the stillest beats it names (a moment on a later word, a cast formation, a camera move in a world, a shorter beat). A real reading hold (a figure people must read, the action) is fine: mark that beat `pace: "hold"`. Then open `build/sheet.png` and `build/qa/phone.png` and look at every frame.

## 6. Truth and tone

- Every figure comes from the source document and its beat names that document in `source` ("Alder Street Retirement Plan, 2027"). Counts and scales come from `sketchParams`, never from the drawing.
- Attribution is short and in the film's words. No disclaimers on screen ("illustrative only", "not advice"); an example is labelled once ("Example: a $60,000 salary").
- Warm and plain, a little wit, never fear. Explain jargon with the picture, not a definition.

Commands, timing and delivery: `clearframe-engine`. Numbers and charts: `clearframe-dataviz`. Drawing beyond the sketches: `clearframe-canvas`.
