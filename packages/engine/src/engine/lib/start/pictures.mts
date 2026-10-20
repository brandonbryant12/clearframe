import { pictureFor } from '../pictures.mjs';

/**
 * The document's own lines that name a mechanism or a figure, each with the picture that shows it
 * (engine/lib/pictures.mjs): the first thing an agent reads maps the brief's facts to pictures,
 * instead of leaving it to swap a playbook's sample beats for sentences.
 */
export function picturesFor(text: string): string {
  const lines = String(text)
    .split(/\n(?=\s*(?:[-*]|\d+\.)\s)/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z])/))
    .map((x) =>
      x
        .replace(/[*_`#]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/^\s*(?:[-*]|\d+\.)\s*/, '')
        .trim(),
    )
    .filter(
      (x) =>
        x.length > 20 &&
        x.length < 400 &&
        !/^(brief|from|for|length|tone)\b/i.test(x),
    );
  const seen = new Set<string>(),
    rows: string[] = [];
  for (const line of lines) {
    const fit = pictureFor(line);
    if (!fit || seen.has(line)) continue;
    seen.add(line);
    rows.push(
      `- "${line.length > 140 ? `${line.slice(0, 139)}…` : line}" → ${fit.sketch ? `the \`${fit.sketch}\` sketch (\`clearframe sketch ${fit.sketch}\`)` : fit.use}`,
    );
  }
  return rows.length
    ? `## Pictures for this document\n\nEach line of the source that names a mechanism or a figure, and the picture that shows it. Give each fact you keep its own beat with that picture; type is for the one line worth repeating.\n\n${rows.slice(0, 14).join('\n')}\n\n`
    : '';
}
