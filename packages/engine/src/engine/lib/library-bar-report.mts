import fs from 'node:fs';
import path from 'node:path';

import { writeJSONAtomic } from './store.mjs';

import { esc as escapeHTML } from './review-page-html.mjs';
import type { BarReport } from './library-bar-contracts.mjs';

export function writeReport(out: string, report: BarReport) {
  writeJSONAtomic(path.join(out, 'report.json'), report);
  const link = (file: string | undefined, title: string) =>
    file ? `<a href="${escapeHTML(file)}">${escapeHTML(title)}</a>` : '';
  fs.writeFileSync(
    path.join(out, 'index.html'),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHTML(report.name)} — library review</title>
<style>body{max-width:1160px;margin:40px auto;padding:0 20px;background:#f5f2eb;color:#20242b;font:17px/1.5 system-ui}h1{font-size:40px;letter-spacing:-.035em}article{border-top:1px solid #b5b5af;padding:28px 0}img{display:block;max-width:100%;height:auto}video{max-width:720px;width:100%;max-height:640px;background:#171b22}a{color:#1c5baa}pre{white-space:pre-wrap}small{color:#52565d}</style>
<h1>${escapeHTML(report.name)}</h1><p>Mechanical result: <strong>${escapeHTML(report.status)}</strong>. Visual judgement: <strong>open</strong>.</p>
<p>Read the intended takeaway, inspect every phone frame, and watch each complete short film. Check hierarchy, legibility, quantity conservation, meaningful change and both sides of each transition. Pixel differences are not visual quality or comprehension proof.</p>
<p>Reference: ${escapeHTML(report.reference ?? 'not supplied')}. ${link('report.json', 'Full report')} · ${link('blind.html', 'Review without the intended takeaway')}</p>
${report.cases.map((c) => `<article><h2>${escapeHTML(c.id)} · ${escapeHTML(c.status)}</h2><p>${escapeHTML(c.takeaway ?? 'Takeaway not supplied')}</p><p>${escapeHTML((c.errors ?? []).join('\n'))}</p>${c.phone ? `<img src="${escapeHTML(c.phone)}" alt="360 pixel samples for ${escapeHTML(c.id)}">` : ''}<p><small>Sample times: ${(c.samples ?? []).map((s) => `${s.time.toFixed(3)} s`).join(', ')}. ${link(c.qaPhone, 'Complete one-second phone strip')} · ${link(c.project, 'Storyboard')}</small></p>${c.video ? `<video controls preload="metadata" src="${escapeHTML(c.video)}"></video>` : ''}<details><summary>Measurements and warnings</summary><pre>${escapeHTML(JSON.stringify({ samples: c.samples, warnings: c.warnings }, null, 2))}</pre></details></article>`).join('\n')}
<h2>Refusals and prop changes</h2><pre>${escapeHTML(JSON.stringify({ refusals: report.refusals, sensitivities: report.sensitivities }, null, 2))}</pre></html>`,
  );
  // The answer key is absent from this page, not hidden with CSS. This provides a
  // comprehension review surface; it does not claim anyone has completed that review.
  fs.writeFileSync(
    path.join(out, 'blind.html'),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Library comprehension review</title>
<style>body{max-width:960px;margin:40px auto;padding:0 20px;font:18px/1.5 system-ui;color:#20242b;background:#f5f2eb}article{border-top:1px solid #aaa;padding:28px 0}video{width:100%;max-height:680px}img{max-width:100%;height:auto}</style>
<h1>What does the picture explain?</h1><p>For each film, write what changed, what stayed the same, and the conclusion you would take away. Name any label or transition you could not follow. Then compare your answer with the intended takeaway in the <a href="index.html">main report</a>.</p>
${report.cases
  .filter((c) => c.video)
  .map(
    (c, i) =>
      `<article><h2>Film ${i + 1}</h2><video controls preload="metadata" src="${escapeHTML(c.video)}"></video>${c.phone ? `<p>Phone-size samples</p><img src="${escapeHTML(c.phone)}" alt="Phone samples for film ${i + 1}">` : ''}</article>`,
  )
  .join('\n')}</html>`,
  );
}
