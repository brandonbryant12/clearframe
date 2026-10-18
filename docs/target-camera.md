# Framing what is drawn: `{on}` and `reveal`

A camera rect can name what it frames instead of giving coordinates.

- **Canvas `view` and `viewFrom`** (and `viewTall`), including world stops, take `{on: ID | [IDs], pad, state}`.
- **A beat's `camera.to`** takes the same form for a push-in.
- **`reveal: {from, pad, state, say|cue|at, dur}`** opens framed on a detail, holds, then pulls back to the whole picture on its word.

```json
{"block": "canvas", "props": {
  "reveal": {"from": "rcpt", "state": "end", "at": 2.4, "dur": 1.6},
  "elements": [{"id": "rcpt", "type": "receipt", "merchant": "City Taxi", "items": [{"name": "Fare", "price": 104}], "total": 104}, "…"]
}}
```

## Exact boxes only

The rect is the named elements' union box, padded by `pad` (a fraction of its size; 0.15 by default) and widened to the frame's aspect around its centre. It is never closer than 4×.

**What has an exact box:**

- rects, circles, ellipses, lines and polygons
- straight-segment paths (a receipt's torn paper)
- images, documents and meters
- groups of these: a receipt, an app, a breakdown's bars, a table cell `tbl-ID-ROW-COL`, a decision card

In a group, text, icons and groups made only of them are the card's content. They sit inside its shapes and are not part of its box.

**What is refused, by name:**

- **Text.** It has no measured box before rendering, so frame the card, row or group it sits in.
- **Inexact shapes.** A curved path, solids and particles.
- **Transformed elements.** An element that is turned, statically scaled, tilted, placed in depth (`z` or `depth`) or moved by a pulse, spin, float, sway, orbit or rock loop; keys that turn or tilt.
- **Groups with any such child.** The child is never quietly left out of the union.
- **Moving targets without a state.** A target that moves (keys or a route) must say `state: "start"` (as authored) or `state: "end"` (where its keys leave it). The end state follows the native pose, where a key's `scale` multiplies its `scaleX` and `scaleY`, and a mirrored box keeps its outer edges. A route, or motion inherited from a group, can only be framed at the start.

## Where it applies

- **World beats** can frame what an earlier beat of the same world drew.
- **`camera.to {on}`** is in frame pixels, so the canvas must have no view of its own, or the identity view `[0, 0, width, height]`; otherwise use `view: {on}` or `reveal`.
- **Neighbouring type in a close-up** may be cut by the frame edge, which the native frame audit reports. Bring the context in as the camera pulls back, as `examples/detail-to-context` does.

Tests: `node --test test/target.test.mjs`. Example: `examples/detail-to-context`.
