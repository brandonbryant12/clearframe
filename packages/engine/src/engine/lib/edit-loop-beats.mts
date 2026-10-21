// What restoring some beats touches: the files that made them, media other beats share, the
// recording they would replay, and where they go back in the beat order.
import fs from 'node:fs';
import path from 'node:path';
import { expandAssets } from './plates.mjs';
import { assetSrc } from './timing.mjs';
import {
  isRecorded,
  readTranscript,
  wasOf,
  type EditEntry,
  type VoMeta,
} from './recording-model.mjs';
import { slicePieces } from './recording-slices.mjs';
import {
  objectFile,
  readJSONFile,
  restoreObject,
  reviewPath,
  sha256File,
  writeJSONAtomic,
} from './store.mjs';
import { decodeStoryboard } from '../schemas.mjs';
import { isRecord } from './errors.mjs';

import type { Asset, Beat, Storyboard } from '../domain.mjs';

export interface SharedRewrite {
  file: string;
  beats: string[];
}

/** Asset ids a beat names (a layered plate set names its far, mid and near layers). */
function assetRefs(beat: Beat): { ids: Set<string>; files: Set<string> } {
  const ids = new Set<string>(),
    files = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (isRecord(v))
      for (const [k, x] of Object.entries(v)) {
        if (k === 'asset' && typeof x === 'string') ids.add(x);
        else if (k === 'plates' && typeof x === 'string')
          ['far', 'mid', 'near'].forEach((l) => ids.add(`${x}-${l}`));
        else if (k === 'file' && typeof x === 'string') files.add(x);
        else walk(x);
      }
  };
  walk([beat.props, beat.art, beat.plate]);
  return { ids, files };
}

/** The files that made one beat in a revision: its narration and the media it named. */
export function beatFiles(
  sbBeat: Beat,
  sbAssets: Asset[],
  inputs: Record<string, string>,
): string[] {
  const rels = new Set([
    `assets/vo/${sbBeat.id}.wav`,
    `assets/vo/${sbBeat.id}.json`,
  ]);
  const { ids, files } = assetRefs(sbBeat);
  for (const f of files) rels.add(f);
  for (const id of ids) {
    const a = sbAssets.find((x) => x.id === id);
    if (a?.file) rels.add(a.file);
    const name = id.replace(/[^a-z0-9_-]/gi, '');
    for (const rel of Object.keys(inputs))
      if (
        new RegExp(`^assets/(img|clips|sfx)/${name}\\.[a-z0-9]+$`, 'i').test(
          rel,
        )
      )
        rels.add(rel);
  }
  return [...rels].filter((rel) => inputs[rel]);
}

/** Media each beat uses now, as {relative path: [beat ids]} (narration excluded: it is per beat). */
interface MediaUsers {
  [file: string]: string[];
}
function mediaUsers(root: string, sb: Storyboard): MediaUsers {
  const assets = expandAssets(sb.assets ?? []);
  const users: Record<string, string[]> = {};
  for (const b of sb.beats) {
    const { ids, files } = assetRefs(b);
    const rels = new Set(files);
    for (const id of ids) {
      const a = assets.find((x) => x.id === id);
      const rel = a && assetSrc(root, a);
      if (rel) rels.add(rel);
    }
    for (const rel of rels) (users[rel] ??= []).push(b.id);
  }
  return users;
}
export const objectSha = (object: unknown): string | null =>
  /([0-9a-f]{64})/.exec(String(object))?.[1] ?? null;
const currentSha = (root: string, rel: string): string | null => {
  const f = path.join(root, rel);
  return fs.existsSync(f) ? sha256File(f) : null;
};

/**
 * Shared media a restore would rewrite under other beats: [{file, beats}] for each file the
 * restored beats need that differs now and is also used by a beat that is not being restored.
 */
export function sharedRewrites(
  root: string,
  files: [string, string][],
  restoring: Set<string>,
  sbNow: Storyboard,
): SharedRewrite[] {
  const users = mediaUsers(root, sbNow);
  const out: SharedRewrite[] = [];
  for (const [rel, object] of files) {
    if (rel.startsWith('assets/vo/')) continue;
    if (currentSha(root, rel) === objectSha(object)) continue;
    const others = (users[rel] ?? []).filter((id) => !restoring.has(id));
    if (others.length) out.push({ file: rel, beats: others });
  }
  return out;
}

/** Recorded beats whose recording would play twice: [[a, b]] pairs of beat ids. */
export function overlappingSources(
  root: string,
  sb: Storyboard,
  metaFor: (id: string) => VoMeta | null,
): string[][] {
  const transcript = readTranscript(root);
  if (!transcript) return [];
  const fps = sb.format?.fps ?? 30;
  const spans: [number, number, string][] = [];
  for (const b of sb.beats) {
    const m = metaFor(b.id);
    if (!isRecorded(m)) continue;
    for (const p of slicePieces(m, { rate: transcript.rate, fps }))
      if (!('pad' in p)) spans.push([p.from, p.to, b.id]);
  }
  spans.sort((x, y) => x[0] - y[0]);
  const out: string[][] = [];
  for (let i = 1; i < spans.length; i++)
    if (spans[i][0] < spans[i - 1][1] && spans[i][2] !== spans[i - 1][2])
      out.push([spans[i - 1][2], spans[i][2]]);
  return out;
}
export const storedJSON = (
  root: string,
  object: string | undefined,
): unknown => {
  const f = object && objectFile(root, object);
  return f ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};

export function restoreFiles(root: string, list: [string, string][]): void {
  for (const [rel, object] of list) {
    const dest = path.resolve(root, rel);
    if (!dest.startsWith(root + path.sep))
      throw new Error(`Refusing to restore outside the project: ${rel}`);
    restoreObject(root, object, dest);
  }
}
export const storyboardOf = (root: string, id: string): Storyboard =>
  decodeStoryboard(
    readJSONFile(reviewPath(root, 'revisions', id, 'storyboard.json')),
  );
export const readWorkingStoryboard = (root: string): Storyboard =>
  decodeStoryboard(readJSONFile(path.join(root, 'storyboard.json')));
export const writeStoryboard = (root: string, sb: Storyboard): void =>
  writeJSONAtomic(path.join(root, 'storyboard.json'), sb);
export const same = (x: unknown, y: unknown): boolean =>
  JSON.stringify(x) === JSON.stringify(y);

/**
 * For each beat of `sb`, the beat of `ids` it is or came from: split parts (followed through
 * the edit log, however many times split) are their original, a merged beat is its first part;
 * null for a beat that is new since.
 */
function originsIn(
  sb: Storyboard,
  ids: Set<string>,
  edits: EditEntry[],
): Map<string, string | null> {
  const splitFrom = new Map<string, string>();
  for (const e of edits) {
    if (e.op !== 'split' || !e.beat) continue;
    for (const id of Array.isArray(e.into) ? e.into : [])
      splitFrom.set(id, e.beat);
  }
  const of = (b: Beat): string | null => {
    let id = b.id;
    for (
      const seen = new Set<string>();
      !ids.has(id) && splitFrom.has(id) && !seen.has(id);
      id = splitFrom.get(id) ?? id
    )
      seen.add(id);
    return ids.has(id)
      ? id
      : ((wasOf(b) ?? []).find((w) => ids.has(w)) ?? null);
  };
  return new Map(sb.beats.map((b) => [b.id, of(b)]));
}

/**
 * Insert `beat` where it stood in `order` (a revision's beat ids): after what is left of the
 * nearest earlier beat of `order` (itself, or its parts after a split) and after the beats new
 * since that follow it, so a beat added since keeps the beat before it.
 */
export function insertInOrder(
  sb: Storyboard,
  beat: Beat,
  order: string[],
  edits: EditEntry[],
): void {
  const origin = originsIn(sb, new Set(order), edits);
  const i = order.indexOf(beat.id);
  for (let k = i - 1; k >= 0; k--) {
    let at = sb.beats.findLastIndex((b) => origin.get(b.id) === order[k]);
    if (at < 0) continue;
    while (at + 1 < sb.beats.length && origin.get(sb.beats[at + 1].id) == null)
      at++;
    sb.beats.splice(at + 1, 0, beat);
    return;
  }
  sb.beats.unshift(beat);
}

/**
 * Put the beats of `sb` that come from the parent back in the parent's order, in the places they
 * hold. Parts of a beat split since keep their order and move with it; a beat new since moves
 * with the beat before it.
 */
export function parentOrder(
  sb: Storyboard,
  sbP: Storyboard,
  edits: EditEntry[],
): void {
  const rank = new Map(sbP.beats.map((b, i) => [b.id, i]));
  const origin = originsIn(sb, new Set(rank.keys()), edits);
  const head: Beat[] = [],
    groups: { rank: number; beats: Beat[] }[] = [];
  for (const b of sb.beats) {
    const o = origin.get(b.id);
    if (o != null) groups.push({ rank: rank.get(o) ?? 0, beats: [b] });
    else (groups.at(-1)?.beats ?? head).push(b);
  }
  sb.beats = [
    ...head,
    ...groups
      .map((g, n) => ({ ...g, n }))
      .sort((x, y) => x.rank - y.rank || x.n - y.n)
      .flatMap((g) => g.beats),
  ];
}

/**
 * Did a candidate rearrange beats (`sbP` → `sbC`), and is that arrangement still as it left it
 * in `sbNow`? Beats are followed through splits and merges made since; a beat moved away from the
 * place its neighbours give it, or parts of one beat separated, is a later rearrangement.
 */
export function orderSince(
  sbP: Storyboard,
  sbC: Storyboard,
  sbNow: Storyboard,
  edits: EditEntry[],
): 'unchanged' | 'candidate' | 'since' {
  const inP = new Set(sbP.beats.map((b) => b.id)),
    inC = new Set(sbC.beats.map((b) => b.id));
  const orderP = sbP.beats.map((b) => b.id).filter((id) => inC.has(id)),
    orderC = sbC.beats.map((b) => b.id).filter((id) => inP.has(id));
  if (same(orderP, orderC)) return 'unchanged';
  const origin = originsIn(sbNow, inP, edits);
  const keys = sbNow.beats
    .map((b) => origin.get(b.id))
    .filter((o): o is string => o != null && inC.has(o));
  const runs = keys.filter((o, n) => o !== keys[n - 1]);
  return new Set(runs).size === runs.length &&
    same(
      runs,
      orderC.filter((id) => runs.includes(id)),
    )
    ? 'candidate'
    : 'since';
}

/** Move a file into review/aside/<restore point>/… (a rename on the same volume). */
export function setAside(root: string, rel: string, point: string): string {
  const to = reviewPath(root, 'aside', point, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(path.join(root, rel), to);
  return path.relative(root, to).split(path.sep).join('/');
}
