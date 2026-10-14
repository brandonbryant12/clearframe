# Ideas: pictures for narrative moves

To search everything in plain words, run `node engine/cli.mjs find "what you want to show"`. The sketches below that take `sketchSay` land their moments on your narration's words.

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
- **Chain reaction:** dominoes (`rect` with `keys` rotating, staggered by 0.12 s), each link starting where the last ended.
- **Machinery:** gears (`circle` + spokes, `spin` loops in opposite directions).
- **Zoom in, zoom out:** a `world` whose views push from the whole system into one part and back out again.
- **Accumulation:** a container filling (`grow-y`), a meter rising, stacked blocks landing with `pop`.
- **System:** the `architecture` sketch, or a native `stage` with real services and `send` events.
- **Build then transform:** draw the broken version, `exit` the broken part on "but", draw the fix in its place.
- **Untangle:** the `untangle` sketch. Scattered cards and crossing curves glide into one row on a word, then a clean line carries the work: a messy process made simple.
- **Fewer steps:** the `shortcut` sketch. A winding route through waits and a straight one, with two tokens at the same speed; the direct one arrives first. It shows speed without inventing a figure.
- **A way through:** the `maze` sketch. A seeded maze, then the one path lit on a word and followed to the exit: guidance through complexity.
- **A bridge:** the `bridge` sketch. Two sides of a gap, a bridge built on a word, then work crossing it: an integration or a partnership.

## Change over time
- `line` with an `art.over` arrow and label on the turning point, cued to the word that names it.
- **Before/after:** the same element `id` in consecutive canvas beats morphs position, size and colour across a cut.
- A marker travelling a `route` through dated stops (mono labels for dates).
- **Growth as amounts:** the `growth` sketch. A column a year: what you put in rises as a ramp, then the growth climbs onto it and overtakes it late; the last column splits into the two and the total counts up. From `years`, `perYear` and `rate`, so the shown values add up.

## Atmosphere
- **Weather as mood:** `particles` under a scene: `embers` over heat, `rain` over a flood, `snow` for a slow season, `dust` for a quiet hold, `bubbles` for chemistry.
- **Type with a voice:** `textMotion: cascade` for the loud line, `words` for the editorial through-line, `letters` for a single typed-out word.
- **Social captions:** `captions: "pop"` for vertical cuts: heavy outlined phrases, the spoken word on an accent pill.

## Tension and trade-off
- **Balance** sketch tipping on the "but" (`keys` with `ease: spring`).
- **What a lock keeps:** the `hold` sketch. A locked rate or price holds its line while the market rises past it, the gap shades in as what you kept, and with a float-down the lock steps down when the market falls.
- **The lower of two prices, then a discount:** the `lookback` sketch. A price line across one offering period, its first-day and last-day prices tagged, the lower one circled by hand and carried to the purchase, where a bar drops by the discount to the price you pay; optionally the gap to the last day's price is bracketed. For a share purchase plan's lookback, where words alone fail.
- **A sharp fall and the recovery:** the `drawdown` sketch. Only the letter's stated points on a real-day axis: the start at 0%, a dashed straight line down to the low with the stated fall in a chip, a pin raised from the line on the day something was done (a rebalance), and a dashed climb back to 0%, each move on its word. No invented path between the points, no fills. For a market letter's drawdown instead of a sample line.
- **Tug of war:** two groups moving with opposing `keys`.
- **Split screen:** `versus`, or a split `plate` beside a number.

## The average hides something
- `highlight` sweeps behind the phrase.
- A `spotlight` over the outlier bar (`art.over`, `dim` 0.7), cued to "outlier".
- **A search in the dark:** the `searchlight` sketch. A torch finds three things in turn, then the lights come up and a thread joins them: what nobody had looked at, or several symptoms that are one cause.
- Draw the distribution as dots, the mean as a line, then light the tail in the accent.

## Evidence and trust
- Sources on screen, always; a mono label ("SOURCE · Survey 2025") as canvas text on screenshots.
- `annotate` a real document or dashboard; pins land in reading order.
- A stamp: a rotated rounded `rect` with a mono word in `accent2`, `enter: pop`, for a finding someone verified.
- **Kept safe:** the `vault` sketch. Data flies into a vault and the door swings shut on a word: privacy, backups, trust.

## People and voices
- A `quote` card in light serif; speaker tags on recorded beats; the best line pulled out as kinetic `stack`.
- Literalise the anecdote: when a speaker names a concrete thing (a bridge, a key, a storm), draw it within the next 8–15 seconds.

## Turns and emotion
- `tone: invert` or a slower `motion` on the turn; a `push` into it; a longer hold.
- Take something away: after dense scenes, one word on an empty frame.

## Workplace and money facts
Each is a sketch to fill (`sketchText`, `sketchSay`, `sketchParams`); `skills/clearframe-workplace/SKILL.md` matches them to the kinds of fact.
- **Yours over time.** `vesting`: a timeline of steps, each lock springing open as a column grows to that step's share; a cliff year shakes its lock shut. Shares from `sketchParams.steps`.
- **A window on a calendar.** `deadline`: a month card where the opening day fills, a band sweeps to the last day and it is circled by hand; days outside dim. For enrollment windows and claim deadlines.
- **Three things by Friday.** `week`: one working week (columns in a wide frame, an agenda of rows in a tall one) with today marked; each task drops into its day as it is named, the due day is circled by hand, and an optional muted card past the week's edge says what slips if it is missed. For onboarding and "due this week", with no month or dates to invent.
- **Use it or lose it.** `expire`: a jar fills with one coin per unit; at year end a carry-over line draws, the coins above it turn red and lift away, and what is kept hops.
- **How much room is left.** `limit`: a track drawn to scale from zero to a yearly limit; the used share fills it on its word while its amount counts up, the limit lands, and the room left is bracketed and named. For a deductible met so far, an out-of-pocket maximum or a 401(k) or HSA contribution limit.
- **The document says it.** A canvas `document`: the plan or policy's own sections on a page, scrolled to the clause the voice reads, with `marks` (a highlight, a circle) landing on its words. Evidence the viewer can see, instead of a paraphrase on a card (`examples/fsa-deadline`).
- **Look closely.** `inspect`: an email or receipt arrives and up to three of its parts are marked in turn with a ring and a label (phishing tells, a receipt's must-haves). With `report: true` the same email is then reported: its Report phish button is pressed, the message shrinks into a security shield and a confirmation pops up, so the action is not a slide. `choices: true` refuses a click and a delete first (the card is tugged, then folds toward a bin, and each gets a no sign), and `end: "marked"` on one beat with `start: "marked"` on the next splits the signs and the habit into two beats on the same card.
- **The same email, one different button.** `compose`: a draft with its file attached, in a mail window or a phone; the old button (Attach) is struck through as the file shakes and greys, the new one (Share securely) lights and is pressed, and the file uploads and turns into a link with a lock; optionally "Expires in 7 days" lands on the link and Send confirms. For "a secure link, not an attachment" and "encrypt before you send": mail being sent, not a message received.
- **Two options, row by row.** `choose`: two cards, a tick per row for the one that wins it, then one is picked and lifts forward.
- **A whole into its parts.** `split`: one bar (a paycheck, a fee, a portfolio) splits into proportional segments that drop into labelled lanes, values printed from `sketchParams`; the remainder is highlighted.
- **Two contributions become one.** `match`: your coins and the company's stack side by side, then merge with the total on top; one coin per unit from `sketchParams`, so the picture agrees with the figure.
- **The step, done in the app.** `portal`: the cursor opens a section, picks a card, changes one value (3% to 5%) and saves; a confirmation lands and the view leans in on the new value. Each click lands on the word that names it. For "go to Benefits, then Retirement, and change your rate". On a screen you draw yourself, a canvas `pointer` presses each control by id on its word, and the control dips as it is pressed.

## Launches
- **The ask, played out.** `chat`: the customer's question typed and sent, three dots, the answer and a heart. Label it as an illustration.
- **Made from many pieces.** `cut-paper`: scraps on a cutting mat fly into place as the product card, which lifts off as its name types in.
- **The product in space.** `device`: a window swinging in from edge-on and turning gently, chips floating around it; put a real screenshot inside for a real product.
- **One word as a material.** `material: "chrome"` (or gold) on the product name, held under a push-in. Once in a film.
- **The drop lands on the reveal.** `beatmap DIR` to find it, `music.drop: {beat}` to place it.

## Endings
- **Callback:** return to the opening picture, changed (morph by id, or the same sketch with the resolved state).
- One action as the `endcard` pill; or a `checklist` of what to watch next.

## Translating documents
- **Sections** become chapters and a `push` or `panel` sits at their turns, but the order follows the argument, not the table of contents.
- **Tables** become `bars`/`line`/`donut`. Pick the one column that answers the question.
- **Recommendations** become a `checklist`. **Definitions** become `equation` or `callout`. **Estimates with ranges** become range bars drawn on canvas, labelled as estimates.
- **Long paragraphs** become one sentence each. The film links to the report for the rest.

## Motion rules
- **Arrive fast, land soft:** ease-out. Things decelerate into place; nothing starts and stops linearly.
- **Stagger related items 60–120 ms.** Never move everything at once; one hero per moment.
- **Something always breathes.** A camera drift, a loop, a plate drift; frozen frames read as slides.
- **Draw instead of fading** when you are explaining; fade only backgrounds.
- **Hold for reading.** About 3 on-screen words per second while the voice speaks.
- **Cut on the beat of the voice.** `push` and `panel` only at turns.
- **Sound stays quiet** (`sfx`): a soft thud as a count lands, a tick on a list item. Arrivals are silent unless an element names a `sound` (a pointer's click).
