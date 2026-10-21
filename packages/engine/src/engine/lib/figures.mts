// Figures the author typed, checked against the numbers in the project's source documents.
//
// A workplace film's figures come from one document (a benefits page, a policy, a quarterly
// letter). Agents invent the missing one ("each: 800" in a sketch drew "−$2,400" when the page
// only says the FSA resets to $0). Derived figures (a sketch's totals, an axis) come from its
// params, so the params are checked, not the drawing.
import fs from 'node:fs';
import path from 'node:path';
import type { Beat } from '../domain.mjs';
import { sketchByName } from '../../film/sketches.mjs';
import { isRecord } from './errors.mjs';

/** A number an authored beat shows, as typed, and where in its props it sits. */
export interface Figure {
  text: string;
  value: number;
  where: string;
}
/** Every number in the project's source documents. */
export interface SourceNumbers {
  files: string[];
  values: Set<number>;
}
export interface DroppedFactsOptions {
  spokenNumbers?: (text: string) => Iterable<number>;
}

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
const value = (s: string): number => Number(s.replace(/,/g, ''));
/** Keys whose strings are styling, ids, cues or attribution, not figures on screen. */
const SKIP = new Set([
  'source',
  'sources',
  'id',
  'font',
  'fill',
  'stroke',
  'src',
  'file',
  'd',
  'say',
  'exitSay',
  'land',
  'enter',
  'exit',
  'ease',
  'icon',
  'anchor',
  'align',
  'mode',
  'kind',
  'block',
  'transition',
  'material',
  'path',
  'style',
  'emphasisStyle',
  'weight',
  'case',
  'color',
  'sketch',
  'sketchSay',
  'speaker',
  'look',
  'seed',
  'url',
  'format',
  'shape',
  'world',
]);

/** Every number in the project's source documents (under source/: .md, .txt, .html, .csv), or null without any. */
export function sourceNumbers(root: string): SourceNumbers | null {
  const dir = path.join(root, 'source');
  let files: string[] = [];
  try {
    // `start` with several documents keeps each under source/documents/NAME/.
    files = fs
      .readdirSync(dir, { recursive: true })
      .map(String)
      .filter((f) => /\.(md|markdown|txt|html?|csv)$/i.test(f));
  } catch {
    return null;
  }
  if (!files.length) return null;
  const values = new Set<number>();
  for (const f of files)
    for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(NUMBER))
      values.add(value(m[0]));
  return { files: files.map((f) => `source/${f}`), values };
}

/** The figures an authored beat puts on screen: numbers in its words, chart and stat values, sketch numbers. */
const FIGURE_KEYS = new Set([
  'value',
  'values',
  'from',
  'to',
  'target',
  'number',
  'series',
  'points',
]);
const DRAWN_KEYS = new Set(['elements', 'children', 'under', 'over']);
const smallCount = (number: number): boolean =>
  Math.abs(number) <= 12 && Number.isInteger(number);

interface FigureFields {
  readonly [key: string]: unknown;
}

class AuthoredFigures {
  readonly figures: Figure[] = [];
  constructor(private readonly sketchParams: unknown) {}

  walk(input: unknown, key: string, where: string, drawn = false): void {
    if (input == null || SKIP.has(key) || (drawn && key === 'points')) return;
    if (
      where.startsWith('sketchParams.') &&
      this.structural(where.split('.')[1])
    )
      return;
    if (typeof input === 'string') this.text(input, where);
    else if (typeof input === 'number') this.number(input, key, where);
    else if (Array.isArray(input))
      input.forEach((item: unknown) =>
        this.walk(item, key, where, drawn || DRAWN_KEYS.has(key)),
      );
    else if (isRecord(input)) this.object(input, where, drawn);
  }

  private structural(name: string): boolean {
    const param = isRecord(this.sketchParams)
      ? this.sketchParams[name]
      : undefined;
    return isRecord(param) && param.figure === false;
  }

  private text(input: string, where: string): void {
    for (const match of input.matchAll(NUMBER)) {
      const number = value(match[0]);
      if (!smallCount(number))
        this.figures.push({ text: match[0], value: number, where });
    }
  }

  private number(input: number, key: string, where: string): void {
    if (
      (FIGURE_KEYS.has(key) || where.startsWith('sketchParams')) &&
      !smallCount(input)
    )
      this.figures.push({ text: String(input), value: input, where });
  }

  private object(input: FigureFields, where: string, drawn: boolean): void {
    for (const [key, item] of Object.entries(input)) {
      let location = where;
      if (where.startsWith('sketchParams')) location = `sketchParams.${key}`;
      else if (key === 'sketchParams') location = 'sketchParams';
      this.walk(item, key, location, drawn);
    }
  }
}

export function authoredFigures(beat: Pick<Beat, 'props'>): Figure[] {
  const params = beat.props?.sketch
    ? sketchByName(beat.props.sketch)?.params
    : undefined;
  const scan = new AuthoredFigures(params);
  scan.walk(beat.props ?? {}, 'props', 'props');
  return scan.figures;
}

/**
 * Figures that appear in no source document. A fraction matches its percentage (0.05 and 5%). A beat
 * labelled as an example, or whose source line says how a figure was worked out, is not checked.
 */
export function unsourcedFigures(
  beat: Pick<Beat, 'props'>,
  numbers: Pick<SourceNumbers, 'values'>,
): Figure[] {
  const said = JSON.stringify(beat.props ?? {});
  if (
    /\bexample\b|e\.g\./i.test(said) ||
    /illustrat|calculat|worked out|×|=|\bequals?\b|\bis about\b/i.test(
      String(beat.props?.source ?? ''),
    )
  )
    return [];
  const found = (v: number): boolean => {
    const a = Math.abs(v);
    for (const s of numbers.values)
      if (
        Math.abs(s - a) < 1e-9 ||
        Math.abs(s - a * 100) < 1e-6 ||
        Math.abs(s * 100 - a) < 1e-6
      )
        return true;
    return false;
  };
  const seen = new Set<string>();
  return authoredFigures(beat).filter(
    (f) => !found(f.value) && !seen.has(f.text) && seen.add(f.text),
  );
}

/**
 * Facts in the source documents the film never states: a bullet or sentence whose figures appear
 * nowhere in the film (narration, sketch numbers, charts, words on screen), or, with no figures, most
 * of whose words are never said or shown. These are the next beats for a film well short of its length.
 * Small whole numbers (counts, list markers) and years are not figures. Null without a source document.
 */
export function droppedFacts(
  root: string,
  sb: { beats?: readonly Pick<Beat, 'props' | 'vo'>[] },
  { spokenNumbers = () => [] }: DroppedFactsOptions = {},
): string[] | null {
  const dir = path.join(root, 'source');
  let files: string[] = [];
  try {
    files = fs
      .readdirSync(dir, { recursive: true })
      .map(String)
      .filter((f) => /\.(md|markdown|txt)$/i.test(f) && !/original/i.test(f));
  } catch {
    return null;
  }
  if (!files.length) return null;
  const { said, text } = filmEvidence(sb.beats ?? [], spokenNumbers);
  const STOP = new Set([
    'through',
    'never',
    'about',
    'their',
    'there',
    'which',
    'would',
    'could',
    'should',
    'after',
    'before',
    'every',
    'other',
    'these',
    'those',
    'where',
    'while',
    'being',
    'using',
    'under',
    'first',
    'thing',
    'things',
    'still',
    'within',
    'without',
  ]);
  const stem = (w: string): string =>
    w
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .replace(/(ing|ed|es|s)$/, '');
  const words = new Set(
    text
      .join(' ')
      .split(/[^A-Za-z-]+/)
      .flatMap((w) => w.split('-'))
      .map(stem)
      .filter(Boolean),
  );
  const has = (v: number): boolean =>
    said.has(v) || said.has(v * 100) || said.has(v / 100);
  const facts = sourceFacts(dir, files);
  const out: string[] = [];
  for (const line of facts) {
    const figures = [...line.matchAll(NUMBER)]
      .map((m) => value(m[0]))
      .filter(
        (v) => !(Number.isInteger(v) && v <= 12) && !(v >= 1990 && v <= 2100),
      );
    const content = [
      ...new Set(
        line
          .split(/[^A-Za-z-]+/)
          .flatMap((w) => w.split('-'))
          .filter((w) => w.length >= 5 && !STOP.has(w.toLowerCase()))
          .map(stem),
      ),
    ];
    const missing = figures.length
      ? !figures.some(has)
      : content.length >= 4 &&
        content.filter((w) => words.has(w)).length / content.length < 0.4;
    if (missing) out.push(line.length > 150 ? `${line.slice(0, 149)}…` : line);
  }
  return out;
}

function sourceFacts(dir: string, files: string[]): string[] {
  // Bullets wrap onto indented lines: join them into one fact each.
  const facts: string[] = [];
  for (const f of files) {
    const body = fs
      .readFileSync(path.join(dir, f), 'utf8')
      .replace(/\n[ \t]+(?=\S)/g, ' ');
    // A brief keeps its facts under a "Source" heading; its tone and audience notes are not facts.
    const sourced = /^#+\s*source/im.test(body);
    let inSource = !sourced;
    for (const raw of body.split('\n')) {
      if (/^#/.test(raw.trim())) {
        inSource = !sourced || /^#+\s*source/i.test(raw.trim());
        continue;
      }
      const line = raw
        .replace(/^[\s>*-]+/g, '')
        .replace(/\*\*/g, '')
        .trim();
      if (
        inSource &&
        line &&
        !/^(from|for|length|brief|after watching|tone)\s*:/i.test(line)
      )
        facts.push(line);
    }
  }
  return facts;
}

function filmEvidence(
  beats: readonly Pick<Beat, 'props' | 'vo'>[],
  spokenNumbers: (text: string) => Iterable<number>,
) {
  const said = new Set<number>(),
    text: string[] = [];
  for (const b of beats) {
    const shown = JSON.stringify(b.props ?? {});
    text.push(String(b.vo ?? ''), shown);
    for (const m of shown.matchAll(NUMBER)) said.add(value(m[0]));
    for (const m of String(b.vo ?? '').matchAll(NUMBER)) said.add(value(m[0]));
    for (const v of spokenNumbers(b.vo ?? '')) said.add(v);
  }
  return { said, text };
}
