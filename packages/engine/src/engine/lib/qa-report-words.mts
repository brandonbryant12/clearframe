import fs from 'node:fs';
import path from 'node:path';
import type { VerdictState } from './qa-verdict-state.mjs';
import { fixOf } from './qa-verdict-state.mjs';

import { clip } from './qa-advice.mjs';

export function reportWords(state: VerdictState): string[] {
  const { dir, typeShare, worst, pictures } = state;
  return [
    ...(typeShare >= 50
      ? [
          `  words: ${typeShare}% of the film is type on its own (kinetic, statements, titles, a single figure on a card). Moving words are still words on a background: give the ideas pictures and keep type for the one or two lines worth repeating${fs.existsSync(path.join(dir, 'source', 'recording.wav')) ? " (for a recording, examples/podcast-pictures shows each idea with its own picture and the captions under it; its build.mjs sets each beat's props by id)" : ''}:`,
          ...(() => {
            // A sketch that fits the line first; else a line that says figures gets its chart ready to
            // paste (the values and the words they land on); else the recipe for its kind of idea.
            const lines = pictures;
            const rest = lines.filter(([, l]) => !l).map(([b]) => b.id);
            return [
              ...lines
                .filter(([, l]) => l)
                .map(([b, l]) => `    ${b.id}: ${l}`),
              ...(rest.length
                ? [
                    `    ${rest.join(', ')}: a picture of what each line says (a sketch: \`sketch\` lists them; a cast of the film's objects; a chart with a \`say\` on each value), or fold the line into the next picture's narration`,
                  ]
                : []),
            ];
          })(),
        ]
      : []),
    ...(worst.length
      ? [
          `  stillest (a deliberate reading hold is fine; mark it with pace: "hold"):`,
          ...worst.map(([id, sec]) => {
            const f = fixOf(state, id);
            return `    ${id} ${sec.toFixed(1)} s still${f?.said ? ` over "${clip(f.said, 90)}"` : ''}: ${f?.fix ?? 'change something on its later words, or shorten it.'}`;
          }),
        ]
      : []),
  ];
}
