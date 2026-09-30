# Cinema: shots, not slides

A slide holds a layout until the presenter moves on. A shot is a moment in a continuous piece of time: something moves, the camera has a point of view, and each cut is motivated. This page turns film and motion-design practice into ClearFrame controls. Read it before directing anything that should feel like a film rather than a report. The scorecard in [scorecard.md](scorecard.md) tracks how close the defaults get.

## The eight tells of a slideshow

`critique` flags these. Fix them in this order:

1. **A card per line.** Every beat is a self-contained layout, and nothing carries over the cut.
2. **Build, then freeze.** The scene assembles in a second, then sits still while the voice talks.
3. **A heading on every scene.** The top-left title is the deck's slide title.
4. **Locked, flat camera.** No depth, focus or parallax.
5. **A small subject in a big room.** A band of content in the middle, with no close-ups and no full-bleed.
6. **The same grammar every beat.** The same layout, the same entrance, the same fade.
7. **A screen-flat image.** No light, lens or grade.
8. **An edit set by the voice alone.** Every cut lands on a sentence boundary.

## Grammar

### Shots and scale

Plan a **shot list** before blocks. Each beat is a shot with a scale:

| Scale | Use | ClearFrame |
|---|---|---|
| Establishing / wide | Where we are, the whole system | A world view of the whole drawing, a horizon, a skyline |
| Medium | The subject in its context | A canvas focus on one station, a chart with its surroundings |
| Close-up | The detail that matters | Camera rect tight on one element, full-bleed type, `magnitude` |
| Insert | A single fact, a single word | A kinetic `stack`, a counting number filling the frame |

Never cut five mediums in a row. Wide, then medium, then close, then back out to wide for the payoff is the oldest pattern in film because it works.

### Three planes

Every cinematic frame has a **foreground, midground and background**, each moving at its own rate. That difference in rate is how depth reads. In canvas:

- **Background (`z` 4–10):** sky, far skyline, stars, a soft gradient. Barely moves and is often out of focus.
- **Midground (`z` 0–2):** the subject, which is where the story happens.
- **Foreground (`z` −0.6 to −0.2):** dust, a blurred frame edge, leaves, a pane of glass. Moves fastest and is soft. One foreground element per scene is enough.

Use `focus` to choose which plane is sharp, and rack it on the word that shifts attention.

### A motivated camera

The camera moves because something happens. Match the move to the job:

| Move | Means | ClearFrame |
|---|---|---|
| Push in | "Look closer", a revelation, tension | World `view` narrowing; block `camera: in`; `camera: {to: [x, y, w, h], say}` onto the detail; `dolly` forward |
| Pull out | Context, "it was bigger than we thought" | World view widening; `camera: out` |
| Track / truck | Following something along | World view sliding sideways, with parallax from `z` |
| Fly-through | Entering a place or a scale | `dolly` through `z` layers (rings, clouds, walls) |
| Rack focus | Attention shifts between planes | `focus.keys` on a spoken word |
| Handheld | Presence, urgency, documentary truth | `lens.handheld` 0.2–0.5 |
| Locked off | Stillness as a statement | `camera: none`, used rarely and on purpose |

### Continuity across cuts

This is where motion design differs most from slides: **transitions are the story.** An object's identity survives the cut. Techniques, from subtle to bold:

- **Worlds.** The same drawing continues and the camera moves to the next thing (see [canvas.md](canvas.md)).
- **Morph by id.** A shape in one beat becomes a shape in the next: a circle becomes a planet, a bar becomes a building.
- **Match cut.** The same shape or position on both sides of a cut, such as a ring that becomes a coin that becomes a sun. Put the elements at the same frame position.
- **Graphic wipes.** `panel`, `iris` and `whip` carry one movement across the cut. Use them at turns in the story, not at every cut.
- **Cut on action.** Cut while something is moving (a whip, a camera move with motion blur), never after everything has settled.

### Light and lens

Set these per film with `lens`. Any beat can override a key:

```json
"lens": { "letterbox": 2.39, "grade": "teal-orange", "bloom": 0.4, "aberration": 0.25, "leak": 0.3, "handheld": 0.3, "blur": 0.5 }
```

| Key | What it does | Taste |
|---|---|---|
| `letterbox` | Black bars for a picture aspect: 2.39 scope, 2, 1.85. Headings, sources and captions move inside the picture. Landscape only. | For trailers and drama. Use `false` on one beat to open the frame at the payoff. |
| `grade` | Tone curves per channel: `teal-orange`, `warm`, `cool`, `bleach`, `mono`, `noir`, `sepia` (`gradeAmount` 0–1, default 0.7) | teal-orange for blockbuster, bleach for grit, warm for nostalgia, noir for mystery |
| `bloom` | Highlights glow into their surroundings | 0.3–0.5 on dark palettes; it makes type and light sources read as light |
| `aberration` | Red and blue slip apart by a few pixels | 0.15–0.35. Hard edges only; subtle is the whole point |
| `leak` | Warm light leaks drifting at the frame edges | 0.2–0.4 for nostalgia, launch and dawn moods |
| `handheld` | A seeded operator sway of position and roll | 0.2–0.4 for documentary, 0.6+ for urgency |
| `blur` | Motion blur on world camera moves and on elements moving fast on their keys (0.5 = 180° shutter) | 0.5 always, once there are fast moves |

Within scenes, light is drawn: `glow` on light sources, `shine` sweeps across titles, `spotlight` on the subject, and gradients that fall off from a motivated source (the sun, a screen, a street lamp).

### Rhythm

- **Contrast fast and slow.** Three quick cuts, then a long hold. A montage then needs a breath.
- **Silence before impact.** A beat with no voice, one element and a low hum, then the hit (a title, a number). With `sfx` on, ClearFrame scores this for you: a riser ends where the silent beat begins, room tone fills it, and a `flash` cut lands with a hit.
- **Button.** End on one short line after the title, like a trailer's final card.
- **Music follows the edit.** `music: {style: "pulse", bpm: 92}` gives a free draft bed that builds toward the first silent beat, cuts dead through it, and carries the title on a low chord. Replace it with a composed bed (Lyria) for finals, and keep the same shape.
- **Hold with life.** Every held frame keeps something moving: drift, particles, a pulse, a loop or the lens handheld.

## Genres

The playbooks are starting structures for each genre (`clearframe playbooks`); the treatments set the look (`clearframe treatments`).

| Genre | Shape | Look |
|---|---|---|
| **Trailer** | Cold open, three rising montage beats split by type cards, silence, title, button | letterbox 2.39, a grade, bloom, handheld, black type cards |
| **Cold open** (documentary) | Start mid-scene with a detail, pull out to context, then the title late | warm or bleach grade, handheld, leak |
| **Product reveal** | A dark stage, the object in pieces, light sweeping it, specs as inserts, then the whole | noir or mono grade, bloom, shine, slow push |
| **Title sequence** | Graphic shapes becoming each other in rhythm, names as type | Bold palette, cut-paper shapes, match cuts, no lens tricks |
| **Zoom journey** | One continuous camera from very large to very small (or back) | A world with nested scales, dolly, focus |

## Checklist before rendering

- [ ] A shot list with scales, and no three identical scales in a row.
- [ ] At least one continuity device per minute (world, morph, match cut, graphic wipe).
- [ ] Three planes in every canvas scene that should feel like a place.
- [ ] Every camera move has a reason written in DIRECTION.md.
- [ ] A lens chosen deliberately, or explicitly none.
- [ ] One silence-before-impact moment, and a button.
- [ ] `critique` has no slideshow tells left, or each one is a choice you can defend.
