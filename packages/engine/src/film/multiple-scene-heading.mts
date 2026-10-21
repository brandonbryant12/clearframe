import type { MultiplePanel } from './multiple-scene-contracts.mjs';
import { text } from './multiple-scene-common.mjs';

export function multipleHeading(panel: MultiplePanel): void {
  const { ctx } = panel;
  const { model, L, F, tick, dateLabel } = ctx;
  const { s, children, prefix, rank, value } = panel;
  children.push(
    text(`${prefix}-name`, `${rank}  ${s.label}`, 0, F, F, {
      font: 'semibold',
      width: L.pw * (L.tall ? 1 : 0.55),
      height: F * 1.65,
    }),
    text(
      `${prefix}-rank-value`,
      `${value} · ${dateLabel(model.rankAt)}`,
      L.tall ? 0 : L.pw,
      L.tall ? F * 2.1 : F,
      tick,
      {
        font: 'figures',
        anchor: L.tall ? 'start' : 'end',
        fit: L.pw * (L.tall ? 1 : 0.42),
      },
    ),
  );
}
