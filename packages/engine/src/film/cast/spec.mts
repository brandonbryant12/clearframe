import { check, own, LOOKS, ENTERS, COLORS } from './common.mjs';
import { OBJECTS } from './objects.mjs';
import type { CastObject, CastSpec } from './contracts.mjs';
import { decodeCast } from './schema.mjs';
import { validateFormation } from './validate-formation.mjs';
function appearance(object: CastObject, index: number): void {
  const at = `objects[${index}]`;
  check(
    object.enter == null || ENTERS.includes(object.enter),
    `${at}.enter is ${ENTERS.join(', ')}`,
  );
  check(
    object.shape == null || Object.hasOwn(OBJECTS, object.shape),
    `${at}.shape is ${Object.keys(OBJECTS).join(', ')}`,
  );
  check(
    object.word == null || (object.word.trim() && object.word.length <= 14),
    `${at}.word is up to 14 characters`,
  );
  check(
    object.color == null || COLORS.includes(object.color),
    `${at}.color is ${COLORS.join(', ')}`,
  );
  check(
    object.label == null || object.label.length <= 20,
    `${at}.label is up to 20 characters`,
  );
  check(
    object.size == null || (object.size >= 48 && object.size <= 360),
    `${at}.size is 48–360 px`,
  );
}
function addObjects(
  input: CastObject[],
  known: Map<string, CastObject>,
): Map<string, CastObject> {
  const objects = new Map(known);
  for (const [index, object] of input.entries()) {
    const at = `objects[${index}]`;
    own(
      object,
      [
        'id',
        'icon',
        'word',
        'shape',
        'color',
        'label',
        'size',
        'float',
        'enter',
      ],
      at,
    );
    check(
      /^[a-z0-9][a-z0-9-]*$/.test(object.id),
      `${at}.id is a lowercase slug`,
    );
    check(
      !objects.has(object.id) || known.has(object.id),
      `${at}.id ${object.id} is repeated`,
    );
    check(
      [object.icon, object.word, object.shape].filter((value) => value != null)
        .length === 1,
      `${at} is one of an icon, a word or a shape`,
    );
    appearance(object, index);
    objects.set(object.id, { color: 'accent', float: true, ...object });
  }
  return objects;
}
export function castSpec(
  raw: unknown,
  known = new Map<string, CastObject>(),
  knownLook: string | null = null,
): CastSpec {
  own(raw, ['objects', 'formations', 'seed', 'look', 'fresh'], 'cast');
  const input = decodeCast(raw);
  check(
    input.look == null || LOOKS.includes(input.look),
    `look is ${LOOKS.join(', ')}`,
  );
  check(
    input.look == null || knownLook == null || input.look === knownLook,
    `look is set once, in the cast's first beat (it is ${knownLook})`,
  );
  const objects = addObjects(input.objects ?? [], known);
  const tooMany = objects.size > 16 && known.size > 0;
  const message = tooMany
    ? `a cast has 1–16 objects; this one has ${objects.size}: ${known.size} carried from earlier beats of the film's cast and ${objects.size - known.size} new here. Reuse the carried ones by id, or start a new cast with "fresh": true`
    : `a cast has 1–16 objects (this one has ${objects.size}; declare them in its first beat)`;
  check(objects.size >= 1 && objects.size <= 16, message);
  check(
    input.formations.length >= 1 && input.formations.length <= 12,
    'formations needs 1–12 entries',
  );
  input.formations.forEach((formation, index) =>
    validateFormation(formation, index, input.formations.length, objects),
  );
  return {
    objects,
    formations: input.formations,
    seed: input.seed ?? 0,
    look: input.look ?? knownLook ?? 'tiles',
  };
}
