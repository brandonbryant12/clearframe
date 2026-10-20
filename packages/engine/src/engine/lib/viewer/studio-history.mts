import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as Schema from 'effect/Schema';
import { canonical, reviewPath } from '../store.mjs';
import type { Storyboard } from '../../domain.mjs';
import { errorCode } from '../harness/contracts.mjs';
import { HistorySchema, type StudioHistory } from './studio-contracts.mjs';
export const sha = (s: string) =>
  crypto.createHash('sha256').update(s).digest('hex');
export const read = (dir: string) =>
  fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8');
const same = (a: string | undefined, b: string | undefined) => {
  try {
    return canonical(JSON.parse(a ?? '')) === canonical(JSON.parse(b ?? ''));
  } catch {
    return a === b;
  }
};
export const historyFile = (dir: string) =>
  reviewPath(dir, 'studio-history.json');
export const atomic = (file: string, data: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
};
const HISTORY_BYTES = 8e6;
export const stringify = (sb: Storyboard) => JSON.stringify(sb, null, 2) + '\n';
export const fail = (message: string) =>
  Object.assign(new Error(message), { status: 400 });

// ------------------------------------------------------------------ history

/** Undo history, repaired if a write was interrupted between the history and the storyboard. */
export function loadHistory(dir: string, raw: string): StudioHistory {
  let h: StudioHistory | null;
  try {
    h = Schema.decodeUnknownSync(HistorySchema)(
      JSON.parse(fs.readFileSync(historyFile(dir), 'utf8')),
    );
  } catch (e) {
    if (errorCode(e) === 'ENOENT' || e instanceof SyntaxError) h = null;
    else throw e;
  }
  if (!h || !Array.isArray(h.entries) || !Number.isInteger(h.cursor))
    h = { entries: [], cursor: 0 };
  h.cursor = Math.max(0, Math.min(h.cursor, h.entries.length));
  // The history is written first: if the storyboard write never landed, the newest step did not happen.
  const last = h.entries[h.cursor - 1];
  if (last && !same(last.after, raw) && same(last.before, raw)) {
    h.entries.splice(h.cursor - 1);
    h.cursor--;
  }
  return h;
}
const expected = (h: StudioHistory) =>
  h.cursor ? h.entries[h.cursor - 1]?.after : h.entries[0]?.before;
export const aligned = (h: StudioHistory, raw: string) =>
  expected(h) == null || same(expected(h), raw);
export function trim(h: StudioHistory) {
  h.entries = h.entries.slice(-80);
  while (
    h.entries.length > 1 &&
    h.entries.reduce(
      (n, e) => n + (e.before?.length ?? 0) + (e.after?.length ?? 0),
      0,
    ) > HISTORY_BYTES
  )
    h.entries.shift();
  h.cursor = Math.min(h.cursor, h.entries.length);
}
