export interface PhaseAxis {
  label: string;
  definition: string;
  domain: [number, number];
  ticks: number[];
  reference: number;
  decimals: number;
}
export type Quadrant = 'NE' | 'NW' | 'SW' | 'SE';
export type ReferenceBoundary =
  | 'both-references'
  | 'x-reference'
  | 'y-reference';
export interface PhaseRow {
  date: string;
  x: number | null;
  y: number | null;
}
export interface PhaseInput {
  title: string;
  source: string;
  asOf: string;
  x: PhaseAxis;
  y: PhaseAxis;
  quadrants: Record<Quadrant, string>;
  points: PhaseRow[];
  focusDate: string;
  smoothing: 'none';
}
export interface PhasePoint extends PhaseRow {
  index: number;
  day: number;
  valid: boolean;
  quadrant: Quadrant | null;
  boundary: ReferenceBoundary | null;
  missing: ('x' | 'y')[];
  time: number;
}
