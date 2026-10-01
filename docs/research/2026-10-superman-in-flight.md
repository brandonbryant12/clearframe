# Superman in Flight: one subject, twenty processes (October 2026)

A poster film shared as a claude.ai artifact: twenty square plates, each a period art process (petroglyph, tomb painting, mosaic, stained glass, illuminated initial, proportion study, silhouette, ukiyo-e, sampler, letterpress bill, constructivism, art deco, Golden Age newsprint, neon, silkscreen, line printer, handheld LCD, low poly, stencil, embroidered patch). The poster unfolds into a strip, one figure flies through every plate and changes style at each border on a 150 BPM downbeat, then the strip folds back into the poster. Every plate is drawn in code from a shared puppet rig; nothing is an image.

We read it for ideas only. No code or artwork was copied: its licence is unknown, and ClearFrame renders native vector frames in Rust, not Canvas 2D.

## What we took

| Idea in the film | In ClearFrame |
|---|---|
| A process is the style. The Golden Age plate prints flat process colours off register under a brush-black key plate, with Ben-Day dot tints and newsprint wear. The strongman bill is two plates apart with ink dropout; constructivism screens a shaded figure into a 45° halftone | `print` (canvas.rs, canvas_print.rs): a vector dot or line screen sized by tone, the colour plate offset from the stroke (`register`), worn ink in patches (`wear`). Presets `benday`, `halftone`, `engraving`, `newsprint`, `letterpress` |
| Halftone from a picture's tone | On images and plates the screen samples the decoded pixels per cell (`treatment: halftone \| engraving`) |
| Cross-stitch sampler and handheld LCD on a fixed grid | Mosaic `style: stitch \| pixel`: one grid anchored at the canvas origin, edge cells outlined, pixel-perfect strokes |
| Era palettes (Prussian blue on washi; red, black and cream; navy and gold; four greens; process colours on newsprint; the cream catalogue) | Palettes `woodblock`, `constructivist`, `deco`, `lcd`, `newsprint`, `gallery`, with treatments that state each era's rules |
| One subject crossing a strip of plates, bookended by the whole sheet | The `style-relay` playbook: a world of six plates walked as a snake, with a bird crossing each plate in its own process, opening and closing on the sheet |
| Museum captions: a number in italic serif, the name in tracked caps, one italic line of date and place | The plate captions in `style-relay` and the `gallery` treatment's rules |

## What we already had or left out

- **The camera.** It zooms geometrically and moves its centre in step with 1/z. `travel` in canvas.rs already zooms in log space about the point both views share.
- **Contour-following mosaic (andamento).** This already existed as `flow: contour`.
- **Border crossings on the downbeat with a small punch-in.** This is left to authoring: equal plates and beats, the music set so a plate is a bar.
- **Left out:** stained glass, embroidery satin stitch, ASCII glyph picking, low-poly rendering, spray stencils and the puppet rig. Each is a separate renderer project, and none serves explainers often enough yet. They are candidates if a film needs one.
