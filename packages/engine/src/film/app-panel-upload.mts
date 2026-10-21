import type { Box, AppPanelState } from './app-contracts.mjs';
import { round } from './app-common.mjs';
export function appPanelUpload(state: AppPanelState): void {
  const { scene, spec, where, page, panel, py } = state;
  const { s, pad, inner, phone, w, id, text, uid, fail } = scene;
  const { upload } = spec;
  // An upload slot: left of the fields in a window, above them on a phone.

  if (upload != null) {
    if (
      typeof upload !== 'object' ||
      typeof upload.label !== 'string' ||
      upload.label.length > 24
    )
      fail(
        `${where}.upload must be {label, receipt, say|at}: the slot's caption (e.g. "Add receipt") and, optionally, the receipt whose photo lands in it`,
      );
    for (const key of Object.keys(upload))
      if (!['label', 'receipt', 'say', 'at', 'after'].includes(key))
        fail(`${where}.upload: unsupported field ${key}`);
    const box: Box = phone
      ? { x: pad, y: py, w: inner, h: round(s * 7.5) }
      : { x: pad, y: py, w: round(inner * 0.36), h: round(s * 7.2) };
    state.slot = box;
    panel.push({
      type: 'group',
      id: uid(`${id}-upload`, page),
      children: [
        {
          type: 'rect',
          ...box,
          r: 18,
          fill: 'none',
          stroke: 'muted',
          width: 3,
          dash: [12, 9],
        },
        text(
          upload.label,
          box.x + box.w / 2,
          box.y + box.h + s * 1.35,
          s * 0.9,
          'text',
          'muted',
          { anchor: 'middle' },
        ),
      ],
    });
    if (phone) state.py += box.h + s * 2.4;
    else {
      state.fx = box.x + box.w + 40;
      state.fw = w - pad - state.fx;
    }
  }
}
