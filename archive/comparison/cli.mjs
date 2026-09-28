#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import { doctor, prepare, verifyBundle, finish, measure } from './lib.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const split = rest.indexOf('--');
const command = split < 0 ? [] : rest.slice(split + 1);
const { values: o, positionals: p } = parseArgs({ args: split < 0 ? rest : rest.slice(0, split), allowPositionals: true,
  options: { 'allow-estimated': { type: 'boolean' }, renderer: { type: 'string' }, phase: { type: 'string' }, out: { type: 'string' }, cwd: { type: 'string' } } });
const need = (value, message) => { if (!value) throw new Error(message); return value; };
try {
  switch (cmd) {
    case 'doctor': {
      const rows = doctor(); rows.forEach((r) => console.log(`${r.ok ? 'OK' : 'FIX'} ${r.name}: ${r.detail}`));
      if (rows.some((r) => !r.ok)) process.exitCode = 1;
      break;
    }
    case 'prepare': console.log(JSON.stringify(await prepare(need(p[0], 'source project required'), need(p[1], 'new bundle directory required'), { allowEstimated: o['allow-estimated'] }), null, 2)); break;
    case 'verify': console.log(`Frozen inputs verified: ${verifyBundle(need(p[0], 'bundle required')).inputId}`); break;
    case 'finish': await finish(need(p[0], 'bundle required'), need(p[1], 'silent video required'), need(o.out, '--out required')); console.log(`Finished ${path.resolve(o.out)}`); break;
    case 'measure': {
      const report = await measure({ bundle: need(p[0], 'bundle required'), renderer: o.renderer, phase: o.phase, output: need(o.out, '--out required'), cwd: o.cwd, command });
      console.log(JSON.stringify(report, null, 2)); if (!report.success) process.exitCode = report.code || 1; break;
    }
    default: console.log(`ClearFrame FFFrames experiment (run from repository root)
  node fframes/cli.mjs doctor
  node fframes/cli.mjs prepare <project> <new-bundle> [--allow-estimated]
  node fframes/cli.mjs verify <bundle>
  node fframes/cli.mjs measure <bundle> --renderer javascript|fframes-metal|fframes-cpu --phase cold-build|warm-build|render|review|mux --out report.json [--cwd directory] -- <command> [args]
  node fframes/cli.mjs finish <bundle> <silent.mp4> --out final.mp4

Setup: fframes/SETUP.md. Comparison protocol: fframes/EVALUATION.md.`);
      if (cmd && !['help', '--help'].includes(cmd)) process.exitCode = 1;
  }
} catch (e) { console.error(e.message); process.exitCode = 1; }
