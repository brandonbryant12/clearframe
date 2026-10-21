export interface Quantum {
  minorUnits: number;
  decimals: number;
  displayDecimals: number;
  unit: string;
}
export interface AllocationBucket {
  id: string;
  label: string;
  count: number;
}
export interface AllocationMove {
  from: string;
  to: string;
  count: number;
}
export interface AllocationInput {
  title: string;
  source: string;
  asOf: string;
  period: string;
  qualification: string;
  quantum: Quantum;
  buckets: AllocationBucket[];
  moves: AllocationMove[];
}
export interface AllocationToken {
  id: string;
  initialBucket: string;
  initialSlot: number;
  finalBucket: string;
  finalSlot: number;
}
export interface AllocationEvent extends AllocationMove {
  index: number;
  groupIndex: number;
  token: string;
  fromSlot: number;
  toSlot: number;
  before: number[];
  inTransit: number[];
  after: number[];
}
export type TokenTransfer = Omit<AllocationEvent, 'count'>;
export interface AllocationTiming {
  initialHold?: number;
  moveSeconds?: number;
  settleSeconds?: number;
  finalHold?: number;
}
