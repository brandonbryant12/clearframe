// The script supplies exact wording; the recognizer supplies timing. Unheard words remain
// explicitly estimated, including after numeric regrouping and resynchronization.
import { wordKey } from './word-timing.mjs';
import { spoken } from './spoken-numbers.mjs';
import type {
  AlignedWord,
  ScriptAlignment,
  ScriptToken,
  HeardToken,
} from './word-align-model.mjs';
export { spoken } from './spoken-numbers.mjs';
export type { AlignedWord, ScriptAlignment } from './word-align-model.mjs';

function joined(
  list: readonly ScriptToken[],
  at: number,
  count: number,
): string | null {
  if (at + count > list.length) return null;
  return list
    .slice(at, at + count)
    .map((token) => token.key)
    .join('');
}

/** The shortest script and heard spans that say the same figure, compared after `form`. */
function numberSpan(
  script: readonly ScriptToken[],
  heard: readonly HeardToken[],
  i: number,
  j: number,
  form: (said: string) => string,
): [number, number] | null {
  for (let n = 3; n <= 8; n++)
    for (let a = 1; a < n; a++) {
      const b = n - a;
      if (a > 4 || b > 4 || i + a > script.length || j + b > heard.length)
        continue;
      const said = spoken(script.slice(i, i + a).map((token) => token.w));
      if (
        /\d/.test(said) &&
        form(said) ===
          form(spoken(heard.slice(j, j + b).map((token) => token.w)))
      )
        return [a, b];
    }
  return null;
}

const withoutCurrency = (said: string): string => said.replaceAll('$', '');

function matchingNumber(
  script: readonly ScriptToken[],
  heard: readonly HeardToken[],
  i: number,
  j: number,
): [number, number] | null {
  if (!/\d/.test(spoken([script[i].w])) && !/\d/.test(spoken([heard[j].w])))
    return null;
  // Exactly the same figure first ("sixty thousand dollar" is "$60,000"); then the same figure
  // with a currency mark only one side wrote, as Whisper adds "$" from context ("twenty-four
  // hundred" heard as "$2,400").
  return (
    numberSpan(script, heard, i, j, (said) => said) ??
    numberSpan(script, heard, i, j, withoutCurrency)
  );
}

function nearestPair(
  script: readonly ScriptToken[],
  heard: readonly HeardToken[],
  i: number,
  j: number,
  window: number,
): [number, number] {
  for (let distance = 1; distance <= window * 2; distance++)
    for (let di = 0; di <= Math.min(distance, window); di++) {
      const dj = distance - di;
      if (dj > window || i + di >= script.length || j + dj >= heard.length)
        continue;
      if (script[i + di].key === heard[j + dj].key) return [di, dj];
    }
  return [1, 1];
}

class ScriptAligner {
  readonly script: ScriptToken[];
  readonly heard: HeardToken[];
  readonly out: (AlignedWord | null)[];
  i = 0;
  j = 0;
  matched = 0;
  constructor(tokens: readonly string[], heard: readonly AlignedWord[]) {
    this.script = tokens.map((w) => ({ w, key: wordKey(w) }));
    this.heard = heard.map((word) => ({ ...word, key: wordKey(word.w) }));
    this.out = new Array<AlignedWord | null>(tokens.length).fill(null);
  }
  spread(
    from: number,
    to: number,
    t0: number,
    t1: number,
    estimated: boolean,
  ): void {
    const count = to - from,
      span = Math.max(0, t1 - t0);
    for (let k = 0; k < count; k++)
      this.out[from + k] = {
        w: this.script[from + k].w,
        t0: t0 + (span * k) / count,
        t1: t0 + (span * (k + 1)) / count,
        ...(estimated ? { estimated: true } : {}),
      };
  }
  number(): boolean {
    const same = matchingNumber(this.script, this.heard, this.i, this.j);
    if (!same) return false;
    const [a, b] = same;
    this.spread(
      this.i,
      this.i + a,
      this.heard[this.j].t0,
      this.heard[this.j + b - 1].t1,
      false,
    );
    this.matched += a;
    this.i += a;
    this.j += b;
    return true;
  }
  copy(scriptIndex: number, heardIndex: number): void {
    const heard = this.heard[heardIndex];
    this.out[scriptIndex] = {
      w: this.script[scriptIndex].w,
      t0: heard.t0,
      t1: heard.t1,
      ...(heard.estimated ? { estimated: true } : {}),
    };
  }
  exact(): boolean {
    if (this.script[this.i].key !== this.heard[this.j].key) return false;
    this.copy(this.i, this.j);
    this.i++;
    this.j++;
    this.matched++;
    return true;
  }
  split(): boolean {
    const key = this.script[this.i].key;
    const count = [2, 3].find(
      (n) => key && joined(this.heard, this.j, n) === key,
    );
    if (!count) return false;
    this.out[this.i] = {
      w: this.script[this.i].w,
      t0: this.heard[this.j].t0,
      t1: this.heard[this.j + count - 1].t1,
      ...(this.heard
        .slice(this.j, this.j + count)
        .some((word) => word.estimated)
        ? { estimated: true }
        : {}),
    };
    this.i++;
    this.j += count;
    this.matched++;
    return true;
  }
  fused(): boolean {
    const key = this.heard[this.j].key;
    const count = [2, 3].find(
      (n) => key && joined(this.script, this.i, n) === key,
    );
    if (!count) return false;
    this.spread(
      this.i,
      this.i + count,
      this.heard[this.j].t0,
      this.heard[this.j].t1,
      Boolean(this.heard[this.j].estimated),
    );
    this.i += count;
    this.j++;
    this.matched += count;
    return true;
  }
  resynchronize(window: number): void {
    const [di, dj] = nearestPair(
      this.script,
      this.heard,
      this.i,
      this.j,
      window,
    );
    if (di === dj)
      for (let k = 0; k < di; k++) this.copy(this.i + k, this.j + k);
    else if (dj === 0)
      this.spread(
        this.i,
        this.i + di,
        this.heard[this.j - 1]?.t1 ?? this.heard[this.j].t0,
        this.heard[this.j].t0,
        true,
      );
    else if (di > 0)
      this.spread(
        this.i,
        this.i + di,
        this.heard[this.j].t0,
        this.heard[this.j + dj - 1].t1,
        di !== dj,
      );
    this.i += di;
    this.j += dj;
  }
  finish(): ScriptAlignment {
    if (this.i < this.script.length) {
      const time = this.heard.at(-1)?.t1 ?? 0;
      this.spread(
        this.i,
        this.script.length,
        time,
        time + 0.25 * (this.script.length - this.i),
        true,
      );
    }
    const words = this.out.map((word, index) => {
      if (!word)
        throw new Error(
          `Word alignment left script word ${index + 1} unplaced`,
        );
      return word;
    });
    for (let k = 0; k < words.length; k++) {
      if (k && words[k].t0 < words[k - 1].t1) words[k].t0 = words[k - 1].t1;
      if (words[k].t1 <= words[k].t0) words[k].t1 = words[k].t0 + 0.02;
    }
    return {
      words,
      interpolated: words.filter((word) => word.estimated).length,
      matched: this.matched,
    };
  }
}

export function alignScript(
  tokens: readonly string[],
  heard: readonly AlignedWord[],
  { window = 6 }: { window?: number } = {},
): ScriptAlignment {
  const alignment = new ScriptAligner(tokens, heard);
  while (
    alignment.i < alignment.script.length &&
    alignment.j < alignment.heard.length
  ) {
    if (
      alignment.number() ||
      alignment.exact() ||
      alignment.split() ||
      alignment.fused()
    )
      continue;
    alignment.resynchronize(window);
  }
  return alignment.finish();
}
