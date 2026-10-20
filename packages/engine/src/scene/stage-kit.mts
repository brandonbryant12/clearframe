// What every stage recipe shares: actor kinds and status colours, the event names, the compiled
// state a stage builds up (actors, links, effects, camera keys) and the geometry of its connectors.
import { fail, own } from './fields.mjs';
import type {
  ActorGroup,
  CameraKey,
  Cue,
  FrameSize,
  KeyedElement,
  LeavingElement,
  PlanElement,
  StageArea,
} from './types.mjs';

export const ACTOR_KINDS = {
  service: 'server',
  database: 'database',
  user: 'user',
  users: 'users',
  queue: 'package',
  process: 'settings',
  external: 'cloud',
  file: 'file',
  client: 'laptop',
  phone: 'phone',
  timer: 'timer',
  lock: 'lock',
  note: 'message',
  state: 'target',
} satisfies Readonly<Record<string, string>>;
export const STATUS = {
  neutral: 'line',
  active: 'accent',
  added: 'positive',
  done: 'positive',
  removed: 'negative',
  error: 'negative',
  waiting: 'accent2',
};
export const EVENTS = [
  'send',
  'pulse',
  'highlight',
  'state',
  'move',
  'show',
  'hide',
  'callout',
  'burst',
  'connect',
  'disconnect',
  'camera',
] as const;
export type EventKind = (typeof EVENTS)[number];
export const isEvent = (value: unknown): value is EventKind =>
  EVENTS.some((e) => e === value);

/** An actor's status colour (an unknown status draws as a plain line). */
export const statusColor = (status: unknown): string =>
  own(STATUS, status ?? 'neutral') ?? 'line';

/** The point where a ray from a box's centre toward (dx, dy) leaves the box, plus a margin. */
export function edgeGap(
  w: number,
  h: number,
  dx: number,
  dy: number,
  margin = 14,
): number {
  const len = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [Math.abs(dx / len), Math.abs(dy / len)];
  const t = Math.min(
    ux > 1e-6 ? w / 2 / ux : Infinity,
    uy > 1e-6 ? h / 2 / uy : Infinity,
  );
  return t + margin;
}

/** A card's default size: wide enough for its label, taller with a detail line. */
export const cardSize = (
  label: string,
  detail: unknown,
  w: number | undefined,
  h: number | undefined,
) => ({
  w: w ?? Math.max(220, 120 + label.length * 17),
  h: h ?? (detail ? 132 : 104),
});

/** A text element that can be replaced later (an actor's label changes with its state). */
export interface LabelElement extends PlanElement {
  id: string;
  exitAt?: number;
  exit?: string;
  exitDur?: number;
}

/** One compiled actor: its elements, size, authored centre and when it appears. */
export interface Actor {
  id: string;
  /** The status colour it was authored with; a pulse returns to it. */
  color: string;
  group: ActorGroup;
  card: KeyedElement;
  dot: KeyedElement;
  label: LabelElement;
  w: number;
  h: number;
  appear: number;
  x: number;
  y: number;
}

export interface LinkEntry {
  el: LeavingElement;
  label: LeavingElement | null;
  appear: number;
  from: string;
  to: string;
}

export interface StageOut {
  /** Ground and authored under/elements (checked by the plan compiler). */
  under: unknown[];
  actors: ActorGroup[];
  links: PlanElement[];
  effects: PlanElement[];
  over: PlanElement[];
}

/** A stage being compiled: its frame and clock, and everything built so far. */
export interface StageBuild {
  where: string;
  frame: FrameSize;
  area: StageArea;
  /** Layer seconds; nothing may be cued at or after it. */
  end: number;
  cue: Cue;
  out: StageOut;
  actors: Map<string, Actor>;
  links: Map<string, LinkEntry>;
  cameraKeys: CameraKey[];
  /** Events without an id are named by kind and this count (`send-1`). */
  count: number;
}

/** Layer seconds of an authored cue, or `fallback` when none is authored. */
export const cueOr = (
  build: StageBuild,
  value: unknown,
  fallback: number,
): number => (value == null ? fallback : build.cue(value));
export const cueOrNull = (build: StageBuild, value: unknown): number | null =>
  value == null ? null : build.cue(value);

export function actorOf(build: StageBuild, id: unknown, where: string): Actor {
  return (
    (typeof id === 'string' ? build.actors.get(id) : undefined) ??
    fail(where, `no actor ${String(id)}`)
  );
}
