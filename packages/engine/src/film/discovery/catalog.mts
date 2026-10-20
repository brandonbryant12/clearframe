import fs from 'node:fs';
import path from 'node:path';
import { BLOCKS } from '../catalog.mjs';
import { items, libraryDirs } from '../library.mjs';
import { CAST_CATALOG } from '../cast.mjs';
import { MECHANISMS } from './mechanisms.mjs';
import { ROOT, read, firstSentence, clean, tableRows } from './documents.mjs';
import { slots, slotText } from './sketches.mjs';
import type { DiscoveryEntry } from './contracts.mjs';
let cache: DiscoveryEntry[] | null = null,
  cacheKey: string | null = null;
export function entries(): DiscoveryEntry[] {
  const key = libraryDirs().join('|');
  if (cache && cacheKey === key) return cache;
  const out: DiscoveryEntry[] = [];
  const add = (
    kind: string,
    name: string,
    title: string,
    about: unknown,
    when: unknown,
    needs: string,
    ref: string,
  ) =>
    out.push({
      id: `${kind}:${name}`,
      kind,
      name,
      title: clean(title || name),
      about: clean(about),
      when: clean(when),
      needs: clean(needs),
      ref,
    });
  addLibraryEntries(add);
  addReferenceEntries(add);
  addExamples(add);
  cache = out;
  cacheKey = key;
  return out;
}

type EntryWriter = (
  kind: string,
  name: string,
  title: string,
  about: unknown,
  when: unknown,
  needs: string,
  ref: string,
) => number;

function addLibraryEntries(add: EntryWriter): void {
  for (const b of BLOCKS)
    add(
      'block',
      b.name,
      b.name,
      b.summary,
      b.category,
      Object.keys(b.props ?? {})
        .slice(0, 8)
        .join(', '),
      `blocks ${b.name}`,
    );
  for (const s of items('sketches'))
    add(
      'sketch',
      s.id,
      s.id,
      s.summary,
      s.use,
      [s.layer ? 'background art layer' : 'canvas', slotText(slots(s.id))]
        .filter(Boolean)
        .join('; '),
      `sketch ${s.id}`,
    );
  for (const p of items('playbooks'))
    add(
      'playbook',
      p.id,
      p.title,
      `${p.title}: ${p.beats?.length ?? 0} scenes`,
      p.audience,
      p.inputs,
      `new DIR --playbook ${p.id}`,
    );
  for (const d of items('directions'))
    add(
      'direction',
      d.id,
      d.title,
      d.story,
      d.when,
      (d.materials ?? []).join(', '),
      `new DIR --direction ${d.id}`,
    );
  for (const t of items('treatments'))
    add(
      'treatment',
      t.id,
      t.title,
      t.title,
      t.when,
      '',
      `new DIR --treatment ${t.id}`,
    );
  for (const t of items('types'))
    add('type', t.id, t.title, t.title, t.when, '', `"type": "${t.id}"`);
  for (const p of items('palettes'))
    add('palette', p.id, p.id, p.notes, p.notes, '', `"theme": "${p.id}"`);
}

function addReferenceEntries(add: EntryWriter): void {
  for (const [ids, text] of tableRows(read('docs/cast.md'), '| `form` |'))
    for (const name of ids)
      add(
        'cast-move',
        name,
        name,
        firstSentence(text),
        text.slice(firstSentence(text).length),
        'a cast',
        'docs/cast.md',
      );
  for (const s of CAST_CATALOG.shapes)
    add(
      'cast-shape',
      s.id,
      s.id,
      s.about,
      s.about,
      'a cast object: {"shape": "' + s.id + '"}',
      'docs/cast.md',
    );
  for (const l of CAST_CATALOG.looks)
    add('cast-look', l.id, l.id, l.about, l.about, 'cast look', 'docs/cast.md');
  for (const [ids, text] of tableRows(
    read('docs/scene-engine.md'),
    '### Elements',
  ))
    add(
      'stage-element',
      ids[0].replace(/[^a-z:]+.*$/, '') || ids[0],
      ids.join(', '),
      firstSentence(text),
      text.slice(firstSentence(text).length),
      'a stage',
      'docs/scene-engine.md',
    );
  for (const [name, about, when, needs, ref] of MECHANISMS)
    add('mechanism', name, name, about, when, needs, ref);
}

function addExamples(add: EntryWriter): void {
  for (const dir of fs.existsSync(path.join(ROOT, 'examples'))
    ? fs.readdirSync(path.join(ROOT, 'examples'))
    : []) {
    const md = read(`examples/${dir}/README.md`);
    if (!md) continue;
    const title = md.match(/^# (.+)$/m)?.[1] ?? dir,
      para = md.split('\n\n').find((p) => p.trim() && !p.startsWith('#')) ?? '';
    add(
      'example',
      dir,
      title,
      firstSentence(para),
      firstSentence(para.slice(firstSentence(para).length)),
      '',
      `examples/${dir}/README.md`,
    );
  }
}
