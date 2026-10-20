import type { MultipleContext } from './multiple-scene-contracts.mjs';
import { text } from './multiple-scene-common.mjs';

export function multipleFooter(ctx: MultipleContext): string {
  const {
    width,
    height,
    id,
    subtitle,
    expandedId,
    model,
    p,
    L,
    elements,
    year,
  } = ctx;
  const sourceId = `${id}-source`,
    period = `${p.x.domain[0]} to ${p.x.domain[1]}`;
  const from = year(p.x.domain[0]),
    to = year(p.x.domain[1]);
  elements.push(
    text(
      `${id}-title`,
      expandedId
        ? `Focus: ${model.panels.find((s) => s.id === expandedId)?.label}`
        : p.title,
      L.margin,
      height * (L.tall ? 0.09 : 0.115),
      width * (L.tall ? 0.047 : 0.032),
      { font: 'display', width: width - 2 * L.margin, height: height * 0.085 },
    ),
    text(
      `${id}-subtitle`,
      subtitle,
      L.margin,
      height * (L.tall ? 0.155 : 0.185),
      width * (L.tall ? 0.032 : 0.025),
      { width: width - 2 * L.margin, height: height * 0.055 },
    ),
    text(
      `${id}-unit`,
      `${p.y.label} · ${from}${from === to ? '' : '–' + to}`,
      L.margin,
      height * (L.tall ? 0.2 : 0.245),
      width * (L.tall ? 0.031 : 0.022),
      { fit: width - 2 * L.margin },
    ),
    text(
      sourceId,
      `${p.source} ${period}.`,
      L.margin,
      height * 0.89,
      width * 0.028,
      { width: width - 2 * L.margin, height: height * 0.085 },
    ),
  );
  return sourceId;
}
