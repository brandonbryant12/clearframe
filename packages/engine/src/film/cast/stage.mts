import type {
  CastFormation,
  CastSpec,
  CastFrame,
  CastOptions,
  CastStage,
  ObjectGroup,
} from './contracts.mjs';
import type { CueResolver } from '../types.mjs';
import { objectAt } from './common.mjs';
import { objectElement, objectExtent, labelBelow } from './draw.mjs';
import { formationTargets } from './formations.mjs';

export function createCastStage(
  spec: CastSpec,
  frame: CastFrame,
  options: CastOptions,
): CastStage {
  const state = options.state ?? new Map(),
    camera = options.camera ?? { zoom: 1, x: 0, y: 0 };
  const cue =
    options.cue ?? ((value) => (typeof value === 'number' ? value : 0));
  const u = Math.min(frame.width, frame.height),
    size = options.unit ?? u * (spec.objects.size <= 4 ? 0.19 : 0.15);
  const stage: CastStage = {
    spec,
    frame,
    state,
    camera,
    cam: { ...camera },
    camKeys: [],
    u,
    size,
    pose: new Map(state),
    groups: new Map(),
    elements: [],
    words: [],
    notes: [],
    edges: {},
    under: [],
    carried: [],
    top: Math.max(0, ...[...state.values()].map((p) => p.z ?? 0)),
    times: [],
    group,
    release,
    until: (index) =>
      stage.times.find(
        (_, j) =>
          j > index &&
          !['wave', 'mark', 'camera'].includes(spec.formations[j].form),
      ),
    alive: (id) => !stage.pose.get(id)?.gone,
  };
  function group(id: string): ObjectGroup {
    const { groups, pose, elements } = stage;
    if (!groups.has(id)) {
      const base = objectAt(pose, id);
      const el = objectElement(
        objectAt(spec.objects, id),
        `cast-${id}`,
        size,
        base,
        { at: 0, enter: 'none' },
        spec.look,
      );
      groups.set(id, { el, base });
      elements.push(el);
    }
    return objectAt(groups, id);
  }
  function release(at: number): void {
    const { pose } = stage;
    const quiet = [...pose]
      .filter(([, p]) => p.quiet && !p.gone)
      .map(([id]) => id);
    if (!quiet.length || [...pose.values()].some((p) => p.hero && !p.gone))
      return;
    const back = formationTargets({ form: 'scatter' }, quiet, frame, {
      size,
      seed: spec.seed + 97,
      current: pose,
      extent: (id) => objectExtent(objectAt(spec.objects, id), size),
      below: (id) => labelBelow(objectAt(spec.objects, id), size),
    });
    for (const id of quiet) {
      const { el, base } = group(id),
        to = objectAt(back, id);
      el.keys.push({
        at,
        x: to.x - base.x,
        y: to.y - base.y,
        scale: to.scale,
        rotate: to.rotate,
        opacity: 1,
        dur: 1.1,
        ease: 'inOut',
      });
      pose.set(id, { ...to, z: objectAt(pose, id).z });
    }
  }
  spec.formations.forEach((f, k) =>
    stage.times.push(formationTime(f, k, stage.times, cue)),
  );
  return stage;
}

function formationTime(
  f: CastFormation,
  index: number,
  times: number[],
  cue: CueResolver,
): number {
  if (f.say != null) return cue(f.say);
  if (f.at != null) return f.at;
  return index === 0 ? 0 : times[index - 1] + 1.6;
}
