import type { CanvasElement } from '../types.mjs';
import { sketchByName, sketchParams, sketchMoments } from '../sketches.mjs';
export function slots(name: string) {
  const text = new Set<string>(),
    cues = new Set<string>();
  const walk = (list: CanvasElement[] | undefined): void =>
    (list ?? []).forEach((el) => {
      if (
        el.type === 'text' &&
        el.text != null &&
        /^[A-Z][A-Z0-9_]{2,}$/.test(el.text)
      )
        text.add(el.text);
      for (const c of [
        el.cue,
        el.exitCue,
        el.along?.cue,
        ...(el.keys ?? []).map((k) => k.cue),
      ])
        if (c) cues.add(c);
      walk(el.children);
    });
  try {
    const s = sketchByName(name);
    if (!s) return { text: [], cues: [] };
    walk(s.build(1920, 1080, { params: sketchParams(s, {}) }).elements);
  } catch {}
  // Moments in the order they happen, which is the order narration words fill them.
  const order = sketchMoments(name);
  return {
    text: [...text],
    cues: [
      ...order.filter((c) => cues.has(c)),
      ...[...cues].filter((c) => !order.includes(c)),
    ],
  };
}
/** A canvas beat that uses a sketch: its placeholder words, its named moments and its numbers to fill. */
export function sketchExample(name: string) {
  const { text, cues } = slots(name);
  const params = Object.fromEntries(
    Object.entries(sketchByName(name)?.params ?? {}).map(([k, d]) => [
      k,
      d.default,
    ]),
  );
  return {
    block: 'canvas',
    props: {
      sketch: name,
      ...(text.length
        ? { sketchText: Object.fromEntries(text.map((t) => [t, 'your words'])) }
        : {}),
      ...(cues.length
        ? {
            sketchSay: Object.fromEntries(
              cues.map((c) => [c, 'a spoken word']),
            ),
          }
        : {}),
      ...(Object.keys(params).length ? { sketchParams: params } : {}),
    },
  };
}
export const slotText = ({ text, cues }: ReturnType<typeof slots>) =>
  [
    text.length ? `sketchText ${text.join(', ')}` : '',
    cues.length ? `sketchSay ${cues.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('; ');
