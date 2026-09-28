# ClearFrame × FFFrames

An independent Rust/SVG rendering experiment beside ClearFrame's HTML/GSAP engine.
The story, narration and Google media tools stay shared; the visual renderer changes.

**Start with [SETUP.md](SETUP.md).** The native dependencies are not installed by this
directory. See [STATUS.md](STATUS.md) for exactly what has been verified on this Mac.

```text
storyboard + fframes.json + recorded narration + fonts
                         │
                       prepare
                         │
        frozen bundle: timing + captions + shared mix + hashes
                  ┌──────┴───────┐
           browser/             native/
         HTML + GSAP          Rust + SVG
         Chrome → ffmpeg       Skia/Metal → libav
                  └──────┬───────┘
                  finish + measure
             same audio, verified frame counts
```

| Resource | Purpose |
|---|---|
| [DESIGN.md](DESIGN.md) | Analysis of the existing skills and what changes for Rust |
| [EVALUATION.md](EVALUATION.md) | Fair quality/time comparison and limitations |
| [Agent skill](../skills/clearframe-fframes/SKILL.md) | How an agent should use this path |
| [examples/paired](examples/paired) | One storyboard with matched JS and native layouts |
| [template](template) | Cargo project copied by `prepare`; edit the generated `src/lib.rs` |
| [cli.mjs](cli.mjs) | Doctor, frozen inputs, integrity checks, finishing, timing reports |
| [upstream.json](upstream.json) | Reviewed and pinned FFFrames revision |

The starter supports two native layouts (statement, three bars measured in hours), an
even-sized 16:9 canvas, integer frame rates, narration and a shared music mix. It is **not
a compatibility layer for the 33 JS blocks**. Existing films remain in their original
directories. Media plates, transitions, native burned captions, vertical layouts and
live native preview need further native authoring. Unsupported starter features fail
instead of silently disappearing.

FFFrames itself is [Rust/SVG with a GPU renderer](https://fframes.studio/). Its upstream
skill includes authoring, diagnostics, PNG review, video export and a native player.
We use its CLI and Metal backend, retain ClearFrame's creative rules, and keep the
native player out of the starter dependency graph. The FFFrames revision and tested
transitive Rust dependencies are pinned in the template's `Cargo.lock`; use `--locked`.

No Google API call is made by this adapter. `prepare` reuses existing ClearFrame audio
mixing; a new Google integration would duplicate cost, caching and timing logic.
