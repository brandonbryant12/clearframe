/** Plain text of a markdown fragment, with citations kept as [n] markers and links as text. */
export function plain(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)[^)]*\)/g, '$1')
    .replace(/\[\^([^\]]+)\]/g, '[$1]')
    .replace(/(\*\*|__|`)/g, '')
    .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|[.,;:!?]|$)/g, '$1$2')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const sentencesOf = (text: string): string[] =>
  text
    .split(/(?<=[.!?][)"”’\]]?)\s+(?=[A-Z0-9“"([])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);

export const linksOf = (s: string): { title: string; url: string }[] =>
  [...s.matchAll(/\[([^\]]+)\]\((https?:[^)\s]+)[^)]*\)/g)].map((m) => ({
    title: m[1],
    url: m[2],
  }));

export const citesOf = (s: string): string[] =>
  [...s.matchAll(/\[\^?([\w.-]+(?:\s*,\s*[\w.-]+)*)\]/g)].flatMap((m) =>
    m[1].split(/\s*,\s*/),
  );

export const referencesHeading = (h: string): boolean =>
  /^(references|sources|citations|bibliography|works cited|notes|footnotes)\b/i.test(
    h,
  );
