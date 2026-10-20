import type { calendarCue } from './cues.mjs';
import type {
  CanvasElement,
  ElementFields,
} from '../../../film/contracts/canvas.mjs';

export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: {
    days?: number;
    firstWeekday?: number;
    start?: number;
    end?: number;
    today?: number;
  };
}

export interface CalendarLayoutContext {
  firstWeekday: number;
  days: number;
  w: number;
  h: number;
  today: number;
}

export interface DrawOpenWindowContext {
  end: number;
  start: number;
  firstWeekday: number;
  cell: (d: number) => number[];
  els: CanvasElement[];
  R: number;
  cued: typeof calendarCue;
}

export interface DrawCalendarLegendContext {
  stacked: boolean;
  small: boolean;
  key: { x: number; y: number };
  keyGap: number;
  cued: typeof calendarCue;
  text: (
    t: string,
    x: number,
    y: number,
    sz: number,
    font: string,
    fill: string,
    extra?: ElementFields,
  ) => CanvasElement;
  keyW: number;
  els: CanvasElement[];
  start: number;
  end: number;
  ring: (x: number, y: number, r: number) => string;
  today: number;
}
