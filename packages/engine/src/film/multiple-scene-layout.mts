import type { MultipleLayout } from './multiple-scene-contracts.mjs';
import { check } from './multiple-scene-common.mjs';
export function multipleLayout({
  width: w,
  height: h,
  count = 4,
}: {
  width: number;
  height: number;
  count?: number;
}): MultipleLayout {
  check(
    Number.isFinite(w) &&
      Number.isFinite(h) &&
      w >= 640 &&
      h >= 640 &&
      w <= 4096 &&
      h <= 4096,
    'frame dimensions must be 640–4096',
  );
  check(
    Number.isInteger(count) && count >= 2 && count <= 4,
    'two to four panels required',
  );
  const tall = h > w,
    margin = w * (tall ? 0.105 : 0.07),
    gap = w * (tall ? 0.065 : 0.05),
    pw = (w - 2 * margin - gap) / 2,
    ph = h * 0.23,
    top = h * (tall ? 0.25 : 0.3),
    rowGap = h * (tall ? 0.055 : 0.055);
  const boxes = Array.from({ length: count }, (_, i) => [
    margin + (i % 2) * (pw + gap),
    top + Math.floor(i / 2) * (ph + rowGap),
    pw,
    ph,
  ]);
  const scale = (w - 2 * margin) / pw,
    expanded = [margin, top, pw * scale, ph * scale];
  check(
    expanded[1] + expanded[3] < h * 0.84,
    'expanded panel would crowd the source',
  );
  return {
    width: w,
    height: h,
    tall,
    margin,
    pw,
    ph,
    boxes,
    expanded,
    scale,
    type: w * (tall ? 0.036 : 0.022),
    tick: w * (tall ? 0.033 : 0.021),
  };
}
