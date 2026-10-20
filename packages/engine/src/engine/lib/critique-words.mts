import type { BlockProps, Element } from '../domain.mjs';
import { isRecord } from './errors.mjs';

const ignored = new Set([
  'source',
  'file',
  'asset',
  'd',
  'fill',
  'stroke',
  'type',
  'enter',
  'exit',
  'mode',
  'align',
  'font',
  'anchor',
  'icon',
  'name',
  'say',
  'cap',
  'join',
  'blend',
  'view',
  'land',
  'growSay',
  'drawSay',
  'exitSay',
  'emphasis',
  'emphasisStyle',
  'id',
  'gradient',
  'kind',
  'shape',
  'ease',
  'color',
  'world',
]);
const countWords = (text: unknown): number =>
  String(text ?? '')
    .split(/\s+/)
    .filter((w) => w && !/^[\d.,:%$-]+$/.test(w)).length;
const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

/** Count only document sections the camera scrolls into view. */
export function documentWords(value: unknown): number {
  if (!isRecord(value)) return 0;
  const sections = records(value.sections),
    scroll = records(value.scroll);
  const find = (to: unknown): number => {
    if (typeof to === 'number' && Number.isInteger(to)) return to;
    return sections.findIndex((sec) =>
      `${sec.heading ?? ''} ${sec.text ?? ''}`
        .toLowerCase()
        .includes(String(to).toLowerCase()),
    );
  };
  const read = new Set(
    scroll.map((k) => find(k.to)).filter((i) => i >= 0 && i < sections.length),
  );
  if (!read.size && sections.length) read.add(0);
  return (
    (scroll.length ? 0 : countWords(value.title)) +
    [...read].reduce(
      (n, i) =>
        n + countWords(sections[i].heading) + countWords(sections[i].text),
      0,
    )
  );
}
function wordsIn(value: unknown): number {
  if (typeof value === 'string') return countWords(value);
  if (Array.isArray(value))
    return value.reduce((sum: number, x: unknown) => sum + wordsIn(x), 0);
  if (!isRecord(value)) return 0;
  return Object.entries(value).reduce(
    (sum, [key, x]) => sum + (['say', 'id'].includes(key) ? 0 : wordsIn(x)),
    0,
  );
}
function appWords(value: Record<string, unknown>): number {
  if (!Array.isArray(value.pages)) return 0;
  return (
    wordsIn(value.title) +
    wordsIn(value.tabs ?? []) +
    Math.max(...value.pages.map(wordsIn))
  );
}
export function onScreenWords(props: unknown): number {
  const seen = new Set<string>();
  const walk = (value: unknown, key: string): number => {
    if (isRecord(value) && value.type === 'document')
      return documentWords(value);
    if (isRecord(value) && value.type === 'app' && Array.isArray(value.pages))
      return appWords(value);
    if (typeof value === 'string' && !seen.has(value) && !ignored.has(key)) {
      seen.add(value);
      return countWords(value);
    }
    if (Array.isArray(value))
      return value.reduce(
        (sum: number, item: unknown) => sum + walk(item, key),
        0,
      );
    if (isRecord(value))
      return Object.entries(value).reduce(
        (sum, [k, item]) => sum + walk(item, k),
        0,
      );
    return 0;
  };
  return walk(props, '');
}
/** Words actually within the camera rectangle, after group translations. */
export function shotWords(props: BlockProps): number | null {
  const view = props.view;
  if (
    !Array.isArray(view) ||
    view.length !== 4 ||
    !Array.isArray(props.elements)
  )
    return null;
  const documentVisible = (el: Element, x: number, y: number): boolean =>
    x < view[0] + view[2] &&
    x + (el.w ?? 0) > view[0] &&
    y < view[1] + view[3] &&
    y + (el.h ?? 0) > view[1];
  const textVisible = (x: number, y: number): boolean =>
    x >= view[0] &&
    x <= view[0] + view[2] &&
    y >= view[1] &&
    y <= view[1] + view[3];
  const walk = (
    list: readonly Element[] | undefined,
    dx: number,
    dy: number,
  ): number =>
    (list ?? []).reduce((n, el) => {
      const x = (el.x ?? 0) + dx,
        y = (el.y ?? 0) + dy;
      if (el.type === 'group') return n + walk(el.children, x, y);
      if (el.type === 'document' && documentVisible(el, x, y))
        return n + documentWords(el);
      if (
        el.type === 'text' &&
        typeof el.text === 'string' &&
        textVisible(x, y)
      )
        return n + countWords(el.text);
      return n;
    }, 0);
  return walk(props.elements, 0, 0);
}
