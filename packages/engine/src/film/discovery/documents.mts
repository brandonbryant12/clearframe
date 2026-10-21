import fs from 'node:fs';
import path from 'node:path';
import { LIBRARY } from '../library.mjs';
export const ROOT = path.dirname(LIBRARY);
export const read = (rel: string): string => {
  try {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch {
    return '';
  }
};
export const firstSentence = (t: unknown): string =>
  (
    String(t ?? '').match(/^[\s\S]*?[.!?](\s|$)/)?.[0] ?? String(t ?? '')
  ).trim();
export const clean = (t: unknown): string =>
  String(t ?? '')
    .replace(/\s+/g, ' ')
    .trim();

/** Rows of the Markdown table that follows `heading` whose first cell names `ids`: [[ids], text]. */
export function tableRows(doc: string, heading: string): [string[], string][] {
  const lines = doc.split('\n'),
    out: [string[], string][] = [];
  let i = lines.findIndex((l) => l.startsWith(heading));
  if (i < 0) return out;
  for (i++; i < lines.length && !/^#{1,3} /.test(lines[i]); i++) {
    const m = lines[i].match(/^\| ((?:`[^`]+`(?:, )?)+) \| (.+) \|$/);
    if (m)
      out.push([
        [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]),
        clean(m[2]),
      ]);
  }
  return out;
}
