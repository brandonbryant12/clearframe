import { isRecord } from '../../engine/lib/errors.mjs';

import { fail, items } from '../fields.mjs';

import type { StageBuild } from '../stage-kit.mjs';
import { compileEvents } from '../stage-events.mjs';
import type { CompiledStage } from '../types.mjs';
import { STAGE_KEYS, HEADING_KEYS } from './contracts.mjs';
import type { StageOptions } from './contracts.mjs';
import { stageArea, fitStage } from './layout.mjs';
import { compileGround, compileCode, compileCamera } from './components.mjs';
import { compileActors } from './actors.mjs';
import { compileLinks } from './links.mjs';

/**
 * Compile one stage spec into native elements and a camera. `cue(v)` turns seconds or a spoken
 * word into layer seconds; `end` is the layer length in seconds.
 */
export function compileStage(
  raw: unknown,
  {
    cue,
    end,
    where,
    frame,
    staged,
    root,
    heading = true,
    notes = [],
  }: StageOptions,
): CompiledStage {
  if (!isRecord(raw)) return fail(where, 'a stage is an object');
  for (const k of Object.keys(raw))
    if (!STAGE_KEYS.includes(k) && !HEADING_KEYS.includes(k))
      fail(where, `unknown stage key ${k} (${STAGE_KEYS.join(', ')})`);
  const area = stageArea(frame, { heading });
  const fitted = fitStage(raw, frame, area);
  if (fitted.note) notes.push(`${where}: ${fitted.note}`);
  const spec = fitted.spec;
  const build: StageBuild = {
    where,
    frame,
    area,
    end,
    cue,
    out: { under: [], actors: [], links: [], effects: [], over: [] },
    actors: new Map(),
    links: new Map(),
    cameraKeys: [],
    count: 0,
  };
  compileGround(build, spec.ground);
  build.out.under.push(
    ...structuredClone(items(spec.under, where, 'under')),
    ...structuredClone(items(spec.elements, where, 'elements')),
  );
  compileActors(build, items(spec.actors, where, 'actors'));
  compileLinks(build, items(spec.links, where, 'links'));
  compileEvents(build, items(spec.events, where, 'events'));
  // Keys must run in time order; events are authored in any order.
  for (const a of build.actors.values())
    for (const el of [a.group, a.card, a.dot])
      el.keys.sort((p, q) => p.at - q.at);
  const code = compileCode(build, spec, { staged, root });
  const camera = compileCamera(build, spec.camera);
  const { out } = build;
  const elements = [
    ...out.under,
    ...out.links,
    ...out.actors,
    ...code,
    ...out.effects,
    ...out.over,
    ...structuredClone(items(spec.over, where, 'over')),
  ];
  return { elements, camera };
}
