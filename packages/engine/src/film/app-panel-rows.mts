import type { CanvasElement } from './types.mjs';
import type { AppPanelState } from './app-contracts.mjs';
import { slug, round, when } from './app-common.mjs';
export function appPanelRows(state: AppPanelState): void {
  const { scene, spec, where, page, panel } = state;
  const { s, pad, inner, id, text, uid, fail } = scene;
  const { rows } = spec;
  // Rows to tap: a list a section opens on, each with a chevron.
  if (rows != null) {
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 5)
      fail(
        `${where}.rows must be 1–5 rows: labels of up to 28 characters (what the screen lists to tap), or {label, badge, tone, say|at}`,
      );
    const rh = round(s * 2.6);
    rows.forEach((item, i) => {
      const py = state.py;
      const r = typeof item === 'string' ? { label: item } : item;
      const ra = `${where}.rows[${i}]`;
      if (
        !r ||
        typeof r.label !== 'string' ||
        !r.label.trim() ||
        r.label.length > 28
      )
        fail(
          `${ra} must be a label of up to 28 characters, or {label, badge, tone, say|at}`,
        );
      for (const key of Object.keys(r))
        if (!['label', 'badge', 'tone', 'say', 'at', 'after'].includes(key))
          fail(`${ra}: unsupported field ${key}`);
      // A badge: the row's status ("No change", "Review"), landing on its word, so a screen
      // changes as the voice goes down it.
      let badge: CanvasElement[] = [];
      if (r.badge != null) {
        if (
          typeof r.badge !== 'string' ||
          !r.badge.trim() ||
          r.badge.length > 16
        )
          fail(
            `${ra}.badge must be a status of up to 16 characters ("No change", "Review")`,
          );
        const tone = r.tone ?? 'positive';
        if (!['positive', 'negative', 'accent', 'muted'].includes(tone))
          fail(`${ra}.tone must be positive, negative, accent or muted`);
        const [bh, bw] = [
          round(rh * 0.56),
          round(r.badge.length * s * 0.85 * 0.6 + s * 1.4),
        ];
        const bx = pad + inner - s * 1.7 - bw;
        if (pad + s * 0.8 + r.label.length * s * 1.05 * 0.56 + s > bx)
          fail(
            `${ra}: the label and its badge do not fit the row together; shorten one or widen the app (w)`,
          );
        const lands = when(r);
        badge = [
          {
            type: 'group',
            ...(lands ? { ...lands, enter: 'pop', dur: 0.3 } : {}),
            children: [
              {
                type: 'rect',
                x: round(bx),
                y: round(py + (rh - bh) / 2),
                w: bw,
                h: bh,
                r: round(bh / 2),
                fill: tone,
              },
              text(
                r.badge,
                bx + bw / 2,
                py + rh / 2 + s * 0.3,
                s * 0.85,
                'strong',
                'bg',
                { anchor: 'middle' },
              ),
            ],
          },
        ];
      } else if (r.tone != null || when(r))
        fail(
          `${ra}: tone and say|at belong to a badge; add badge, or give the row as its label`,
        );
      panel.push({
        type: 'group',
        id: uid(`${id}-row-${slug(r.label)}`, page),
        children: [
          {
            type: 'rect',
            x: pad,
            y: round(py),
            w: inner,
            h: rh,
            r: 16,
            fill: 'bg',
            stroke: 'line',
            width: 2,
          },
          text(
            r.label,
            pad + s * 0.8,
            py + rh * 0.64,
            s * 1.05,
            'strong',
            'ink',
          ),
          ...badge,
          {
            type: 'path',
            d: `M ${round(pad + inner - s * 1.1)} ${round(py + rh / 2 - s * 0.32)} L ${round(pad + inner - s * 0.75)} ${round(py + rh / 2)} L ${round(pad + inner - s * 1.1)} ${round(py + rh / 2 + s * 0.32)}`,
            fill: 'none',
            stroke: 'muted',
            width: 3,
            cap: 'round',
            join: 'round',
          },
        ],
      });
      state.py += rh + s * 0.5;
    });
    state.py += s * 0.4;
  }
}
