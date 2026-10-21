import { parseArgs } from 'node:util';
import { parseTime } from '../lib/notes.mjs';

export function parseOptions(args: string[]) {
  return parseArgs({
    args,
    allowPositionals: true,
    options: {
      duration: { type: 'string' },
      length: { type: 'string' },
      ending: { type: 'string' },
      scale: { type: 'string' },
      idea: { type: 'string' },
      document: { type: 'string', multiple: true },
      brand: { type: 'string' },
      audience: { type: 'string' },
      takeaway: { type: 'string' },
      seed: { type: 'string' },
      mode: { type: 'string' },
      library: { type: 'string' },
      title: { type: 'string' },
      theme: { type: 'string' },
      playbook: { type: 'string' },
      recipe: { type: 'string' },
      treatment: { type: 'string' },
      direction: { type: 'string' },
      only: { type: 'string' },
      budget: { type: 'string' },
      at: { type: 'string' },
      beat: { type: 'string' },
      pos: { type: 'string' },
      out: { type: 'string' },
      per: { type: 'string' },
      columns: { type: 'string' },
      thumb: { type: 'string' },
      audio: { type: 'string' },
      transcript: { type: 'string' },
      words: { type: 'string' },
      video: { type: 'string' },
      markdown: { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
      speakers: { type: 'string' },
      fps: { type: 'string' },
      port: { type: 'string' },
      script: { type: 'string' },
      model: { type: 'string' },
      assets: { type: 'string' },
      note: { type: 'string' },
      rev: { type: 'string' },
      scope: { type: 'string' },
      reason: { type: 'string' },
      handles: { type: 'string' },
      range: { type: 'string' },
      beats: { type: 'string' },
      chapter: { type: 'string' },
      element: { type: 'string' },
      keep: { type: 'string' },
      by: { type: 'string' },
      said: { type: 'string' },
      cut: { type: 'string' },
      sentence: { type: 'string' },
      'pauses-over': { type: 'string' },
      'keep-pause': { type: 'string' },
      paper: { type: 'string' },
      import: { type: 'string' },
      status: { type: 'string' },
      label: { type: 'string' },
      override: { type: 'string' },
      nth: { type: 'string' },
      before: { type: 'string' },
      release: { type: 'string' },
      checkpoint: { type: 'string' },
      projects: { type: 'string' },
      kind: { type: 'string' },
      id: { type: 'string' },
      still: { type: 'boolean' },
      draft: { type: 'boolean' },
      force: { type: 'boolean' },
      vertical: { type: 'boolean' },
      json: { type: 'boolean' },
      md: { type: 'boolean' },
      'no-audio': { type: 'boolean' },
      transcribe: { type: 'boolean' },
      help: { type: 'boolean' },
      grid: { type: 'boolean' },
      sample: { type: 'boolean' },
      sketches: { type: 'boolean' },
      whisper: { type: 'boolean' },
      'no-render': { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      light: { type: 'boolean' },
      loop: { type: 'boolean' },
      verify: { type: 'boolean' },
      serve: { type: 'boolean' },
      rough: { type: 'boolean' },
      agent: { type: 'boolean' },
      'no-verify': { type: 'boolean' },
      'suggest-cuts': { type: 'boolean' },
      shared: { type: 'boolean' },
      'no-agent': { type: 'boolean' },
      index: { type: 'boolean' },
    },
  });
}
export type RawOptions = ReturnType<typeof parseOptions>['values'];
export const numberOption = (
  o: RawOptions,
  key: keyof RawOptions,
): number | undefined => {
  if (o[key] == null) return undefined;
  const n = Number(o[key]);
  if (!Number.isFinite(n)) throw new Error(`--${key} must be a number`);
  return n;
};

export function normalizeOptions(o: RawOptions) {
  const num = (key: keyof RawOptions) => numberOption(o, key);
  let seed: number | undefined;
  if (o.seed != null) {
    seed =
      o.seed === 'random' ? Math.floor(Math.random() * 100000) : Number(o.seed);
    if (!Number.isInteger(seed))
      throw new Error('--seed must be an integer or "random"');
  }
  return {
    ...o,
    seed,
    only: o.only?.split(','),
    budget: num('budget'),
    length: num('length'),
    at: o.at == null ? undefined : parseTime(o.at),
    pos: num('pos'),
    scale: num('scale'),
    per: num('per'),
    columns: num('columns'),
    thumb: num('thumb'),
    noAudio: o['no-audio'],
  };
}
export type CommandOptions = ReturnType<typeof normalizeOptions>;
export interface CommandContext {
  cmd: string;
  args: string[];
  positionals: string[];
  o: RawOptions;
  opts: CommandOptions;
  num: (key: keyof RawOptions) => number | undefined;
  dir: string;
}
