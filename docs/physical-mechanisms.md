# Reservoirs, queues and copy-safe framing

The original `reservoir-transfer` and `conveyor-bypass` sculpture recipes expand the qualitative mechanism library. The [physical-mechanisms kit](../examples/library-kits/physical-mechanisms/README.md) retains separate landscape/portrait clips, editable scenes, source receipts, baked-geometry checks and native explanatory examples.

`reservoir-transfer` stages a gate opening, level redistribution, gate closing and settled hold. Transparent panels expose analytic fill volumes; equal chamber floor areas and the interpolated connection keep the authored volume constant. The gate is fully clear before transfer and closes only after equalization. These are geometric safeguards for an illustration, not a fluid simulation or measured balances. Exact money or volume belongs in native charts.

`conveyor-bypass` stages incoming packets, a queue, an alternate gate opening, passage around a narrow main neck and a settled hold. Tokens share one path-distance clock, with circular footprints spaced clear of one another even around corners. Their count, speed and delay do not encode throughput or latency. The route is a deterministic illustration; it does not model conveyor forces or a network scheduler.

Both default to eight seconds at 24 fps and are one-way operations. Their named phases work with [the timing contract](motion-phases.md), including `--phase-seconds`. New timings require new mechanical and visual review. The same clip can support different explanatory subjects without baking text into the object.

## Explicit camera space

The Blender helper `artkit.fit_camera(camera, objects, safe)` is opt-in for fixed orthographic cameras. `safe` is `[left, bottom, right, top]` in normalized camera coordinates. It computes projected object bounding boxes, adjusts the orthographic scale, and translates the camera parallel to its image plane. It leaves the authored view direction intact. It is intended for the studio camera's automatic sensor fit; verify any different optical setup before use.

The caller must provide geometry enclosing **all** animated extents. Initial fitting is not full motion verification. These two recipes use their frame/plinth geometry to enclose their motion, then the retained checker verifies every subject's projected bounding box at every baked frame, including the unencoded endpoint. It excludes the huge background stage and lights. Future recipes must repeat that check, especially if moving beyond their initial bounds.

The current landscape safe rectangle is `[0.08,0.15,0.92,0.76]`; portrait uses `[0.08,0.20,0.92,0.76]`. Native headings and phase captions sit above the subject region; attribution sits below. Normalized camera Y runs bottom to top, while native canvas Y runs top to bottom. The receipt records the exact subject names, initial bounds and rectangle. These frames are composition examples, not a universal crop preset.

Framing does not prove that all parts are visible. Independent encoded review still checks token occlusion, contact points, material contrast and phone-size legibility. This is a fixed-camera M07 foundation. Moving camera paths, a perspective-to-measurement match and automatic chase cameras remain separate work.

## Evidence and reproduction

Use `sculpture ID --draft --still --out NEW-DIR` before motion. The kit's `build-media.mjs` renders one clip at a time, checks its encoded geometry and saved-scene reproduction, inspects the actual baked scene, and copies a compact hash-verified asset. Its optional `--prune-frames` removes only new raw PNG intermediates after the compact sources, scene and encoded clip are verified. It keeps the retained evidence. Run it through the shared resource gate and retain at least 20 GiB free.

`check-mechanisms.py` verifies projected bounds and internal geometry at every baked frame. For the reservoir it checks positive fill heights, common floors, conserved volume, gate clearance, equalization before closure and a connected stem. For the conveyor it checks packet separation, clearance from the fixed neck/guides, gate clearance while crossing and distinct final packet positions. These are bounded checks on the current two rigs, not a general collision solver.

The kit's native builder reads each clip's resolved phase times to place editable captions. At 30 fps the caption transition lands on the next available native frame; the prepared clip has 24 fps. This is authored source-phase alignment, not measured speech or transit time. An explicit second beat holds a static clip losslessly encoded from source frame 191 for two seconds. It does not depend on an exhausted clip freezing automatically. Encoded subject-region checks compare the final source hold, the cut and all 60 static-hold frames for a restart or color jump. Hashes tie each storyboard to its exact clip and input labels.

Draft encoded fixtures and native compositions remain prototypes pending continuous subjective playback and final master review. A source check, closed loop, conserved volume or clean bounding box does not establish finished-film acceptance.
