export const DATA_MODEL_VERSION = 1;

export interface Component {
  id: string;
  label: string;
  amount: number;
}

export interface RebasedObservation {
  date: string;
  elapsedDays: number;
  value: number | null;
  index: number | null;
}

export interface RebaseResult {
  modelVersion: number;
  method: 'observed-anchor-ratio';
  baseDate: string;
  baseIndex: number;
  baseValue: number;
  observations: RebasedObservation[];
}

export interface ProductFactor {
  id: string;
  label: string;
  start: number;
  end: number;
}

export interface ProductPart extends Component {
  kind: 'factor' | 'interaction' | 'additive';
  fraction: number;
}

export interface ProductDecomposition {
  modelVersion: number;
  method: 'two-factor-with-explicit-interaction';
  factors: ProductFactor[];
  opening: number;
  endingProduct: number;
  additiveTotal: number;
  combinedValue: number;
  change: number;
  changeFraction: number;
  parts: ProductPart[];
  arithmeticDifference: number;
}

export interface StockReconciliation {
  modelVersion: number;
  method: 'opening-plus-signed-changes-and-explicit-residual';
  opening: number;
  closing: number;
  netChange: number;
  suppliedNetChange: number;
  explainedClosing: number;
  residual: number;
  components: (Component & { kind: 'supplied' | 'residual' })[];
}

export const OPERATORS = ['gt', 'gte', 'lt', 'lte'] as const;

export type Operator = (typeof OPERATORS)[number];

export type MemberState = 'meets' | 'other' | 'missing';

export interface Member {
  id: string;
  label: string;
  value: number | null;
  weight: number;
  state: MemberState;
}

export interface MembershipGroup {
  state: MemberState;
  count: number;
  weight: number;
  countFraction: number;
  weightFraction: number;
}

export interface MembershipSummary {
  modelVersion: number;
  method: 'full-membership-count-and-weight-shares';
  membershipDate: string;
  metricAsOf: string;
  condition: { operator: Operator; threshold: number };
  totalCount: number;
  totalWeight: number;
  observedCount: number;
  observedWeight: number;
  groups: MembershipGroup[];
  members: (Member & { weightFraction: number })[];
}

export interface BenchmarkItem {
  id: string;
  label: string;
  value: number | null;
  size: number | null;
  difference: number | null;
}

export interface BenchmarkDifferences {
  modelVersion: number;
  method: 'signed-metric-difference';
  benchmark: number;
  items: BenchmarkItem[];
}
