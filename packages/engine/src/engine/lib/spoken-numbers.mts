// Normalize equivalent spoken and written numbers while keeping ordinary words intact.
const UNITS =
  'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(
    ' ',
  );
const TENS = new Map(
  Object.entries({
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  }),
);
const SCALES = new Map(
  Object.entries({ thousand: 1e3, million: 1e6, billion: 1e9 }),
);

class SpokenNumber {
  readonly out: string[] = [];
  total: number | null = null;
  current = 0;
  dollars = false;

  flush(): void {
    if (this.total === null) return;
    this.out.push(`${this.dollars ? '$' : ''}${this.total + this.current}`);
    this.total = null;
    this.current = 0;
    this.dollars = false;
  }

  numberWord(word: string): boolean {
    const unit = UNITS.indexOf(word),
      ten = TENS.get(word),
      scale = SCALES.get(word);
    if (unit < 0 && !ten && word !== 'hundred' && !scale) return false;
    if ((unit >= 0 || ten) && this.total !== null && this.current % 10 !== 0)
      this.flush();
    if (ten && this.total !== null && this.current % 100 !== 0) this.flush();
    this.total ??= 0;
    if (unit >= 0) this.current += unit;
    else if (ten) this.current += ten;
    else if (word === 'hundred') this.current = (this.current || 1) * 100;
    else if (scale) {
      this.total += (this.current || 1) * scale;
      this.current = 0;
    }
    return true;
  }

  suffix(word: string): boolean {
    if (this.total !== null && (word === 'percent' || word === '%')) {
      this.out.push(`${this.total + this.current}%`);
      this.total = null;
      this.current = 0;
      return true;
    }
    if (word === 'dollars' || word === 'dollar') return this.currency();
    if (word === 'percent' && /^\$?\d/.test(this.out.at(-1) ?? '')) {
      this.out[this.out.length - 1] += '%';
      return true;
    }
    return false;
  }

  currency(): boolean {
    if (this.total !== null) {
      this.dollars = true;
      this.flush();
      return true;
    }
    if (!/^\d/.test(this.out.at(-1) ?? '')) return false;
    this.out[this.out.length - 1] = `$${this.out[this.out.length - 1]}`;
    return true;
  }

  consume(raw: string): void {
    // A sentence's final period is punctuation ("twenty-four hundred." is 2400), not a decimal point.
    const word = raw.replace(/[^a-z0-9.$%]/g, '').replace(/\.+$/, '');
    if (!word) return;
    const digits = word.replace(/[$,%]/g, '');
    if (/^\d+(\.\d+)?$/.test(digits)) {
      this.flush();
      this.out.push(
        `${word.includes('$') ? '$' : ''}${Number(digits)}${word.includes('%') ? '%' : ''}`,
      );
      return;
    }
    if (this.numberWord(word) || this.suffix(word)) return;
    this.flush();
    this.out.push(word);
  }
}

/** Words and digits use the same comparison form: “sixty percent” and “60%” become “60%”. */
export function spoken(words: readonly string[]): string {
  const number = new SpokenNumber();
  for (const word of words
    .join(' ')
    .toLowerCase()
    .replace(/-/g, ' ')
    .split(/\s+/))
    number.consume(word);
  number.flush();
  return number.out.join(' ');
}
