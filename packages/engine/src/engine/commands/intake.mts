import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

import { startRun } from '../lib/runlog.mjs';

import {
  directionOptions,
  directionMarkdown,
  directionRefs,
} from '../../film/directions.mjs';

import * as Schema from 'effect/Schema';
import { JsonValueSchema } from '../schemas.mjs';
import type { CommandContext } from './options.mjs';

export async function ingestCommand({
  cmd,
  args,
  positionals,
  o,
  opts,
  num,
}: CommandContext) {
  const { ingestMarkdown, ingestRecording } = await import('../lib/ingest.mjs');
  const { vendor } = await import('../../film/library.mjs');
  const { applyTreatment, directionTemplate, treatmentById } =
    await import('../../film/treatments.mjs');
  const chosen = directionOptions(opts);
  if (chosen.treatment && !treatmentById(chosen.treatment))
    throw new Error(`Unknown treatment ${chosen.treatment}`);
  const dir = path.resolve(positionals[0] ?? '.');
  startRun(dir, cmd, args);
  if (o.markdown) {
    const { storyboardFor, artSketches } =
      await import('../../film/playbooks.mjs');
    // A treatment starts from the playbook it names (keynote → product-reveal), not a deck.
    const playbook =
      chosen.playbook ??
      (chosen.treatment && treatmentById(chosen.treatment)?.playbook) ??
      'research-digest';
    const r = ingestMarkdown(dir, o.markdown, {
      playbook,
      scaffold: (id, opts) => {
        const sb = storyboardFor(id, {
          ...opts,
          theme: o.theme,
          vertical: o.vertical,
        });
        if (chosen.treatment) {
          applyTreatment(sb, chosen.treatment);
          if (o.theme) sb.theme = o.theme;
        }
        fs.writeFileSync(
          path.join(dir, 'DIRECTION.md'),
          directionTemplate(
            sb,
            chosen.treatment ? treatmentById(chosen.treatment) : null,
          ) + directionMarkdown(o.direction),
        );
        // Art sketches stay as shorthand until the job; shared ones travel with the project.
        vendor(dir, [
          ...artSketches(sb),
          ...directionRefs(o.direction, [
            ['treatments', chosen.treatment],
            ['playbooks', playbook],
          ]),
          [
            'palettes',
            typeof sb.theme === 'string' ? sb.theme : sb.theme?.base,
          ],
          ['types', sb.type],
        ]);
        return sb;
      },
    });
    return console.log(
      `Evidence brief → ${path.relative(process.cwd(), path.join(dir, 'BRIEF.md'))}: ${r.figures} figures (${r.sourced} with sources), ${r.contrasts} tensions, ${r.tables} tables, ${r.sources} sources. Read it, find the question and the surprise, then rewrite the storyboard beats.`,
    );
  }
  if (o.audio) {
    const speakers = Object.fromEntries(
      (o.speakers ?? '')
        .split(',')
        .filter(Boolean)
        .map((s) => {
          const [id, rest = ''] = s.split('=');
          const [name, role] = rest.split(':');
          return [
            id.trim(),
            {
              name: name?.trim() || `Speaker ${id}`,
              ...(role ? { role: role.trim() } : {}),
            },
          ];
        }),
    );
    // No word file: measure the words locally with Whisper (whisper.cpp when a model is
    // installed), free, the same way draft voice takes are measured.
    const words = await recordingWords(o.audio, o.words);
    const script = readScript(o.script);
    const r = await ingestRecording(dir, {
      audio: o.audio,
      words,
      script,
      from: num('from') ?? 0,
      to: num('to'),
      fps: num('fps') ?? 30,
      vertical: o.vertical,
      speakers,
      theme: o.theme,
      title: o.title,
      treatment: chosen.treatment,
      direction: chosen.direction,
      playbook: chosen.playbook,
      brand: o.brand,
    });
    return console.log(
      `Imported ${r.beats} beats (${r.duration}s, ${r.words} words${r.speakers.length ? `, speakers ${r.speakers.join(', ')}` : ''}${r.interpolated != null ? `; script aligned, ${r.interpolated} word(s) interpolated` : ''}) into ${path.relative(process.cwd(), dir)}. Read BRIEF.md, then give the beats pictures.`,
    );
  }
  throw new Error(
    'ingest needs --markdown FILE or --audio FILE (with --words FILE, or local Whisper measures them)',
  );
}

function readScript(file?: string) {
  if (!file) return null;
  const content = fs.readFileSync(file, 'utf8');
  return file.endsWith('.json')
    ? Schema.decodeUnknownSync(JsonValueSchema)(JSON.parse(content))
    : content;
}
async function recordingWords(audio: string, file?: string): Promise<unknown> {
  if (file) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const { transcribeWords, whisperAvailable } =
    await import('../lib/whisper.mjs');
  if (!whisperAvailable())
    throw new Error(
      'ingest --audio needs --words FILE, or local Whisper to measure them (install whisper-cpp or openai-whisper).',
    );
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-ingest-'));
  try {
    const wav = path.join(tmp, 'audio16k.wav');
    const result = spawnSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      audio,
      '-ar',
      '16000',
      '-ac',
      '1',
      wav,
    ]);
    if (result.status !== 0)
      throw new Error('Could not prepare the recording for transcription.');
    process.stderr.write(
      '  no --words given: measuring the recording with local Whisper…\n',
    );
    return transcribeWords(wav, { dir: tmp }).words;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
