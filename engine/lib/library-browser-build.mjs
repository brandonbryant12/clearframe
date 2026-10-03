import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {catalog,repoRoot,filtered} from './library-browser.mjs';
import {validateChoices,validateLedger,summarizeVariation} from './variation-ledger.mjs';

export async function buildLibraryBrowser({out=path.join(repoRoot,'docs/library-browser'),verify=false,ledgerFile}={}){
 const output=path.resolve(out),data=await catalog({verify});
 const ledger=ledgerFile?validateLedger(JSON.parse(fs.readFileSync(ledgerFile,'utf8'))):{schemaVersion:1,kind:'projects',title:'Project decisions',entries:[]};
 const ledgerProof=Object.fromEntries(ledger.entries.map(e=>{const file=path.resolve(repoRoot,e.project,'storyboard.json');let state='missing';try{state=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')===e.storyboardSha256?'verified':'changed';}catch(error){if(!['ENOENT','ENOTDIR'].includes(error.code))state='unreadable';}return[e.id,state];}));
 // A classic script with escaped data works offline, without fetch or module CORS.
 const literal=v=>JSON.stringify(v).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
 const relative=path.relative(output,repoRoot).split(path.sep).map(encodeURIComponent).join('/')||'.';
 const ui=path.join(repoRoot,'engine/ui/library-browser');fs.mkdirSync(output,{recursive:true});
 const html=fs.readFileSync(path.join(ui,'index.html'),'utf8');
 const css=fs.readFileSync(path.join(ui,'style.css'),'utf8').replaceAll('__REPO__',relative);
 const app=`'use strict';\nconst catalogData=${literal(data)};\nconst initialLedger=${literal(ledger)};\nconst initialLedgerProof=${literal(ledgerProof)};\nconst repoBase=${literal(relative)};\n${[filtered,validateChoices,validateLedger,summarizeVariation].map(f=>f.toString()).join('\n')}\n${fs.readFileSync(path.join(ui,'app.js'),'utf8')}`;
 for(const [name,content] of Object.entries({'index.html':html,'style.css':css,'app.js':app,'catalog.json':JSON.stringify(data,null,2)+'\n'}))fs.writeFileSync(path.join(output,name),content);
 return{path:path.join(output,'index.html'),packages:data.packages.length,examples:data.records.filter(r=>r.kind==='example').length,inventory:data.records.filter(r=>r.kind==='inventory').length,verified:verify,issues:data.packages.flatMap(p=>p.issues.map(i=>({package:p.id,...i})))};
}
