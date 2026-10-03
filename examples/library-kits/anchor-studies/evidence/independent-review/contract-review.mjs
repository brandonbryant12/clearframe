// Independent bounded geometry/guard checks. No Blender, renderer or browser.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {validateAnchorDefinition,validateAnchorManifest,placeAnchors,labelInZone,verifyAnchorSource,exportAssetAnchors} from '../../../../../engine/lib/asset-anchors.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},near=(a,b)=>{assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);checks++;},reject=fn=>{assert.throws(fn);checks++;};
const definition={version:1,frames:[4,7],subjects:['Geometry'],anchors:[{id:'tip',object:'Geometry',local:[0,0,0]}],copyZones:[{id:'heading',rect:[.1,0,.8,.1]}],padding:.01};
const base={version:1,coordinates:'normalized-top-left',width:200,height:100,frames:[4,7],fps:24,projection:'ortho',subjectBounds:[.2,.3,.8,.9],objects:[{name:'Geometry',bounds:[.2,.3,.8,.9]}],anchors:[{...definition.anchors[0],point:[.25,.5],depth:10,visibility:'unassessed'}],copyZones:definition.copyZones,padding:.01,checks:{frames:3,evaluatedVerticesPerFrame:8,maxCoordinateDrift:0,tolerance:1e-7,blenderVersion:'independent fixture'},limits:['Fixture only; no rendered visibility claim'],source:{scene:{file:'scene.blend',sha256:sha('scene')},clip:{file:'clip.mp4',sha256:sha('clip')},receiptSha256:sha('receipt')},definitionSha256:sha(JSON.stringify(definition)),exporterSha256:sha('exporter')};
eq(validateAnchorDefinition(definition),definition);eq(validateAnchorManifest(base),base);
for(const width of [50,200,300,600])for(const height of [40,100,250,500])for(const fit of ['contain','cover']){
 const box=[17,-31,width,height],p=placeAnchors(base,{frame:4,box,fit});
 // Select the fitted edge by cross multiplication, then derive coordinates
 // around the destination center instead of reusing the implementation origin.
 const widthLimited=width*base.height<=height*base.width;
 const drawWidth=(fit==='contain'?widthLimited:!widthLimited)?width:height*2;
 const drawHeight=drawWidth/2,center=[17+width/2,-31+height/2];
 near(p.mediaRect[2],drawWidth);near(p.mediaRect[3],drawHeight);
 near(p.mediaRect[0]+drawWidth/2,center[0]);near(p.mediaRect[1]+drawHeight/2,center[1]);
 near(p.anchors[0].point[0],center[0]-drawWidth/4);near(p.anchors[0].point[1],center[1]);
 const z=p.copyZones[0];near(z.rect[2],drawWidth*.8);near(z.rect[3],drawHeight*.1);
 near(p.subjectBounds[2],drawWidth*.6);near(p.subjectBounds[3],drawHeight*.6);
 eq(z.fullyVisible,z.rect[0]>=box[0]-1e-8&&z.rect[1]>=box[1]-1e-8&&z.rect[0]+z.rect[2]<=box[0]+box[2]+1e-8&&z.rect[1]+z.rect[3]<=box[1]+box[3]+1e-8);
 if(z.fullyVisible)for(const align of ['left','center','right']){
  const label=labelInZone(p,'heading',{width:z.rect[2]/2,height:z.rect[3]/2,align});
  near(label.y+label.height/2,z.rect[1]+z.rect[3]/2);
  near(align==='left'?label.x:align==='right'?label.x+label.width:label.x+label.width/2,align==='left'?z.rect[0]:align==='right'?z.rect[0]+z.rect[2]:z.rect[0]+z.rect[2]/2);
 }else reject(()=>labelInZone(p,'heading',{width:1,height:1}));
}
for(const frame of [4,5,6])eq(placeAnchors(base,{frame,box:[0,0,200,100]}).frame,frame);
for(const frame of [-1,3,7,4.5,NaN,Infinity])reject(()=>placeAnchors(base,{frame,box:[0,0,200,100]}));
for(const box of [[0,0,Number.MIN_VALUE,Number.MIN_VALUE],[1e6,0,1e-20,100],[0,1e6,100,1e-20],[0,0,0,100],[0,0,100,-1],[0,0,Infinity,100]])reject(()=>placeAnchors(base,{frame:4,box}));
for(const mutate of [m=>m.source.scene.file='../scene.blend',m=>m.source.clip.file='https://example.test/clip.mp4',m=>m.checks.frames=2,m=>m.checks.maxCoordinateDrift=1e-6,m=>m.anchors[0].visibility='visible',m=>m.copyZones[0].rect=[.19,.29,.1,.1],m=>m.objects[0].bounds=[.1,.3,.8,.9]]){const m=structuredClone(base);mutate(m);reject(()=>validateAnchorManifest(m));}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cf-independent-anchor-contract-'));
try{
 const original={'scene.blend':'scene','clip.mp4':'clip','receipt.json':'receipt'};for(const [name,bytes] of Object.entries(original))fs.writeFileSync(path.join(tmp,name),bytes);
 eq(verifyAnchorSource(base,tmp),true);
 for(const name of Object.keys(original)){fs.writeFileSync(path.join(tmp,name),'changed');reject(()=>verifyAnchorSource(base,tmp));fs.writeFileSync(path.join(tmp,name),original[name]);}
 const out=path.join(tmp,'occupied.json');fs.writeFileSync(out,'do not replace');
 await assert.rejects(exportAssetAnchors({assetDir:tmp,definition,out}),/exists/);checks++;eq(fs.readFileSync(out,'utf8'),'do not replace');
 fs.writeFileSync(path.join(tmp,'receipt.json'),JSON.stringify({status:'ready-for-review',blender:{bakedMotion:true},outputs:{'scene.blend':{sha256:sha('scene')},'clip.mp4':{sha256:sha('different clip')}},config:{frames:8,width:200,height:100,fps:24}}));
 await assert.rejects(exportAssetAnchors({assetDir:tmp,definition,out:path.join(tmp,'new.json')}),/clip does not match/);checks++;eq(fs.existsSync(path.join(tmp,'new.json')),false);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
const source=new URL('../../../../../engine/lib/asset-anchors.mjs',import.meta.url);const report={checks,passed:checks,sourceSha256:sha(fs.readFileSync(source)),scope:'Independent centered geometry across 32 contain/cover boxes; three label alignments; static frame boundaries; source-byte and path guards; rejection before Blender of an occupied output or changed source; numerical collapse regressions. No real Blender projection, render, browser, visibility or occlusion proof.'};fs.writeFileSync(new URL('contract-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
