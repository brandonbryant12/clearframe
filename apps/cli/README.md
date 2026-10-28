# ClearFrame

ClearFrame creates agent-directed motion graphics with a native Skia renderer. The CLI provides storyboard authoring, measured narration timing, native rendering, review records and a local browser studio.

The package contains the compiled TypeScript runtime, bundled creative library, authoring guides and native renderer sources. Rust remains the frame renderer; Effect manages runtime validation and scoped orchestration.

## Requirements

Node 22.19+ (23.x requires 23.4+), Rust 1.88+, and FFmpeg/ffprobe with libx264 are required. Native rendering is verified on Apple Silicon with Metal and the Xcode command-line tools.

```sh
npm install clearframe
npx clearframe doctor
npx clearframe new my-film --playbook data-story --treatment editorial
npx clearframe draft my-film
```

The first native build downloads the pinned renderer dependencies. Native builds use one Cargo job; the reusable cache lives at `~/.cache/clearframe/scene`, with `CLEARFRAME_SCENE_CACHE` available for an explicit location.

Sound cues and learned voice rates share `~/.cache/clearframe`. Set `CLEARFRAME_CACHE` to relocate the common cache root. Generated evidence stays in the project or the current working directory's `build/` folder.

## Local execution API

```js
import { createJobHarness } from 'clearframe/harness';
import { setTimeout } from 'node:timers/promises';

const harness = createJobHarness({ base: process.cwd() });
try {
  const job = harness.start('./my-film', {
    film: 'my-film',
    kind: 'captions',
    requestKey: 'captions:revision-1',
  });
  let state;
  do {
    await setTimeout(100);
    state = harness.get(job.id);
  } while (['queued', 'waiting', 'running'].includes(state.status));
  console.log(state.status, harness.events({ jobId: job.id }));
} finally {
  await harness.stopAll();
}
```

Requests are decoded at `start`; a refusal is a `HarnessRequestError` with a `reason` and `status`. `clearframe/contracts` exports the same request, view, event and verdict schemas (and their types) with only `effect` as a dependency, and `clearframe capabilities --json` prints every operation with its JSON Schema and lifecycle rules for an agent framework in any language.

SQLite retains job history and durable request keys. Recovery records unfinished work as interrupted and requires a new deliberate request to execute it again. Paid media generation requires content-bound approval. See the bundled [harness contract](dist/runtime/docs/agent-harness.md) and [native setup](dist/runtime/film/SETUP.md).
