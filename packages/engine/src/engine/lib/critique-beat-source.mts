import type { BeatCheckContext } from './critique-contracts.mjs';
export function beatSource(ctx: BeatCheckContext): void {
  const { sb, add, b, i } = ctx;
  // The source line is read by people: a storyboard source id ("q2-phishing") is a slug, not
  // an attribution.
  const shown = String(sb.beats[i]?.props?.source ?? '');
  const ids = new Set((sb.sources ?? []).map((x) => x.id).filter(Boolean));
  if (shown && /(^|[\s(/])[\w.-]+\.(mjs|js|json|wav|txt)\b/.test(shown))
    add(
      'warn',
      b.id,
      `The source line shows "${shown}", a file path, not an attribution. Name who said it or the document people would recognise ("Sam, on air"; "Kestrel Benefits Guide 2027").`,
    );
  else if (
    shown &&
    shown
      .split(/\s*[,;·]\s*/)
      .every(
        (part) =>
          ids.has(part.trim()) || /^[a-z0-9]+(-[a-z0-9]+)+$/.test(part.trim()),
      )
  )
    add(
      'warn',
      b.id,
      `The source line shows "${shown}", an id, not an attribution. Write what people read: the document and its date ("Alder Street Q2 2027 phishing simulation report").`,
    );
}
