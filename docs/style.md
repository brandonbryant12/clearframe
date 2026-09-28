# Colors, motion and graphic variety

A consistent visual language can still contain many distinct forms. Start with the content: a comparison needs aligned bars; a process needs steps; speech needs readable timed words. Use the 26-block catalog, then choose the treatment.

```json
{
  "theme": {
    "base": "ink",
    "bg": "#101721",
    "surface": "#1d2938",
    "ink": "#f4f4ed",
    "muted": "#a4b2c4",
    "accent": "#d6acff"
  },
  "motion": { "preset": "gentle", "intensity": 0.65 },
  "transition": "fade",
  "backdrop": "none",
  "captions": false
}
```

Presets: `paper`, `ink`, `editorial`, `signal`. Override any of `bg`, `surface`, `ink`, `muted`, `accent`, `positive`, `negative` using six-digit hex. Current charts use a single accent; positive/negative tokens are reserved for explicitly semantic styling. The checker flags low text contrast when colors are overridden; review it at delivery size. Color alone must not carry the meaning.

Motion presets: `gentle`, `snappy`, `spring`; intensity 0–1. Count and chart progress stays monotonic. Entrances: `cut`, `fade`, `rise`, `wipe`, `push`, `zoom`, selectable globally or per beat. These reveal a scene over the persistent background; they do not cross-dissolve two simultaneously visible scenes. Backdrops: `none`, `dots`, `grid`. `chrome: true` adds lightweight progress chrome.

Use `props.land`, `growSay`, `drawSay`, item `say` and bar `focus.say` for spoken cues or local seconds. Exact word matching rejects missing cues. Set focus `dim` (0–1) and `dur` (seconds) explicitly when the context needs a softer focus. Preserve readable units and sources through motion.

Keep copy short and inspect every layout at delivery size. Long text wraps using bundled Inter metrics; text that still exceeds its box at the minimum size fails with a scene-specific error. Shorten the copy or divide it into more scenes. A title is a headline, not a transcript. Use kinetic text or multiple beats for extended speech. `gallery` is a fast visual vocabulary review; `still --beat ID` is useful for checking details.

## Motion within a scene

`icon-grid` stages one to eight MIT Tabler icons with labels and optional details. Run `icons` for the 24 supported aliases. `flow` draws connections through two to six nodes; `say` can anchor a node to speech and `stagger` sets the default spacing. Portrait flows stack vertically. `cycle` arranges three to six nodes around a continuous path, with configurable period and direction.

`breathing` uses explicit `{label,seconds,scale}` phases, where scale is `expand`, `hold` or `contract`. `minScale` and `maxScale` bound its radius, and `ring` toggles the fixed guide. A 28-second beat can show four repetitions of a 3-second expansion and 4-second contraction. Adapt the pace to the intended viewer; do not infer health benefits.

Use `looks DIR --beat ID --draft` for a four-palette comparison of the exact same frame. Tiles are paper, ink, editorial and signal, left to right, top to bottom; the sidecar records this. Real/generated images retain their original colors. Run `review DIR` after rendering to inspect the encoded cut and word boundaries.

Scene counters are removed from output, including when `chrome: true`; optional chrome now consists only of the film title and progress rail. New projects explicitly set `chrome: false`.

For dense icon/flow scenes, automatic stagger spacing compresses to leave the entrance and a short reading hold before the final frame. Explicit spoken/numeric cues retain their time; a cue too late to finish the entrance fails with an actionable error. Extend the beat instead of silently hiding its last items.
