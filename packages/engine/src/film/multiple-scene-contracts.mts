import type { AxisValue } from './plot-data.mjs';
import type { multipleContext } from './multiple-scene-context.mjs';
import type { multiplePanelContext } from './multiple-scene-panel-context.mjs';
export interface MultipleLayout {
  width: number;
  height: number;
  tall: boolean;
  margin: number;
  pw: number;
  ph: number;
  boxes: number[][];
  expanded: number[];
  scale: number;
  type: number;
  tick: number;
}
/** Where each observation of each panel is drawn, for checks and reviews. */
export interface MultiplePoint {
  seriesId: string;
  index: number;
  date: AxisValue;
  value: number | null;
  point: number[] | null;
  local?: number[];
  at?: number;
}
export interface MultipleSceneOptions {
  width: number;
  height: number;
  id: string;
  subtitle: string;
  expandedId?: string | null;
  reveal?: boolean;
}
export type MultipleContext = ReturnType<typeof multipleContext>;
export type MultiplePanel = ReturnType<typeof multiplePanelContext>;
