import type { StatChange } from './contracts.mjs';

export function changePresentation(change: StatChange) {
  const up = change.value > 0,
    flat = change.value === 0;
  let tone = up === (change.good === 'up') ? 'positive' : 'negative';
  if (flat || change.good === 'neutral') tone = 'muted';
  if (flat) return { tone, sign: '±', marker: '■' };
  return { tone, sign: up ? '+' : '−', marker: up ? '▲' : '▼' };
}
