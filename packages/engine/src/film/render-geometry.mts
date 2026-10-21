import { isRecord } from '../engine/lib/errors.mjs';
export interface Dimensions {
  width: number;
  height: number;
}
export interface RenderSizeOptions {
  draft?: boolean;
  scale?: number;
}
export interface ReceiptIdentity {
  videoHash?: string | null;
  storyboardHash?: string | null;
}
// The renderer's output size (scene/native/src/compose.rs): round each raster dimension to even.
// The authored job/coordinates, frame clock and audio stay unchanged.
export function renderGeometry(
  { width, height }: Dimensions,
  { draft = false, scale = 1 }: RenderSizeOptions = {},
) {
  if (!Number.isFinite(scale) || scale < 0.25 || scale > 1)
    throw new Error('Review scale must be a number from 0.25 to 1');
  if (!draft && scale !== 1)
    throw new Error(
      'Reduced resolution is for drafts only; use preview or --draft',
    );
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return {
    width: scale === 1 ? width : even(width),
    height: scale === 1 ? height : even(height),
    scale,
  };
}

/** Accept a review size only from a receipt bound to this video and current storyboard. */
export function reviewGeometry(
  authored: Dimensions,
  receipt: unknown,
  { videoHash, storyboardHash }: ReceiptIdentity = {},
) {
  if (
    !isRecord(receipt) ||
    !receipt.draft ||
    typeof receipt.scale !== 'number' ||
    !receipt.scale ||
    receipt.outputSha256 !== videoHash ||
    !isRecord(receipt.hashes) ||
    receipt.hashes['storyboard.json'] !== storyboardHash
  )
    return { ...authored, scale: 1, draft: false };
  let expected;
  try {
    expected = renderGeometry(authored, { draft: true, scale: receipt.scale });
  } catch {
    return { ...authored, scale: 1, draft: false };
  }
  if (
    receipt.width !== expected.width ||
    receipt.height !== expected.height ||
    receipt.authoredWidth !== authored.width ||
    receipt.authoredHeight !== authored.height
  )
    return { ...authored, scale: 1, draft: false };
  return { ...expected, draft: true };
}
