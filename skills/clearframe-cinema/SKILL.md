---
name: clearframe-cinema
description: Make a ClearFrame film cinematic instead of a narrated slideshow — genre structures (trailer, cold open, product reveal, cinematic explainer, title sequence, zoom journey), shot lists, depth and camera (z, dolly, rack focus, push to a detail), the film lens (letterbox, grade, bloom, handheld, motion blur) and sound that follows the edit. Use when a film "looks like slides", when someone asks for something cinematic, dramatic, dynamic or trailer-like, or to raise a low cinema score from critique.
---

# Shots, not slides

Read `docs/cinema.md` first: it holds the grammar this skill applies. `critique DIR` prints a cinema score out of 100 and names the tells it finds. Aim for 90+, or be able to defend each remaining tell.

## 1. Pick the genre, not just a look

| The job | Treatment | Playbook |
|---|---|---|
| Explain how something works, as a film | `cinematic` | `cinematic-explainer` (establishing shot, the question, one world, the figure, a silence, the whole) |
| Build anticipation (launch, teaser, season) | `trailer` | `trailer` (cold open, montage with flash cuts, silence, title, button) |
| A true story or case study | `documentary` | `cold-open` (a detail, the place, a voice, the scale, the title late) |
| A product or feature | `keynote` | `product-reveal` (dark stage, part in close-up, specs as inserts, the whole) |
| An opener for a series or podcast | `cutpaper` | `title-sequence` (shapes that become each other across cuts) |
| Scale: one thing within everything | `cinematic` | `zoom-journey` (one camera from a planet down to one window) |
| A report, with evidence | any report look | `research-digest`, `data-story` (already shot as films) |

`new DIR --treatment ID` starts from the treatment's playbook. So does `ingest DIR --markdown report.md --treatment cinematic`.

## 1b. Start somewhere different

Every film directed from the same defaults looks alike. `clearframe muse --seed N` (or `new DIR --seed random`) draws a creative brief: a twist, a motif, camera and cut signatures, a palette and grade, set pieces and a music feel. Every option is one that works. Use it when the user wants something unique, or when a series needs each episode to feel distinct. Record the seed so the draw can be reproduced.

## 2. Write the shot list before the blocks

In `DIRECTION.md`, one line per beat: **scale** (wide, medium, close or insert), **camera** (what moves and why), and **the cut** into the next shot (world move, match cut by shared id, flash, whip, or a cut between two moving cameras). Never three identical scales in a row.

## 3. Build places in depth

For a real place, use generated **depth plates**: an image asset with `layers: true` and `"plates": "ID"` on the canvas. The painted far layer, subject and foreground stand in depth, and the camera moves through them (`gemini-image` skill). About $0.20 a scene; plan first.

Start from set pieces (`clearframe sketch`):
- **Places:** `horizon`, `skyline`, `ocean`, `terrain`, `harbor` (night or dawn), `rooftops`, `citygrid` (aerial).
- **Journeys:** `tunnel`, `road`, `wires`.
- **Data:** `landscape` and `globe` (both need real values); `queue` (waiting, a place in line).
- **People:** `crowd` and `desk`, or an anonymous person as a depth-plate subject.
- **Openings and closings:** `void` (cold open), `signal`, `mast`, `title`, `card` (`sketchText: {LEAD, CARD}`), `pause` (a seam of light).

No set piece should appear in two films of one series; draw the place the story is about.

Beats can name them: `"props": {"sketch": "tunnel"}` and `"sketchText": {"TITLE": "…"}`. Then:
- **Three planes:** `z` on far, middle and near layers, with the near layer soft at the frame edge.
- **A camera that moves for a reason:**
  - `dolly` to enter;
  - a world truck for parallax;
  - `focus.keys` with `say` to rack attention on a word;
  - `camera: {to: [x, y, w, h], say}` to push any block (a chart, a quote) into the detail that matters.
  - A picture on frame one: an opening world's layers sit at `at: 0` with `enter: "none"`; only details animate in. Ambient motion that should run past the cut (traffic, cloud) uses keys with `hold: false`.
  - Long titles take `fit` (the widest the line may be) so they never run off the frame.
- **Light:** `glow` on sources, and `shine` across titles.

## 4. Choose the lens

Set `lens` on the film (any beat can override a key):
- **Drama:** letterbox 2.39.
- **Grade:** match the genre (teal-orange, bleach, warm, cool, noir).
- **Always:** bloom 0.3–0.5 on dark palettes, and `blur: 0.5`.
- **Presence:** handheld 0.15–0.35.

Open the letterbox (`"letterbox": false` on a beat) only for the payoff.

## 5. Give the edit rhythm and sound

- Montage shots get shorter as the payoff approaches.
- Put one silent beat (sketch `pause`, no `vo`) before the title or finding.
- Cut into the payoff with `flash` or `iris`, and end on a button.
- Turn on `sfx`: flash cuts get a hit, the silence gets room tone and a riser into it, and title sweeps shimmer.
- For trailers, `music: {style: "pulse"}` builds to the silence and cuts dead through it.

## 6. Review as film

1. `critique`, then `sheet --draft`, and open it.
2. `render --draft`, then `review DIR` for frames around every cut.
3. Check that each shot lands by its first word (no blank screen under the voice), that no text sits under the bars, and that the camera never moves without a reason. For staged blocks, check the first item's `say`, not only `land`; per-item cues override it. Populate long lead-ins with a scene or restrained atmosphere at `at: 0`, `enter: "none"`.
4. Review every beat longer than 8–10 seconds at its opening, through any TTS pause, and after the reveal. `qa` held warnings are review prompts: slow pushes, noir lighting and deliberate pauses can trigger them. Keep the cinematic rhythm and record intentional holds in DIRECTION.md; never add frantic motion just to clear a threshold.

Ask a fresh reviewer to judge it as film, not slides, against the eight tells in `docs/cinema.md`.

Business and technical films use the `business` treatment by default: film `camera: "none"` (every beat without its own camera, including beats added later), `lens.handheld: 0`, and plates that hold still unless a beat asks. The cinema score does not penalise their reading holds. Whole-frame motion has four independent sources — scene camera, handheld lens, plate drift and the motion inside footage — and `check` warns when they stack (handheld or drift on footage reads as shake). Keep the one move that reveals something. Add handheld only when the brief explicitly calls for that visual language.
