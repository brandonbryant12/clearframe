import { isRecord } from './errors.mjs';
import fs from 'node:fs';
import path from 'node:path';
import * as Schema from 'effect/Schema';
import type { Beat, Storyboard, Timing } from '../domain.mjs';
import { StoryboardSchema, TimingSchema } from '../schemas.mjs';
import type { QaFinding, QaResult, ReviewedBeat } from './qa-contracts.mjs';
import {
  TYPE_BLOCKS,
  NUMBER_CARDS,
  FRAMING,
  typedCanvas,
  pictureLine,
} from './qa-advice.mjs';
import { sketchByName, sketchWords } from '../../film/sketches.mjs';
import { castOverlaps } from '../../film/cast.mjs';
import { droppedFacts } from './figures.mjs';
import { figuresIn } from './pictures.mjs';
import { spoken } from './word-align.mjs';

export function figureCard(b: ReviewedBeat): boolean {
  if (b.plate || b.stage || b.art?.under?.length) return false;
  if (NUMBER_CARDS.includes(b.block ?? '')) return true;
  if (b.block !== 'canvas' || b.props?.chart?.kind !== 'number') return false;
  const values: readonly unknown[] = Array.isArray(b.props.chart.values)
    ? b.props.chart.values
    : [];
  return (
    values.filter((v) => isRecord(v) && v.say).length <= 1 &&
    Object.keys(b.props).every((k) => k === 'chart' || FRAMING.has(k)) &&
    !(b.props.elements ?? []).length
  );
}
export function typeOnly(b: ReviewedBeat): boolean {
  return (
    (TYPE_BLOCKS.includes(b.block ?? '') &&
      !b.plate &&
      !b.art?.under?.length &&
      !b.stage) ||
    typedCanvas(b) ||
    figureCard(b)
  );
}
function blankScenes(q: QaResult, warnings: string[]): string[] {
  return [
    ...warnings
      .map((w) => w.match(/^([^:]+): the voice starts ([\d.]+) s before/))
      .filter((m): m is RegExpMatchArray => m != null && Number(m[2]) >= 2)
      .map(
        (m) =>
          `    ${m[1]}: the voice talks for ${m[2]} s over an empty scene. Put the picture on screen by the first word (cue it to an earlier word, or draw its frame at 0 and only the change on the late word).`,
      ),
    ...q.findings
      .filter((f) => f.kind === 'empty')
      .map(
        (f) =>
          `    ${f.beat}: next to nothing on screen for ${f.seconds} s (${f.t}–${f.end} s) under the voice: ${f.fix ?? 'put its picture (card, chart, object) on the first frame and animate only the change on the words'}.`,
      ),
  ];
}
function heldStats(q: QaResult) {
  const held = q.findings.filter(
    (f) => f.kind === 'held' && !f.deliberate && f.level === 'warn',
  );
  const voicedHeld =
    Math.round(10 * held.reduce((t, f) => t + (f.seconds ?? 0), 0)) / 10;
  const byBeat: Record<string, number> = {};
  for (const f of held)
    byBeat[f.beat ?? '?'] = (byBeat[f.beat ?? '?'] ?? 0) + (f.seconds ?? 0);
  const allowance = Math.round(2 * q.summary.seconds) / 10;
  const overflow = Math.max(
    0,
    Math.round(10 * ((q.summary.deliberateSeconds ?? 0) - allowance)) / 10,
  );
  const share = q.summary.seconds
    ? Math.round((100 * (voicedHeld + overflow)) / q.summary.seconds)
    : 0;
  const worst = Object.entries(byBeat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  return { held, voicedHeld, overflow, share, worst };
}
function verdict(share: number): string {
  if (share >= 40)
    return 'READS AS NARRATED SLIDES (40% or more): the picture sits still while the voice talks';
  if (share >= 20)
    return 'some scenes hold still under the voice (20–40%: fix the stillest)';
  return 'the picture keeps moving with the voice (under 20%)';
}
function sourceOmissions(
  dir: string,
  sb: Storyboard,
  seconds: number,
): string[] {
  if (!sb.length || seconds >= 0.75 * sb.length) return [];
  try {
    return (
      droppedFacts(dir, sb, {
        spokenNumbers: (vo: string) =>
          figuresIn(vo, spoken).map((f) => f.value),
      }) ?? []
    );
  } catch {
    return [];
  }
}
function placeholdersIn(sb: Storyboard): [string, string[]][] {
  return sb.beats.flatMap((b) => {
    if (!b.props?.sketch || !sketchByName(b.props.sketch)?.keep) return [];
    const left = sketchWords(b.props.sketch, b.props.sketchParams).filter(
      (w) => !(w in (b.props?.sketchText ?? {})),
    );
    return left.length ? [[b.id, left]] : [];
  });
}
function castWarnings(sb: Storyboard, q: QaResult, timing: Timing): string[] {
  try {
    return castOverlaps(sb, {
      width: q.width ?? timing.width ?? 1920,
      height: q.height ?? timing.height ?? 1080,
    });
  } catch {
    return [];
  }
}
export function verdictState(dir: string, q: QaResult, warnings: string[]) {
  const s = q.summary;
  const sb = Schema.decodeUnknownSync(StoryboardSchema)(
    JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8')),
  );
  const timing0 = Schema.decodeUnknownSync(TimingSchema)(
    JSON.parse(fs.readFileSync(path.join(dir, 'build/timing.json'), 'utf8')),
  );
  const timed = timing0.beats ?? [];
  const stats = heldStats(q);
  const blank = blankScenes(q, warnings);
  const typeSeconds = timed.reduce(
    (t, tb, i) =>
      t +
      (typeOnly(sb.beats[tb.index ?? i] ?? {})
        ? (tb.dur ?? tb.end - tb.start)
        : 0),
    0,
  );
  const typeShare = s.seconds ? Math.round((100 * typeSeconds) / s.seconds) : 0;
  const said =
    typeShare >= 60 && stats.share < 40
      ? 'the picture moves, but as words: type over a background reads as narrated slides too'
      : verdict(stats.share);
  const short = Boolean(sb.length && s.seconds < 0.6 * sb.length);
  const dropped = sourceOmissions(dir, sb, s.seconds);
  const narrated = timed.filter((tb) => tb.vo?.text),
    unvoiced = narrated.filter((tb) => !tb.vo?.src);
  const mute = narrated.length > 0 && unvoiced.length > narrated.length / 2;
  const placeholders = placeholdersIn(sb);
  const fileSources = sb.beats
    .filter((b) =>
      /(^|[\s(/])[\w.-]+\.(mjs|js|json|wav|txt)\b/.test(
        String(b.props?.source ?? ''),
      ),
    )
    .map((b) => b.id);
  const overlaps = [...new Set([...warnings, ...castWarnings(sb, q, timing0)])]
    .map((w) => w.match(/^([^:]+): overlap: (.*)$/))
    .filter((m): m is RegExpMatchArray => m != null);
  const evidence = q.evidence ?? { scope: 'unbound', problems: [] };
  const unbound = evidence.scope !== 'bound';
  const broken = q.findings.filter(
    (f) => f.level === 'error' && f.kind !== 'identity',
  );
  const ready = ![
    unbound,
    stats.share >= 40,
    typeShare >= 60 && stats.share < 40,
    blank.length,
    short,
    mute,
    placeholders.length,
    fileSources.length,
    overlaps.length,
    broken.length,
  ].some(Boolean);
  const typed = timed
    .map((tb, i) => sb.beats[tb.index ?? i])
    .filter((b): b is Beat => Boolean(b && typeOnly(b)));
  const pictures = typed.map((b): [Beat, string | null] => [
    b,
    pictureLine(b.vo),
  ]);
  return {
    dir,
    q,
    s,
    sb,
    timed,
    ...stats,
    blank,
    typeShare,
    said,
    short,
    dropped,
    narrated,
    unvoiced,
    mute,
    placeholders,
    fileSources,
    overlaps,
    evidence,
    unbound,
    broken,
    ready,
    pictures,
  };
}
export type VerdictState = ReturnType<typeof verdictState>;
export function fixOf(state: VerdictState, id: string): QaFinding | undefined {
  return state.held.find((f) => f.beat === id && f.fix);
}
