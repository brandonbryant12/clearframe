import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';
import {validateAnchorDefinition,validateAnchorManifest,placeAnchors,labelInZone,verifyAnchorSource} from '../engine/lib/asset-anchors.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const definition=()=>({version:1,frames:[10,20],subjects:['Subject'],anchors:[{id:'tip',object:'Subject',local:[0,0,0]}],copyZones:[{id:'heading',rect:[.05,.01,.9,.1]}],padding:.02});
const manifest=()=>({version:1,coordinates:'normalized-top-left',width:100,height:50,frames:[10,20],fps:24,projection:'ortho',subjectBounds:[.4,.3,.9,.9],objects:[{name:'Subject',bounds:[.4,.3,.9,.9]}],anchors:[{...definition().anchors[0],point:[.8,.4],depth:10,visibility:'unassessed'}],copyZones:definition().copyZones,padding:.02,checks:{frames:10,evaluatedVerticesPerFrame:8,maxCoordinateDrift:0,tolerance:1e-7,blenderVersion:'fixture'},limits:['Fixture; no visual claim'],source:{scene:{file:'scene.blend',sha256:sha('scene')},clip:{file:'clip.mp4',sha256:sha('clip')},receiptSha256:sha('receipt')},definitionSha256:sha('definition'),exporterSha256:sha('exporter')});
test('held registration rejects moving ranges, geometry overlap and unsupported visibility claims',()=>{
 assert.equal(validateAnchorDefinition(definition()).frames[1],20);assert.equal(validateAnchorManifest(manifest()).coordinates,'normalized-top-left');
 for(const mutate of [m=>m.checks.frames--,m=>m.checks.maxCoordinateDrift=.001,m=>m.anchors[0].visibility='visible',m=>m.copyZones[0].rect=[.5,.5,.2,.2],m=>m.objects[0].bounds=[.3,.3,.9,.9]]){const m=manifest();mutate(m);assert.throws(()=>validateAnchorManifest(m));}
 const d=definition();d.anchors[0].object='Missing';assert.throws(()=>validateAnchorDefinition(d),/subject/);
});
test('contain and cover use exact centered image transforms, and cropped copy zones cannot receive labels',()=>{
 const contained=placeAnchors(manifest(),{frame:19,box:[10,20,200,200],fit:'contain'});assert.deepEqual(contained.mediaRect,[10,70,200,100]);assert.deepEqual(contained.anchors[0].point,[170,110]);assert(contained.anchors[0].inFrame);
 assert.deepEqual(labelInZone(contained,'heading',{width:80,height:8}),{x:70,y:72,width:80,height:8});
 const covered=placeAnchors(manifest(),{frame:10,box:[10,20,200,200],fit:'cover'});assert.deepEqual(covered.mediaRect,[-90,20,400,200]);assert.deepEqual(covered.anchors[0].point,[230,100]);assert.equal(covered.anchors[0].inFrame,false);assert.throws(()=>labelInZone(covered,'heading',{width:80,height:8}),/cropped/);
 assert.throws(()=>placeAnchors(manifest(),{frame:20,box:[0,0,100,50]}),/outside/);for(const box of [[0,0,Number.MIN_VALUE,Number.MIN_VALUE],[1e6,1e6,1e-100,1e-100]])assert.throws(()=>placeAnchors(manifest(),{frame:10,box}),/collapse|representable/);assert.throws(()=>labelInZone(contained,'heading',{width:181,height:8}),/fit/);
});
test('source verification rejects replacement pixels and receipt changes',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cf-anchor-test-'));try{
  fs.writeFileSync(path.join(root,'scene.blend'),'scene');fs.writeFileSync(path.join(root,'clip.mp4'),'clip');fs.writeFileSync(path.join(root,'receipt.json'),'receipt');assert(verifyAnchorSource(manifest(),root));
  fs.writeFileSync(path.join(root,'clip.mp4'),'other');assert.throws(()=>verifyAnchorSource(manifest(),root),/clip changed/);fs.writeFileSync(path.join(root,'clip.mp4'),'clip');fs.writeFileSync(path.join(root,'receipt.json'),'other');assert.throws(()=>verifyAnchorSource(manifest(),root),/receipt changed/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
