import { studioState } from './studio-state.mjs';
export { studioState } from './studio-state.mjs';
import { step, undoRun, recordingCommand } from './studio-history-actions.mjs';
// Validated studio transactions and persisted undo for the browser and local automation.
import fs from 'node:fs';
import path from 'node:path';
import * as Schema from 'effect/Schema';
import { canonical, withLock, reviewPath } from '../store.mjs';
import { validateStoryboard } from '../project.mjs';

import { decodeStoryboard } from '../../schemas.mjs';
import { errorStatus, isRecord } from '../harness/contracts.mjs';
import {
  OperationsSchema,
  StudioRequestSchema,
  type StudioRequest,
} from './studio-contracts.mjs';
import {
  read,
  sha,
  stringify,
  fail,
  atomic,
  historyFile,
  loadHistory,
  aligned,
  trim,
} from './studio-history.mjs';
import { newErrors } from './studio-analysis.mjs';
import { applyOp, touchesBudget } from './studio-operations.mjs';
export { analyse, narrationOf, changesSince } from './studio-analysis.mjs';
export { studioSchema } from './studio-catalog.mjs';

/** Refuse fast when another process (a CLI cut, a revise) holds the project's review lock. */
function locked<A>(dir: string, fn: () => A): A {
  const lock = reviewPath(dir, '.lock');
  try {
    const owner = Number(fs.readFileSync(lock, 'utf8'));
    if (owner && owner !== process.pid) {
      try {
        process.kill(owner, 0);
        throw Object.assign(
          new Error(
            `Another ClearFrame command (process ${owner}) is changing this film. Try again in a moment.`,
          ),
          { status: 409 },
        );
      } catch (e) {
        if (errorStatus(e)) throw e;
      }
    }
  } catch (e) {
    if (errorStatus(e)) throw e;
  }
  return withLock(dir, fn);
}

interface EditActor {
  by: string;
  run?: string;
}
function placeholderError(placeholder: unknown): boolean {
  if (placeholder == null) return false;
  if (typeof placeholder === 'string')
    return !placeholder.trim() || placeholder.length > 140;
  return (
    !isRecord(placeholder) ||
    typeof placeholder.text !== 'string' ||
    placeholder.text.length > 140
  );
}
function applyBatch(
  dir: string,
  body: StudioRequest,
  raw: string,
  actor: EditActor | null,
) {
  const sb = decodeStoryboard(JSON.parse(raw)),
    ops = Schema.decodeUnknownSync(OperationsSchema)(
      body.command === 'batch' ? body.ops : [body],
    );
  // The spending ceiling is the person's to set: an agent's edit may not raise or remove it.
  if (actor?.by === 'agent' && Array.isArray(ops) && ops.some(touchesBudget))
    throw fail(
      'Only a person can change the film budget (clearframe studio DIR set budget N).',
    );
  if (!Array.isArray(ops) || !ops.length || ops.length > 200)
    throw fail('A batch holds 1–200 changes.');
  const labels = ops.map((op) => {
    if (
      op?.command === 'batch' ||
      op?.command?.startsWith?.('recording.') ||
      ['undo', 'redo'].includes(op?.command)
    )
      throw fail('That command cannot be batched.');
    return applyOp(dir, sb, op);
  });
  const errors = validateStoryboard(sb);
  // The renderer's own limit on declared stand-ins (checked there only for rough cuts).
  for (const b of sb.beats)
    if (placeholderError(b.placeholder))
      errors.push(
        `${b.id}: placeholder must be a description up to 140 characters (or {text})`,
      );
  if (errors.length) throw fail(errors.join('\n'));

  const added = newErrors(dir, decodeStoryboard(JSON.parse(raw)), sb);
  if (added.length)
    throw Object.assign(
      fail(
        `Not saved — the engine would refuse this:\n${added.slice(0, 4).join('\n')}`,
      ),
      { errors: added },
    );
  return { sb, ops, labels };
}

/**
 * Run a studio command against the hash the client last saw; returns the new state. `actor` marks
 * who made the change (an agent run is `{ by: 'agent', run }`) so its steps can be undone together.
 */
export function studioCommand(
  dir: string,
  input: unknown,
  { actor = null }: { actor?: { by: string; run?: string } | null } = {},
) {
  const body: StudioRequest =
    Schema.decodeUnknownSync(StudioRequestSchema)(input);
  return locked(dir, () => {
    const raw = read(dir);
    if (body.hash !== sha(raw))
      throw Object.assign(
        new Error(
          'This film changed elsewhere. Reload the working copy before editing.',
        ),
        { status: 409 },
      );
    const h = loadHistory(dir, raw),
      ok = aligned(h, raw);
    const { command } = body;
    if (command === 'undo' || command === 'redo')
      return step(dir, h, ok, command === 'undo');
    if (command === 'undoRun') return undoRun(dir, h, ok, body.run);
    if (command?.startsWith('recording.'))
      return recordingCommand(dir, h, ok, raw, body);
    const { sb, ops, labels } = applyBatch(dir, body, raw, actor);
    if (canonical(sb) === canonical(decodeStoryboard(JSON.parse(raw))))
      return {
        ...studioState(dir),
        created: ops.map((o) => o.created).filter(Boolean),
      };
    const after = stringify(sb);
    if (!ok) {
      h.entries = [];
      h.cursor = 0;
    }
    h.entries = h.entries.slice(0, h.cursor);
    const defaultLabel =
      labels.length === 1 ? labels[0] : `${labels.length} changes`;
    const label = body.label?.trim().slice(0, 120) || defaultLabel;
    h.entries.push({
      before: raw,
      after,
      label,
      at: new Date().toISOString(),
      kind: 'edit',
      ...(actor ? { by: actor.by, run: actor.run ?? null } : {}),
    });
    h.cursor = h.entries.length;
    trim(h);
    atomic(historyFile(dir), JSON.stringify(h));
    atomic(path.join(dir, 'storyboard.json'), after);
    return {
      ...studioState(dir),
      created: ops.map((o) => o.created).filter(Boolean),
    };
  });
}

/** Apply operations to a copy, without validating or writing: what a batch would change. */
export function planOps(dir: string, input: unknown) {
  const raw = read(dir),
    after = decodeStoryboard(JSON.parse(raw));
  const ops = Schema.decodeUnknownSync(OperationsSchema)(input);
  if (!Array.isArray(ops) || !ops.length || ops.length > 200)
    throw fail('A batch holds 1–200 changes.');
  for (const op of ops) {
    if (
      !op ||
      typeof op !== 'object' ||
      ['batch', 'undo', 'redo', 'undoRun'].includes(op.command) ||
      String(op.command ?? '').startsWith('recording.')
    )
      throw fail('That command cannot be batched.');
    applyOp(dir, after, structuredClone(op));
  }
  return { before: decodeStoryboard(JSON.parse(raw)), after, hash: sha(raw) };
}
