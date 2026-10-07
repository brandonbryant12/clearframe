# Dither light: a 1-bit product shot

A 7-second study of the `dither` material. A small product, a sphere and a plinth stand on a native stage, each lit in two palette inks by an ordered (Bayer 4×4) dither under a soft light that drifts across them, on a dithered ground. The name and line are native type. It was curated by hand to demonstrate the material; it is not agent output, and "Pocket" is a made-up product.

**What it feels like:** a handheld game's product shot. It is retro and tactile, but with real light and shade, so a pixel look reads as crafted, not cheap.

**Ideas it helps show:**

- a product or object reveal for a game, developer or nostalgic audience;
- a pixel-look film's hero shot;
- "simple by design".

The beat is a `stage`, and each shape takes the material:

```json
{ "type": "rect", "x": 1200, "y": 300, "w": 280, "h": 470, "r": 40, "fill": "bg",
  "material": { "name": "dither", "colors": ["bg", "accent2"], "scale": 1.2, "speed": 0.6 } }
```

The material's settings:

- **`colors`:** `[lit, shadow]`, two palette tokens.
- **`scale`:** the cell size (6 px at 1).
- **`amount`:** how far the light reaches.
- **`speed`:** how fast the light drifts (`0` holds it).

The stage's `ground` takes the same material; give it `opacity: 1` for a solid backdrop. It is drawn natively on stages, and canvas shapes keep `mosaic` and `print` for their craft looks. On the `lcd` palette it reads like a 1989 handheld. On `ink` or `noir` it reads as a two-tone print.

At phone size the cells blend into tone, which is the intent. Check the 360 px sheet (`qa DIR`) if the cells must stay visible, and raise `scale`.

## Make it

```sh
node examples/dither-light/build.mjs     # writes storyboard-{landscape,vertical}.json
mkdir -p build/dither && cp examples/dither-light/storyboard-vertical.json build/dither/storyboard.json
node engine/cli.mjs draft build/dither    # free local draft voice
```

Each shape is 248 frames, under 3 s to render on this Mac, and `check` reports 0 errors and 0 warnings.

Find it with `node engine/cli.mjs find "retro pixel product reveal with light"`, or `find --id mechanism:dither-light`.
