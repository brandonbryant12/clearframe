import { isTextMark } from './guards.mjs';
import type { CanvasElement, TextMark } from './types.mjs';
import type { ReceiptScene } from './receipt-contracts.mjs';
import { hasWords } from './receipt-common.mjs';
export function receiptMarks(scene: ReceiptScene): void {
  const { at, fail, marks, els } = scene;
  // Marks name words printed on the receipt; each goes to the line that prints them.
  if (marks != null) {
    if (!Array.isArray(marks) || marks.length < 1 || marks.length > 4)
      fail(`${at}.marks must be 1–4 marks: {words, style, say|at}`);
    const texts: CanvasElement[] = [];
    const walk = (list: CanvasElement[]): void =>
      list.forEach((el) => {
        if (el.type === 'text') texts.push(el);
        else if (el.children) walk(el.children);
      });
    walk(els);
    marks.forEach((m, i) => {
      const mark: TextMark = m && isTextMark(m) ? m : {};
      const words = String(mark.words ?? '')
        .trim()
        .split(/\s+/)
        .join(' ');
      const home = texts.find((t) => hasWords(t.text ?? '', words));
      if (!home)
        return fail(
          `${at}.marks[${i}].words "${words}" are not printed on the receipt (each mark names words of one line: the merchant, an item, an amount)`,
        );
      (home.marks ??= []).push({ ...mark, words });
    });
  }
}
