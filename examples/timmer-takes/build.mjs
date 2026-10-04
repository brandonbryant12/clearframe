// Five short market-commentary films in the style of a chief strategist's weekly charts, each parked
// at a different stage of production so the studio viewer can show the whole lifecycle:
//   real-rates-and-gold        brief      (brief.md only)
//   earnings-carry-the-market  script     (narration written, scenes are placeholders)
//   sixty-forty-is-back        storyboard (scenes designed, nothing rendered)
//   bull-markets-outlast-bears rough cut  (rendered with --rough, one placeholder left)
//   cash-is-not-as-safe        final      (final render)
// All figures are illustrative, not market data. usage: node examples/timmer-takes/build.mjs
// The script writes briefs and storyboards. To bring the last two films to their stages (renders stay local):
//   node engine/cli.mjs voice <film> --draft && node engine/cli.mjs music <film> --draft
//   node engine/cli.mjs render examples/timmer-takes/bull-markets-outlast-bears --draft --rough --label "First full-length look"
//   node engine/cli.mjs render examples/timmer-takes/cash-is-not-as-safe --label "Delivery master"
import fs from 'node:fs';

const asOf = '2026-10-04', source = 'Illustrative data';
const dir = name => { const u = new URL(`${name}/`, import.meta.url); fs.mkdirSync(u, { recursive: true }); return u; };
const write = (name, file, text) => fs.writeFileSync(new URL(file, dir(name)), text);
const film = (title, beats) => ({
  version: 2, title, format: { preset: 'landscape', fps: 30 }, theme: 'ledger', type: 'geometric', backdrop: 'none',
  motion: { preset: 'gentle', intensity: 0.35 }, transition: 'cut', sfx: 'subtle', captions: false,
  voice: { provider: 'gemini', voice: 'Charon', style: 'calm, assured, warm; a strategist explaining one chart' },
  music: { model: 'lyria-3.5', prompt: 'Understated modern piano and soft pulse, confident and calm', bpm: 90, key: 'D major', volume: 0.16 },
  sources: [{ claim: 'All series are illustrative, not market data.', source, asOf }], beats,
});
const open = (kicker, title) => ({ id: 'open', block: 'title', duration: 4, props: { kicker, title } });
const close = title => ({ id: 'close', block: 'endcard', duration: 5, props: { kicker: 'The long view', title, support: 'Illustrative figures. Talk to your advisor about your plan.' } });
const canvas = (id, duration, vo, props) => ({ id, block: 'canvas', duration, camera: 'none', exit: 'none', vo, props });
const years = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const ye = y => `${y}-12-31`;
const brief = (title, body) => `# ${title}\n\n${body.trim()}\n`;

// ---------------------------------------------------------------- 1. brief
write('real-rates-and-gold', 'brief.md', brief('Real rates and gold', `
**Stage:** brief. No script or storyboard yet.

**Audience:** self-directed investors who follow markets weekly.

**The one idea:** gold tends to move opposite to real interest rates; when real yields fall, gold usually rises, and the last few years have been an exception worth explaining.

**What the film needs to show**
- Real 10-year yield and the gold price on one timeline (two series, shared dates).
- The stretch where both rose together, called out.
- One headline figure for today's real yield.

**Length and format:** 30–40 seconds, landscape and vertical cuts. Calm narration, one chart idea per scene.

**Data to source:** real yield (TIPS) and gold, monthly, 2006 onward. Attribute both on screen.

**Next step:** write the script and a scene list.
`));

// ---------------------------------------------------------------- 2. script
const scriptBeat = (id, duration, vo, placeholder) => ({ id, block: 'statement', duration, vo, placeholder, props: { title: placeholder.split(':')[0] } });
write('earnings-carry-the-market', 'storyboard.json', JSON.stringify(film('Earnings carry the market', [
  open('The long view', 'Earnings carry the market'),
  scriptBeat('price-and-earnings', 9, 'Over the long run, stock prices follow earnings. Put the two lines together and they rise almost in step.', 'Line chart: index level and trailing earnings, both indexed to 100, 1990 to 2025'),
  scriptBeat('gaps', 8, 'The gaps between them are where sentiment lives: prices run ahead in booms and fall behind in fear.', 'Line chart: price-to-earnings ratio with the 2000 and 2009 extremes called out'),
  scriptBeat('growth', 7, 'Earnings have grown about seven percent a year, and that growth is most of what investors have been paid for.', 'Headline figure: 7% average annual earnings growth'),
  scriptBeat('this-year', 7, 'This year, earnings rose faster than prices, which leaves valuations a little lower than they started.', 'Bar chart: this year’s change in price, earnings and the P/E multiple'),
  close('Follow the earnings'),
]), null, 1) + '\n');
write('earnings-carry-the-market', 'brief.md', brief('Earnings carry the market', `
**Stage:** script. The narration is written and every scene is described; the pictures are placeholders.

**Audience:** long-term investors. **Length:** about 40 seconds.

**Next step:** design each scene from the finance chart templates (line charts for price and earnings, a headline figure, a bar chart), then review the storyboard.
`));

// ---------------------------------------------------------------- 3. storyboard
const sixtyForty = [11.5, 13.2, -2.1, 21.8, 14.7, 10.2, -16.0, 15.6, 12.1, 9.4, 5.6, 17.3, 3.9, 8.8, 18.2, 10.1, 1.2, -4.6, 22.4, 12.8, 6.9, 14.1, 11.0, -1.9, 16.5, 9.9];
write('sixty-forty-is-back', 'storyboard.json', JSON.stringify(film('The 60/40 portfolio is back', [
  open('The long view', 'The 60/40 portfolio is back'),
  canvas('yield', 9, 'For the first time in over a decade, bonds pay a real income again: a ten-year yield above four percent.', { stat: {
    kicker: 'Ten-year government bond yield', value: 4.3, decimals: 1, suffix: '%', label: 'Bonds pay a real income again', source, asOf,
    change: { value: 2.8, decimals: 1, suffix: ' pts', context: 'vs five years earlier', good: 'up' } } }),
  canvas('rolling', 9, 'That matters, because a balanced portfolio’s returns have tracked the yield it started with.', { plot: {
    title: 'Balanced returns follow the starting yield', source, asOf,
    x: { type: 'date', label: 'Year', domain: [ye(2000), ye(2025)], dateFormat: 'year', ticks: [ye(2000), ye(2010), ye(2025)] },
    y: { type: 'linear', label: 'Percent', domain: [0, 10], ticks: [0, 5, 10], suffix: '%' },
    series: [
      { id: 'start-yield', label: 'Starting bond yield', values: years(2000, 2025).map((y, i) => ({ x: ye(y), y: Math.round((6.2 - i * 0.22 + (y > 2021 ? (y - 2021) * 0.9 : 0)) * 10) / 10 })) },
      { id: 'next-ten', label: 'Next 10 years, 60/40', values: years(2000, 2015).map((y, i) => ({ x: ye(y), y: Math.round((7.4 - i * 0.24 + Math.sin(i) * 0.6) * 10) / 10 })) },
    ], motion: { at: 0.6, duration: 4 } } }),
  canvas('years', 8, 'Twenty twenty-two was the exception that made headlines: stocks and bonds fell together.', { bars: {
    title: 'A bad year, not a broken idea', unit: '60/40 calendar-year return', source, asOf, suffix: '%', decimals: 0,
    values: sixtyForty.slice(-10).map((value, i) => ({ label: String(2016 + i), value, highlight: 2016 + i === 2022 })),
    domain: [-20, 30], ticks: [-20, 0, 10, 20, 30], reference: { value: 8.3, label: 'Average' } } }),
  canvas('odds', 8, 'Across twenty-six years, only four ended lower.', { distribution: {
    title: 'How often a balanced year ends in each range', unit: '60/40 calendar-year returns, 2000–2025', source, asOf,
    observations: sixtyForty, edges: [-20, -10, 0, 10, 20, 30], suffix: '%',
    threshold: { value: 0, relation: 'lt', label: 'Losing years' }, marker: { value: sixtyForty.at(-1), label: '2025' } } }),
  close('Balance is back'),
]), null, 1) + '\n');
write('sixty-forty-is-back', 'brief.md', brief('The 60/40 portfolio is back', `
**Stage:** storyboard. Every scene is designed and sourced; nothing has been rendered yet.

**Next step:** review the boards, then record a draft voice and render a rough cut.
`));

// ---------------------------------------------------------------- 4. rough cut
write('bull-markets-outlast-bears', 'storyboard.json', JSON.stringify(film('Bull markets outlast bears', [
  open('The long view', 'Bull markets outlast bears'),
  canvas('averages', 9, 'Since nineteen fifty, the average bull market has run about five years. The average bear, about fourteen months.', { stat: {
    kicker: 'Average bull market since 1950', value: 64, suffix: ' months', label: 'Bear markets have averaged about fourteen months', source, asOf } }),
  canvas('cycles', 9, 'Line them up and the pattern is plain: long climbs, short falls.', { bars: {
    title: 'Long climbs, short falls', unit: 'Length of each market cycle, months', source, asOf, orientation: 'horizontal',
    values: [['1950s bull', 86], ['1960s bull', 74], ['1970s bear', 21], ['1980s bull', 60], ['2000s bear', 31], ['2009 bull', 132], ['2020 bear', 1], ['2022 bear', 9]]
      .map(([label, value]) => ({ label, value, highlight: label.includes('bear') })), domain: [0, 140], ticks: [0, 70, 140], colors: 'single' } }),
  { id: 'log-chart', block: 'statement', duration: 8, vo: 'On a log scale, every bear market since nineteen fifty is a dip in a rising line.',
    placeholder: 'Line chart: the index since 1950 on a log scale, bear markets shaded', props: { title: 'Every bear market since 1950' } },
  close('Time in the market'),
]), null, 1) + '\n');
write('bull-markets-outlast-bears', 'brief.md', brief('Bull markets outlast bears', `
**Stage:** rough cut. The film plays end to end; the long-history chart is still a placeholder slate.

**Next step:** replace the placeholder with a log-scale line chart and recording-quality narration, then render a draft for review.
`));

// ---------------------------------------------------------------- 5. final
const growth = (rate, shock = {}) => years(2000, 2025).reduce((a, y) => [...a, { x: ye(y), y: Math.round(a.at(-1).y * (1 + (shock[y] ?? rate)) * 10) / 10 }], [{ x: ye(1999), y: 100 }]).slice(1);
write('cash-is-not-as-safe', 'storyboard.json', JSON.stringify(film('Cash is not as safe as it looks', [
  open('The long view', 'Cash is not as safe as it looks'),
  canvas('erosion', 9, 'Cash never drops in price. But after inflation, a hundred dollars held since two thousand buys about half as much today.', { plot: {
    title: 'Inflation quietly erodes cash', source, asOf, area: true,
    x: { type: 'date', label: 'Year', domain: [ye(2000), ye(2025)], dateFormat: 'year', ticks: [ye(2000), ye(2010), ye(2025)] },
    y: { type: 'linear', label: 'Purchasing power of $100', domain: [40, 100], ticks: [40, 60, 80, 100], prefix: '$' },
    series: [{ id: 'cash', label: '$100 held in cash', values: years(2000, 2025).map(y => ({ x: ye(y), y: Math.round(100 / Math.pow(1.027, y - 2000) * 10) / 10 })) }],
    motion: { at: 0.6, duration: 4 } } }),
  canvas('real-growth', 9, 'Measured in what money can buy, stocks and even bonds have done far better.', { multiples: {
    title: 'What $100 could buy, after inflation', unit: 'Real value of $100, 2000–2025', source, asOf,
    x: { type: 'date', label: 'Year', domain: [ye(2000), ye(2025)], dateFormat: 'year', ticks: [ye(2000), ye(2025)] },
    y: { type: 'linear', label: 'Real value', domain: [40, 360], ticks: [40, 360] },
    series: [
      { id: 'stocks', label: 'Stocks', values: growth(0.052, { 2001: -0.14, 2002: -0.22, 2008: -0.38, 2022: -0.24 }) },
      { id: 'bonds', label: 'Bonds', values: growth(0.016, { 2022: -0.19 }) },
      { id: 'cash', label: 'Cash', values: growth(-0.004) },
    ], highlight: 'cash' } }),
  canvas('real-return', 7, 'Over the whole stretch, cash returned slightly less than inflation each year.', { stat: {
    kicker: 'Real return on cash, 2000–2025', value: -0.4, decimals: 1, suffix: '% a year', label: 'After inflation, cash slowly lost ground', source, asOf,
    change: { value: -0.4, decimals: 1, suffix: ' pts', context: 'below inflation each year', good: 'up' } } }),
  close('Safe is not the same as stable'),
]), null, 1) + '\n');
write('cash-is-not-as-safe', 'brief.md', brief('Cash is not as safe as it looks', `
**Stage:** final. Rendered at delivery quality; notes resolved.
`));

console.log('wrote 5 films in examples/timmer-takes/');
