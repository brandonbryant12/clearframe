# Ideas: pictures for narrative moves

A film is a sequence of moves: a hook, a tension, a mechanism, a turn, a payoff. Each move has pictures that make it land. Pick by what the sentence *does*, not what it is about. Every idea below is buildable with native blocks, `canvas` (start from `clearframe sketch`), beat layers (`plate`, `tone`, `camera`, `art`) and transitions.

## Hooks (first 3–5 seconds)
- **The number alone.** `stat` on `tone: accent`, centred, counting to the stressed word (`land`); a thud lands with it. The next beat pulls back to context.
- **The contradiction.** `versus` sketch: "What people think" and "What's true". Or state the wrong answer, then morph it (same `id` in the next beat) into the right one.
- **The question.** Kinetic `stack` with the question word in serif italic (`emphasisStyle: serif`); hold half a second of silence after it.
- **Flash-forward.** Two seconds of the peak visual (the finished drawing), then cut to its first stroke: "Here's how we get there."
- **Cold open on the world.** A full `plate` with a duotone treatment and one line of display type.

## Scale and comparison
- **Area-true magnitude** (`magnitude`), or a canvas zoom-out: a group scaled down with `keys` while larger context draws in around it.
- **One of many.** A `waffle` with `icon: user`, or an echo stack (`echo.step`) that multiplies one shape.
- **Human units.** Convert to days, rooms, football pitches; count up (`count`) with a source.

## How it works
- **Journey:** `route` sketch, stops landing as the line reaches them, a marker travelling `along`. For a longer journey, a `world`: one drawing, the camera travelling stop to stop, pulling out to the whole at the end (`playbook journey`).
- **Flow:** `pipeline` sketch with `dash` loops marching between stages; packets riding `along` the pipe.
- **Chain reaction:** dominoes (`rect` with `keys` rotating, staggered by 0.12 s).
- **Machinery:** gears (`circle` + spokes, `spin` loops in opposite directions).
- **Zoom in, zoom out:** a `world` whose views push from the whole system into one part and back out again.
- **Accumulation:** a container filling (`grow-y`), a meter rising, stacked blocks landing with `pop`.
- **System:** `orbit` or `network` sketch; the hub `pulse`s.
- **Build then transform:** draw the broken version, `exit` the broken part on "but", draw the fix in its place.

## Change over time
- `line` with an `art.over` arrow and label on the turning point, cued to the word that names it.
- **Before/after:** the same element `id` in consecutive canvas beats morphs position, size and colour across a cut.
- A marker travelling a `route` through dated stops (mono labels for dates).

## Atmosphere
- **Made in code:** a glowing wireframe `solid` (icosa, dodeca, cube) turning beside a claim; a `stars` field under the opening line; a `warp` tunnel under a contrast ("It can… It cannot…"). The `tech` treatment and `sizzle` playbook put these together.
- **Weather as mood:** `particles` under a scene: `embers` over heat, `rain` over a flood, `snow` for a slow season, `dust` for a quiet hold, `bubbles` for chemistry.
- **Type with a voice:** `textMotion: cascade` for the loud line, `words` for the editorial through-line, `letters` for a single typed-out word.
- **Social captions:** `captions: "pop"` for vertical cuts: heavy outlined phrases, the spoken word on an accent pill.

## Tension and trade-off
- **Balance** sketch tipping on the "but" (`keys` with `ease: spring`).
- **Tug of war:** two groups moving with opposing `keys`.
- **Split screen:** `versus`, or a split `plate` beside a number.

## The average hides something
- `highlight` sweeps behind the phrase.
- A `spotlight` over the outlier bar (`art.over`, `dim` 0.7), cued to "outlier".
- Draw the distribution as dots, the mean as a line, then light the tail in the accent.

## Evidence and trust
- Sources on screen, always; a mono label ("SOURCE · Survey 2025") as canvas text on screenshots.
- `annotate` a real document or dashboard; pins land in reading order.
- A stamp: a rotated rounded `rect` with a mono word in `accent2`, `enter: pop`, for a finding someone verified.

## People and voices
- A `quote` card in light serif; speaker tags on recorded beats; the best line pulled out as kinetic `stack`.
- Literalise the anecdote: when a speaker names a concrete thing (a bridge, a key, a storm), draw it within the next 8–15 seconds.

## Turns and emotion
- `tone: invert` or a slower `motion` on the turn; an `iris` into it; a longer hold.
- Ambient `art.under` (the `ambient` sketch) under a quiet statement.
- Take something away: after dense scenes, one word on an empty frame.

## Endings
- **Callback:** return to the opening picture, changed (morph by id, or the same sketch with the resolved state).
- One action as the `endcard` pill; or a `checklist` of what to watch next.

## Translating documents
- **Sections** become chapters and graphic transitions sit at their turns, but the order follows the argument, not the table of contents.
- **Tables** become `bars`/`line`/`donut`. Pick the one column that answers the question.
- **Recommendations** become a `checklist`. **Definitions** become `equation` or `callout`. **Estimates with ranges** become range bars drawn on canvas, labelled as estimates.
- **Long paragraphs** become one sentence each. The film links to the report for the rest.

## Motion rules
- **Arrive fast, land soft:** ease-out. Things decelerate into place; nothing starts and stops linearly.
- **Stagger related items 60–120 ms.** Never move everything at once; one hero per moment.
- **Something always breathes.** A camera drift, a loop, a plate drift; frozen frames read as slides.
- **Draw instead of fading** when you are explaining; fade only backgrounds.
- **Hold for reading.** About 3 on-screen words per second while the voice speaks.
- **Cut on the beat of the voice.** Graphic transitions only at turns.
- **Sound hits land on visual peaks** (`sfx`): a count landing, a transition, a pop.
