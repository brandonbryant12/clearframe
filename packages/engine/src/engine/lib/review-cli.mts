import type { RawOptions, CommandOptions } from '../commands/options.mjs';
import { rangeCommand } from './review-command-range.mjs';
import { runlogCommand } from './review-command-runlog.mjs';
import { paperCommand } from './review-command-paper.mjs';
import { revisionsCommand } from './review-command-revisions.mjs';
import { snapshotCommand } from './review-command-snapshot.mjs';
import { diffCommand } from './review-command-diff.mjs';
import { noteCommand } from './review-command-note.mjs';
import { notesCommand } from './review-command-notes.mjs';
import { reviseCommand } from './review-command-revise.mjs';
import { compareCommand } from './review-command-compare.mjs';
import { pageCommand } from './review-command-page.mjs';
import { acceptCommand } from './review-command-accept.mjs';
import { decideCommand } from './review-command-decide.mjs';
import { overrideCommand } from './review-command-override.mjs';
import { keepCommand } from './review-command-keep.mjs';
import { keepsCommand } from './review-command-keeps.mjs';
import { restoreCommand } from './review-command-restore.mjs';
import { cutCommand } from './review-command-cut.mjs';
import { uncutCommand } from './review-command-uncut.mjs';
import { splitCommand } from './review-command-split.mjs';
import { mergeCommand } from './review-command-merge.mjs';
export const REVIEW = new Set([
  'paper',
  'revisions',
  'snapshot',
  'diff',
  'note',
  'notes',
  'revise',
  'compare',
  'page',
  'accept',
  'reject',
  'decide',
  'override',
  'keep',
  'keeps',
  'restore',
  'cut',
  'uncut',
  'split',
  'merge',
  'runlog',
]);

const handlers = new Map([
  ['range', rangeCommand],
  ['runlog', runlogCommand],
  ['paper', paperCommand],
  ['revisions', revisionsCommand],
  ['snapshot', snapshotCommand],
  ['diff', diffCommand],
  ['note', noteCommand],
  ['notes', notesCommand],
  ['revise', reviseCommand],
  ['compare', compareCommand],
  ['page', pageCommand],
  ['accept', acceptCommand],
  ['reject', acceptCommand],
  ['decide', decideCommand],
  ['override', overrideCommand],
  ['keep', keepCommand],
  ['keeps', keepsCommand],
  ['restore', restoreCommand],
  ['cut', cutCommand],
  ['uncut', uncutCommand],
  ['split', splitCommand],
  ['merge', mergeCommand],
]);
export async function reviewCommand(
  cmd: string,
  dir: string,
  o: RawOptions,
  opts: CommandOptions,
  positionals: string[],
): Promise<void> {
  const handler = handlers.get(cmd);
  if (!handler) throw new Error(`Unknown review command ${cmd}`);
  await handler({ cmd, dir, o, opts, positionals });
}
