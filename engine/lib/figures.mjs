// Figures the author typed, checked against the numbers in the project's source documents.
//
// A workplace film's figures come from one document (a benefits page, a policy, a quarterly
// letter). Agents invent the missing one ("each: 800" in a sketch drew "−$2,400" when the page
// only says the FSA resets to $0). Derived figures (a sketch's totals, an axis) come from its
// params, so the params are checked, not the drawing.
import fs from 'node:fs';
import path from 'node:path';
import { sketchByName } from '../../film/sketches.mjs';

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
const value = s => Number(s.replace(/,/g, ''));
/** Keys whose strings are styling, ids, cues or attribution, not figures on screen. */
const SKIP = new Set([
  'source', 'sources', 'id', 'font', 'fill', 'stroke', 'src', 'file', 'd', 'say', 'exitSay', 'land', 'enter', 'exit',
  'ease', 'icon', 'anchor', 'align', 'mode', 'kind', 'block', 'transition', 'material', 'path', 'style', 'emphasisStyle',
  'weight', 'case', 'color', 'sketch', 'sketchSay', 'speaker', 'look', 'seed', 'url', 'format', 'shape', 'world',
]);

/** Every number in the project's source documents (under source/: .md, .txt, .html, .csv), or null without any. */
export function sourceNumbers(root) {
  const dir = path.join(root, 'source');
  let files = [];
  try {
    // `start` with several documents keeps each under source/documents/NAME/.
    files = fs.readdirSync(dir, { recursive: true }).map(String).filter(f => /\.(md|markdown|txt|html?|csv)$/i.test(f));
  } catch {
    return null;
  }
  if (!files.length) return null;
  const values = new Set();
  for (const f of files) for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(NUMBER)) values.add(value(m[0]));
  return { files: files.map(f => `source/${f}`), values };
}

/** The figures an authored beat puts on screen: numbers in its words, chart and stat values, sketch numbers. */
export function authoredFigures(beat) {
  const out = [];
  // A sketch's structural numbers (the days in a month) are marked `figure: false` in its params.
  const spec = (beat.props?.sketch && sketchByName(beat.props.sketch)?.params) || {};
  const walk = (v, key, where) => {
    if (v == null || SKIP.has(key)) return;
    if (where.startsWith('sketchParams.') && spec[where.split('.')[1]]?.figure === false) return;
    if (typeof v === 'string') {
      // A count, an index or a step ("Step 2", "3 coins") is not a figure to source.
      for (const m of v.matchAll(NUMBER)) if (!(value(m[0]) <= 12 && Number.isInteger(value(m[0])))) out.push({ text: m[0], value: value(m[0]), where });
    } else if (typeof v === 'number') {
      // A line drawn from made-up points is invented evidence too (`series`, `points`).
      if (['value', 'values', 'from', 'to', 'target', 'number', 'series', 'points'].includes(key) || where.startsWith('sketchParams'))
        if (!(Math.abs(v) <= 12 && Number.isInteger(v))) out.push({ text: String(v), value: v, where });
    } else if (Array.isArray(v)) v.forEach(x => walk(x, key, where));
    else if (typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k, where.startsWith('sketchParams') ? `sketchParams.${k}` : k === 'sketchParams' ? 'sketchParams' : where);
  };
  walk(beat.props ?? {}, 'props', 'props');
  return out;
}

/**
 * Figures that appear in no source document. A fraction matches its percentage (0.05 and 5%). A beat
 * labelled as an example, or whose source line says how a figure was worked out, is not checked.
 */
export function unsourcedFigures(beat, numbers) {
  const said = JSON.stringify(beat.props ?? {});
  if (/\bexample\b|e\.g\./i.test(said) || /illustrat|calculat|worked out|×/i.test(String(beat.props?.source ?? ''))) return [];
  const found = v => {
    const a = Math.abs(v);
    for (const s of numbers.values) if (Math.abs(s - a) < 1e-9 || Math.abs(s - a * 100) < 1e-6 || Math.abs(s * 100 - a) < 1e-6) return true;
    return false;
  };
  const seen = new Set();
  return authoredFigures(beat).filter(f => !found(f.value) && !seen.has(f.text) && seen.add(f.text));
}
