import path from 'node:path';
import { cutWords, uncut, splitBeat, mergeBeats } from '../recording.mjs';
import type { EditAuthor } from '../recording-model.mjs';
import { wordKey } from '../word-timing.mjs';
import { decodeStoryboard } from '../../schemas.mjs';
import type {
  HistoryEntry,
  StudioHistory,
  StudioRequest,
} from './studio-contracts.mjs';
import { read, fail, atomic, historyFile, trim } from './studio-history.mjs';
import { analyse, narrationOf } from './studio-analysis.mjs';
import { nameOf, short } from './studio-operations.mjs';
import { studioState } from './studio-state.mjs';
const editAuthor = (by: HistoryEntry['by']): EditAuthor | undefined =>
  typeof by === 'string' ? { role: 'human', name: by } : by;

function replayRecording(
  dir: string,
  h: StudioHistory,
  item: HistoryEntry,
  undo: boolean,
) {
  // Recorded speech is rebuilt from the master: undo is the engine's exact uncut, redo cuts the same words again.
  if (undo) uncut(dir, { id: item.edit }, { by: editAuthor(item.by) });
  else {
    const r = cutWords(
      dir,
      { source: item.words, label: 'Those words' },
      { by: editAuthor(item.by) },
    );
    item.edit = r.id;
  }
  const now = read(dir);
  if (undo) item.before = now;
  else item.after = now;
  h.cursor += undo ? -1 : 1;
  atomic(historyFile(dir), JSON.stringify(h));
  return studioState(dir);
}

export function step(
  dir: string,
  h: StudioHistory,
  ok: boolean,
  undo: boolean,
) {
  if (!ok)
    throw fail(
      `Nothing to ${undo ? 'undo' : 'redo'}: the film was changed outside the studio.`,
    );
  const item = h.entries[undo ? h.cursor - 1 : h.cursor];
  if (!item || item[undo ? 'undo' : 'redo'] === false)
    throw fail(`Nothing to ${undo ? 'undo' : 'redo'}.`);
  if (item.kind === 'recording') return replayRecording(dir, h, item, undo);
  h.cursor += undo ? -1 : 1;
  atomic(historyFile(dir), JSON.stringify(h));
  atomic(path.join(dir, 'storyboard.json'), undo ? item.before : item.after);
  return studioState(dir);
}

/** Undo every step one agent run made, as one change, when they are the newest steps. */
export function undoRun(
  dir: string,
  h: StudioHistory,
  ok: boolean,
  run: unknown,
) {
  if (!ok)
    throw fail('Nothing to undo: the film was changed outside the studio.');
  if (typeof run !== 'string' || !run) throw fail('Name the run to undo.');
  let i = h.cursor;
  while (
    i > 0 &&
    h.entries[i - 1].run === run &&
    (h.entries[i - 1].kind ?? 'edit') === 'edit'
  )
    i--;
  if (i === h.cursor) {
    if (h.entries.slice(0, h.cursor).some((e) => e.run === run))
      throw fail(
        'Later edits came after that run: undo them first, or undo its steps one by one.',
      );
    throw fail('That run made no edits that are still applied.');
  }
  const first = h.entries[i];
  h.cursor = i;
  atomic(historyFile(dir), JSON.stringify(h));
  atomic(path.join(dir, 'storyboard.json'), first.before);
  return studioState(dir);
}

function recordingSelection(beat: string, body: StudioRequest) {
  const to = typeof body.to === 'object' ? body.to : { beat: beat, k: body.k };
  const fromK = body.from?.k ?? body.k,
    toK = to.k;
  if (
    typeof fromK !== 'number' ||
    typeof toK !== 'number' ||
    !Number.isInteger(fromK) ||
    !Number.isInteger(toK)
  )
    throw fail('Select the words to cut.');
  const sel = {
    from: { beat: beat, k: fromK },
    to: { beat: to.beat ?? beat, k: toK },
  };
  return sel;
}

function splitRecording(
  dir: string,
  sb: ReturnType<typeof decodeStoryboard>,
  raw: string,
  b: ReturnType<typeof decodeStoryboard>['beats'][number],
  body: StudioRequest,
  by: EditAuthor,
): Omit<HistoryEntry, 'before' | 'after' | 'at'> {
  const words =
    analyse(dir, sb, raw).timing?.beats.find((x) => x.id === b.id)?.vo?.words ??
    [];
  const k = body.k;
  if (k == null) throw fail('Select a word to split before.');
  const w = words[k];
  if (!w || k < 1) throw fail('Split before a word that is not the first.');
  const nth = words
    .slice(0, k + 1)
    .filter((x) => wordKey(x.w) === wordKey(w.w)).length;
  const r = splitBeat(dir, { beat: b.id, at: w.w, nth }, { by });
  return {
    kind: 'recording',
    op: 'split',
    edit: r.id,
    by,
    label: `Split ${short(nameOf(b))} before “${w.w}”`,
    undo: false,
  };
}

/** Cuts, splits and merges of an imported recording, through the engine's source-edit tools. */
export function recordingCommand(
  dir: string,
  h: StudioHistory,
  ok: boolean,
  raw: string,
  body: StudioRequest,
) {
  const name = typeof body.by === 'string' ? body.by.trim().slice(0, 80) : '';
  if (!name)
    throw fail('Recording edits record who asked for them: enter your name.');
  const by = { role: 'human', name };
  const sb = decodeStoryboard(JSON.parse(raw)),
    b = sb.beats.find((x) => x.id === body.beat);
  if (!b) throw fail('That scene no longer exists.');
  if (narrationOf(dir, b).kind !== 'recording')
    throw fail('This scene does not replay the source recording.');
  let entry: Omit<HistoryEntry, 'before' | 'after' | 'at'>;
  if (body.command === 'recording.cut') {
    const sel = recordingSelection(b.id, body);
    const report = cutWords(dir, sel, { by, dryRun: !!body.dryRun });
    if (body.dryRun)
      return {
        plan: {
          words: report.words,
          seconds: report.seconds,
          beats: report.beats.map((p) => ({
            beat: p.beat,
            deleted: !!p.deleted,
          })),
        },
      };
    entry = {
      kind: 'recording',
      op: 'cut',
      edit: report.id,
      words: report.beats.flatMap((p) => p.indices),
      by,
      label: `Cut “${short(report.words)}”`,
    };
  } else if (body.command === 'recording.split') {
    entry = splitRecording(dir, sb, raw, b, body, by);
  } else if (body.command === 'recording.merge') {
    const i = sb.beats.indexOf(b),
      next = sb.beats[i + 1];
    if (!next) throw fail('This is the last scene.');
    const r = mergeBeats(dir, { beats: [b.id, next.id] }, { by });
    entry = {
      kind: 'recording',
      op: 'merge',
      edit: r.id,
      by,
      label: `Merge ${short(nameOf(b))} with the next scene`,
      undo: false,
    };
  } else throw fail('Unknown recording edit.');
  const after = read(dir);
  if (!ok) {
    h.entries = [];
    h.cursor = 0;
  }
  h.entries = h.entries.slice(0, h.cursor);
  // Splits and merges are kept in review/edits.jsonl; their inverse is a new merge or split, not an undo.
  h.entries.push({
    ...entry,
    before: raw,
    after,
    at: new Date().toISOString(),
  });
  h.cursor = h.entries.length;
  trim(h);
  atomic(historyFile(dir), JSON.stringify(h));
  return studioState(dir);
}
