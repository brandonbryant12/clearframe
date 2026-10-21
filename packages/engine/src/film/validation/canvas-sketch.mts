import type {
  BlockProps,
  PropHelpers,
  ValidationFrame,
  SketchDrawing,
} from '../types.mjs';
import { messageOf } from '../guards.mjs';
import { elementsExtent } from '../canvas.mjs';
import { sketch } from '../sketches.mjs';
import type { FramePreset } from '../sketch-kit.mjs';

const cameraFields = ['view', 'viewFrom', 'viewDur', 'dolly', 'focus'] as const;
function framePreset(width: number, height: number): FramePreset {
  if (height > width * 1.1)
    return height > width * 1.5 ? 'vertical' : 'portrait';
  return width > height * 1.1 ? 'landscape' : 'square';
}

/** A caption over a ground plane remains over the picture; otherwise leave room below it. */
function fitCaptions(
  drawn: SketchDrawing,
  p: BlockProps,
  frame: ValidationFrame,
): void {
  if (!frame.captions || drawn.view || p.view != null || p.title) return;
  const { width, height } = frame;
  const tall = height > width * 1.1;
  const extent = elementsExtent(
    drawn.elements.filter(
      (el) => !(typeof el.w === 'number' && el.w >= width * 0.9),
    ),
  );
  if (!extent || extent.bottom >= height - 20) return;
  const lower = height * (tall ? 0.8 : 0.75);
  const upper = height * (tall ? 0.1 : 0.08);
  const lift = Math.min(extent.bottom - lower, extent.top - upper);
  if (lift > 4) drawn.view = [0, Math.round(lift), width, height];
}

export function expandSketch(
  p: BlockProps,
  h: PropHelpers,
  frame: ValidationFrame,
): void {
  if (p.sketch == null) return;
  let drawn: SketchDrawing;
  try {
    drawn = sketch(p.sketch, framePreset(frame.width, frame.height), {
      seed: p.seed,
      text: p.sketchText,
      say: p.sketchSay,
      params: p.sketchParams,
    });
  } catch (error) {
    return h.fail(messageOf(error));
  }
  // Placed sketches use the containing world's camera.
  if (p.place != null) for (const key of cameraFields) delete drawn[key];
  else fitCaptions(drawn, p, frame);
  p.elements = [...drawn.elements, ...(p.elements ?? [])];
  for (const key of cameraFields) {
    if (drawn[key] != null && p[key] == null)
      Object.assign(p, { [key]: drawn[key] });
  }
  delete p.sketch;
  delete p.sketchText;
  delete p.sketchSay;
  delete p.sketchParams;
  delete p.seed;
}
