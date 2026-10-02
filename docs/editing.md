# Review and editing

A person should be able to say what feels wrong, see the intended correction quickly, and trust that accepted work survives. This page is the contract behind that: what is saved, how a note keeps its place, what an edit may touch, how a change is previewed and how it is undone. Commands are `node engine/cli.mjs …`; everything is local files under the project's `review/` folder, with no server or service.

The journey (see `docs/collaboration.md`): **Plan** (the paper edit), **Rough cut** (full length, real renderer, placeholders marked), targeted edits from notes, then the fine cut and **Final**. Guided work pauses at those; one-shot work publishes the same artifacts and keeps going.

## What is saved

```
review/
  revisions/r001/   revision.json (receipts, lineage, inputs), timeline.json, storyboard.json
  objects/ab/…      every input file and video, stored once by SHA-256 (APFS clones: no extra
                    space until the working file changes); hash-checked on every read
  notes.json        notes and their history
  keeps.json        what the person pinned
  decisions.jsonl   accept / reject / decide / override / restore, append-only
  edits.jsonl       recording edits (cut, uncut, split, merge), append-only
  runlog.jsonl      measured command and phase times
  previews/         range previews and before/after passages, each with a receipt (.json)
  index.html        the review page; compare/A-B/index.html the before/after pages
  paper-edit.md     the paper edit
```

`.gitignore` excludes `review/` for the bundled examples; for your own projects, keep or ignore it as you like (videos can be large).

## Revisions

A revision is an immutable record of something a person could watch or compare. **Every full render saves one** (or reuses the latest if nothing changed); `snapshot DIR` saves the working copy without rendering; `revise` saves a candidate; `reject` and `restore` save the state before and after.

A revision holds:

- the authored `storyboard.json` and **every input file** a render reads (narration slices and their metadata, images, clips, music and the bed's pointer `assets/music/bed.json`, sfx, the project library, the source recording and its transcript, generated-voice takes), each preserved in `review/objects/` by content;
- the prepared job (as an object) and a **review timeline**: per beat its frames and seconds, chapter, speaker, words on the film clock, the recording span it plays (with any cut-out parts), canvas element ids, placeholders and fingerprints;
- receipts: each video (profile rough / draft / final, encoder, frames, output SHA-256) and previews;
- lineage: beats added (and what they were made from), removed (and by which cut), merged.

Identity is content, not a timestamp: two renders of the same inputs, renderer and fonts are the same revision. Videos are kept for the newest three revisions with a video plus any revision a person accepted; older videos are released (the record stays, marked "released") and their stored copy is deleted unless something else still names the same content (another kept video, any revision's inputs, job or receipts, a preview). Inputs are never released while a revision names them.

`materialize` (used by `compare` and `revise` when a video was released or never made) rebuilds a revision's project from its objects, each checked against its hash; a damaged object stops the operation instead of rendering something else. A re-render uses today's renderer and fonts; its receipt says whether they match the revision's. Rendering is deterministic, but **an old revision is only bit-identical if the renderer, fonts and every input are unchanged**; ClearFrame never promises it from the storyboard alone.

```sh
node engine/cli.mjs revisions film
node engine/cli.mjs snapshot film --label "Plan"
node engine/cli.mjs diff film r003            # r003 → the working copy
node engine/cli.mjs diff film r003 r005
```

## The impact report (diff)

Fingerprints never include a beat's absolute start, so a beat that only moved keeps them. For each beat the report says:

| status | meaning |
|---|---|
| `content` | the beat's own authored data, narration audio, words or media changed (it names which: picture, words, audio, facts, voice) |
| `appearance` | not edited, but it renders differently: a non-cut entrance draws the changed beat before it, it shares a canvas world with a changed beat, its exit or speaker tag now follows a new neighbour, a camera hand-off or morph changed, or the film look or renderer changed |
| `shifted` | identical, at a new time (and so against different music) |
| `added` / `removed` | with what it was made from, or the cut that removed it |
| `unchanged` | same content on the same frames |

A changed **order** of beats is reported too, with a smallest set of beats that moved (a cut that only moves later beats in time is not a reorder); moved beats join the passages to look at. `revise` accepts a candidate that only reorders beats, and moving the note's own beats is in scope wherever they go; it is out of scope when any other beat changes place relative to the rest. Film-wide changes (palette, motion, captions, framing, format, lens: "the look"; the renderer or fonts) are reported once, and every beat is then `appearance`. A duration change reports the first beat that moves and, with music, that the bed now sits differently under every later picture. Fingerprints settle sub-millisecond timing rounding so a moved beat reads as moved; **a moved beat is never called unchanged or reusable** — render caching and splicing are not implemented, and a beat's frames depend on absolute time, neighbours and media.

Generated narration: a changed line re-records its **whole take** (one take per film by default, one per chapter with `voice.takes: "chapter"`); the report lists every beat in that take. Re-recording part of a take is not supported.

## Notes

A note is anchored to **the revision the person watched**, not to the working copy:

```sh
node engine/cli.mjs note film "the diagram is confusing; keep the voice" --at 2:13 --rev r003 --keep voice --by Ana
node engine/cli.mjs note film "[ClearFrame r003 @ 2:13.40 · s047 · “the queue backs up”] the diagram is confusing"
node engine/cli.mjs notes film --import notes-r003.json     # downloaded from the review page
node engine/cli.mjs notes film                               # where each note is now
```

Without `--rev`, the newest revision with a video is assumed and the command says so. The anchor records: the beat on screen at that frame (and beats near a cut, reported, never guessed), the time into the beat, the words spoken around the playhead, their time in the source recording (and in the original file), an `--element` id if named, and the beat's fingerprints. `--to` makes a range note; `--scope chapter|film` widens it (the person's words decide the scope; "this section" is not assumed to mean a chapter).

The stored note (`review/notes.json`) is `{id, createdAt, author: {role, name}, via, revision, text, scope, kind?, anchor: {beat, beats, at, to?, beatTime, chapter, words, quoteAt, source?: {file, from, to, original}, element?, near?, prints}, keep, status, resolution?, history}`. People never have to write it: the review page copies a stamped line or downloads a file, and the agent records chat notes with `note`.

**Where is the note now?** `notes` follows each note through every later revision: beat ids through lineage (splits, merges, removals, and ids that come back when a cut is undone or a candidate rejected), then the quoted words inside those beats, then the recording time. States:

| state | meaning |
|---|---|
| `current` | same beat, same content, same time |
| `moved` | same content at a new time, or found again by its recording time |
| `changed` | found, but the beat was edited since the note: it may already be addressed |
| `stale` | the beat is there but the quoted words are not, appear twice, or were partly cut |
| `orphaned` | the passage was cut or removed: nothing honestly corresponds to it |
| `addressed` | the words were cut for this note (`cut --note`) |

A note is **never** attached to whatever is at the same timestamp now. A stale or orphaned note goes back to the person with the old moment (its revision, time and words).

Workflow status is separate: `open` → `applied` (a candidate exists) → `accepted` (a person said so) or back to `open` (the candidate was rejected); `dismissed` and `question` are also available.

## Keeps

A keep pins part of the film against edits. It records who asked, their words and the revision it refers to.

```sh
node engine/cli.mjs keep film voice --by Ana --said "keep the voice"            # whole film
node engine/cli.mjs keep film picture --beats s046,s047 --by Ana --said "that diagram is right"
node engine/cli.mjs keep film words --at 2:10 --to 2:40 --by Ana --said "don't cut anything there"
node engine/cli.mjs keeps film
node engine/cli.mjs keep film --release k002 --by Ana --said "ok, tighten it"
```

| keep | holds | allows |
|---|---|---|
| `voice` | the recording or take each beat plays: no re-recording, new TTS take, replacement or processing of that audio | cuts the person asked for (`cut … --by NAME`); refuses cuts the agent decides on its own |
| `words` | the spoken words in scope | nothing that removes or changes words, including cuts, unless the person releases the keep or records an override |
| `facts` | what the beat shows as information: numbers and figures, category labels, units and formats, scale limits, the wording of on-screen text (titles, notes, qualifiers such as "about" or "mostly"), the attribution line and the source entries it cites | styling, position, size, entrances and other motion, presentation order (`sort`), emphasis, decorative elements |
| `picture` | the beat's visual authoring (block, props, art, plate, camera, tone, transition, exit, lens) and its media | narration and timing changes |
| `look` | film-wide look (palette, motion, captions, framing, format, lens, treatment) | everything per beat |

So "keep the voice" means: the speaker's recording stays the recording, cuts happen only when the person asks for them, and nothing is regenerated. "Keep the audio" in a note about a picture means: change only the picture there. When a request is ambiguous in a way that changes the action (keep the voice, or keep every word?), ask; otherwise state the reading and proceed.

`revise` and `cut` refuse edits that break an active keep. If the person agrees to break it: `override film --keep k002 --by Ana --said "yes, cut it"`, then pass `--override k002` (passing the flag without a recorded override does nothing).

For beats of an imported recording, `voice` and `words` keeps protect **what the keep's revision played**: its transcript words and the stretches of recording they occupied, whatever the beats are called later. Splitting or merging a beat does not loosen a keep: a cut in `s005b` is checked against the words `s005` played, and after a merge only the protected beat's words are held (the neighbour it absorbed stays free). Every cut path — `--words`, `--note`, `--at`, `--sentence`, `--pauses-over` and `--paper` — plans first and checks the plan against the keeps before anything is written, holding the review lock until the cut is done so no other edit or keep lands in between; a refusal changes nothing. `words` is broken by removing any protected word; `voice` by removing any protected recording unless the person asked for that cut (as the edit log records it: a removal's own `by` is not taken on trust), and by a beat no longer playing its recording at all (a hand-edited `vo`, a replacement take). A `voice` keep also checks the audio itself, not only what the metadata declares: `source/recording.wav` must be the file the keep's revision played (by SHA-256, against the revision's stored copy) and match its record in `source/recording.json`, and every beat that plays protected recording — the beat, its parts after a split, or the beat it merged into — must hold exactly the samples its metadata declares from the master (its span minus removals, with the join fades, as a rebuild would make them). A silenced, swapped, processed or missing slice, or a replaced master, breaks the keep; cuts, splits, merges, pause tightening, undo and restore rebuild from the master and keep it. The check reads files only (no render or provider work). Narration that is not an imported recording follows its beats through lineage instead.

## Decisions: applied is not accepted

```sh
node engine/cli.mjs accept film r005 --note n012 --by Ana --said "yes, much clearer"
node engine/cli.mjs reject film r005 --note n012 --by Ana --said "no, the old one read better"
node engine/cli.mjs decide film r005 --checkpoint rough --reason "one-shot: notes applied, moving to the fine cut"
```

`accept` and `reject` record a person's verdict and require `--by` and `--said`; they refuse `--agent`. `decide` is the agent's own call in one-shot work and is always displayed as "agent decision, not a person's acceptance". Nothing is accepted because time passed or because nobody objected. An acceptance attaches to beat fingerprints: a beat that only moved stays accepted (`moved`); one whose neighbour or the film look changed is `looks-different` (a quick look); one whose own content changed is `changed` (review again). `checkpoints` closes Rough cut and Final on these decisions, never on a file's age:

- **Final** is closed only for the film as it is now: a final encode of exactly the working copy's content (same inputs, renderer and fonts, so an audio-only change reopens it), that encode being `build/video.mp4`, and a decision about that whole cut and that encode (`accept rNNN` or `accept rNNN --checkpoint final`; decisions record which encodes they saw). An acceptance of an earlier cut, of one note's result (`--note`) or of some beats (`--beats`) never closes it, and a later rejection reopens it. In one-shot work an agent `decide --checkpoint final` on that encode stands in, labelled as such; guided work needs the person.
- **Rough cut** is closed by the person's notes on a rough or draft cut, or their acceptance of a whole rough cut (a later rejection takes it back); in one-shot work, by `decide --checkpoint rough`.

## Range previews

```sh
node engine/cli.mjs preview film --beats s046,s048 --handles 2
node engine/cli.mjs preview film --range 2:05-2:25 --rough
node engine/cli.mjs preview film --note n012
node engine/cli.mjs preview film --chapter "The explosion"
```

A preview renders frames [a, b) of the **full prepared timeline** (FFFrames' range render): every beat keeps its place, neighbours, world state, carried elements and transitions, so nothing is simulated by deleting surrounding scenes. Beats are widened by the transitions into and out of them (at least half a second, or the cover of a graphic transition) and by `--handles` seconds (default 2), clamped to the film. The receipt (`review/previews/NAME.mp4.json`) records:

- the frame range, its film seconds, the beats covered (with where each sits in the preview) and the input id;
- **clock check**: the first and last frames, and the first cut inside the range, are drawn directly by the renderer at their film positions and compared with the decoded preview (PSNR); each must match at least as well as its neighbours in the preview, so an off-by-one clock fails wherever the picture moves (a still picture cannot tell, and there an off-by-one is invisible). `--no-verify` skips it;
- audio: the exact samples of the **full film mix** (made once per sound state and cached), so loudness, ducking and music position are the film's; the film's integrated loudness and the stretch's are both reported;
- captions: burned in by the renderer as in the film; a `.vtt` beside the preview carries the speech on the preview's clock;
- the decoded frame count, output SHA-256 and what was not validated (placeholders, unfinished elements, estimated timing).

## The edit loop

```sh
node engine/cli.mjs note film "make this the drawing of the queue" --at 2:13 --rev r003 --by Ana
#   … edit storyboard.json for that beat …
node engine/cli.mjs revise film --note n012
node engine/cli.mjs accept film r006 --note n012 --by Ana --said "yes"
```

`revise` checks that the working copy changed **only inside the note's beats** (found by content in the working copy; a recording cut made with `--note` declares the beats it touched), with `appearance` and `shifted` beats allowed and listed. To change more, widen with `--scope s046,s050 --reason "…"` or `--scope film`. It checks every keep, saves a **candidate revision**, renders before/after passages of each affected stretch (the "before" from the previous revision's stored video when kept, otherwise re-rendered from its stored inputs; the "after" from the full prepared timeline), writes `review/compare/A-B/index.html`, and marks the note `applied`. Asking happens only for material ambiguity, a keep conflict, missing authority or paid work beyond the budget.

`reject` undoes the candidate's changes **only where nothing was edited since**: beats it changed go back to its parent's version (storyboard data and files from the object store), beats it added go, beats it removed return in place (after what is left of the beat before them, and after any beats added since that follow it), a beat order it rearranged goes back to the parent's unless the order was changed again since (beats are followed through later splits and merges: parts of a split beat move with it and stay split; a beat added since moves with the beat before it; parts of one beat moved apart count as a later reorder), film settings revert if untouched; anything edited afterwards is reported as a conflict and left alone, as is a media file that another beat edited since still uses. It refuses (changing nothing) when a recorded beat coming back would replay recording that another beat plays now. It is not an inverse patch applied blindly.

`restore film rNNN` is the explicit whole-revision restore. It saves the current state as a revision first (so `restore film <that revision>` undoes it), writes every file of rNNN, then moves aside — into `review/aside/<restore point>/`, never deleting — tracked inputs rNNN did not have (project library overrides, takes, sound files, the bed's pointer) and any media the loader would now pick over rNNN's own (say, a newer `pic.jpg` that wins over rNNN's `pic.png`). It then verifies the working copy against rNNN: **exact** (same inputs, renderer and fonts), **inputs** (same inputs, but the renderer or fonts changed since, so frames may differ), or what still differs (the command then exits 1). Unrelated files elsewhere in the project are left alone.

`restore film rNNN --beats a,b` restores some beats. It refuses, changing nothing, when a media file those beats need differs now and other beats use it (`--shared` changes it for them too, and says so), when a beat was split or merged since (restore its successors or the whole revision), or when a recorded beat would replay recording another beat plays now.

```sh
node engine/cli.mjs compare film r001 r007      # any two revisions (or one and the working copy)
node engine/cli.mjs page film --rev r003        # the review page for an older cut
```

## The review page

`review/index.html` (written by every render, note, revise and decision; `page` rewrites it) shows the newest revision with a video: the player with the current beat, chapter and spoken words under it; chapters and transcript (click a line to seek), with placeholder, timing and acceptance badges; what the cut has not validated; notes and where each is; keeps; decisions; revisions and compare pages. **Note at the playhead** copies a stamped line (`[ClearFrame r003 @ 2:13.40 · s047 · “…”] text`) or downloads `notes-r003.json` for `notes --import`. Compare pages show the impact report, side-by-side passages ("Play before and after together") and reply lines to paste into the chat; acceptance is recorded only from the person's reply.

Pages open from disk with no server or dependency. Every string from a project or a person is HTML-escaped; data for the page's script is embedded as inert JSON and written with `textContent`; object paths and ids are validated before they become URLs.

## Recording edits

An imported recording (`ingest --audio`) keeps the master untouched in `source/recording.wav`, its transcript on the master's clock in `source/words.json`, and `source/recording.json` (original file, offset, sample rate, SHA-256). Each beat's metadata (`assets/vo/ID.json`) declares its `source.span` (frames on the master's clock), its share of the transcript, and `source.removed` (sample ranges cut out, each with who asked and why). A beat's WAV is **rebuilt from the master** after every edit; its `vo` text, words and captions follow. Recording edits refuse (changing nothing) when the master no longer matches the SHA-256 in `source/recording.json`; restore it from a revision. Never edit a recorded beat's `vo` by hand: its audio would no longer match and timing would fall back to estimates.

```sh
node engine/cli.mjs paper film --suggest-cuts                         # mark ~~words~~ in review/paper-edit.md, then:
node engine/cli.mjs cut film --paper review/paper-edit.md --by Ana
node engine/cli.mjs cut film --words "which is a story for another day" --by Ana
node engine/cli.mjs cut film --beat s012 --sentence 2 --by Ana
node engine/cli.mjs cut film --at 2:13 --rev r003 --by Ana            # the sentence spoken there in r003, found again by its words
node engine/cli.mjs cut film --note n014 --by Ana                     # the sentence the note points at; the note becomes `addressed`
node engine/cli.mjs cut film --pauses-over 1.2 --keep-pause 0.5 --by Ana
node engine/cli.mjs cut film --words "um" --dry-run
node engine/cli.mjs uncut film --cut c004                             # exact: byte-identical audio
node engine/cli.mjs split film --beat s012 --before "and the line"    # s012a + s012b, both `was: ["s012"]`
node engine/cli.mjs merge film s012a s012b
```

**What `--note` and `--at` cut.** Every word of the recording has an identity: its index in `source/words.json`, which cuts, splits, merges, undo and restore never change and which two passages with the same wording never share. `cut --at 2:13 --rev r003` takes the sentence spoken at 2:13 in r003 and `cut --note n014` the sentence under the note's playhead in the revision it was made on, as identities; the film as it is now is then searched for exactly those words. If they no longer all play, together, nothing is cut and the cut that removed them is named. `--note` first finds where the note is now and refuses a stale, orphaned or already addressed note; with `--words`, only the beats the note is about are searched. A range note covers several sentences: name the words. Only an explicit `--words` without a note searches the whole film (and asks for `--beat` or `--nth` when the words occur more than once).

How a cut is made: it starts inside the pause before the first removed word and ends inside the pause after the last, keeping half of each pause (at a beat edge, the edge pause goes too), and its length is a whole number of frames so beats still tile the timeline. Neighbouring words are never touched; when the pauses are shorter than a frame, the cut takes exactly the words and pads the join with under a frame of silence. Joins get a 4 ms fade inside the pause. A beat left without words is removed whole (and comes back with `uncut`). Kept words move by exact sample counts, so **measured timings stay measured** (`alignment.provider` notes "(source edit)"); interpolated words stay estimates. Later beats move earlier by the cut; the impact report and the candidate's passages show it (the "before" passage is longer than the "after" by exactly the cut). A sentence cut across beats is one edit (`c004`) and one undo. Words struck in the paper edit are cut all or none: every run is planned and checked first, and if anything fails part way every file goes back.

Cuts on beats imported per beat with `speech` (no source span) are not supported; edit those with a new import. Generated narration has no source recording: edit its `vo` and re-record (see the take rule above).

## Rough cuts

`--rough` (on `draft`, `render`, `preview`, `check`, `sheet`, `still`) is a draft profile for the first full-length look:

- a beat with `"placeholder": "what goes here"` (or a generated asset that is not made yet) renders as a labelled slate — a dashed frame, `PLACEHOLDER · …` inside title-safe, the beat's own words on its own clock;
- a canvas or art element marked `"unfinished": true` or `"unfinished": "note"` renders as drawn;
- a frame-audit error becomes **craft** (listed, not blocking) only when its text is part of that slate or of an element marked unfinished, and nothing else the beat shows contains it. A clipped source line, a covered category label, small caption text, speech over a slate, or a finding without text stays an error. Roughness never implies that facts or attribution are safe;
- estimated narration and word timing are allowed and labelled, as in `--draft`;
- everything else still fails: storyboard and prop validation, cues, sources for every number, glyph coverage, audio and timing integrity, native inspection, media existence for anything not declared.

Outside `--rough`, a declared placeholder or an unfinished element is an error. Receipts, revisions and the review page list placeholders, unfinished elements, craft findings, estimated timing and whether the frame audit ran.

## The run log

Every project command appends a line to `review/runlog.jsonl`: command, arguments, start, end, duration, status, phases (prepare, native-build, native-render, timeline, validate, mix, mux, hash, revision, inspect, audit, voice, verify, passage, audio-cut…) and what it made. `runlog DIR` reports measured command time, phase totals and wall-clock milestones (first reviewable cut, first rough cut, first final). **Time between commands is reported separately and is not measured work**: the log cannot tell whether a model was writing, a person was reviewing, or nothing happened.

## Measured on this machine

`scripts/review-e2e.mjs OUT` runs the whole loop on a free local fixture (a 71-second two-speaker recording spoken by macOS `say`, words from local Whisper) and checks frame counts, byte-identical undo, note states and the rough audit rules. On the iMac this was built on, with a warm renderer: Whisper 33 s, rough cut 32 s, a picture candidate with before/after passages 17 s, a sentence-cut candidate (re-rendering the earlier revision's passage) 43 s. These numbers describe that fixture and machine only; nothing here measures the seven-minute run elsewhere or promises a review time for a long film.

## Limits

- No render caching or splicing; a candidate renders passages, a full review renders the film.
- Partial re-recording of generated narration is not supported: a line edit re-records its take.
- Notes resolve by beat lineage, quoted words and recording time; heavy rewrites of generated narration can leave notes `stale`, which then go back to the person.
- Videos of older revisions are released after three newer ones (unless accepted); their passages are then re-rendered from stored inputs with today's renderer.
- The review page needs a browser that plays H.264 MP4 from disk; clipboard copy falls back to a selectable text box.
- Word timings are only as good as the transcript; a source edit keeps them, it does not check them.
