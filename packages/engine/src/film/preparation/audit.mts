import * as Schema from 'effect/Schema';
import type { JobBeat } from '../types.mjs';
import type {
  AuditFinding,
  AuditOptions,
  AuditClassification,
} from './contracts.mjs';
const finding: Schema.Codec<AuditFinding> = Schema.Struct({
  level: Schema.String,
  beat: Schema.String,
  message: Schema.String,
  kind: Schema.optional(Schema.String),
  seconds: Schema.optional(Schema.Finite),
  text: Schema.optional(Schema.String),
});
const decodeAudit = Schema.decodeUnknownSync(Schema.Array(finding));
const norm = (s: unknown): string =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
/** Every piece of text a prepared beat can show: props, art, label, speaker, captions, words. */
function shownText(jb: JobBeat): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk([
    jb.props,
    jb.art,
    jb.label,
    jb.speaker,
    (jb.captions ?? []).map((c) => c.text),
  ]);
  out.push((jb.words ?? []).map((w) => w.text).join(' '));
  return out;
}

/**
 * Sort frame-audit findings. Errors stay errors, in every profile, unless the profile is rough
 * and the finding is provably about declared unfinished text: its text is part of a placeholder
 * slate or of an element marked `unfinished` in that beat, and part of nothing else the beat
 * shows. A finding without text, or about text that also appears in finished type (a source
 * line, a label, a caption), is never relaxed: roughness says nothing about what text means.
 */
export function classifyAudit(
  input: unknown,
  { rough = false, allowed = [], job }: AuditOptions = {},
): AuditClassification {
  const findings = decodeAudit(input);
  const errors: string[] = [],
    warnings: string[] = [],
    craft: string[] = [];
  warnings.push(...groupWarnings(findings));
  for (const a of findings) {
    const line = `${a.beat}: ${a.message} (${Number(a.seconds ?? 0).toFixed(1)} s)`;
    if (a.level !== 'error') continue;
    const text = norm(a.text);
    const mine =
      rough && text
        ? allowed.filter(
            (x) => x.beat === a.beat && norm(x.text).includes(text),
          )
        : [];
    const jb = job?.beats?.find((x) => x.id === a.beat);
    // Relaxed only if every place the beat shows this text is a declared stand-in.
    const everywhere = jb
      ? shownText(jb).filter((t) => norm(t).includes(text)).length
      : Infinity;
    if (mine.length && everywhere <= mine.length)
      craft.push(`${line} [${mine[0].why}]`);
    else errors.push(line);
  }
  return { errors, warnings, craft };
}

function groupWarnings(findings: readonly AuditFinding[]): string[] {
  const warnings: string[] = [];
  // Warnings of one kind in one beat read as one finding: a caption line or a word-by-word
  // phrase is many pieces of type, and a list of each word buries the errors.
  const grouped = new Map<string, AuditFinding[]>();
  for (const a of findings)
    if (a.level !== 'error') {
      const key = `${a.beat}\0${a.kind ?? a.message}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(a);
    }
  for (const group of grouped.values()) {
    const [a] = group;
    const at = `(${Number(a.seconds ?? 0).toFixed(1)} s)`;
    if (group.length < 3) {
      for (const g of group)
        warnings.push(
          `${g.beat}: ${g.message} (${Number(g.seconds ?? 0).toFixed(1)} s)`,
        );
      continue;
    }
    const words = [...new Set(group.map((g) => g.text).filter(Boolean))];
    const sample = words.slice(0, 6).join(' ');
    const rest = a.message
      .replace(/^".*?" /, '')
      .replace(/^(runs|is) /, (m) => (m === 'runs ' ? 'run ' : 'are '));
    warnings.push(
      `${a.beat}: ${words.length} pieces of type ("${sample}${words.length > 6 ? '…' : ''}") ${rest} ${at}`,
    );
  }

  return warnings;
}
