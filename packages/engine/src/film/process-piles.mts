import type { ProcessDrawing, Pile } from './process-contracts.mjs';
export function processPiles({
  p,
  states,
  maxTokens,
  cols,
  tokenSize,
  gap,
  time,
  out,
  timed,
}: ProcessDrawing): Pile {
  const pile: Pile = (cx, baseY, i, dir) => {
    // The final token can be a fraction of a group. Dropping it would make a
    // nonempty queue look empty whenever its count is smaller than `token`.
    for (let k = 1; k <= maxTokens; k++) {
      const amounts = states.map((s) =>
        Math.min(1, Math.max(0, (s.queues[i] - (k - 1) * p.token) / p.token)),
      );
      for (const { a, b } of occupiedSpans(amounts)) {
        const { x, y } = tokenPosition({
          cx,
          baseY,
          dir,
          k,
          cols,
          tokenSize,
          gap,
        });
        const timing = {
          at: a === 0 ? 0 : time[a],
          ...(b + 1 < amounts.length
            ? { exit: 'none', exitAt: time[b + 1] }
            : {}),
        };
        if (amounts[a] < 1)
          out.push({
            id: timed(`pr-${p.id}-${p.stages[i].id}-slot${k}-${a}`),
            type: 'rect',
            x,
            y,
            w: tokenSize,
            h: tokenSize,
            r: 4,
            fill: 'none',
            stroke: 'muted',
            width: 1.5,
            opacity: 0.5,
            enter: 'none',
            ...timing,
          });
        out.push({
          id: timed(`pr-${p.id}-${p.stages[i].id}-q${k}-${a}`),
          type: 'rect',
          x,
          y,
          w: tokenSize * amounts[a],
          h: tokenSize,
          r: 4,
          fill: 'accent',
          opacity: 0.85,
          enter: a === 0 ? 'none' : 'pop',
          dur: 0.2,
          ...timing,
        });
      }
    }
  };
  return pile;
}

function occupiedSpans(amounts: number[]): Array<{ a: number; b: number }> {
  const spans: Array<{ a: number; b: number }> = [];
  let a = 0;
  while (a < amounts.length) {
    if (!amounts[a]) {
      a++;
      continue;
    }
    let b = a;
    while (b + 1 < amounts.length && amounts[b + 1] === amounts[a]) b++;
    spans.push({ a, b });
    a = b + 1;
  }
  return spans;
}
interface TokenPosition {
  cx: number;
  baseY: number;
  dir: 'up' | 'right';
  k: number;
  cols: number;
  tokenSize: number;
  gap: number;
}
function tokenPosition({
  cx,
  baseY,
  dir,
  k,
  cols,
  tokenSize,
  gap,
}: TokenPosition) {
  const col = (k - 1) % cols,
    row = Math.floor((k - 1) / cols);
  const x =
    dir === 'up'
      ? cx - (cols * (tokenSize + gap) - gap) / 2 + col * (tokenSize + gap)
      : cx +
        (k - 1) * (tokenSize + gap) -
        Math.floor((k - 1) / cols) * cols * (tokenSize + gap);
  const y =
    dir === 'up'
      ? baseY - (row + 1) * (tokenSize + gap)
      : baseY + row * (tokenSize + gap);
  return { x, y };
}
