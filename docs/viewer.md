# The studio page

`clearframe viewer --serve` opens the page people use to make and review films: say what you want made, watch it, leave sticky notes on the moments you want changed, and talk to the agent that edits it. The people it is for are not video editors, so the page has no editing panels. The agent does the editing; the page captures *what* and *where*, precisely enough for the agent to find the exact frame.

```sh
node engine/cli.mjs viewer --serve                 # http://127.0.0.1:4317/: notes save into each film; the agent is one message away
node engine/cli.mjs viewer                         # build/viewer/index.html, double-click to open: watch and take notes, no agent
node engine/cli.mjs viewer ~/films --out ~/films/viewer
```

Setup for the agent (OpenCode, the free default model, where things are kept) is in `docs/agent-studio.md`.

## The loop

1. **Say what you want made.** The home page asks *What are we making?*: one box, wide or tall, and any files (reports, scripts, pictures, footage, sound). *Make it* creates the project, starts its agent conversation with your words, and opens the film. Below are your films, the ones waiting on you first ("2 changes to check").
2. **Watch.** A film opens on its picture, a filmstrip of its scenes to drag through, and the scene and narration under the playhead. Before the first cut it shows the brief and a still of every scene drawn from the storyboard (placeholder scenes hatched with what they will show).
3. **Leave a note.** Click anywhere on the picture: it pauses and a sticky note opens on that spot. Type, press Enter. The note keeps the moment, the spot and, when the scene knows them, the words on screen under it ("top left, on “Inflation, last twelve months”"). For something that isn't a spot, type in the Notes box; its chip reads *At 0:12*, or click it for *Whole film*. On a storyboard, click a scene to note it. Notes show as yellow marks on the filmstrip and numbered stickies on the picture near their moment.
4. **Send them to the agent.** *Send N notes to the agent* puts every open note into one message: id, time, scene, where it is pinned, and the words. The Agent tab shows the conversation: your message, one folded line of the agent's steps (open it to see each one; while it works the line says what it is doing), and its reply. Write to it there about anything else. While it works a new message queues; *Send now* delivers it at the agent's next step; *Stop* interrupts.
5. **Check what it did.** The agent answers each note it acted on in one plain line. The note then reads *The agent changed this* with that line, and asks *Looks good* (done) or *Not yet* (open again). A new version appears while the page is open; *New in version N* lists what changed by scene. *Undo the agent's last changes* takes back the newest request's edits in one step.
6. **Approve.** When nothing is open or waiting for your check, *Approve version N* records your name and your own words, as `accept --by --said` does. Approval is always the person's words.

The agent asks before it runs a command on this computer or spends money; those requests appear in the conversation (*Allow once* / *Don't allow*; for paid sound, your name, a tick and the amount). *Settings* in the Agent tab chooses how it works (*Just do it*, or *Check with me first*) and its model (free ones first; a paid one needs a tick). New films start in *Just do it*.

Space plays and pauses, the arrow keys move a second (Shift: five), N starts a note. A film link with `?t=12.5` opens at that moment.

## Opened as a file

Without `--serve` the page still plays every film and takes notes, kept in this browser. *Send N notes to the agent* opens a message to paste into Claude Code (or another coding agent) in the ClearFrame folder: the same notes in words, plus the `note` commands that record them in the film (`[ClearFrame r003 @ 0:05.60 · headline-rate · top left] …`, read by `note`). Notes already saved in a film can be changed only through the server.

## Where notes go

| Film | Served | Opened as a file |
| --- | --- | --- |
| ClearFrame project, a rendered version | `review/notes.json` through the engine (`note`, `notes`, `revise` and the agent's `clearframe_notes` read it); the spot and words under it in `review/viewer-pins.json` | this browser |
| ClearFrame project, before the first cut | this browser (there is no cut to anchor to); they travel in the message | this browser |
| Outside film (`film.json`) | the film's `notes.json` | this browser |

A note's state is *open*, *changed* (the engine's `applied`: the agent acted and said what it changed), or *done* (`accepted`, or `dismissed` when removed). Closing a note records your name.

## Films made elsewhere

A folder with a `film.json` appears alongside ClearFrame films (`real-examples/` is the place for client and personal films; it is ignored by git):

```json
{
  "title": "Brand reel", "about": "One line on what it is.",
  "versions": [{ "id": "v1", "label": "First cut", "file": "versions/v1.mp4", "createdAt": "2026-10-03T14:00:00Z", "quality": "Draft" }],
  "scenes": [{ "start": 0, "end": 5, "kind": "Opening", "narration": "…",
               "elements": [{ "text": "WINNING", "box": [90, 740, 900, 180], "at": 1.2 }] }]
}
```

`elements` are optional: with them, a note left on the words says which words. A film can name its `stage` (`brief`, `script`, `storyboard`, `rough`, `review`, `final`). There is no agent on outside films; their notes go out as a message to paste.

Posters and filmstrip stills live in `build/viewer/` (ignored by git); videos are linked in place, not copied.

## Under the page

The page is a thin layer over the engine's review record and the studio server, which the agent and the command line use directly:

- **Edits** go through one validated, hash-checked, undoable command path (`set`, `move`, `insert`, `duplicate`, `delete`, `treatment`, `batch`, `undo`, `redo`, `undoRun`), persisted in `review/studio-history.json`. Before anything is written the command builds the candidate film with the engine's own job builder; an edit that adds an engine error is refused. The agent's `clearframe_edit` uses it, held to the scope of the message (a note's scenes, or the whole film). From a terminal: `node engine/cli.mjs studio film [state|history|undo|redo|set PATH VALUE --beat ID|insert BLOCK|move|…]`. A recording's narration is edited by cutting words (`cut`, `uncut`), never by retyping.
- **Renders** (rough cut, final, stills, sections, check, captions) are jobs, one at a time behind the heavy-work gate; a rough cut saves a revision, which the page shows as a new version.
- **Local API** under `/api/`: `films`, `notes` (and `notes/state`, `notes/reply`), `projects`, `upload`, `agent/*` (conversation, prompt, interrupt, queue, permission, form, spend, mode, model, models, status), and `studio/*` (state, film, jobs, command, accept, sound, review, schema). It answers only on 127.0.0.1 with a local Host header, and every write must be same-origin JSON.
