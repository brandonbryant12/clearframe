import type { Element } from '../domain.mjs';
import { isRecord } from './errors.mjs';
import {
  normalizeElements,
  elementsExtent as extent,
} from '../../film/canvas.mjs';

import type { CritiqueContext } from './critique-contracts.mjs';
import { typeCard } from './critique-common.mjs';

export function checkGeometry(ctx: CritiqueContext) {
  const { sb, beats, add } = ctx;
  // A drawing that occupies a small part of the frame reads as an icon on a slide.
  const area = sb.format.width * sb.format.height;
  // (A silent beat with one small mark is a deliberate pause, not an icon on a slide.)
  for (const b of beats.filter(
    (x) =>
      x.block === 'canvas' && x.props?.view == null && x.vo && !typeCard(x),
  )) {
    const box = drawingExtent(b.props?.elements ?? []);
    if (box && (box.w * box.h) / area < 0.18)
      add(
        'idea',
        b.id,
        `The drawing covers ${Math.round((100 * box.w * box.h) / area)}% of the frame. Set view: "auto" to fit it to the space, or draw it larger.`,
      );
  }
  // A mosaic needs room for its tiles: a shape a few tiles across reads as noise.
  for (const b of beats.filter((x) => x.block === 'canvas')) {
    const small: string[] = [];
    mosaicElements(b.props?.elements, b.props?.mosaic, small);
    if (small.length)
      add(
        'idea',
        b.id,
        `${small.length} mosaic shape(s) have too few tiles to read (${small.slice(0, 3).join(', ')}). Draw them bigger or use a smaller tile.`,
      );
  }
  checkCredits(ctx);
}

function drawingExtent(elements: Element[]) {
  try {
    return extent(
      normalizeElements(elements, 'critique elements', (message) => {
        throw new Error(message);
      }),
    );
  } catch {
    return null;
  }
}

function mosaicElements(
  list: Element[] | undefined,
  mosaic: unknown,
  small: string[],
): void {
  const visit = (list: Element[] | undefined): void =>
    (list ?? []).forEach((el) => {
      if (el.type === 'group') return visit(el.children);
      const m = (isRecord(el) ? el.mosaic : undefined) ?? mosaic;
      if (
        !m ||
        !['rect', 'circle', 'ellipse', 'poly', 'path'].includes(el.type)
      )
        return;
      if (el.fill == null || el.fill === 'none') return;
      const e = drawingExtent([el]),
        tile = isRecord(m) && typeof m.tile === 'number' ? m.tile : 16;
      // A shape needs enough tiles to read as a mosaic: ~25 in all, and at least two deep.
      if (
        e &&
        ((e.w * e.h) / (tile * tile) < 25 || Math.min(e.w, e.h) / tile < 2)
      )
        small.push(el.id ?? el.type);
    });
  visit(list);
}

function checkCredits({ sb, beats, add }: CritiqueContext): void {
  // Frame-pixel drawings that reach the source line sit on top of the attribution.
  const sourceTop = sb.format.height - (sb.frame ? 165 : 130);
  for (const b of beats.filter(
    (x) => x.block === 'canvas' && x.props?.source && !x.props.view,
  )) {
    const box = drawingExtent(
      (b.props?.elements ?? []).filter((el) => (el.w ?? 0) < sb.format.width),
    );
    if (box && box.bottom > sourceTop)
      add(
        'warn',
        b.id,
        `The drawing reaches y ${Math.round(box.bottom)}, into the source line (from y ${sourceTop}). Move it up or set view: "auto".`,
      );
  }
  // A lower-third title shares the bottom of the frame with frame-pixel drawings.
  for (const b of beats.filter(
    (x) =>
      x.block === 'canvas' &&
      (x.heading ?? sb.heading) === 'bottom' &&
      x.props?.title,
  )) {
    const box = !b.props?.view && drawingExtent(b.props?.elements ?? []);
    if (box && box.bottom > sb.format.height - 340)
      add(
        'warn',
        b.id,
        `heading: bottom puts the title where this drawing reaches (y ${Math.round(box.bottom)}). Set view: "auto" so the drawing fits above it, or keep the heading at the top.`,
      );
  }
}
