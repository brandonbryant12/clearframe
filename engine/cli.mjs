#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { resolveProject } from './lib/project.mjs';
import { writeJSON } from './lib/util.mjs';
import { BLOCKS, THEMES, THEME_NOTES, MOTIONS, TRANSITIONS, BACKDROPS, markdownCatalog } from '../fframes/catalog.mjs';
import { PLAYBOOKS, scaffold, writeGallery } from '../fframes/playbooks.mjs';
import { ICONS, ICON_SOURCE } from '../fframes/icons.mjs';
import { SKETCHES, sketch } from '../fframes/sketches.mjs';
import { TREATMENTS } from '../fframes/treatments.mjs';
import * as native from '../fframes/production.mjs';

const HELP = `ClearFrame — FFFrames motion graphics

  new <dir> [--playbook concept-explainer] [--treatment editorial] [--theme midnight] [--vertical]
  treatments [--json]                 art direction presets: look, motion, voice, sound and rules
  reference <video> [--out dir]       cut rhythm, keyframe sheet, palette and motion of a reference film
  ingest <dir> --markdown report.md [--treatment noir]   evidence brief (figures, sources, tensions, tables) + storyboard + DIRECTION.md
                                      (also .txt, .html, .docx, .rtf; .pdf with pdftotext)
  ingest <dir> --audio episode.wav --words words.json [--script turns.txt] [--from s] [--to s] [--speakers host=Maya:Host,guest=Sam:Guest] [--vertical]
                                      a recording as gapless beats with measured word timings and speakers
  playbooks | recipes                 24 narrative starting points
  blocks [name] [--json | --md]        32 native building blocks and props
  themes [--json]                     8 palettes with swatches
  motions [--json]                    presets, entrances, exits and backdrops
  icons [--json]                      95 bundled Tabler icons and provenance
  sketch [name] [--vertical]          canvas starting compositions (route, orbit, pipeline…) as JSON
  doctor | build                      native dependencies and compiler
  gallery <new-dir> [--vertical] [--theme ink] [--only bars,kinetic] [--sketches]
  plan <dir>                          approximate generation cost and cache state
  voice <dir> [--draft]                local voice or paid Gemini TTS
  music <dir> [--draft]                local bed or paid Lyria MP3
  images | clips <dir> [--only id] [--budget dollars] [--force]
  speech <dir> --beat id --audio recording.wav --transcript text.txt [--words words.json]
  align <dir> --beat id --words words.json     import measured word timestamps
  align <dir> --beat id --transcribe [--budget dollars]  paid Gemini word timestamps
  align <dir> --whisper [--beat id] [--model base]      free local Whisper word timestamps for every take
  timing | captions <dir>             timing JSON / SRT and VTT
  check <dir> [--draft]                validate inputs and native diagnostics
  critique <dir> [--json]             deck-ness, stillness, density, hook and story-link review (instant, no render)
  still <dir> --at seconds | --beat id [--pos .6] [--grid] [--draft] [--out image.png]
  sheet <dir> [--per 1|2|3] [--grid] [--draft] [--out sheet.png]   --grid: labelled 100 px coordinates for placing art
  looks <dir> [--beat id] [--draft]    compare the same frame in four palettes
  review <dir> [--beat id] [--video film.mp4]  decoded cut/word-boundary filmstrip
  render | preview <dir> [--draft] [--out film.mp4] [--no-audio] [--force]
  draft <dir> [--no-render]           one pass, one queue wait: critique, draft voice, check, sheet, draft MP4

FFFrames is the only active renderer. Preview produces a review MP4.
Draft permits estimated narration/word timing; output keeps the authored dimensions.
Native work automatically uses the local codex-heavy gate when available.
Paid generation needs GEMINI_API_KEY; rendering and word-file imports are free.
`;
async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const strings = [
    'title',
    'theme',
    'playbook',
    'recipe',
    'treatment',
    'only',
    'budget',
    'at',
    'beat',
    'pos',
    'out',
    'per',
    'columns',
    'thumb',
    'audio',
    'transcript',
    'words',
    'video',
    'markdown',
    'from',
    'to',
    'speakers',
    'fps',
    'script',
    'model',
  ];
  const booleans = [
    'draft',
    'force',
    'vertical',
    'json',
    'md',
    'no-audio',
    'transcribe',
    'help',
    'grid',
    'sketches',
    'whisper',
    'no-render',
  ];
  const { values: o, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: Object.fromEntries([
      ...strings.map(k => [k, { type: 'string' }]),
      ...booleans.map(k => [k, { type: 'boolean' }]),
    ]),
  });
  if (!cmd || cmd === 'help' || o.help) return console.log(HELP);
  // Renders, checks and voice run freely; only a Cargo compile takes the shared lock (see buildNative).
  const num = k => {
    if (o[k] == null) return undefined;
    const n = Number(o[k]);
    if (!Number.isFinite(n)) throw new Error(`--${k} must be a number`);
    return n;
  };
  const opts = {
    ...o,
    only: o.only?.split(','),
    budget: num('budget'),
    at: num('at'),
    pos: num('pos'),
    per: num('per'),
    columns: num('columns'),
    thumb: num('thumb'),
    noAudio: o['no-audio'],
  };
  if (opts.budget != null && opts.budget < 0) throw new Error('budget must be nonnegative');
  if (cmd === 'new') {
    const dir = path.resolve(positionals[0] ?? 'my-video');
    const sb = scaffold(dir, opts);
    const rel = path.relative(process.cwd(), dir) || '.';
    return console.log(
      `Created ${rel} (${sb.beats.length} beats, ${typeof sb.theme === 'string' ? sb.theme : sb.theme.base} palette). Replace the illustrative claims, then:\n  clearframe sheet ${rel} --draft     # contact sheet to review\n  clearframe voice ${rel} --draft     # free local narration\n  clearframe render ${rel} --draft    # fast review MP4`,
    );
  }
  if (['playbooks', 'recipes'].includes(cmd))
    return console.log(
      o.json
        ? JSON.stringify(PLAYBOOKS, null, 2)
        : PLAYBOOKS.map(p => `${p.id.padEnd(24)} ${p.title}\n  ${p.audience} · ${p.inputs}`).join('\n'),
    );
  if (cmd === 'blocks') {
    const b = positionals[0] ? BLOCKS.find(b => b.name === positionals[0]) : null;
    if (positionals[0] && !b) throw new Error(`Unknown block ${positionals[0]}. Run clearframe blocks.`);
    if (o.md) return console.log(markdownCatalog());
    if (o.json || b) return console.log(JSON.stringify(b ?? BLOCKS, null, 2));
    const groups = [...new Set(BLOCKS.map(b => b.category))];
    return console.log(
      groups
        .map(
          g =>
            `${g.toUpperCase()}\n${BLOCKS.filter(b => b.category === g)
              .map(b => `  ${b.name.padEnd(12)} ${b.summary}`)
              .join('\n')}`,
        )
        .join('\n\n') + '\n\nclearframe blocks NAME shows props and a ready-to-paste example.',
    );
  }
  if (cmd === 'themes') {
    if (o.json) return console.log(JSON.stringify(THEMES, null, 2));
    const swatch = hex =>
      process.stdout.isTTY
        ? `\x1b[48;2;${hex
            .slice(1)
            .match(/../g)
            .map(v => parseInt(v, 16))
            .join(';')}m   \x1b[0m`
        : '';
    return console.log(
      Object.entries(THEMES)
        .map(
          ([name, t]) =>
            `${name.padEnd(10)} ${['bg', 'surface', 'ink', 'muted', 'accent', 'accent2'].map(k => swatch(t[k])).join('')} ${THEME_NOTES[name]}`,
        )
        .join('\n') +
        '\n\nOverride any token in storyboard.json: "theme": {"base": "ink", "accent": "#d6acff"}. Compare palettes with: clearframe looks DIR --beat ID',
    );
  }
  if (cmd === 'icons') {
    if (o.json) return console.log(JSON.stringify({ icons: ICONS, ...ICON_SOURCE }, null, 2));
    const width = Math.max(...ICONS.map(i => i.length)) + 2;
    const rows = [];
    for (let i = 0; i < ICONS.length; i += 6)
      rows.push(
        ICONS.slice(i, i + 6)
          .map(n => n.padEnd(width))
          .join('')
          .trimEnd(),
      );
    return console.log(
      `${rows.join('\n')}\n\n${ICONS.length} MIT Tabler icons · ${ICON_SOURCE.repository} @ ${ICON_SOURCE.revision.slice(0, 12)}`,
    );
  }
  if (cmd === 'reference') {
    if (!positionals[0]) throw new Error('reference needs a video file');
    const { analyseReference } = await import('./lib/reference.mjs');
    const out = path.resolve(
      o.out ?? path.join('build/reference', path.basename(positionals[0]).replace(/\.[^.]+$/, '')),
    );
    const r = await analyseReference(positionals[0], out);
    return console.log(
      `${r.shots} shots · ${r.cutsPerMinute} cuts/min · median shot ${r.medianShot.toFixed(1)}s · ${r.motion.feel} · closest palette ${r.suggestedTheme.base}\n${path.relative(process.cwd(), path.join(out, 'REFERENCE.md'))} (+ sheet.png, opening.png)`,
    );
  }
  if (cmd === 'treatments')
    return console.log(
      o.json
        ? JSON.stringify(TREATMENTS, null, 2)
        : TREATMENTS.map(
            t =>
              `${t.id.padEnd(11)} ${t.title}\n            ${t.when}\n            ${t.film.theme} · ${t.film.motion.preset} · ${t.film.transition}${t.film.frame ? ' · frame' : ''}${t.beats.rough ? ' · rough strokes' : ''}${t.film.sfx && t.film.sfx !== 'off' ? ` · sfx ${t.film.sfx}` : ''}`,
          ).join('\n') + '\n\nclearframe new DIR --playbook NAME --treatment ID applies one and writes DIRECTION.md.',
    );
  if (cmd === 'sketch') {
    if (!positionals[0])
      return console.log(
        SKETCHES.map(s => `${s.name.padEnd(10)} ${s.summary}\n           Use for: ${s.use}`).join('\n') +
          '\n\nclearframe sketch NAME [--vertical] prints canvas props to adapt; ambient prints an art.under layer.',
      );
    return console.log(JSON.stringify(sketch(positionals[0], o.vertical ? 'vertical' : 'landscape'), null, 1));
  }
  if (cmd === 'motions')
    return console.log(
      JSON.stringify(
        {
          presets: MOTIONS,
          intensity: '0–1',
          transitions: TRANSITIONS,
          exits: 'auto (mirror the next entrance) | none | fade | push | zoom | wipe',
          backdrops: BACKDROPS,
        },
        null,
        2,
      ),
    );
  if (cmd === 'doctor') {
    const rows = native.doctor();
    console.table(rows);
    if (rows.some(r => !r.ok)) process.exitCode = 1;
    return;
  }
  if (cmd === 'build') return console.log(await native.buildNative(opts));
  if (cmd === 'gallery') {
    const dir = path.resolve(positionals[0] ?? 'build/native-gallery');
    await writeGallery(dir, opts);
    return console.log(await native.sheetProject(dir, { ...opts, draft: true, per: 1, columns: 4 }));
  }
  if (cmd === 'ingest') {
    const { ingestMarkdown, ingestRecording } = await import('./lib/ingest.mjs');
    const dir = path.resolve(positionals[0] ?? '.');
    if (o.markdown) {
      const { storyboardFor } = await import('../fframes/playbooks.mjs');
      const { applyTreatment, directionTemplate, treatmentById } = await import('../fframes/treatments.mjs');
      const r = ingestMarkdown(dir, o.markdown, {
        scaffold: (id, opts) => {
          const sb = storyboardFor(id, { ...opts, theme: o.theme, vertical: o.vertical });
          if (o.treatment) {
            applyTreatment(sb, o.treatment);
            if (o.theme) sb.theme = o.theme;
          }
          fs.writeFileSync(
            path.join(dir, 'DIRECTION.md'),
            directionTemplate(sb, o.treatment ? treatmentById(o.treatment) : null),
          );
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
          .map(s => {
            const [id, rest = ''] = s.split('=');
            const [name, role] = rest.split(':');
            return [id.trim(), { name: name?.trim() || `Speaker ${id}`, ...(role ? { role: role.trim() } : {}) }];
          }),
      );
      const words = o.words ? JSON.parse(fs.readFileSync(o.words, 'utf8')) : null;
      const script = o.script
        ? o.script.endsWith('.json')
          ? JSON.parse(fs.readFileSync(o.script, 'utf8'))
          : fs.readFileSync(o.script, 'utf8')
        : null;
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
      });
      return console.log(
        `Imported ${r.beats} beats (${r.duration}s, ${r.words} words${r.speakers.length ? `, speakers ${r.speakers.join(', ')}` : ''}${r.interpolated != null ? `; script aligned, ${r.interpolated} word(s) interpolated` : ''}) into ${path.relative(process.cwd(), dir)}. Read BRIEF.md, then give the beats pictures.`,
      );
    }
    throw new Error('ingest needs --markdown FILE or --audio FILE --words FILE');
  }
  const dir = resolveProject(positionals[0]);
  if (['plan', 'voice', 'music', 'images', 'clips'].includes(cmd)) {
    const g = await import('./lib/generate.mjs');
    const result = await g[cmd === 'music' ? 'scoreMusic' : cmd](dir, opts);
    if (result) console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (cmd === 'speech') {
    if (!o.audio || !o.transcript) throw new Error('speech needs --audio and --transcript (text file)');
    const { importSpeech } = await import('./lib/speech.mjs');
    return console.log(
      await importSpeech(dir, {
        beat: o.beat,
        audio: o.audio,
        transcript: fs.readFileSync(o.transcript, 'utf8'),
        words: o.words ? JSON.parse(fs.readFileSync(o.words, 'utf8')) : undefined,
      }),
    );
  }
  if (cmd === 'align' && o.whisper) {
    const { whisperAlign } = await import('./lib/whisper.mjs');
    const report = await whisperAlign(dir, { beat: o.beat, model: o.model });
    return console.log(report.map(r => `${r.id.padEnd(16)} ${r.status}`).join('\n'));
  }
  if (cmd === 'align') {
    if (Boolean(o.words) === Boolean(o.transcribe)) throw new Error('Choose --words, --transcribe or --whisper');
    const s = await import('./lib/speech.mjs');
    const result = o.transcribe
      ? await s.transcribeSpeech(dir, opts)
      : s.alignSpeech(dir, { beat: o.beat, words: JSON.parse(fs.readFileSync(o.words, 'utf8')) });
    return console.log(`Aligned ${result.length} words to the current recording.`);
  }
  if (['timing', 'captions'].includes(cmd)) {
    const t = await import('./lib/timing.mjs'),
      timing = t.computeTiming(dir);
    writeJSON(path.join(dir, 'build/timing.json'), timing);
    if (cmd === 'timing') return console.log(JSON.stringify(timing, null, 2));
    if (!o.draft && timing.beats.some(b => b.vo && b.vo.wordTiming !== 'measured'))
      throw new Error(
        'Caption export requires measured word timestamps; align each take, or use --draft for rough captions.',
      );
    const cues = t.captionCues(timing);
    fs.writeFileSync(path.join(dir, 'build/captions.srt'), t.toSRT(cues));
    fs.writeFileSync(path.join(dir, 'build/captions.vtt'), t.toVTT(cues));
    return console.log('Wrote captions. Timing quality is recorded in build/timing.json.');
  }
  if (cmd === 'draft') {
    // Everything a review round needs, inside a single gate entry, with a compact report.
    const t0 = performance.now(),
      rel = f => path.relative(process.cwd(), f),
      lines = [];
    const { critique } = await import('./lib/critique.mjs');
    const c = critique(dir);
    lines.push(
      `critique: ${c.summary.warnings} warning(s), ${c.summary.ideas} idea(s)`,
      ...c.findings.slice(0, 8).map(f => `  ${f.level === 'warn' ? '!' : '·'} ${f.where}: ${f.message}`),
    );
    const g = await import('./lib/generate.mjs');
    await g.voice(dir, { draft: true });
    const r = await native.checkProject(dir, { draft: true });
    lines.push(
      `check: ${r.errors.length} error(s), ${r.warnings.length} warning(s)`,
      ...r.errors.map(e => `  ✗ ${e}`),
      ...r.warnings.slice(0, 6).map(w => `  ! ${w}`),
    );
    if (r.errors.length) {
      process.exitCode = 1;
      return console.log(lines.join('\n'));
    }
    const findings = (r.notes.join('\n').match(/^Warning .*$/gm) ?? []).slice(0, 6);
    if (findings.length) lines.push('native:', ...findings.map(f => `  ${f}`));
    lines.push(`sheet: ${rel(await native.sheetProject(dir, { draft: true }))}`);
    if (!o['no-render']) {
      const v = await native.renderProject(dir, { draft: true });
      lines.push(
        `video: ${rel(path.join(dir, 'build/video.mp4'))} (${v.frames} frames, ${v.seconds.toFixed(1)} s to render)`,
      );
    }
    lines.push(`done in ${((performance.now() - t0) / 1000).toFixed(1)} s. Open the sheet before anything else.`);
    return console.log(lines.join('\n'));
  }
  if (cmd === 'critique') {
    const { critique } = await import('./lib/critique.mjs');
    const r = critique(dir);
    if (o.json) return console.log(JSON.stringify(r, null, 2));
    const s = r.summary;
    console.log(
      `${s.beats} beats · ${s.seconds}s · ${s.families} scene families · ${s.drawn} drawn · ${s.imaged} with imagery · ${s.graphicTransitions} graphic transitions · ${s.tones} colour blocks`,
    );
    return console.log(
      r.findings.length
        ? r.findings.map(f => `${f.level === 'warn' ? '!' : '·'} ${f.where.padEnd(18)} ${f.message}`).join('\n')
        : 'No findings. Now look at the sheet.',
    );
  }
  if (cmd === 'check') {
    const r = await native.checkProject(dir, opts);
    console.log(JSON.stringify(r, null, 2));
    if (r.errors.length) process.exitCode = 1;
    return;
  }
  if (cmd === 'still') return console.log(await native.stillProject(dir, opts));
  if (cmd === 'sheet') return console.log(await native.sheetProject(dir, opts));
  if (cmd === 'looks') return console.log(await native.lookbookProject(dir, opts));
  if (cmd === 'review') {
    const { reviewProject } = await import('./lib/review.mjs');
    return console.log(await reviewProject(dir, opts));
  }
  if (cmd === 'render' || cmd === 'preview')
    return console.log(
      JSON.stringify(await native.renderProject(dir, { ...opts, draft: cmd === 'preview' || o.draft }), null, 2),
    );
  throw new Error(`Unknown command ${cmd}. Run clearframe help.`);
}
main().catch(e => {
  console.error(`ClearFrame: ${e.message}`);
  process.exitCode = 1;
});
