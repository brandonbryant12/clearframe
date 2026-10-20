import type { WordPos } from './recording-select.mjs';
import type { EditOptions } from './recording-cut.mjs';

import { readStoryboardFile, readMeta } from './recording-model.mjs';

import fs from 'node:fs';

import {
  ensureTranscript,
  isRecorded,
  keptWords,
  identitiesOf,
  cutAll,
} from './recording.mjs';
import { wordKey } from './word-timing.mjs';

export interface PaperRun {
  from: WordPos;
  to: WordPos;
  words: string[];
}

/**
 * Words struck through (~~…~~) in a printed paper edit → recording cuts. Each beat's line must
 * still match the film word for word; a beat that changed since printing is refused, never
 * guessed. Adjacent struck runs across a beat boundary become one cut.
 */
export function paperCuts(root: string, file: string): PaperRun[] {
  const text = fs.readFileSync(file, 'utf8');
  if (!/clearframe paper-edit v1/.test(text))
    throw new Error(`${file} is not a ClearFrame paper edit.`);
  const transcript = ensureTranscript(root);
  const runs: PaperRun[] = [];
  for (const m of text.matchAll(
    /^### \[([a-z0-9][a-z0-9-_]*)\][^\n]*\n(?:(?!### )[^\n]*\n)*?> ([^\n]*)/gim,
  )) {
    const [, beat, line] = m;
    const meta = readMeta(root, beat);
    if (!isRecorded(meta)) continue;
    // Drop already-applied cut markers; split into words, remembering which were struck.
    const tokens = paperTokens(beat, line);
    const kept = keptWords(meta, transcript);
    const same =
      tokens.length === kept.length &&
      tokens.every((x, k) => wordKey(x.w) === wordKey(kept[k].w));
    if (!same) {
      if (tokens.some((x) => x.struck))
        throw new Error(
          `[${beat}] no longer reads as printed (it was edited since); print the paper edit again.`,
        );
      continue;
    }
    tokens.forEach((x, k) => {
      if (!x.struck) return;
      const last = runs.at(-1);
      if (last && last.to.beat === beat && last.to.k === k - 1)
        last.to = { beat, k };
      else runs.push({ from: { beat, k }, to: { beat, k }, words: [] });
    });
  }
  return runs;
}

/**
 * Struck words as cut selections, by identity: one per run, runs that touch across a beat
 * joined (one cut, one undo). Nothing is applied here.
 */
export function paperSelections(root: string, file: string) {
  const runs = paperCuts(root, file);
  if (!runs.length) return [];
  const sb = readStoryboardFile(root);
  const order = sb.beats.map((b) => b.id);
  const transcript = ensureTranscript(root);
  const joined: PaperRun[] = [];
  for (const r of runs) {
    const prev = joined.at(-1);
    const meta = prev && readMeta(root, prev.to.beat);
    const lastK = isRecorded(meta)
      ? keptWords(meta, transcript).length - 1
      : -1;
    if (
      prev &&
      prev.to.k === lastK &&
      r.from.k === 0 &&
      order.indexOf(r.from.beat) === order.indexOf(prev.to.beat) + 1
    )
      prev.to = r.to;
    else joined.push({ ...r });
  }
  return identitiesOf(root, joined).map((source) => ({ source }));
}

/** Apply struck words as cuts: all of them or none (see cutAll). */
export function applyPaperCuts(root: string, file: string, opts: EditOptions) {
  const selections = paperSelections(root, file);
  return selections.length ? cutAll(root, selections, opts) : [];
}
function paperTokens(beat: string, line: string) {
  const clean = line.replace(/\[cut [^\]]*\]/g, ' ');
  const tokens = [];
  let struck = false;
  for (const part of clean.split(/(~~)/)) {
    if (part === '~~') {
      struck = !struck;
      continue;
    }
    for (const w of part.split(/\s+/).filter(Boolean))
      tokens.push({ w, struck });
  }
  if (struck) throw new Error(`[${beat}]: a ~~ is not closed.`);
  return tokens;
}
