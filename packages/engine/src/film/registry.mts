// Runtime rules for each native block, in one place: how it is cued, which items it stages,
// when its values settle (the exit never starts earlier), which sounds land on its events and
// how critique groups it. Authoring metadata and prop validation live in catalog.mjs; the
// drawing lives in scene/native/src. A block missing here gets the defaults below.
import type { BlockProps, JobBeat, Staged } from './types.mjs';

/** The props whose items a block stages: each arrives on its own word, or in order. */
export type StagedKey = 'items' | 'phrases' | 'nodes' | 'pins';
export interface StagedSpec {
  key: StagedKey;
  offset: number;
  spacing: number | null;
  itemSeconds: (entrance: number) => number;
}
/** Seconds after the beat's cue by which its values have settled. */
export type SettleFn = (
  p: BlockProps,
  cue: number,
  entrance: number,
  spec: BlockRules,
) => number;
/** Adds a sound cue: name, film seconds, volume and weight (the heavier of two close cues wins). */
export type AddSound = (
  name: string,
  t: number,
  volume: number,
  weight?: number,
) => void;
export interface SoundTimes {
  start: number;
  cue: number;
  level: string;
}
export type SoundsFn = (b: JobBeat, add: AddSound, t: SoundTimes) => void;

export interface BlockRules {
  family: string;
  hero: boolean;
  numeric: boolean;
  cueDelay: number;
  preroll: number;
  staged?: StagedSpec;
  settle: SettleFn;
  sounds?: SoundsFn;
  tock?: boolean;
}
type BlockRule = Partial<BlockRules>;

/** Defaults: cue shortly after the header, settle when the entrance ends. */
const DEFAULTS = {
  family: 'type',
  hero: false,
  numeric: false,
  cueDelay: 0.35,
  preroll: 0,
};

const hero: BlockRule = { hero: true, cueDelay: 0.1, family: 'type' };
const staged = (
  key: StagedKey,
  offset: number,
  spacing: number | null,
  itemSeconds = (e: number): number => e,
): { staged: StagedSpec } => ({
  staged: { key, offset, spacing, itemSeconds },
});
/** A block's staged items once validated: objects, each with the time the job gave it. */
export function stagedItems(p: BlockProps, key: StagedKey): Staged[] {
  const list: ReadonlyArray<string | Staged> = p[key] ?? [];
  return list.filter((it): it is Staged => typeof it !== 'string');
}
const itemsSettle =
  (key: StagedKey): SettleFn =>
  (p, cue, e, spec) =>
    Math.max(
      cue + e,
      ...stagedItems(p, key).map(
        (it) => (it.at ?? cue) + (spec.staged?.itemSeconds(e) ?? e),
      ),
    );
const itemTimes = (b: JobBeat): number[] =>
  stagedItems(b.props, 'items').map((it) => it.at ?? 0);

export const REGISTRY = {
  title: hero,
  statement: hero,
  endcard: hero,
  // A chapter card arrives silently, as everything does unless an element names a sound.
  chapter: { ...hero },
  highlight: { ...hero, ...staged('phrases', 0.7, 0.6, () => 0.8) },
  quote: hero,
  callout: hero,
  checklist: {
    family: 'type',
    ...staged('items', 0.6, 0.55, (e) => Math.max(e, 0.4)),
    sounds: (b, add, t) =>
      itemTimes(b).forEach((at) => add('tock', t.start + at + 0.3, 0.22, 1)),
  },
  stat: {
    family: 'number',
    numeric: true,
    preroll: 1.0,
    settle: (p, cue, e) => cue + Math.max(1.4, 0.6 + e),
    sounds: heroNumber,
  },
  kpis: {
    family: 'number',
    numeric: true,
    ...staged('items', 0, 0.45, (e) => Math.max(1.3, e)),
    sounds: (b, add, t) =>
      itemTimes(b).forEach((at) => add('tick', t.start + at + 1.25, 0.22, 1)),
  },
  delta: {
    family: 'number',
    numeric: true,
    preroll: 1.3,
    settle: (p, cue, e) => cue + Math.max(0.45 + 1.3, 1 + e),
    sounds: heroNumber,
  },
  bars: {
    family: 'chart',
    numeric: true,
    settle: (p, cue) => {
      const grown = cue + ((p.data ?? []).length - 1) * 0.09 + 1.1;
      return p.focus
        ? Math.max(grown, (p.focus.at ?? 0) + (p.focus.dur ?? 0))
        : grown;
    },
  },
  line: {
    family: 'chart',
    numeric: true,
    settle: (p, cue, e) => cue + 1.6 + e,
  },
  waffle: {
    family: 'chart',
    numeric: true,
    // Cells arrive, then fill for 1.3 s: the count finishes ~1.9 s after its cue.
    preroll: 1.6,
    settle: (p, cue, e) => {
      // The validator fills total and cols (100 and 10 unless authored).
      const total = p.total ?? 100,
        cols = p.cols ?? 10;
      return (
        cue +
        Math.max(0.35 + (Math.ceil(total / cols) + cols) * 0.012 + 1.3, 0.7 + e)
      );
    },
  },
  ring: {
    family: 'chart',
    numeric: true,
    preroll: 1.0,
    settle: (p, cue, e) => cue + Math.max(1.4, 0.8 + e),
    sounds: heroNumber,
  },
  donut: {
    family: 'chart',
    numeric: true,
    settle: (p, cue, e) => cue + Math.max(1.5, 1.1 + e),
  },
  funnel: {
    family: 'chart',
    numeric: true,
    ...staged('items', 0, 0.45, (e) => Math.max(0.9, 0.3 + e)),
  },
  magnitude: {
    family: 'chart',
    numeric: true,
    ...staged('items', 0, 0.45, (e) => Math.max(0.9, 0.3 + e)),
    sounds: heroNumber,
  },
  compare: { family: 'layout' },
  matrix: { family: 'layout' },
  steps: { family: 'diagram', ...staged('items', 0, 0.45), tock: true },
  timeline: { family: 'diagram', ...staged('items', 0, 0.45), tock: true },
  flow: { family: 'diagram', ...staged('nodes', 0, null), tock: true },
  cycle: { family: 'diagram' },
  equation: { family: 'diagram' },
  breathing: { family: 'motion' },
  image: { family: 'media' },
  video: { family: 'media' },
  annotate: { family: 'media', ...staged('pins', 0.7, 0.6, (e) => e + 0.05) },
  kinetic: { family: 'speech' },
  canvas: { family: 'drawing' }, // elements are scheduled by canvas.mjs
  // A native GPU stage: its layers are compiled and scheduled by scene/compile.mjs, which also
  // raises the beat's settle time to its last arrival.
  stage: { family: 'drawing' },
} satisfies Record<string, BlockRule>;

function heroNumber(b: JobBeat, add: AddSound, t: SoundTimes): void {
  add('thud', t.cue + 1.35, 0.32, 3);
}

/** The rules for a block, with defaults filled in. */
export function rules(name: string): BlockRules {
  const entry: BlockRule =
    Object.entries(REGISTRY).find(([key]) => key === name)?.[1] ?? {};
  const rule = { ...DEFAULTS, ...entry };
  const stagedKey = rule.staged?.key;
  const settle: SettleFn =
    rule.settle ??
    (stagedKey
      ? itemsSettle(stagedKey)
      : (p, cue, e) => cue + e + (rule.hero ? 0.3 : 0));
  return { ...rule, settle };
}
