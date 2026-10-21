import type {
  Timed,
  HelperFrame,
  CanvasElement,
  ElementFields,
} from './types.mjs';
import type { plotLayout } from './plots.mjs';
export type Answer = 'yes' | 'no';
export interface DecisionAsk {
  id: string;
  label: string;
  yes: string;
  no: string;
}
export interface DecisionOutcome {
  id: string;
  label: string;
  tone?: string;
}
export type DecisionTree =
  | string
  | { ask: string; yes: DecisionTree; no: DecisionTree };
export type DecisionNode =
  | { ask: string; yes: DecisionNode; no: DecisionNode; outcome?: never }
  | { outcome: string; ask?: never; yes?: never; no?: never };
export type DecisionStep =
  | { ask: string; answer: Answer; outcome?: never }
  | { outcome: string; ask?: never; answer?: never };
export interface DecisionCaseInput extends Timed {
  label: string;
  answers: Record<string, string>;
}
export interface DecisionCase extends DecisionCaseInput {
  path: DecisionStep[];
  changed?: string[];
}
export interface DecisionInput {
  id?: string;
  title: string;
  source?: string;
  asOf?: string;
  ask: Array<Omit<DecisionAsk, 'yes' | 'no'> & { yes?: string; no?: string }>;
  tree: DecisionTree;
  outcomes: DecisionOutcome[];
  cases: DecisionCaseInput[];
  return?: Timed;
}
export interface DecisionSpec extends Omit<
  DecisionInput,
  'id' | 'source' | 'ask' | 'cases'
> {
  id: string;
  source: string;
  ask: DecisionAsk[];
  cases: DecisionCase[];
  root: DecisionNode;
}
export interface DecisionPoint {
  x: number;
  y: number;
}
export interface DecisionBranch {
  key: string;
  ask: string;
  d: number;
  kids: { yes: DecisionEntry; no: DecisionEntry };
  pos: DecisionPoint;
  outcome?: never;
}
export interface DecisionLeaf {
  outcome: string;
  ask?: never;
  pos: DecisionPoint;
}
export type DecisionEntry = DecisionBranch | DecisionLeaf;
export interface DecisionLayout {
  L: ReturnType<typeof plotLayout>;
  W: number;
  H: number;
  wide: boolean;
  shift: number;
  nodes: DecisionBranch[];
  order: string[];
  outPos: Map<string, DecisionPoint>;
  card: { w: number; h: number };
  font: number;
  caseSize: number;
  caseTop: number;
  top: number;
  left: number;
  right: number;
}
export type DecisionWhen = (item: Timed, fallback: number) => number;
export interface DecisionEdge {
  d: string;
  label: DecisionPoint & { anchor?: string };
}
export type DecisionId = (...k: Array<string | number>) => string;
export interface DecisionScene {
  p: DecisionSpec;
  frame: HelperFrame;
  G: DecisionLayout;
  id: DecisionId;
  timed: DecisionId;
  out: CanvasElement[];
  byAsk: Map<string, DecisionBranch>;
  askLabel: (key: string) => DecisionAsk;
  edge: (node: DecisionBranch, branch: Answer) => DecisionEdge;
  starts: number[];
  clock: number;
  back: number | null;
}
export interface DecisionSegment {
  node: DecisionBranch;
  step: DecisionStep;
  d: string;
}
export type DecisionDim = (shared?: boolean) => ElementFields;
