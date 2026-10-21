import type { BlockProps, PropHelpers } from '../types.mjs';

import { normalizeElements } from '../canvas.mjs';

import { momentSpec } from '../moments.mjs';

import type { BlockValidator } from './contracts.mjs';
import { validateSource } from './canvas-source.mjs';
import { expandSketch } from './canvas-sketch.mjs';
import {
  expandDiagram,
  expandExplanation,
  placePanel,
  expandChart,
  expandPlates,
} from './canvas-expansion.mjs';
import {
  validateReveal,
  validateViews,
  validateCameraMovement,
} from './canvas-camera.mjs';
import { validateDepth, applyTreatments } from './canvas-styling.mjs';
export const validateCanvas: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
  frame,
) => {
  if (p.moments != null) momentSpec(p.moments, h.fail);
  expandDiagram(p, h, frame);
  validateSource(p, h);
  expandSketch(p, h, frame);
  expandExplanation(p, h, frame);
  placePanel(p, h);
  expandChart(p, h, frame);
  expandPlates(p, h, frame);
  if (p.support != null)
    h.fail(
      'canvas draws only its elements; add a text element instead of support',
    );
  validateReveal(p, h);
  validateViews(p, h);
  validateCameraMovement(p, h);
  if (
    p.stagger != null &&
    (!Number.isFinite(p.stagger) || p.stagger < 0 || p.stagger > 3)
  )
    h.fail('stagger must be 0–3 seconds');
  if (!Array.isArray(p.elements) || (!p.elements.length && !p.world))
    h.fail('elements needs at least one element');
  p.elements = normalizeElements(p.elements, 'elements', h.fail, {
    count: 0,
    frame: { width: frame.width ?? 1920, height: frame.height ?? 1080 },
  });
  validateDepth(p, h);
  applyTreatments(p, h, p.elements);
};
