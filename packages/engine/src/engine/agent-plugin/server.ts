// ClearFrame studio tools for OpenCode. Each tool forwards to the viewer server that owns the
// film (engine/lib/agent/bridge.mjs) with the private token it wrote for this runtime; the
// server resolves the calling session to its one project and runs the same validated, undoable
// commands and bounded render queue the browser uses. Nothing here touches project files.
import fs from 'node:fs';
import { Plugin } from '@opencode/plugin';
import * as Schema from 'effect/Schema';
import { TOOLS } from './tool-definitions.js';
const bridgeSchema = Schema.Struct({
  url: Schema.NonEmptyString,
  token: Schema.NonEmptyString,
});
const responseSchema = Schema.Struct({
  error: Schema.optionalKey(Schema.String),
  content: Schema.optionalKey(Schema.String),
  metadata: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  images: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        data: Schema.String,
        mime: Schema.String,
        name: Schema.optionalKey(Schema.String),
      }),
    ),
  ),
});

function bridge(file: string) {
  let b;
  try {
    b = Schema.decodeUnknownSync(bridgeSchema)(
      JSON.parse(fs.readFileSync(file, 'utf8')),
    );
  } catch {
    throw new Error(
      'The ClearFrame studio is not running. Start it with `clearframe viewer --serve` and open the film there.',
    );
  }
  if (!b?.url || !b?.token)
    throw new Error('The ClearFrame studio bridge file is incomplete.');
  return b;
}

export default Plugin.define({
  id: 'clearframe-studio',
  async setup(ctx) {
    const file = ctx.options?.bridgeFile;
    if (typeof file !== 'string') return;
    await ctx.tool.transform((editor) => {
      editor.namespace({
        name: 'clearframe',
        description:
          'ClearFrame studio: read and edit the film this conversation belongs to, render native previews, read notes and sources.',
      });
      for (const [name, description, input] of TOOLS) {
        editor.add({
          name,
          description,
          input,
          options: { namespace: 'clearframe', codemode: false },
          async execute(args, context) {
            const b = bridge(file);
            const r = await fetch(new URL('/api/agent/bridge', b.url), {
              method: 'POST',
              signal: context.signal,
              headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${b.token}`,
              },
              body: JSON.stringify({
                tool: name,
                input: args ?? {},
                sessionID: context.sessionID,
                messageID: context.messageID,
                callID: context.id,
              }),
            }).catch((e) => {
              throw new Error(
                context.signal?.aborted
                  ? 'Stopped.'
                  : `The ClearFrame studio did not answer (${e.message}). Is \`clearframe viewer --serve\` still running?`,
              );
            });
            const j = Schema.decodeUnknownSync(responseSchema)(
              await r.json().catch(() => ({})),
            );
            if (!r.ok)
              throw new Error(
                j.error ?? `ClearFrame refused the request (${r.status}).`,
              );
            // A render to look at travels as an image part of the result, so a model that reads
            // images sees it as a picture rather than as base64 text.
            const images = Array.isArray(j.images)
              ? j.images.filter(
                  (i) =>
                    i && typeof i.data === 'string' && /^image\//.test(i.mime),
                )
              : [];
            const content = images.length
              ? [
                  { type: 'text' as const, text: String(j.content ?? '') },
                  ...images.map((i) => ({
                    type: 'file' as const,
                    uri: `data:${i.mime};base64,${i.data}`,
                    mime: i.mime,
                    name: i.name,
                  })),
                ]
              : j.content;
            return { content, metadata: j.metadata ?? {} };
          },
        });
      }
    });
  },
});
