import * as Schema from 'effect/Schema';
import { isRecord } from './errors.mjs';
import { HandoffManifestSchema } from './handoff-model.mjs';
import type { PackageFile, HandoffManifest } from './handoff-model.mjs';
// A portable, editable package of a saved revision. Read the object store, never the
// working assets: a later edit must not silently become part of an earlier delivery.
import fs from 'node:fs';
import path from 'node:path';
import { latestRevision, loadRevision, materialize } from './revisions.mjs';
import { restoreObject, sha256File, writeJSONAtomic } from './store.mjs';
import { REPO, sceneHash } from '../../scene/engine.mjs';

const media = /\.(wav|mp3|m4a|mp4|mov|png|jpe?g|webp|svg|gif|ttf|otf)$/i;

function inventory(root: string, dir: string = root): PackageFile[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) => {
      const file = path.join(dir, e.name);
      return e.isDirectory()
        ? inventory(root, file)
        : [
            {
              path: path.relative(root, file).split(path.sep).join('/'),
              sha256: sha256File(file),
            },
          ];
    });
}

/** Integrity check, not a signature or an approval: changing the manifest changes the claim. */
export function verifyHandoff(directory: string) {
  directory = fs.realpathSync(directory);
  const manifest = Schema.decodeUnknownSync(HandoffManifestSchema)(
    JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8')),
  );
  if (
    manifest.version !== 1 ||
    !Array.isArray(manifest.packageFiles) ||
    !manifest.packageFiles.length
  )
    throw new Error('Not a supported handoff manifest');
  const seen = new Set<string>();
  for (const entry of manifest.packageFiles) {
    if (
      typeof entry.path !== 'string' ||
      seen.has(entry.path) ||
      !/^[a-f0-9]{64}$/.test(entry.sha256)
    )
      throw new Error('Invalid or duplicate handoff file entry');
    seen.add(entry.path);
    const file = path.resolve(directory, entry.path);
    if (
      !file.startsWith(directory + path.sep) ||
      !fs.realpathSync(file).startsWith(directory + path.sep)
    )
      throw new Error(`Handoff file lies outside the package: ${entry.path}`);
    if (sha256File(file) !== entry.sha256)
      throw new Error(`Handoff file changed: ${entry.path}`);
  }
  for (const required of [
    'project/storyboard.json',
    'review/prepared-job.json',
    'review/revision.json',
    'review/timeline.json',
    'rights.json',
    'README.md',
  ])
    if (!seen.has(required))
      throw new Error(`Handoff manifest omits ${required}`);
  verifyDelivery(directory, manifest, seen);
  return {
    directory,
    revision: manifest.revision,
    verified: manifest.packageFiles.length,
    delivery: !!manifest.delivery,
  };
}

/** No rendering, generation, approval or rights inference occurs during export. */
export function exportHandoff(
  root: string,
  { rev, out }: { rev?: string; out?: string } = {},
) {
  root = path.resolve(root);
  rev ??= latestRevision(root)?.id;
  if (!rev)
    throw new Error(
      'handoff needs a saved revision; run snapshot or render first',
    );
  const { meta, timeline } = loadRevision(root, rev);
  const destination = path.resolve(
    out ?? path.join(root, 'build', `handoff-${rev}`),
  );
  if (fs.existsSync(destination))
    throw new Error(`Handoff destination already exists: ${destination}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temp = fs.mkdtempSync(
    path.join(path.dirname(destination), '.cf-handoff-'),
  );
  const warnings = [];
  try {
    materialize(root, rev, path.join(temp, 'project'));
    restoreObject(root, meta.job, path.join(temp, 'review/prepared-job.json'));
    writeJSONAtomic(path.join(temp, 'review/revision.json'), meta);
    writeJSONAtomic(path.join(temp, 'review/timeline.json'), timeline);
    const inputFiles = Object.keys(meta.inputs ?? {})
      .sort()
      .map((rel) => ({
        path: `project/${rel}`,
        sha256: sha256File(path.join(temp, 'project', rel)),
      }));
    // Prefer the last retained final, then the last retained preview. Pruned videos
    // remain explicitly unavailable; never substitute today's build/video.mp4.
    const retained = (meta.videos ?? []).filter((v) => v.retained !== false);
    const video =
      retained.filter((v) => v.profile === 'final').at(-1) ?? retained.at(-1);
    let delivery = null;
    if (video) {
      const file = path.join(temp, 'delivery/video.mp4');
      restoreObject(root, video.object, file);
      restoreObject(root, video.receipt, `${file}.json`);
      const receipt: unknown = JSON.parse(
        fs.readFileSync(`${file}.json`, 'utf8'),
      );
      if (!isRecord(receipt))
        throw new Error('Invalid stored delivery receipt');
      const hash = sha256File(file);
      if (
        hash !== video.sha256 ||
        hash !== receipt.outputSha256 ||
        receipt.inputId !== meta.inputId
      )
        throw new Error(
          `Revision ${rev}: video, receipt and revision identities do not agree`,
        );
      delivery = {
        path: 'delivery/video.mp4',
        receipt: 'delivery/video.mp4.json',
        sha256: hash,
        profile: video.profile,
      };
      if (video.profile !== 'final')
        warnings.push(`The retained video is a ${video.profile} render.`);
    } else
      warnings.push(
        'This revision has no retained video. The package contains editable inputs and review metadata.',
      );
    const currentRenderer = sceneHash();
    if (currentRenderer !== meta.renderer?.sourceHash)
      warnings.push(
        'The installed renderer differs from this revision. Re-rendering with it can change the picture.',
      );
    const rights = inputFiles
      .filter((f) => media.test(f.path))
      .map((f) => ({ ...f, status: 'unrecorded' }));
    if (rights.length)
      warnings.push(
        'Media rights are unrecorded in this ledger. Consult the project sources and original asset agreements.',
      );
    // A repository installation is a prerequisite, not secretly bundled. Current
    // dependency metadata is labelled as such; it is not historical render proof.
    const runtime: unknown = JSON.parse(
      fs.readFileSync(path.join(REPO, 'archive/fframes/upstream.json'), 'utf8'),
    );
    const record = {
      version: 1,
      revision: rev,
      contentId: meta.contentId,
      inputId: meta.inputId,
      rendererRequired: meta.renderer,
      exporterRenderer: currentRenderer,
      exporterRuntime: runtime,
      files: inputFiles,
      delivery,
      warnings,
      replay:
        'Install ClearFrame and its bundled fonts. Restore any external shared library used by this revision. Check the prepared job and renderer identity before rendering; byte-identical replay is not asserted.',
    };
    writeJSONAtomic(path.join(temp, 'rights.json'), {
      version: 1,
      assets: rights,
    });
    fs.writeFileSync(
      path.join(temp, 'README.md'),
      `# ClearFrame handoff: ${rev}\n\nThe project/ directory contains the saved revision's editable inputs, copied from verified stored objects. The review/ directory contains its prepared job and timeline. A retained video and its original render receipt are in delivery/ when available.\n\n## Open and edit\n\nUse a ClearFrame installation with the renderer and fonts identified in manifest.json. Run \`clearframe check /path/to/package/project --draft\`, then render that project. External shared-library overrides are not captured by older revisions; supply them before editing or rendering. Compare the new prepared job with review/prepared-job.json. A new render is a new result.\n\n## Delivery evidence\n\nmanifest.json lists input hashes and the delivered video's hash. The package does not confer approval or asset rights. rights.json lists media with unrecorded rights; original project metadata may contain further provenance. Only saved revision inputs and review metadata are collected; inspect source material before sharing the package.\n\n${warnings.map((w) => `- ${w}`).join('\n')}\n`,
    );
    const manifest = { ...record, packageFiles: inventory(temp) };
    writeJSONAtomic(path.join(temp, 'manifest.json'), manifest);
    verifyHandoff(temp);
    // Publish only after all stored objects and the delivery identity have verified.
    if (fs.existsSync(destination))
      throw new Error(
        `Handoff destination appeared during export: ${destination}`,
      );
    fs.renameSync(temp, destination);
    return { directory: destination, ...manifest };
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    throw error;
  }
}

function verifyDelivery(
  directory: string,
  manifest: HandoffManifest,
  seen: Set<string>,
): void {
  if (manifest.delivery) {
    if (
      !seen.has(manifest.delivery.path) ||
      !seen.has(manifest.delivery.receipt)
    )
      throw new Error('Handoff manifest omits delivery files');
    const receipt: unknown = JSON.parse(
      fs.readFileSync(path.join(directory, manifest.delivery.receipt), 'utf8'),
    );
    if (!isRecord(receipt)) throw new Error('Invalid handoff delivery receipt');
    if (
      receipt.outputSha256 !== manifest.delivery.sha256 ||
      receipt.inputId !== manifest.inputId ||
      sha256File(path.join(directory, manifest.delivery.path)) !==
        manifest.delivery.sha256
    )
      throw new Error('Handoff delivery identities do not agree');
  }
}
