---
name: gemini-image
description: Generate still images with Google's native Gemini image models (Nano Banana 2 — gemini-3.1-flash-image; Lite; Pro) via the Interactions API — depth plates (a painted far layer, cut-out subject and foreground staged in depth), single plates and textures, aspect ratios and sizes, reference images, pricing and prompt recipes. Use for the places a film happens in (depth plates are a regular tool); never for text, numbers, charts, logos or real people.
---

# Gemini image ("Nano Banana 2")

**Use it for places, not for facts.** Generated stills are a regular tool for the world a film happens in: a harbour, a street, a lab, a landscape. The information stays native: text, numbers, charts and labels are never in an image. Code-drawn set pieces cover abstract and data scenes.

## Depth plates (the regular way)

One declaration generates three layers that stand in depth, so the camera moves through painted art with real parallax and focus:

```jsonc
"assets": [{ "id": "harbor", "kind": "image", "layers": true, "size": "1K",
  "prompt": "A small fishing harbour at dusk: a stone quay, moored boats, a lighthouse on the far headland",
  "subject": "A small wooden fishing boat with a yellow wheelhouse, seen from the side",
  "foreground": "A dark stone wall with a bare branch on the left, a weathered railing post on the right" }]
```

On a canvas beat, `"plates": "harbor"` stages the layers:

| Layer | Depth | Contents |
|---|---|---|
| `harbor-far` | z 6 | A full-bleed painting of the setting |
| `harbor-mid` | z 1.2 | The subject, cut out |
| `harbor-near` | z −0.35 | Soft foreground framing, cut out |

A slow push is added unless the beat sets a camera. Add `focus` for depth of field and draw native elements over it.
- **Cut-outs** are generated on chroma green and keyed to transparency, sampling the real key colour from the corners.
- **Describe objects, never scenes, for `subject` and `foreground`.** Given a scene "on green", models paint a framed picture of it.
- **Consistency:** one `continuity.treatment` and `continuity.lighting` for the film, the palette in the prompt (automatic), and `refs` to an earlier plate for a series.
- **Cost:** about $0.20 a scene at 1K, cached by prompt. Run `plan` first and honour the budget.
- **Check** the green `*.green.jpg` beside each cut-out if an edge looks wrong. Regenerate with a more object-like description.

Single stills (a material, a texture, a photo-like plate) are still declared as plain `assets` and used as a beat `plate` or an `image` element.

## Use it

Declare it in the storyboard, then generate:
```jsonc
"assets": [{ "id": "paper", "kind": "image", "size": "2K",
  "prompt": "Macro photograph of layered off-white paper sheets, soft raking window light from the left, gentle shadows, shallow depth of field, calm neutral palette, generous empty space on the right third. No text, no letters, no logos, no people." }]
```
```bash
clearframe plan <dir>      # shows ≈ cost
clearframe images <dir>    # → assets/img/<id>.jpg (+ .json with prompt & model), cached by hash
node skills/gemini-image/scripts/image.mjs --prompt "…" --aspect 16:9 --size 2K --out out.jpg [--ref style.jpg] [--dry-run]
```
Reference it from an `image` block (`"props": {"asset": "paper"}`); add `"drift": true` for a slow push-in and `"fit": "cover"` to fill the frame. Titles stay native text on top of or beside the plate.

## Contract (verified 2026-09-27 against ai.google.dev)

`POST https://generativelanguage.googleapis.com/v1beta/interactions` with header `x-goog-api-key`

```json
{
  "model": "gemini-3.1-flash-image",
  "input": [
    { "type": "text", "text": "…prompt…" },
    { "type": "image", "mime_type": "image/png", "data": "<base64 reference>" }
  ],
  "response_format": { "type": "image", "mime_type": "image/jpeg", "aspect_ratio": "16:9", "image_size": "2K" }
}
```
The response carries `steps[type="model_output"].content[type="image"] = { mime_type, data }`. Text blocks may accompany it, and thought blocks are separate.

- `aspect_ratio`: `1:1 2:3 3:2 3:4 4:3 4:5 5:4 9:16 16:9 21:9` (plus `1:4 4:1 1:8 8:1` on 3.1 Flash).
- `image_size`: `"512"` (3.1 Flash only), `"1K"` (default), `"2K"`, `"4K"`. The K must be uppercase. At 16:9, 2K is 2752×1536, which covers 1080p with room for a slow push.
- Reference images: up to 14 in total. 3.1 Flash accepts up to 10 object and 4 character references. Use one style reference to keep a series consistent.
- All output carries a **SynthID** watermark.
- **Imagen was shut down on the Gemini API (Aug 17 2026).** Don't use `imagen-*`. `gemini-2.5-flash-image` shuts down Oct 2 2026.

| Model | Use | Price per image |
|---|---|---|
| `gemini-3.1-flash-image` (default) | best balance | 512: $0.045 · 1K: $0.067 · 2K: $0.101 · 4K: $0.151 |
| `gemini-3.1-flash-lite-image` | cheapest drafts, 1K only, weak multi-reference | $0.0336 |
| `gemini-3-pro-image` | hardest compositions | 1K/2K: $0.134 · 4K: $0.24 |

## Plates that belong to the film

`clearframe images` sends a composed prompt (recorded in `assets/img/<id>.json`). It starts with your subject, then adds:
- the film's palette and continuity;
- composition hints from how the storyboard uses the image (a `plate` on the left needs its subject away from the seam; a full plate needs calm space where the headline sits);
- a strict no-text rule.

When a beat applies `treatment: duotone` or `tint`, the prompt asks for strong tonal contrast instead of colours, because the renderer recolours the image into the palette. Set `raw: true` on the asset to send your prompt unchanged. Describe the subject, light and mood, and let the plate settings (`side`, `treatment`, `drift`, `focus`) do the layout.

## Prompt recipes (professional register)

Structure: **subject → material and light → palette → composition (where the empty space is) → exclusions.**

- **Texture plate:** "Macro photograph of brushed aluminium with fine linear grain, soft diffused top light, cool neutral greys, even exposure edge to edge. No text, no logos."
- **Editorial illustration:** "Flat editorial illustration of a small paper boat on calm water seen from above, two-colour palette of warm off-white and cobalt blue, lots of negative space, subtle paper texture, minimal shapes. No text, no letters, no people."
- **Place, abstracted:** "Architectural photograph of an empty modern atrium at dawn, long soft shadows, muted warm palette, symmetrical composition, lower third left empty for typography. No people, no signage, no text."
- **Backdrop for a chart:** "Out-of-focus abstract light gradient from deep navy to slate, very low contrast, subtle film grain, no shapes, no text." (Honestly, a CSS gradient usually wins here.)

Always end with the exclusions: `No text, no letters, no numbers, no logos, no people` unless one of them is the point. Name the palette in words matching your theme (e.g. "warm off-white and cobalt").

## Don't

- Don't ask for text, numbers, charts, UI or diagrams. Models garble them, and they carry information that must be exact. Render those in code over the image.
- No real people, brands, logos, documents or screenshots, and no "photos" that could pass as evidence.
- No stock clichés (handshakes, lightbulbs, rockets, chess pieces).
