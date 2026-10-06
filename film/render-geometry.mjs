// The renderer's output size (scene/native/src/compose.rs): round each raster dimension to even.
// The authored job/coordinates, frame clock and audio stay unchanged.
export function renderGeometry({ width, height }, { draft = false, scale = 1 } = {}) {
  if (!Number.isFinite(scale) || scale < 0.25 || scale > 1)
    throw new Error('Review scale must be a number from 0.25 to 1');
  if (!draft && scale !== 1) throw new Error('Reduced resolution is for drafts only; use preview or --draft');
  const even = n => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { width: scale === 1 ? width : even(width), height: scale === 1 ? height : even(height), scale };
}

/** Accept a review size only from a receipt bound to this video and current storyboard. */
export function reviewGeometry(authored, receipt, { videoHash, storyboardHash } = {}) {
  if (!receipt?.draft || !receipt?.scale || receipt.outputSha256 !== videoHash ||
      receipt.hashes?.['storyboard.json'] !== storyboardHash) return { ...authored, scale: 1, draft: false };
  let expected;
  try { expected = renderGeometry(authored, { draft: true, scale: receipt.scale }); }
  catch { return { ...authored, scale: 1, draft: false }; }
  if (receipt.width !== expected.width || receipt.height !== expected.height ||
      receipt.authoredWidth !== authored.width || receipt.authoredHeight !== authored.height)
    return { ...authored, scale: 1, draft: false };
  return { ...expected, draft: true };
}
