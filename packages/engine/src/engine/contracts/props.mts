import type { Element } from './canvas.mjs';
import type { JsonValue } from './primitives.mjs';
import type { Cue, CameraSettings, DepthKey, Target } from './motion.mjs';

export interface BlockProps {
  title?: string;
  kicker?: string;
  source?: string;
  offset?: number;
  support?: string;
  text?: string;
  label?: string;
  value?: number;
  from?: number | string | { value: number; label?: string };
  prefix?: string;
  suffix?: string;
  decimals?: number;
  context?: string;
  align?: string;
  emphasis?: string[];
  emphasisStyle?: string;
  elements?: Element[];
  world?: string;
  sketch?: string;
  seed?: number;
  sketchText?: Record<string, string>;
  sketchSay?: Record<string, string>;
  sketchParams?: Record<string, JsonValue>;
  chart?: { note?: { say?: string; text?: string }; [key: string]: unknown };
  moments?: Record<string, string | Cue>;
  plates?: string;
  view?: number[] | Target | 'auto';
  place?: number[];
  camera?: CameraSettings;
  dolly?: number | DepthKey[];
  [key: string]: unknown;
}
