import { BLOCKS } from '../catalog.mjs';
import { items } from '../library.mjs';
import { ICONS } from '../icons.mjs';
import { entries } from './catalog.mjs';
import { MOVES } from './cast-examples.mjs';
import { MECHANISMS } from './mechanisms.mjs';
import { clean } from './documents.mjs';
import { sketchExample } from './sketches.mjs';
import type { DiscoveryEntry, DiscoveryDetail } from './contracts.mjs';
/** One line per entry: `kind:name — what it is (when).` */
export const line = (e: DiscoveryEntry): string =>
  `${e.id} — ${e.about || e.title}${e.when && e.when !== e.about ? ` · when: ${e.when.slice(0, 140)}` : ''}${e.kind === 'sketch' && e.needs.includes('sketch') ? ` · fill: ${e.needs.split('; ').slice(1).join('; ')}` : ''}`;

/** Exact authoring details for one entry: how to use it, a copyable example where one exists, its reference. */
export async function detail(id: string): Promise<DiscoveryDetail> {
  const e = entries().find((x) => x.id === id || x.name === id);
  if (!e) throw new Error(`No library entry ${id}. Search with find first.`);
  const out: DiscoveryDetail = {
    id: e.id,
    title: e.title,
    about: e.about,
    when: e.when,
    needs: e.needs,
    ref: e.ref,
  };
  if (e.kind === 'block') blockDetail(e, out);
  else if (e.kind === 'sketch') sketchDetail(e, out);
  else if (e.kind === 'playbook') playbookDetail(e, out);
  else if (e.kind === 'cast-shape') castObjectDetail(e, out);
  else if (e.kind === 'cast-look') castLookDetail(e, out);
  else if (e.kind === 'cast-move') castMoveDetail(e, out);
  else if (e.kind === 'mechanism') mechanismDetail(e, out);
  else libraryDetail(e, out);
  return out;
}

function blockDetail(e: DiscoveryEntry, out: DiscoveryDetail): void {
  const b = BLOCKS.find((x) => x.name === e.name);
  if (!b) throw new Error(`Missing block ${e.name}`);
  Object.assign(out, {
    props: Object.keys(b.props ?? {}),
    example: { block: b.name, props: b.example },
  });
}

function sketchDetail(e: DiscoveryEntry, out: DiscoveryDetail): void {
  // Its placeholder type and named moments, so the example shows what to fill.
  const example = sketchExample(e.name);
  out.example = example;
  const cues = Object.keys(example.props.sketchSay ?? {});
  out.note = `clearframe sketch ${e.name} prints the elements to adapt.${cues.length ? ' sketchSay lands each named moment on a word of the narration.' : ''}${example.props.sketchParams ? ' sketchParams sets the numbers it draws.' : ''}`;
}

function playbookDetail(e: DiscoveryEntry, out: DiscoveryDetail): void {
  const p = items('playbooks').find((x) => x.id === e.name);
  if (!p) throw new Error(`Missing playbook ${e.name}`);
  out.scenes = p.beats.map(
    (b) =>
      `${b.id} (${b.block}${b.props?.sketch ? `: ${b.props.sketch}` : ''})${b.vo ? `: ${clean(b.vo).slice(0, 80)}` : ''}`,
  );
  out.use = `clearframe new DIR --playbook ${e.name}  (studio: the playbook command)`;
}

function castObjectDetail(e: DiscoveryEntry, out: DiscoveryDetail): void {
  out.example = {
    block: 'canvas',
    props: {
      cast: {
        look: 'drawn',
        objects: [{ id: 'one', shape: e.name, color: 'accent' }],
        formations: [{ form: 'hero', hero: 'one', at: 0 }],
      },
    },
  };
}

function castLookDetail(e: DiscoveryEntry, out: DiscoveryDetail): void {
  out.example = {
    block: 'canvas',
    props: {
      cast: {
        look: e.name,
        objects: [
          { id: 'a', shape: 'server', color: 'accent' },
          { id: 'b', shape: 'database', color: 'accent2' },
          { id: 'c', shape: 'cloud', color: 'surface' },
        ],
        formations: [{ form: 'line', at: 0, thread: true }],
      },
    },
  };
}

function castMoveDetail(e: DiscoveryEntry, out: DiscoveryDetail): void {
  out.example =
    MOVES[e.name] ??
    MOVES[e.name === 'row' || e.name === 'column' ? 'line' : e.name];
  out.note =
    'Moves go in props.cast.formations, cued with say (a spoken word) or at (seconds); docs/cast.md lists every field.';
}

function mechanismDetail(e: DiscoveryEntry, out: DiscoveryDetail): void {
  const m = MECHANISMS.find((x) => x[0] === e.name);
  if (m?.[5]) out.example = m[5];
  if (e.name === 'icons') out.names = ICONS;
}

function libraryDetail(e: DiscoveryEntry, out: DiscoveryDetail): void {
  switch (e.kind) {
    case 'type':
      out.item = items('types').find((x) => x.id === e.name);
      break;
    case 'palette':
      out.item = items('palettes').find((x) => x.id === e.name);
      break;
    case 'treatment':
      out.item = items('treatments').find((x) => x.id === e.name);
      break;
    case 'direction':
      out.item = items('directions').find((x) => x.id === e.name);
      break;
  }
}
