// A director can ask Neon to select a real library entry. The local catalog supplies its
// authoring example after validation, so generated prose cannot invent executable props.
import * as Schema from 'effect/Schema';
import { detail, type DiscoveryEntry } from '../../film/discover.mjs';
import { post, outputText } from '../../skills/gemini-tts/scripts/gemini.mjs';
import { guardBudget } from './generate-model.mjs';

const MODEL = 'gemini-4-neon';
const Decision = Schema.Struct({
  libraryId: Schema.String,
  direction: Schema.String,
  check: Schema.String,
});

export function shotRequest(
  brief: string,
  candidates: readonly DiscoveryEntry[],
) {
  if (!candidates.length)
    throw new Error(
      'No matching library entries. Try a more specific visual idea.',
    );
  const choices = candidates.map(({ id, about, when, needs }) => ({
    id,
    about,
    when,
    needs,
  }));
  const request = {
    model: MODEL,
    store: false,
    system_instruction:
      'Select one supplied ClearFrame library entry for the brief. Describe what moves, when it moves, and what the viewer should understand. Give one observable check the director can make on the render. Use only facts supplied in the brief.',
    input: JSON.stringify({ brief, choices }),
    generation_config: { thinking_level: 'low', max_output_tokens: 1024 },
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: {
        type: 'object',
        properties: {
          libraryId: { type: 'string', enum: choices.map((e) => e.id) },
          direction: { type: 'string' },
          check: { type: 'string' },
        },
        required: ['libraryId', 'direction', 'check'],
      },
    },
  };
  // Allow one input token per UTF-8 byte of the serialized request and the full output allowance.
  const estimatedUsd =
    (Buffer.byteLength(JSON.stringify(request)) * 3 +
      request.generation_config.max_output_tokens * 15) /
    1e6;
  return { estimatedUsd, request };
}

export async function adviseShot(
  brief: string,
  candidates: readonly DiscoveryEntry[],
  budget?: number,
  dryRun = false,
) {
  const preview = shotRequest(brief, candidates);
  if (dryRun) return preview;
  guardBudget(preview.estimatedUsd, budget);
  // A studio can reload another project's library while the provider is answering.
  const examples = new Map(
    await Promise.all(
      candidates.map(async ({ id }) => [id, await detail(id)] as const),
    ),
  );
  const response = await post('/interactions', preview.request, { retries: 0 });
  const advice = Schema.decodeUnknownSync(Decision)(
    JSON.parse(outputText(response)),
  );
  const authoring = examples.get(advice.libraryId);
  if (!authoring || !advice.direction.trim() || !advice.check.trim())
    throw new Error(
      'Neon returned an incomplete direction or an entry outside the shortlist',
    );
  return { model: MODEL, ...advice, authoring };
}
