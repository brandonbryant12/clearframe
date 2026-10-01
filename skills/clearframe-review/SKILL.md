---
name: clearframe-review
description: Turn a person's feedback on a ClearFrame cut into bounded, previewed edits — record notes against the revision they watched, apply the edit, return a before/after candidate, and record their acceptance or rejection. Use for rough-cut reviews, "at 2:13 this is confusing", "keep the voice", "cut this sentence", restoring an earlier version, or any edit to a film someone has already watched.
---

# Review and edit a ClearFrame film

The contract is `docs/editing.md`; the conversation rules are in `docs/collaboration.md`. Everything lives in the project's `review/` folder. Commands are `node engine/cli.mjs …`.

## Before the first look

1. Write the paper edit: `paper DIR` (add `--suggest-cuts` only if the person wants cuts proposed). For a recording, the words stay as recorded unless they ask.
2. Make the rough cut with what exists: blocks, basic motion, captions, and `"placeholder": "what will go here"` on beats whose picture isn't made (canvas/art elements can be `"unfinished": "note"`). Don't draw bespoke pictures for every beat and don't run reviewer rounds yet.
3. `draft DIR --rough` renders it, saves revision r00N and writes `review/index.html`. Send the page; ask what feels wrong, where, and what to keep.

`--rough` relaxes only declared stand-ins (see `docs/editing.md`): a clipped source line, label or caption is still an error. Fix those; never mark finished text `unfinished` to get past the audit.

## When notes arrive

For each note in the reply:

```sh
node engine/cli.mjs note DIR "the diagram is confusing" --at 2:13 --rev r003 --by NAME [--keep voice]
node engine/cli.mjs note DIR "[ClearFrame r003 @ 2:13.40 · s047 · “…”] the diagram is confusing"   # pasted from the page
node engine/cli.mjs notes DIR --import notes-r003.json                                            # downloaded from the page
```

- `--rev` is the cut they watched (without it, the newest cut with a video is assumed: say so if unsure).
- Read the output: the beat, the quoted words, any "near the cut to …" warning. If the person may have meant the neighbouring beat and it matters, ask; otherwise add `--beat` with your reading.
- "Keep the voice/audio/words/this picture/the look" becomes `--keep` on the note (scoped to its beats) or `keep DIR … --by NAME --said "…"` for wider scope. Read the semantics in `docs/editing.md` before cutting anything under a voice or words keep.
- Then `notes DIR`: anything `stale` or `orphaned` goes back to the person with its old revision, time and words. Never apply a note to whatever is at that timestamp now.

## Making the edit

1. Edit only the note's beats (`notes DIR` shows where each note is now). Picture notes: edit `storyboard.json`. Recording cuts: never edit `vo`; use `cut`:
   ```sh
   node engine/cli.mjs cut DIR --note n014 --by NAME                     # the sentence the note points at
   node engine/cli.mjs cut DIR --words "which is a story for another day" --by NAME
   node engine/cli.mjs cut DIR --pauses-over 1.2 --keep-pause 0.5 --by NAME
   node engine/cli.mjs cut DIR --paper review/paper-edit.md --by NAME    # words they struck with ~~…~~
   ```
   `--by NAME` means the person asked for the cut; `--agent` means you decided it (a voice keep refuses agent cuts). `--dry-run` shows what would go. `--note` and `--at --rev` find the exact words they pointed at by identity, not by text: if those words were already cut or the note is stale, nothing is cut and you should ask the person again.
2. `revise DIR --note n014` checks the edit stayed inside the note's beats and broke no keep, saves a candidate revision, renders before/after passages and writes `review/compare/A-B/index.html`. If it reports changes outside the scope, revert them or widen with `--scope ID,ID --reason "…"` (say why to the person).
3. Reply in one or two lines: what you changed, what else moved or looks different (from the report), and the compare page. Generated narration: a changed line re-records its whole take; say so and check the budget before `voice` without `--draft`.

Ask only for material ambiguity, a keep conflict (`override DIR --keep k002 --by NAME --said "…"` records their permission), missing authority, or paid work beyond the budget. Otherwise apply and show.

## Recording their answer

```sh
node engine/cli.mjs accept DIR r006 --note n014 --by NAME --said "yes, much clearer"
node engine/cli.mjs reject DIR r006 --note n014 --by NAME --said "no, the old one read better"
node engine/cli.mjs restore DIR r003 --by NAME --said "go back to Tuesday's cut"
node engine/cli.mjs decide DIR r006 --checkpoint rough --reason "one-shot: all notes applied"
```

- `accept`/`reject`/`restore --by` are only for what the person actually said; quote them. Silence, elapsed time or "looks fine I guess" about something else is not acceptance.
- `reject` undoes the candidate where nothing changed since and reports conflicts; `restore` brings back a whole revision (setting aside later library overrides and shadowing media under `review/aside/`, then verifying the result) or `--beats` (refused when it would change media other beats use, unless `--shared`, or replay merged recording), saving the current state first. `uncut DIR --cut c004` undoes one recording cut exactly.
- For the final, record acceptance of the whole cut (`accept DIR rNNN --checkpoint final --by NAME --said "…"`): accepting one note's result does not approve the film, and any later change reopens it.
- In one-shot work use `decide`; it is shown as an agent decision, never as acceptance.

## Reporting

`revisions DIR`, `diff DIR rA [rB]`, `checkpoints DIR` (Rough cut and Final close on decisions; coverage by chapter for long films), `runlog DIR` (measured time only; gaps between commands are not work). When you summarize, separate: rendered (a revision exists), applied (a candidate exists), accepted (a person said so).
