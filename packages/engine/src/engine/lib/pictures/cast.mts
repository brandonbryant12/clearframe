import type { Spoken, CastSuggestion } from './contracts.mjs';

/** Calendar pages for months counted, landing on each number's word. */
export function monthsCast(
  text: string,
  spoken: Spoken,
): CastSuggestion | null {
  const N =
    '(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
  const months = text.match(
    new RegExp(`\\b${N}(?:\\s+(?:to|or)\\s+${N})?\\s+months?\\b`, 'i'),
  );
  if (!months) return null;
  const count = (w: string): number => Number(spoken([w]));
  const upper: string | undefined = months[2];
  const lo = count(months[1]),
    hi = upper ? count(upper) : null;
  if (!(lo >= 1 && lo <= 12 && (hi == null || (hi > lo && hi <= 12))))
    return null;
  const n = hi ?? lo,
    ids = Array.from({ length: n }, (_, i) => `month-${i + 1}`);
  return {
    cast: {
      fresh: true,
      objects: ids.map((id, i) => ({
        id,
        shape: 'calendar',
        color: i < lo ? 'accent' : 'accent2',
        size: n <= 6 ? 150 : 110,
        enter: 'pop',
      })),
      formations: [
        { form: 'row', say: months[1], ids: ids.slice(0, lo) },
        ...(hi && upper ? [{ form: 'row', say: upper, ids }] : []),
      ],
    },
  };
}

/**
 * A cast ready to paste for the two podcast pictures that come up most: months counted
 * ("three to six months of expenses": calendar pages that land on each number's word) and money
 * kept apart ("keep it separate": coins travel from an everyday jar into their own). Null otherwise.
 */
export function castFor(vo: unknown, spoken: Spoken): CastSuggestion | null {
  const text = String(vo);
  return monthsCast(text, spoken) ?? astrayCast(text) ?? apartCast(text);
}

// Mail that reaches the wrong person ("27 emails went to the wrong person"): the envelope leaves
// you, passes the client and lands with someone else.
export function astrayCast(text: string): CastSuggestion | null {
  const astray = text.match(
    /\b(wrong (person|people|inbox(es)?|recipients?|address(es)?|client)|misdirected|misaddressed|sent to the wrong)\b/i,
  );
  if (astray) {
    return {
      cast: {
        fresh: true,
        objects: [
          { id: 'you', shape: 'person', color: 'ink', label: 'You', size: 250 },
          {
            id: 'client',
            shape: 'person',
            color: 'positive',
            label: 'Client',
            size: 250,
          },
          {
            id: 'stranger',
            shape: 'person',
            color: 'negative',
            label: 'Wrong person',
            size: 250,
          },
          { id: 'mail', shape: 'envelope', color: 'accent2', size: 150 },
        ],
        formations: [
          { form: 'row', at: 0, ids: ['you', 'client', 'stranger'] },
          { form: 'cluster', at: 0.3, ids: ['mail'], beside: 'you' },
          {
            form: 'travel',
            say: astray[1].split(/\s+/).pop(),
            ids: ['mail'],
            to: 'stranger',
          },
        ],
      },
    };
  }
  return null;
}

// Money kept apart: coins travel from an everyday jar into their own.
export function apartCast(text: string): CastSuggestion | null {
  const apart = text.match(/\b(separate|aside|its own|different account)\b/i);
  if (apart) {
    const coins = ['coin-1', 'coin-2', 'coin-3', 'coin-4'];
    return {
      cast: {
        fresh: true,
        objects: [
          {
            id: 'everyday',
            shape: 'jar',
            color: 'muted',
            label: 'Everyday',
            size: 240,
          },
          {
            id: 'saved',
            shape: 'jar',
            color: 'positive',
            label: 'Kept apart',
            size: 240,
          },
          ...coins.map((id) => ({
            id,
            shape: 'coin',
            color: 'accent',
            size: 80,
          })),
        ],
        formations: [
          { form: 'row', at: 0, ids: ['everyday', 'saved'] },
          { form: 'cluster', at: 0.3, ids: coins, beside: 'everyday' },
          {
            form: 'merge',
            say: apart[1].split(/\s+/)[0],
            ids: coins,
            into: 'saved',
          },
        ],
      },
    };
  }
  return null;
}
