export type PlotOrientation = 'landscape' | 'square' | 'vertical';

/** The plot's place in the frame: margins, type sizes and the plot area, in frame pixels. */
export interface PlotLayout {
  u: number;
  orientation: PlotOrientation;
  tall: boolean;
  margin: number;
  type: number;
  keyType: number;
  titleType: number;
  titleY: number;
  keyY: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}
