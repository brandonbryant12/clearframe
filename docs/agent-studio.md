# The browser studio and its agent

`clearframe viewer --serve` is the gateway: open it in a browser, describe a film, and ClearFrame
creates the project, links one [OpenCode](https://opencode.ai) conversation to it and sends your
brief. The agent builds through the same validated, undoable studio commands and native preview
queue as the panels, so you can talk to it and edit by hand in the same workspace.

This page is the setup and operating contract. The editing workspace itself is described in
`docs/viewer.md`; review rounds in `docs/editing.md`.

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

ClearFrame never switches a film to a paid model by itself. In the studio, the model chip in the
Agent column opens **Agent settings**: the runtime's state, the models in its catalog (free ones
first, each marked free or paid), and provider connections. Choosing a paid model asks for
confirmation. Provider keys found in the environment (for example `GEMINI_API_KEY`) are picked up
automatically; a key pasted in settings goes straight to the runtime's own OpenCode credential
store and is never written to the page or the project.

Things learned getting the free tier to work (keep them):

- **Read containment is explicit.** OpenCode's `external_directory` rule covers paths outside the git
  worktree, not outside the session folder. The studio denies reads of `../*`, `/*` and `~*` (a read's
  resource is relative to the session folder; absolute paths inside the project are relativised
  first) and denies grep/glob/list. None of these trips the free-tier refusal.
- **Do not deny the shell tool.** OpenCode's free tier answers `403 provider.auth: "OpenCode's free
  tier can only be used from within OpenCode"` when the built-in shell tool is denied (a blanket
  `{action: '*', effect: 'deny'}` does the same). The studio keeps shell (and web fetch/search)
  behind **approval** instead: the agent can ask, and the request appears in the Agent column with
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

## What the studio owns, and where

Everything lives under the working folder you started the studio in:

| Path | What | Committed |
| --- | --- | --- |
| `projects/` (or `--projects DIR`, `CLEARFRAME_PROJECTS`) | films made in the browser, one folder each, ordinary ClearFrame projects | no (`.gitignore`) |
| `PROJECT/review/agent.json` | the film's one conversation id, its model, and your sent messages (ids and words only) | with the project |
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
  conversation by id. If the database was removed, the studio says so in the Agent column and starts
  a new conversation with your next message.
- **Stop the runtime:** `clearframe agent stop`. Stopping the viewer (Ctrl+C) stops its render jobs,
  not the OpenCode service.
- **Two studios on one folder:** the second one starts with the agent disabled and says which process
  owns it. Use the first, or stop it and restart.
- **Ports:** the viewer uses `--port` (default 4317; a clear error if it is taken). OpenCode picks a
  free ephemeral port itself, so it never collides with a global OpenCode service.

## Working with the agent

- **Start from an idea.** The home page form takes the idea, an optional title, format (landscape or
  vertical), kind of film (any playbook, or the agent's choice), look (any treatment, or the agent's
  choice), audience and takeaway, and source documents (PDF, DOCX, Markdown, text, HTML, RTF, CSV,
  JSON, up to 25 MB each). Creating runs the same intake as `clearframe start` and sends your brief
  as the conversation's first message.
- **Scope.** Each message is about something: the whole film, a scene, a layer, a range of scenes, the
  moment under the playhead, a review note, or a file. Pin it from the composer's scope menu or from
  "Ask the agent" on a scene, layer, note or file. The scope is snapshotted when pinned and does not
  follow your later navigation; the chip on each message shows what it was about. The studio
  **enforces** it: an edit outside a scene/range/moment scope, or touching anything but the pinned
  element of a layer scope, is refused and nothing is written; the agent has to ask you to widen it.
  A whole-cut note and a file are context only and do not limit edits.
- **Queue, steer, stop.** While the agent works, Enter queues a follow-up (it runs after the current
  reply), "Send now" delivers it at the agent's next step, and Stop interrupts the reply. Queued
  messages can be sent now or removed.
- **Approvals and questions** appear in the conversation and wait for you.
- **Undo.** Each agent edit is one step in the shared undo history. "Undo these edits" under a reply
  undoes all of that reply's edits as one step while they are the newest changes.
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
| `clearframe_catalog` | blocks, a block's props, palettes, types, treatments, sketches, canvas, transitions, motions, fields, playbooks |
| `clearframe_edit` | up to 200 operations as one validated, hash-checked, undoable step, held to the message's scope |
| `clearframe_render` | still, section, check, draft (rough cut) or captions through the studio's single render queue |
| `clearframe_job` | a render's status, output, errors; can wait up to 90 s |
| `clearframe_notes` | review notes and replies |
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
| "The model … is not in this runtime's catalog" | the catalog could not load (network) or the model was removed: retry, or choose another model in Agent settings |
| a 403 "free tier" error on a reply | someone changed the runtime's permissions to deny the shell; restore `engine/lib/agent/runtime.mjs` defaults and restart (`clearframe agent stop`) |
| "Another ClearFrame studio … runs this folder's agent" | use the studio already running, or stop it |
| tool calls say the studio is not running | restart `clearframe viewer --serve`; the conversation continues |
| "The earlier conversation … is not in this runtime" | the runtime database was removed or moved; your next message starts a new conversation |

Remote use is not supported: the studio and its agent bind to 127.0.0.1 and trust only same-origin
requests from this computer.
