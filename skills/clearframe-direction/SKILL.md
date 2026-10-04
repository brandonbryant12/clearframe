---
name: clearframe-direction
description: Direct a ClearFrame film from a document, report, transcript, podcast or recording plus a little direction — ingest the material, find the story, choose a treatment and references, plan pictures per beat, critique, and review with a fresh reviewer. Use when someone hands over source material ("turn this into a video") rather than a finished script.
---

# From material to film

The goal is not to summarise the document on slides. It is a short film with a question, a turn and a payoff, where every beat has its own picture. Read `docs/cinema.md` for film grammar (shots, planes, camera, lens, rhythm), `docs/ideas.md` for pictures, `docs/canvas.md` for drawing, and the `clearframe-script` skill for narration.

## 1. Ingest
- Ideas/documents with brand assets: `clearframe start DIR --idea "..." --document report.md --brand brand.json --playbook NAME`. Read BRIEF.md, EVIDENCE.md and BRAND.md. It copies local assets and source hashes, preserves sample attribution and leaves the story to you. See `docs/intake.md`. Use `pipeline DIR --draft --scale 0.5` for a retained smaller first review, then check full-resolution output before delivery.
- Research reports (markdown): `clearframe ingest DIR --markdown report.md`. It writes `BRIEF.md`: every figure with its sentence and source, tensions, questions, quotes, chart-ready tables and the source list, plus a research-digest storyboard to rewrite. Convert PDF/Docs to markdown or text first (`pdftotext -layout`, `textutil -convert txt`).
- Recordings (podcasts, interviews, talks): `clearframe ingest DIR --audio episode.wav --words words.json [--script script.txt] [--from s --to s] [--vertical]`. Beats replay the recording gaplessly with measured word timings. A script (`HOST: …` lines or JSON turns) provides spelling and speakers. For word timestamps, use local Whisper (`whisper episode.wav --word_timestamps True --output_format json`, free) or Gemini transcription (paid). Then `clearframe paper DIR`: the paper edit (chapters, timecodes, speakers, the picture each beat is meant to get, the transcript) is the plan the person reads. The recording is the narration: keep it as recorded unless they ask for cuts (`--suggest-cuts` lists filler words, doubled words and long pauses as proposals; struck words come back with `cut --paper`).

**Long recordings (several minutes) are not long short films.** The beat counts and per-minute quotas below are for 60–90 s films. For a long recording, choose a small number of deliberate visual ideas (a world for the central mechanism, the few numbers that matter, speaker plates), mark where pictures will go with `placeholder`, and leave most beats as their captions for the rough cut. The person's notes on that rough cut decide which other moments deserve a picture. Work chapter by chapter (`preview DIR --chapter NAME`) and say how much of the film is covered.

## 2. Find the story (before any visuals)
Write these four lines at the top of `DIRECTION.md`:
- **Question.** What does the viewer want to know?
- **Misconception or tension.** What do they believe now? Starting from the wrong belief teaches better than a clean exposition.
- **Turn.** The "but…" that changes the picture.
- **Payoff.** What they understand or do at the end, and the last image.

Then choose 3–5 claims from the brief that carry the answer. Everything else goes to the source card. Link beats with *but* or *therefore*, never "and then". Open a loop in the first 5 seconds and close it at the peak. A 60–90 s film has roughly 12–18 beats.

## 3. Choose the look
- `clearframe treatments` lists art directions. Report looks: editorial, noir, kinetic, sketchbook, blueprint, audiogram, brand, calm. Film looks: cinematic, trailer, documentary, keynote. Start with `new DIR --playbook NAME --treatment ID` (or apply one to ingested material), then adapt.
- Genre playbooks start from shots, not cards: `trailer` (cold open, montage, silence, title, button), `cold-open` (a documentary that starts mid-scene), `product-reveal` (a dark stage, parts, specs as inserts, the whole).
- If there is a reference video, run `clearframe reference VIDEO`. Read `REFERENCE.md`, open `sheet.png` and `opening.png`, and write **Keep** (rhythm, camera, type roles, transitions) and **Change** (brand, copy, subject) in `DIRECTION.md`. The fewer creative decisions left to guesswork, the better the film.
- The user's direction ("make it feel like a Vox explainer", "punchy for TikTok", "calm and warm") maps to a treatment plus overrides. Say which you chose and why.

### Keep the creative space open

Use `clearframe directions research` or `directions podcast` to compare starting combinations. `--direction ID` works with `new`, `start` and `ingest`; explicit playbook, treatment and theme choices override it independently. Add custom JSON profiles with `--library DIR` when useful, or skip profiles entirely.

Before authoring, propose three materially different approaches from the actual source in `DIRECTION.md`: change the narrative entry, visual metaphor, camera/edit grammar and rhythm. At least one should depart from the nearest preset. Choose one for the audience and evidence; do not rotate palettes and call that variation. Invent native canvas scenes and combine arcs when the story needs them. Reuse reliable rendering primitives without repeating the same film. If the user requested a one-shot film, decide and record these choices without a new approval stop.

For product or feature launches, connect the audience's problem to a specific behavior, a visible before/after proof and a payoff. Keep literal interface evidence distinct from conceptual imagery. Use approved product captures and brand assets; a drawn workflow panel is not a screen recording. Optional original Blender sculptures (`sculptures`, `docs/sculptures.md`) can earn a shot through contact, viewpoint or light. Test a still and a draft motion pass first, then reuse the approved clip for native copy revisions. New native scenes and trusted source recipes remain open-ended; neither the playbook nor the asset catalog limits the concept.

Choose flat graphics for precise or dense comparisons. Native `props.kpi` depth can emphasize a headline, two to four nonnegative values, or progress without a Blender pass. Keep the domain fixed, the source visible and final labels aligned with settled values. Prefer a short reveal or outline emphasis over perspective, bounce or repeated looping of data. Use `motion:"none"` when immediate comparison or reduced motion matters. See `docs/kpi-direction.md`; its decorative guidance belongs in the direction brief, not boilerplate inside every film.

Recording imports apply a treatment only to visual settings. The profile's playbook is a reference, never a replacement for recorded words, source slices, speakers or measured timing. Keep those when replacing kinetic captions with source-specific drawings. See `docs/source-playbooks.md`.

## 4. Plan pictures
First decide whether the film is **one world** or a **sequence of scenes**. When the material describes a place, a process, a chain of causes or a system, draw one world (`props.world`) and move the camera through it: stations in story order (up for the sky, down for a plan view, onward for the next stop), the world changing state with the story (a `behind` sky lighting up, a roof filling with heat), and a final pull-back to the opening shot, changed. Interrupt it only for a turn (a kinetic card on a colour block). `examples/night-city` shows the pattern end to end.

Fill the beat plan table in `DIRECTION.md`: purpose, picture, **shot scale** and landing word. Never three identical scales in a row. Every cut needs a reason: a world move, a morph, a match cut, a graphic wipe, or a cut between two moving cameras. For places and journeys, build three planes with `z` and let the camera dolly or truck; rack focus on the word that shifts attention. Set pieces to start from: `sketch void|tunnel|skyline|horizon|title`. Use `docs/ideas.md`: hooks, scale, mechanism, change, tension, hidden-in-the-average, people, turns, endings. Per minute, aim for:
- at least one drawn mechanism (canvas);
- one colour-block punctuation;
- one or two graphic transitions at turns;
- imagery (plates) where the world matters;
- kinetic type where the words are the picture.

## 5. Build, critique, look
1. Write the storyboard; `clearframe critique DIR` flags deck-like runs, static holds, dense text, weak hooks and missing causal links. Fix, then run it again.
2. Voice: `voice DIR --draft` (the whole narration in one continuous take, one short `voice.style`), then `align DIR --whisper` for measured words. The final voice is Gemini 3.8 TTS in the same single take (`gemini-tts` skill).
3. `sheet DIR --draft` and open it; `still --grid` to place art; `render DIR --draft`.

## 6. Fresh review
Run reviewer rounds on the fine cut, after the person has seen the rough cut and their notes are in (one-shot: after your rough-cut decision); polishing every beat before anyone has seen motion is the most expensive way to find out a structural note. Ask a separate reviewer (a fresh subagent, with no authorship bias) to judge the sheet and draft against `DIRECTION.md` using this rubric. Collect specific, actionable notes:
- **Hook.** Does the first frame make you want the second? Is the question clear by 5 s?
- **Story.** Read only the `vo` lines: is it an argument with a turn, or a list? Does each beat follow from the last?
- **Pictures.** Does each beat show a different idea? Are there three similar frames in a row? Is anything a heading over bullets?
- **Cinema.** Is it shots or slides? Check the eight tells in `docs/cinema.md`: a card per line, build-then-freeze, a heading on every scene, a flat camera, a small subject, the same grammar, a screen-flat image, an edit set only by the voice.
- **Motion.** Does something move in every held frame? Do reveals land on the stressed words? Are graphic transitions only at turns?
- **Craft.** One hero per frame; type roles (sans claim, serif feeling word, mono facts); margins; readable at phone size.
- **Truth.** Every figure sourced and dated; estimates labelled; nothing implies data it does not have.
Give the reviewer the sheet, `review DIR` frames (`strip.png`), `qa DIR`'s `timeline.png`, `phone.png` and findings, the video and the `vo` lines, and ask for a verdict, the five highest-impact changes, and visible faults with timestamps. Keep the same reviewer across rounds (continue it rather than starting fresh) so it can say which notes are resolved. Separate its notes into **tool problems** (fix in the engine, and every film benefits) and **film choices** (fix in the storyboard). Apply the notes, re-sheet, and render the final only when the reviewer has no structural notes left. Four rounds turned the night-city example from narrated slides into a designed film.
