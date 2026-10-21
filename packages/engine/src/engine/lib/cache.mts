import os from 'node:os';
import path from 'node:path';

/** Mutable runtime caches survive rebuilds and read-only package installations. */
export function cacheRoot(): string {
  const configured = process.env.CLEARFRAME_CACHE;
  if (configured !== undefined) {
    if (!configured.trim())
      throw new Error('CLEARFRAME_CACHE must name a directory.');
    return path.resolve(configured);
  }
  return path.join(os.homedir(), '.cache', 'clearframe');
}
