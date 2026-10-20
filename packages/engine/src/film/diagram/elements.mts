import type { CanvasElement } from '../types.mjs';
import type {
  DiagramState,
  DiagramLayout,
  DiagramRoutes,
  Status,
} from './contracts.mjs';
import { check, required, TIME, COLOR, r2 } from './shared.mjs';
import { rounded } from './rounded.mjs';
import { drawNode } from './node.mjs';
export function diagramDrawing(
  { N, E, sends, exact }: DiagramState,
  layout: DiagramLayout,
  { routes, frames }: DiagramRoutes,
): CanvasElement[] {
  const { u, size, edgeSize } = layout;
  const route = (id: string) => required(routes.get(id), id);
  // ---- elements: boundaries, connectors, requests, components (draw order)
  const out: CanvasElement[] = [];
  out.push(...drawFrames(frames, N, layout));
  for (const e of E.values()) {
    const r = route(e.id),
      dashed = e.style === 'dashed';
    const line = (color: string): CanvasElement => ({
      type: 'path',
      d: r.d,
      stroke: color,
      fill: 'none',
      width: u * 0.0035,
      arrow: 'end',
      head: u * 0.014,
      ...(dashed || e.flow ? { dash: [u * 0.012, u * 0.009] } : {}),
    });
    const span = (t0: number, t1: number | null) => ({
      at: t0,
      ...(t1 != null ? { exitAt: Math.max(t0, t1), exitDur: TIME.change } : {}),
    });
    out.push({
      ...line(COLOR[e.status[0][1]]),
      id: `diagram-edge-${e.id}`,
      enter: dashed || e.flow ? 'fade' : 'draw',
      dur: TIME.edge,
      ...span(e.at, e.exitAt),
      ...(e.flow ? { loop: { type: 'dash', period: 1.4 } } : {}),
    });
    // A status change recolours the connector on top; the earlier colour goes once it has faded in.
    e.status.slice(1).forEach(([t, s], k, rest) => {
      const until = rest[k + 1]?.[0];
      out.push({
        ...line(COLOR[s]),
        enter: 'fade',
        dur: TIME.change,
        ...(until != null
          ? { at: t, exitAt: until + TIME.change, exitDur: 0.01 }
          : span(t, e.exitAt)),
      });
    });
    if (e.label)
      out.push({
        type: 'text',
        id: `diagram-edge-${e.id}-label`,
        text: e.label,
        ...r.label,
        size: edgeSize,
        fill: 'ink',
        font: 'mono',
        enter: 'fade',
        dur: TIME.node,
        ...span(e.at + TIME.edge * 0.5, e.exitAt),
      });
  }
  // Requests: a token per hop that slips behind each component (it is "handled" there).
  const pulses = new Map<string, number[]>(),
    late: CanvasElement[] = [];
  for (const s of sends) {
    s.path.slice(1).forEach((to, k) => {
      const from = s.path[k],
        fwd = [...E.values()].find((e) => e.from === from && e.to === to),
        back =
          !fwd && [...E.values()].find((e) => e.from === to && e.to === from);
      check(
        fwd || back,
        `${s.where}.send: no connection between ${from} and ${to}`,
      );
      const e = required(fwd || back || undefined, 'send edge'),
        r = route(e.id),
        pts = back ? [...r.pts].reverse() : r.pts,
        d = rounded(pts, u * 0.014);
      const t = s.t + k * s.hop,
        [x0, y0] = pts[0];
      if (exact)
        check(
          t >= e.at + TIME.edge - 0.05 &&
            (e.exitAt == null || t + s.hop <= e.exitAt + 0.05),
          `${s.where}.send: ${e.id} is not on screen for the hop at ${t.toFixed(2)}s`,
        );
      const ride: Omit<CanvasElement, 'type'> = {
        at: t,
        enter: 'fade',
        dur: 0.12,
        exitAt: t + s.hop + 0.04,
        exitDur: 0.12,
        origin: [r2(x0), r2(y0)],
        along: { d, at: t, dur: s.hop, ease: 'inOut' },
      };
      out.push({
        type: 'circle',
        cx: r2(x0),
        cy: r2(y0),
        r: u * 0.011,
        fill: 'accent',
        stroke: 'surface',
        width: u * 0.003,
        ...structuredClone(ride),
      });
      // The request slips behind each component (it is handled there); its name stays on top,
      // on the side away from connector labels.
      const flat = Math.abs(pts[1][1] - y0) < 1;
      // The name rides the first hop and clears before the handoff.
      if (s.label && k === 0)
        late.push({
          type: 'text',
          text: s.label,
          x: r2(flat ? x0 : x0 - u * 0.022),
          y: r2(flat ? y0 + size * 1.25 : y0 + size * 0.3),
          size: size * 0.74,
          anchor: flat ? 'middle' : 'end',
          fill: 'accent',
          font: 'mono',
          ...structuredClone(ride),
          exitAt: t + s.hop * 0.8,
        });
      const arrival = t + s.hop;
      const arrivals = pulses.get(to) ?? [];
      arrivals.push(arrival);
      pulses.set(to, arrivals);
    });
  }
  out.push(...drawNodes(N, pulses, layout));
  return [...out, ...late];
}

function drawFrames(
  frames: DiagramRoutes['frames'],
  N: DiagramState['N'],
  { u, size }: DiagramLayout,
): CanvasElement[] {
  const node = (id: string) => required(N.get(id), id);
  const out: CanvasElement[] = [];
  for (const { g, box: frame, pad } of frames) {
    const start = Math.min(...g.nodes.map((id) => node(id).at)),
      exits = g.nodes.map((id) => node(id).exitAt);
    out.push({
      type: 'group',
      id: `diagram-group-${g.id}`,
      at: Math.max(0, start - 0.1),
      enter: 'fade',
      dur: TIME.node,
      ...(exits.every((v) => v != null)
        ? { exitAt: Math.max(...exits), exitDur: TIME.node }
        : {}),
      children: [
        {
          type: 'rect',
          x: r2(frame.l),
          y: r2(frame.t),
          w: r2(frame.r - frame.l),
          h: r2(frame.b - frame.t),
          r: u * 0.018,
          fill: 'none',
          stroke: 'line',
          width: u * 0.0022,
          dash: [u * 0.01, u * 0.008],
          enter: 'none',
        },
        {
          type: 'text',
          text: g.label,
          x: r2(frame.l + pad * 0.6),
          y: r2(frame.t + size * 0.95),
          size: size * 0.72,
          anchor: 'start',
          fill: 'muted',
          font: 'mono',
          upper: true,
          enter: 'none',
        },
      ],
    });
  }
  return out;
}

function drawNodes(
  N: DiagramState['N'],
  pulses: Map<string, number[]>,
  layout: DiagramLayout,
): CanvasElement[] {
  const { hw, hh, nw, nh, size, nameSize, u, gap, at } = layout;
  const out: CanvasElement[] = [];
  for (const n of N.values()) {
    const c = at(n.id),
      draw = (status: Status) =>
        drawNode(n, status, { hw, hh, nw, nh, size, nameSize, u });
    const children = draw(n.status[0][1]);
    // Each status change redraws the component on top, so the change reads as a change; the
    // earlier drawing goes once the next one has faded in over it.
    n.status.slice(1).forEach(([t, s], k, rest) => {
      const until = rest[k + 1]?.[0] ?? null;
      children.push({
        type: 'group',
        at: t,
        enter: 'fade',
        dur: TIME.change,
        ...(until != null
          ? { exitAt: until + TIME.change, exitDur: 0.01 }
          : {}),
        children: draw(s),
      });
    });
    for (const t of pulses.get(n.id) ?? [])
      children.push({
        type: 'rect',
        x: -hw - gap,
        y: -hh - gap,
        w: nw + gap * 2,
        h: nh + gap * 2,
        r: n.kind === 'state' ? hh + gap : u * 0.014,
        fill: 'none',
        stroke: 'accent',
        width: u * 0.004,
        enter: 'fade',
        at: t - 0.05,
        dur: 0.12,
        exitAt: t + 0.45,
        exitDur: 0.35,
      });
    out.push({
      type: 'group',
      id: `diagram-node-${n.id}`,
      x: r2(c.x),
      y: r2(c.y),
      enter: 'fade',
      at: n.at,
      dur: TIME.node,
      ...(n.exitAt != null ? { exitAt: n.exitAt, exitDur: TIME.node } : {}),
      children,
    });
  }
  return out;
}
