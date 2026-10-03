import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {verifyAnchorSource,placeAnchors,labelInZone} from '../../../engine/lib/asset-anchors.mjs';
import {loadStoryboard} from '../../../engine/lib/project.mjs';import {computeTiming} from '../../../engine/lib/timing.mjs';import {createJob} from '../../../fframes/job.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(root,'../../..'),physical=path.resolve(root,'../physical-mechanisms/media');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),hash=f=>sha(fs.readFileSync(f)),read=f=>JSON.parse(fs.readFileSync(f));
const input=read(path.join(root,'inputs.json')),results=[];
const text=(id,value,r,size,extra={})=>({id,type:'text',text:value,x:r.x,y:r.y+size*.9,size,width:r.width,height:r.height,leading:1.1,fill:'ink',font:'text',at:0,enter:'none',...extra});
for(const c of input.cases)for(const preset of ['landscape','vertical']){
 const mediaName=`${c.media}-${preset}`,source=path.join(physical,mediaName),manifestFile=path.join(root,'anchors',mediaName+'.json'),m=read(manifestFile);verifyAnchorSource(m,source);
 const hold=read(path.join(source,'hold.json'));
 if(hold.sourceClipSha256!==m.source.clip.sha256||hash(path.join(source,hold.holdClip))!==hold.holdClipSha256||!hold.holdYuvEndpointsEqual)throw Error('Static hold source binding changed');
 const w=preset==='landscape'?1920:1080,h=preset==='landscape'?1080:1920,placement=placeAnchors(m,{frame:hold.sourceFrame,box:[0,0,w,h],fit:'cover'}),anchor=placement.anchors.find(a=>a.id===c.anchor);
 if(!anchor?.inFrame)throw Error('The selected anchor is cropped');
 const titleSize=w*(preset==='landscape'?.032:.045),labelSize=w*(preset==='landscape'?.028:.040),sourceSize=w*(preset==='landscape'?.028:.032);
 const titleRect=labelInZone(placement,'heading',{width:w*.77,height:placement.copyZones.find(z=>z.id==='heading').rect[3]}),labelRect=labelInZone(placement,'callout',{width:w*.77,height:placement.copyZones.find(z=>z.id==='callout').rect[3]}),sourceRect=labelInZone(placement,'source',{width:w*.77,height:sourceSize*1.15});
 const base=[text('title',c.title,titleRect,titleSize,{font:'display'}),text('source',c.source,sourceRect,sourceSize)];
 const lead=[labelRect.x+labelRect.width*.5,labelRect.y+labelRect.height+8],radius=w*.004;
 const annotation=[text('attached-copy',c.label,labelRect,labelSize,{font:'semibold',at:.25,enter:'fade',dur:.2}),{id:'attached-leader',type:'line',x1:lead[0],y1:lead[1],x2:anchor.point[0],y2:anchor.point[1]-radius,width:w*.0014,stroke:'ink',at:.5,enter:'draw',dur:.6,drawEase:'linear'},
  {id:'attached-anchor',type:'circle',cx:anchor.point[0],cy:anchor.point[1],r:radius,fill:'bg',stroke:'ink',width:w*.0015,at:1.1,enter:'fade',dur:.15}];
 const name=`${c.id}-${preset}`,dir=path.join(root,'specimens',name);fs.mkdirSync(path.join(dir,'media'),{recursive:true});
 for(const file of ['clip.mp4',hold.holdClip]){fs.copyFileSync(path.join(source,file),path.join(dir,'media',file),fs.constants.COPYFILE_FICLONE);if(hash(path.join(source,file))!==hash(path.join(dir,'media',file)))throw Error('Prepared-media copy mismatch');}
 const plate=asset=>({asset,side:'full',treatment:'none',drift:'none',scrim:0,loop:asset==='held'});
 const sb={version:2,title:c.title,format:{preset,fps:30},theme:'research-paper',type:'inter',backdrop:'none',motion:{preset:'gentle',intensity:.3},transition:'cut',sfx:'off',captions:false,music:false,
  assets:[{id:'mechanism',kind:'clip',file:'media/clip.mp4'},{id:'held',kind:'clip',file:`media/${hold.holdClip}`}],
  sources:[{claim:c.source,source:'Original ClearFrame prepared Blender geometry with native editorial labels; this is a qualitative example, not measured evidence.'}],
  beats:[{id:'operation',block:'canvas',duration:8,camera:'none',exit:'none',plate:plate('mechanism'),props:{view:[0,0,w,h],sourceElement:'source',elements:base}},
   {id:'registered-hold',block:'canvas',duration:20,camera:'none',exit:'none',plate:plate('held'),props:{view:[0,0,w,h],sourceElement:'source',elements:[...base,...annotation]}}]};
 fs.writeFileSync(path.join(dir,'storyboard.json'),JSON.stringify(sb,null,2)+'\n');
 const job=createJob(loadStoryboard(dir),computeTiming(dir),{draft:true});if(job.errors.length)throw Error(`${name}: ${job.errors.join('; ')}`);
 results.push({name,recipe:'T03',caseId:c.id,preset,mediaName,sourceAsset:path.relative(repo,source),sourceClipSha256:m.source.clip.sha256,sourceSceneSha256:m.source.scene.sha256,anchorManifestSha256:hash(manifestFile),holdClipSha256:hold.holdClipSha256,heldSourceFrame:hold.sourceFrame,staticFrames:m.frames,anchorId:c.anchor,placement,labelRect,titleRect,sourceRect,leader:{from:lead,to:[anchor.point[0],anchor.point[1]-radius]},radius,storyboardSha256:hash(path.join(dir,'storyboard.json'))});
}
fs.writeFileSync(path.join(root,'audit.json'),JSON.stringify({version:1,inputSha256:hash(path.join(root,'inputs.json')),results},null,2)+'\n');console.log(`Prepared ${results.length} native anchor examples; retained source scenes and clips unchanged.`);
