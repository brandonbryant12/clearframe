// Regenerate public authoring references from the native vocabulary.
import fs from 'node:fs';
import { BLOCKS, THEMES, MOTIONS, TRANSITIONS, BACKDROPS, FRAME_RATES, markdownCatalog } from '../fframes/catalog.mjs';
import { wireframePNG } from '../fframes/wireframe.mjs';
import { PLAYBOOKS, storyboardFor } from '../fframes/playbooks.mjs';
const text = { type: 'string' },
  number = { type: 'number' },
  bool = { type: 'boolean' },
  object = { type: 'object' };
const motion = {
  type: 'object',
  additionalProperties: false,
  properties: { preset: { enum: MOTIONS }, intensity: { type: 'number', minimum: 0, maximum: 1 } },
};
const palette = {
  type: 'object',
  additionalProperties: false,
  properties: {
    base: { enum: Object.keys(THEMES) },
    ...Object.fromEntries(Object.keys(THEMES.paper).map(k => [k, { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }])),
  },
};
const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'ClearFrame FFFrames storyboard',
  type: 'object',
  required: ['beats'],
  additionalProperties: false,
  properties: {
    $schema: text,
    version: { const: 2 },
    title: text,
    logline: text,
    audience: text,
    budget: { type: 'number', minimum: 0 },
    format: {
      type: 'object',
      additionalProperties: false,
      properties: {
        preset: { enum: ['landscape', 'vertical', 'square', 'portrait'] },
        width: { type: 'integer' },
        height: { type: 'integer' },
        fps: { enum: FRAME_RATES },
      },
    },
    theme: { oneOf: [{ enum: Object.keys(THEMES) }, palette] },
    motion,
    transition: { enum: [...TRANSITIONS, 'auto'] },
    backdrop: { enum: BACKDROPS },
    chrome: bool,
    captions: { enum: [true, false, 'auto', 'off', 'pop'] },
    sfx: { enum: [true, false, 'off', 'subtle', 'normal', 'punchy'] },
    treatment: text,
    speakers: object,
    frame: {
      oneOf: [
        bool,
        {
          type: 'object',
          additionalProperties: false,
          description: 'Editorial frame: brand (serif italic), section label, mono footers, progress rail',
          properties: { brand: text, left: text, right: text, label: bool, progress: bool },
        },
      ],
    },
    textMotion: {
      enum: ['lines', 'words', 'letters', 'cascade'],
      description: 'Default type reveal: whole lines, word by word, letter by letter or a tilted cascade',
    },
    texture: {
      oneOf: [
        { enum: ['grain', 'vignette', 'film', 'none'] },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            grain: { type: 'number', minimum: 0, maximum: 1 },
            vignette: { type: 'number', minimum: 0, maximum: 1 },
            animate: bool,
          },
        },
      ],
    },
    voice: object,
    music: { oneOf: [{ const: false }, object] },
    mix: object,
    pacing: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(
        ['lead', 'tail', 'minBeat', 'silentBeat', 'outro'].map(k => [k, { type: 'number', minimum: 0 }]),
      ),
    },
    sources: { type: 'array', items: { oneOf: [text, object] } },
    continuity: {
      type: 'object',
      additionalProperties: false,
      properties: {
        maxGeneratedShare: { type: 'number', minimum: 0, maximum: 1 },
        treatment: text,
        lighting: text,
        camera: text,
        motion: text,
        motif: text,
        refs: { type: 'array', maxItems: 2, items: text },
      },
    },
    assets: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'kind'],
        properties: {
          id: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]*$' },
          kind: { enum: ['image', 'clip', 'sfx'] },
          file: text,
          prompt: text,
          model: text,
          refs: { type: 'array', items: text },
          seconds: { type: 'number', exclusiveMinimum: 0, maximum: 10 },
          resolution: text,
          aspect: text,
          previousInteractionId: text,
        },
      },
    },
    beats: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'block', 'props'],
        additionalProperties: false,
        properties: {
          id: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]*$' },
          block: { enum: BLOCKS.map(b => b.name) },
          vo: text,
          style: text,
          chapter: text,
          duration: { type: 'number', exclusiveMinimum: 0 },
          lead: { type: 'number', minimum: 0 },
          tail: { type: 'number', minimum: 0 },
          hold: { type: 'number', minimum: 0 },
          min: { type: 'number', minimum: 0 },
          transition: { enum: [...TRANSITIONS, 'auto'] },
          exit: { enum: ['auto', 'none', 'fade', 'push', 'zoom', 'wipe', 'panel', 'iris', 'whip'] },
          motion,
          props: object,
          sfx: { type: 'array', items: object },
          tone: { enum: ['none', 'accent', 'accent2', 'invert', 'surface'], description: 'Colour-blocked scene' },
          textMotion: { enum: ['lines', 'words', 'letters', 'cascade'], description: 'Type reveal for this scene' },
          label: {
            type: 'string',
            maxLength: 40,
            description: 'Section label for the film frame (defaults to chapter)',
          },
          note: text,
          transitionColor: { enum: ['accent', 'accent2', 'ink', 'bg', 'surface'] },
          transitionOrigin: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: { type: 'number', minimum: 0, maximum: 1 },
          },
          camera: {
            oneOf: [
              { enum: ['auto', 'none', 'in', 'out', 'left', 'right', 'up', 'down'] },
              {
                type: 'object',
                additionalProperties: false,
                properties: {
                  move: { enum: ['auto', 'none', 'in', 'out', 'left', 'right', 'up', 'down'] },
                  amount: { type: 'number', minimum: 0, maximum: 1 },
                },
              },
            ],
          },
          plate: {
            type: 'object',
            additionalProperties: false,
            description: 'Image or clip behind or beside the block (docs/canvas.md)',
            properties: {
              asset: text,
              file: text,
              side: { enum: ['full', 'left', 'right', 'top', 'bottom'] },
              treatment: { enum: ['none', 'mono', 'duotone', 'tint', 'blur', 'soft'] },
              drift: { enum: ['none', 'in', 'out', 'left', 'right', 'up', 'down'] },
              scrim: { type: 'number', minimum: 0, maximum: 1 },
              focus: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number', minimum: 0, maximum: 1 } },
              offset: { type: 'number', minimum: 0 },
              loop: bool,
            },
          },
          art: {
            type: 'object',
            additionalProperties: false,
            description: 'Canvas elements under/over the block (docs/canvas.md)',
            properties: { under: { type: 'array', items: object }, over: { type: 'array', items: object } },
          },
        },
        allOf: BLOCKS.map(b => ({
          if: { properties: { block: { const: b.name } } },
          then: {
            properties: {
              props: {
                type: 'object',
                additionalProperties: false,
                properties: Object.fromEntries(
                  Object.entries(b.props).map(([key, description]) => [key, { description }]),
                ),
              },
            },
          },
        })),
      },
    },
  },
};
fs.writeFileSync('schema/storyboard.schema.json', JSON.stringify(schema, null, 2) + '\n');
fs.writeFileSync('skills/clearframe-library/references/blocks.md', markdownCatalog());
for (const b of PLAYBOOKS) {
  fs.mkdirSync(`recipes/${b.id}`, { recursive: true });
  const sb = storyboardFor(b.id);
  fs.writeFileSync(`recipes/${b.id}/storyboard.json`, JSON.stringify(sb, null, 2) + '\n');
  if (sb.beats.some(x => x.props?.file === 'assets/screen.png')) {
    fs.mkdirSync(`recipes/${b.id}/assets`, { recursive: true });
    fs.writeFileSync(`recipes/${b.id}/assets/screen.png`, wireframePNG(THEMES[sb.theme]));
  }
  fs.writeFileSync(
    `recipes/${b.id}/BRIEF.md`,
    `# ${b.title}\n\nAudience: ${b.audience}\n\nInputs: ${b.inputs}\n\n${b.note ?? 'Adapt this structure to the story; replace all illustrative claims and sources.'}\n`,
  );
}
fs.writeFileSync(
  'recipes/README.md',
  '# Narrative playbooks\n\nGenerated from fframes/playbooks.mjs. These are adaptable starting structures with illustrative content; replace claims and sources before publishing. Use `clearframe new DIR --playbook NAME`.\n\n' +
    PLAYBOOKS.map(b => `- **${b.id}**: ${b.title}. Inputs: ${b.inputs}.`).join('\n') +
    '\n',
);
