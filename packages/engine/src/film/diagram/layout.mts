import { diagramRanks } from './layout-ranks.mjs';
import type { Point } from '../types.mjs';
import type {
  DiagramState,
  DiagramSpec,
  DiagramLayout,
  ResolvedNode,
  Centre,
  Box,
} from './contracts.mjs';
import { check, required } from './shared.mjs';

export function diagramLayout(
  input: DiagramSpec,
  { N, E, exact }: DiagramState,
  width: number,
  height: number,
): DiagramLayout {
  const direction = input.direction ?? 'auto';
  const { slotOf, slots, rankOf, ranks, byRank, pos } = diagramRanks({
    N,
    E,
    exact,
  });
  const across =
    direction === 'horizontal' || (direction === 'auto' && width > height);
  const widest = Math.max(...byRank.map((r) => r.length));
  const u = Math.min(width, height);
  const box = input.area ?? [0.1, 0.24, 0.8, 0.58];
  check(
    Array.isArray(box) &&
      box.length === 4 &&
      box.every((v) => Number.isFinite(v) && v >= 0 && v <= 1) &&
      box[0] + box[2] <= 1.001 &&
      box[1] + box[3] <= 1.001 &&
      box[2] >= 0.2 &&
      box[3] >= 0.2,
    'area must be [x, y, w, h] in 0–1 of the frame, at least 0.2 wide and tall',
  );
  const area = {
    x: width * box[0],
    y: height * box[1],
    w: width * box[2],
    h: height * box[3],
  };
  const cols = across ? ranks : widest,
    rows = across ? widest : ranks;
  // A short row gives its boxes more of the width (longer names stay large); a long one keeps
  // room on its connectors for their labels.
  const acrossWidth = cols <= 4 ? 0.7 : 0.62;
  const nw = Math.min(
      u * 0.29,
      (area.w / cols) * (across ? acrossWidth : 0.72),
    ),
    nh = Math.min(u * 0.15, (area.h / rows) * (across ? 0.55 : 0.5));
  const size = Math.min(u * 0.034, nh * 0.27);
  check(
    nw >= u * 0.13 && nh >= u * 0.065,
    `${ranks} steps deep × ${widest} wide is too dense for this ${width}×${height} frame; split the shot, change direction, or widen area`,
  );
  const hw = nw / 2,
    hh = nh / 2,
    gap = u * 0.008;
  // Text shrinks to fit its space, but never below the smallest size a phone can read (the
  // audit's floor): say so now, with the label, instead of after a render.
  const legible = u * 0.0195,
    em = { strong: 0.5, mono: 0.6 };
  const fits = (text: string, room: number, font: 'strong' | 'mono') =>
    text.length * em[font] * legible <= room;
  const roomOf = (n: ResolvedNode) =>
    nw * (['user', 'queue'].includes(n.kind) ? 0.63 : 0.85);
  for (const n of N.values())
    check(
      fits(n.label, roomOf(n), 'strong'),
      `${n.id}: "${n.label}" cannot be read at this size (${Math.round(roomOf(n))} px wide); shorten it or put fewer components in a rank`,
    );
  // Component names share one size: the largest at which the longest still fits.
  const nameSize = Math.max(
    legible,
    Math.min(
      size,
      ...[...N.values()].map((n) => roomOf(n) / (n.label.length * 0.54)),
    ),
  );
  const edgeSize = Math.max(legible, Math.min(size * 0.85, nameSize * 0.9));
  const centre = placeNodes(
    { slots, rankOf, ranks, byRank, pos },
    N,
    { hw, hh, nw, nh, area, across },
    widest,
  );
  const at = (id: string) => required(centre.get(slotOf(id)), id);
  const life = (id: string): Point => {
    const members = [...N.values()].filter((n) => slotOf(n.id) === id);
    return [
      Math.min(...members.map((n) => n.at)),
      Math.max(...members.map((n) => n.exitAt ?? Infinity)),
    ];
  };
  const rectOf = (c: Centre, pad = 0): Box => ({
    l: c.x - hw - pad,
    r: c.x + hw + pad,
    t: c.y - hh - pad,
    b: c.y + hh + pad,
  });
  checkOverlaps(slots, life, rectOf, centre, gap);

  return {
    hw,
    hh,
    nw,
    nh,
    size,
    nameSize,
    u,
    gap,
    area,
    across,
    slots,
    centre,
    edgeSize,
    slotOf,
    at,
    life,
    rectOf,
    fits,
  };
}

function placeNodes(
  {
    slots,
    rankOf,
    ranks,
    byRank,
    pos,
  }: Pick<
    ReturnType<typeof diagramRanks>,
    'slots' | 'rankOf' | 'ranks' | 'byRank' | 'pos'
  >,
  N: DiagramState['N'],
  {
    hw,
    hh,
    nw,
    nh,
    area,
    across,
  }: Pick<DiagramLayout, 'hw' | 'hh' | 'nw' | 'nh' | 'area' | 'across'>,
  widest: number,
): Map<string, Centre> {
  const node = (id: string) => required(N.get(id), id);
  const centre = new Map<string, Centre>();
  for (const s of slots) {
    // Ranks run along the main axis; each rank is centred on a grid of `widest` lanes.
    const n = node(s),
      r = rankOf(s),
      lane = (widest - byRank[r].length) / 2 + (pos.get(s) ?? 0);
    const main = ranks === 1 ? 0.5 : r / (ranks - 1),
      cross = widest === 1 ? 0.5 : lane / (widest - 1);
    const fx = n.x ?? (across ? main : cross),
      fy = n.y ?? (across ? cross : main);
    centre.set(s, {
      x: area.x + hw + (area.w - nw) * fx,
      y: area.y + hh + (area.h - nh) * fy,
    });
  }
  return centre;
}

function checkOverlaps(
  slots: string[],
  life: DiagramLayout['life'],
  rectOf: DiagramLayout['rectOf'],
  centre: Map<string, Centre>,
  gap: number,
): void {
  const meets = (p: Box, q: Box) =>
    p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b;
  for (let i = 0; i < slots.length; i++)
    for (let j = i + 1; j < slots.length; j++) {
      const [a0, a1] = life(slots[i]),
        [b0, b1] = life(slots[j]);
      if (
        a0 < b1 &&
        b0 < a1 &&
        meets(
          rectOf(required(centre.get(slots[i]), slots[i]), gap),
          rectOf(required(centre.get(slots[j]), slots[j]), gap),
        )
      )
        check(
          false,
          `${slots[i]} and ${slots[j]} overlap on screen; move one (x, y) or let the auto layout place both`,
        );
    }
}
