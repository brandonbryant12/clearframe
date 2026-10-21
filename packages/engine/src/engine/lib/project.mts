// Loading and validating a ClearFrame project folder.
import fs from 'node:fs';
import path from 'node:path';
import * as Context from 'effect/Context';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import type {
  Format,
  MixSettings,
  MusicSettings,
  Pacing,
  ResolvedStoryboard,
  VoiceSettings,
} from '../domain.mjs';
import { decodeStoryboard } from '../schemas.mjs';
import { errorMessage } from './errors.mjs';
import { validateStoryboard } from './project-validation.mjs';
export { validateStoryboard } from './project-validation.mjs';
import { readJSON } from './util.mjs';
import { measuredRate } from './voice-rates.mjs';
import { expandAssets, alphaBounds } from './plates.mjs';
import { useProject } from '../../film/library.mjs';

export const PRESETS = {
  landscape: { width: 1920, height: 1080, fps: 30 },
  vertical: { width: 1080, height: 1920, fps: 30 },
  square: { width: 1080, height: 1080, fps: 30 },
  portrait: { width: 1080, height: 1350, fps: 30 },
} satisfies Record<string, Format>;

export interface ProjectDefaults {
  voice: VoiceSettings;
  pacing: Pacing;
  music: MusicSettings;
  mix: MixSettings;
}
export const DEFAULTS: ProjectDefaults = {
  voice: {
    provider: 'gemini',
    model: 'gemini-3.8-flash-tts',
    voice: 'Charon',
    style: '',
    wpm: 150,
    takes: 'film',
  },
  pacing: { lead: 0.25, tail: 0.6, minBeat: 1.6, silentBeat: 2.5 },
  music: {
    provider: 'lyria',
    model: 'lyria-3.5',
    volume: 0.22,
    duck: true,
    fadeIn: 1.5,
    fadeOut: 2.5,
  },
  mix: { loudness: -14, voiceGain: 1.0 },
};

export function resolveProject(dir?: string): string {
  const root = path.resolve(dir ?? '.');
  const file = path.join(root, 'storyboard.json');
  if (!fs.existsSync(file))
    throw new Error(
      `No storyboard.json in ${root}. Create a project with: clearframe new <dir>`,
    );
  return root;
}

export function loadStoryboard(
  root: string,
  given?: unknown,
): ResolvedStoryboard {
  // The project's own library/ (palettes, treatments, sketches, playbooks) overrides the built-ins.
  useProject(root);
  // `given`: a candidate storyboard (the studio validates an edit before writing it).
  const raw = given
    ? structuredClone(given)
    : readJSON(path.join(root, 'storyboard.json'));
  const errors = validateStoryboard(raw);
  if (errors.length)
    throw new Error(
      `storyboard.json is invalid:\n  - ${errors.join('\n  - ')}`,
    );
  const sb = decodeStoryboard(raw);
  const preset =
    Object.entries(PRESETS).find(([name]) => name === sb.format?.preset)?.[1] ??
    PRESETS.landscape;
  return {
    ...sb,
    format: { ...preset, ...sb.format },
    // Drafts use this voice's measured reading speed unless the storyboard sets one.
    voice: {
      ...DEFAULTS.voice,
      ...sb.voice,
      wpm:
        sb.voice?.wpm ??
        measuredRate({ ...DEFAULTS.voice, ...sb.voice }) ??
        DEFAULTS.voice.wpm,
    },
    pacing: { ...DEFAULTS.pacing, ...sb.pacing },
    music: sb.music === false ? false : { ...DEFAULTS.music, ...sb.music },
    mix: { ...DEFAULTS.mix, ...sb.mix },
    // Layered image assets become their far, mid and near plates; a keyed cut-out carries
    // where its subject sits, so the plate can ground it.
    assets: expandAssets(sb.assets ?? []).map((a) => {
      const png = path.join(root, 'assets', 'img', `${a.id}.png`);
      return a.cutout && fs.existsSync(png)
        ? { ...a, bounds: alphaBounds(png) }
        : a;
    }),
    sources: sb.sources ?? [],
  };
}

export interface ProjectPaths {
  root: string;
  storyboard: string;
  build: string;
  vo: string;
  music: string;
  img: string;
  clips: string;
  sfx: string;
}
export const paths = (root: string): ProjectPaths => ({
  root,
  storyboard: path.join(root, 'storyboard.json'),
  build: path.join(root, 'build'),
  vo: path.join(root, 'assets', 'vo'),
  music: path.join(root, 'assets', 'music'),
  img: path.join(root, 'assets', 'img'),
  clips: path.join(root, 'assets', 'clips'),
  sfx: path.join(root, 'assets', 'sfx'),
});

export class ProjectError extends Data.TaggedError('ProjectError')<{
  root: string;
  message: string;
  cause: unknown;
}> {}
export class ProjectStore extends Context.Service<
  ProjectStore,
  {
    load: (
      root: string,
      given?: unknown,
    ) => Effect.Effect<ResolvedStoryboard, ProjectError>;
  }
>()('clearframe/ProjectStore') {}
export const ProjectStoreLive = Layer.succeed(ProjectStore, {
  load: (root, given) =>
    Effect.try({
      try: () => loadStoryboard(root, given),
      catch: (cause) =>
        new ProjectError({ root, message: errorMessage(cause), cause }),
    }),
});
