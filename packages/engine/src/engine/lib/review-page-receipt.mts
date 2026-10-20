import fs from 'node:fs';
import path from 'node:path';
import { isRecord } from './errors.mjs';
import type { RevisionMeta, RevisionVideo } from './revisions.mjs';
export function notValidated(meta: RevisionMeta, receipt: unknown): string[] {
  const nv = [];
  const nvData =
    isRecord(receipt) && isRecord(receipt.notValidated)
      ? receipt.notValidated
      : null;
  for (const p of meta.placeholders ?? [])
    nv.push(`${p.beat}: placeholder (${p.reason})`);
  for (const u of meta.unfinished ?? [])
    if (isRecord(u))
      nv.push(
        `${u.beat}: ${u.element} marked unfinished${u.note ? ` (${u.note})` : ''}`,
      );
  if (meta.estimatedTiming?.length)
    nv.push(
      `estimated word timing in ${meta.estimatedTiming.length} beat(s): ${meta.estimatedTiming.slice(0, 8).join(', ')}${meta.estimatedTiming.length > 8 ? '…' : ''}`,
    );
  if (Array.isArray(nvData?.craft))
    nv.push(...nvData.craft.map((c: unknown) => `craft: ${String(c)}`));
  if (typeof nvData?.audit === 'string' && nvData.audit !== 'run')
    nv.push(`frame audit: ${nvData.audit}`);
  return nv;
}
export const readReceipt = (root: string, v: RevisionVideo | null) => {
  try {
    const parts = String(v?.receipt ?? '').split('/');
    if (!v?.receipt) return null;
    const value: unknown = JSON.parse(
      fs.readFileSync(path.join(root, ...parts), 'utf8'),
    );
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
};
