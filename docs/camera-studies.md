# Authored camera studies

Three original Blender recipes make the point of view part of an explanation. `linked-system` moves from a control junction to its connections. `hero-field` pulls back from an amber marker to its surrounding field. `focus-depth` holds the camera still while shifting focus from a near surface to a deeper structure. Their geometry, apparent size, marker count and timing are qualitative; they are not measured data.

The [camera-studies kit](../examples/library-kits/camera-studies/README.md) pairs each recipe with two editable explanatory subjects in separately fitted landscape and portrait layouts. Native caption bands keep claims and qualifications sharp throughout the camera move. A final two-second static clip extends the source hold without restarting the scene. The kit remains a prototype pending continuous subjective playback and master review. Stable close-up grain on the field markers is tracked for the master surface-quality pass.

## Deterministic camera path

`scripts/blender/camera_rig.py` exposes a pure `path_at(path, phase)` sampler and a Blender `bind(camera, path)` adapter. Version 1 uses the `qualitative-pose` clock and two to thirty-two strictly increasing complete keys spanning phase zero through one. Each key declares location, target, focal length, orthographic scale, horizontal/vertical shift, focus distance, aperture and incoming `linear` or `smooth` easing. Projection and depth-of-field enablement are fixed for the path. This is an internal trusted-recipe contract, not a new storyboard field or cross-renderer camera interchange format.

`make_path(start, end)` holds the first pose to phase .16, moves to the end at .74, then holds it. Recipe phase timing determines elapsed time. Locations, targets and optics are sampled together; keys that cross the camera target or the vertical roll pole are rejected. A named target point is explicit, not inferred from a mesh. The adapter bakes every source frame plus the endpoint; saved scenes require no Python handlers or auto-execution.

The renderer now checks camera optics as well as world transforms during declared holds and loop closure. A fixed camera matrix cannot hide changing focus, lens, scale or aperture. These checks do not prove materials, particles or arbitrary shader animation are static.

## Framing and evidence boundaries

`fit_perspective(camera, objects, target, safe)` is an opt-in endpoint solver. It preserves authored direction and lens, adjusts distance and lens shift, and uses Blender's projected mesh bounds. Landscape and portrait endpoints are solved independently. It does not preserve apparent quantitative scale, avoid collisions or prove visibility. An opening can intentionally crop surrounding context; the selected hero must remain within its declared safe region, and the ending system must fit.

The kit's separate checker compares all baked frame poses to the retained path, tests static noncamera geometry, checks hero bounds throughout and complete mesh/curve bounds in the final hold, then revisits frames out of order. The two pullbacks retain constant focal length; the focus study changes only focus distance. Encoded focus and hold probes, saved-scene replay and an independent sampled review supplement those geometric checks. Exact scope, hashes and results belong to the retained evidence, not these general APIs.

Not implemented here: a camera chase, explosion focus chase, perspective matching of measured charts, collision avoidance, automatic arbitrary-ratio reframing, or a portable pose contract shared with the native compositor. The existing native `world`, `dolly` and `focus` tools remain available for native scenes.
