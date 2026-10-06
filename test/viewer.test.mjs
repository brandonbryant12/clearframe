import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildViewer, saveNote, setNoteState, replyToNote, fileType } from '../engine/lib/viewer.mjs';
import { answerNote } from '../engine/lib/viewer/notes.mjs';

const clip = (file, size = '320x568') => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=navy:s=${size}:d=1`, '-f', 'lavfi', '-i', 'sine=d=1', '-shortest', '-pix_fmt', 'yuv420p', file]);
  assert.equal(r.status, 0, String(r.stderr));
};
const dataOf = file => JSON.parse(fs.readFileSync(file, 'utf8').match(/<script id="data" type="application\/json">(.*?)<\/script>/s)[1]);

test('every kind of file gets a preview type', () => {
  for (const [f, t] of [['a.png', 'image'], ['logo.svg', 'svg'], ['x.mov', 'video'], ['bed.wav', 'audio'], ['Face.otf', 'font'], ['notes.md', 'text'], ['brief.pdf', 'document'], ['scene.blend', 'model'], ['fire.vdb', 'model'], ['thing.xyz', 'other']])
    assert.equal(fileType(f), t, f);
});

test('the viewer lists ClearFrame and outside films with versions, scenes, lanes and files', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-viewer-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const native = path.join(root, 'films', 'quarterly');
  clip(path.join(native, 'build/video.mp4'));
  fs.writeFileSync(path.join(native, 'storyboard.json'), JSON.stringify({ version: 2, title: 'Quarterly <review>', format: { preset: 'vertical' }, beats: [{ id: 'a' }, { id: 'b' }] }));
  const outside = path.join(root, 'films', 'reel');
  clip(path.join(outside, 'versions/v1.mp4')); clip(path.join(outside, 'versions/v2.mp4'));
  fs.mkdirSync(path.join(outside, 'brand'), { recursive: true });
  fs.writeFileSync(path.join(outside, 'brand/logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
  fs.copyFileSync('film/assets/fonts/Inter-Regular.ttf', path.join(outside, 'Face-Bold.ttf'));
  fs.writeFileSync(path.join(outside, 'film.json'), JSON.stringify({ title: 'Reel', versions: [{ id: 'v1', file: 'versions/v1.mp4' }, { id: 'v2', file: 'versions/v2.mp4', label: 'Final cut' }],
    scenes: [{ start: 0, end: 1, kind: 'Hero', elements: [{ text: 'WIN', font: 'Face-Bold.ttf', box: [10, 10, 100, 40], at: 0.2 }] }],
    lanes: { sfx: [{ t: 0.5, name: 'Boom' }] }, fonts: [{ file: 'Face-Bold.ttf', used: ['Slogan'] }] }));
  const out = path.join(root, 'viewer');
  const r = await buildViewer({ root: [path.join(root, 'films')], out, render: false });
  assert.equal(r.films, 2); assert.equal(r.versions, 3);
  const data = dataOf(r.file);
  const q = data.films.find(f => f.title === 'Quarterly <review>'), reel = data.films.find(f => f.title === 'Reel');
  assert.equal(q.shape, 'tall'); assert.equal(q.versions[0].video, '../films/quarterly/build/video.mp4');
  assert.ok(fs.existsSync(path.join(out, q.versions[0].poster)), 'a poster frame is extracted');
  assert.equal(reel.kind, 'external'); assert.equal(reel.versions.at(-1).label, 'Final cut');
  assert.equal(reel.versions.at(-1).scenes[0].elements[0].text, 'WIN', 'words on the picture are known, so a note can say which');
  assert.deepEqual(reel.versions.at(-1).lanes.sfx, [{ t: 0.5, name: 'Boom' }]);
  assert.ok(reel.files.some(f => f.type === 'svg') && reel.files.some(f => f.type === 'font'), 'vector art and fonts are listed as files');
  assert.ok(!reel.files.some(f => f.name.startsWith('versions/')), 'version videos are not repeated as files');
  const html = fs.readFileSync(r.file, 'utf8');
  assert.ok(!html.includes('Quarterly <review>'), 'titles are escaped inside the embedded data');
  assert.equal(data.library, undefined, 'the page carries films only');
});

test('notes on an outside film are saved beside it with their pin', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-notes-'));
  fs.writeFileSync(path.join(dir, 'film.json'), JSON.stringify({ versions: [] }));
  const n = saveNote(dir, { version: 'v2', at: 3.5, text: 'Tighter cut here', by: 'Ana', element: 'win', pin: { x: .4, y: .6 } });
  assert.equal(n.id, 'n001');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'notes.json'))).notes[0].pin, { x: .4, y: .6 });
  assert.deepEqual(n.tags, []);
  const tagged = saveNote(dir, { version: 'v2', at: 4, text: 'Hold longer #pacing #Type', by: 'Ana' });
  assert.deepEqual(tagged.tags, ['pacing', 'type']);
  assert.equal(setNoteState(dir, tagged.id, { resolved: true, by: 'Bo' }).state, 'Resolved');
  assert.equal(setNoteState(dir, tagged.id, { resolved: false }).resolved, false);
  assert.deepEqual(replyToNote(dir, tagged.id, { text: 'Agreed', by: 'Bo' }).replies.map(r => r.text), ['Agreed']);
  assert.throws(() => setNoteState(dir, 'n999', { resolved: true }), /No note/);
  assert.throws(() => saveNote(dir, { version: 'v2', at: 1, text: ' ' }), /needs text/);
  assert.throws(() => saveNote(dir, { version: 'v2', at: 1, text: 'x', pin: { x: 2, y: 0 } }), /pin/);
  // A pin keeps the words on screen under it, and reads as a place on the frame.
  const spot = saveNote(dir, { version: 'v2', at: 2, text: 'Bigger', by: 'Ana', pin: { x: .1, y: .8, on: 'WIN' } });
  assert.deepEqual([spot.where, spot.on], ['bottom left', 'WIN']);
  assert.throws(() => answerNote(dir, spot.id, { said: 'Made it bigger' }), /answered by people/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('each film is placed in its stage of production, with boards before the first render', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-stages-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const film = (name, files) => { const dir = path.join(root, name); fs.mkdirSync(dir, { recursive: true }); for (const [f, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), typeof body === 'string' ? body : JSON.stringify(body)); };
  const statement = (id, placeholder) => ({ id, block: 'statement', duration: 3, vo: `Line ${id}.`, ...(placeholder ? { placeholder } : {}), props: { title: `Scene ${id}` } });
  film('idea', { 'brief.md': '# Gold and rates\n\n**The one idea:** gold moves against real rates.\n' });
  film('script', { 'storyboard.json': { version: 2, title: 'Script', beats: [{ id: 't', block: 'title', props: { title: 'Script' } }, statement('a', 'Line chart: the index'), statement('b', 'Bar chart: returns')] } });
  film('boards', { 'storyboard.json': { version: 2, title: 'Boards', beats: [statement('a'), statement('b', 'Line chart: the index'), statement('c')] }, 'brief.md': '# Boards\n' });
  const r = await buildViewer({ root: [root], out: path.join(root, 'viewer'), render: false });
  const data = dataOf(r.file), byTitle = title => data.films.find(f => f.title === title);
  assert.deepEqual(['Gold and rates', 'Script', 'Boards'].map(x => byTitle(x).stage.id), ['brief', 'script', 'storyboard']);
  assert.equal(byTitle('Gold and rates').stage.next, 'Read the brief, then ask for a first cut');
  assert.match(byTitle('Gold and rates').brief, /gold moves against real rates/);
  const boards = byTitle('Boards').boards;
  assert.deepEqual(boards.map(b => [b.number, b.seconds, b.narration]), [[1, 3, 'Line a.'], [2, 3, 'Line b.'], [3, 3, 'Line c.']]);
  assert.equal(boards[1].placeholder, 'Line chart: the index');
  assert.ok(boards.every(b => b.image === null), 'no board stills when render is off');
  assert.equal(byTitle('Boards').brief, '# Boards\n');
});

test('whole-cut notes on a final remain unpinned and can be resolved, reopened and reloaded', async t => {
  const { snapshot, attachVideo } = await import('../engine/lib/revisions.mjs');
  const { loadViewerNotes } = await import('../engine/lib/viewer/notes.mjs');
  const { readNotes } = await import('../engine/lib/notes.mjs');
  const { clearframeStage } = await import('../engine/lib/viewer/stages.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-final-notes-'));
  t.after(() => fs.rmSync(dir, {recursive:true,force:true}));
  const sb = {version:2,title:'Final',music:false,beats:[{id:'a',block:'statement',duration:3,props:{title:'Stable frame'}}]};
  fs.writeFileSync(path.join(dir,'storyboard.json'),JSON.stringify(sb));
  const {revision} = await snapshot(dir);
  clip(path.join(dir, 'final.mp4'));
  attachVideo(dir, revision.id, {file:path.join(dir,'final.mp4'),profile:'final',receipt:{frames:30}});
  const n = saveNote(dir,{version:revision.id,scope:'film',text:'Overall pacing needs a pass',by:'Ana'});
  assert.equal(n.at,null); assert.equal(n.scope,'film'); assert.equal(n.pin,null);
  assert.equal(readNotes(dir)[0].anchor,null);
  assert.throws(()=>setNoteState(dir,n.id,{resolved:true}),/your name/);
  assert.equal(setNoteState(dir,n.id,{resolved:true,by:'Ana'}).resolved,true);
  assert.equal(setNoteState(dir,n.id,{resolved:false}).resolved,false);
  assert.equal(loadViewerNotes(dir)[0].version,revision.id);
  assert.equal(clearframeStage(sb,{profile:'final'},1),'review');
  assert.equal(clearframeStage(sb,{profile:'final'},0),'final');
  const moment = saveNote(dir,{version:revision.id,at:1.2,text:'Keep this moment'});
  assert.equal(moment.at,1.2);
  assert.throws(()=>saveNote(dir,{version:revision.id,at:-1,text:'Bad time'}),/nonnegative/);
});

test('version numbers come from the revision: pruning an older video never renumbers later ones', async t => {
  const { filmData } = await import('../engine/lib/viewer/build.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-viewer-versions-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'storyboard.json'), JSON.stringify({ version: 2, title: 'Film', beats: [{ id: 'a', block: 'title', duration: 1, props: { text: 'A' } }] }));
  for (const [i, keep] of [[1, false], [2, true], [3, true]]) {
    const id = `r00${i}`, hash = String(i).repeat(64), object = `review/objects/${hash.slice(0, 2)}/${hash}.mp4`;
    if (keep) clip(path.join(root, object), '64x36'); // r001's video was pruned; its record remains
    fs.mkdirSync(path.join(root, 'review/revisions', id), { recursive: true });
    fs.writeFileSync(path.join(root, 'review/revisions', id, 'revision.json'), JSON.stringify({ id, kind: 'render', label: 'Rough cut', duration: 1, createdAt: new Date(2026, 9, 6, 9, i).toISOString(), videos: [{ profile: 'rough', object, sha256: hash }] }));
  }
  // A note pinned to r001 stays reachable although r001 can no longer play.
  fs.writeFileSync(path.join(root, 'review/notes.json'), JSON.stringify({ version: 1, notes: [{ id: 'n001', revision: 'r001', text: 'Too small on a phone', status: 'open', anchor: { at: 0.5 }, createdAt: new Date().toISOString() }] }));
  const f = await filmData(root, { out: path.join(root, 'build/viewer') });
  assert.deepEqual(f.versions.map(v => [v.id, v.number]), [['r002', 2], ['r003', 3]], 'r003 stays Version 3 when r001 can no longer play');
  const n = f.versions.at(-1).notes.find(x => x.id === 'n001');
  assert.ok(n, 'the note on the pruned revision is listed with the latest version');
  assert.deepEqual([n.earlier, n.earlierAt, n.at, n.pin], ['r001', 0.5, null, null], 'labelled with its own revision, never placed on the new picture');
});
