import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
export const fail = (message: string, status = 400) =>
  Object.assign(new Error(message), { status });
export const clip = (value: unknown, n: number): string => {
  const s = String(value ?? '');
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};
const skill = (n: string) => `skills/${n}/SKILL.md`;
export const GUIDES = {
  clearframe: skill('clearframe'),
  library: skill('clearframe-library'),
  inspiration: skill('clearframe-inspiration'),
  canvas: skill('clearframe-canvas'),
  dataviz: skill('clearframe-dataviz'),
  motion: skill('clearframe-motion'),
  script: skill('clearframe-script'),
  integrity: skill('clearframe-integrity'),
  direction: skill('clearframe-direction'),
  engine: skill('clearframe-engine'),
  review: skill('clearframe-review'),
  scene: skill('clearframe-scene'),
  explain: skill('clearframe-explain'),
  workplace: skill('clearframe-workplace'),
  style: 'docs/style.md',
  'canvas-notes': 'docs/canvas.md',
  'scene-notes': 'docs/scene-engine.md',
  ideas: 'docs/ideas.md',
  speech: 'docs/speech.md',
  authoring: 'engine/agent-plugin/AUTHORING.md',
  cast: 'docs/cast.md',
  images: 'docs/image-direction.md',
  editing: 'docs/editing.md',
  continuity: 'docs/continuity.md',
};

export const TERMINAL = new Set([
  'complete',
  'failed',
  'cancelled',
  'interrupted',
]);
export const sec = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n)
    ? `${Math.round(n * 10) / 10}s`
    : '?';
export const atomic = (file: string, data: string) => {
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
};
