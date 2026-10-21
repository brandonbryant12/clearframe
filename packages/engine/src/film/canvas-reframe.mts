import type { CanvasElement, Extent } from './types.mjs';
import { elementsExtent } from './canvas-extent.mjs';

/** A word's box at rest, padded a little for glyphs that run wider than the estimate. */
export interface WordBox {
  l: number;
  r: number;
  t: number;
  b: number;
  size: number;
}

/**
 * A camera rect re-framed for another aspect ratio (a landscape world in a vertical film):
 * framed on what the authored shot shows of the beat's own drawing, with its words whole
 * inside the new frame's title-safe area, or, for a beat that mostly reveals earlier work,
 * on the same centre with the same area. `context` is drawing the frame may also show (the
 * world drawn by earlier beats). The new frame never slices a word it can help: it takes
 * the word in while type stays readable, or slides to leave it out.
 */
export function reframeView(
  view: number[],
  elements: CanvasElement[],
  aspect: number,
  context: CanvasElement[] = [],
): number[] {
  const [, , w, h] = view;
  if (Math.abs(w / h - aspect) / aspect < 0.15) return view;
  // The subject is the beat's own foreground inside the shot: backdrops, parallax layers,
  // behind layers and particles do not say where to look, and neither does work the shot
  // leaves out on purpose (labels cropped off to land on a takeaway). A composition that
  // cannot survive the crop (a map beside its labels) needs its own rect: `viewTall`.
  const subject = reframeSubject(view, elements, aspect);
  const { foreground, safe } = subject;
  let { l, t, r, b } = subject;
  // The widest frame at which type of this size is still read on a phone (22 px of a
  // 1080-line frame).
  const readable = (size: number): number =>
    (size * 1080 * Math.max(1, aspect)) / 22;
  const sizes = foreground
    .filter((el) => el.type === 'text')
    .map((el) => el.size ?? 48);
  const legible = sizes.length ? readable(Math.min(...sizes)) : Infinity;
  // The subject's words come whole first, then readable, then inside the title-safe margin:
  // the margin gives way before its type drops below reading size. The frame is no wider
  // than the authored shot either, so its type is never smaller than that shot allowed
  // (what still does not fit is reported, for a `viewTall`).
  let cap = w;
  const widthFor = ([l, t, r, b]: number[]): number =>
    Math.max((r - l) / safe, ((b - t) / safe) * aspect, h * aspect * 0.9);
  const frame = (): number[] => {
    const whole = Math.max(r - l, (b - t) * aspect, h * aspect * 0.9);
    const nw = Math.min(
      cap,
      Math.max(whole, Math.min(widthFor([l, t, r, b]), legible)),
    );
    return [
      (l + r) / 2 - nw / 2,
      (t + b) / 2 - nw / aspect / 2,
      nw,
      nw / aspect,
    ];
  };
  // It zooms out past that only to take in a word it would otherwise slice, and only while
  // the word and the subject's own words are still read, and to half as wide again at most.
  const ceiling = Math.min(w * 1.5, legible);
  // Words the new frame reaches (it shows more than the shot did; a tall one far more above
  // and below). The estimate gets a little room, since real glyphs run wider than it on some
  // faces. Only words that hold still are placed; one that travels or turns is elsewhere.
  const words = textsOf([...elements, ...context])
    .map((el): WordBox | null => {
      const e = elementsExtent([el]),
        pad = (el.size ?? 48) * 0.15;
      return (
        e && {
          l: e.left - pad,
          r: e.left + e.w + pad,
          t: e.top,
          b: e.bottom,
          size: el.size ?? 48,
        }
      );
    })
    .filter((e): e is WordBox => e !== null);
  const cut = ([fx, fy, fw, fh]: number[]): WordBox[] =>
    words.filter(
      (e) =>
        e.l < fx + fw &&
        e.r > fx &&
        e.t < fy + fh &&
        e.b > fy &&
        (e.l < fx || e.r > fx + fw || e.t < fy || e.b > fy + fh),
    );
  const includeWord = (e: WordBox): boolean => {
    const box = [
        Math.min(l, e.l),
        Math.min(t, e.t),
        Math.max(r, e.r),
        Math.max(b, e.b),
      ],
      nw = widthFor(box);
    if (nw <= cap || nw <= Math.min(ceiling, readable(e.size))) {
      [l, t, r, b] = box;
      cap = Math.max(cap, nw);
      return true;
    }
    return false;
  };
  for (let pass = 0, grew = true; pass < 4 && grew; pass++) {
    grew = false;
    for (const e of cut(frame())) grew = includeWord(e) || grew;
  }
  // Or slide past a word that lies beyond the subject, while the subject stays in frame, its
  // own words inside the title-safe area, and its centre within a fifth of the frame's centre.
  // A longer slide would leave the subject off to one side: the cut word is then reported,
  // for a `viewTall`.
  let shot = frame();
  const ownWords = textsOf(foreground)
    .map((el) => elementsExtent([el]))
    .filter((e): e is Extent => e !== null);
  const keeps = ([fx, fy, fw, fh]: number[]): boolean => {
    const [mx, my] = [(fw * (1 - safe)) / 2, (fh * (1 - safe)) / 2];
    return (
      Math.abs((l + r) / 2 - (fx + fw / 2)) <= fw * 0.2 &&
      Math.abs((t + b) / 2 - (fy + fh / 2)) <= fh * 0.2 &&
      l >= fx &&
      r <= fx + fw &&
      t >= fy &&
      b <= fy + fh &&
      ownWords.every(
        (e) =>
          e.left >= fx + mx &&
          e.left + e.w <= fx + fw - mx &&
          e.top >= fy + my &&
          e.bottom <= fy + fh - my,
      )
    );
  };
  for (const e of cut(shot)) {
    const moves = candidateMoves(e, shot, { l, t, r, b });
    const slid = moves
      .map(([dx, dy]) => [shot[0] + dx, shot[1] + dy, shot[2], shot[3]])
      .find((f) => keeps(f) && cut(f).length < cut(shot).length);
    if (slid) shot = slid;
  }
  return shot;
}

/** Words that hold still at a known place: text at its world position (groups add their
 * offsets), leaving out any that travel, turn or scale, alone or with their group. */
export function textsOf(
  list: CanvasElement[],
  dx = 0,
  dy = 0,
): CanvasElement[] {
  const still = (el: CanvasElement): boolean =>
    !(el.keys ?? []).some(
      (k) => k.x != null || k.y != null || k.scale != null || k.rotate != null,
    ) &&
    !el.along &&
    !el.rotate &&
    (el.scale ?? 1) === 1 &&
    !['spin', 'orbit', 'sway', 'rock'].includes(el.loop?.type ?? '');
  return list.flatMap((el) => {
    if (!still(el)) return [];
    if (el.type === 'group')
      return textsOf(el.children ?? [], dx + (el.x ?? 0), dy + (el.y ?? 0));
    if (el.type === 'text')
      return [{ ...el, x: (el.x ?? 0) + dx, y: (el.y ?? 0) + dy }];
    return [];
  });
}

function reframeSubject(
  view: number[],
  elements: CanvasElement[],
  aspect: number,
) {
  const [x, y, w, h] = view;
  const inShot = (e: Extent | null): boolean =>
    !!e &&
    e.w <= w &&
    e.h <= h &&
    e.left < x + w &&
    e.left + e.w > x &&
    e.top < y + h &&
    e.bottom > y;
  const foreground = elements.filter(
    (el) =>
      !el.carried &&
      !el.behind &&
      el.depth == null &&
      el.type !== 'particles' &&
      inShot(elementsExtent([el])),
  );
  const own = elementsExtent(foreground);
  // What the shot shows of it, widened so that every word it shows is whole.
  let [l, t, r, b] = own
    ? [
        Math.max(own.left, x),
        Math.max(own.top, y),
        Math.min(own.left + own.w, x + w),
        Math.min(own.bottom, y + h),
      ]
    : [NaN, NaN, NaN, NaN];
  for (const el of foreground.filter((el) => el.type === 'text')) {
    const e = elementsExtent([el]);
    if (!e) continue;
    [l, t, r, b] = [
      Math.min(l, e.left),
      Math.min(t, e.top),
      Math.max(r, e.left + e.w),
      Math.max(b, e.bottom),
    ];
  }
  // A tall frame keeps type in its middle 80%, a wide one in its middle 90%, with room for
  // the slow push (the same margin block content keeps on tall frames).
  const safe = aspect < 1 ? 0.77 : 0.88;
  // A beat that mostly reveals earlier work (a pull-back) keeps its centre and area.
  if (!own || r - l < w * 0.3) {
    const nw = Math.sqrt(w * h * aspect);
    [l, r, t, b] = [
      x + (w - nw * safe) / 2,
      x + (w + nw * safe) / 2,
      y + h / 2,
      y + h / 2,
    ];
  }
  return { foreground, safe, l, t, r, b };
}

function candidateMoves(
  e: WordBox,
  shot: number[],
  { l, t, r, b }: Pick<WordBox, 'l' | 't' | 'r' | 'b'>,
): number[][] {
  const moves: number[][] = [];
  if (e.r <= l) moves.push([e.r - shot[0], 0]);
  else if (e.l >= r) moves.push([e.l - (shot[0] + shot[2]), 0]);
  if (e.b <= t) moves.push([0, e.b - shot[1]]);
  else if (e.t >= b) moves.push([0, e.t - (shot[1] + shot[3])]);
  return moves;
}
