# ClearFrame's local agent harness

ClearFrame's harness gives directors a stable boundary for running native production work: submit a job, inspect its state and evidence, and cancel it. The browser studio and its OpenCode agent use the same production commands. A future director can use this boundary without replacing the renderer or taking ownership of the film's editorial records.

The first durable slice is the existing studio job queue. SQLite stores local job state and lifecycle events; Effect provides runtime decoding, structured errors and scoped services for the ledger, process runner and agent boundary. Storyboards, source media, revisions, decisions and render receipts keep their existing project formats. The pipeline's rendered and checked artifacts remain the evidence for a film.

## Ownership

| Responsibility | Owner |
| --- | --- |
| Conversation, selected model and provider credentials | The existing OpenCode runtime, isolated under the studio state directory |
| Film instructions, storyboard edits and approval scope | ClearFrame's validated tools and project records |
| Job admission, lifecycle and local recovery history | The local harness and SQLite ledger |
| Frame drawing | The scene engine, using prepared inputs and a frame number |
| Frame scheduling and encoding | The pinned fframes runtime |
| Render identity, audio finishing and output checks | ClearFrame's existing production pipeline and receipts |
| Human acceptance | The named person's recorded review decision |

A completed process is not a human acceptance decision. A persisted job is not a resumable renderer checkpoint. A conversation continuing after restart does not prove that its last tool completed.

## Durable job contract

The public `createJobHarness` export from `clearframe/harness` (`packages/engine/src/engine/harness.mts`) is independent of a model provider. The studio's `createStudioJobs` entry point remains a compatibility wrapper. The adapter retains its existing request validation, sound approval checks, preview cache and native CLI execution.

| Operation | Contract |
| --- | --- |
| `start(dir, body)` | Submit the existing production request; an optional `body.requestKey` identifies a retry of the same request |
| `get(id)` | Read one job, including history outside the recent-job view |
| `health()` | Read whether the harness can admit work, including a persistence failure |
| `list(film)` | Read the studio's recent job views, optionally for one film |
| `events({ after, jobId, limit })` | Read lifecycle events after a cursor, optionally restricted to one job |
| `cancel(id)` | Record cancellation intent and stop queued or executing work |
| `pausing(dir)` | Find work that currently pauses edits to the project |
| `stopAll()` | Stop children and close the ledger; await shutdown before releasing the caller's resources |

Repeating a request key with the same request returns its existing job. Reusing that key for a different request is refused. A new intentional run needs a new key. A key is a local admission identity, not a provider's guarantee that a paid operation ran exactly once.

The default ledger is `out/studio/.harness/jobs.sqlite`, where `out` is the viewer output directory. Its hidden directory is not served by the studio's static-file handler. SQLite uses WAL and a versioned schema. Startup migrates supported schemas and refuses a newer unsupported schema or corrupt store. Existing `out/studio/jobs.json` history is imported once and the original file is retained. The database keeps history independently of the studio's recent-job view, which retains the last 60 finished jobs by default.

Admission persists a job and the supervisor PID before opening the worker, then persists the worker PID before allowing the production command to start. This handshake also covers gates that start the worker in a separate process session. Each lifecycle transition records the resulting state and its event together. An unreadable or unwritable ledger must surface an error; it must not silently admit work with memory-only state.

One local scheduler owns a ledger at a time. Ownership applies to viewers started without an agent as well as viewers with OpenCode enabled. Startup also refuses to take over while a recorded child process is still alive. On recovery, unfinished jobs become explicitly interrupted. They are not reported as successful because an old output exists, and they are not automatically executed again. Partial outputs remain available for investigation.

This ownership boundary is local to one ledger. It does not coordinate independent output directories or hosts editing the same film.

Cancellation attempts to record intent before signaling the child. If that write fails, it still stops the child and returns `persistenceError`; new work remains refused until the store is repaired and the harness restarted. The child process group includes its renderer and encoder; final status follows observed termination. An interrupted job and a cancelled job are different outcomes.

The studio exposes the same event cursor at `GET /api/studio/jobs/events?after=0&jobId=ID`. `GET /api/studio/jobs` includes harness health; a failed ledger returns HTTP 503 with the error and health state.

Requests still pin their inputs when execution starts. ClearFrame's receipt and input checks determine whether an output belongs to the current film. SQLite records orchestration state; it does not replace the output hash, prepared-input identity or QA evidence.

Paid narration and music keep their content-bound approval and budget checks. Recovery never grants new spending authority or automatically repeats a potentially completed provider call. The person can inspect the existing take or artifact before submitting another request.

## Runtime and Effect scope

The harness requires Node.js 22.19 or newer (23.x requires 23.4+) to satisfy the HTTP runtime dependencies, and uses the built-in `node:sqlite` `DatabaseSync` API. No separate SQLite native add-on is needed. The [Node 22.19 SQLite documentation](https://nodejs.org/download/release/v22.19.0/docs/api/sqlite.html) describes the synchronous connection and prepared-statement APIs used at this boundary.

Effect is pinned to `4.0.1`, matching the exact peer version required by the installed OpenCode packages. It supplies schema validation, structured operation errors and scoped resource management for the ledger, process runner and agent integration. This is a deliberate compatibility pin rather than a claim that this is the latest Effect release. Native frame evaluation and existing production commands keep their current execution paths.

The official Effect SQLite Node adapter is a possible later consolidation, not a requirement for this slice. Its [documented Node floor is 22.16](https://github.com/Effect-TS/effect/blob/main/packages/sql/sqlite-node/README.md), because it imports `sqlite.backup()`. A future switch must preserve stored-schema compatibility, transaction behavior and the public job contract; changing a library does not supply recovery semantics by itself.

The optional `jobHarness(options)` export acquires the queue in an Effect scope and waits for child shutdown and ledger closure during finalization. Acquisition and store operations use tagged errors. Like other Effect scope finalizers, an unrecoverable release failure is a defect available through the full cause; it is not silently discarded.

```js
import { createJobHarness } from 'clearframe/harness';
import { setTimeout } from 'node:timers/promises';

const harness = createJobHarness({ base: process.cwd() });
try {
  const { id } = harness.start('./film', {
    film: 'film', kind: 'captions', requestKey: 'captions:revision-1',
  });
  let job;
  do {
    await setTimeout(100);
    job = harness.get(id);
  } while (['queued', 'waiting', 'running'].includes(job.status));
  console.log(job.status, harness.events({ jobId: id }));
} finally {
  await harness.stopAll();
}
```

## ADK decision

ADK provides a useful architectural reference: sessions retain conversation events and state, while resumability has a separate execution contract. Its [session service documentation](https://adk.dev/sessions/session/) supports persistent database-backed sessions. Its [resume documentation](https://adk.dev/runtime/resume/) requires explicit resumability configuration, requires custom agents to define checkpoints, and warns that tools can execute more than once after recovery.

The relevant lesson for ClearFrame is to separate conversation identity, invocation identity, persisted job state and artifact identity. A rendering tool needs its own repeat-execution and output-reconciliation policy even when an agent framework can resume its conversation.

ADK is a reference rather than an imported dependency here. Its [Apache-2.0 source license](https://github.com/google/adk-python/blob/main/LICENSE) is outside this project's current MIT-only import policy. Effect's [license at the pinned release](https://github.com/Effect-TS/effect/blob/effect%404.0.1/LICENSE) is MIT. No ADK, HyperFrames or Remotion source is copied into the harness.

## Recovery verification

The local contract should be exercised through the actual studio queue as well as the ledger:

- Finish a harmless local job, reopen the ledger, and find the same job identity and terminal state.
- Stop a process with work queued or running; reopening must expose interruption without launching a replacement child.
- Attempt to start a second scheduler against the same ledger; it must not claim the first scheduler's jobs or overwrite their state.
- Leave a child alive after its owner exits; another scheduler must refuse takeover while that child is alive.
- Fail persistence during admission; no production child may start.
- Repeat an identical request key across restarts; return the original job, and reject a different request with that key.
- Cancel queued and running work; retain the cancellation intent and observe child termination.
- Recover legacy history once, preserving job identities and exposing malformed records instead of silently losing them.
- Present an old output from a different request; its existence must not complete the new job.
- Recover a paid sound request without another provider call or a new spend grant.

These are acceptance criteria for this boundary. Current test results belong in the change's validation record; the criteria do not imply that every failure scenario has already been exercised.

## Next boundaries

The next useful migration is an explicit pipeline checkpoint contract: record each stage's input identity, completed result and artifact hash before deciding whether it may be reused. Delivery should be recoverable from an existing valid render without generating the film again. A failure after generation but before delivery needs a delivery retry, not another paid generation.

Content Studio integration remains a later adapter. It should supply its own identity, authorization, retained-output ownership and storage lifecycle, then call the same ClearFrame production boundary. This local ledger establishes neither hosted GPU support nor Linux performance, multi-host coordination, tenant isolation or hosted recovery. Those need a separate end-to-end qualification using a real brief, draft, feedback revision and delivered MP4.
