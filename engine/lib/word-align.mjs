// Map a known script onto recognizer word timings. The script supplies the words (so names,
// numbers and spelling are exactly what was written); the recognizer supplies when each was
// heard. Substitutions keep the recognizer's timing; script words it did not hear at all are
// interpolated and counted, so callers never label them as measured.
import { wordKey } from './word-timing.mjs';

/**
 * @param tokens script words (strings) in spoken order
 * @param heard  [{w, t0, t1}] recognizer words in order
 * @returns {words: [{w, t0, t1, estimated?}], interpolated, matched}
 */
export function alignScript(tokens, heard, { window = 6 } = {}) {
  const S = tokens.map(t => ({ w: t, key: wordKey(t) })), A = heard.map(h => ({ ...h, key: wordKey(h.w) }));
  const out = new Array(S.length).fill(null);
  let i = 0, j = 0, matched = 0;
  const spread = (from, to, t0, t1, estimated) => {
    const n = to - from, span = Math.max(0, t1 - t0);
    for (let k = 0; k < n; k++) out[from + k] = { w: S[from + k].w, t0: t0 + span * k / n, t1: t0 + span * (k + 1) / n, ...(estimated ? { estimated: true } : {}) };
  };
  while (i < S.length && j < A.length) {
    if (S[i].key === A[j].key) { out[i] = { w: S[i].w, t0: A[j].t0, t1: A[j].t1, ...(A[j].estimated ? { estimated: true } : {}) }; i++; j++; matched++; continue; }
    // Resynchronise on the nearest pair of equal words ahead in both sequences.
    let best = null;
    for (let d = 1; d <= window * 2 && !best; d++) for (let di = 0; di <= Math.min(d, window); di++) {
      const dj = d - di;
      if (dj > window || i + di >= S.length || j + dj >= A.length) continue;
      if (S[i + di].key === A[j + dj].key) { best = [di, dj]; break; }
    }
    const [di, dj] = best ?? [1, 1];
    if (di === dj) for (let k = 0; k < di; k++) out[i + k] = { w: S[i + k].w, t0: A[j + k].t0, t1: A[j + k].t1, ...(A[j + k].estimated ? { estimated: true } : {}) }; // substitutions: heard, just spelled differently
    else if (dj === 0) spread(i, i + di, A[j - 1]?.t1 ?? A[j].t0, A[j].t0, true);            // script words nobody heard
    else if (di > 0) spread(i, i + di, A[j].t0, A[j + dj - 1].t1, di !== dj);               // regroup a different word count over the heard span
    i += di; j += dj;
  }
  if (i < S.length) { const t = A.at(-1)?.t1 ?? 0; spread(i, S.length, t, t + 0.25 * (S.length - i), true); }
  // Keep intervals ordered and non-empty.
  for (let k = 0; k < out.length; k++) {
    if (k && out[k].t0 < out[k - 1].t1) out[k].t0 = out[k - 1].t1;
    if (out[k].t1 <= out[k].t0) out[k].t1 = out[k].t0 + 0.02;
  }
  return { words: out, interpolated: out.filter(w => w.estimated).length, matched };
}
