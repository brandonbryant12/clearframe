export const RECEIPT_FIELDS = [
  'x',
  'y',
  'w',
  'size',
  'merchant',
  'detail',
  'items',
  'tax',
  'tip',
  'total',
  'paid',
  'footer',
  'slip',
  'lines',
  'currency',
  'marks',
  'shadow',
];

export const money = (v: number, currency: string): string =>
  `${v < 0 ? '-' : ''}${currency}${Math.abs(v)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
export const round = (v: number): number => Math.round(v * 10) / 10;

/** Whether `phrase` occurs in `text` on word boundaries (as text marks match). */
export function hasWords(text: string, phrase: string): boolean {
  const word = (c: string | undefined): boolean =>
    c != null && /[\p{L}\p{N}]/u.test(c);
  for (let i = text.indexOf(phrase); i >= 0; i = text.indexOf(phrase, i + 1))
    if (!word(text[i - 1]) && !word(text[i + phrase.length])) return true;
  return false;
}
