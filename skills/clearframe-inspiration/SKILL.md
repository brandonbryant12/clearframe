---
name: clearframe-inspiration
description: Turn a video idea into a few distinct visual concepts and find the ClearFrame library pieces that build the chosen one (looks, objects, sketches, playbooks, mechanisms, examples). Use when someone asks for ideas, options or "what could this look like", or when choosing pictures for a new film from the library. Not for acting on notes about an existing cut (clearframe-review).
---

# From an idea to pictures

The library is large: blocks, 60+ sketches, 40+ playbooks, palettes, type voices, cast objects in four looks, stage mechanisms and worked examples. Don't tour it. Search it with the brief, offer a few distinct ideas, then open only the pieces the chosen idea needs.

## 1. Read the brief for three things

- **The idea:** what is true, or what changes.
- **The audience:** who watches, and what they already know.
- **The feeling:** calm, playful, urgent, premium, warm.

Infer them from the material and the wording. Ask only when the subject itself is missing.

## 2. Search in plain words

```sh
node engine/cli.mjs find "a playful teaser for a retro game, for players"   # studio: clearframe_catalog topic find, query
node engine/cli.mjs find "order delivery" --kind cast-shape,cast-look,example
node engine/cli.mjs find --id cast-move:travel                               # studio: topic item, name KIND:NAME
```

`find` returns a short, mixed shortlist. Each line says what the entry is and when it fits. Read the "when" before choosing.

- **Narrow per concept.** Once a concept is in mind, search again with its own words and `--kind`.
- **Exact authoring.** `--id` prints the props, fields and an example that compiles; copy it and adapt it. For a sketch, the example lists its text slots (`sketchText`) and named moments (`sketchSay`). Fill the slots with the brief's own words and land each moment on the narration word that names it.
- **Browse.** `docs/library-index.md` lists everything when a search misses.
- **Overrides.** A project's or shared library's own entries take part in search.

| Kind | Gives you |
|---|---|
| `example` | A finished, curated film to copy from (a README and storyboards) |
| `playbook`, `direction` | A whole arc to start from (`new DIR --playbook`, `--direction`) |
| `treatment`, `palette`, `type` | The look and the voice: grade, colours, type |
| `sketch` | A drawn starting picture for one scene (`canvas` `sketch`) |
| `cast-shape`, `cast-look`, `cast-move` | Objects that persist across cuts, drawn in a look and moved on spoken words |
| `mechanism`, `stage-element` | Systems, code, worlds the camera travels, a colour handoff between scenes |
| `block` | One kind of scene: a figure, a quote, a chart, kinetic words |

## 3. Offer distinct concepts, then decide

When the person asks for options, or the brief leaves the picture open, offer two or three concepts. Make them differ in the picture's idea, not its palette. Ways in:

- **A metaphor:** the order is a parcel on a journey.
- **A place:** one lit window in a sleeping city.
- **A mechanism:** packets moving through the real system.
- **The words:** kinetic type on the voice.
- **The numbers:** one figure, sourced, landing on a word.

For each concept, give:

- one line on what we would see;
- one line on why it suits this audience and feeling, in everyday words ("feels like a notebook sketch, so new hires relax");
- the two to four library entries that build it.

Then recommend one and carry on. By default the agent decides, and the person can choose another. Don't quiz them. One strong concept is enough when the brief is clear; there is no quota.

Choose a look for the audience and the rest of the film, not for variety. Keep to the project's rules: every displayed number is sourced, there are no sample figures as evidence, and there is no text in generated images.

## 4. Adapt it to the brief

What you can change, from lightest to deepest:

| Change | How | Example |
|---|---|---|
| The words | `sketchText` fills a sketch's placeholder type. Cast objects take `label`, and blocks take their props. | `{"FIRST": "Stale logs"}` |
| When things happen | `sketchSay` lands a sketch's named moments on narration words. Cast moves and canvas elements take `say`. | `{"ALL": "Lights"}` |
| The look | `theme` (palette), `type`, the cast `look`, and the stage `material` (`dither`, `chrome`…) on a shape or a ground. | `"theme": "noir"` |
| What is drawn | Copy the sketch's elements and edit them: other icons, fewer cards, other positions. In a build script, `sketch(name, preset, {text, say})` from `film/sketches.mjs` returns the filled elements to change; by hand, `node engine/cli.mjs sketch NAME [--vertical]` prints them. Put the result in `props.elements` (without `props.sketch`). | `examples/checkout-at-night` |
| A new reusable picture | A sketch module, or a JSON sketch in the project's `library/sketches/`, so other films can use it by name. | `library/README.md` |

- **Start light.** Change words and cues first; copy elements only when the picture itself must change, such as a different number of things, different objects, or a different layout.
- **Shapes.** A copied drawing is laid out for one frame shape, so copy it once per shape.
- **Recognisable pieces.** Keep them recognisable: the brief's own objects (its services, its product) make a borrowed composition feel made for it.

## 5. Preview before building it all

- **One beat.** Paste the item's example into a beat, then `still DIR --at S --draft` or `sheet DIR --draft`.
- **Shape.** Check a vertical frame (`--vertical` scaffold) when the film is for phones.
- **Palettes.** `looks DIR --beat ID` compares one scene across palettes.
- **First look.** The first full look is still a rough cut (`draft DIR --rough`); detailed drawing comes after notes.
- **Phone size.** `qa DIR` writes a 360 px `phone.png`.

Worked calibration (one idea four ways, and different ideas with different choices): [references/concepts.md](references/concepts.md). Read it when unsure how far apart concepts should be.
