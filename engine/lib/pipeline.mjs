// One local production pass. Paid generation and editorial approval remain explicit choices.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { critique } from './critique.mjs';
import { voice } from './generate.mjs';
import { checkProject, sheetProject, renderProject } from '../../fframes/production.mjs';
import { qaProject } from './qa.mjs';
import { reviewProject } from './review.mjs';
import { sha256 } from '../../fframes/native-build.mjs';
import { renderGeometry } from '../../fframes/render-geometry.mjs';
import { writeJSON, log } from './util.mjs';
import { loadStoryboard } from './project.mjs';

function markdown(report) {
  const link = value => `[${path.basename(value)}](${encodeURI(path.relative(report.dir, value)).replace(/\(/g, '%28').replace(/\)/g, '%29')})`;
  return `# ClearFrame production run\n\nStatus: **${report.status}**\nMode: ${report.draft ? 'draft (local narration generated only where needed; imported recordings preserved)' : 'final render'}\n` +
    `\nSource project: ${report.project}\n\n| Stage | Seconds | Result |\n| --- | ---: | --- |\n` +
    report.stages.map(s => `| ${s.name} | ${s.seconds?.toFixed(2) ?? '—'} | ${s.status} |`).join('\n') +
    `\n\n## Artifacts\n${Object.values(report.artifacts).map(v => `- ${link(v)}`).join('\n')}\n` +
    (report.error ? `\n## Failure\n${report.error}\n` : '') +
    `\n## Review queue\n` +
    report.reviewQueue.map(r => `- [ ] ${r}`).join('\n') +
    `\n\nDiagnostics establish the recorded mechanical checks. Watch and listen to the whole film, verify source claims, and judge the story and brand before publishing. This run does not record human acceptance.\n`;
}

export async function runPipeline(root, { draft = false, scale = 1, noRender = false } = {}) {
  root = fs.realpathSync(root);
  const sb = loadStoryboard(root);
  renderGeometry(sb.format, { draft, scale });
  const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomUUID().slice(0, 8);
  const dir = path.join(root, 'build/pipeline', id);
  fs.mkdirSync(dir, { recursive: true });
  const report = { version: 1, id, dir, project: root, status: 'running', draft, scale,
    startedAt: new Date().toISOString(), stages: [], artifacts: {}, reviewQueue: [] };
  const file = path.join(dir, 'report.json');
  const save = () => { writeJSON(file, report); fs.writeFileSync(path.join(dir, 'REPORT.md'), markdown(report)); };
  const stage = async (name, fn) => {
    const entry = { name, status: 'running' }, start = performance.now();
    report.stages.push(entry); save(); log.step(`Pipeline: ${name}`);
    try { const result = await fn(); entry.status = 'passed'; return result; }
    catch (e) { entry.status = 'failed'; entry.error = e.message; throw e; }
    finally { entry.seconds = (performance.now() - start) / 1000; save(); }
  };
  const start = performance.now();
  try {
    report.critique = await stage('critique', async () => critique(root));
    for (const f of report.critique.findings) if (f.level === 'warn' && f.where !== 'check') report.reviewQueue.push(`Story: ${f.where}: ${f.message}`);
    if (draft) await stage('draft-voice', () => voice(root, { draft: true }));
    report.check = await stage('check', async () => {
      const check = await checkProject(root, { draft });
      writeJSON(path.join(dir, 'check.json'), check);
      report.artifacts.check = path.join(dir, 'check.json');
      if (check.errors.length) throw new Error(check.errors.join('\n'));
      report.inputs = JSON.parse(fs.readFileSync(path.join(root, 'build/native/manifest.json'), 'utf8'));
      if (report.inputs.inputId !== check.inputId) throw new Error('Prepared inputs changed during check; start a fresh pipeline run.');
      return check;
    });
    report.reviewQueue.push(...report.check.warnings.map(w => `Layout/timing: ${w}`));
    report.artifacts.storyboard = path.join(dir, 'storyboard.json');
    fs.copyFileSync(path.join(root, 'storyboard.json'), report.artifacts.storyboard);
    if (sha256(fs.readFileSync(report.artifacts.storyboard)) !== report.inputs.hashes['storyboard.json'])
      throw new Error('Storyboard changed after check; start a fresh pipeline run.');
    report.artifacts.sheet = await stage('sheet', async () => {
      const sheet = await sheetProject(root, { draft, out: path.join(dir, 'sheet.png') });
      const receipt = `${sheet}.json`;
      if (JSON.parse(fs.readFileSync(receipt, 'utf8')).inputId !== report.check.inputId)
        throw new Error('Sheet inputs differ from the checked inputs; start a fresh pipeline run.');
      report.artifacts.sheetReceipt = receipt;
      return sheet;
    });
    if (noRender) report.status = 'checked-no-render';
    else {
      const video = path.join(dir, 'video.mp4');
      report.render = await stage('render', async () => {
        const render = await renderProject(root, { draft, scale, out: video });
        if (render.inputId !== report.check.inputId) throw new Error('Inputs changed after check; start a fresh pipeline run.');
        return render;
      });
      report.artifacts.video = video;
      report.artifacts.receipt = `${video}.json`;
      report.qa = await stage('qa', async () => {
        const qa = await qaProject(root, { video });
        report.artifacts.qa = path.join(qa.dir, 'qa.json');
        report.artifacts.phone = path.join(qa.dir, 'phone.png');
        report.artifacts.timeline = path.join(qa.dir, 'timeline.png');
        report.reviewQueue.push(...qa.findings.map(f => `Encoded ${f.kind}: ${f.message}`));
        for (const key of ['qa', 'phone', 'timeline']) {
          const src = report.artifacts[key], dest = path.join(dir, path.basename(src));
          fs.copyFileSync(src, dest); report.artifacts[key] = dest;
        }
        const errors = qa.findings.filter(f => f.level === 'error');
        if (errors.length) throw new Error(errors.map(f => f.message).join('\n'));
        return { summary: qa.summary, findings: qa.findings };
      });
      const boundaries = path.join(dir, 'boundaries');
      await stage('boundary-review', () => reviewProject(root, { video, directory: boundaries }));
      report.artifacts.boundaries = path.join(boundaries, 'index.html');
      report.status = 'ready-for-review';
    }
    report.reviewQueue.push('Watch and listen to the complete film; verify spoken and displayed claims against the original sources.',
      'Review the story, brand assets, readability at delivery size, and every intentional hold.');
    return report;
  } catch (e) {
    report.status = 'failed'; report.error = e.message;
    throw new Error(`Pipeline failed: ${e.message}\nReport: ${path.join(dir, 'REPORT.md')}`);
  } finally {
    report.seconds = (performance.now() - start) / 1000;
    report.finishedAt = new Date().toISOString(); save();
  }
}
