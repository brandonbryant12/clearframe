# Speech that follows the words

`kinetic` has three modes: `highlight` keeps a stable phrase, dims words not yet spoken and accents the current one; `reveal` lifts each word into view as it is spoken; `word` shows one word at a time with a small pop, holding it through pauses shorter than `maxGap` so the screen does not blink between words (longer silences still clear; timestamps are never altered). Set `maxWords` (1–10) and `align` (`left` or `center`). Captions are burned into every narrated film unless it sets `captions: false`, to the broadcast standard described under [Readable at the speed of speech](#readable-at-the-speed-of-speech). A scene's exit never starts before its last spoken word.

The renderer uses ordered, end-exclusive word intervals. Silence gaps remain gaps; seeking backward gives the same frame. A final kinetic or captioned render requires **measured word timestamps tied to the exact audio file**. A local voice or Gemini TTS take has estimated words until aligned. Estimated syllable/phrase timing is useful for drafts and is never silently promoted to measured alignment. Alignment maps the script onto what the recognizer heard: a word spelled differently keeps the heard timing, the same number written two ways ("$2,400", "twenty-four hundred dollars") is measured, and so is a name heard split or fused ("myKestrel" heard as "my Kestrel", "401(k)" as "401 k"); script words nobody heard are interpolated and counted.

## Import a recording and its timestamps

For a whole recording, `ingest DIR --audio FILE` is the usual route (it splits the recording into beats and measures the words). To set one beat's speech by hand, create a project with a `kinetic` beat, then import its original recording, exact transcript and word file:

```sh
pnpm cf new my-speech --playbook podcast-clip --vertical
pnpm cf speech my-speech --beat hook --audio take.wav --transcript transcript.txt --words words.json
pnpm cf sheet my-speech --draft
```

Import converts to 48 kHz mono WAV without trimming silence. Offsets therefore retain their original clock. A word file can be an array, `{ "words": [...] }`, WhisperX `segments[].words`, or a Gemini REST response containing `word_info` annotations. Canonical format:

```json
{"words":[
  {"w":"Hello,","t0":0.10,"t1":0.40},
  {"w":"world.","t0":0.52,"t1":0.94}
]}
```

Alternatively, import only audio/transcript, then add timings with `align DIR --beat ID --words words.json`. Transcripts and timed words must match (punctuation/case normalized), with no missing words, overlaps or out-of-range intervals. Review number expansions, acronyms and repeated words carefully. Audio replacement invalidates measured alignment.

## Transcribe the current take

```sh
pnpm cf align my-speech --beat kinetic --transcribe --budget 0.10
```

This explicitly calls `gemini-3.5-transcribe` in verbatim mode with word timestamps, using the Google Files API. It uploads only the selected recording and deletes the upload afterward where possible. The raw paid result is saved as `assets/vo/ID.transcription.json`, including on a transcript mismatch, so corrections do not require another call. Import a reviewed file with `align --words`. The local cost check is an estimate, not a provider billing cap.

After alignment, inspect transitions, silence gaps and the first/last word, then render without `--draft`. Read `build/timing.json` for each beat's `wordTiming` and `alignmentIssue`. SRT/VTT exports retain phrase intervals. The `captions` command requires measured words by default; `--draft` explicitly permits rough subtitles. Their presence alone is not proof that alignment was measured.

[Google transcription contract](https://ai.google.dev/gemini-api/docs/transcribe): use word timestamps under `transcription_config.mode`, with type `verbatim`. Recognition can be wrong; the framework validates consistency, while a listening review establishes accuracy.

Kinetic phrase grouping also respects `maxGap` (default 0.6 seconds) and `maxDuration` (default 4 seconds). A pause or a long phrase starts a new group before `maxWords` is reached. A single timed word stays whole even if longer than the phrase limit. After rendering, `review DIR` extracts frames immediately before/at/after the first and last words of each beat from the actual MP4; use `--beat ID` for a focused check.

## Editing a recording

A recording imported with `ingest --audio` keeps its master (`source/recording.wav`) and its transcript on the master's clock (`source/words.json`). Cutting words, sentences or pauses (`cut`), splitting and merging beats (`split`, `merge`) and undoing any of it (`uncut`) rebuild each beat's slice from that master; see `docs/editing.md`. Cuts start and end inside pauses and last whole frames, so kept words move by exact sample counts and **measured timings stay measured**; words that were interpolated stay estimates. Editing a recorded beat's `vo` by hand breaks this: the text no longer matches the audio, the beat loses its recording and falls back to estimated timing. Re-align (`align --whisper --beat ID`) only after replacing audio; a source edit does not need it.

Generated narration is different: changing one line re-records the whole take it belongs to (the film by default, a chapter with `voice.takes: "chapter"`), so batch line edits before a paid take. Re-recording part of a take is not supported.

## Readable at the speed of speech

People read about three words a second while they listen, and need a phrase on screen for at least a second to take it in. Type that changes faster than that is noise, however well it moves.

- For a passage, use `highlight` with `maxWords` 6–8 (a stable phrase that lights up as it is spoken). `word` and two-word groups are for a few seconds of emphasis: a hook, a punchline, a name. `critique` warns when a kinetic beat changes its type faster than every 0.9 s for more than five seconds.
- Not every line needs its words on screen as the picture. In a podcast clip, give the explanation a drawing (a sketch, a cast, a chart) and let the captions carry the words underneath; keep kinetic type for the two or three lines worth remembering.
- Captions are on for every narrated film (`captions: false` opts out) and follow a broadcast standard, after Netflix's English timed-text style guide. The same cues are burned in and written to `build/captions.srt` and `.vtt`:
  - **Segmentation.** At most two lines of 42 characters (28 on a vertical frame), one sentence per caption where it fits, and a new caption after a pause.
  - **Line breaks.** Lines break after punctuation or before a conjunction or preposition, never after "the", "of" or "to". A caption is one line when it fits, otherwise two balanced lines with the longer underneath.
  - **Timing.** At most 20 characters a second. Each caption is on screen for at least 5/6 s and at most 7 s and holds a moment after the voice. Captions 2 frames apart close up when less than half a second separates them, and none runs across a cut.
  - **Look.** White Inter SemiBold on a translucent near-black box that hugs each line, so it reads over any picture. Captions cut on and off with the speech, with no animation.
  - **Placement.** Low in the frame, or high for a caption whose picture has type of its own in the bottom band (judged once per caption, so it never jumps). `check` warns when a caption still covers the picture's type: keep the bottom band clear in close-ups.
  - **Pop.** `captions: "pop"` is the social style for vertical clips: a few words at a time in heavy type, the spoken word in an accent pill.

## Faster local word timings

The free OS voice (`voice --draft`) reads `voice.pronounce` respellings (`{"Alder": "All-der"}`) in place of the written words; the narration, captions and word timings keep the written word. Changing a respelling, `wpm` or `draftVoice` records the draft take again on the next `voice --draft`.

`align --whisper` and draft voice takes measure words with whisper.cpp (`whisper-cli`, MIT) when a local ggml model is installed: the same Whisper weights on the GPU, about ten times faster than the Python CLI and with a small fraction of its CPU, which matters when several films align at once. Put `ggml-base.en.bin` (from huggingface.co/ggerganov/whisper.cpp) in `~/.cache/whisper-cpp`, or name a model with `CLEARFRAME_WHISPER_MODEL`. Without it the Python `whisper` CLI is used. Each take records which recognizer measured it (`alignment.provider`); `doctor` shows which one you have. Takes are heard apart, each its own input to one recognizer run, so every take keeps its own clock: joined with silence between them, whisper.cpp put the first words after each gap on one zero-length instant, which cannot count as measured. A figure said in words matches the digits the recognizer writes ("twenty-four hundred" and "$2,400").
