# October 2026: model-made motion references

Six posts from the week after Opus 5.5 shipped (2026-09-28 to 2026-10-01): four videos and two long write-ups, plus the article one of them quotes. They were read for what ClearFrame lacks, not to copy. The videos were studied as 2 fps contact sheets and with `clearframe reference`; the write-ups were read in full. No code, music, imagery or type was imported. The one open-source repository involved (howseen-ai/claude-motion-design, MIT, revision `ae14994`) was read for ideas only, and everything below is implemented independently.

## What each one shows

| Post | What it is | What it does that ClearFrame did not |
|---|---|---|
| @johncodunayo, event promo (1:1, 23.6 s, 75 BPM) | A design conference's speaker reel: a rotating sunburst, a logo typed glyph by glyph with digits shuffling, giant type on the faces of a 3D box, a speaker carousel on a plinth, a torn ticket tilting in, an end poster ringed by a marquee of type | Type printed on planes that tilt in 3D; a sunburst field; a marquee border; whip moves smeared by speed lines; a hard-change rate around 42 per second |
| @bbssppllvv, "here's how" (1:1, 21 s) | A short tutorial: one SVG path, then each filter stage (inner shadow, a stripe that never stops, a gradient map from grey to colour, blur and grain) added on screen while the word PRO changes material | A gradient-map material on type (a thermal look made of filters, not images); code shown building up line by line beside its result |
| @notdwd, product launch (16:9, 34 s, ~116 BPM, cuts every three beats) | A launch film: a sentence whose words land one at a time in scattered places among floating UI chips, cut against a blue sky where browser and phone windows float tilted in space, a portal circle that grows into the next scene, a chat thread typed on a phone, a dark end card with prices and a blurred logo | Scattered words with ambient chips; floating tilted device windows; a chat simulation; an iris that becomes the next background; the drop at 14.1 s landing on "Until now." |
| @QibazX, tech reel (16:9, 15 s, ~137 BPM) | A dark reel of AI lab names: a lens flare opening, HUD rings, decoding type, a name per emblem (starburst, four-point star, orbit), a white slash cut, names breaking into particle streaks, a wireframe solid, a warp field, a sphere with orbiting labels, a final flare and title | A slash cut through a word; text dissolving into streaks; the drop at 13.1 s on the orbit reveal. Most of the rest ClearFrame already draws (`solid`, `warp`, `scramble`, `glow`) |
| @RaphaelAubryy, "the whole pipeline" | Ten films in three days with a harness: inputs, a beat map, four stills, render, then a frame-by-frame check | Measuring the drop from the bass rather than trusting a beat grid; sound placed on measured peaks; motion blur from subframes; a critique scored 1–10 per axis, with a phone-size sheet |
| @RaphaelAubryy, "the bugs" | The time bugs that only show in motion, and the check for each | A one-frame pop; a seam between separately built scenes; sound placed from the brief rather than the code; a drop detected wrongly; two shapes crossfaded into a ghost; text outgrowing a morphing shape; a loop seam; a pixel aspect ratio left over from scaling |
| @QibazX, "the $10,000 showreel" (quoted) | How the viral one-line prompt works and where it breaks | Without a reference, real assets and a review loop, every output has the same "motion design AI smell": centred text, a gradient, everything fading in |

## What we measured

`qa` computes the change per second on any film: the mean grey difference (0–255) between each frame and the frame one second earlier, on a 128 px grid.

| Film | Median change per second | Longest stretch under 2 |
|---|---|---|
| @johncodunayo | 41.9 | none |
| @notdwd | 27.2 | none |
| @QibazX | 12.9 | none |
| @bbssppllvv (a calm tutorial) | 8.5 | none |
| ClearFrame trailer bench | 11.1 | none |
| ClearFrame digest bench | 4.4 | 12.6 s (a sparse chart with labels landing) |
| ClearFrame data-story bench | 5.1 | 3 s, three times |

None of the references holds still for even 2.5 s. ClearFrame's genre films are in their range; its report films are not, while `critique` scores them all 100. The measurement on the film is the honest number.

## Taken

- **`qa DIR`** (time bugs): one-frame pops, held stretches, world seams, hard changes inside a beat, loop seams, export tags, loudness, the drop as heard; a timeline sheet (one frame per second, boring stretches included) and a 360 px phone sheet. The bench report now lists change per second.
- **`beatmap` and `music.drop`**: the drop measured from the bass in 20 ms windows; tempo with half and double listed; cuts against the grid; the song placed so its drop lands on a beat.
- **Colour-tagged finals**: BT.709 primaries and transfer, the BT.601 matrix, TV range, square pixels.
- **Planes in space**: `tilt` and the `rock` loop, for the tilted windows, phones, tickets and box faces of the launch films (orthographic, with the far edge in shade; SVG cannot draw a true perspective warp of type).
- **Materials**: `material` paints type by its own depth through a gradient map with flowing stripes and grain, the effect the @bbssppllvv tutorial builds from SVG filters (implemented independently in the renderer's filter graph).
- **Sketches**: `sunburst`, `chat`, `device` and `marquee`, and `examples/launch-promo` assembling them with a measured drop on the reveal. The example measures 5.7 change per second with nothing held, against 4–6 for the report bench.
- **Rules in `docs/cinema.md`**: transform one thing, never crossfade two; probe the middle of every transition; the drop lands on the key picture; hold with measurable life.

`qa` earned its place on its first real use: on the launch example it caught a background drawn 0.37 s late (a one-frame jump of 74 the sheet never showed) and a mix 2.8 LU under its loudness target.

## Not taken

- **The `seek(t)` HTML engine, Playwright capture and subframe `tmix` blur.** ClearFrame already renders natively and deterministically from the frame number, and draws motion blur from velocity in one pass rather than eight renders per frame.
- **Stock music and SFX libraries.** ClearFrame synthesises its cues and composes its beds, so there is nothing to license. Its cues are already placed by their shape, from the picture's own event times rather than a brief: hits and ticks peak in their first samples, a transition whoosh starts 0.3 s early so its swell peaks on the cut, and a riser ends where the silence begins.
- **Remake mode** (a frame-locked copy of someone else's launch film). Out of scope; `reference` takes the grammar of a reference, never its content.
