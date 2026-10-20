import { playbooks } from '../../film/playbooks.mjs';
import { BLOCKS, THEMES } from '../../film/catalog.mjs';
export const HELP = `ClearFrame — motion graphics

  new <dir> [--direction ID] [--playbook concept-explainer] [--treatment editorial] [--theme midnight] [--vertical] [--seed N|random] [--length seconds] [--ending NAME]
  start <dir> [--idea text] [--document report.md ...] [--brand brand.json] [--audience text] [--takeaway text] [--length seconds]
                                      portable source + brand intake; accepts --direction, --playbook, --treatment, --vertical
  directions [research|podcast] [--json] optional story/picture/pace starting points; custom JSON in library/directions
  muse [--seed N] [--light] [--json]  a seeded creative brief: twist, motif, camera, cuts, look, set pieces, music
  checkpoints <dir> [--mode guided|one-shot] [--json]   where a human decides (intent, truth, story, words, spend, picture, final) and what is open
  treatments [--json]                 art direction presets: look, motion, voice, sound and rules
  types [--json]                      type voices: display family and emphasis per treatment (storyboard "type")
  reference <video> [--out dir]       cut rhythm, keyframe sheet, palette and motion of a reference film
  ingest <dir> --markdown report.md [--treatment research-study]   evidence brief (figures, sources, tensions, tables) + storyboard + DIRECTION.md
                                      (also .txt, .html, .docx, .rtf; .pdf with pdftotext)
  ingest <dir> --audio episode.wav [--words words.json] [--script turns.txt] [--brand brand.json] [--from s] [--to s] [--speakers host=Maya:Host,guest=Sam:Guest] [--vertical]
                                      a recording as gapless beats with measured word timings and speakers
  playbooks | recipes                 ${playbooks().length} narrative starting points
  blocks [name] [--json | --md]        ${BLOCKS.length} native building blocks and props
  themes [--json]                     ${Object.keys(THEMES).length} palettes with swatches
  motions [--json]                    presets, entrances, exits and backdrops
  icons [--json]                      132 bundled Tabler icons and provenance
  sketch [name] [--vertical]          canvas starting compositions (route, pipeline, balance…) as JSON
  find "idea" [--kind k] | --id k:name | --index   search the whole library: a shortlist, then exact authoring
  doctor | build                      tools and disk headroom; compile the renderer
  gallery <new-dir> [--vertical] [--theme ink] [--only bars,kinetic] [--sketches]
  viewer [folders…] [--serve] [--port 4317] [--out build/viewer] [--no-render] [--projects projects] [--no-agent]
                                      one page: films, versions and sticky notes; with --serve, the studio: new films from an
                                      idea, an agent conversation per film, notes sent to it (docs/viewer.md, docs/agent-studio.md)
  agent [status|doctor|start|stop]    the studio's isolated OpenCode runtime (docs/agent-studio.md)
  studio <dir> [state|history|undo|redo|set PATH VALUE [--beat ID]|insert BLOCK [--beat AFTER]|sketch NAME|move --beat ID --to N|duplicate|delete --beat ID|treatment ID] [--json]
                                      the studio's validated, undoable edits from the command line (shared history with the UI)
  plan <dir>                          approximate generation cost and cache state
  voice <dir> [--draft] [--dry-run]    free local voice, or Gemini 3.8 TTS as one continuous take (--dry-run prints the request)
  music <dir> [--draft]                local bed or paid Lyria MP3
  images | clips <dir> [--only id] [--budget dollars] [--force]
  speech <dir> --beat id --audio recording.wav --transcript text.txt [--words words.json]
  align <dir> --beat id --words words.json     import measured word timestamps
  align <dir> --beat id --transcribe [--budget dollars]  paid Gemini word timestamps
  align <dir> --whisper [--beat id] [--model base]      free local Whisper word timestamps for every take
  timing | captions <dir>             timing JSON / SRT and VTT
  check <dir> [--draft]                validate inputs and native diagnostics
  critique <dir> [--json]             deck-ness, stillness, density, hook and story-link review (instant, no render)
  still <dir> --at seconds | --beat id [--pos .6] [--grid] [--draft] [--out image.png]
  world <dir> [--name NAME] [--out image.png]   the whole canvas world with every beat's camera rect numbered
  sheet <dir> [--per 1|2|3] [--grid] [--draft] [--out sheet.png]   --grid: labelled 100 px coordinates for placing art
  looks <dir> [--beat id] [--draft]    compare the same frame in every palette
  review <dir> [--beat id] [--video film.mp4]  decoded cut/word-boundary filmstrip
  qa <dir> [--video film.mp4] [--loop]  time bugs in the encoded film: one-frame pops, held stretches,
                                      world seams, export tags, loudness, the drop; timeline + phone sheets
  beatmap <dir | track>               the music's tempo and measured drop, and each cut against its beat grid
  render | preview <dir> [--draft] [--rough] [--scale 0.5] [--out film.mp4] [--no-audio] [--force]
  pipeline <dir> [--draft] [--scale 0.5] [--no-render]   saved production pass: checks, sheet, encode, QA, boundary review
  draft <dir> [--rough] [--no-render] [--scale 0.5]   one pass, one queue wait: critique, draft voice, check, sheet, draft MP4

Review and edit (docs/editing.md; state in DIR/review/)
  paper <dir> [--suggest-cuts]        the paper edit: chapters, timecodes, speakers, intended pictures, transcript
  preview <dir> --beats a[,b] | --range 1:10-1:20 | --note n001 | --chapter NAME [--handles 2] [--rough]
                                      render just that stretch of the full timeline (audio cut from the full mix)
  revisions | snapshot <dir> [--label TEXT]   list revisions / save the working copy as one (renders save one too)
  handoff <dir> [--rev rNNN] [--out new-dir] [--json]   package saved inputs, retained video, receipt and a media-rights ledger
  handoff <package-dir> --verify      check every packaged file against the manifest before editing
  diff <dir> [rA] [rB|working]        what changed: content, appearance via neighbours or film settings, timing only
  note <dir> "text" [--at 2:13 [--to 2:20]] [--rev r003] [--beat ID] [--element ID] [--keep voice,words] [--scope beat|range|chapter|film] [--by NAME | --agent]
  notes <dir> [--import notes.json] [--rev rNNN] [--json]   notes and where each one is now (current, moved, changed, stale, orphaned, addressed)
  revise <dir> --note n001 [--scope ID,ID --reason TEXT | --scope film] [--override k001]
                                      candidate revision + before/after passages + impact report (review/compare/)
  compare <dir> rA [rB]               before/after page for two revisions (or rA and the working copy)
  page <dir> [--rev r002]             write the review page (review/index.html): player, transcript, notes
  accept | reject <dir> rNNN [--note n001 | --beats a,b | --checkpoint rough|final] --by NAME --said "their words"
  decide <dir> rNNN --checkpoint rough|final --reason TEXT    one-shot: an agent decision, never shown as acceptance
  keep <dir> voice|words|facts|picture|look [--beats a,b | --at 2:13 [--to 2:40] | --chapter NAME] --by NAME --said TEXT
  keep <dir> --release k001 --by NAME | keeps <dir>    override <dir> --keep k001 --rev rNNN --by NAME --said TEXT
  restore <dir> rNNN [--beats a,b [--shared]] (--by NAME --said TEXT | --agent --reason TEXT)   saves the current state first
  cut <dir> --words "…" [--beat ID] [--nth N] | --beat ID --sentence N | --at 2:13 [--rev r003] | --note n001
            | --pauses-over 1.2 [--keep-pause 0.5] [--beats a,b] | --paper review/paper-edit.md
            [--by NAME | --agent] [--dry-run]   cut recorded words from the source recording (undo: uncut)
  uncut <dir> --cut c001 | --beat ID   split <dir> --beat ID --before "words"   merge <dir> ID ID
  runlog <dir> [--json]               measured command and phase times; gaps between commands are not measured work

Library: palettes, treatments, sketches and playbooks are files in library/ (see library/README.md).
A project's own library/ overrides them by id; --library DIR (or CLEARFRAME_LIBRARY) adds a shared one.

The renderer is scene/native (Skia on Metal; docs/scene-engine.md); build compiles it when its sources
change, and every render command does so too. Preview produces a review MP4.
Draft permits estimated timing; --scale 0.25–1 reduces review resolution only (default 1).
Rough (--rough, a draft for first review) also renders declared placeholders (a beat's "placeholder", or a
generated asset not paid for yet) as labelled slates, and canvas/art elements marked "unfinished" as drawn.
Only frame-audit findings about that declared text become "craft"; every other type, source, figure, audio,
timing and schema check still fails. Every full render saves a revision in review/revisions/.
Paid generation needs GEMINI_API_KEY; rendering and word-file imports are free.
`;
