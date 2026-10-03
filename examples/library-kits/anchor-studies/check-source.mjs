// Bounded saved-scene negatives and exact decoded static-hold identity.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {exportAssetAnchors,verifyAnchorSource} from '../../../engine/lib/asset-anchors.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(root,'../../..'),read=f=>JSON.parse(fs.readFileSync(f)),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const evidence=path.join(root,'evidence');fs.mkdirSync(evidence,{recursive:true});const output=path.join(root,'build');fs.mkdirSync(output,{recursive:true});
function frames(file,select){const args=['-v','error','-threads','2','-i',file,...(select!==undefined?['-vf',`select=eq(n\\,${select})`,'-frames:v','1']:[]),'-vsync','0','-pix_fmt','yuv420p','-f','framehash','-hash','sha256','-'];const r=spawnSync('ffmpeg',args,{encoding:'utf8',maxBuffer:2e6});if(r.status!==0)throw Error(r.stderr);return r.stdout.split('\n').filter(s=>s&&!s.startsWith('#')).map(s=>s.split(',').at(-1).trim());}
const reports=[];
for(const name of ['reservoir-landscape','reservoir-vertical','conveyor-landscape','conveyor-vertical']){
 const asset=path.resolve(root,'../physical-mechanisms/media',name),manifest=read(path.join(root,'anchors',name+'.json')),hold=read(path.join(asset,'hold.json'));verifyAnchorSource(manifest,asset);
 const sourceFrame=frames(path.join(asset,'clip.mp4'),hold.sourceFrame),loopFrames=frames(path.join(asset,hold.holdClip));
 if(sourceFrame.length!==1||sourceFrame[0]!==hold.sourceYuvSha256||loopFrames.length!==48||loopFrames.some(h=>h!==sourceFrame[0]))throw Error('Held frames differ from registered original source frame');
 reports.push({name,asset:path.relative(repo,asset),manifestSha256:sha(path.join(root,'anchors',name+'.json')),sourceFrame:hold.sourceFrame,sourceYuvSha256:sourceFrame[0],loopFrames:loopFrames.length,allLoopFramesEqualSource:true,staticFrames:manifest.checks.frames,verticesPerFrame:manifest.checks.evaluatedVerticesPerFrame,maxCoordinateDrift:manifest.checks.maxCoordinateDrift});
}
const base=read(path.join(root,'definitions/reservoir-landscape.json')),negatives=[];
for(const [name,definition,pattern]of [['moving-range',{...base,frames:[0,192]},/static anchor range moves/],['overlapping-copy',{...base,copyZones:[{id:'bad',rect:[.4,.5,.2,.2]}]},/overlaps projected subject/]]){
 const out=path.join(output,`rejected-${name}.json`);if(fs.existsSync(out))throw Error('Unexpected old rejected output');let message;
 try{await exportAssetAnchors({assetDir:path.resolve(root,'../physical-mechanisms/media/reservoir-landscape'),definition,out});throw Error('Expected rejection');}catch(e){if(!pattern.test(e.message))throw e;message=e.message;}
 if(fs.existsSync(out))throw Error('Rejected export wrote an artifact');negatives.push({name,rejected:true,outputAbsent:true,reason:message.slice(message.indexOf('ValueError:'))});
}
const bindings=Object.fromEntries(['engine/lib/asset-anchors.mjs','scripts/blender/export_anchors.py'].map(p=>[p,sha(path.join(repo,p))]));
fs.writeFileSync(path.join(evidence,'source-checks.json'),JSON.stringify({status:'pass',scope:'Every claimed static geometry frame and every decoded held YUV frame; two actual saved-scene rejection cases. Does not establish visibility or continuous playback.',sourceFiles:bindings,variants:reports,negatives},null,2)+'\n');console.log(JSON.stringify({variants:reports.length,staticFrames:reports.reduce((a,v)=>a+v.staticFrames,0),heldFrames:reports.reduce((a,v)=>a+v.loopFrames,0),rejectedCases:negatives.length}));
