# Blender camera rig

`scripts/blender/camera_rig.py` gives sculpture recipes a deterministic, authored camera. It exposes a pure `path_at(path, phase)` sampler and a Blender `bind(camera, path)` adapter that bakes the path into keyframes with no live handler. Paths run on the `qualitative-pose` clock: phase 0–1, with recipe phase timing deciding elapsed seconds.

## Path versions

- **Version 1 — keyed path.** Two to thirty-two strictly increasing complete keys from phase 0 to 1. `make_path(start, end)` holds the first pose to .16, moves to the end at .74, then holds. Location, target and optics are sampled together; keys that cross the target or the vertical roll pole are rejected.
- **Version 2 — orbit and truck.** `make_orbit(pose, degrees)` rotates the camera's horizontal offset about a fixed target (0.01–170°, analytic angle, fixed radius, height and optics). `make_truck(pose, translation)` moves camera and target together so the relative view stays fixed.
- **Versions 3–4 — chart flight.** `make_chart_flight` weaves between the bars of a flat X/Z chart (2–12 bars) and pulls back to the complete chart, with continuous clearance checks against expanded bar envelopes. Version 4 (`target_policy='bounded-chart'`) stops the look-ahead at the last bar. No chart scene ships with the library: a POV flight through bars reads poorly at video speed, so treat it as a building block, not a finished shot.

## Framing

`fit_perspective(camera, objects, target, safe)` is an opt-in endpoint solver. It keeps authored direction and lens, adjusts distance and lens shift, and uses projected mesh bounds. Landscape and portrait endpoints are solved independently.

The renderer checks camera optics as well as world transforms during declared holds and loop closure, so a fixed matrix cannot hide changing focus, lens or aperture.

Tests: `test/camera-presets.test.mjs`, `test/camera-paths.test.mjs`, `test/chart-flight.test.mjs`.
