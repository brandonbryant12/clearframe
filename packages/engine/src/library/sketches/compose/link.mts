import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { composeAttachment } from './attachment.mjs';

export function composeLink(context: ReturnType<typeof composeAttachment>) {
  const { expires, cued, text, stackTag, k, s, tagW, link, ui } = context;

  // The link it comes back as: a lock, the link's words and, with expires, the tag. A tag on a
  // row of its own lands under the words, which sit centred in the chip until it makes room.
  const lockR = round((s.chip - 30) / 2);

  const shift = round((link.h - s.chip) / 2);

  const lcy = round(link.y + s.chip / 2 + shift);

  const linkTextX = link.x + 16 + 2 * lockR + 22;

  let tag: { x: number; y: number; w: number; h: number } | null = null;
  if (expires && stackTag)
    tag = {
      x: linkTextX,
      y: link.y + s.chip - 6,
      w: Math.min(tagW, link.x + link.w - 16 - linkTextX),
      h: s.tag,
    };
  else if (expires)
    tag = {
      x: link.x + link.w - 14 - tagW,
      y: round(lcy - s.tag / 2),
      w: tagW,
      h: s.tag,
    };

  ui.push({
    type: 'group',
    enter: 'fade',
    dur: 0.22,
    ...cued('LINK', 0.5),
    keys: [
      cued('LINK', 0.5, { dur: 0, y: round(-10 * k) }),
      cued('LINK', 0.72, { dur: 0.3, ease: 'out', y: 0 }),
    ],
    children: [
      {
        type: 'rect',
        ...link,
        r: round(18 * k),
        fill: 'bg',
        stroke: 'accent2',
        width: round(3 * k),
        enter: 'none',
        shadow: { blur: 18, dy: 8, opacity: 0.12 },
      } satisfies CanvasElement,
      {
        type: 'group',
        enter: 'none',
        ...(shift
          ? {
              keys: [
                cued('EXPIRES', 0, { dur: 0.4, ease: 'inOut', y: -shift }),
              ],
            }
          : {}),
        children: [
          {
            type: 'group',
            enter: 'pop',
            dur: 0.4,
            origin: [link.x + 16 + lockR, lcy],
            ...cued('LINK', 0.75),
            children: [
              {
                type: 'circle',
                cx: link.x + 16 + lockR,
                cy: lcy,
                r: lockR,
                fill: 'accent2',
                enter: 'none',
              } satisfies CanvasElement,
              {
                type: 'icon',
                name: 'lock',
                x: link.x + 16 + lockR,
                y: lcy,
                size: round(lockR * 1.1),
                stroke: 'bg',
                enter: 'none',
              } satisfies CanvasElement,
            ],
          } satisfies CanvasElement,
          text(
            'LINKTEXT',
            linkTextX,
            lcy + s.chipFs * 0.36,
            s.chipFs,
            'semibold',
            'ink',
            {
              fit:
                (tag && !stackTag ? tag.x - 20 : link.x + link.w - 20) -
                linkTextX,
              enter: 'fade',
              dur: 0.25,
              ...cued('LINK', 0.68),
            },
          ),
        ],
      } satisfies CanvasElement,
    ],
  } satisfies CanvasElement);

  if (tag) {
    const tcy = round(tag.y + tag.h / 2);
    ui.push({
      type: 'group',
      // Beside the words it drops onto the chip; under them it pops in as they make room.
      ...(stackTag
        ? { enter: 'pop', dur: 0.4, ...cued('EXPIRES', 0.15) }
        : {
            enter: 'drop',
            dist: round(34 * k),
            dur: 0.45,
            ...cued('EXPIRES'),
          }),
      origin: [round(tag.x + tag.w / 2), tcy],
      keys: [
        cued('EXPIRES', 0.4, {
          dur: 0.35,
          ease: 'thereAndBack',
          scale: 1.06,
        }),
      ],
      children: [
        {
          type: 'rect',
          ...tag,
          r: round(tag.h / 2),
          fill: 'accent',
          enter: 'none',
        } satisfies CanvasElement,
        {
          type: 'icon',
          name: 'timer',
          x: tag.x + round(tag.h / 2 + 4),
          y: tcy,
          size: round(s.tagFs * 1.15),
          stroke: 'bg',
          enter: 'none',
        } satisfies CanvasElement,
        text(
          'EXPIRY',
          tag.x + tag.h + 12,
          tcy + s.tagFs * 0.36,
          s.tagFs,
          'semibold',
          'bg',
          { fit: tag.w - tag.h - 12 - 22 },
        ),
      ],
    } satisfies CanvasElement);
  }
  return { ...context, expires, cued, text, k, s, ui };
}
