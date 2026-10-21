import type {
  BlockProps,
  PropHelpers,
  CanvasElement,
  ValidationFrame,
} from '../types.mjs';
import { messageOf } from '../guards.mjs';
import { EXPLAIN } from '../explain.mjs';
import { diagramElements } from '../system-diagrams.mjs';

import { plateElements } from '../../engine/lib/plates.mjs';
import { chartSpec, chartElements } from '../data-canvas.mjs';

export function expandDiagram(
  p: BlockProps,
  h: PropHelpers,
  frame: ValidationFrame,
): void {
  if (p.diagram != null) {
    try {
      p.elements = [
        ...diagramElements(p.diagram, frame),
        ...(p.elements ?? []),
      ];
    } catch (e) {
      h.fail(messageOf(e));
    }
    delete p.diagram;
  }
}

export function expandExplanation(
  p: BlockProps,
  h: PropHelpers,
  frame: ValidationFrame,
): void {
  for (const k of ['graph', 'accumulate', 'estimate', 'field'] as const)
    if (p[k] != null) {
      try {
        p.elements = [...EXPLAIN[k](p[k], frame), ...(p.elements ?? [])];
      } catch (e) {
        h.fail(`${k}: ${messageOf(e)}`);
      }
      delete p[k];
    }
}

export function placePanel(p: BlockProps, h: PropHelpers): void {
  if (p.place != null) {
    const [px, py, ps = 1] = Array.isArray(p.place) ? p.place : [];
    validatePlace(p.place, h.fail);
    // A panel is a flat picture: depth layers would slide out of its frame as the world camera travels.
    const flat = (list: CanvasElement[] | undefined): CanvasElement[] =>
      (list ?? []).map(({ z: _depth, ...el }) =>
        el.children ? { ...el, children: flat(el.children) } : el,
      );
    p.elements = [
      {
        type: 'group',
        x: px,
        y: py,
        enter: 'fade',
        at: 0,
        dur: 0.4,
        ...(ps !== 1
          ? { origin: [px, py], keys: [{ at: 0, scale: ps, dur: 0 }] }
          : {}),
        children: flat(p.elements),
      },
    ];
    delete p.place;
  }
}

export function expandChart(
  p: BlockProps,
  h: PropHelpers,
  frame: ValidationFrame,
): void {
  if (p.chart != null) {
    p.elements = [
      ...chartElements(chartSpec(p.chart, h.fail), {
        w: frame.width ?? 1920,
        h: frame.height ?? 1080,
      }),
      ...(p.elements ?? []),
    ];
    delete p.chart;
  }
}

export function expandPlates(
  p: BlockProps,
  h: PropHelpers,
  frame: ValidationFrame,
): void {
  if (p.plates != null) {
    if (typeof p.plates !== 'string' || !p.plates.trim())
      h.fail('plates must be the id of an image asset with layers');
    p.elements = [
      ...plateElements(p.plates, {
        w: frame.width ?? 1920,
        h: frame.height ?? 1080,
        assets: frame.assets,
      }),
      ...(p.elements ?? []),
    ];
    if (p.dolly == null && p.view == null)
      p.dolly = [{ at: 0, z: 0.32, dur: 9, ease: 'inOut' }];
    delete p.plates;
  }
}

export function validatePlace(
  value: unknown,
  fail: (message: string) => never,
): void {
  if (value == null) return;
  const [x, y, scale = 1]: unknown[] = Array.isArray(value) ? value : [];
  if (
    ![x, y, scale].every(
      (item) => typeof item === 'number' && Number.isFinite(item),
    ) ||
    typeof scale !== 'number' ||
    scale <= 0 ||
    scale > 4
  )
    fail(
      'place must be [x, y] or [x, y, scale] in world pixels (scale above 0, up to 4)',
    );
}
