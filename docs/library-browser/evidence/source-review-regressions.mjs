// Independent bounded source/data checks. No renderer, server or browser is started.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {catalog,filtered,safeLocal,repoRoot} from '../../../engine/lib/library-browser.mjs';
import {buildLibraryBrowser} from '../../../engine/lib/library-browser-build.mjs';
import {validateLedger,summarizeVariation,recordProject} from '../../../engine/lib/variation-ledger.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const results=[];
const ok=(name,fn)=>{fn();results.push({name,passed:true});};
const d=await catalog();
ok('Current catalog has 11 kits, 51 examples, 71 inventory items',()=>{assert.equal(d.packages.length,11);assert.equal(d.records.filter(r=>r.kind==='example').length,51);assert.equal(d.records.filter(r=>r.kind==='inventory').length,71);});
let links=0,durations=0;
for(const r of d.records)for(const v of r.variants??[]){
 for(const k of ['source','video','poster','receipt'])if(v[k]){safeLocal(repoRoot,v[k]);links++;}
 if(v.receipt){const receipt=JSON.parse(fs.readFileSync(path.join(repoRoot,v.receipt)));assert.equal(v.duration,receipt.frames/receipt.fps);durations++;}
}
results.push({name:'Safe existing local variant links',passed:true,count:links},{name:'Media durations equal frame count divided by FPS',passed:true,count:durations});
ok('Authored specimen titles distinguish operation examples',()=>{assert.notEqual(d.records.find(r=>r.id==='time-series-studies/pay-and-prices').title,d.records.find(r=>r.id==='time-series-studies/budget-and-prices').title);assert(filtered(d,{query:'growing more slowly'}).some(r=>r.id==='time-series-studies/slower-expansion'));});
const sourceIds=new Set(d.sources.map(s=>s.id));ok('All record research IDs resolve',()=>{for(const r of d.records)for(const id of r.sourceIds)assert(sourceIds.has(id));});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cf-independent-browser-review-'));
try{
 const root=path.join(temp,'fixture'),base=path.join(root,'examples/library-kits/sample'),source='specimens/sample-landscape/storyboard.json',video='evidence/sample-landscape/video.mp4';
 fs.mkdirSync(path.dirname(path.join(base,source)),{recursive:true});fs.mkdirSync(path.dirname(path.join(base,video)),{recursive:true});
 fs.writeFileSync(path.join(root,'inventory.json'),JSON.stringify({items:[{id:'C01',name:'Line chart'},{id:'C02',name:'Indexed chart'}]}));
 const map={schemaVersion:1,collections:[],packages:{'sample-kit':{cases:{sample:['C01']}}},sourceOnly:{}};
 fs.writeFileSync(path.join(root,'links.json'),JSON.stringify(map));
 fs.writeFileSync(path.join(base,source),JSON.stringify({title:'One line',format:{preset:'landscape'}}));fs.writeFileSync(path.join(base,video),'original');fs.writeFileSync(path.join(base,'audit.json'),JSON.stringify({results:[{project:'sample-landscape',recipe:'C01'}]}));
 const files=[source,video,'audit.json'].map(p=>{const b=fs.readFileSync(path.join(base,p));return{path:p,bytes:b.length,sha256:sha(b)};});
 fs.writeFileSync(path.join(base,'kit.json'),JSON.stringify({schemaVersion:1,id:'sample-kit',status:'prototype',inventoryIds:['C01','C02'],includes:{specimens:[source]},files}));
 const opts={root,verify:true,inventoryFile:'inventory.json',linksFile:'links.json'};
 let x=await catalog(opts);ok('Verified fixture preserves declared prototype lifecycle',()=>{assert.equal(x.packages[0].status,'prototype');assert.equal(x.packages[0].integrity,'verified');assert(x.records[0].hasPreview);});
 fs.writeFileSync(path.join(base,video),'modified');x=await catalog(opts);ok('Changed video disables preview without changing lifecycle',()=>{assert.equal(x.records[0].variants[0].video,null);assert.equal(x.packages[0].status,'prototype');assert(x.packages[0].issues.some(i=>i.path===video&&i.state==='changed'));});
 fs.unlinkSync(path.join(base,video));x=await catalog(opts);ok('Missing video remains an inspectable issue',()=>assert(x.packages[0].issues.some(i=>i.path===video&&i.state==='missing')));
 fs.unlinkSync(path.join(base,'audit.json'));x=await catalog(opts);ok('Explicit case mapping survives missing audit without broadening',()=>assert.deepEqual(x.records[0].inventoryIds,['C01']));
 map.packages={};fs.writeFileSync(path.join(root,'links.json'),JSON.stringify(map));x=await catalog(opts);ok('Ambiguous package mapping is unavailable when audit is missing',()=>assert.deepEqual(x.records[0].inventoryIds,[]));
 fs.unlinkSync(path.join(base,source));x=await catalog(opts);ok('Missing storyboard keeps record, disables source and media',()=>{assert.equal(x.records[0].kind,'example');assert.equal(x.records[0].variants[0].source,null);assert.equal(x.records[0].variants[0].video,null);});
 fs.writeFileSync(path.join(base,'outside-symlink-target'),'x');fs.symlinkSync(path.join(root,'inventory.json'),path.join(base,'escape'));
 ok('Traversal, remote references, absolute paths and escape symlinks reject',()=>{for(const ref of ['../inventory.json','https://example.test/x','javascript:alert(1)','/tmp/a','escape','a\\b','./x'])assert.throws(()=>safeLocal(base,ref),/unsafe|escapes/);});
 const choices={mechanisms:['Balance'],story:['Reveal a counterforce'],materials:[],camera:[]};
 const entry=(id,project,hash=sha('source'),c=choices)=>({id:id.repeat(64),title:'Example </script><img src=x>',project,storyboardSha256:hash,recordedAt:'2026-10-03T00:00:00Z',assets:[],choices:c});
 ok('Case/whitespace duplicate labels remain one declared concept',()=>{const r=summarizeVariation({schemaVersion:1,kind:'projects',entries:[entry('a','x'),entry('b','y',sha('source'),{...choices,mechanisms:['Balance',' balance '],story:['Reveal a counterforce','reveal   a counterforce']})]});assert.equal(r.repeated.length,1);assert.equal(r.repeated[0].entries.length,2);});
 ok('Unsafe imported asset URL cannot become a library link',()=>assert.throws(()=>validateLedger({schemaVersion:1,kind:'projects',entries:[{...entry('a','x'),assets:['javascript:alert(1)']}]}),/asset/));
 const good=path.join(temp,'source-good'),missing=path.join(temp,'source-missing'),unreadable=path.join(temp,'source-unreadable');fs.mkdirSync(good);fs.writeFileSync(path.join(good,'storyboard.json'),'source');fs.mkdirSync(path.join(unreadable,'storyboard.json'),{recursive:true});
 const ledger={schemaVersion:1,kind:'projects',entries:[entry('a',good),entry('b',good,'0'.repeat(64)),entry('c',missing),entry('d',unreadable)]},ledgerPath=path.join(temp,'ledger.json');fs.writeFileSync(ledgerPath,JSON.stringify(ledger));
 const out=path.join(temp,'static-output');await buildLibraryBrowser({out,ledgerFile:ledgerPath});const app=fs.readFileSync(path.join(out,'app.js'),'utf8');const proof=JSON.parse(app.match(/^const initialLedgerProof=(.+);$/m)[1]);
 ok('Initial ledger distinguishes verified/changed/missing/unreadable source bytes',()=>assert.deepEqual(Object.values(proof),['verified','changed','missing','unreadable']));
 ok('Embedded ledger text escapes HTML script delimiters',()=>{assert(!app.includes('</script>'));assert(app.includes('\\u003c/script>'));});
 const project=path.join(temp,'record-project');fs.mkdirSync(project);const bytes=JSON.stringify({title:'Record fixture',beats:[]});fs.writeFileSync(path.join(project,'storyboard.json'),bytes);const log=path.join(temp,'project-log.json');fs.writeFileSync(log+'.lock','held');
 ok('Ledger lock prevents concurrent writer and preserves source bytes',()=>{assert.throws(()=>recordProject({project,choices,ledgerFile:log}),/writer holds/);assert.equal(fs.readFileSync(path.join(project,'storyboard.json'),'utf8'),bytes);assert(!fs.existsSync(log));});
}finally{fs.rmSync(temp,{recursive:true,force:true});}
const report={reviewedAt:new Date().toISOString(),scope:'Focused source/data fixtures only; no browser, server, renderer or full package hash sweep',results,browserReview:'pending explicit browser-preview authorization'};
fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'source-review-regressions.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checks:results.length,passed:results.filter(x=>x.passed).length,links,durations,browserReview:report.browserReview}));
