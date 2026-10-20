import fs from 'node:fs';
import path from 'node:path';

import { sha256File, writeJSONAtomic } from './store.mjs';
import { sceneHash } from '../../scene/engine.mjs';
import { errorMessage } from './errors.mjs';
import { validateBarFixture } from './library-bar-fixture.mjs';
import { implementation } from './library-bar-media.mjs';
import { writeReport } from './library-bar-report.mjs';
import { runBarCase } from './library-bar-case.mjs';
import { runRefusal } from './library-bar-refusal.mjs';
import { runSensitivity } from './library-bar-sensitivity.mjs';
import type {
  BarReport,
  BarCaseResult,
  PreparedCase,
} from './library-bar-contracts.mjs';
export { validateBarFixture } from './library-bar-fixture.mjs';
export { comparePixels } from './library-bar-media.mjs';

export async function runLibraryBar(
  fixtureFile: string,
  { out: outputRoot }: { out?: string } = {},
) {
  fixtureFile = path.resolve(fixtureFile);
  const fixture = validateBarFixture(
      JSON.parse(fs.readFileSync(fixtureFile, 'utf8')),
    ),
    base = path.dirname(fixtureFile);
  const out = path.resolve(
    outputRoot ?? path.join('build/library-bar', fixture.name),
  );
  if (fs.existsSync(out))
    throw new Error(
      'Library bar output exists; choose a new directory to preserve prior evidence',
    );
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const space = fs.statfsSync(path.dirname(out));
  if (space.bavail * space.bsize < 20 * 2 ** 30)
    throw new Error('Keep 20 GiB free before the library bar');
  fs.mkdirSync(out, { recursive: true });
  const source = implementation();
  writeJSONAtomic(path.join(out, 'implementation.json'), source.hashes);
  const report: BarReport = {
    version: 1,
    name: fixture.name,
    reference: fixture.reference,
    status: 'running',
    visualJudgement: 'open',
    comprehensionJudgement: 'open',
    fixtureSha256: sha256File(fixtureFile),
    implementationSha256: source.sha256,
    rendererSourceHash: sceneHash(),
    cases: [],
    refusals: [],
    sensitivities: [],
  };
  const prepared = new Map<string, PreparedCase>();
  const save = () => writeReport(out, report);
  save();
  const workerKeys = [
    'CLEARFRAME_RENDER_WORKERS',
    'CLEARFRAME_ENCODER_THREADS',
  ];
  const originalWorkers = Object.fromEntries(
    workerKeys.map((k) => [k, process.env[k]]),
  );
  for (const key of workerKeys)
    process.env[key] = String(
      Math.max(1, Math.min(2, Number(process.env[key]) || 2)),
    );
  try {
    for (const entry of fixture.cases) {
      const result: BarCaseResult = {
        id: entry.id,
        takeaway: entry.takeaway,
        status: 'running',
        errors: [],
        warnings: [],
        samples: [],
      };
      report.cases.push(result);
      save();
      await runBarCase(entry, { out, base, fixture, prepared }, result);
      console.log(`${entry.id}: ${result.status}`);
      save();
    }
    for (const entry of fixture.refusals ?? []) {
      report.refusals.push(await runRefusal(entry, out, base));
      save();
    }
    for (const spec of fixture.sensitivities ?? []) {
      report.sensitivities.push(runSensitivity(spec, prepared));
      save();
    }
    if (
      sha256File(fixtureFile) !== report.fixtureSha256 ||
      sceneHash() !== report.rendererSourceHash ||
      implementation().sha256 !== report.implementationSha256
    )
      throw new Error(
        'Fixture or implementation sources changed during the bar run; rerun once the implementation is stable',
      );
    report.status = [
      ...report.cases,
      ...report.refusals,
      ...report.sensitivities,
    ].every((c) => c.status === 'passed')
      ? 'passed'
      : 'failed';
    save();
    return { directory: out, ...report };
  } catch (e) {
    report.status = 'failed';
    report.error = errorMessage(e);
    save();
    throw e;
  } finally {
    for (const [key, value] of Object.entries(originalWorkers))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
}
