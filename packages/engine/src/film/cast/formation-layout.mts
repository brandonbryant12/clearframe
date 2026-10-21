import type {
  CastFormation,
  CastFrame,
  FormationOptions,
  CastPose,
} from './contracts.mjs';
export function createLayout(
  f: CastFormation,
  ids: string[],
  frame: CastFrame,
  {
    size,
    seed = 0,
    current = new Map<string, CastPose>(),
    extent = () => [size / 2, size / 2],
    below = () => 0,
  }: FormationOptions,
) {
  // A heading takes a band of the frame (`frame.top` or `frame.bottom`); the cast keeps to the rest.
  const { width: W, height: H } = frame,
    tall = H > W,
    u = Math.min(W, H),
    top = frame.top ?? 0,
    bottom = frame.bottom ?? H,
    A = bottom - top;
  // `beside` sets the formation next to an object where it now stands, on the side facing the middle
  // of the frame (up and to the right of an object in the middle), so it never runs off an edge.
  const near = f.beside != null ? current.get(f.beside) : null;
  const sx = near && near.x > W / 2 + 1 ? -1 : 1,
    sy = near && near.y < H / 2 - 1 ? 1 : -1;
  // `on` centres the formation on an object where it stands (a small ring around it, a pile on it).
  const host = f.on != null ? current.get(f.on) : null;
  let center = [W / 2, top + A / 2];
  if (near)
    center = [
      near.x + sx * size * (near.scale ?? 1) * 0.95,
      near.y + sy * size * (near.scale ?? 1) * 0.75,
    ];
  if (host) center = [host.x, host.y];
  const [cx, cy] = f.center ?? center;
  // `spread` is in frame pixels; a small number (4 or less) reads as a multiple of the default.
  let wide = f.spread ?? null;
  if (wide != null && wide <= 4) wide *= u * 0.34;
  const spread = wide ?? u * 0.34,
    scale = f.scale ?? 1,
    n = ids.length,
    out = new Map<string, CastPose>();
  const place = (
    id: string,
    x: number,
    y: number,
    extra: Partial<CastPose> = {},
  ) => out.set(id, { x, y, scale, rotate: 0, opacity: 1, ...extra });
  const line = tall ? 'column' : 'row';
  const form = f.form === 'line' ? line : f.form;

  return {
    f,
    ids,
    frame,
    size,
    seed,
    current,
    extent,
    below,
    W,
    H,
    tall,
    u,
    top,
    bottom,
    A,
    near,
    sx,
    sy,
    host,
    cx,
    cy,
    wide,
    spread,
    scale,
    n,
    out,
    place,
    form,
  };
}
export type FormationLayout = ReturnType<typeof createLayout>;
