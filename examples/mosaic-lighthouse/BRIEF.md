# Mosaic lighthouse: a film laid in tesserae

A 17-second square film that shows the mosaic look. It was inspired by the code-drawn mosaic films people have made with Opus, but it is an original scene: a lighthouse in an arched niche.

- **The `mosaic` treatment.** The mosaic palette (ultramarine, ivory, gold, coral, turquoise), the tiled `backdrop: "mosaic"`, gentle motion and word-by-word type.
- **Andamento follows the form.** The niche and the sea are laid in running-bond rows (their gradients sampled per tile), the moon in concentric rings. Outline rows trace the tower. Waves and the double border are beaded lines of tiles.
- **Tiles move.** Shapes build with `enter: assemble` and the boat leaves with `exit: scatter`, then reassembles further along. The lamp and moon use `glow`. The beam is a translucent mosaic with `grout: "none"` that sways.
- **One world.** Four beats share `world: "bay"`: the camera pushes into the lamp as the light comes on, then pulls back.

Regenerate with `python3 make.py`. Then run `node engine/cli.mjs draft DIR` from the repository root with this folder as DIR.
