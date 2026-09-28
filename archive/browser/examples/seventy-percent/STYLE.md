# STYLE.md: Seventy percent is not a promise

Every scene builder reads this before touching `scenes/*.js`. It keeps parallel work looking like one film.

## The film in one line
A 70% forecast means 3 in 10 go the other way. Judge forecasts by calibration, and plan for the thirty.

## Motif
**The 70/30 split.** It appears first as a number, then as 10 tiles (7 ink, 3 cobalt), then as a 10×10 grid (70 ink, 30 cobalt), then as a point on a calibration chart, and finally as "the 30" in the question. **Cobalt always means "the thirty": the outcomes that don't go to plan.** Nothing else is cobalt except the progress rail and the one highlighted word per scene.

## Look
- Theme `paper`: warm off-white field, ink `#1c1f24`, cobalt accent `#2e5bda`, rust `--down` only for the overconfident curve.
- Texture is a dot grid (56 px, drifting 4/2 px/s), grain and a soft vignette. It should be felt, not seen.
- Chrome: chapter label top-left, `0n / 05` top-right, hairline progress rail on the top edge. It never changes design.

## Type
- Statements and big numbers use Instrument Serif, 110–440 px, with tight tracking. Italic serif for the human word ("not").
- Labels and stats use Inter 600 with tabular figures for anything that counts.
- Kickers and sources use JetBrains Mono, uppercase, 24 px.
- No scene shows more than 12 words of body text at once.

## Motion
- Entrances use `power3.out`, 0.5–0.6 s, a 10–24 px rise. Exits use `power2.in`, 0.3 s.
- Exactly **one** snap per film: the hero "70%" (masked chars, `expo.out`).
- Every reveal lands on its spoken word via `b.say()`. Start 0.1–0.15 s early.
- Camera drift ≤ 2.5% per scene. There are no bounces on text; `back.out` is for dots only.
- Transitions: `fade` between chapters 1→2 and 3→4, and `rise` for 2→3 and 4→5, all 0.5–0.7 s.

## Do / don't
- **Do** dim context when the story moves (opacity 0.35–0.45).
- **Do** keep the grid, chart and tiles left-aligned in a two-column layout; centre only single statements.
- **Don't** add icons, emoji, gradients, glows or extra colours.
- **Don't** introduce any figure not listed in `storyboard.sources`.
