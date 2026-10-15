// Map a known script onto recognizer word timings. The script supplies the words (so names,
// numbers and spelling are exactly what was written); the recognizer supplies when each was
// heard. Substitutions keep the recognizer's timing; script words it did not hear at all are
// interpolated and counted, so callers never label them as measured.
import { wordKey } from './word-timing.mjs';

const UNITS = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES = { thousand: 1e3, million: 1e6, billion: 1e9 };

/**
 * What a run of words says, with numbers as digits: "twenty-four hundred dollars" and "$2,400"
 * both read "$2400", "sixty percent" and "60%" both "60%". Words that are not numbers pass through.
 */
export function spoken(words) {
  const out = [];
  let total = null,
    current = 0,
    dollars = false;
  const flush = () => {
    if (total == null) return;
    out.push(`${dollars ? '$' : ''}${total + current}`);
    total = null;
    current = 0;
    dollars = false;
  };
  for (const raw of words.join(' ').toLowerCase().replace(/-/g, ' ').split(/\s+/)) {
    const w = raw.replace(/[^a-z0-9.$%]/g, '');
    if (!w) continue;
    const digits = w.replace(/[$,%]/g, '');
    if (/^\d+(\.\d+)?$/.test(digits)) {
      flush();
      out.push(`${w.includes('$') ? '$' : ''}${Number(digits)}${w.includes('%') ? '%' : ''}`);
      continue;
    }
    const unit = UNITS.indexOf(w);
    // "one two" is two numbers, "sixty five" one: a unit or a ten cannot follow a unit or a teen.
    if ((unit >= 0 || TENS[w]) && total != null && current % 10 !== 0) flush();
    if ((unit >= 0 || TENS[w]) && total != null && TENS[w] && current % 100 !== 0) flush();
    if (unit >= 0 || TENS[w] || w === 'hundred' || SCALES[w]) {
      total ??= 0;
      if (unit >= 0) current += unit;
      else if (TENS[w]) current += TENS[w];
      else if (w === 'hundred') current = (current || 1) * 100;
      else {
        total += (current || 1) * SCALES[w];
        current = 0;
      }
      continue;
    }
    if ((w === 'percent' || w === '%') && total != null) {
      out.push(`${total + current}%`);
      total = null;
      current = 0;
      continue;
    }
    if ((w === 'dollars' || w === 'dollar') && total != null) {
      dollars = true;
      flush();
      continue;
    }
    if (w === 'percent' && out.length && /^\$?\d/.test(out.at(-1))) {
      out[out.length - 1] += '%';
      continue;
    }
    if ((w === 'dollars' || w === 'dollar') && out.length && /^\d/.test(out.at(-1))) {
      out[out.length - 1] = `$${out.at(-1)}`;
      continue;
    }
    flush();
    out.push(w);
  }
  flush();
  return out.join(' ');
}

/**
 * @param tokens script words (strings) in spoken order
 * @param heard  [{w, t0, t1}] recognizer words in order
 * @returns {words: [{w, t0, t1, estimated?}], interpolated, matched}
 */
export function alignScript(tokens, heard, { window = 6 } = {}) {
  const S = tokens.map(t => ({ w: t, key: wordKey(t) })),
    A = heard.map(h => ({ ...h, key: wordKey(h.w) }));
  const out = new Array(S.length).fill(null);
  let i = 0,
    j = 0,
    matched = 0;
  const spread = (from, to, t0, t1, estimated) => {
    const n = to - from,
      span = Math.max(0, t1 - t0);
    for (let k = 0; k < n; k++)
      out[from + k] = {
        w: S[from + k].w,
        t0: t0 + (span * k) / n,
        t1: t0 + (span * (k + 1)) / n,
        ...(estimated ? { estimated: true } : {}),
      };
  };
  // The same number written two ways ("sixty percent" heard as "60%", "$2,400" as "twenty four
  // hundred dollars"): both sides say the same thing over a measured span, so the regrouped
  // words are measured too, not estimates.
  const number = () => {
    if (!/\d/.test(spoken([S[i].w])) && !/\d/.test(spoken([A[j].w]))) return null;
    for (let n = 3; n <= 8; n++)
      for (let a = 1; a < n; a++) {
        const b = n - a;
        if (a > 4 || b > 4 || i + a > S.length || j + b > A.length) continue;
        const said = spoken(S.slice(i, i + a).map(x => x.w));
        if (/\d/.test(said) && said === spoken(A.slice(j, j + b).map(x => x.w))) return [a, b];
      }
    return null;
  };
  while (i < S.length && j < A.length) {
    const same = number();
    if (same) {
      const [a, b] = same;
      spread(i, i + a, A[j].t0, A[j + b - 1].t1, false);
      matched += a;
      i += a;
      j += b;
      continue;
    }
    if (S[i].key === A[j].key) {
      out[i] = { w: S[i].w, t0: A[j].t0, t1: A[j].t1, ...(A[j].estimated ? { estimated: true } : {}) };
      i++;
      j++;
      matched++;
      continue;
    }
    // One written word heard as two or three ("myKestrel" as "my Kestrel", "401(k)" as "401 k"),
    // or two written words heard as one: the same letters over a measured span.
    const joined = (list, at, n) => (at + n <= list.length ? list.slice(at, at + n).map(x => x.key).join('') : null);
    const split = [2, 3].find(n => S[i].key && joined(A, j, n) === S[i].key);
    if (split) {
      out[i] = { w: S[i].w, t0: A[j].t0, t1: A[j + split - 1].t1, ...(A.slice(j, j + split).some(x => x.estimated) ? { estimated: true } : {}) };
      i++;
      j += split;
      matched++;
      continue;
    }
    const fused = [2, 3].find(n => A[j].key && joined(S, i, n) === A[j].key);
    if (fused) {
      spread(i, i + fused, A[j].t0, A[j].t1, Boolean(A[j].estimated));
      i += fused;
      j++;
      matched += fused;
      continue;
    }
    // Resynchronise on the nearest pair of equal words ahead in both sequences.
    let best = null;
    for (let d = 1; d <= window * 2 && !best; d++)
      for (let di = 0; di <= Math.min(d, window); di++) {
        const dj = d - di;
        if (dj > window || i + di >= S.length || j + dj >= A.length) continue;
        if (S[i + di].key === A[j + dj].key) {
          best = [di, dj];
          break;
        }
      }
    const [di, dj] = best ?? [1, 1];
    if (di === dj)
      for (let k = 0; k < di; k++)
        out[i + k] = {
          w: S[i + k].w,
          t0: A[j + k].t0,
          t1: A[j + k].t1,
          ...(A[j + k].estimated ? { estimated: true } : {}),
        }; // substitutions: heard, just spelled differently
    else if (dj === 0)
      spread(i, i + di, A[j - 1]?.t1 ?? A[j].t0, A[j].t0, true); // script words nobody heard
    else if (di > 0) spread(i, i + di, A[j].t0, A[j + dj - 1].t1, di !== dj); // regroup a different word count over the heard span
    i += di;
    j += dj;
  }
  if (i < S.length) {
    const t = A.at(-1)?.t1 ?? 0;
    spread(i, S.length, t, t + 0.25 * (S.length - i), true);
  }
  // Keep intervals ordered and non-empty.
  for (let k = 0; k < out.length; k++) {
    if (k && out[k].t0 < out[k - 1].t1) out[k].t0 = out[k - 1].t1;
    if (out[k].t1 <= out[k].t0) out[k].t1 = out[k].t0 + 0.02;
  }
  return { words: out, interpolated: out.filter(w => w.estimated).length, matched };
}
