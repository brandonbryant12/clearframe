export type ExtentField =
  | 'x'
  | 'y'
  | 'w'
  | 'h'
  | 'cx'
  | 'cy'
  | 'x1'
  | 'y1'
  | 'x2'
  | 'y2';

export type GrowExtent = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) => void;
