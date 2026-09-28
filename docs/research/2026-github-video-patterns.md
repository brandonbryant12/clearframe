# GitHub video patterns adopted — 2026-09-28

The selection favors recent agent-video projects, a concrete benefit to this workflow, an MIT license at a pinned revision, and compatibility with JSON → Node → FFFrames. Repository popularity is discovery evidence, not proof of output quality. No additional renderer, agent framework, Python runtime package or npm runtime dependency was installed.

## Recent projects reviewed

Creation dates and revisions below were checked against the GitHub API on 2026-09-28; root MIT licenses were read at those revisions.

| Project | Created; reviewed revision | Useful idea | ClearFrame result |
|---|---|---|---|
| [browser-use/video-use](https://github.com/browser-use/video-use/tree/b877063835e6ea6e457124da7e28a0ae26691dc3) | 2026-04-12; `b8770638` | Speech-first editing and targeted filmstrips around cuts rather than reviewing random frames | New `review` command extracts actual encoded frames around every scene join and the first/last word in each narrated beat. It checks the MP4 receipt and source hashes before generating the review. |
| [Alisa0808/vox-director](https://github.com/Alisa0808/vox-director/tree/668ec3946fe0139bc985313b15c1a300fca42f94) | 2026-07-10; `668ec394` | Compare one representative scene across looks before committing to a whole film; compose motion locally | New `looks` command renders the same scene/time/media in four palettes. Existing native motion remains deterministic; no hosted service or Pillow renderer is adopted. |
| [gnipbao/story-to-handdrawn-video](https://github.com/gnipbao/story-to-handdrawn-video/tree/198aefa9b298af3a20d3bd757c93433623d38ccd) | 2026-07-21; `198aefa9` | Consistent comparison scenes, reusable visual references, personal and illustrated story use cases | A common palette comparison and new personal/travel/creative playbooks. Reference continuity remains explicit. Its renderer, example imagery, generated lettering and separately licensed style packs are not imported. |
| [scrollmark/showrunner](https://github.com/scrollmark/showrunner/tree/d9f01063d9dc103766757a4ceeb5a67537f788b1) | 2026-03-19; `d9f01063` | Caption phrase grouping can respect pauses and elapsed duration as well as word count | Kinetic `maxWords`, `maxGap` and `maxDuration` define readable phrases around measured word intervals. The implementation is native Rust; its Python/Remotion runtime is not imported. |

These are independently implemented workflow/animation ideas. No source code from these four repositories is redistributed. Local ignored research snapshots include the exact license files and reviewed source paths. A root MIT badge does not establish the license of bundled media or transitive dependencies.

## Native motion vocabulary

[Motion Canvas](https://github.com/motion-canvas/motion-canvas) remains a useful established reference for [cue-based timing](https://motioncanvas.io/docs/time-events/) and staggered sequences. [Manim Community](https://github.com/ManimCommunity/manim) offers a useful visual vocabulary for [progressive creation](https://docs.manim.community/en/stable/reference/manim.animation.creation.Create.html) and [moving emphasis along a path](https://docs.manim.community/en/stable/reference/manim.animation.indication.ShowPassingFlash.html). Their runtime code is not copied or installed.

The native additions are `flow` (staged connected nodes), `cycle` (a continuous loop and moving marker), `icon-grid` (paced symbol compositions) and `breathing` (explicit phase durations with expansion, holds and contraction). These add movement within a scene, beyond whole-scene entrances. Frame time determines every state, including backward seeks.

## Imported assets: MIT only

The one new third-party asset import is a curated set of 24 [Tabler Icons](https://github.com/tabler/tabler-icons/tree/74929e50416e2b7c0abb8368cdc74bdcb2560ab6), revision `74929e50416e2b7c0abb8368cdc74bdcb2560ab6`. The full [MIT license](https://github.com/tabler/tabler-icons/blob/74929e50416e2b7c0abb8368cdc74bdcb2560ab6/LICENSE), original SVG bytes, source URLs, alias mapping and SHA256 values are bundled under `fframes/assets/icons/tabler/`. No brand marks were selected.

`fframes/native/tools/generate-icons.py` checks the manifest and produces trusted native path geometry. Run it after an intentional asset update, then build/test. Icons inherit the palette accent. `clearframe icons` lists supported aliases. Rendering makes no network request.

The provisional Lucide selection was removed because ISC/mixed licensing does not meet the user's MIT-only requirement. HyperFrames (Apache-2.0) and Remotion's commercial-license runtime were excluded from imports. Future GitHub code and assets must have an MIT license at the exact revision, with required notices retained; investigate nested asset licenses separately.

This policy governs new GitHub imports. It is not a claim that the existing entire toolchain is MIT: bundled Inter fonts retain their OFL notice, and native codecs/system libraries retain their own licenses.

## Review loop

```sh
node engine/cli.mjs new lesson --playbook science-lesson --theme signal
node engine/cli.mjs voice lesson --draft
node engine/cli.mjs looks lesson --beat flow --draft
node engine/cli.mjs sheet lesson --draft
node engine/cli.mjs check lesson --draft
node engine/cli.mjs render lesson --draft
node engine/cli.mjs review lesson
```

`looks.png.json` records the palette order and comparison time. `review` creates an offline HTML filmstrip plus a JSON frame manifest. Its labels are review metadata, never baked into the film. Visual inspection and listening remain necessary; a generated review page is not an automatic quality approval. `--beat ID` narrows a long film's review, and `--video PATH` selects a custom rendered output with its matching receipt.
