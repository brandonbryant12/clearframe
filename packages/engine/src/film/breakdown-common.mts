import type { Timed, CanvasElement } from './types.mjs';
import type {
  BreakdownSpec,
  BreakdownPart,
  BreakdownPartInput,
  BreakdownRow,
  BreakdownBar,
} from './breakdown-contracts.mjs';
export function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`breakdown: ${message}`);
}
export const finite = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e12;
export const show = { at: 0, enter: 'none' };
// Layout estimate only (about half an em per character); `fit` caps each line at its room and the
// native frame audit in `check` is what proves nothing overflows.
export const textWidth = (value: string, size: number): number =>
  String(value).length * size * 0.56;
export const slug = (s: string): string =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 24)
    .replace(/-+$/, '') || 'part';
export function own(
  o: unknown,
  keys: string[],
  name: string,
): asserts o is Record<string, unknown> {
  check(
    o != null && typeof o === 'object' && !Array.isArray(o),
    `${name} must be an object`,
  );
  for (const k of Object.keys(o))
    check(
      keys.includes(k),
      `unknown ${name}.${k} (it takes ${keys.join(', ')})`,
    );
}
export const words = (v: unknown, name: string, max: number): string => {
  check(
    typeof v === 'string' && v.trim() && v.length <= max,
    `${name} needs text up to ${max} characters`,
  );
  return v;
};
export const timing = (v: Timed, name: string) => {
  const given = (['say', 'cue', 'at'] as const).filter((k) => v[k] != null);
  check(given.length <= 1, `${name} takes one of say, cue or at`);
  check(
    v.say == null ||
      (typeof v.say === 'string' && v.say.trim() && v.say.length <= 40),
    `${name}.say is a word or short phrase from the narration`,
  );
  check(
    v.cue == null || (typeof v.cue === 'string' && v.cue.trim()),
    `${name}.cue names one of the beat's moments`,
  );
  check(
    v.at == null || (finite(v.at) && v.at >= 0),
    `${name}.at is scene seconds`,
  );
  check(
    v.after == null ||
      (finite(v.after) && v.say != null) ||
      (finite(v.after) && v.cue != null),
    `${name}.after needs say or cue`,
  );
};
export const RESIDUAL_ID = 'not-explained';
export const MORPH = 0.8;

export const ids = (p: Pick<BreakdownSpec, 'id'>, ...path: string[]): string =>
  `bd-${p.id}-${path.join('-')}`;

export function normalizePart(part: BreakdownPartInput): BreakdownPart {
  return {
    ...part,
    id: part.id ?? slug(part.label),
    parts: part.parts?.map(normalizePart),
  };
}
export function partAt(
  p: Pick<BreakdownSpec, 'parts'>,
  id: string,
): BreakdownPart {
  const part = p.parts.find((x) => x.id === id);
  check(part, `unknown part ${id}`);
  return part;
}
export function childrenOf(part: BreakdownPart): BreakdownPart[] {
  check(part.parts, `${part.label} has no parts of its own to show`);
  return part.parts;
}
export function rowPart(row: BreakdownRow): BreakdownPart {
  check(row.item, 'a part row needs its source part');
  return row.item;
}
export function barAt(elements: CanvasElement[], id: string): BreakdownBar {
  const bar = elements.find((e) => e.id === id);
  check(
    bar &&
      typeof bar.x === 'number' &&
      typeof bar.y === 'number' &&
      typeof bar.w === 'number' &&
      typeof bar.h === 'number',
    `missing bar ${id}`,
  );
  return Object.assign(bar, { id, x: bar.x, y: bar.y, w: bar.w, h: bar.h });
}
