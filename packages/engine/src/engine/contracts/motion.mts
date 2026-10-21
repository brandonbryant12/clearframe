export interface Gradient {
  gradient: string[];
  angle?: number;
  radial?: boolean;
  fade?: boolean;
}

export type Paint = string | Gradient;

export type SoundRef = string | { name: string; volume?: number } | false;

export interface Cue {
  at?: number;
  say?: string;
  cue?: string;
  after?: number;
  dur?: number;
}

export interface SoundCue {
  src: string;
  volume?: number;
  at?: number | string;
}

export interface CameraCue extends Cue {
  move?: string;
  amount?: number;
  to?: number[] | Target;
  target?: string;
}

export interface Target {
  on: string | string[];
  pad?: number;
  state?: 'start' | 'end';
}

export interface DepthKey extends Cue {
  z?: number;
  ease?: string;
}

export interface CameraSettings extends CameraCue {
  handheld?: number;
}

export interface MotionSettings {
  preset?: string;
  intensity?: number;
}

export interface Count extends Cue {
  from?: number;
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

export interface ElementKey extends Cue {
  x?: number;
  y?: number;
  z?: number;
  scale?: number;
  opacity?: number;
  rotation?: number;
  to?: number[];
  target?: string;
  sound?: SoundRef;
}
