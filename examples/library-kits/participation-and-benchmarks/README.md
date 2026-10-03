# Participation and benchmarks

Four original fictional cases, each composed separately for landscape and vertical. The [offline preview](preview.html) contains eight native clips with retained sources and evidence.

**Status: prototype.** Source arithmetic, native proportional geometry, encoded probes and independent sampled review are recorded separately. Continuous playback has not been observed; these are not accepted finished-film assets. Square and 4:5 remain unreviewed.

## What the assets explain

- **C05 — full membership:** a field of twelve equal tiles counts how many members meet a stated condition. The next scene shows the same membership by total opening weight. Two positive-return members carry 65% of weight in the first case. In the service case, six of twelve meet the uptime threshold, four do not, and two have missing measurements; the missing members and their weights remain in the denominators.
- **C08 — relative position and separate area:** a fixed signed axis encodes percentage-point difference from a named benchmark. Circle area encodes a separate nonnegative amount. The fund case uses end-period holdings in a sample portfolio; zero means the fund is not held, even though its price return is observed. The service case uses open cases at period end, independently of the period's completion rate. A small cross locates zero size. A missing metric has no endpoint, including when its size is known.

The palette distinguishes categories and above/below the benchmark. It does not label either direction inherently good or bad. All values and dates are fictional. Counts are not weighted means, differences are not ratios, and opening weights are not revised using later returns.

## Edit and reproduce

`inputs.json` holds membership, weights, conditions, observation dates, benchmark values and independent size definitions. `engine/lib/data-transforms.mjs` at the repository root supplies strict algebraic helpers; see the [data contract](../../../docs/data-transforms.md). `source/scenes.mjs` composes native marks and type. `build.mjs` writes all storyboards and an input-hashed `audit.json`.

```sh
node examples/library-kits/participation-and-benchmarks/build.mjs
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node examples/library-kits/participation-and-benchmarks/verify.mjs
/Users/brandon/.local/bin/codex-heavy -- python3 examples/library-kits/participation-and-benchmarks/check-encoded.py
```

Run from the repository root with the existing native setup, after checking disk reserve. There is no Blender or paid-generation dependency. The shared calculations support up to 100 members / 12 benchmark items; the demonstrated compositions deliberately support twelve count tiles and four branches. Recompose and review a different density rather than silently squeezing extra marks into these layouts.

Equal tiles represent one member each. Weighted segments use one common height and the full total weight. Circle radius is `maxRadius × sqrt(size / maxSize)`, and missing observations are never coerced to zero. Quantitative positions and dimensions remain fixed throughout opacity entrances. Keep the original units, independent-size definition, dates and explicit source visible when adapting the clips.

## Evidence and limitations

Read [REVIEW.md](REVIEW.md), [pipeline summary](evidence/summary.json), [encoded proportions](evidence/encoded-proportions.json), and [manifest](kit.json). The manifest hashes source, native clips, receipts, phone/boundary sheets, reviewer frames and reports. Forward and shuffled native seeks compare four phases per scene. Original receipt paths identify this machine; they are provenance, not portable destinations.

The independent checker recomputes category membership, count/weight denominators and signed differences from original inputs. It verifies equal native tile areas, exact rectangle-area fractions, and circle-area ratios derived from the separate size. At 720px width, encoded rectangle edges and circular chords use a 2.5px tolerance; missing endpoints and zero-size markers receive separate checks. It streams all frames but excludes scene boundary half-seconds, early/faint entrances and marks below four pixels. These are bounded probes, not an exhaustive census of painted pixel area or an observed continuous-playback pass. Native math, sampled visual review and finished-film pacing remain distinct claims.
