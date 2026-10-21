import fs from 'node:fs';

export const mtime = (f: string): number =>
  fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0;
const answered = (text: string, prompt: string): boolean => {
  const line = text.split('\n').find((l) => l.includes(prompt));
  return (
    !!line &&
    line
      .slice(line.indexOf(prompt) + prompt.length)
      .replace(/^[:\s?]+/, '')
      .trim().length > 3
  );
};

export const anyAnswered = (text: string, prompts: string[]): boolean =>
  prompts.some((p) => answered(text, p));
/** The `## Decisions` log in DIRECTION.md: one-shot films record each checkpoint there. */
export function decisions(direction: string): (...names: string[]) => boolean {
  const at = direction.search(/^##\s*Decisions\b/im);
  if (at < 0) return () => false;
  const rest = direction.slice(at).split('\n').slice(1);
  const end = rest.findIndex((l) => /^##\s/.test(l));
  const log = (end < 0 ? rest : rest.slice(0, end)).join('\n');
  // "- Intent: …", "**Look:** …", "Spend — draft only, no budget"
  return (...names: string[]) =>
    names.some((n) =>
      new RegExp(
        `^\\s*(?:[-*]\\s*)?(?:\\*\\*)?${n}\\b[^\\n]{0,40}?[:—–-]\\s*\\S`,
        'im',
      ).test(log),
    );
}
