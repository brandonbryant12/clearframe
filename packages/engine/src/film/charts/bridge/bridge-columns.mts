import type { BridgeSpec, BridgeColumn } from './contracts.mjs';

/** The columns in reading order, each with the level it starts from and the level it reaches. */
export function bridgeColumns(p: BridgeSpec): BridgeColumn[] {
  const out: BridgeColumn[] = [
    {
      kind: 'start',
      label: p.start.label,
      from: 0,
      to: p.start.value,
      value: p.start.value,
    },
  ];
  let level = p.start.value;
  for (const s of p.steps) {
    if (s.total)
      out.push({
        kind: 'subtotal',
        label: s.label,
        from: 0,
        to: level,
        value: level,
        say: s.say,
      });
    else {
      out.push({
        kind: 'step',
        label: s.label,
        from: level,
        to: level + s.value,
        value: s.value,
        say: s.say,
      });
      level += s.value;
    }
  }
  out.push({
    kind: 'end',
    label: p.end.label,
    from: 0,
    to: p.end.value,
    value: p.end.value,
    say: p.end.say,
  });
  return out;
}
