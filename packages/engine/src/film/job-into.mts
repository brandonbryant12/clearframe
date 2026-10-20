import type {
  ResolvedStoryboard as Storyboard,
  Timing,
} from '../engine/domain.mjs';
import type { JobReport, JobBeat, CanvasElement, Extent } from './types.mjs';

import { elementsExtent } from './canvas.mjs';

/**
 * A beat that goes `into` an element of the previous canvas beat (a screen, a page, a tile): the
 * element's box in frame pixels, through that beat's camera, for the compositor to zoom through.
 */
export function findElementExtent(
  list: CanvasElement[] | undefined,
  id: string,
  dx = 0,
  dy = 0,
): Extent | null {
  for (const element of list ?? []) {
    const [kx, ky] = (element.keys ?? []).reduce(
      ([x, y], key) => [key.x ?? x, key.y ?? y],
      [0, 0],
    );
    if (element.id === id) {
      const extent = elementsExtent([element]);
      if (extent)
        return {
          ...extent,
          left: extent.left + dx + kx,
          top: extent.top + dy + ky,
        };
    } else if (element.type === 'group') {
      const found = findElementExtent(
        element.children,
        id,
        dx + (element.x ?? 0) + kx,
        dy + (element.y ?? 0) + ky,
      );
      if (found) return found;
    }
  }
  return null;
}

export function linkInto(
  beats: JobBeat[],
  sb: Storyboard,
  timing: Timing,
  report: JobReport,
) {
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i],
      id = sb.beats.find((s) => s.id === b.id)?.into;
    if (b.transition !== 'into') continue;
    const prev = beats[i - 1];
    if (typeof id !== 'string' || !id.trim()) {
      report.errors.push(
        `${b.id}: transition "into" needs into: the id of an element in the previous canvas beat to go through`,
      );
      continue;
    }
    if (!prev || prev.block !== 'canvas') {
      report.errors.push(
        `${b.id}: into "${id}" needs a canvas beat before it to go through; use cut or fade here`,
      );
      continue;
    }
    const found = findElementExtent(prev.props.elements, id);
    if (!found || found.w < 4 || found.h < 4) {
      report.errors.push(
        `${b.id}: into "${id}" names no element of ${prev.id} (give the screen, page or tile to go through that id)`,
      );
      continue;
    }
    b.into = throughCamera(prev, found, timing);
  }
}

function throughCamera(prev: JobBeat, found: Extent, timing: Timing): number[] {
  // Through the previous beat's camera, if it has one: world pixels to frame pixels.
  const [vx, vy, vw, vh] =
    Array.isArray(prev.props?.view) && prev.props.view.length === 4
      ? prev.props.view
      : [0, 0, 0, 0];
  const [W, H] = [timing.width, timing.height];
  const kx = vw ? W / vw : 1,
    ky = vh ? H / vh : 1;
  return [
    (found.left - vx) * kx,
    (found.top - vy) * ky,
    found.w * kx,
    found.h * ky,
  ].map((v) => Math.round(v * 10) / 10);
}
