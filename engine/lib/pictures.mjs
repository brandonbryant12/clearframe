// Fill-in-the-blank pictures for what workplace narration keeps saying (clearframe-workplace).
const PICTURES = [
  [/\b((lower|higher|lowest|highest|cheaper) of (the )?(two|both)|whichever (\w+ ){0,3}(is |was )?(lower|higher|cheaper)|starts? at .* (ends?|goes) (at|to))\b/i, null, 'This line compares prices or values over time', 'a canvas `chart` `bars` with a `say` on each value as it is said (the start, the end, what you pay), the one that counts highlighted'],
  [/\b(carr(y|ies) over|use it or lose it|forfeit|resets? to (zero|\$?0)|expires?|lose (it|the rest))\b/i, 'expire', 'This line is about what carries over and what is lost'],
  [/\bvest(s|ed|ing)?\b|\byours to keep\b.*\byears?\b|\bafter (one|two|three|\d) years?\b/i, 'vesting', 'This line is about what becomes yours over time'],
  [/\b(match(es|ing)?|adds?|puts? in|on top of|top[- ]up|contributes? the same)\b.*(\b(percent|dollars?)\b|[%$])|\b(percent|%).*\b(match(es)?|adds?)\b/i, 'match', 'This line is about one contribution added to another'],
  [/\b((by|before|on) (monday|tuesday|wednesday|thursday|friday)|this week|first week|by the end of the week)\b/i, 'week', 'This line names days of one week'],
  [/\b(deadline|by (january|february|march|april|may|june|july|august|september|october|november|december)|(on|by) the \d{1,2}(st|nd|rd|th)|between .* and .*\b\d{1,2}\b|open enrollment runs|within \d+ days|\d+ days (from|after|to)|last day)\b/i, 'deadline', 'This line names a window or a deadline'],
  [/\b(log ?in|sign(s|ed)? in|portal|open the app|in the app|click|tap|select|go to|toolbar|button)\b/i, 'portal', 'This line is a step done in an app'],
  [/\b(look for|signs\b(?! in)|sign of|tells?|red flags?|watch for|check (the|for)|itemi[sz]ed)\b/i, 'inspect', 'This line points at parts of a message or document'],
  [/\b(or the|versus|vs\.?|compared? (to|with)|which one|either|instead of)\b/i, 'choose', 'This line compares two options'],
  [/\b(breaks? down|split|of your (pay|paycheck)|where (your|the) money goes|take[- ]home|goes (to|into) (your|the) (\w+ )?(account|fund|plan|savings|taxes|pension))\b/i, 'split', 'This line divides a whole into parts'],
  [/\b(compound(s|ing)?|grows? (to|over|every)|start(ing)? early|over (\w+ )?(\d+|ten|twenty|thirty|forty) years|by the time you retire)\b/i, 'growth', 'This line is about money growing over years'],
  [/\b(lock(ed|s)? (in|your)|rate lock|guarantee[ds]?|fixed (rate|price|premium)|whatever the market)\b/i, 'hold', 'This line is about a value that holds while the market moves'],
  [/\b((one|two|three|four|five|six|\d+)( to (three|six|nine|twelve|\d+))? months? of)\b/i, null, 'This line counts months', 'a `cast` of `calendar` tiles, one per month, that appear as the months are said (docs/cast.md)'],
  [/\b(inflation|buys? (about )?\w+ (percent )?less|loses? (value|purchasing power))\b/i, null, 'This line is about money shrinking in value', 'a canvas `chart` `number` that steps down through the values as they are said (a `say` on each), or a `jar` cast that empties a little on the word'],
  [/\b(separate|its own account|a different account|set (it )?aside|out of sight)\b/i, null, 'This line is about keeping money apart', 'a `cast` with two `jar`s (or a `jar` and a `paycheck`): coins move into their own jar on the word'],
  // Last: a figure said out loud, whatever it is about.
  [/\b(hundred|thousand|million|billion) (dollars|pounds|euros)\b|\$\s?\d|\b\w+ percent\b|\d+(\.\d+)?%/i, null, 'This line says a figure', 'a canvas `chart` `number` that lands on the figure as it is said (a `say` on the value; several figures step through), with what it counts as its label'],
];
/** The picture that fits a line of narration: a sketch, or a recipe when no sketch does. */
export function pictureFor(vo) {
  for (const [re, sketch, why, use] of PICTURES) if (re.test(vo)) return { sketch, why, use };
  return null;
}

const NUMBER_WORD = /^(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|and|point)$/;
/**
 * The figures a line says, in order, each with the word it starts on (for a value's `say`):
 * "starts at forty dollars, goes to fifty, you pay thirty-four" → 40, 50, 34. Small counts
 * (one to ten, said alone) are left out: they are usually not figures.
 */
export function figuresIn(vo, spoken) {
  const tokens = String(vo).split(/\s+/).filter(Boolean), out = [];
  for (let i = 0; i < tokens.length; i++) {
    const clean = t => t.toLowerCase().replace(/[^a-z0-9.$%-]/g, '').replace(/[.]+$/, '');
    const first = clean(tokens[i]);
    const isNum = t => /\d/.test(t) || t.split('-').every(p => NUMBER_WORD.test(p) && p !== 'and' && p !== 'point');
    if (!first || !isNum(first)) continue;
    let j = i + 1;
    while (j < tokens.length && (isNum(clean(tokens[j])) || /^(and|point)$/.test(clean(tokens[j])))) j++;
    const phrase = tokens.slice(i, j), after = clean(tokens[j] ?? '');
    const said = spoken(phrase.map(clean)).split(/\s+/)[0] ?? '';
    const value = Number(said.replace(/[$,%]/g, ''));
    if (Number.isFinite(value) && !(value <= 10 && Number.isInteger(value) && !/[$%]/.test(phrase.join(' ') + after) && !/^(percent|dollars?|points?)$/.test(after)))
      out.push({ value, say: tokens[i].replace(/[^\p{L}\p{N}$%.-]/gu, '').replace(/[.]$/, ''), prefix: /\$/.test(phrase.join(' ')) || /^dollars?$/.test(after) ? '$' : '', suffix: /%/.test(phrase.join(' ')) || after === 'percent' ? '%' : '' });
    i = j - 1;
  }
  // A range said once with its scale ("twelve to eighteen thousand dollars") scales both ends.
  for (let k = 0; k + 1 < out.length; k++) {
    const a = out[k], b = out[k + 1];
    if (b.value >= 1000 && a.value < 1000 && a.value * 1000 <= b.value * 2 && new RegExp(`\\b${a.say}\\s+(to|or|and)\\s+${b.say}`, 'i').test(vo))
      a.value *= b.value >= 1e6 && a.value * 1e6 <= b.value * 2 ? 1e6 : 1000;
  }
  return out;
}

/** A canvas beat's chart for a line's figures, ready to paste: one figure is a number, several are bars. */
export function chartFor(vo, spoken) {
  const f = figuresIn(vo, spoken).slice(0, 6);
  if (!f.length) return null;
  // One currency or percent sign said once ("forty dollars, fifty, thirty-four") covers the set.
  const prefix = f.some(x => x.prefix === '$') && !f.some(x => x.suffix) ? '$' : '', suffix = f.some(x => x.suffix === '%') && !f.some(x => x.prefix) ? '%' : '';
  return {
    kind: f.length === 1 ? 'number' : 'bars',
    ...(prefix ? { prefix } : {}),
    ...(suffix ? { suffix } : {}),
    values: f.map((x, i) => ({ label: `WHAT ${i + 1} IS`, value: x.value, say: x.say })),
  };
}
