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

## 2. Write the shot list before the blocks

In `DIRECTION.md`, one line per beat: **scale** (wide, medium, close or insert), **camera** (what moves and why), and **the cut** into the next shot (world move, match cut by shared id, flash, whip, or a cut between two moving cameras). Never three identical scales in a row.

## 3. Build places in depth

Start from set pieces (`clearframe sketch`):
- **Places:** `horizon`, `skyline`, `ocean`, `terrain`.
- **Journeys:** `tunnel`.
- **Data:** `landscape` and `globe` (both need real values).
- **People:** `crowd`.
- **Openings and closings:** `void` (cold open), `title`, `card`, `pause`.

Beats can name them: `"props": {"sketch": "tunnel"}` and `"sketchText": {"TITLE": "…"}`. Then:
- **Three planes:** `z` on far, middle and near layers, with the near layer soft at the frame edge.
- **A camera that moves for a reason:**
  - `dolly` to enter;
  - a world truck for parallax;
  - `focus.keys` with `say` to rack attention on a word;
  - `camera: {to: [x, y, w, h], say}` to push any block (a chart, a quote) into the detail that matters.
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
3. Check that each shot lands by its first word (no blank screen under the voice), that no text sits under the bars, and that the camera never moves without a reason.

Ask a fresh reviewer to judge it as film, not slides, against the eight tells in `docs/cinema.md`.
