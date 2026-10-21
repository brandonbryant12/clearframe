import type { Status } from './contracts.mjs';

export function check(ok: unknown, why: string): asserts ok {
  if (!ok) throw new Error(`diagram: ${why}`);
}
export function object(
  value: unknown,
  keys: readonly string[],
  where: string,
): void {
  check(
    value && typeof value === 'object' && !Array.isArray(value),
    `${where} must be an object`,
  );
  for (const key of Object.keys(value))
    check(keys.includes(key), `unknown ${where}.${key}`);
}
export const KINDS = [
  'service',
  'database',
  'user',
  'queue',
  'state',
  'external',
] as const;
export const STATUSES = [
  'neutral',
  'active',
  'added',
  'removed',
  'error',
] as const;
export const COLOR: Record<Status, string> = {
  neutral: 'muted',
  active: 'accent',
  added: 'positive',
  removed: 'negative',
  error: 'negative',
};
export const BADGE: Partial<Record<Status, string>> = {
  added: '+',
  removed: '−',
  error: '!',
};
const CUES = ['at', 'say', 'dur', 'exitAt', 'exitSay', 'exitDur'];
export const NODE_KEYS = [
  'id',
  'label',
  'kind',
  'status',
  'x',
  'y',
  'replaces',
  ...CUES,
];
export const EDGE_KEYS = [
  'id',
  'from',
  'to',
  'label',
  'status',
  'style',
  'flow',
  ...CUES,
];
export const STEP_KEYS = [
  'at',
  'say',
  'add',
  'remove',
  'replace',
  'with',
  'set',
  'send',
  'label',
  'dur',
];
export const GROUP_KEYS = ['id', 'label', 'nodes'];
export const TIME = {
  node: 0.35,
  edge: 0.6,
  remove: 0.8,
  hop: 0.75,
  stagger: 0.3,
  change: 0.3,
};
export const DIAGRAM_LIMITS = {
  nodes: 8,
  edges: 12,
  steps: 12,
  groups: 3,
  label: 28,
};
export const idRE = /^[a-z][a-z0-9-]{0,39}$/;
export const list = (value: string | string[] | null | undefined): string[] => {
  if (value == null) return [];
  return typeof value === 'string' ? [value] : value;
};
export const r2 = (value: number): number => Math.round(value * 100) / 100;
export function required<T>(value: T | undefined, label: string): T {
  check(value !== undefined, `missing ${label}`);
  return value;
}
