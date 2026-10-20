import type {
  DiscoveryEntry,
  DiscoveryOptions,
  SearchSynonyms,
} from './contracts.mjs';
import { entries } from './catalog.mjs';
const SYNONYMS: SearchSynonyms = {
  money: 'revenue cost price finance profit payment coin',
  growth: 'increase rise trend grow up',
  process: 'flow pipeline steps sequence queue',
  compare: 'versus comparison before after contrast',
  time: 'timeline history clock deadline latency',
  people: 'person user customer team',
  data: 'database chart numbers metric records',
  idea: 'insight bulb inspiration concept',
  security: 'lock permission privacy vault safe',
  ship: 'delivery truck logistics box',
  bug: 'fix error incident crash',
  launch: 'reveal product milestone flag',
  story: 'narrative journey character',
  calm: 'quiet gentle soft',
  energetic: 'punchy fast bold kinetic',
  retro: 'pixel print vintage lcd',
  playful: 'pixel drawn hand fun',
  premium: 'cinematic gold glass luxury',
  code: 'pull request commit diff editor',
  explain: 'explainer concept teaching how why',
  social: 'vertical short clip hook',
  email: 'envelope message notification',
  server: 'backend infrastructure service cloud',
  faster: 'speed latency delta before after',
  slower: 'latency delay wait delta',
  cheaper: 'cost delta saving',
  percent: 'stat delta kpi figure',
  number: 'stat kpi figure',
  results: 'stat kpi delta proof evidence',
  quarter: 'kpi quarterly update',
  quarterly: 'kpi quarterly update numbers',
  numbers: 'stat kpi bars chart',
  teaser: 'trailer hook reveal',
  thank: 'story personal human',
  api: 'service server request backend architecture system',
  cache: 'database store request service',
  request: 'packet flow service',
  engineer: 'technical system architecture code',
  developer: 'technical code system pull',
  architecture: 'system diagram service',
  sales: 'business customer product',
  customer: 'person user journey',
  team: 'people person',
  handmade: 'paper cut drawn tactile craft',
  tactile: 'paper cut handmade',
  craft: 'paper cut handmade print',
  collage: 'paper cut layered',
  private: 'lock security privacy vault safe',
  input: 'graph curve output',
  output: 'graph curve',
  changes: 'graph sweep curve',
  relationship: 'graph curve',
  curve: 'graph',
  accumulating: 'accumulate total sum',
  accumulate: 'accumulate total',
  adds: 'accumulate total',
  compounding: 'accumulate exponential growth',
  small: 'accumulate steps',
  spread: 'estimate distribution outcomes',
  outcomes: 'estimate spread distribution',
  noisy: 'estimate average measurement',
  uncertainty: 'estimate spread',
  average: 'estimate measurement',
  measurements: 'estimate',
  reliable: 'estimate average',
  reorganize: 'cast regroup formation morph',
  reorganise: 'cast regroup formation morph',
  regroup: 'cast formation',
  flow: 'field particles streamlines',
  flows: 'field particles',
  drift: 'field',
  forces: 'field',
  connect: 'bridge integration link network',
  integration: 'bridge connect link',
  partnership: 'bridge connect people',
  gap: 'bridge',
  guide: 'maze path onboarding',
  confusing: 'maze tangle',
  onboarding: 'maze guide steps',
  navigate: 'maze path route',
  calendar: 'clock time schedule',
  app: 'phone product device screen',
};
const words = (t: unknown): string[] =>
  String(t ?? '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) ?? [];
// Words that say nothing about which picture fits.
const STOP = new Set(
  'a an the and or of to in on for with about our your their we it its is are be this that these those how why what show make made video film clip one two second seconds minute minutes long keep keeps some into from at by as so very just'.split(
    ' ',
  ),
);

/**
 * A short, mixed shortlist for what someone wants to make: at most `perKind` from any one kind so
 * a block, a mechanism, a sketch and a playbook can all surface. Each line says what it is and when
 * it fits; detail(id) gives the exact authoring.
 */
export function find(
  query: string,
  { limit = 8, kinds = null, perKind = 3 }: DiscoveryOptions = {},
) {
  // Plurals read as their singular too ("nights" finds night-shift).
  const q = words(query)
    .filter((w) => !STOP.has(w) && !/^\d+$/.test(w))
    .flatMap((w) =>
      w.length > 3 && w.endsWith('s') && !w.endsWith('ss')
        ? [w, w.slice(0, -1)]
        : [w],
    );
  // A figure in the brief ("40%", "3x", "$2m") asks for the blocks that show one; a length or a count ("30 seconds") does not.
  if (
    /\d\s*(%|x\b|×|percent|times\b|k\b|m\b|bn\b|million|billion)|[$€£]\s*\d/i.test(
      query,
    )
  )
    q.push('number', 'stat', 'delta', 'kpi');
  const terms = new Set(q.flatMap((w) => [w, ...words(SYNONYMS[w])]));
  const scored = entries()
    .filter((e) => !kinds || kinds.includes(e.kind))
    .map((e) => {
      const fields: [string, number][] = [
        [`${e.name} ${e.title}`, 4],
        [e.about, 2],
        [e.when, 2],
        [e.needs, 1],
        [e.kind, 1],
      ];
      let score = 0;
      for (const [text, weight] of fields) {
        const ws = new Set(words(text));
        for (const t of terms)
          if (
            ws.has(t) ||
            (t.length > 4 && [...ws].some((w) => w.startsWith(t)))
          )
            score += q.includes(t) ? weight * 2 : weight;
      }
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const per: Record<string, number> = {},
    out: DiscoveryEntry[] = [];
  for (const { e } of scored) {
    if ((per[e.kind] = (per[e.kind] ?? 0) + 1) > perKind) continue;
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}
