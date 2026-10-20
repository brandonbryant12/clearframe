import { finite, isObject } from './guards.mjs';
import type {
  CanvasElement,
  DocumentSection,
  Fail,
  JsonRecord,
} from './types.mjs';
import { hasWords, textMarks } from './canvas-marks.mjs';

/** A document: real sections (a heading and its text), what the camera scrolls to, what is marked. */
export function checkDocument(el: CanvasElement, at: string, fail: Fail): void {
  // A page reads as paper on its ground with a soft shadow, unless the author says otherwise.
  el.shadow ??= true;
  if (
    !Array.isArray(el.sections) ||
    el.sections.length < 1 ||
    el.sections.length > 12
  )
    fail(
      `${at}.sections must be 1–12 sections: {heading, text} in the document's own words`,
    );
  const sections: DocumentSection[] = el.sections;
  sections.forEach((sec, i) => {
    if (
      !sec ||
      typeof sec !== 'object' ||
      typeof sec.text !== 'string' ||
      !sec.text.trim() ||
      sec.text.length > 700
    )
      fail(
        `${at}.sections[${i}].text must be the section's words (up to 700 characters)`,
      );
    if (
      sec.heading != null &&
      (typeof sec.heading !== 'string' || sec.heading.length > 90)
    )
      fail(`${at}.sections[${i}].heading must be up to 90 characters`);
    for (const key of Object.keys(sec))
      if (!['heading', 'text'].includes(key))
        fail(`${at}.sections[${i}]: unsupported field ${key}`);
  });
  for (const key of ['title', 'kicker'] as const) {
    const v = el[key];
    if (v != null && (typeof v !== 'string' || v.length > 120))
      fail(`${at}.${key} must be up to 120 characters`);
  }
  if (el.size != null && !(finite(el.size) && el.size >= 14 && el.size <= 72))
    fail(`${at}.size must be 14–72 px (the body text)`);
  if (el.scroll != null) {
    if (!Array.isArray(el.scroll) || el.scroll.length > 8)
      fail(
        `${at}.scroll must be up to 8 moves: {to: a section index or words of its heading, say|at, dur}`,
      );
    el.scroll.forEach((k, i) => {
      const to = k?.to;
      const ok =
        typeof to === 'number' && Number.isInteger(to)
          ? to >= 0 && to < sections.length
          : typeof to === 'string' &&
            sections.some((sec) =>
              `${sec.heading ?? ''} ${sec.text}`
                .toLowerCase()
                .includes(to.toLowerCase()),
            );
      if (!ok)
        fail(
          `${at}.scroll[${i}].to must be a section index or words from a section's heading or text`,
        );
      if (k.say == null && k.at == null && k.cue == null)
        fail(`${at}.scroll[${i}] needs say, at or cue`);
      for (const key of Object.keys(k))
        if (!['to', 'say', 'at', 'cue', 'after', 'dur'].includes(key))
          fail(`${at}.scroll[${i}]: unsupported field ${key}`);
    });
  }
  if (el.marks != null) {
    const texts = sections.map((sec) => sec.text);
    el.marks = el.marks.map((m, i) => {
      const where = `${at}.marks[${i}]`;
      const rec: JsonRecord = isObject(m) ? m : {};
      const index = rec.section;
      const body =
        typeof index === 'number' && Number.isInteger(index)
          ? texts[index]
          : texts.find((t) =>
              hasWords(
                t,
                String(rec.words ?? '')
                  .trim()
                  .split(/\s+/)
                  .join(' '),
              ),
            );
      if (body == null)
        fail(
          `${where}.words must be whole words of one section's text (or give section: N)`,
        );
      const { section, ...mark } = rec;
      if (
        section != null &&
        !(typeof section === 'number' && Number.isInteger(section))
      )
        fail(`${where}.section must be a section index`);
      const [checked] = textMarks(
        { text: body, marks: [mark] },
        `${at}.marks`,
        (msg) => fail(msg.replace(`${at}.marks.marks[0]`, where)),
      );
      return section == null ? checked : { ...checked, section };
    });
  }
}
