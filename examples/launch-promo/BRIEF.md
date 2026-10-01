# Relay launch promo

An 18-second, music-led launch promo for a fictional product (Relay), built to exercise what the October 2026 motion references showed ClearFrame lacked (see `docs/research/2026-10-opus-motion-references.md`):

- `sunburst`: an event-poster opener, rays turning around a disc.
- `chat`: a conversation played out on a phone that floats and turns in space (`tilt`, `rock`).
- `device`: a browser window swinging in from edge-on over a sky.
- `material: "thermal"`: type painted by a gradient map over its own depth, stripes flowing through it.
- `marquee`: an end card ringed by a line of type that never stops.
- `music.drop`: the bed's drop lands on the `pro` beat; `qa` checks it is heard there.

Everything on screen is illustrative: Relay, its UI and its date are invented for the example.

```sh
node engine/cli.mjs music examples/launch-promo --draft
node engine/cli.mjs render examples/launch-promo --draft
node engine/cli.mjs qa examples/launch-promo
```
