# The browser studio and its agent

`clearframe viewer --serve` is the gateway: open it in a browser, describe a film, and ClearFrame
creates the project, links one [OpenCode](https://opencode.ai) conversation to it and sends your
brief. The agent builds through the same validated, undoable studio commands and native preview
queue as the panels, so you can talk to it and edit by hand in the same workspace.

This page is the setup and operating contract. The page itself (watch, sticky notes, the Agent
tab) is described in `docs/viewer.md`; review rounds in `docs/editing.md`.

## Set up a computer

Requirements (macOS on Apple silicon is the tested platform; the native renderer is Skia on Metal):

1. Node.js 20.10 or newer.
2. `npm install` in the ClearFrame folder. This installs the exact OpenCode packages the studio is
   built against (`@opencode/cli`, `@opencode/client`, `@opencode/plugin`, all `2.0.24`), including
   the platform's native OpenCode binary (`@opencode/cli-darwin-arm64` here). No global OpenCode is
   needed, and a global OpenCode (1.x or a 2.x beta) is neither used nor changed.
3. The renderer: `clearframe build` (or let the first preview build it). See `docs/scene-engine.md`.
4. Network access to `opencode.ai` the first time the agent starts (model catalog, free models).

Start the studio:

```sh
node engine/cli.mjs viewer --serve            # http://127.0.0.1:4317/
node engine/cli.mjs viewer --serve --port 4400 --projects projects   # another port; projects folder
node engine/cli.mjs agent doctor              # runtime folders, binary, service, default model
```

The studio listens on 127.0.0.1 only. The agent runtime starts with the first conversation (or
`clearframe agent start`), not when the page opens.

## The model: free by default

The default model is **Big Pickle** (`opencode/big-pickle`) from OpenCode Zen. It is free (zero
input, output and cache cost in OpenCode's catalog; see https://opencode.ai/docs/en/zen/) and needs
no account or key. It has been used for every end-to-end run of this studio, including the plugin
tools and permissions below.

ClearFrame never switches a film to a paid model by itself. *Settings* in a film's Agent tab lists
the models in the runtime's catalog (free ones first, each marked free or paid); choosing a paid one
needs a tick. Provider keys found in the environment of the process that starts the studio (for
example `GEMINI_API_KEY`) are picked up automatically by the runtime and never reach the page.

Things learned getting the free tier to work (keep them):

- **Read containment is explicit.** OpenCode's `external_directory` rule covers paths outside the git
  worktree, not outside the session folder. The studio denies reads of `../*`, `/*` and `~*` (a read's
  resource is relative to the session folder; absolute paths inside the project are relativised
  first) and denies grep/glob/list. None of these trips the free-tier refusal.
- **Do not deny the shell tool.** OpenCode's free tier answers `403 provider.auth: "OpenCode's free
  tier can only be used from within OpenCode"` when the built-in shell tool is denied (a blanket
  `{action: '*', effect: 'deny'}` does the same). The studio keeps shell (and web fetch/search)
  behind **approval** instead: the agent can ask, and the request appears in the conversation with
  the exact command; nothing runs until you allow it. Denying `edit` is fine, and the studio does.
- **The catalog loads asynchronously.** Right after start `model.list` returns `{ location, data: [] }`;
  the studio waits (up to 45 s) for the default model to appear before calling it missing.
- **`model.list` returns an envelope** (`{ location, data }`), not an array.
- **Service registration is under XDG state.** The OpenCode CLI registers its running service in
  `$XDG_STATE_HOME/opencode/service.json` (URL, pid, password). The `service.json` that appears in the
  config folder holds only the service password setting; it is not the registry. Pointing
  `Service.ensure({ file })` at the config one hangs or fails with an invalid URL.
- `OPENCODE_CONFIG_DIR` alone does not isolate a runtime: data (sessions, saved credentials), state
  and cache would still be global. The studio sets all four XDG folders.

## Two ways to direct

Each film has a working mode, saved with the project (`review/agent.json`) and sent with every
message. Films made on the home page start in one-shot; *Settings* in the Agent tab switches it.

- **Just do it (one-shot).** The agent carries a request through to something you can watch
  without stopping to ask: for a new film it replaces the starter, renders a full-length rough cut
  through the native queue and reports what is ready and what is a placeholder. The Agent tab's
  status line and its folded steps show what actually happened (each tool call, the render's
  progress) from tool results and jobs, never from the agent's own claims; *Stop* interrupts and
  *Undo the agent's last changes* takes the newest request's edits back in one step.
- **Check with me first (together).** The agent proposes a plan and waits, makes one change at a
  time, and ends with one question when the decision is yours; quick replies ("Yes, go ahead.",
  "Show me first.", "Explain the options.") answer in one click.

The page has no hand-editing panels: you direct with notes and words. `clearframe studio DIR …` edits
from a terminal through the same validated, undoable path, and the agent re-reads the film before
each change (a stale edit is refused, never merged over someone else's).

## Google sound (narration and music)

Sound is adapter-based; Google is the first paid provider for both speech and music, beside the
free local drafts ClearFrame always had. Ask the agent for it ("record the narration with Google",
"a calmer music bed"): its `clearframe_sound` tool reads what follows, queues free drafts, and
*requests* paid generation, which appears in the conversation for your approval.

- **Narration**: the Google voice (Gemini TTS prebuilt voices) and a short delivery style; the
  narration takes (one continuous take per film by default) with who made each line (free draft,
  Google, an imported recording), whether the words still match, and measured word timing. A free
  draft uses this computer's voice and never replaces a Google take whose words are unchanged. Google
  generation records only the takes whose words, voice, style or model changed (the engine caches by
  take), at the estimate shown.
  A draft take records the OS voice that actually spoke it (`osVoice`, carried forward when a take
  is reused, since the draft voice is not part of a take's hash), never the Google voice and style it
  is set to. Older draft records that noted only the Google setting are shown as "unrecorded OS
  voice"; files are not rewritten (that would change render inputs), but `clearframe_files` presents
  their Google values under `googleSettingsAtTheTime`, and the agent's own file reader cannot open
  `assets/vo/*.json` directly. Every message's context repeats the reporting rule, so sessions that
  began before it still follow it; the agent's `clearframe_sound` keeps "as made"
  apart from "settings for Google", and `clearframe_job` reports each rough cut's or final's
  measured size, length and sound (a rough cut is half the project size).
- **Music**: direction (style and instruments; sections follow the edit), the Lyria model and its
  price, a free draft bed, or a Google bed (which replaces the current one).
- **Cost**: the engine's `plan` (what is cached, draft-only or to do, and its cost), the film budget
  (`budget` on the storyboard; a person sets it, for example `clearframe studio DIR set budget 5`, and
  an agent's edit may not change it), and every approved spend in `review/spend.jsonl`.

Paid generation only runs after a person approves an amount: the approval says what will be generated,
the estimate, and asks for your name and an explicit tick. The approval must cover today's estimate
and is bound to the exact provider requests shown (content hashes of each narration take, or of the
music request). The film budget, when set, is a ceiling on every run: $0 turns paid generation off,
and an estimate above it is refused. The engine's `--budget` is the smaller of the approval and the
film budget. A run generates exactly what was approved or nothing: the job queue refuses to start it
if the content changed while it waited, and the engine re-derives the requests from the storyboard it
is about to send (after any wait for the heavy-work gate) and refuses before any provider call if they
differ (`CLEARFRAME_APPROVED_SOUND`). Each approval is a durable intent consumed once (a retry returns
the same job) and is appended to `PROJECT/review/spend.jsonl`. The agent cannot spend: `clearframe_sound` can queue
free drafts and *request* Google generation with a reason; the request appears in the conversation
and goes through the same approval. A film whose narration is an imported recording is never
regenerated (it is edited by cutting words).

Setup on a computer:

1. A Google AI Studio (Gemini API) key with billing enabled for the paid models:
   `gemini-3.8-flash-tts` (narration, about $0.0023 per 10 s of speech) and `lyria-3.5`
   (about $0.08 per bed) or `lyria-3-clip-preview` (30 s, about $0.04). Prices are the engine's
   estimates (`skills/gemini-tts`, `skills/lyria-music`); check Google's pricing page.
2. Put it in the environment of the process that starts the studio, for example
   `export GEMINI_API_KEY=…` in your shell profile, then start `clearframe viewer --serve` from that
   shell. The studio only reports whether the key is present; it never shows, stores or sends it to
   the page. (OpenCode also picks the variable up for Google chat models; ClearFrame does not use a
   paid chat model unless you choose one.)
3. Without a key, everything free still works and the agent says what is missing.

Verification status: the free draft paths, the estimates, approvals, refusals (no name, approval
below the estimate, no key, recorded narration) and the job queue were exercised; **no paid Google
generation was run while building this** (no spend merely to test). The Google calls themselves are
the engine's existing `voice`/`music` commands (`skills/gemini-tts`, `skills/lyria-music`), which
predate the studio.

## What the studio owns, and where

Everything lives under the working folder you started the studio in:

| Path | What | Committed |
| --- | --- | --- |
| `projects/` (or `--projects DIR`, `CLEARFRAME_PROJECTS`) | films made in the browser, one folder each, ordinary ClearFrame projects | no (`.gitignore`) |
| `PROJECT/review/agent.json` | the film's one conversation id, its model, and your sent messages (ids and words only) | with the project |
| `PROJECT/review/spend.jsonl` | every approved paid generation: what, estimate, approved amount, who, job | with the project |
| `PROJECT/review/studio-history.json` | undo history, including the agent's edits (marked `by: agent` with the request they answer) | with the project |
| `.clearframe/opencode/{config,data,state,cache,xdg-config}` | the isolated OpenCode runtime: config ClearFrame writes, sessions database, saved provider credentials, service registration, logs | never |
| `.clearframe/agent/bridge.json` | the private URL and token the OpenCode plugin uses to reach this studio (mode 600) | never |
| `.clearframe/uploads/` | source documents added on the home page before their film exists | never |
| `engine/agent-plugin/` | the OpenCode plugin (ClearFrame tools) and the agent's instructions | yes |

`CLEARFRAME_STATE` moves `.clearframe/`. The projects folder must be inside the working folder (the
studio serves films' media from there). Dot folders are never served by the studio's web server.

## Lifecycle

- **One service per working folder.** The studio starts OpenCode as a background service
  (`opencode serve --service --port 0`, an ephemeral local port, with HTTP basic auth). Its password
  stays in the studio process and the registration file; the browser only sees status. A second
  start reuses the running service. If ClearFrame's plugin, instructions or permissions changed,
  the next start restarts the service so they apply.
- **Viewer restarts do not stop conversations.** A reply in progress keeps going while the viewer is
  down; the plugin's tool calls fail politely until it is back ("the studio is not running") and
  succeed again afterwards (each start writes a new bridge token).
- **Service restarts keep everything.** Sessions are in the runtime's database; a film reopens its
  conversation by id. If the database was removed, the studio says so in the Agent tab and starts
  a new conversation with your next message.
- **Stop the runtime:** `clearframe agent stop`. Stopping the viewer (Ctrl+C) stops its render jobs,
  not the OpenCode service.
- **Two studios on one folder:** the second one starts with the agent disabled and says which process
  owns it. Use the first, or stop it and restart.
- **Ports:** the viewer uses `--port` (default 4317; a clear error if it is taken). OpenCode picks a
  free ephemeral port itself, so it never collides with a global OpenCode service.

## Working with the agent

- **Start from an idea.** The home page asks *What are we making?*: your words, wide or tall, and
  any files (PDF, DOCX, Markdown, text, HTML, RTF, CSV, JSON up to 25 MB each; pictures, footage and
  sound). *Make it* runs the same intake as `clearframe start` and sends your words as the
  conversation's first message; the agent chooses the kind of film and the look.
- **Notes are the main way in.** Sticky notes left on a cut (a moment, a spot on the picture and the
  words under it) are saved as review notes; *Send N notes to the agent* sends one message listing
  them. With a single note the message is scoped to it, so edits are held to that note's scene; with
  several it is about the whole film. After acting, the agent answers each note in one line
  (`clearframe_notes` with `answer`, which marks it `applied`); the person then says *Looks good* or
  *Not yet*. Answering is never approval.
- **Scope.** Each message is about something, snapshotted when it is sent: the whole film, or a note
  (its scene). The studio **enforces** it: an edit outside a note's scene is refused and nothing is
  written; the agent has to ask you to widen it. (The server also accepts scene, layer, range,
  moment and file scopes from other clients.)
- **Queue, steer, stop.** While the agent works, Enter queues a follow-up (it runs after the current
  reply), "Send now" delivers it at the agent's next step, and Stop interrupts the reply. Queued
  messages can be sent now or removed.
- **Approvals and questions** appear in the conversation and wait for you.
- **Undo.** Each agent edit is one step in the shared undo history. "Undo the agent's last changes"
  undoes all of the newest request's edits as one step while they are the newest changes.
- **Nothing is sent twice.** Each message gets an id in the browser before it is sent and stays in
  an outbox (in the browser's storage) until the server confirms it; OpenCode treats a repeated id as
  the same message. A refresh, a lost reply or "Retry" cannot duplicate a prompt. A new film's create
  request works the same way.

## What the agent can do

The OpenCode plugin (`engine/agent-plugin/server.js`) adds ClearFrame tools; the studio server
runs them for the one project the calling session belongs to:

| Tool | Does |
| --- | --- |
| `clearframe_state` | the film: scenes, timing, narration, engine errors, hash, undo, notes, jobs; one scene or the whole storyboard |
| `clearframe_catalog` | blocks, a block's props, palettes, types, treatments, sketches, canvas (with icon names), transitions, motions, fields, playbooks |
| `clearframe_edit` | up to 200 operations as one validated, hash-checked, undoable step, held to the message's scope: `set`, `insert` (with an optional `id`, so the same batch can fill the new scene), `duplicate`, `move`, `delete`, `treatment`, and `playbook` (start over from a playbook's scenes and look, keeping title, format and sources) |
| `clearframe_render` | still, section, check, draft (rough cut) or captions through the studio's single render queue |
| `clearframe_job` | a render's status, output, errors; can wait up to 90 s |
| `clearframe_notes` | review notes (with where each is pinned and the words under it) and replies; `answer` marks a note acted on with one line |
| `clearframe_files` | list the project's files; read a source document (DOCX, PDF, HTML and RTF converted to text) |
| `clearframe_write` | replace `brief.md`/`BRIEF.md` or `DIRECTION.md` |
| `clearframe_guide` | ClearFrame's craft guides (the `skills/` SKILL.md files) |

OpenCode's own read tool works inside the project folder only: its permission resource is the path
relative to the session folder, and the studio denies anything starting with `../`, `/` or `~`.
(OpenCode's `external_directory` boundary is the git worktree, which for projects inside this
repository would be the whole repository, so the studio does not rely on it.) grep, glob and list are
denied because they are matched by pattern rather than folder; `clearframe_files` lists the project.
Direct file edits are denied; shell, web fetch and web search need your approval; only ClearFrame's
skills are allowed. Final renders, acceptance and paid generation stay with the person. A shell
command you approve runs with your permissions: approve only what you understand.

## Uploads and served files

Uploads land only inside their film: documents in `source/`, pictures, footage and sound in
`assets/uploads/`. Names are sanitised, types are allowlisted, sizes are capped (25 MB documents,
500 MB media), an existing file is never replaced (a second `notes.txt` becomes `notes-2.txt`, even
for concurrent uploads), and a folder that links outside the project is refused. HTML and SVG that
the studio did not generate are served sandboxed (a unique origin without scripts), so opening an
uploaded page cannot act on the studio.

## Troubleshooting

| You see | Do |
| --- | --- |
| "OpenCode did not start" | `clearframe agent doctor`; check `.clearframe/opencode/data/opencode/log/opencode.log`; `npm install` if the binary is missing |
| "The model … is not in this runtime's catalog" | the catalog could not load (network) or the model was removed: retry, or choose another model in the Agent tab's Settings |
| a 403 "free tier" error on a reply | someone changed the runtime's permissions to deny the shell; restore `engine/lib/agent/runtime.mjs` defaults and restart (`clearframe agent stop`) |
| "Another ClearFrame studio … runs this folder's agent" | use the studio already running, or stop it |
| tool calls say the studio is not running | restart `clearframe viewer --serve`; the conversation continues |
| "The earlier conversation … is not in this runtime" | the runtime database was removed or moved; your next message starts a new conversation |

Remote use is not supported: the studio and its agent bind to 127.0.0.1 and trust only same-origin
requests from this computer.

## A worked example

`examples/clearframe-self-demo` is a product demo of the previous studio layout (panels, inspector, timeline) made through it: the brief and
uploads on the home page, one-shot and together revisions, scoped notes, hand edits, rough cuts and
the final, with every prompt, the storyboard, the agent's decision log and the scripts that recorded
the studio's own screens (`scripts/demo-captures.mjs`, `scripts/demo-clips.mjs`).
