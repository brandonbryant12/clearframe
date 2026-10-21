import * as Schema from 'effect/Schema';
import {
  OperationsSchema,
  type StudioOperation,
} from '../viewer/studio-contracts.mjs';
import { isRecord, errorMessage } from '../harness/contracts.mjs';
import { fail } from './tool-common.mjs';
function closesContainer(text: string, from: number): boolean {
  let at = from;
  while (at < text.length && /\s/.test(text[at])) at++;
  return text[at] === ']' || text[at] === '}';
}
/** Drop commas that close an array or object, reading strings as strings (their text is never touched). */
function withoutTrailingCommas(text: string) {
  let out = '',
    quoted = false,
    escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      out += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      if (closesContainer(text, i + 1)) continue;
    }
    out += c;
  }
  return out;
}

function parseOperations(text: string): StudioOperation[] | null {
  const value: unknown = JSON.parse(text);
  if (Array.isArray(value))
    return Schema.decodeUnknownSync(OperationsSchema)(value);
  if (!isRecord(value)) return null;
  if (Array.isArray(value.ops))
    return Schema.decodeUnknownSync(OperationsSchema)(value.ops);
  if (value.command) return Schema.decodeUnknownSync(OperationsSchema)([value]);
  return null;
}

/**
 * Operations sent as JSON text. A trailing comma (the commonest slip) is forgiven; anything else is
 * refused with where it broke, so the model can fix that spot instead of guessing.
 */
export function opsFromText(text: string): StudioOperation[] {
  let error;
  for (const t of [text, withoutTrailingCommas(text)]) {
    try {
      const ops = parseOperations(t);
      if (ops) return ops;
    } catch (e) {
      error ??= e;
    }
  }
  const at = Number(
    /position (\d+)/.exec(error ? errorMessage(error) : '')?.[1],
  );
  const near = Number.isFinite(at)
    ? ` near “${text.slice(Math.max(0, at - 40), at)}⟨here⟩${text.slice(at, at + 40)}”`
    : '';
  throw fail(
    `ops must be an array of operations. The JSON text did not parse${error ? `: ${errorMessage(error)}` : ' to an array'}${near}. Send ops as a JSON array (not text) if you can.`,
  );
}
/**
 * A narration record as the agent should read it: who actually spoke the line first. Draft lines
 * written before ClearFrame noted the OS voice carry the film's Google voice and style in `voice` and
 * `style`; those are settings, so they are moved under `googleSettingsAtTheTime`, never shown as used.
 */
export function voiceRecord(raw: string) {
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (!isRecord(m) || m.provider !== 'local') return raw;
  const { voice, style, osVoice, ...rest } = m,
    legacy = !('osVoice' in m);
  const record = {
    provider: 'local',
    spokenBy: osVoice
      ? `free OS draft voice "${osVoice}"`
      : 'free OS draft voice (which one was not recorded)',
    ...rest,
    ...(legacy && (voice || style)
      ? {
          googleSettingsAtTheTime: { voice, style },
          note: "Older draft record: voice and style were the film's Google settings when the draft was made, not what spoke it. No Google take exists for this line.",
        }
      : {}),
  };
  return JSON.stringify(record, null, 2);
}
