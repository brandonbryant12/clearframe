#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { resolveProject } from './lib/project.mjs';
import { writeJSON } from './lib/util.mjs';
import { startRun, finishRun } from './lib/runlog.mjs';
import { parseTime } from './lib/notes.mjs';
import { REVIEW, reviewCommand } from './lib/review-cli.mjs';
import { BLOCKS, THEMES, THEME_NOTES, MOTIONS, TRANSITIONS, BACKDROPS, markdownCatalog } from '../film/catalog.mjs';
import { playbooks, scaffold, writeGallery } from '../film/playbooks.mjs';
import { ICONS, ICON_SOURCE } from '../film/icons.mjs';
import { sketches, sketch, sketchByName } from '../film/sketches.mjs';
import { treatments } from '../film/treatments.mjs';
import { directions, directionOptions, directionMarkdown, directionRefs } from '../film/directions.mjs';
import { useProject, types } from '../film/library.mjs';
import * as native from '../film/production.mjs';

const HELP = `ClearFrame — motion graphics

  new <dir> [--direction ID] [--playbook concept-explainer] [--treatment editorial] [--theme midnight] [--vertical] [--seed N|random]
  start <dir> [--idea text] [--document report.md ...] [--brand brand.json] [--audience text] [--takeaway text]
                                      portable source + brand intake; accepts --direction, --playbook, --treatment, --vertical
  directions [research|podcast] [--json] optional story/picture/pace starting points; custom JSON in library/directions
  muse [--seed N] [--light] [--json]  a seeded creative brief: twist, motif, camera, cuts, look, set pieces, music
  checkpoints <dir> [--mode guided|one-shot] [--json]   where a human decides (intent, truth, story, words, spend, picture, final) and what is open
  treatments [--json]                 art direction presets: look, motion, voice, sound and rules
  asset-anchors ASSET-DIR --definition FILE --out NEW-JSON   export checked static anchors and copy zones
  sculptures [--json]                original 3D asset recipes; optional offline Blender
  sculpture ID --out NEW-DIR [--draft] [--still] [--vertical] [--theme ID] [--duration 4] [--fps 24] [--seed N]
                                      baked .blend + PNG + MP4; --phase-seconds timing.json sets named phase durations; --dry-run prints settings
  types [--json]                      type voices: display family and emphasis per treatment (storyboard "type")
  reference <video> [--out dir]       cut rhythm, keyframe sheet, palette and motion of a reference film
  ingest <dir> --markdown report.md [--treatment noir]   evidence brief (figures, sources, tensions, tables) + storyboard + DIRECTION.md
                                      (also .txt, .html, .docx, .rtf; .pdf with pdftotext)
  ingest <dir> --audio episode.wav --words words.json [--script turns.txt] [--brand brand.json] [--from s] [--to s] [--speakers host=Maya:Host,guest=Sam:Guest] [--vertical]
                                      a recording as gapless beats with measured word timings and speakers
  playbooks | recipes                 ${playbooks().length} narrative starting points
  blocks [name] [--json | --md]        ${BLOCKS.length} native building blocks and props
  themes [--json]                     ${Object.keys(THEMES).length} palettes with swatches
  motions [--json]                    presets, entrances, exits and backdrops
  icons [--json]                      95 bundled Tabler icons and provenance
  sketch [name] [--vertical]          canvas starting compositions (route, orbit, pipeline…) as JSON
  doctor | build                      tools and disk headroom; compile the renderer
  gallery <new-dir> [--vertical] [--theme ink] [--only bars,kinetic] [--sketches]
  viewer [folders…] [--serve] [--port 4317] [--out build/viewer] [--no-render] [--projects projects] [--no-agent]
                                      one page: films, versions and sticky notes; with --serve, the studio: new films from an
                                      idea, an agent conversation per film, notes sent to it (docs/viewer.md, docs/agent-studio.md)
  agent [status|doctor|start|stop]    the studio's isolated OpenCode runtime (docs/agent-studio.md)
  studio <dir> [state|history|undo|redo|set PATH VALUE [--beat ID]|insert BLOCK [--beat AFTER]|sketch NAME|move --beat ID --to N|duplicate|delete --beat ID|treatment ID] [--json]
                                      the studio's validated, undoable edits from the command line (shared history with the UI)
  plan <dir>                          approximate generation cost and cache state
  voice <dir> [--draft] [--dry-run]    free local voice, or Gemini 3.8 TTS as one continuous take (--dry-run prints the request)
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
  world <dir> [--name NAME] [--out image.png]   the whole canvas world with every beat's camera rect numbered
  sheet <dir> [--per 1|2|3] [--grid] [--draft] [--out sheet.png]   --grid: labelled 100 px coordinates for placing art
  looks <dir> [--beat id] [--draft]    compare the same frame in every palette
  review <dir> [--beat id] [--video film.mp4]  decoded cut/word-boundary filmstrip
  qa <dir> [--video film.mp4] [--loop]  time bugs in the encoded film: one-frame pops, held stretches,
                                      world seams, export tags, loudness, the drop; timeline + phone sheets
  beatmap <dir | track>               the music's tempo and measured drop, and each cut against its beat grid
  render | preview <dir> [--draft] [--rough] [--scale 0.5] [--out film.mp4] [--no-audio] [--force]
  pipeline <dir> [--draft] [--scale 0.5] [--no-render]   saved production pass: checks, sheet, encode, QA, boundary review
  draft <dir> [--rough] [--no-render] [--scale 0.5]   one pass, one queue wait: critique, draft voice, check, sheet, draft MP4

Review and edit (docs/editing.md; state in DIR/review/)
  paper <dir> [--suggest-cuts]        the paper edit: chapters, timecodes, speakers, intended pictures, transcript
  preview <dir> --beats a[,b] | --range 1:10-1:20 | --note n001 | --chapter NAME [--handles 2] [--rough]
                                      render just that stretch of the full timeline (audio cut from the full mix)
  revisions | snapshot <dir> [--label TEXT]   list revisions / save the working copy as one (renders save one too)
  diff <dir> [rA] [rB|working]        what changed: content, appearance via neighbours or film settings, timing only
  note <dir> "text" [--at 2:13 [--to 2:20]] [--rev r003] [--beat ID] [--element ID] [--keep voice,words] [--scope beat|range|chapter|film] [--by NAME | --agent]
  notes <dir> [--import notes.json] [--rev rNNN] [--json]   notes and where each one is now (current, moved, changed, stale, orphaned, addressed)
  revise <dir> --note n001 [--scope ID,ID --reason TEXT | --scope film] [--override k001]
                                      candidate revision + before/after passages + impact report (review/compare/)
  compare <dir> rA [rB]               before/after page for two revisions (or rA and the working copy)
  page <dir> [--rev r002]             write the review page (review/index.html): player, transcript, notes
  accept | reject <dir> rNNN [--note n001 | --beats a,b | --checkpoint rough|final] --by NAME --said "their words"
  decide <dir> rNNN --checkpoint rough|final --reason TEXT    one-shot: an agent decision, never shown as acceptance
  keep <dir> voice|words|facts|picture|look [--beats a,b | --at 2:13 [--to 2:40] | --chapter NAME] --by NAME --said TEXT
  keep <dir> --release k001 --by NAME | keeps <dir>    override <dir> --keep k001 --rev rNNN --by NAME --said TEXT
  restore <dir> rNNN [--beats a,b [--shared]] (--by NAME --said TEXT | --agent --reason TEXT)   saves the current state first
  cut <dir> --words "…" [--beat ID] [--nth N] | --beat ID --sentence N | --at 2:13 [--rev r003] | --note n001
            | --pauses-over 1.2 [--keep-pause 0.5] [--beats a,b] | --paper review/paper-edit.md
            [--by NAME | --agent] [--dry-run]   cut recorded words from the source recording (undo: uncut)
  uncut <dir> --cut c001 | --beat ID   split <dir> --beat ID --before "words"   merge <dir> ID ID
  runlog <dir> [--json]               measured command and phase times; gaps between commands are not measured work

Library: palettes, treatments, sketches and playbooks are files in library/ (see library/README.md).
A project's own library/ overrides them by id; --library DIR (or CLEARFRAME_LIBRARY) adds a shared one.

The renderer is scene/native (Skia on Metal; docs/scene-engine.md); build compiles it when its sources
change, and every render command does so too. Preview produces a review MP4.
Draft permits estimated timing; --scale 0.25–1 reduces review resolution only (default 1).
Rough (--rough, a draft for first review) also renders declared placeholders (a beat's "placeholder", or a
generated asset not paid for yet) as labelled slates, and canvas/art elements marked "unfinished" as drawn.
Only frame-audit findings about that declared text become "craft"; every other type, source, figure, audio,
timing and schema check still fails. Every full render saves a revision in review/revisions/.
Native work automatically uses the local codex-heavy gate when available.
Paid generation needs GEMINI_API_KEY; rendering and word-file imports are free.
`;
async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const strings = [
    'duration',
    'scale',
    'idea',
    'document',
    'brand',
    'audience',
    'takeaway',
    'seed',
    'mode',
    'library',
    'title',
    'theme',
    'playbook',
    'recipe',
    'treatment',
    'direction',
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
    'phase-seconds',
    'port',
    'script',
    'model',
    'definition',
    'assets',
    'note',
    'rev',
    'scope',
    'reason',
    'handles',
    'range',
    'beats',
    'chapter',
    'element',
    'keep',
    'by',
    'said',
    'cut',
    'sentence',
    'pauses-over',
    'keep-pause',
    'paper',
    'import',
    'status',
    'label',
    'override',
    'nth',
    'before',
    'release',
    'checkpoint',
    'projects',
  ];
  const booleans = [
    'still',
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
    'dry-run',
    'light',
    'loop',
    'verify',
    'serve',
    'rough',
    'agent',
    'no-verify',
    'suggest-cuts',
    'shared',
    'no-agent',
  ];
  const { values: o, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: Object.fromEntries([
      ...strings.map(k => [k, { type: 'string', ...(k === 'document' ? { multiple: true } : {}) }]),
      ...booleans.map(k => [k, { type: 'boolean' }]),
    ]),
  });
  if (!cmd || cmd === 'help' || o.help) return console.log(HELP);
  // --library DIR layers a shared library (brand kit, team templates) like CLEARFRAME_LIBRARY.
  if (o.library) {
    process.env.CLEARFRAME_LIBRARY = [process.env.CLEARFRAME_LIBRARY, path.resolve(o.library)]
      .filter(Boolean)
      .join(path.delimiter);
    useProject(null);
  }
  // Compilation, retained pipelines and 3D asset passes enter the shared gate.
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
    at: o.at == null ? undefined : parseTime(o.at),
    pos: num('pos'),
    scale: num('scale'),
    per: num('per'),
    columns: num('columns'),
    thumb: num('thumb'),
    noAudio: o['no-audio'],
  };
  if (opts.scale != null) {
    if (!['render', 'preview', 'draft', 'pipeline'].includes(cmd)) throw new Error('--scale is only supported by render, preview, draft and pipeline');
    const { renderGeometry } = await import('../film/render-geometry.mjs');
    renderGeometry({ width: 1920, height: 1080 }, { scale: opts.scale, draft: o.draft || ['preview', 'draft'].includes(cmd) });
  }
  if (opts.budget != null && opts.budget < 0) throw new Error('budget must be nonnegative');
  // `--seed random` draws a seed (and reports it); any integer reproduces a draw.
  if (o.seed != null) {
    opts.seed = o.seed === 'random' ? Math.floor(Math.random() * 100000) : Number(o.seed);
    if (!Number.isInteger(opts.seed)) throw new Error('--seed must be an integer or "random"');
  }
  if (cmd === 'asset-anchors') {
    if (!positionals[0] || !o.definition || !o.out) throw new Error('asset-anchors needs ASSET-DIR --definition FILE --out NEW-JSON');
    const { enterGate } = await import('./lib/resource-gate.mjs');
    if (await enterGate()) return;
    const { exportAssetAnchors } = await import('./lib/asset-anchors.mjs');
    const result = await exportAssetAnchors({assetDir:positionals[0],definition:JSON.parse(fs.readFileSync(o.definition,'utf8')),out:o.out});
    return console.log(o.json ? JSON.stringify(result,null,2) : `${result.anchors.length} static anchors; ${result.copyZones.length} copy zones; ${result.checks.frames} source frames checked: ${path.resolve(o.out)}`);
  }
  if (cmd === 'sculptures') {
    const { sculptures } = await import('./lib/sculptures.mjs');
    const found = sculptures();
    return console.log(o.json ? JSON.stringify(found, null, 2) : found.map(s =>
      `${s.id.padEnd(22)} ${s.title}\n  ${s.use}\n  ${s.description}\n  ${s.theme} palette · ${s.duration}s ${s.loop ? 'loop' : 'reveal'} · ${s.copy}`,
    ).join('\n\n'));
  }
  if (cmd === 'sculpture') {
    const { sculptureConfig, renderSculpture } = await import('./lib/sculptures.mjs');
    const settings = { ...opts, duration: num('duration'), fps: num('fps') };
    if (o['phase-seconds'] !== undefined) settings.phaseSeconds = JSON.parse(fs.readFileSync(o['phase-seconds'], 'utf8'));
    const config = sculptureConfig(positionals[0], settings);
    if (o['dry-run']) return console.log(JSON.stringify(config, null, 2));
    if (!o.out) throw new Error('sculpture needs --out NEW-DIRECTORY.');
    if (o.json) process.env.CLEARFRAME_PROGRESS_STDERR = '1';
    const { enterGate } = await import('./lib/resource-gate.mjs');
    if (await enterGate()) return;
    const report = await renderSculpture(positionals[0], o.out, settings);
    return console.log(o.json ? JSON.stringify(report, null, 2) :
      `${report.title}: ${report.status} in ${report.seconds.toFixed(1)}s. Assets and receipt: ${path.resolve(o.out)}`);
  }
  if (cmd === 'muse') {
    const { muse, museMarkdown } = await import('../film/muse.mjs');
    const m = muse(opts.seed ?? Math.floor(Math.random() * 100000), { dark: !o.light });
    return console.log(o.json ? JSON.stringify(m, null, 2) : museMarkdown(m));
  }
  if (cmd === 'start') {
    if (!positionals[0]) throw new Error('start needs a new project directory');
    const { startProject } = await import('./lib/start.mjs');
    const r = startProject(positionals[0], opts);
    return console.log(o.json ? JSON.stringify(r, null, 2) :
      `Created ${positionals[0]}: ${r.inputs.length} document, ${r.assets.length} brand assets. Read BRIEF.md${r.evidence ? ' and EVIDENCE.md' : ''}; rewrite the sample beats, then run critique and draft.`);
  }
  if (cmd === 'new') {
    const dir = path.resolve(positionals[0] ?? 'my-video');
    const sb = scaffold(dir, opts);
    const rel = path.relative(process.cwd(), dir) || '.';
    return console.log(
      `Created ${rel} (${sb.beats.length} beats, ${typeof sb.theme === 'string' ? sb.theme : sb.theme.base} palette). Replace the illustrative claims, then:\n  clearframe sheet ${rel} --draft     # contact sheet to review\n  clearframe voice ${rel} --draft     # free local narration\n  clearframe render ${rel} --draft    # fast review MP4`,
    );
  }
  if (cmd === 'directions') {
    const found = directions(positionals[0]);
    if (!found.length) throw new Error(`No directions for ${positionals[0]}. Run clearframe directions to list all.`);
    return console.log(o.json ? JSON.stringify(found, null, 2) : found.map(d =>
      `${d.id.padEnd(23)} ${d.title}\n  ${d.when}\n  Story: ${d.story}\n  Picture: ${d.picture}\n  Pace: ${d.pace}\n  Start: ${d.playbook} + ${d.treatment}`,
    ).join('\n\n') + '\n\nUse --direction ID with new, start or ingest. Override --playbook, --treatment or --theme independently. Every scene remains editable; add your own JSON directions in --library DIR.');
  }
  if (['playbooks', 'recipes'].includes(cmd))
    return console.log(
      o.json
        ? JSON.stringify(playbooks(), null, 2)
        : playbooks()
            .map(p => `${p.id.padEnd(24)} ${p.title}\n  ${p.audience} · ${p.inputs}`)
            .join('\n'),
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
        ? JSON.stringify(treatments(), null, 2)
        : treatments()
            .map(
              t =>
                `${t.id.padEnd(11)} ${t.title}\n            ${t.when}\n            ${[t.film.theme, `type ${t.film.type ?? 'inter'}`, t.film.motion?.preset, t.film.transition, t.film.frame && 'frame', t.beats?.rough && 'rough strokes', t.film.sfx && t.film.sfx !== 'off' && `sfx ${t.film.sfx}`].filter(Boolean).join(' · ')}`,
            )
            .join('\n') + '\n\nclearframe new DIR --playbook NAME --treatment ID applies one and writes DIRECTION.md.',
    );
  if (cmd === 'types')
    return console.log(
      o.json
        ? JSON.stringify(types(), null, 2)
        : types()
            .map(
              t =>
                `${t.id.padEnd(11)} ${t.title}\n            ${t.when}\n            ${[t.display, `emphasis ${t.emphasis ?? 'accent'}`, t.case === 'upper' && 'capitals'].filter(Boolean).join(' · ')}`,
            )
            .join('\n') +
          '\n\nA treatment sets film.type; a storyboard or one beat can set "type" too. Body copy, labels and counters stay in Inter.',
    );
  if (cmd === 'sketch') {
    if (!positionals[0])
      return console.log(
        sketches()
          .map(s => `${s.name.padEnd(10)} ${s.summary}\n           Use for: ${s.use}`)
          .join('\n') +
          '\n\nclearframe sketch NAME [--vertical] prints canvas props to adapt; ambient prints an art.under layer.',
      );
    // A system diagram prints its editable source, not hundreds of compiled shapes.
    const source = sketchByName(positionals[0]);
    if (source?.diagram) return console.log(JSON.stringify({ title: 'Your headline', diagram: source.diagram }, null, 1));
    return console.log(JSON.stringify(sketch(positionals[0], o.vertical ? 'vertical' : 'landscape'), null, 1));
  }
  if (cmd === 'motions')
    return console.log(
      JSON.stringify(
        {
          presets: MOTIONS,
          intensity: '0–1',
          transitions: TRANSITIONS,
          exits: 'auto (mirror the next entrance) | none | fade | push | zoom | wipe | panel | iris | whip',
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
  if (cmd === 'build') {
    return console.log(await native.buildScene(opts));
  }
  if (cmd === 'viewer') {
    const { buildViewer, serveViewer } = await import('./lib/viewer.mjs');
    const root = positionals.length ? positionals : ['examples', 'real-examples'];
    if (o.serve) {
      const s = await serveViewer({ root, out: o.out ?? 'build/viewer', render: !o['no-render'], port: num('port') ?? 4317, projects: o.projects, agent: !o['no-agent'] });
      console.log(`${s.films} film(s), ${s.versions} version(s). Studio: http://127.0.0.1:${s.server.address().port}/\nNew films go to ${path.relative(process.cwd(), s.projects) || '.'}/${s.agent ? '; the agent runtime (OpenCode) starts with the first conversation' : ''}.\nPress Ctrl+C to stop.`);
      return new Promise(() => {});
    }
    const r = await buildViewer({ root, out: o.out ?? 'build/viewer', render: !o['no-render'] });
    return console.log(`${r.films} film(s), ${r.versions} version(s) → ${path.relative(process.cwd(), r.file)}\nOpen it in a browser (double-click works) to watch and take notes, or run with --serve to work with the agent.`);
  }
  if (cmd === 'agent') {
    // The studio's OpenCode runtime: isolated folders, the service, its model catalog (docs/agent-studio.md).
    const { createRuntime, agentPaths, opencodeBinary, OPENCODE_VERSION, DEFAULT_MODEL } = await import('./lib/agent/runtime.mjs');
    const verb = positionals[0] ?? 'status', paths = agentPaths(), rt = createRuntime();
    const { Service } = await import('@opencode/client/service');
    if (verb === 'stop') { await rt.stop(); return console.log('Stopped the studio\'s OpenCode service. Conversations are kept and resume when it next starts.'); }
    if (verb === 'start') { await rt.client(); const list = await rt.catalog(); const s = rt.status(); console.log(`OpenCode ${s.version} running (pid ${s.pid}); catalog ${s.catalog}, ${list.length} models; default ${DEFAULT_MODEL.providerID}/${DEFAULT_MODEL.id}.`); if (s.hint) console.log(s.hint); return process.exit(0); }
    const running = await Service.discover({ file: paths.registration }).catch(() => null);
    const rows = [
      ['OpenCode binary', opencodeBinary(), fs.existsSync(opencodeBinary()) ? 'present' : 'MISSING: run npm install'],
      ['Version', OPENCODE_VERSION, ''],
      ['Studio state', paths.state, 'never served; holds the runtime folders and bridge token'],
      ['Runtime data (sessions, saved credentials)', paths.env.XDG_DATA_HOME, ''],
      ['Service registration', paths.registration, running ? 'running' : 'not running'],
      ['Config', paths.config, ''],
      ['Log', path.join(paths.env.XDG_DATA_HOME, 'opencode', 'log'), ''],
      ['Default model', `${DEFAULT_MODEL.providerID}/${DEFAULT_MODEL.id}`, 'free (OpenCode Zen)'],
    ];
    if (verb === 'doctor' || verb === 'status') return console.log(o.json ? JSON.stringify(Object.fromEntries(rows.map(([k, v, n]) => [k, { value: v, note: n }])), null, 2) : rows.map(([k, v, n]) => `${k.padEnd(44)} ${v}${n ? `  (${n})` : ''}`).join('\n'));
    throw new Error('agent [status|doctor|start|stop]');
  }
  if (cmd === 'gallery') {
    const dir = path.resolve(positionals[0] ?? 'build/native-gallery');
    await writeGallery(dir, opts);
    return console.log(await native.sheetProject(dir, { ...opts, draft: true, per: 1, columns: 4 }));
  }
  if (cmd === 'ingest') {
    const { ingestMarkdown, ingestRecording } = await import('./lib/ingest.mjs');
    const { vendor } = await import('../film/library.mjs');
    const { applyTreatment, directionTemplate, treatmentById } = await import('../film/treatments.mjs');
    const chosen = directionOptions(opts);
    if (chosen.treatment && !treatmentById(chosen.treatment)) throw new Error(`Unknown treatment ${chosen.treatment}`);
    const dir = path.resolve(positionals[0] ?? '.');
    startRun(dir, cmd, args);
    if (o.markdown) {
      const { storyboardFor, artSketches } = await import('../film/playbooks.mjs');
      // A film look starts from its genre's shots (cinematic → cinematic-explainer), not a deck.
      const playbook = chosen.playbook ?? (chosen.treatment && treatmentById(chosen.treatment)?.playbook) ?? 'research-digest';
      const r = ingestMarkdown(dir, o.markdown, {
        playbook,
        scaffold: (id, opts) => {
          const sb = storyboardFor(id, { ...opts, theme: o.theme, vertical: o.vertical });
          if (chosen.treatment) {
            applyTreatment(sb, chosen.treatment);
            if (o.theme) sb.theme = o.theme;
          }
          fs.writeFileSync(
            path.join(dir, 'DIRECTION.md'),
            directionTemplate(sb, chosen.treatment ? treatmentById(chosen.treatment) : null) + directionMarkdown(o.direction),
          );
          // Art sketches stay as shorthand until the job; shared ones travel with the project.
          vendor(dir, [...artSketches(sb), ...directionRefs(o.direction, [['treatments', chosen.treatment], ['playbooks', playbook]]),
            ['palettes', typeof sb.theme === 'string' ? sb.theme : sb.theme?.base], ['types', sb.type]]);
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
        treatment: chosen.treatment,
        direction: chosen.direction,
        playbook: chosen.playbook,
        brand: o.brand,
      });
      return console.log(
        `Imported ${r.beats} beats (${r.duration}s, ${r.words} words${r.speakers.length ? `, speakers ${r.speakers.join(', ')}` : ''}${r.interpolated != null ? `; script aligned, ${r.interpolated} word(s) interpolated` : ''}) into ${path.relative(process.cwd(), dir)}. Read BRIEF.md, then give the beats pictures.`,
      );
    }
    throw new Error('ingest needs --markdown FILE or --audio FILE --words FILE');
  }
  if (cmd === 'beatmap' && positionals[0] && fs.statSync(positionals[0]).isFile()) {
    const { analyseTrack } = await import('./lib/beatmap.mjs');
    const r = analyseTrack(path.resolve(positionals[0]));
    if (o.json) return console.log(JSON.stringify(r, null, 2));
    return console.log(beatmapText(r));
  }
  const dir = resolveProject(positionals[0]);
  if (cmd === 'studio') {
    // The studio's own commands: the same validation, stale-write check and undo history as the UI.
    const { studioState, studioCommand } = await import('./lib/viewer/studio.mjs');
    const [, verb = 'state', ...rest] = positionals;
    const value = v => { try { return JSON.parse(v); } catch { return v; } };
    const show = s => console.log(o.json ? JSON.stringify(s, null, 2) : [
      `${s.storyboard.beats.length} scenes · ${s.timing?.duration ?? '?'} s${s.timing?.estimated ? ' (narration timing estimated)' : ''}`,
      s.errors.length ? `the engine refuses this working copy:\n  ${s.errors.join('\n  ')}` : 'the engine accepts this working copy',
      `undo: ${s.undoLabel ?? '—'} · redo: ${s.redoLabel ?? '—'}${s.externalChanges ? ' · edited outside the studio since its last command' : ''}`,
    ].join('\n'));
    if (verb === 'state') return show(studioState(dir));
    if (verb === 'history') return console.log(studioState(dir).history.map(h => `${h.applied ? '•' : '○'} ${h.at.slice(0, 19).replace('T', ' ')}  ${h.label}`).join('\n') || 'No studio edits yet.');
    const body = ['undo', 'redo'].includes(verb) ? { command: verb }
      : verb === 'set' ? { command: 'set', target: o.beat ? 'beat' : 'film', beat: o.beat, path: rest[0], value: rest.length > 1 ? value(rest.slice(1).join(' ')) : null }
      : verb === 'insert' ? { command: 'insert', block: rest[0], after: o.beat }
      : verb === 'sketch' ? { command: 'insert', sketch: rest[0], after: o.beat }
      : verb === 'move' ? { command: 'move', beat: o.beat, to: Number(o.to) - 1 }
      : ['duplicate', 'delete'].includes(verb) ? { command: verb, beat: o.beat }
      : verb === 'treatment' ? { command: 'treatment', id: rest[0] }
      : null;
    if (!body) throw new Error('studio DIR [state|history|undo|redo|set PATH VALUE [--beat ID]|insert BLOCK|sketch NAME [--beat AFTER]|move --beat ID --to N|duplicate|delete --beat ID|treatment ID]');
    return show(studioCommand(dir, { ...body, hash: studioState(dir).hash }));
  }
  startRun(dir, cmd, args);
  if (REVIEW.has(cmd)) return reviewCommand(cmd, dir, o, opts, positionals);
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
  if (cmd === 'pipeline') {
    if (o.json) process.env.CLEARFRAME_PROGRESS_STDERR = '1';
    const { enterGate } = await import('./lib/resource-gate.mjs');
    if (await enterGate()) return;
    const { runPipeline } = await import('./lib/pipeline.mjs');
    const report = await runPipeline(dir, { draft: o.draft, scale: opts.scale, noRender: o['no-render'] });
    return console.log(o.json ? JSON.stringify(report, null, 2) :
      `${report.status}: ${path.join(report.dir, 'REPORT.md')}\n${report.seconds.toFixed(1)} s · ${report.reviewQueue.length} review items${report.artifacts.video ? `\nVideo: ${report.artifacts.video}` : ''}`);
  }
  if (cmd === 'draft') {
    // Everything a review round needs, inside a single gate entry, with a compact report.
    const t0 = performance.now(),
      rel = f => path.relative(process.cwd(), f),
      lines = [];
    const { critique } = await import('./lib/critique.mjs');
    const c = critique(dir);
    lines.push(
      `critique: cinema ${c.summary.cinema}/100, ${c.summary.warnings} warning(s), ${c.summary.ideas} idea(s)`,
      ...c.findings.slice(0, 8).map(f => `  ${f.level === 'warn' ? '!' : '·'} ${f.where}: ${f.message}`),
    );
    const g = await import('./lib/generate.mjs');
    const { phase } = await import('./lib/runlog.mjs');
    await phase('voice', () => g.voice(dir, { draft: true }));
    // --rough: the first full-length look. Declared placeholders render as slates; only audit
    // findings about declared stand-ins become craft; every other check still blocks.
    const rough = !!o.rough;
    const r = await native.checkProject(dir, { draft: true, rough });
    lines.push(
      `check${rough ? ' (rough)' : ''}: ${r.errors.length} error(s), ${r.warnings.length} warning(s)${rough ? `, ${r.craft.length} craft finding(s) left for later, ${r.placeholders.length} placeholder(s)` : ''}`,
      ...r.errors.map(e => `  ✗ ${e}`),
      ...r.craft.slice(0, 6).map(e => `  ~ ${e}`),
      ...r.warnings.slice(0, 6).map(w => `  ! ${w}`),
    );
    if (r.errors.length) {
      process.exitCode = 1;
      return console.log(lines.join('\n'));
    }
    const findings = (r.notes.join('\n').match(/^Warning .*$/gm) ?? []).slice(0, 6);
    if (findings.length) lines.push('native:', ...findings.map(f => `  ${f}`));
    // A long film's rough cut is judged in motion; one frame per beat is enough of a sheet.
    lines.push(`sheet: ${rel(await native.sheetProject(dir, { draft: true, rough, ...(rough ? { per: 1, columns: 6 } : {}) }))}`);
    if (!o['no-render']) {
      const v = await native.renderProject(dir, { draft: true, rough, scale: opts.scale, check: r, label: o.label ?? (rough ? 'Rough cut' : undefined) });
      lines.push(
        `video: ${rel(path.join(dir, 'build/video.mp4'))} (${v.frames} frames, ${v.seconds.toFixed(1)} s to render)${v.revision ? ` · revision ${v.revision}` : ''}`,
      );
      const { writeReviewPage } = await import('./lib/review-page.mjs');
      lines.push(`review page: ${rel(writeReviewPage(dir))}`);
    }
    lines.push(`done in ${((performance.now() - t0) / 1000).toFixed(1)} s. Open the sheet before anything else.`);
    return console.log(lines.join('\n'));
  }
  if (cmd === 'checkpoints') {
    const { checkpoints, coverage } = await import('./lib/checkpoints.mjs');
    const guided = (o.mode ?? 'guided') !== 'one-shot';
    const list = checkpoints(dir, { mode: guided ? 'guided' : 'one-shot' });
    const chapters = coverage(dir);
    if (o.json)
      return console.log(JSON.stringify({ mode: guided ? 'guided' : 'one-shot', checkpoints: list, coverage: chapters }, null, 2));
    const next = list.find(c => !c.done);
    if (chapters.length > 1)
      console.log(
        [
          'Coverage by chapter:',
          ...chapters.map(
            c =>
              `  ${c.chapter.slice(0, 24).padEnd(24)} ${String(c.beats).padStart(3)} beats · ${c.pictured} with a picture · ${c.placeholders} placeholder(s)${c.unfinished ? ` · ${c.unfinished} unfinished element(s)` : ''} · ${c.accepted} accepted`,
          ),
          '',
        ].join('\n'),
      );
    return console.log(
      [
        `${guided ? 'Guided: stop and ask the person at each open checkpoint.' : 'One-shot: decide each open checkpoint yourself, log it under "## Decisions" in DIRECTION.md (rough cut and final: decide DIR rNNN), and publish the review page; spend still needs a budget.'}`,
        ...list.map(c => `${c.done ? '✓' : '○'} ${c.name.padEnd(15)} ${c.detail}`),
        next
          ? `\nNext: ${next.name}. ${guided || next.id === 'spend' ? `Ask: "${next.question}"` : 'Decide, then log what you chose and why.'}`
          : '\nEvery checkpoint is closed.',
      ].join('\n'),
    );
  }
  if (cmd === 'critique') {
    const { critique } = await import('./lib/critique.mjs');
    const r = critique(dir);
    if (o.json) return console.log(JSON.stringify(r, null, 2));
    const s = r.summary;
    console.log(
      `cinema ${s.cinema}/100 · ${s.beats} beats · ${s.seconds}s · ${s.families} scene families · ${s.drawn} drawn · ${s.imaged} with imagery · ${s.graphicTransitions} graphic transitions · ${s.tones} colour blocks`,
    );
    return console.log(
      r.findings.length
        ? r.findings
            .map(
              f => `${f.level === 'error' ? '✗' : f.level === 'warn' ? '!' : '·'} ${f.where.padEnd(18)} ${f.message}`,
            )
            .join('\n')
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
  if (cmd === 'world') return console.log(await native.worldMap(dir, { ...opts, draft: true }));
  if (cmd === 'sheet') return console.log(await native.sheetProject(dir, opts));
  if (cmd === 'looks') return console.log(await native.lookbookProject(dir, opts));
  if (cmd === 'review') {
    const { reviewProject } = await import('./lib/review.mjs');
    return console.log(await reviewProject(dir, opts));
  }
  if (cmd === 'qa') {
    const { qaProject } = await import('./lib/qa.mjs');
    const r = await qaProject(dir, { video: o.video, loop: o.loop });
    if (o.json) return console.log(JSON.stringify(r, null, 2));
    const s = r.summary,
      rel = f => path.relative(process.cwd(), f);
    console.log(
      `${s.seconds}s · change ${s.changePerSecond}/s (viral references 8–42; under 2 reads as held) · held ${s.heldSeconds}s · ${s.pops} pop(s) · ${s.loudness ? `${s.loudness.integrated} LUFS, peak ${s.loudness.peak}` : 'no audio'} · ${s.color}`,
    );
    for (const f of r.findings)
      console.log(
        `${f.level === 'error' ? '✗' : f.level === 'warn' ? '!' : '·'} ${(f.t != null ? `${f.t}s${f.beat ? ` ${f.beat}` : ''}` : f.kind).padEnd(22)} ${f.message}`,
      );
    console.log(
      `${rel(path.join(r.dir, 'timeline.png'))} (one frame per second) · ${rel(path.join(r.dir, 'phone.png'))} (360 px: read it as a phone would)`,
    );
    if (r.findings.some(f => f.level === 'error')) process.exitCode = 1;
    return;
  }
  if (cmd === 'beatmap') {
    const { analyseTrack, cutsOnGrid } = await import('./lib/beatmap.mjs');
    const { computeTiming } = await import('./lib/timing.mjs');
    const timing = computeTiming(dir);
    if (!timing.music?.src) throw new Error('No music bed yet: run music DIR --draft, or set music.file.');
    const r = analyseTrack(path.join(dir, timing.music.src));
    const grid = r.tempo ? cutsOnGrid(timing.beats, r.tempo, timing.music.offset) : [];
    if (o.json) return console.log(JSON.stringify({ ...r, music: timing.music, cuts: grid }, null, 2));
    const off = timing.music.offset;
    const lines = [beatmapText(r)];
    if (r.drop)
      lines.push(
        timing.music.drop
          ? `drop plays at ${timing.music.drop.film}s (beat ${timing.music.drop.beat})`
          : `drop plays at ${Math.round((r.drop.t - off) * 100) / 100}s of the film; land it on the key picture with "music": {"drop": {"beat": "ID"}}`,
      );
    if (grid.length)
      lines.push(
        `cuts against the beat (ms after the nearest beat; within ±60 reads as on the beat):`,
        ...grid.map(
          c =>
            `  ${String(c.t).padStart(6)}s ${c.id.padEnd(18)} ${c.ms > 0 ? '+' : ''}${c.ms}${Math.abs(c.ms) <= 60 ? '  ✓' : ''}`,
        ),
      );
    return console.log(lines.join('\n'));
  }
  if (cmd === 'preview' && (o.beats || o.range || o.note || o.chapter)) return reviewCommand('range', dir, o, opts, positionals);
  if (cmd === 'render' || cmd === 'preview') {
    const report = await native.renderProject(dir, { ...opts, draft: cmd === 'preview' || o.draft });
    const { writeReviewPage } = await import('./lib/review-page.mjs');
    report.reviewPage = writeReviewPage(dir);
    return console.log(JSON.stringify(report, null, 2));
  }
  throw new Error(`Unknown command ${cmd}. Run clearframe help.`);
}
function beatmapText(r) {
  const t = r.tempo;
  return [
    `${r.seconds}s of music`,
    t ? `tempo ${t.bpm} BPM (or ${t.alternatives.join(' / ')}: listen), first beat at ${t.phase}s` : 'no steady tempo',
    r.drop
      ? `drop at ${r.drop.t}s in the song (bass +${r.drop.jump} dB)`
      : 'no drop: the bass never jumps and stays up',
  ].join(' · ');
}
main()
  .then(() => finishRun())
  .catch(e => {
    finishRun({ error: e });
    console.error(`ClearFrame: ${e.message}`);
    process.exitCode = 1;
  });
