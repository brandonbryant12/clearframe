// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.
import fs from 'node:fs';
import path from 'node:path';

import { sha256 } from '../../scene/engine.mjs';

import { REPO_DIR } from '../../engine/lib/util.mjs';

import type {
  PreparedContext,
  CheckResult,
} from '../preparation/contracts.mjs';
// The encoder settings live in scene/native/src/runtime.rs (`x264`); these labels describe them.
export const ENCODERS = {
  draft: 'draft (x264 veryfast, CRF 21)',
  final: 'final (x264 medium, CRF 16)',
};

/** The finishing step's code, by content (repo-relative path → sha256), recorded in every receipt
 * and checked by `qa` and `review`: these files decide what is heard and where. */
const moduleExtension = import.meta.url.endsWith('.mts') ? '.mts' : '.mjs';
const modules = (dir: string, accepts: (name: string) => boolean): string[] =>
  fs
    .readdirSync(path.join(REPO_DIR, dir))
    .filter((name) => name.endsWith(moduleExtension) && accepts(name))
    .map((name) => `${dir}/${name}`);
export const MIXING_SOURCES = modules('engine/lib', (name) =>
  /^(audio|sfx)(-|\.)/.test(name),
);
export const FINISHING_SOURCES = [
  `film/render${moduleExtension}`,
  ...modules('film', (name) => /^sound(-|\.)/.test(name)),
  ...modules('film/rendering', () => true),
  ...modules('engine/lib', (name) => /^(audio|sfx)(-|\.)/.test(name)),
];
export const finishingSources = () =>
  Object.fromEntries(
    FINISHING_SOURCES.map((rel) => [
      rel,
      sha256(fs.readFileSync(path.join(REPO_DIR, rel))),
    ]),
  );

/** What a draft or rough render did not establish, carried in its receipt and revision. */
export function unvalidated(ctx: PreparedContext, check?: CheckResult | null) {
  const estimated = ctx.timing.beats
    .filter((b) => b.vo && b.vo.wordTiming !== 'measured')
    .map((b) => b.id);
  return {
    profile: ctx.manifest.profile,
    placeholders: ctx.placeholders ?? [],
    unfinished: ctx.unfinished ?? [],
    estimatedTiming: estimated,
    ...(check
      ? { craft: check.craft ?? [], audit: 'run' }
      : {
          audit:
            'not run by this command (run check, or draft, for the frame audit)',
        }),
  };
}
