import { expandReceipt } from './receipt.mjs';

import type { AppPanelState } from './app-contracts.mjs';
import { round, when } from './app-common.mjs';
export function appPanelReceipt(state: AppPanelState): void {
  const { scene, spec, where, page, panel, slot } = state;
  const { id, uid, fail } = scene;
  const { upload } = spec;
  // The receipt's photo, at the size of an attachment, landing in the slot on its word.
  if (upload?.receipt != null && slot) {
    if (typeof upload.receipt !== 'object')
      fail(
        `${where}.upload.receipt must be a receipt's lines (merchant, items, tax…)`,
      );
    const rw =
      upload.receipt.w ??
      (upload.receipt.size ?? 30) * (upload.receipt.slip ? 13 : 16);
    const k = Math.min((slot.w - 36) / rw, 0.5);
    const [px, py0] = [
      round(slot.x + (slot.w - rw * k) / 2),
      round(slot.y + 16),
    ];
    const lands = when(upload);
    // The slot's dashed edge turns solid as the photo lands in it.
    if (lands)
      panel.push({
        type: 'rect',
        ...slot,
        r: 18,
        fill: 'none',
        stroke: 'accent',
        width: 4,
        ...lands,
        enter: 'fade',
        dur: 0.2,
      });
    panel.push(
      expandReceipt(
        {
          type: 'receipt',
          ...upload.receipt,
          id: uid(`${id}-photo`, page),
          x: px,
          y: py0,
          scale: k,
          origin: [px, py0],
          shadow: false,
          ...(lands ?? {}),
          enter: lands ? 'pop' : 'none',
        },
        `${where}.upload.receipt`,
        fail,
      ),
    );
  }
}
