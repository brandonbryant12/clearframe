import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {catalog,filtered,safeLocal} from '../engine/lib/library-browser.mjs';
import {recordProject,validateChoices,validateLedger,summarizeVariation} from '../engine/lib/variation-ledger.mjs';
import crypto from 'node:crypto';
test('catalog links each specimen to its operation without turning file presence into acceptance',async()=>{
 const d=await catalog();assert(d.packages.length>=8);assert(d.records.filter(r=>r.kind==='example').length>=39);
 const pension=d.records.find(r=>r.id==='retirement-mechanisms/r06');assert.deepEqual(pension.inventoryIds,['R06']);assert.equal(pension.status,'prototype');assert.equal(pension.integrity,'not-checked');
 const balance=d.records.find(r=>r.packageId==='balance-study');assert.equal(balance.variants[0].previewType,'prepared-insert');assert.equal(balance.status,'ready-for-review');
 assert(filtered(d,{query:'vesting'}).some(r=>r.id==='retirement-mechanisms/r03'));assert(filtered(d,{kind:'inventory',query:'C13'}).every(r=>!r.hasPreview));
 assert.equal(filtered(d,{status:'accepted'}).length,0);assert.equal(d.sources.length,27);
});
test('verified catalog disables altered or missing previews and preserves the declared package state',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cf-integrity-'));
 try{const base=path.join(root,'examples/library-kits/sample');fs.mkdirSync(path.join(base,'evidence/sample-landscape'),{recursive:true});fs.mkdirSync(path.join(base,'specimens/sample-landscape'),{recursive:true});
 fs.writeFileSync(path.join(root,'inventory.json'),JSON.stringify({items:[{id:'C01',name:'Example',category:'Chart'}]}));fs.writeFileSync(path.join(root,'links.json'),JSON.stringify({schemaVersion:1,collections:[],packages:{},sourceOnly:{}}));
 const source='specimens/sample-landscape/storyboard.json',video='evidence/sample-landscape/video.mp4';fs.writeFileSync(path.join(base,source),JSON.stringify({title:'Example',format:{preset:'landscape'}}));fs.writeFileSync(path.join(base,video),'original');
 const files=[source,video].map(p=>{const b=fs.readFileSync(path.join(base,p));return{path:p,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};});fs.writeFileSync(path.join(base,'kit.json'),JSON.stringify({schemaVersion:1,id:'sample-kit',status:'prototype',inventoryIds:['C01'],includes:{specimens:[source]},files}));
 const options={root,verify:true,inventoryFile:'inventory.json',linksFile:'links.json'};assert.equal((await catalog(options)).records[0].hasPreview,true);
 fs.writeFileSync(path.join(base,video),'altered!');let d=await catalog(options);assert.equal(d.packages[0].integrity,'changed');assert.equal(d.packages[0].status,'prototype');assert.equal(d.records[0].variants[0].video,null);
 fs.unlinkSync(path.join(base,video));d=await catalog(options);assert.equal(d.packages[0].issues[0].state,'missing');assert.equal(d.records[0].hasPreview,false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('local references reject traversal, remote URLs and symlinks outside the package',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cf-catalog-'));try{fs.mkdirSync(path.join(tmp,'kit'));fs.writeFileSync(path.join(tmp,'outside'),'x');fs.symlinkSync(path.join(tmp,'outside'),path.join(tmp,'kit','escape'));
 for(const p of ['../outside','https://example.test/x','/tmp/file','escape'])assert.throws(()=>safeLocal(path.join(tmp,'kit'),p),/unsafe|escapes/);
 assert.equal(safeLocal(path.join(tmp,'kit'),'missing',{optional:true}),null);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('variation ledger binds real source bytes and keeps material/camera variations within a repeated concept',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cf-variation-'));try{
 fs.writeFileSync(path.join(tmp,'storyboard.json'),JSON.stringify({title:'Example',beats:[]}));const ledgerFile=path.join(tmp,'ledger.json'),choices={mechanisms:['Balance'],story:['Reveal a counterforce'],materials:['Brass'],camera:['Locked']};
 const a=recordProject({project:tmp,choices,ledgerFile,recordedAt:'2026-10-03T00:00:00Z'});assert(a.added);assert(!recordProject({project:tmp,choices,ledgerFile}).added);
 const b=recordProject({project:tmp,choices:{...choices,materials:['Porcelain'],camera:['Pullback']},ledgerFile,recordedAt:'2026-10-03T01:00:00Z'});const report=summarizeVariation(b.ledger);assert.equal(report.repeated.length,1);assert.equal(report.repeated[0].entries.length,2);
 fs.writeFileSync(path.join(tmp,'storyboard.json'),JSON.stringify({title:'Changed source',beats:[]}));const c=recordProject({project:tmp,choices,ledgerFile});assert.notEqual(c.ledger.entries.at(-1).storyboardSha256,a.ledger.entries[0].storyboardSha256);
 assert.throws(()=>recordProject({project:tmp,choices,ledgerFile,kind:'examples'}),/do not mix/);
 assert.throws(()=>validateChoices({...choices,palette:['new color']}),/unknown/);assert.throws(()=>validateLedger({...c.ledger,entries:[c.ledger.entries[0],c.ledger.entries[0]]}),/duplicate/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
