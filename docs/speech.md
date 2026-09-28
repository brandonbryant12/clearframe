# Speech that follows the words

`kinetic` has three modes: `highlight` keeps a stable phrase and accents the currently spoken word; `reveal` reveals the phrase as it is spoken; `word` shows one word at a time. Set `maxWords` (1–10) and `align` (`left` or `center`). Phrase captions can also be burned into any narrated film with `captions: true` (`auto` enables them for vertical formats).

The renderer uses ordered, end-exclusive word intervals. Silence gaps remain gaps; seeking backward gives the same frame. A final kinetic or captioned render requires **measured word timestamps tied to the exact audio file**. A local voice or Gemini TTS take has estimated words until aligned. Estimated syllable/phrase timing is useful for drafts and is never silently promoted to measured alignment.

## Import a recording and its timestamps

Create a speech-story project, then import each beat's original recording, exact transcript and word file:

```sh
node engine/cli.mjs new my-speech --playbook speech-story
node engine/cli.mjs speech my-speech --beat kinetic --audio take.wav --transcript transcript.txt --words words.json
node engine/cli.mjs sheet my-speech --draft
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
node engine/cli.mjs align my-speech --beat kinetic --transcribe --budget 0.10
```

This explicitly calls `gemini-3.5-transcribe` in verbatim mode with word timestamps, using the Google Files API. It uploads only the selected recording and deletes the upload afterward where possible. The raw paid result is saved as `assets/vo/ID.transcription.json`, including on a transcript mismatch, so corrections do not require another call. Import a reviewed file with `align --words`. The local cost check is an estimate, not a provider billing cap.

After alignment, inspect transitions, silence gaps and the first/last word, then render without `--draft`. Read `build/timing.json` for each beat's `wordTiming` and `alignmentIssue`. SRT/VTT exports retain phrase intervals. The `captions` command requires measured words by default; `--draft` explicitly permits rough subtitles. Their presence alone is not proof that alignment was measured.

[Google transcription contract](https://ai.google.dev/gemini-api/docs/transcribe): use word timestamps under `transcription_config.mode`, with type `verbatim`. Recognition can be wrong; the framework validates consistency, while a listening review establishes accuracy.

Kinetic phrase grouping also respects `maxGap` (default 0.6 seconds) and `maxDuration` (default 4 seconds). A pause or a long phrase starts a new group before `maxWords` is reached. A single timed word stays whole even if longer than the phrase limit. After rendering, `review DIR` extracts frames immediately before/at/after the first and last words of each beat from the actual MP4; use `--beat ID` for a focused check.
