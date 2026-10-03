// Declared creative decisions bound to actual source bytes. No semantic inference.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
export function validateChoices(input){
 const fail=m=>{throw Error(`variation choices: ${m}`);};
 if(!input||typeof input!=='object'||Array.isArray(input))fail('expected an object');
 const fields=['mechanisms','materials','camera','story'];
 for(const key of Object.keys(input))if(!fields.includes(key))fail(`unknown field ${key}`);
 const out={};for(const key of fields){const values=input[key]??[];
  if(!Array.isArray(values)||values.length>12||values.some(v=>typeof v!=='string'||!v.trim()||v.length>100))fail(`${key} needs up to twelve short labels`);
  out[key]=[...new Set(values.map(v=>v.trim()))];
 }
 if(!out.mechanisms.length||!out.story.length)fail('declare mechanism and story choices');
 return out;
}
export function validateLedger(input){
 const fail=m=>{throw Error(`variation ledger: ${m}`);};
 if(input?.schemaVersion!==1||!['examples','projects'].includes(input.kind)||!Array.isArray(input.entries)||input.entries.length>1000)fail('expected a version 1 examples/projects ledger with at most 1000 entries');
 const seen=new Set();return{schemaVersion:1,kind:input.kind,title:typeof input.title==='string'?input.title.slice(0,200):'Creative choices',entries:input.entries.map(e=>{
  if(!e||typeof e.id!=='string'||!e.id.match(/^[a-f0-9]{64}$/)||seen.has(e.id))fail('invalid/duplicate entry id');seen.add(e.id);
  if(typeof e.title!=='string'||!e.title.trim()||e.title.length>300||typeof e.project!=='string'||!e.project.trim()||e.project.length>2000||!/^\d{4}-\d\d-\d\dT/.test(e.recordedAt)||!Number.isFinite(Date.parse(e.recordedAt))||!e.storyboardSha256?.match(/^[a-f0-9]{64}$/))fail('entry needs title, project, date and source hash');
  if(!Array.isArray(e.assets)||e.assets.length>30||e.assets.some(a=>typeof a!=='string'||!/^[a-z0-9][a-z0-9/-]*$/i.test(a)))fail('invalid asset references');
  if(e.note!=null&&(typeof e.note!=='string'||e.note.length>1200))fail('note must be short text');
  return{id:e.id,title:e.title,project:e.project,recordedAt:e.recordedAt,storyboardSha256:e.storyboardSha256,assets:[...new Set(e.assets)],choices:validateChoices(e.choices),note:e.note??''};
 })};
}
export function summarizeVariation(ledger,{limit=12}={}){
 const data=validateLedger(ledger);if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('variation limit must be 1–100');
 const entries=[...data.entries].sort((a,b)=>Date.parse(b.recordedAt)-Date.parse(a.recordedAt)||a.id.localeCompare(b.id)).slice(0,limit);
 const canonical=values=>[...new Set(values.map(v=>v.toLowerCase().replace(/\s+/g,' ').trim()))].sort();
 const groups=new Map();for(const e of entries){const signature=JSON.stringify([canonical(e.choices.mechanisms),canonical(e.choices.story)]);const group=groups.get(signature)??{mechanisms:e.choices.mechanisms,story:e.choices.story,entries:[],materials:[],camera:[]};group.entries.push(e.id);group.materials.push(...e.choices.materials);group.camera.push(...e.choices.camera);groups.set(signature,group);}
 return{kind:data.kind,title:data.title,entries,repeated:[...groups.values()].filter(g=>g.entries.length>1).map(g=>({...g,materials:[...new Set(g.materials)],camera:[...new Set(g.camera)]})),basis:'Declared mechanism and story labels; palette and seed do not establish a new concept. Repetition can be appropriate; this report never changes a film.'};
}
export function recordProject({project,choices,ledgerFile,assets=[],note='',kind='projects',recordedAt=new Date().toISOString()}){
 const file=path.join(path.resolve(project),'storyboard.json'),bytes=fs.readFileSync(file),sb=JSON.parse(bytes),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),c=validateChoices(choices);
 fs.mkdirSync(path.dirname(path.resolve(ledgerFile)),{recursive:true});
 const lock=path.resolve(ledgerFile)+'.lock';let handle;
 try{handle=fs.openSync(lock,'wx');}catch(error){if(error.code==='EEXIST')throw Error('variation ledger: another writer holds the ledger lock; retry after it finishes');throw error;}
 try{
 const existing=fs.existsSync(ledgerFile)?validateLedger(JSON.parse(fs.readFileSync(ledgerFile,'utf8'))):{schemaVersion:1,kind,title:kind==='examples'?'Example decisions':'Project decisions',entries:[]};
 if(existing.kind!==kind)throw Error('variation ledger: do not mix example history and project history');
 const identity={project:path.resolve(project),storyboardSha256:hash(bytes),choices:c};const id=hash(JSON.stringify(identity));
 if(existing.entries.some(e=>e.id===id))return{added:false,id,ledger:existing};
 const entry={id,title:sb.title??path.basename(project),...identity,assets,note,recordedAt};const next=validateLedger({...existing,entries:[...existing.entries,entry]});
 const temp=path.resolve(ledgerFile)+`.${process.pid}.tmp`;
 try{fs.writeFileSync(temp,JSON.stringify(next,null,2)+'\n',{flag:'wx'});fs.renameSync(temp,ledgerFile);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
 return{added:true,id,ledger:next};
 }finally{fs.closeSync(handle);fs.unlinkSync(lock);}
}
