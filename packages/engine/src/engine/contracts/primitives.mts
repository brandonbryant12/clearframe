/** Data shared by authoring, native preparation, and local production services. */
export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface Word {
  w: string;
  t0: number;
  t1: number;
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface Format {
  width: number;
  height: number;
  fps: number;
  preset?: string;
}
