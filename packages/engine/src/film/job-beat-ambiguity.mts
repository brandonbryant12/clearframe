import { ambiguous } from './job-cues.mjs';

import type { BeatState } from './job-beat-contracts.mjs';

export function warnAmbiguousCues({ b, report }: BeatState): void {
  for (const word of ambiguous.get(b) ?? []) {
    // Suggest the cue with the word after its last saying, which the line says once.
    const said = (b.vo?.words ?? []).map((w) =>
      String(w.w).replace(/[^\p{L}\p{N}'-]/gu, ''),
    );
    const q = word.toLowerCase().split(/\s+/);
    let last = -1;
    for (let i = 0; i + q.length <= said.length; i++)
      if (q.every((p, j) => said[i + j].toLowerCase() === p)) last = i;
    const next = last >= 0 ? said[last + q.length] : null;
    report.warnings.push(
      `${b.id}: the cue "${word}" is said more than once in this line and lands on the first time it is said; name a longer phrase that is said once${next ? ` (for the later one, "${word} ${next}")` : ''}.`,
    );
  }
}
