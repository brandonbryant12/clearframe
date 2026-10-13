// Fill-in-the-blank pictures for what workplace narration keeps saying (clearframe-workplace).
const PICTURES = [
  [/\b(carr(y|ies) over|use it or lose it|forfeit|resets? to (zero|\$?0)|expires?|lose (it|the rest))\b/i, 'expire', 'This line is about what carries over and what is lost'],
  [/\b(match(es|ing)?|adds?|puts? in|on top of|top[- ]up|contributes? the same)\b.*(\b(percent|dollars?)\b|[%$])|\b(percent|%).*\b(match(es)?|adds?)\b/i, 'match', 'This line is about one contribution added to another'],
  [/\bvest(s|ed|ing)?\b|\byours to keep\b.*\byears?\b|\bafter (one|two|three|\d) years?\b/i, 'vesting', 'This line is about what becomes yours over time'],
  [/\b(deadline|by (january|february|march|april|may|june|july|august|september|october|november|december)|between .* and .*\b\d{1,2}\b|open enrollment runs|within \d+ days|last day)\b/i, 'deadline', 'This line names a window or a deadline'],
  [/\b(log ?in|portal|open the app|in the app|click|tap|select|go to|toolbar|button)\b/i, 'portal', 'This line is a step done in an app'],
  [/\b(look for|signs?|tells?|red flags?|watch for|check (the|for)|itemi[sz]ed)\b/i, 'inspect', 'This line points at parts of a message or document'],
  [/\b((lower|higher|lowest|highest|cheaper) of (the )?(two|both)|whichever (\w+ ){0,3}(is |was )?(lower|higher|cheaper)|starts? at .* (ends?|goes) (at|to))\b/i, null, 'This line compares prices or values over time', 'a canvas `chart` `bars` with a `say` on each value as it is said (the start, the end, what you pay), the one that counts highlighted'],
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
