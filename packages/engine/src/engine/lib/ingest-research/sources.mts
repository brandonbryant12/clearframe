import type { ParsedSection, ResearchSource } from './contracts.mjs';
import { linksOf, citesOf, plain } from './markdown.mjs';

// Inline links become sources too, so every figure can point somewhere.
export function linkSources(
  body: ParsedSection[],
  sources: Map<string, ResearchSource>,
): void {
  for (const l of body.flatMap((s) => s.paragraphs.flatMap(linksOf))) {
    if ([...sources.values()].some((x) => x.url === l.url)) continue;
    const id = `L${sources.size + 1}`;
    sources.set(id, { id, title: l.title, url: l.url });
  }
}

export const sourcesCited =
  (sources: Map<string, ResearchSource>) =>
  (sentenceMd: string): string[] => {
    const found: string[] = [];
    for (const l of linksOf(sentenceMd)) {
      const s = [...sources.values()].find((x) => x.url === l.url);
      if (s) found.push(s.id);
    }
    for (const c of citesOf(sentenceMd)) if (sources.has(c)) found.push(c);
    return [...new Set(found)];
  };

// A paragraph's or bullet's own links (often trailing: "… 2.5M views. [post](…)")
// source its sentences that cite nothing themselves.
export const sourceLine = (md: string): boolean =>
  /^\[[^\]]+\]\(https?:/.test(md.trim()) ||
  plain(md)
    .replace(/\[[\w.,\s-]+\]/g, '')
    .split(/[\s·•|,;]+/)
    .filter(Boolean).length <= 4;
