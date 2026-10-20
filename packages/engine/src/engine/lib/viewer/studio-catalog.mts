import { DEFAULTS, PRESETS } from '../project.mjs';
import {
  BLOCKS,
  TRANSITIONS,
  BACKDROPS,
  MOTIONS,
} from '../../../film/catalog.mjs';
import {
  ENTERS,
  EXITS,
  COLOR_TOKENS,
  ELEMENT_TYPES,
} from '../../../film/canvas.mjs';
import { items } from '../../../film/library.mjs';
import { sketch } from '../../../film/sketches.mjs';
import { ICONS } from '../../../film/icons.mjs';
import { LENS_KEYS } from '../../../film/constants.mjs';
import { FONT_FILES } from './clearframe.mjs';
import {
  SCHEMA,
  BEAT_SCHEMA,
  BEAT_KEYS,
  FILM_KEYS,
} from './studio-properties.mjs';
let described: ReturnType<typeof describeSchema> | null = null;
/** Field contracts for the inspector: schema fields, block props and library choices. */
export function studioSchema(): ReturnType<typeof describeSchema> {
  return (described ??= describeSchema());
}
function describeSchema() {
  const beat = BEAT_SCHEMA.items.properties;
  return {
    film: Object.fromEntries(
      [...FILM_KEYS]
        .filter((k) => SCHEMA.properties[k])
        .map((k) => [k, SCHEMA.properties[k]]),
    ),
    beat: Object.fromEntries(
      [...BEAT_KEYS].filter((k) => beat[k]).map((k) => [k, beat[k]]),
    ),
    blocks: BLOCKS.map((b) => ({
      name: b.name,
      category: b.category,
      summary: b.summary,
      props: b.props,
      example: b.example,
    })),
    palettes: items('palettes').map((p) => ({
      id: p.id,
      colors: p.colors,
      notes: p.notes ?? '',
    })),
    types: items('types').map((t) => ({
      id: t.id,
      title: t.title,
      when: t.when,
    })),
    treatments: items('treatments').map((t) => ({
      id: t.id,
      title: t.title,
      when: t.when,
    })),
    sketches: items('sketches').map((s) => {
      let art = false;
      try {
        art = !!sketch(s.id).layer;
      } catch {}
      return { id: s.id, summary: s.summary, use: s.use, art };
    }),
    canvas: {
      types: Object.keys(ELEMENT_TYPES),
      geometry: Object.fromEntries(
        Object.entries(ELEMENT_TYPES).map(([k, v]) => [k, v.geometry]),
      ),
      enters: ENTERS,
      exits: EXITS,
      colors: COLOR_TOKENS,
      fonts: Object.keys(FONT_FILES),
      icons: ICONS,
    },
    transitions: TRANSITIONS,
    backdrops: BACKDROPS,
    motions: MOTIONS,
    lens: { keys: LENS_KEYS },
    defaults: DEFAULTS,
    presets: PRESETS,
  };
}
