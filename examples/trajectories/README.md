# From a human brief to a reviewable film

These trajectories exercise the public CLI with complete films, concrete review decisions and retained revisions. Replay time is not original research or creative authoring time. They use the existing native renderer and local synthetic narration; no paid generation.

| Trajectory | Material and visual decision | Replay |
| --- | --- | --- |
| Fictional Foldwork studio | Supplied SVG, PNG, brand colours and approved copy; an original paper workshop, revised to remove half the middle objects | `node scripts/trajectories/workshop.mjs NEW-DIR --phase initial`, inspect, then `--phase revised` |
| Coca-Cola Q2 2026 | Official earnings release, corporate SVG and product photography; brand opening, revenue mechanism, separate volume and GAAP/non-GAAP results | `node scripts/trajectories/coca-cola.mjs NEW-DIR --phase initial`, inspect, then `--phase revised` and `--phase final` |
| Five-session S&P update | Frozen daily closes, bond rates and ADP/ISM releases; a zero-centred return trace and dated evidence inserts | `node scripts/trajectories/sp500.mjs EVIDENCE-DIR --phase initial`, inspect, then `--phase revised` and `--phase final` |

The S&P script expects a retained `source-kit/` containing `facts.json`, the exact hashed source files listed inside it, and `research.md`. It is a replay of a dated editorial case, not a live market fetcher. The Coca-Cola script fetches official source/asset URLs on first use and retains hashes. Real company assets remain in the evidence folder; they are not bundled into this repository as licensed artwork.

Each approach records the story, picture and pace, and considers alternatives before authoring original canvas scenes. The reusable library is a starting vocabulary. These films do not require a new fixed template per client.

Pipeline reports establish mechanical checks. Source review and inspected sheets are separate evidence. Approximate captions carry `.rough` names. Full playback, listening and human acceptance must be stated independently.
