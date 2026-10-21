import type { VerdictState } from './qa-verdict-state.mjs';

import { nextEdit } from './qa-verdict-next.mjs';

export function reportIssues(state: VerdictState): string[] {
  const { q, ready, overlaps, broken, fileSources, placeholders } = state;
  return [
    ...(overlaps.length
      ? [
          '  objects on top of each other:',
          ...overlaps.map((m) => `    ${m[1]}: ${m[2]}`),
        ]
      : []),
    ...(broken.length
      ? [
          '  errors in time (see build/qa/qa.json):',
          ...broken
            .slice(0, 5)
            .map((f) => `    ${f.beat ?? ''} ${f.t ?? ''} s: ${f.message}`),
        ]
      : []),
    ...(fileSources.length
      ? [
          `  a file name shown as the source line in ${fileSources.join(', ')}: credit who said it or the document people know ("Sam, on air"; "Kestrel Benefits Guide 2027").`,
        ]
      : []),
    ...(placeholders.length
      ? [
          `  placeholders on screen: ${placeholders.map(([id, left]) => `${id} (${left.join(', ')})`).join('; ')}. Fill each in sketchText, or change sketchParams so the sketch does not draw it.`,
        ]
      : []),
    ...(q.findings.some((f) => f.kind === 'small')
      ? [
          '  small in the frame:',
          ...q.findings
            .filter((f) => f.kind === 'small')
            .slice(0, 5)
            .map(
              (f) =>
                `    ${f.beat}: fills ${Math.round((f.fill?.w ?? 0) * 100)}% × ${Math.round((f.fill?.h ?? 0) * 100)}% of the frame. ${f.fix}`,
            ),
        ]
      : []),
    ...(ready
      ? []
      : [
          `  not ready to hand over. Next edit: ${nextEdit(state)} Then run draft again, and keep going until it says READY: a NOT READY film is the slideshow it was asked not to be, however complete its facts.`,
        ]),
  ];
}
