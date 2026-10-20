import type { BlockProps, PropHelpers } from '../types.mjs';

export function validateSource(p: BlockProps, h: PropHelpers): void {
  if (p.sourceElement != null) {
    if (
      typeof p.sourceElement !== 'string' ||
      !p.sourceElement.trim() ||
      p.source ||
      p.sourceSize != null
    )
      h.fail(
        'sourceElement needs an element id and cannot combine with source/sourceSize',
      );
    const matches = (p.elements ?? []).filter((e) => e.id === p.sourceElement),
      e = matches[0];
    if (
      matches.length !== 1 ||
      e.type !== 'text' ||
      typeof e.text !== 'string' ||
      !e.text.trim() ||
      e.at !== 0 ||
      e.enter !== 'none' ||
      !(typeof e.size === 'number' && e.size >= 28) ||
      Object.keys(e).some(
        (k) =>
          ![
            'id',
            'type',
            'text',
            'x',
            'y',
            'size',
            'fill',
            'font',
            'at',
            'enter',
            'width',
            'height',
            'fit',
            'anchor',
            'leading',
            'tracking',
            'upper',
            'opacity',
          ].includes(k),
      ) ||
      (e.opacity != null && e.opacity !== 1) ||
      e.fill !== 'ink' ||
      p.print != null ||
      p.rough != null
    )
      h.fail(
        'sourceElement must name one static ink-colored native text element at frame start, with size >=28 and no effects, transforms or exits',
      );
  }
  if (
    p.sourceSize != null &&
    !(Number.isFinite(p.sourceSize) && p.sourceSize >= 14 && p.sourceSize <= 72)
  )
    h.fail('sourceSize must be 14–72 pixels');
}
