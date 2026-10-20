import { fail, numberOr, own } from '../fields.mjs';

import { actorOf, edgeGap } from '../stage-kit.mjs';

import type { Handler } from './contracts.mjs';

/** A note beside an actor with a leader line; the box stays inside the stage area. */
export const callout: Handler = (build, { ev, where, t, until, id }) => {
  const a = actorOf(build, ev.actor, where);
  const text = String(ev.text ?? '');
  if (!text.trim() || text.length > 60)
    fail(where, 'callout text is 1–60 characters');
  const side = ev.side ?? 'top';
  const offsets = {
    top: [0, -(a.h / 2 + 90)],
    bottom: [0, a.h / 2 + 90],
    left: [-(a.w / 2 + 230), 0],
    right: [a.w / 2 + 230, 0],
  } satisfies Record<string, [number, number]>;
  const off =
    own(offsets, side) ?? fail(where, 'side is top, bottom, left or right');
  const boxW = Math.max(180, 40 + text.length * 14.5),
    boxH = 64;
  const dx = numberOr(ev.dx, 0, where, 'dx'),
    dy = numberOr(ev.dy, 0, where, 'dy');
  // Keep the box inside the stage area wherever its actor stands (the leader still reaches the actor).
  const { area } = build;
  const [bx, by] = [a.x + off[0] + dx, a.y + off[1] + dy];
  const nudgeX =
    Math.max(area.left - (bx - boxW / 2), 0) +
    Math.min(area.right - (bx + boxW / 2), 0);
  const nudgeY =
    Math.max(area.top - (by - boxH / 2), 0) +
    Math.min(area.bottom - (by + boxH / 2), 0);
  off[0] += nudgeX;
  off[1] += nudgeY;
  const cid = `${id}`;
  const leave =
    until != null ? { exitAt: until, exit: 'fade', exitDur: 0.3 } : {};
  build.out.over.push({
    type: 'group',
    id: cid,
    x: 0,
    y: 0,
    attach: { to: a.id, dx: off[0] + dx, dy: off[1] + dy },
    at: t,
    enter: 'pop',
    ...leave,
    children: [
      {
        type: 'rect',
        x: -boxW / 2,
        y: -boxH / 2,
        w: boxW,
        h: boxH,
        r: 16,
        fill: ev.fill ?? 'ink',
        enter: 'none',
      },
      {
        type: 'text',
        text,
        x: 0,
        y: 9,
        anchor: 'middle',
        size: 26,
        font: 'strong',
        fill: ev.fill === 'surface' ? 'ink' : 'bg',
        enter: 'none',
        fit: boxW - 28,
      },
    ],
  });
  build.out.over.push({
    type: 'connector',
    id: `${cid}.leader`,
    from: cid,
    to: a.id,
    route: 'straight',
    gapFrom: side === 'top' || side === 'bottom' ? boxH / 2 + 4 : boxW / 2 + 4,
    gapTo: edgeGap(a.w, a.h, -off[0], -off[1], 8),
    stroke: ev.fill ?? 'ink',
    width: 3,
    arrow: 'none',
    at: t + 0.1,
    enter: 'draw',
    dur: 0.35,
    ...leave,
  });
};
