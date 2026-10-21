import type { CanvasElement, ElementKey } from '../types.mjs';
import type { AxisValue } from '../plot-data.mjs';
import type { CorrelationCell } from './correlation-types.mjs';
import type { ValuationCell } from './valuation-types.mjs';
import type { PhasePoint, Quadrant } from './phase-types.mjs';
import type { AllocationTiming, TokenTransfer } from './allocation-types.mjs';
export type Point = [number, number];
export type Box = [number, number, number, number];
export interface SceneOptions {
  width: number;
  height: number;
  id: string;
  reveal?: boolean;
}
export interface AllocationOptions extends SceneOptions {
  view?: 'trays' | 'comparison';
  timing?: AllocationTiming;
}
export interface BasketOptions extends SceneOptions {
  view?: 'prices' | 'budget';
}
export interface PhaseOptions extends SceneOptions {
  view?: 'trail' | 'focus';
}
export interface CorrelationOptions extends SceneOptions {
  view?: 'matrix' | 'pair';
  selectedPair: [string, string];
}
export interface ValuationOptions extends SceneOptions {
  view?: 'grid' | 'slice';
}
export interface Card {
  id: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  gridX: number;
  gridY: number;
  columns: number;
  corridorY: number;
}
export interface TokenTrack {
  id: string;
  initial: Point;
  keys: ElementKey[];
}
export interface RouteLeg {
  from: Point;
  to: Point;
  start: number;
  end: number;
}
export interface CorrelationCellDrawing extends CorrelationCell {
  box: Box;
  fill: string;
  label: string;
  detail: string;
  at: number;
  selected: boolean;
}
export interface CorrelationPoint {
  seriesId: string;
  index: number;
  date: AxisValue;
  value: number | null;
  paired: boolean;
  point: Point | null;
  at?: number;
}
export interface CorrelationSegment {
  seriesId: string;
  from: AxisValue;
  to: AxisValue;
  p1: Point;
  p2: Point;
  at: number;
  end: number;
}
export interface CorrelationGeometry {
  cells: CorrelationCellDrawing[];
  points: CorrelationPoint[];
  segments: CorrelationSegment[];
}
export interface PreviousCorrelationPoint {
  date: AxisValue;
  value: number;
  at: number;
}
export interface ValuationCellDrawing extends ValuationCell {
  box: Box;
  center: Point;
  fill: string;
  label: string;
  at: number;
  selected: boolean;
  onSlice: boolean;
}
export interface ValuationPoint extends ValuationCell {
  x: number;
  point: Point | null;
  at: number;
  selected?: boolean;
}
export interface DrawnSegment {
  p1: Point;
  p2: Point;
  at: number;
  end: number;
}
export interface ValuationGeometry {
  cells: ValuationCellDrawing[];
  points: ValuationPoint[];
  segments: DrawnSegment[];
}
export interface PreviousPoint {
  x: number;
  y: number;
  at: number;
}
export interface PhaseDrawingPoint extends PhasePoint {
  point: Point | null;
  at: number;
}
export interface PhaseSegment extends DrawnSegment {
  from: number;
  to: number;
  fromDate: string;
  toDate: string;
  days: number;
}
export interface PhaseGeometry {
  box: Box;
  reference: Point;
  points: PhaseDrawingPoint[];
  segments: PhaseSegment[];
  labels: { quadrant: Quadrant; box: Box; rows: string[] }[];
  timeline: {
    index: number;
    point: Point;
    valid: boolean;
    selected: boolean;
    at: number;
  }[];
}
export interface BasketRectangle {
  id: string;
  date: string;
  item?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  valueMinor: number;
  denominator: number;
  scaleWidth: number;
  at: number;
  fullAt: number;
}
export interface BasketToken {
  date: string;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  at: number;
  fullAt: number;
}
export interface BasketCard {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface BasketGeometry {
  width: number;
  height: number;
  view: 'prices' | 'budget';
  rectangles: BasketRectangle[];
  tokens: BasketToken[];
  domainMinor?: Point;
  axis?: { left: number; right: number };
  cards?: BasketCard[];
  maximumWholeBaskets?: number;
}
export type Drawable = CanvasElement;

export interface AllocationRoute extends TokenTransfer {
  start: number;
  end: number;
  points: Point[];
  legs: RouteLeg[];
}
export interface AllocationComparisonLabel {
  id: string;
  y: number;
  beforeWidth: number;
  afterWidth: number;
  share: string;
}
