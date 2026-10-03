// Static prepared-asset registration. No renderer-dependent logic in native scenes.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const check=(ok,message)=>{if(!ok)throw Error(`asset anchors: ${message}`);};
const object=(v,keys,label)=>{check(v&&typeof v==='object'&&!Array.isArray(v),`${label} needs an object`);for(const k of Object.keys(v))check(keys.includes(k),`unknown ${label}.${k}`);};
const finite=(n,min,max,label)=>check(typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max,`${label} must be finite in [${min},${max}]`);
const slug=v=>check(typeof v==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(v),'ID needs a short slug');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const fileHash=f=>hash(fs.readFileSync(f));
const sha=v=>check(typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),'SHA-256 required');
function list(v,min,max,label){check(Array.isArray(v)&&v.length>=min&&v.length<=max,`${label} needs ${min}–${max} entries`);}
function rect(v,label){list(v,4,4,label);v.forEach(n=>finite(n,0,1,label));check(v[2]>0&&v[3]>0&&v[0]+v[2]<=1+1e-12&&v[1]+v[3]<=1+1e-12,`${label} leaves its image or has no area`);}
function bounds(v,label){list(v,4,4,label);v.forEach(n=>finite(n,0,1,label));check(v[2]>v[0]&&v[3]>v[1],`${label} has no area`);}
const overlap=(a,b,pad=0)=>a[0]<b[2]+pad&&a[0]+a[2]>b[0]-pad&&a[1]<b[3]+pad&&a[1]+a[3]>b[1]-pad;
export function validateAnchorDefinition(d){
 object(d,['version','frames','subjects','anchors','copyZones','padding'],'definition');check(d.version===1,'unsupported definition version');list(d.frames,2,2,'frames');d.frames.forEach(n=>check(Number.isSafeInteger(n)&&n>=0&&n<=72000,'frame must be a bounded nonnegative integer'));check(d.frames[1]>d.frames[0]&&d.frames[1]-d.frames[0]<=720,'held range needs 1–720 frames');
 list(d.subjects,1,256,'subjects');for(const s of d.subjects)check(typeof s==='string'&&s.length>0&&s.length<=160,'subject name required');check(new Set(d.subjects).size===d.subjects.length,'duplicate subjects');
 list(d.anchors,1,32,'anchors');const ids=new Set();for(const a of d.anchors){object(a,['id','object','local'],'anchor');slug(a.id);check(!ids.has(a.id),'duplicate anchor ID');ids.add(a.id);check(d.subjects.includes(a.object),'anchor must name one of the declared subjects');list(a.local,3,3,'local anchor');a.local.forEach(n=>finite(n,-10000,10000,'local anchor'));}
 list(d.copyZones,1,16,'copy zones');const zones=new Set();for(const z of d.copyZones){object(z,['id','rect'],'copy zone');slug(z.id);check(!zones.has(z.id),'duplicate copy zone ID');zones.add(z.id);rect(z.rect,'copy zone');}finite(d.padding,0,.1,'padding');return d;
}
export function validateAnchorManifest(m){
 object(m,['version','coordinates','width','height','frames','fps','projection','subjectBounds','objects','anchors','copyZones','padding','checks','limits','source','definitionSha256','exporterSha256'],'manifest');
 check(m.version===1&&m.coordinates==='normalized-top-left','unsupported coordinate convention');for(const k of ['width','height'])check(Number.isSafeInteger(m[k])&&m[k]>=16&&m[k]<=16384,'bounded image dimensions required');finite(m.fps,1,240,'FPS');check(['ortho','persp'].includes(m.projection),'unsupported projection');
 const definition={version:1,frames:m.frames,subjects:m.objects?.map(o=>o.name),anchors:m.anchors?.map(a=>({id:a.id,object:a.object,local:a.local})),copyZones:m.copyZones,padding:m.padding};validateAnchorDefinition(definition);
 bounds(m.subjectBounds,'subject bounds');for(const o of m.objects){object(o,['name','bounds'],'object bounds');bounds(o.bounds,'object bounds');check(o.bounds[0]>=m.subjectBounds[0]-1e-12&&o.bounds[1]>=m.subjectBounds[1]-1e-12&&o.bounds[2]<=m.subjectBounds[2]+1e-12&&o.bounds[3]<=m.subjectBounds[3]+1e-12,'object escapes declared subject bounds');}
 for(const a of m.anchors){object(a,['id','object','local','point','depth','visibility'],'anchor');list(a.point,2,2,'anchor point');a.point.forEach(n=>finite(n,0,1,'anchor coordinate'));finite(a.depth,0,1e12,'anchor depth');check(a.visibility==='unassessed','this contract does not establish visibility');}
 for(const z of m.copyZones)check(!m.objects.some(o=>overlap(z.rect,o.bounds,m.padding)),`copy zone ${z.id} intersects subject geometry`);
 object(m.checks,['frames','evaluatedVerticesPerFrame','maxCoordinateDrift','tolerance','blenderVersion'],'checks');check(m.checks.frames===m.frames[1]-m.frames[0],'every claimed hold frame must be checked');check(Number.isSafeInteger(m.checks.evaluatedVerticesPerFrame)&&m.checks.evaluatedVerticesPerFrame>0,'evaluated geometry evidence required');check(m.checks.tolerance===1e-7,'unsupported static tolerance');finite(m.checks.maxCoordinateDrift,0,m.checks.tolerance,'static drift');check(typeof m.checks.blenderVersion==='string','Blender version required');
 object(m.source,['scene','clip','receiptSha256'],'source');for(const k of ['scene','clip']){object(m.source[k],['file','sha256'],'source file');check(m.source[k].file===(k==='scene'?'scene.blend':'clip.mp4'),'unsupported prepared source name');sha(m.source[k].sha256);}sha(m.source.receiptSha256);sha(m.definitionSha256);sha(m.exporterSha256);list(m.limits,1,20,'limits');check(m.limits.every(v=>typeof v==='string'&&v.length<=400),'short limits required');return m;
}
export function verifyAnchorSource(m,assetDir){
 validateAnchorManifest(m);const root=path.resolve(assetDir);for(const k of ['scene','clip'])check(fileHash(path.join(root,m.source[k].file))===m.source[k].sha256,`${k} changed after anchor preparation`);check(fileHash(path.join(root,'receipt.json'))===m.source.receiptSha256,'receipt changed after anchor preparation');return true;
}
/** Coordinates use the exact same centered contain/cover transform as media.
 * This maps only a proven static source frame; no temporal extrapolation.
 */
export function placeAnchors(m,{frame,box,fit='contain'}){
 validateAnchorManifest(m);check(Number.isSafeInteger(frame)&&frame>=m.frames[0]&&frame<m.frames[1],'source frame is outside the checked static range');list(box,4,4,'destination box');box.forEach(n=>finite(n,-1e6,1e6,'destination coordinate'));check(box[2]>0&&box[3]>0&&box[0]+box[2]>box[0]&&box[1]+box[3]>box[1],'destination needs representable positive area');check(['contain','cover'].includes(fit),'fit must be contain or cover');
 const scale=(fit==='contain'?Math.min:Math.max)(box[2]/m.width,box[3]/m.height),w=m.width*scale,h=m.height*scale,x=box[0]+(box[2]-w)/2,y=box[1]+(box[3]-h)/2;
 check(Number.isFinite(scale)&&scale>0&&Number.isFinite(w)&&Number.isFinite(h)&&w>0&&h>0&&x+w>x&&y+h>y,'transformed image underflows or collapses');
 const point=p=>[x+p[0]*w,y+p[1]*h],area=r=>[x+r[0]*w,y+r[1]*h,r[2]*w,r[3]*h],visible=r=>r[0]>=box[0]-1e-8&&r[1]>=box[1]-1e-8&&r[0]+r[2]<=box[0]+box[2]+1e-8&&r[1]+r[3]<=box[1]+box[3]+1e-8;
 return{frame,fit,box,mediaRect:[x,y,w,h],subjectBounds:area([m.subjectBounds[0],m.subjectBounds[1],m.subjectBounds[2]-m.subjectBounds[0],m.subjectBounds[3]-m.subjectBounds[1]]),anchors:m.anchors.map(a=>{const p=point(a.point);return{id:a.id,point:p,inFrame:visible([...p,0,0]),visibility:a.visibility};}),copyZones:m.copyZones.map(z=>{const r=area(z.rect);return{id:z.id,rect:r,fullyVisible:visible(r)};}),sourceSha256:m.source.clip.sha256};
}
export function labelInZone(placement,zoneId,{width,height,align='center'}){
 const zone=placement.copyZones.find(z=>z.id===zoneId);check(zone&&zone.fullyVisible,'copy zone is missing or cropped');finite(width,.001,1e6,'label width');finite(height,.001,1e6,'label height');check(['left','center','right'].includes(align),'unknown label alignment');check(width<=zone.rect[2]+1e-8&&height<=zone.rect[3]+1e-8,'label rectangle does not fit its copy zone');
 return{x:zone.rect[0]+(zone.rect[2]-width)*({left:0,center:.5,right:1}[align]),y:zone.rect[1]+(zone.rect[3]-height)/2,width,height};
}
export async function exportAssetAnchors({assetDir,definition,out}){
 validateAnchorDefinition(definition);check(typeof out==='string'&&out.length>0,'new output JSON path required');const asset=path.resolve(assetDir),destination=path.resolve(out);check(!fs.existsSync(destination),'output already exists');
 const receiptFile=path.join(asset,'receipt.json'),receipt=read(receiptFile);check(receipt.status==='ready-for-review'&&receipt.blender?.bakedMotion===true,'prepared baked asset receipt required');
 const source={scene:{file:'scene.blend',sha256:fileHash(path.join(asset,'scene.blend'))},clip:{file:'clip.mp4',sha256:fileHash(path.join(asset,'clip.mp4'))},receiptSha256:fileHash(receiptFile)};
 for(const k of ['scene','clip'])check(receipt.outputs?.[source[k].file]?.sha256===source[k].sha256,`${k} does not match its prepared receipt`);
 check(definition.frames[1]<=receipt.config.frames,'anchor range exceeds encoded frames');const disk=fs.statfsSync(asset);check(disk.bavail*disk.bsize>=20*1024**3,'restore 20 GiB reserve before Blender work');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'clearframe-anchor-')),script=path.join(repo,'scripts/blender/export_anchors.py'),exporterSha256=fileHash(script),definitionSha256=hash(JSON.stringify(definition));
 try{
  const result=path.join(temp,'result.json'),request=path.join(temp,'request.json');fs.writeFileSync(request,JSON.stringify({scene:path.join(asset,'scene.blend'),definition,result,width:receipt.config.width,height:receipt.config.height,fps:receipt.config.fps}));
  await new Promise((resolve,reject)=>{
   const child=spawn(process.env.BLENDER_BIN||'blender',['--background','--factory-startup','--disable-autoexec','--threads','2','--python-exit-code','1','--python',script,'--','--request',request],{cwd:repo,stdio:['ignore','pipe','pipe']});let log='',spawnError;
   const collect=b=>{log=(log+b).slice(-12000);},interrupt=()=>child.kill('SIGINT'),terminate=()=>child.kill('SIGTERM');
   child.stdout.on('data',collect);child.stderr.on('data',collect);process.once('SIGINT',interrupt);process.once('SIGTERM',terminate);child.once('error',e=>{spawnError=e;});
   child.once('close',(code,signal)=>{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',terminate);if(spawnError)return reject(spawnError);code===0?resolve():reject(Error(`Anchor export failed (${code??signal}): ${log}`));});
  });
  const manifest=validateAnchorManifest({...read(result),source,definitionSha256,exporterSha256});verifyAnchorSource(manifest,asset);check(fileHash(script)===exporterSha256,'exporter changed during preparation');fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
