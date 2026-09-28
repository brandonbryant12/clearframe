#!/usr/bin/env node
// ClearFrame CLI — `clearframe <command> [project] [options]`
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { resolveProject } from './lib/project.mjs';
import { color, log, REPO_DIR, writeJSON } from './lib/util.mjs';

const HELP = `
${color.bold('ClearFrame')} — code-rendered motion graphics for calm, precise explainers.

  ${color.bold('Create')}
    new <dir> [--recipe name | --template explainer|vertical] [--title "…"]   scaffold a project
    recipes                             list ready-made storyboards (made entirely of blocks)
    blocks [name] [--json]              the block library: what each does, its props, an example
    icons <query>                       search 2,000+ Lucide icon names (for blocks that take "icon")
    gallery [dir] [--vertical]          render every block into a catalog grid PNG
    preview [dir] [--port 4173] [--open]                        live preview with player + audio
    doctor                              check ffmpeg, Chrome, fonts, draft voice, API key

  ${color.bold('Sound & assets')}  (cached by content hash — nothing is paid for twice)
    plan [dir]                          what generation would cost, what's cached
    voice [dir] [--draft] [--only a,b] [--force] [--budget 2]   narration per beat (Gemini TTS; --draft = free OS voice)
    music [dir] [--draft] [--force]     music bed shaped to the edit (Lyria; --draft = synthesized pad)
    images [dir] [--only id] [--force]  storyboard image assets (Gemini image)
    clips [dir] [--only id] [--force]   storyboard footage assets (Veo 3.1 Lite by default)

  ${color.bold('Look & verify')}
    timing [dir]                        beat table (start, length, voice, pace)
    captions [dir]                      export build/captions.srt + .vtt from the narration timing
    still [dir] --at 12.5 | --beat id [--pos 0.6] [--out f.png]
    sheet [dir] [--per 3] [--grid 4]    contact sheet PNG of the whole film (read it!); --grid = one frame per beat
    check [dir]                         automated QA: pacing, safe areas, overflow, sources, dead air

  ${color.bold('Deliver')}
    render [dir] [--draft] [--lossless] [--workers n] [--from s] [--to s] [--no-audio] [--out f.mp4]

  Project defaults to the current directory. GEMINI_API_KEY is only needed for paid generation.
`;

const [cmd, ...rest] = process.argv.slice(2);
const { values: o, positionals } = parseArgs({
  args: rest,
  allowPositionals: true,
  options: {
    template: { type: 'string', default: 'explainer' }, title: { type: 'string' }, port: { type: 'string', default: '4173' }, open: { type: 'boolean' },
    draft: { type: 'boolean' }, force: { type: 'boolean' }, only: { type: 'string' }, budget: { type: 'string' },
    at: { type: 'string' }, beat: { type: 'string' }, pos: { type: 'string' }, out: { type: 'string' }, per: { type: 'string' }, thumb: { type: 'string' },
    workers: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, 'no-audio': { type: 'boolean' }, scale: { type: 'string' }, lossless: { type: 'boolean' },
    json: { type: 'boolean' }, md: { type: 'boolean' }, recipe: { type: 'string' }, grid: { type: 'string' }, vertical: { type: 'boolean' }, theme: { type: 'string' }, 'no-voice': { type: 'boolean' },
  },
});
const dir = () => resolveProject(positionals[0] ?? '.');
const num = (v) => (v == null ? undefined : parseFloat(v));
const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);

async function main() {
  switch (cmd) {
    case 'new': {
      const target = path.resolve(positionals[0] ?? 'my-video');
      const base = o.recipe ? 'recipes' : 'templates';
      const name = o.recipe ?? o.template;
      const tpl = path.join(REPO_DIR, base, name);
      if (!fs.existsSync(tpl)) throw new Error(`No ${o.recipe ? 'recipe' : 'template'} "${name}". Available: ${fs.readdirSync(path.join(REPO_DIR, base)).filter((f) => !f.startsWith('.') && !f.endsWith('.md')).join(', ')}`);
      if (fs.existsSync(target) && fs.readdirSync(target).length) throw new Error(`${target} is not empty`);
      fs.cpSync(tpl, target, { recursive: true });
      if (o.title) {
        const f = path.join(target, 'storyboard.json');
        const sb = JSON.parse(fs.readFileSync(f, 'utf8'));
        sb.title = o.title;
        writeJSON(f, sb);
      }
      fs.rmSync(path.join(target, 'build'), { recursive: true, force: true });
      fs.rmSync(path.join(target, 'assets'), { recursive: true, force: true });
      log.ok(`Created ${path.relative(process.cwd(), target) || '.'} from ${o.recipe ? 'recipe' : 'template'} "${name}"`);
      log.dim(`  next: edit storyboard.json → clearframe voice ${positionals[0] ?? 'my-video'} --draft → clearframe preview ${positionals[0] ?? 'my-video'}`);
      return;
    }
    case 'recipes': {
      const dir = path.join(REPO_DIR, 'recipes');
      for (const r of fs.readdirSync(dir).filter((f) => fs.existsSync(path.join(dir, f, 'storyboard.json')))) {
        const sb = JSON.parse(fs.readFileSync(path.join(dir, r, 'storyboard.json'), 'utf8'));
        console.log(`  ${color.bold(r.padEnd(22))} ${color.dim(`${sb.format?.preset ?? 'landscape'} · ${sb.beats.length} beats`)}  ${sb.logline ?? sb.title}`);
      }
      log.dim('  clearframe new my-video --recipe <name>');
      return;
    }
    case 'blocks': {
      const { listBlocks } = await import('./lib/catalog.mjs');
      const all = await listBlocks();
      const one = positionals[0] && all.find((b) => b.name === positionals[0]);
      if (positionals[0] && !one) throw new Error(`No block "${positionals[0]}". Try: clearframe blocks`);
      if (o.json) return console.log(JSON.stringify(one ?? all, null, 2));
      if (o.md) { // generated reference (skills/clearframe-library/references/blocks.md)
        const lines = ['# Block reference', '', '_Generated from each block\'s `meta` by `clearframe blocks --md` — do not edit by hand._', '',
          'Use a block by naming it on a beat: `{ "id": "…", "block": "<name>", "vo": "…", "props": { … } }`. Text props accept `*emphasis*` (accent) and `**strong**`. Any prop called `say` / `land` / `…Say` is a word from that beat\'s narration: the visual lands on it.', ''];
        for (const b of all) {
          lines.push(`## \`${b.name}\``, '', `${b.summary}`, '', `**Use:** ${b.use ?? ''}`, '', `**Holds** ${b.tail ?? 0.6} s after the last word by default.`, '', '| prop | meaning |', '|---|---|');
          for (const [k, v] of Object.entries(b.props ?? {})) lines.push(`| \`${k}\` | ${String(v || '').replace(/\|/g, '\\|')} |`);
          if (b.defaults && Object.keys(b.defaults).length) lines.push('', `Defaults: \`${JSON.stringify(b.defaults)}\``);
          const props = Object.entries(b.example?.props ?? {}).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n');
          lines.push('', '```json', `{ "id": "${b.name}", "block": "${b.name}",\n  "vo": ${JSON.stringify(b.example?.vo ?? '')},\n  "props": {\n${props}\n  } }`, '```', '');
        }
        return console.log(lines.join('\n'));
      }
      if (one) {
        console.log(`${color.bold(one.name)} — ${one.summary}\n${color.dim(one.use ?? '')}\n`);
        for (const [k, v] of Object.entries(one.props ?? {})) console.log(`  ${color.cyan(k.padEnd(14))} ${v}`);
        if (one.defaults && Object.keys(one.defaults).length) console.log(`\n  defaults: ${JSON.stringify(one.defaults)}`);
        console.log(`\n  example beat:\n${JSON.stringify({ id: one.name, block: one.name, vo: one.example?.vo, props: one.example?.props }, null, 2).replace(/^/gm, '  ')}`);
        return;
      }
      for (const b of all) console.log(`  ${color.bold(b.name.padEnd(14))} ${b.summary}`);
      log.dim(`\n  ${all.length} blocks · details: clearframe blocks <name> · catalog image: docs/media/blocks.png`);
      return;
    }
    case 'icons': {
      const { searchIcons } = await import('./lib/catalog.mjs');
      const hits = searchIcons(positionals.join(' '));
      if (!hits.length) return log.warn('No icons match. Browse all: https://lucide.dev/icons');
      for (const h of hits) console.log(`  ${h.name.padEnd(28)} ${color.dim(h.tags.join(', '))}`);
      return;
    }
    case 'gallery': {
      const { writeGallery } = await import('./lib/catalog.mjs');
      const { gridSheet } = await import('./lib/inspect.mjs');
      const dir = path.resolve(positionals[0] ?? path.join('build', o.vertical ? 'gallery-vertical' : 'gallery'));
      const n = await writeGallery(dir, { format: o.vertical ? 'vertical' : 'landscape', theme: o.theme ?? 'paper', only: list(o.only) });
      log.ok(`Gallery project with ${n} blocks → ${path.relative(process.cwd(), dir)}`);
      if (!o['no-voice']) {
        const { voice } = await import('./lib/generate.mjs');
        try { await voice(dir, { draft: true }); } catch (e) { log.warn(`draft voice unavailable (${e.message}); cues fall back to even spacing`); }
      }
      return gridSheet(dir, { cols: num(o.grid) ?? (o.vertical ? 6 : 4), thumb: o.vertical ? 260 : 440, out: o.out && path.resolve(o.out) });
    }
    case 'doctor': {
      const { doctor } = await import('./lib/doctor.mjs');
      const rows = await doctor();
      const sym = { ok: color.green('✓'), warn: color.yellow('!'), fail: color.red('✗') };
      for (const r of rows) console.log(`  ${sym[r.level]} ${r.what.padEnd(22)} ${r.detail}${r.fix ? `\n      ${color.dim(`→ ${r.fix}`)}` : ''}`);
      const fails = rows.filter((r) => r.level === 'fail').length;
      console.log(fails ? `\n${fails} problem(s) to fix.` : '\nReady to render.');
      if (fails) process.exitCode = 1;
      return;
    }
    case 'preview': {
      const { serve } = await import('./lib/server.mjs');
      const root = dir();
      const s = await serve(root, { port: parseInt(o.port, 10), live: true }).catch(() => serve(root, { port: 0, live: true }));
      log.ok(`Preview: ${color.bold(s.url)}   (space play · ←/→ frame · [ ] beats · S safe areas · M mute)`);
      log.dim('  edits reload automatically · Ctrl+C to stop');
      if (o.open) spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [s.url], { stdio: 'ignore', detached: true }).unref();
      return new Promise(() => {});
    }
    case 'plan': {
      const { plan } = await import('./lib/generate.mjs');
      const p = plan(dir());
      if (o.json) return console.log(JSON.stringify(p, null, 2));
      console.log(color.bold(`Generation plan · ${p.duration.toFixed(1)}s film`));
      for (const r of p.rows) console.log(`  ${r.kind.padEnd(6)} ${r.id.padEnd(18)} ${r.detail.padEnd(34)} ${r.status.padEnd(11)} ${r.cost ? `$${r.cost.toFixed(r.cost < 0.1 ? 4 : 2)}` : color.dim('—')}`);
      console.log(`  ${color.bold('total to generate:')} $${p.total.toFixed(2)}`);
      if (p.clipShare > 0.2) log.warn(`generated footage covers ${(p.clipShare * 100).toFixed(0)}% of runtime — ClearFrame's rule of thumb is ≤ 20%. Can code do it instead?`);
      return;
    }
    case 'voice': {
      const { voice } = await import('./lib/generate.mjs');
      return voice(dir(), { draft: o.draft, force: o.force, only: list(o.only), budget: num(o.budget) });
    }
    case 'music': {
      const { scoreMusic } = await import('./lib/generate.mjs');
      return scoreMusic(dir(), { draft: o.draft, force: o.force, budget: num(o.budget) });
    }
    case 'images': {
      const { images } = await import('./lib/generate.mjs');
      return images(dir(), { only: list(o.only), force: o.force, budget: num(o.budget) });
    }
    case 'clips': {
      const { clips } = await import('./lib/generate.mjs');
      return clips(dir(), { only: list(o.only), force: o.force, budget: num(o.budget) });
    }
    case 'timing': {
      const { computeTiming, tokenize } = await import('./lib/timing.mjs');
      const t = computeTiming(dir());
      if (o.json) return console.log(JSON.stringify(t, null, 2));
      console.log(color.bold(`${t.title} · ${t.width}×${t.height} · ${t.fps}fps · ${t.duration.toFixed(2)}s`));
      for (const b of t.beats) {
        const words = b.vo ? tokenize(b.vo.text).length : 0;
        const wpm = b.vo ? Math.round((words / b.vo.dur) * 60) : null;
        console.log(`  ${b.id.padEnd(18)} ${b.start.toFixed(2).padStart(7)}s  ${b.dur.toFixed(2).padStart(5)}s  ${b.vo ? `${b.vo.estimated ? color.yellow('est') : color.green('rec')} ${String(wpm).padStart(3)}wpm` : color.dim('silent     ')}  ${color.dim((b.vo?.text ?? b.visual ?? '').slice(0, 70))}`);
      }
      return;
    }
    case 'captions': {
      const { computeTiming, captionCues, toSRT, toVTT } = await import('./lib/timing.mjs');
      const root = dir();
      const t = computeTiming(root);
      if (t.estimated) log.warn('Some beats use estimated timing — record voice first for accurate captions.');
      const cues = captionCues(t);
      fs.mkdirSync(path.join(root, 'build'), { recursive: true });
      fs.writeFileSync(path.join(root, 'build', 'captions.srt'), toSRT(cues));
      fs.writeFileSync(path.join(root, 'build', 'captions.vtt'), toVTT(cues));
      log.ok(`${cues.length} caption cues → build/captions.srt, build/captions.vtt`);
      return;
    }
    case 'still': {
      const { still } = await import('./lib/inspect.mjs');
      return still(dir(), { at: o.at, beat: o.beat, pos: num(o.pos), out: o.out });
    }
    case 'sheet': {
      const { sheet, gridSheet } = await import('./lib/inspect.mjs');
      if (o.grid) return gridSheet(dir(), { cols: num(o.grid), pos: num(o.pos) ?? 0.88, thumb: num(o.thumb) ?? 440, out: o.out });
      return sheet(dir(), { per: num(o.per) ?? 3, thumb: num(o.thumb) ?? 480, out: o.out });
    }
    case 'check': {
      const { check } = await import('./lib/inspect.mjs');
      const r = await check(dir());
      if (o.json) return console.log(JSON.stringify(r, null, 2));
      for (const e of r.errors) log.err(e);
      for (const w of r.warnings) log.warn(w);
      for (const n of r.notes) log.dim(`  note: ${n}`);
      if (!r.errors.length && !r.warnings.length) log.ok(`No issues found (${r.duration}s).`);
      else console.log(`\n${r.errors.length} error(s), ${r.warnings.length} warning(s)`);
      if (r.errors.length) process.exitCode = 1;
      return;
    }
    case 'render': {
      const { render } = await import('./lib/render.mjs');
      return render(dir(), { draft: o.draft, lossless: o.lossless, workers: num(o.workers), from: num(o.from), to: num(o.to), audio: !o['no-audio'], out: o.out && path.resolve(o.out), scale: num(o.scale) });
    }
    case undefined: case 'help': case '--help': case '-h':
      console.log(HELP);
      return;
    default:
      console.log(HELP);
      throw new Error(`Unknown command "${cmd}"`);
  }
}

main().catch((e) => { log.err(e.message); if (process.env.DEBUG) console.error(e.stack); process.exit(1); });
