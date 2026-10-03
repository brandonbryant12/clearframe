// Read-only indexing of retained packages; declarations and file proof stay separate.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
export const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const BROWSER_VERSION=1;
const lifecycle=new Set(['idea','prototype','ready-for-review','accepted','deprecated']);
const check=(ok,m)=>{if(!ok)throw Error(`library browser: ${m}`);};
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
export function safeLocal(root,relative,{optional=false}={}){
 check(typeof relative==='string'&&relative.length>0&&!relative.includes('\\')&&!relative.includes('\0')&&!/^[a-z][a-z0-9+.-]*:/i.test(relative)&&!path.isAbsolute(relative)&&!relative.split('/').some(p=>p==='..'||p==='.'),'unsafe local reference');
 const resolved=path.resolve(root,relative);check(resolved.startsWith(path.resolve(root)+path.sep),'reference escapes its root');
 if(!fs.existsSync(resolved)){if(optional)return null;throw Error(`library browser: missing ${relative}`);}
 const real=fs.realpathSync(resolved);check(real.startsWith(fs.realpathSync(root)+path.sep),'symlink escapes its root');check(fs.statSync(real).isFile(),'reference must name a file');return resolved;
}
async function digest(file){const h=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))h.update(chunk);return h.digest('hex');}
const unique=a=>[...new Set(a)];
const asList=v=>Array.isArray(v)?v:typeof v==='string'?[v]:[];
const titleCase=s=>s.replaceAll('-',' ').replace(/^./,x=>x.toUpperCase());
export async function catalog({root=repoRoot,verify=false,inventoryFile='docs/research/timmer-library/inventory.json',linksFile='docs/research/timmer-library/asset-links.json'}={}){
 const inventory=read(safeLocal(root,inventoryFile)),links=read(safeLocal(root,linksFile));check(Array.isArray(inventory.items),'inventory needs items');check(links.schemaVersion===1,'unsupported links schema');
 const items=new Map(inventory.items.map(x=>[x.id,x])),ids=a=>{for(const id of a)check(items.has(id),`unknown inventory id ${id}`);return unique(a);};
 for(const c of links.collections)ids(c.items);
 const rootRelative=f=>path.relative(root,f).split(path.sep).join('/');
 const sourceRegisters=['docs/research/timmer-library/sources.json','docs/research/timmer-library/retirement-sources.json'].map(f=>safeLocal(root,f,{optional:true})).filter(Boolean);
 const sources=sourceRegisters.flatMap(f=>read(f).sources??[]).map(s=>{check(/^https:\/\//.test(s.url),'source URL must use HTTPS');return{id:s.id,title:s.title,url:s.url,kind:s.kind,access:s.access,date:s.date};});
 const records=[],packages=[],seen=new Set();
 for(const dir of fs.readdirSync(path.join(root,'examples/library-kits'),{withFileTypes:true}).filter(d=>d.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){
  const base=path.join(root,'examples/library-kits',dir.name),manifestPath=safeLocal(base,'kit.json',{optional:true});if(!manifestPath)continue;
  const k=read(manifestPath);check(k.schemaVersion===1&&/^[a-z][a-z0-9-]+$/.test(k.id)&&!seen.has(k.id),'invalid/duplicate package id');seen.add(k.id);check(lifecycle.has(k.status),'unknown declared lifecycle');check(Array.isArray(k.files)&&k.files.length<=10000,'file manifest required');
  const fileMap=new Map(),issues=[];for(const f of k.files){check(!fileMap.has(f.path),'duplicate file record');check(/^[a-f0-9]{64}$/.test(f.sha256)&&Number.isSafeInteger(f.bytes)&&f.bytes>=0,'invalid file identity');
   const file=safeLocal(base,f.path,{optional:true});let state=file?'present':'missing';if(file&&verify)state=fs.statSync(file).size===f.bytes&&await digest(file)===f.sha256?'verified':'changed';
   if(state==='missing'||state==='changed')issues.push({path:f.path,state});fileMap.set(f.path,{file,state});
  }
  const local=rel=>{if(!rel)return null;const f=fileMap.get(rel);return f?.file&&f.state!=='changed'?rootRelative(f.file):null;};
  const map=links.packages[k.id]??{},packageIds=ids(k.inventoryIds??map.inventoryIds??[]),auditPath=local('audit.json'),audit=auditPath?read(path.join(root,auditPath)):null;
  const hashState=issues.length?'changed':verify?'verified':'not-checked',pack={id:k.id,title:k.title,purpose:k.purpose,status:k.status,integrity:hashState,fileCount:k.files.length,issues,inventoryIds:packageIds,manifest:rootRelative(manifestPath),preview:local(k.includes?.preview),readme:local('README.md'),review:local('REVIEW.md'),sources:local('SOURCES.md'),tags:k.tags??{},editable:k.editable??{},requires:k.requires??{},evidence:k.evidence??{}};packages.push(pack);
  const grouped=new Map();
  for(const specimen of asList(k.includes?.specimens??k.includes?.specimen)){
   const source=local(specimen),sb=source?read(path.join(root,source)):null;
   const name=path.posix.basename(path.posix.dirname(specimen)),preset=sb?.format?.preset??name.match(/-(landscape|vertical|portrait|square)$/)?.[1]??'landscape',caseId=name==='.'?k.id:name.replace(/-(landscape|vertical|portrait|square)$/,'');
   const a=audit?.results?.find(a=>path.posix.basename(a.project??a.name??'')===name),related=ids(map.cases?.[caseId]??(a?.recipe?[a.recipe]:packageIds.length===1?packageIds:[]));
   let record=grouped.get(caseId);if(!record){const title=a?.recipe&&/^R\d\d: retirement mechanism specimens$/.test(sb?.title??'')?items.get(a.recipe).name:sb?.title??titleCase(caseId);record={id:`${k.id}/${caseId}`,kind:'example',title,packageId:k.id,inventoryIds:related,variants:[],description:k.purpose};grouped.set(caseId,record);}
   const video=source?local(`evidence/${name}/video.mp4`):null,receipt=local(`evidence/${name}/video.mp4.json`),job=local(`evidence/${name}/native-job.json`);
   const captured=k.files.filter(f=>f.path.startsWith(`evidence/independent-review/${name}/`)&&f.path.endsWith('.png')).map(f=>f.path).sort((a,b)=>parseFloat(path.posix.basename(b))-parseFloat(path.posix.basename(a)));
   const poster=local(captured[0])??local(`evidence/${name}/sheet.png`);
   let duration=null;for(const candidate of [job,receipt].filter(Boolean)){const j=read(path.join(root,candidate));if(Number.isInteger(j.frames)&&j.frames>0&&Number.isFinite(j.fps)&&j.fps>0){duration=j.frames/j.fps;break;}if(Number.isFinite(j.duration)&&j.duration>0){duration=j.duration;break;}}
   record.variants.push({id:preset,source,video,poster,receipt,duration,previewType:video?'native-specimen':'source-only'});
  }
  if(!grouped.size&&map.insert){grouped.set(k.id,{id:`${k.id}/${k.id}`,kind:'example',title:k.title,packageId:k.id,inventoryIds:packageIds,description:k.purpose,variants:[]});}
  for(const record of grouped.values()){
   if(map.insert&&record.variants.every(v=>!v.video))record.variants=[{...(record.variants[0]??{id:'landscape'}),video:local(map.insert),poster:local(map.poster),previewType:'prepared-insert',duration:null}];
   record.hasPreview=record.variants.some(v=>v.video);records.push(record);
  }
 }
 for(const i of inventory.items){
  const related=records.filter(r=>r.inventoryIds.includes(i.id));const sourceFiles=asList(links.sourceOnly?.[i.id]).map(f=>rootRelative(safeLocal(root,f)));
  records.push({id:i.id,kind:'inventory',title:i.name,description:i.visual,inventoryIds:[i.id],medium:i.category,statusText:i.readiness,guardrail:i.guardrail,parameters:i.parameters??[],related:related.map(r=>r.id),sourceFiles,hasPreview:false});
 }
 for(const r of records){const p=packages.find(p=>p.id===r.packageId);r.status=p?.status??(r.related?.length?'has-example':r.sourceFiles?.length?'source-only':'planned');r.integrity=p?.integrity??'not-applicable';r.medium??=r.inventoryIds.some(id=>id.startsWith('B')||id.startsWith('M'))?'Blender + native':'Native';
  r.purposes=p?.tags.purpose??[];r.appearance=p?.tags.appearance??[];r.movement=p?.tags.movement??[];r.subjects=p?.tags.subject??[];r.collections=links.collections.filter(c=>r.inventoryIds.some(id=>c.items.includes(id))).map(c=>c.id);
  r.sourceIds=unique(r.inventoryIds.flatMap(id=>items.get(id)?.sourceIds??[]));r.search=[r.title,r.description,...r.inventoryIds,...r.purposes,...r.appearance,...r.movement,...r.subjects,...r.sourceIds,...r.inventoryIds.flatMap(id=>{const i=items.get(id);return[i?.name,i?.visual,...(i?.parameters??[]),...(i?.reuse??[])];})].join(' ').toLowerCase();
 }
 return{schemaVersion:BROWSER_VERSION,scope:'Retained example packages and the expansion inventory; not an installer or acceptance authority',verified:verify,inventoryFile,linksFile,collections:links.collections,sources,packages,records};
}
export function filtered(data,{query='',kind='example',collection='',purpose='',medium='',status='',preview=false}={}){const q=query.toLowerCase().trim().split(/\s+/).filter(Boolean);return data.records.filter(r=>r.kind===kind&&(!collection||r.collections.includes(collection))&&(!purpose||r.purposes.includes(purpose))&&(!medium||r.medium===medium)&&(!status||r.status===status)&&(!preview||r.hasPreview)&&q.every(t=>r.search.includes(t)));}
