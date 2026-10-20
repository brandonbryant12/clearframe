import type {
  CanvasElement,
  CueResolver,
  FrameSize,
  Point,
} from '../types.mjs';

export type Status = 'neutral' | 'active' | 'added' | 'removed' | 'error';
export type Kind =
  | 'service'
  | 'database'
  | 'user'
  | 'queue'
  | 'state'
  | 'external';
export interface DiagramCue {
  at?: number;
  say?: string;
  dur?: number;
  exitAt?: number;
  exitSay?: string;
  exitDur?: number;
}
export interface DiagramNode extends DiagramCue {
  id: string;
  label: string;
  kind?: Kind;
  status?: Status;
  x?: number;
  y?: number;
  replaces?: string;
}
export interface DiagramEdge extends DiagramCue {
  id?: string;
  from: string;
  to: string;
  label?: string;
  status?: Status;
  style?: 'solid' | 'dashed';
  flow?: boolean;
}
export interface DiagramStep extends DiagramCue {
  add?: string | string[];
  remove?: string | string[];
  replace?: string;
  with?: string;
  set?: Record<string, Status>;
  send?: string[];
  label?: string;
}
export interface DiagramGroup {
  id: string;
  label: string;
  nodes: string[];
}
export interface DiagramSpec {
  nodes: DiagramNode[];
  edges?: DiagramEdge[];
  steps?: DiagramStep[];
  groups?: DiagramGroup[];
  direction?: 'auto' | 'horizontal' | 'vertical';
  area?: [number, number, number, number];
}
export interface DiagramOptions extends Partial<FrameSize> {
  resolve?: CueResolver;
}
export interface Lifetime {
  at: number | null;
  exitAt: number | null;
  timed: boolean;
  stepped?: boolean;
  status: [number | null, Status | undefined][];
}
export interface NodeState
  extends Omit<DiagramNode, 'at' | 'exitAt' | 'status' | 'kind'>, Lifetime {
  order: number;
  kind: Kind;
}
export interface EdgeState
  extends Omit<DiagramEdge, 'id' | 'at' | 'exitAt' | 'status'>, Lifetime {
  id: string;
}
export interface ResolvedLifetime {
  at: number;
  exitAt: number | null;
  timed: boolean;
  stepped?: boolean;
  status: [number, Status][];
}
export interface ResolvedNode
  extends Omit<NodeState, keyof Lifetime>, ResolvedLifetime {}
export interface ResolvedEdge
  extends Omit<EdgeState, keyof Lifetime>, ResolvedLifetime {}
export interface Send {
  path: string[];
  t: number;
  label?: string;
  hop: number;
  where: string;
}
export interface DiagramState {
  N: Map<string, ResolvedNode>;
  E: Map<string, ResolvedEdge>;
  pairs: Set<string>;
  sends: Send[];
  exact: boolean;
}
export interface Centre {
  x: number;
  y: number;
}
export interface Box {
  l: number;
  r: number;
  t: number;
  b: number;
}
export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Metrics {
  hw: number;
  hh: number;
  nw: number;
  nh: number;
  size: number;
  nameSize: number;
  u: number;
}
export interface DiagramLayout extends Metrics {
  gap: number;
  area: Area;
  across: boolean;
  slots: string[];
  centre: Map<string, Centre>;
  edgeSize: number;
  slotOf: (id: string) => string;
  at: (id: string) => Centre;
  life: (id: string) => Point;
  rectOf: (centre: Centre, pad?: number) => Box;
  fits: (text: string, room: number, font: 'mono' | 'strong') => boolean;
}
export interface Label {
  x: number;
  y: number;
  anchor: 'middle' | 'start' | 'end';
  fit: number;
  box?: Box;
}
export interface LabelCandidate extends Label {
  box: Box;
  bias: number;
}
export interface Route {
  d: string;
  pts: Point[];
  label?: Label;
  twoWay?: boolean;
  sign?: number;
}
export interface Port {
  slot: string;
  side: 'l' | 'r' | 't' | 'b';
  other: Centre;
  offset: number;
  alone?: boolean;
}
export interface RoutePlan {
  e: ResolvedEdge;
  a: Centre;
  b: Centre;
  horizontal: boolean;
  sx: number;
  sy: number;
  twoWay: boolean;
  others: Box[];
  ends: [Port, Port];
  ports: [Point, Point];
  mid?: number;
}
export interface GroupFrame {
  g: DiagramGroup;
  box: Box;
  pad: number;
}
export interface DiagramRoutes {
  routes: Map<string, Route>;
  frames: GroupFrame[];
}
export type NodeDrawing = (status: Status) => CanvasElement[];
