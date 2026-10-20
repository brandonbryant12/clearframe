import type { CanvasElement } from '../types.mjs';
import type { CastStage } from './contracts.mjs';
import { check, objectAt } from './common.mjs';
import { objectElement } from './draw.mjs';

export function finishCast(stage: CastStage, threads: CanvasElement[]) {
  const {
    spec,
    frame,
    state,
    camera,
    camKeys,
    size,
    pose,
    groups,
    elements,
    words,
    notes,
    edges,
    under,
    until,
  } = stage;

  // The last beat's settled thread stays until this beat's first move, then fades.
  const first = until(-1);
  threads.forEach((l, i) =>
    words.unshift({
      ...l,
      id: `cast-thread-in-${i}`,
      at: 0,
      enter: 'none',
      ...(first != null ? { exitAt: Math.max(0.01, first), exit: 'fade' } : {}),
    }),
  );
  // Objects stage.carried in that no formation moves this beat still stand where they were.
  const untouched: string[] = [];
  for (const [id, p] of state) {
    if (groups.has(id) || p.gone || !spec.objects.has(id)) continue;
    const g = objectElement(
      objectAt(spec.objects, id),
      `cast-${id}`,
      size,
      p,
      { at: 0, enter: 'none' },
      spec.look,
    );
    groups.set(id, { el: g, base: p });
    elements.unshift(g);
    untouched.push(id);
  }
  // A beat that brings in new objects while earlier ones stand untouched piles them up: the
  // frame fills with the last beat's leftovers (seen only on the sheet before this note).
  if (untouched.length >= 2 && [...groups.keys()].some((id) => !state.has(id)))
    notes.push(
      `${untouched.join(', ')} carried from earlier beats still stand where they were while new objects arrive: move them in this beat's formations, send them off with {"form": "exit", "ids": [${untouched.map((id) => `"${id}"`).join(', ')}]}, or start this beat's cast with "fresh": true`,
    );
  for (const { el } of groups.values())
    el.keys.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  // The last word on the budget: a scene the renderer would refuse is refused here, by name.
  for (const [id, { el }] of groups)
    check(
      el.keys.length <= 24,
      `${id} has more moves in this beat than one object can carry (${el.keys.length} of 24 keyframes); move some of them to the next beat`,
    );
  const depth = new Map<CanvasElement, number>(
    [...groups].map(([id, { el }]) => [el, pose.get(id)?.z ?? 0]),
  );
  const drawn = [
    ...under,
    ...[...elements].sort((a, b) => (depth.get(a) ?? 0) - (depth.get(b) ?? 0)),
    ...words,
  ];
  const moved = camKeys.length || camera.zoom !== 1 || camera.x || camera.y;
  // The stage is there from frame one (its contents keep their own entrances).
  const group: CanvasElement = {
    type: 'group',
    id: 'cast-stage',
    x: 0,
    y: 0,
    at: 0,
    enter: 'none',
    origin: [frame.width / 2, frame.height / 2],
    children: drawn,
    keys: [
      { at: 0, scale: camera.zoom, x: camera.x, y: camera.y, dur: 0 },
      ...camKeys,
    ],
  };
  return {
    elements: moved ? [group] : drawn,
    state: pose,
    threads: stage.carried,
    notes,
    camera: stage.cam,
    edges,
    unit: size,
  };
}
