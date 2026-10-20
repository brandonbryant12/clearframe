import type { AppScene } from './app-contracts.mjs';
import { slug, round } from './app-common.mjs';
export function appHeader(scene: AppScene): void {
  const { phone, s, els, text, title, pad, inner, tabs, pill, id, w } = scene;
  // The header: the app's name, its tabs to the right (under it on a phone), a hairline below.
  let { cy } = scene;
  const tabH = round(s * 2.2);
  if (phone) {
    els.push(text(title, pad, cy + s * 1.2, s * 1.3, 'display', 'ink'));
    cy += s * 1.9;
    if (tabs.length) {
      const tw = (inner - (tabs.length - 1) * 14) / tabs.length;
      tabs.forEach((t, i) =>
        els.push(
          pill(`${id}-tab-${slug(t)}`, pad + i * (tw + 14), cy, tw, tabH, t),
        ),
      );
      cy += tabH + 28;
    }
  } else {
    const head = tabH + 64;
    els.push(text(title, pad, head / 2 + s * 0.42, s * 1.3, 'display', 'ink'));
    const tw = Math.max(
      ...tabs.map((t) => t.length * s * 0.62 + s * 1.6),
      s * 6,
    );
    const row = tabs.length * tw + Math.max(0, tabs.length - 1) * 16;
    // Tabs to the right of the name when there is room for both, else on a row under it.
    if (pad + title.length * s * 1.3 * 0.56 + 48 + row <= w - pad) {
      tabs.forEach((t, i) =>
        els.push(
          pill(
            `${id}-tab-${slug(t)}`,
            w - pad - (tabs.length - i) * tw - (tabs.length - 1 - i) * 16,
            (head - tabH) / 2,
            tw,
            tabH,
            t,
          ),
        ),
      );
      cy = head;
    } else {
      tabs.forEach((t, i) =>
        els.push(
          pill(
            `${id}-tab-${slug(t)}`,
            pad + i * (tw + 16),
            head - 8,
            tw,
            tabH,
            t,
          ),
        ),
      );
      cy = head + (tabs.length ? tabH + 20 : 0);
    }
  }
  els.push({
    type: 'line',
    x1: 0,
    y1: round(cy),
    x2: round(w),
    y2: round(cy),
    stroke: 'line',
    width: 2,
  });
  scene.cy = cy;
}
