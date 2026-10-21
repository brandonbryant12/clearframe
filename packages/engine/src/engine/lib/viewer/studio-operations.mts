import * as Schema from 'effect/Schema';
import type { Beat, Storyboard } from '../../domain.mjs';
import { decodeStoryboard, BeatSchema } from '../../schemas.mjs';
import { PRESETS } from '../project.mjs';
import { blockByName } from '../../../film/catalog.mjs';
import { applyTreatment } from '../../../film/treatments.mjs';
import { sketch, sketchPreset } from '../../../film/sketches.mjs';
import { storyboardFor } from '../../../film/playbooks.mjs';
import type { StudioOperation } from './studio-contracts.mjs';
import { narrationOf } from './studio-analysis.mjs';
import { fail } from './studio-history.mjs';
import {
  BEAT_KEYS,
  FILM_KEYS,
  parts,
  checkValue,
  setAt,
} from './studio-properties.mjs';
export { touchesBudget } from './studio-properties.mjs';
const uniqueId = (sb: Storyboard, base: unknown) => {
  const stem =
    String(base)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'scene';
  let id = stem,
    n = 2;
  while (sb.beats.some((b) => b.id === id)) id = `${stem}-${n++}`;
  return id;
};
export const nameOf = (b: Beat) =>
  b.label || b.props?.title || b.props?.text || b.id;
export const short = (value: unknown): string => {
  const s = String(value ?? '');
  return s.length > 40 ? `${s.slice(0, 38)}…` : s;
};

const beatOf = (sb: Storyboard, id: string | undefined) => {
  const b = sb.beats.find((x) => x.id === id);
  if (!b) throw fail('That scene no longer exists.');
  return b;
};
function setFilm(sb: Storyboard, p: string[], value: unknown) {
  if (!FILM_KEYS.has(p[0]))
    throw fail(`The studio does not edit “${p[0]}” for the whole film.`);
  if (
    p[0] === 'title' &&
    (typeof value !== 'string' || !value.trim() || value.length > 300)
  )
    throw fail('A film needs a title shorter than 300 characters.');
  if (
    p[0] === 'budget' &&
    (p.length > 1 ||
      (value != null &&
        !(
          typeof value === 'number' &&
          Number.isFinite(value) &&
          value >= 0 &&
          value <= 1000
        )))
  )
    throw fail(
      'The film budget is an amount in dollars between 0 and 1000 (empty for none).',
    );
  setAt(sb, p, value);
  return `${value == null ? 'Clear' : 'Set'} film ${p.join(' ')}`;
}
function checkNarration(dir: string, b: Beat, value: unknown) {
  const narration = narrationOf(dir, b);
  if (narration.kind === 'recording')
    throw fail(
      'This narration is the recording itself: select words in the narration lane and cut them instead.',
    );
  if (narration.kind === 'imported')
    throw fail(
      'This narration was imported with its audio; re-import it with `speech` to change the words.',
    );
  if (value != null && typeof value !== 'string')
    throw fail('Narration is text.');
}
function checkBeatValue(dir: string, b: Beat, p: string[], value: unknown) {
  if (p[0] === 'vo') checkNarration(dir, b, value);
  if (
    p[0] === 'duration' &&
    value != null &&
    !(
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0.1 &&
      value <= 3600
    )
  )
    throw fail('Duration must be between 0.1 and 3600 seconds.');
  if (
    p[0] === 'label' &&
    value != null &&
    (typeof value !== 'string' || value.length > 40)
  )
    throw fail('A scene label is up to 40 characters.');
}
function setBeat(
  dir: string,
  sb: Storyboard,
  op: StudioOperation,
  p: string[],
  value: unknown,
) {
  const b = beatOf(sb, op.beat),
    name = short(nameOf(b));
  if (!BEAT_KEYS.has(p[0]))
    throw fail(`The studio does not edit “${p[0]}” on a scene.`);
  const block = blockByName(b.block ?? '');
  if (
    p[0] === 'props' &&
    p.length > 1 &&
    b.block !== 'stage' &&
    block &&
    !(p[1] in block.props)
  )
    throw fail(`A ${b.block} scene has no “${p[1]}” property.`);
  checkBeatValue(dir, b, p, value);
  setAt(b, p, value);
  return `${value == null ? 'Clear' : 'Change'} ${p.filter((x) => !/^\d+$/.test(x) && x !== 'props').join(' ')} in ${name}`;
}
function setField(dir: string, sb: Storyboard, op: StudioOperation) {
  const target =
      op.target ??
      (op.command === 'film.set' || op.beat == null ? 'film' : 'beat'),
    p = parts(op.path ?? op.field);
  const value = op.value === undefined ? null : op.value;
  checkValue(value);
  return target === 'film'
    ? setFilm(sb, p, value)
    : setBeat(dir, sb, op, p, value);
}
function moveBeat(_dir: string, sb: Storyboard, op: StudioOperation) {
  const i = sb.beats.findIndex((x) => x.id === op.beat);
  const j = op.to ?? i + (op.direction ?? 0);
  if (i < 0 || !Number.isInteger(j) || j < 0 || j >= sb.beats.length)
    throw fail('Cannot move the scene there.');
  const [b] = sb.beats.splice(i, 1);
  sb.beats.splice(j, 0, b);
  return `Move ${short(nameOf(b))}`;
}

function createBeat(sb: Storyboard, op: StudioOperation): Beat {
  let beat: Beat;
  if (op.sketch) {
    const f = sb.format ?? {},
      preset =
        Object.entries(PRESETS).find(([key]) => key === f.preset)?.[1] ??
        PRESETS.landscape;
    const props = sketch(
      op.sketch,
      sketchPreset(f.width ?? preset.width, f.height ?? preset.height),
    );
    if (props.layer)
      throw fail(
        `${op.sketch} is scenery: add it to a scene as background art instead.`,
      );
    beat = Schema.decodeUnknownSync(BeatSchema)({
      id: op.id ?? uniqueId(sb, op.sketch),
      block: 'canvas',
      label: short(op.sketch),
      props,
    });
  } else {
    const meta = blockByName(op.block ?? '');
    if (!meta) throw fail(`No native block “${op.block}”.`);
    // A new scene is silent (kinetic type needs words to follow) and has no duration of its own:
    // it plays for the film's silent-scene length until its narration sets the length, and a
    // duration anyone sets later is theirs, whatever its value.
    beat = Schema.decodeUnknownSync(BeatSchema)({
      id: op.id ?? uniqueId(sb, op.block),
      block: op.block,
      label: short(meta.name[0].toUpperCase() + meta.name.slice(1)),
      ...(op.block === 'kinetic'
        ? { vo: 'Write the line these words follow.' }
        : {}),
      props: structuredClone(meta.example),
    });
    // Catalog examples carry the sample-source line; numbers need a matching sources entry to render.
    if (
      meta.example.source &&
      !(sb.sources ?? []).some((s) => s.title === meta.example.source)
    )
      sb.sources = [
        ...(sb.sources ?? []),
        { id: uniqueSource(sb), title: meta.example.source },
      ];
  }
  return beat;
}
function insertBeat(_dir: string, sb: Storyboard, op: StudioOperation) {
  const i =
    op.after == null
      ? sb.beats.length
      : sb.beats.findIndex((x) => x.id === op.after) + 1;
  if (op.after != null && i === 0) throw fail('That scene no longer exists.');
  // A chosen id lets later operations in the same batch fill the new scene.
  if (
    op.id != null &&
    (typeof op.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(op.id))
  )
    throw fail(
      'A scene id is lowercase letters, digits and dashes (up to 40).',
    );
  if (op.id != null && sb.beats.some((x) => x.id === op.id))
    throw fail(`There is already a scene “${op.id}”.`);
  const beat = createBeat(sb, op);
  sb.beats.splice(i, 0, beat);
  op.created = beat.id;
  return `Add ${op.sketch ? `${op.sketch} drawing` : `${op.block} scene`}`;
}

function duplicateBeat(dir: string, sb: Storyboard, op: StudioOperation) {
  const b = beatOf(sb, op.beat),
    n = narrationOf(dir, b);
  if (['recording', 'imported'].includes(n.kind))
    throw fail(
      'A recorded passage plays once; duplicate the picture into a new scene without narration instead.',
    );
  const copy = { ...structuredClone(b), id: uniqueId(sb, `${b.id}-copy`) };
  sb.beats.splice(sb.beats.indexOf(b) + 1, 0, copy);
  op.created = copy.id;
  return `Duplicate ${short(nameOf(b))}`;
}

function deleteBeat(dir: string, sb: Storyboard, op: StudioOperation) {
  const b = beatOf(sb, op.beat),
    n = narrationOf(dir, b);
  if (sb.beats.length < 2) throw fail('A film keeps at least one scene.');
  if (n.kind === 'recording')
    throw fail(
      'This scene plays the recording: cut its words (the scene goes when its last word does) so the cut can be undone exactly.',
    );
  sb.beats.splice(sb.beats.indexOf(b), 1);
  return `Delete ${short(nameOf(b))}`;
}

function applyPlaybook(dir: string, sb: Storyboard, op: StudioOperation) {
  // Start the film over from a playbook that fits its material: the playbook's scenes (sample
  // content, cited as such) and look, keeping this film's title, format, voice and sources.
  if (
    sb.beats.some((b) =>
      ['recording', 'imported'].includes(narrationOf(dir, b).kind),
    )
  )
    throw fail(
      'This film plays recorded narration and its scenes follow the recording; a playbook cannot replace them.',
    );
  let fresh;
  try {
    fresh = decodeStoryboard(
      storyboardFor(String(op.id ?? ''), {
        title: sb.title,
        vertical: sb.format?.preset === 'vertical',
      }),
    );
  } catch {
    throw fail(
      `No playbook “${op.id}”. clearframe_catalog topic playbooks lists them.`,
    );
  }
  sb.beats = fresh.beats;
  for (const k of [
    'theme',
    'type',
    'motion',
    'transition',
    'backdrop',
    'texture',
    'lens',
    'camera',
    'heading',
    'textMotion',
  ] as const)
    if (fresh[k] !== undefined) Object.assign(sb, { [k]: fresh[k] });
    else delete sb[k];
  const ids = new Set((sb.sources ?? []).map((s) => s.id));
  sb.sources = [
    ...(sb.sources ?? []),
    ...(fresh.sources ?? []).filter((s) => !ids.has(s.id)),
  ];
  // A film stage spans the scenes it was drawn for; those scenes are gone, so it goes with them.
  const beats = new Set(sb.beats.map((b) => b.id)),
    stages = (sb.stages ?? []).filter(
      (s) =>
        typeof s.from === 'string' &&
        typeof s.to === 'string' &&
        beats.has(s.from) &&
        beats.has(s.to),
    );
  const dropped = (sb.stages ?? []).length - stages.length;
  if (stages.length) sb.stages = stages;
  else delete sb.stages;
  const noun = dropped > 1 ? 'stages' : 'stage';
  const removed = dropped
    ? ` (removing ${dropped} ${noun} drawn for the old scenes)`
    : '';
  return `Start from the ${op.id} playbook${removed}`;
}

function treatFilm(dir: string, sb: Storyboard, op: StudioOperation) {
  const recording = sb.beats.some(
    (b) => narrationOf(dir, b).kind === 'recording',
  );
  if (typeof op.id !== 'string' || !op.id) throw fail('Choose a treatment id.');
  applyTreatment(sb, op.id, { recording });
  return `Apply the ${op.id} treatment`;
}
const uniqueSource = (sb: Storyboard) => {
  let n = 1;
  while ((sb.sources ?? []).some((s) => s.id === `sample${n > 1 ? n : ''}`))
    n++;
  return `sample${n > 1 ? n : ''}`;
};

/** Apply a checked studio operation to its working copy. */
export function applyOp(
  dir: string,
  sb: Storyboard,
  op: StudioOperation,
): string {
  switch (op.command) {
    case 'set':
    case 'beat.set':
    case 'film.set':
      return setField(dir, sb, op);
    case 'move':
    case 'beat.move':
      return moveBeat(dir, sb, op);
    case 'insert':
      return insertBeat(dir, sb, op);
    case 'duplicate':
      return duplicateBeat(dir, sb, op);
    case 'delete':
      return deleteBeat(dir, sb, op);
    case 'playbook':
      return applyPlaybook(dir, sb, op);
    case 'treatment':
      return treatFilm(dir, sb, op);
    default:
      throw fail('Unknown studio command.');
  }
}
