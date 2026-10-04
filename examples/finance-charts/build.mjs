// Builds the finance chart templates: one storyboard per frame shape, JSON only.
// Data is illustrative and deterministic. Replace values, titles and the source line with sourced data.
// usage: node examples/finance-charts/build.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
const asOf = '2026-10-04';
const source = 'Illustrative data';

// Deterministic quarterly index: steady compounding through three bear markets.
function marketIndex() {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const shocks = { '2000-09-30': -.09, '2000-12-31': -.08, '2001-03-31': -.12, '2001-09-30': -.14, '2002-06-30': -.13, '2002-09-30': -.16,
    '2008-06-30': -.03, '2008-09-30': -.09, '2008-12-31': -.22, '2009-03-31': -.12, '2009-06-30': .16, '2009-09-30': .15,
    '2020-03-31': -.2, '2020-06-30': .2, '2022-03-31': -.05, '2022-06-30': -.16, '2022-09-30': -.05 };
  const out = []; let v = 100;
  for (let y = 1990; y <= 2025; y++) for (const q of ['03-31', '06-30', '09-30', '12-31']) {
    const x = `${y}-${q}`;
    if (out.length) v *= 1 + (shocks[x] ?? .008 + rand() * .045);
    out.push({ x, y: Math.round(v * 10) / 10 });
  }
  return out;
}
const index = marketIndex();
const trough = index.filter(p => p.x >= '2008-01-01' && p.x <= '2010-12-31').reduce((a, b) => b.y < a.y ? b : a);
let peak = 0;
const drawdown = index.map(p => { peak = Math.max(peak, p.y); return { x: p.x, y: Math.round((p.y / peak - 1) * 1000) / 10 }; });
const recessions = [
  { from: '2001-03-31', to: '2001-12-31', label: 'Recession' },
  { from: '2007-12-31', to: '2009-06-30', label: 'Recession' },
  { from: '2020-03-31', to: '2020-06-30' },
];
const years = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const yearTicks = (...ys) => ys.map(y => `${y}-12-31`);

const beat = (id, plot, duration = 9) => ({ id, block: 'canvas', duration, camera: 'none', exit: 'none',
  props: { plot: { source, asOf, motion: { at: 0.6, duration: 4 }, ...plot } } });

function beats(shape) {
  const tall = shape !== 'landscape';
  return [
    beat('compounding', {
      title: 'Markets compound through every drawdown',
      x: { type: 'date', label: 'Year', domain: ['1990-03-31', '2025-12-31'], dateFormat: 'year',
        ticks: tall ? ['1990-03-31', '2005-12-31', '2025-12-31'] : ['1990-03-31', '2000-12-31', '2010-12-31', '2025-12-31'] },
      y: { type: 'log', label: 'Index level', domain: [50, 2000], ticks: tall ? [50, 250, 2000] : [50, 100, 250, 500, 1000, 2000] },
      series: [{ id: 'index', label: 'Equity index', values: index }],
      bands: recessions, area: true,
      annotation: { seriesId: 'index', x: trough.x, label: `${trough.x.slice(0, 4)} low`, dx: .08, dy: .16 },
    }),
    beat('purchasing-power', {
      title: 'Inflation quietly erodes a dollar',
      x: { type: 'date', label: 'Year', domain: ['2000-12-31', '2025-12-31'], dateFormat: 'year', ticks: yearTicks(2000, 2010, 2025) },
      y: { type: 'linear', label: 'Purchasing power of $100', domain: [40, 100], ticks: [40, 60, 80, 100], prefix: '$' },
      series: [{ id: 'dollar', label: '$100 held in cash', values: years(2000, 2025).map(y => ({ x: `${y}-12-31`,
        y: Math.round(100 / Math.pow(1.026, y - 2000) / (y >= 2022 ? Math.pow(1.03, Math.min(y, 2023) - 2021) : 1) * 10) / 10 })) }],
      area: true,
    }),
    beat('real-nominal', {
      title: 'Higher pay, flat purchasing power',
      x: { type: 'date', label: 'Year', domain: ['2015-12-31', '2025-12-31'], dateFormat: 'year', ticks: yearTicks(2015, 2020, 2025) },
      y: { type: 'linear', label: 'Average wage · index, 2015 = 100', domain: [90, 150], ticks: [90, 110, 130, 150] },
      series: [
        { id: 'nominal', label: 'Nominal wage', values: years(2015, 2025).map((y, i) => ({ x: `${y}-12-31`, y: Math.round(100 * Math.pow(1.034, i) * (y >= 2021 ? 1.02 : 1) * 10) / 10 })) },
        { id: 'real', label: 'Real wage', values: years(2015, 2025).map((y, i) => ({ x: `${y}-12-31`, y: Math.round((100 + i * 1.1 - (y === 2021 ? 1.5 : y === 2022 ? 3.8 : y === 2023 ? 2.2 : y >= 2024 ? 1 : 0)) * 10) / 10 })) },
      ],
    }),
    beat('yield-curve', {
      title: 'The yield curve inverted, then normalized',
      x: { type: 'linear', label: 'Years to maturity', domain: [0, 30], ticks: [0, 10, 20, 30] },
      y: { type: 'linear', label: 'Treasury yield', domain: [3, 6], ticks: [3, 4, 5, 6], decimals: 0, suffix: '%' },
      series: [
        { id: 'inverted', label: 'Mid-2023', values: [[.25, 5.45], [1, 5.35], [2, 4.9], [5, 4.3], [10, 4.0], [20, 4.2], [30, 4.0]].map(([x, y]) => ({ x, y })) },
        { id: 'normal', label: 'Mid-2025', values: [[.25, 4.35], [1, 4.05], [2, 3.9], [5, 4.0], [10, 4.4], [20, 4.9], [30, 4.95]].map(([x, y]) => ({ x, y })) },
      ],
    }),
    beat('drawdowns', {
      title: 'Drawdowns are the price of admission',
      x: { type: 'date', label: 'Year', domain: ['1990-03-31', '2025-12-31'], dateFormat: 'year',
        ticks: tall ? ['1990-03-31', '2005-12-31', '2025-12-31'] : ['1990-03-31', '2000-12-31', '2010-12-31', '2025-12-31'] },
      y: { type: 'linear', label: 'Decline from prior peak', domain: [-60, 0], ticks: [-60, -40, -20, 0], suffix: '%' },
      series: [{ id: 'drawdown', label: 'Equity index', values: drawdown }],
      bands: recessions,
    }),
    beat('scenarios', {
      title: 'Three paths for the next decade',
      x: { type: 'date', label: 'Year', domain: ['2015-12-31', '2035-12-31'], dateFormat: 'year', ticks: yearTicks(2015, 2025, 2035) },
      y: { type: 'linear', label: 'Portfolio value · $ thousands', domain: [0, 500], ticks: [0, 100, 200, 300, 400, 500], prefix: '$' },
      series: [
        { id: 'history', label: 'History', values: years(2015, 2025).map((y, i) => ({ x: `${y}-12-31`, y: Math.round(100 * Math.pow(1.075, i) * (y === 2022 ? .86 : 1)) })) },
        ...[['low', 'Low (3%)', .03], ['base', 'Base (6%)', .06], ['high', 'High (9%)', .09]].map(([id, label, r]) =>
          ({ id, label, values: years(2015, 2035).map((y, i) => ({ x: `${y}-12-31`, y: y < 2025 ? null : Math.round(206 * Math.pow(1 + r, y - 2025)) })) })),
      ],
      bands: [{ from: '2025-12-31', to: '2035-12-31', label: 'Projection' }],
    }, 10),
  ];
}

for (const [shape, preset] of [['landscape', 'landscape'], ['vertical', 'vertical']]) {
  const storyboard = {
    version: 2, title: 'Finance chart templates', format: { preset, fps: 30 }, theme: 'ledger', type: 'geometric',
    backdrop: 'none', motion: { preset: 'gentle', intensity: 0.35 }, transition: 'cut', sfx: 'off', captions: false, music: false,
    sources: [{ claim: 'All series are illustrative templates, not market data.', source, asOf }],
    beats: beats(shape),
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-landscape.json and storyboard-vertical.json');
