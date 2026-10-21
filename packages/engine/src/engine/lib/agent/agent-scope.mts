import fs from 'node:fs';
import path from 'node:path';
import * as Schema from 'effect/Schema';
import type { Storyboard } from '../../domain.mjs';
import { decodeStoryboard } from '../../schemas.mjs';
import { canonical } from '../store.mjs';
import { isRecord } from '../harness/contracts.mjs';
import {
  ScopeSchema,
  getAt,
  type MessageScope,
  type ConversationLink,
  type WorkingMode,
  type AgentFilm,
} from './contracts.mjs';
import { sha, clip, fail } from './agent-common.mjs';
const SCOPES = new Set([
  'film',
  'scene',
  'layer',
  'range',
  'moment',
  'note',
  'asset',
]);

/** A scope the browser snapshotted at send time, checked and bounded. */
export function cleanScope(s: unknown): MessageScope {
  if (s == null) return { kind: 'film' };
  if (!isRecord(s) || typeof s.kind !== 'string' || !SCOPES.has(s.kind))
    throw fail('Unknown message scope.');
  const id = (v: unknown) =>
      typeof v === 'string' && v.length <= 120 ? v : undefined,
    num = (v: unknown) =>
      typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e6
        ? Math.round(v * 1000) / 1000
        : undefined;
  const out = {
    kind: s.kind,
    label: id(s.label)?.slice(0, 120),
    beats: Array.isArray(s.beats)
      ? s.beats
          .filter((value): value is string => id(value) !== undefined)
          .slice(0, 50)
      : undefined,
    element:
      typeof s.element === 'string' &&
      /^[\w]+(\.[\w]+)*\.\d+$/.test(s.element) &&
      s.element.length <= 120
        ? s.element
        : undefined,
    from: num(s.from),
    to: num(s.to),
    t: num(s.t),
    note: id(s.note),
    noteText:
      typeof s.noteText === 'string' ? clip(s.noteText, 1200) : undefined,
    asset: id(s.asset),
  };
  if (
    ['scene', 'layer', 'range', 'moment'].includes(out.kind) &&
    !out.beats?.length
  )
    throw fail('That scope names no scenes.');
  if (out.kind === 'layer' && out.beats?.length !== 1)
    throw fail('A layer scope names one scene.');
  if (out.kind === 'layer' && !out.element)
    throw fail('A layer scope names its element.');
  return Schema.decodeUnknownSync(ScopeSchema)(
    Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)),
  );
}

/**
 * Check a scope against the working copy at send time and give a layer a stable identity: its list,
 * index, own id (when it has one), type and the list's length. Edits are later held to exactly that
 * element (tools.mjs); a pinned layer that no longer resolves is refused rather than guessed.
 */
export function resolveScope(dir: string, scope: MessageScope): MessageScope {
  if (
    !['scene', 'layer', 'range', 'moment', 'note'].includes(scope.kind) ||
    !scope.beats?.length
  )
    return scope;
  const sb = decodeStoryboard(
    JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8')),
  );
  const missing = scope.beats.filter(
    (id) => !sb.beats.some((b) => b.id === id),
  );
  if (missing.length)
    throw fail(
      `The scope names scenes that no longer exist (${missing.join(', ')}). Pin the scope again.`,
      409,
    );
  if (scope.kind !== 'layer') return scope;
  if (!scope.element) throw fail('A layer scope names its element.');
  const beatId = scope.beats[0];
  const beat = sb.beats.find((b) => b.id === beatId),
    parts = scope.element.split('.'),
    index = Number(parts.at(-1)),
    list = parts.slice(0, -1).join('.');
  const arr = getAt(beat, list),
    el = Array.isArray(arr) ? arr[index] : null;
  if (!Number.isInteger(index) || !isRecord(el))
    throw fail(
      'The pinned layer is not in that scene any more. Select it again and pin it.',
      409,
    );
  return {
    ...scope,
    layer: {
      list,
      index,
      id: typeof el.id === 'string' || typeof el.id === 'number' ? el.id : null,
      type: typeof el.type === 'string' ? el.type : null,
      length: Array.isArray(arr) ? arr.length : 0,
      sig: sha(canonical(el)),
    },
  };
}

/** The context block appended to what the person typed, so the agent works on what they meant. */
export const MODES = {
  oneshot:
    'one-shot — carry the request through to a watchable result without stopping for approval at each step: plan briefly, edit in a few labelled batches, render the rough cut (clearframe_render draft) and follow it to the end, then report what is ready and what is a placeholder. Ask only when you are blocked.',
  together:
    'together — the person is directing: work in small steps they can follow. Propose a short plan before large changes and wait for their answer; make one change at a time; show it with a still or a section preview; end your reply with one clear question when a decision is theirs.',
};
export const modeOf = (l: Pick<ConversationLink, 'mode'>): WorkingMode =>
  l.mode && l.mode in MODES ? l.mode : 'together';

export function contextBlock({
  film,
  scope,
  hash,
  revision,
  t,
  mode,
}: {
  film: AgentFilm;
  scope?: MessageScope;
  hash?: string | null;
  revision?: string | null;
  t?: number | null;
  mode?: WorkingMode;
}) {
  const lines = [`film: ${film.title} (${film.folder})`];
  if (mode) lines.push(`working mode: ${MODES[mode] ?? mode}`);
  const s = scope ?? { kind: 'film' };
  const beats = s.beats?.length ? s.beats.join(', ') : null;
  lines.push(
    `scope: ${
      {
        film: 'the whole film',
        scene: `scene ${beats}`,
        layer: `layer ${s.element} in scene ${beats}`,
        range: `time range ${s.from ?? '?'}s–${s.to ?? '?'}s (scenes ${beats})`,
        moment: `the moment at ${s.t ?? t ?? '?'}s${beats ? ` (scene ${beats})` : ''}`,
        note: `review note ${s.note}${beats ? ` on scene ${beats}` : ''}`,
        asset: `project file ${s.asset}`,
      }[s.kind]
    }`,
  );
  if (s.noteText) lines.push(`note text: ${s.noteText}`);
  if (t != null) lines.push(`playhead: ${t}s`);
  if (hash) lines.push(`working copy hash when sent: ${hash}`);
  if (revision) lines.push(`revision on screen: ${revision}`);
  // Every message carries this, so sessions that began before the rule still follow it.
  lines.push(
    'reporting: describe outputs as measured (clearframe_job "actual video", clearframe_sound "as made"); a draft line was spoken by the OS voice, never by the Google voice or style it is set to',
  );
  return `\n\n<clearframe-context>\n${lines.join('\n')}\n</clearframe-context>`;
}

/** Beats a candidate storyboard changes, adds or removes, and whether film-wide settings change. */
export function touched(before: Storyboard, after: Storyboard) {
  const was = new Map(before.beats.map((b) => [b.id, canonical(b)])),
    now = new Map(after.beats.map((b) => [b.id, canonical(b)]));
  const beats = new Set<string>();
  for (const [id, c] of now) if (was.get(id) !== c) beats.add(id);
  for (const id of was.keys()) if (!now.has(id)) beats.add(id);
  const order =
    canonical(before.beats.map((b) => b.id).filter((id) => now.has(id))) !==
    canonical(after.beats.map((b) => b.id).filter((id) => was.has(id)));
  const film =
    canonical({ ...before, beats: undefined, sources: undefined }) !==
    canonical({ ...after, beats: undefined, sources: undefined });
  return {
    beats: [...beats],
    film,
    order,
    added: [...now.keys()].filter((id) => !was.has(id)),
  };
}
