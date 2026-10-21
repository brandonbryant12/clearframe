import type {
  ResolvedStoryboard,
  Timing,
  Beat,
  Element,
  Art,
} from '../../engine/domain.mjs';
import type {
  PrepareOptions,
  RoughResult,
  Placeholder,
  AllowedText,
  UnfinishedElement,
} from './contracts.mjs';
import { assetSrc } from '../../engine/lib/timing.mjs';
/**
 * Rough cuts stand in for what isn't made yet, and only for what is declared:
 * - a beat with `placeholder` (or a generated asset nobody has paid for) becomes a labelled
 *   slate over its own words, on its own clock;
 * - a canvas or art element marked `unfinished` (true or a short note) renders as drawn.
 * `allowed` lists exactly the text those stand-ins and unfinished elements show, which is all
 * a rough frame audit may treat as unfinished craft. Outside --rough both are errors.
 */
export function roughStandIns(
  root: string,
  sb: ResolvedStoryboard,
  timing: Timing,
  { rough = false }: PrepareOptions = {},
): RoughResult {
  const placeholders: Placeholder[] = [],
    allowed: AllowedText[] = [],
    unfinished: UnfinishedElement[] = [];
  const beats = sb.beats.map((raw, i) => {
    const b = prepareUnfinished(raw, i, timing, rough, unfinished, allowed);
    const declared = placeholderText(b.placeholder);
    if (
      b.placeholder != null &&
      !(
        typeof declared === 'string' &&
        declared.trim() &&
        declared.length <= 140
      )
    )
      throw new Error(
        `${b.id}: placeholder must be a description up to 140 characters (or {text}).`,
      );
    const pending = missingAssets(root, sb, b);
    if (!declared && !pending.length) return b;
    if (!rough)
      throw new Error(
        declared
          ? `${b.id} is a declared placeholder (“${declared}”); author it, or render a rough cut with --rough.`
          : `${b.id}: generated asset ${pending.join(', ')} is not made yet; run images/clips within the budget, or render a rough cut with --rough.`,
      );
    return standIn(
      b,
      i,
      timing,
      declared ?? `generated ${pending.join(', ')} not made yet`,
      declared,
      pending,
      placeholders,
      allowed,
    );
  });
  return { sb: { ...sb, beats }, timing, placeholders, unfinished, allowed };
}

function placeholderText(value: Beat['placeholder']): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.text;
  return undefined;
}

interface MarkedElement {
  el: Element;
  note: string | null;
}
function missingAssets(
  root: string,
  sb: ResolvedStoryboard,
  b: Beat,
): string[] {
  const ids = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (k === 'asset' && typeof x === 'string') ids.add(x);
        else if (k === 'plates' && typeof x === 'string')
          ['far', 'mid', 'near'].forEach((l) => ids.add(`${x}-${l}`));
        else walk(x);
      }
  };
  walk([b.props, b.art, b.plate]);
  return [...ids].filter((id) => {
    const a = sb.assets.find((a) => a.id === id);
    return a && !a.file && a.prompt && !assetSrc(root, a);
  });
}

function stripUnfinished(
  list: Element[] | undefined,
  marked: MarkedElement[],
  beatId: string,
): Element[] | undefined {
  return Array.isArray(list)
    ? list.map((el) => {
        if (!el || typeof el !== 'object' || Array.isArray(el)) return el;
        const { unfinished: u, ...rest } = el;
        if (u != null) {
          if (
            !(
              u === true ||
              (typeof u === 'string' && u.trim() && u.length <= 140)
            )
          )
            throw new Error(
              `${beatId}: unfinished must be true or a note up to 140 characters.`,
            );
          marked.push({ el: rest, note: u === true ? null : u });
        }
        return Array.isArray(rest.children)
          ? {
              ...rest,
              children: stripUnfinished(rest.children, marked, beatId),
            }
          : rest;
      })
    : list;
}

function strippedBeat(raw: Beat, marked: MarkedElement[]): Beat {
  const b = { ...raw };
  if (raw.props?.elements)
    b.props = {
      ...raw.props,
      elements: stripUnfinished(raw.props.elements, marked, raw.id),
    };
  if (raw.art && typeof raw.art === 'object') {
    b.art = { ...raw.art };
    if (raw.art.under)
      b.art.under = stripUnfinished(raw.art.under, marked, raw.id);
    if (raw.art.over)
      b.art.over = stripUnfinished(raw.art.over, marked, raw.id);
  }
  return b;
}
function recordUnfinished(
  id: string,
  marked: MarkedElement[],
  unfinished: UnfinishedElement[],
  allowed: AllowedText[],
): void {
  for (const m of marked) {
    unfinished.push({
      beat: id,
      element: m.el.id ?? m.el.type,
      ...(m.note ? { note: m.note } : {}),
    });
    if (m.el.type === 'text' && m.el.text != null)
      allowed.push({
        beat: id,
        text: String(m.el.text),
        why: `marked unfinished${m.note ? `: ${m.note}` : ''}`,
      });
  }
}
function prepareUnfinished(
  raw: Beat,
  i: number,
  timing: Timing,
  rough: boolean,
  unfinished: UnfinishedElement[],
  allowed: AllowedText[],
): Beat {
  const marked: MarkedElement[] = [];
  const b = strippedBeat(raw, marked);
  if (!marked.length) return raw;
  if (!rough)
    throw new Error(
      `${raw.id}: ${marked.length} element(s) marked unfinished (${marked.map((m) => m.el.id ?? m.el.type).join(', ')}); finish them, or render a rough cut with --rough.`,
    );
  timing.beats[i] = {
    ...timing.beats[i],
    props: b.props ?? timing.beats[i].props,
  };
  recordUnfinished(raw.id, marked, unfinished, allowed);
  return b;
}

function standIn(
  b: Beat,
  i: number,
  timing: Timing,
  what: string,
  declared: string | undefined,
  pending: string[],
  placeholders: Placeholder[],
  allowed: AllowedText[],
): Beat {
  const tb = timing.beats[i],
    W = timing.width,
    H = timing.height,
    m = Math.round(Math.min(W, H) * 0.035);
  // A dashed frame and a label inside the title-safe area, in the second accent: unmistakably
  // a stand-in, never mistaken for design.
  const label = `PLACEHOLDER · ${what}`.slice(0, 72);
  const slate: Art = {
    over: [
      {
        type: 'rect',
        x: m,
        y: m,
        w: W - 2 * m,
        h: H - 2 * m,
        r: 18,
        fill: 'none',
        stroke: 'accent2',
        width: 3,
        dash: [16, 12],
        opacity: 0.8,
        enter: 'none',
      },
      {
        type: 'text',
        text: label,
        x: Math.round(W * 0.06),
        y: Math.round(H * 0.06) + 36,
        size: 34,
        font: 'mono',
        fill: 'accent2',
        anchor: 'start',
        fit: Math.round(W * 0.88),
        enter: 'none',
      },
    ],
  };
  const spoken = (tb.vo?.words?.length ?? 0) > 0;
  const stand = spoken
    ? {
        block: 'kinetic',
        props: {
          mode: 'highlight',
          align: 'center',
          maxWords: H > W ? 5 : 8,
        },
      }
    : {
        block: 'statement',
        props: { kicker: 'Placeholder', text: what.slice(0, 90) },
      };
  placeholders.push({
    beat: b.id,
    reason: what,
    declared: !!declared,
    label,
    ...(pending.length ? { assets: pending } : {}),
  });
  allowed.push({ beat: b.id, text: label, why: 'placeholder slate' });
  if (!spoken)
    allowed.push(
      { beat: b.id, text: 'Placeholder', why: 'placeholder slate' },
      { beat: b.id, text: what.slice(0, 90), why: 'placeholder slate' },
    );
  const keep = [
    'id',
    'vo',
    'speaker',
    'chapter',
    'transition',
    'exit',
    'motion',
    'duration',
    'lead',
    'tail',
    'hold',
    'min',
  ] as const;
  timing.beats[i] = { ...tb, ...stand };
  return {
    ...Object.fromEntries(
      keep.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]),
    ),
    id: b.id,
    ...stand,
    art: slate,
  };
}
