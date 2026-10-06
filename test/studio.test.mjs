import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { studioState, studioCommand } from '../engine/lib/viewer/studio.mjs';
const fixture = t => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-studio-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({version:2,title:'Film',music:false,beats:[{id:'a',block:'title',duration:3,props:{text:'First'}},{id:'b',block:'statement',duration:4,props:{text:'Second'}}]})); return dir; };
test('studio edits survive reload, undo and redo; stale clients cannot overwrite newer edits', t => {
 const d=fixture(t), a=studioState(d); const b=studioCommand(d,{hash:a.hash,command:'beat.set',beat:'a',field:'props.text',value:'Changed'});
 assert.equal(studioState(d).storyboard.beats[0].props.text,'Changed'); assert.ok(b.canUndo);
 assert.throws(()=>studioCommand(d,{hash:a.hash,command:'beat.set',beat:'a',field:'props.text',value:'Stale'}),/changed elsewhere/);
 const c=studioCommand(d,{hash:b.hash,command:'undo'}); assert.equal(c.storyboard.beats[0].props.text,'First'); assert.ok(c.canRedo);
 const e=studioCommand(d,{hash:c.hash,command:'redo'}); assert.equal(e.storyboard.beats[0].props.text,'Changed');
});
test('new edit after undo drops redo; reorder preserves scene identity',t=>{
 const d=fixture(t); let s=studioState(d); s=studioCommand(d,{hash:s.hash,command:'beat.move',beat:'b',direction:-1}); assert.deepEqual(s.storyboard.beats.map(x=>x.id),['b','a']);
 s=studioCommand(d,{hash:s.hash,command:'undo'});s=studioCommand(d,{hash:s.hash,command:'beat.set',beat:'a',field:'label',value:'Opening'});assert.equal(s.canRedo,false);
});
test('external file changes cannot be undone through stale studio history',t=>{
 const d=fixture(t);let s=studioState(d);s=studioCommand(d,{hash:s.hash,command:'beat.set',beat:'a',field:'label',value:'Old'});
 const sb=s.storyboard;sb.title='External';fs.writeFileSync(path.join(d,'storyboard.json'),JSON.stringify(sb));s=studioState(d);assert.equal(s.externalChanges,true);assert.equal(s.canUndo,false);
 assert.throws(()=>studioCommand(d,{hash:s.hash,command:'undo'}),/Nothing/);
 s=studioCommand(d,{hash:s.hash,command:'beat.set',beat:'a',field:'label',value:'New'});s=studioCommand(d,{hash:s.hash,command:'undo'});assert.equal(s.storyboard.title,'External');
});
test('studio rejects invalid durations and unexpected properties without touching source',t=>{
 const d=fixture(t),s=studioState(d);
 for(const [field,value] of [['duration',-5],['__proto__.x','unsafe'],['props.text',{}]]) assert.throws(()=>studioCommand(d,{hash:s.hash,command:'beat.set',beat:'a',field,value}));
 assert.equal(studioState(d).hash,s.hash);
});
