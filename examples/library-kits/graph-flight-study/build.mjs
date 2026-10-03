// Editable native labels register to the retained scene's projected ending.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadStoryboard} from '../../../engine/lib/project.mjs';
import {computeTiming} from '../../../engine/lib/timing.mjs';
import {createJob} from '../../../fframes/job.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const read=file=>JSON.parse(fs.readFileSync(file));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const inputs=read(path.join(root,'inputs.json'));
const candidates=inputs.cases.flatMap(item=>['landscape','vertical'].map(format=>({item,format,name:`${item.id}-${format}`})));
const requested=process.argv.slice(2);
const flag=requested.indexOf('--revision');
const revision=flag<0?'':requested.splice(flag,2)[1];
if(revision&&!/^[a-z0-9][a-z0-9-]{0,40}$/.test(revision))throw Error('Invalid revision name');
if(flag>=0&&!revision)throw Error('Revision requires a name');
if(!requested.length||requested.some(name=>!candidates.some(c=>c.name===name)))throw Error('Name the rendered variants to compile.');
for(const {item,format,name} of candidates.filter(c=>requested.includes(c.name))){
  const media=path.join(root,'media',revision,name), receipt=read(path.join(media,'receipt.json'));
  const anchors=read(path.join(media,'ending-anchors.json'));
  if(receipt.status!=='ready-for-review'||anchors.status!=='pass'||receipt.config.loop)throw Error('Source evidence is not ready: '+name);
  for(const [file,key] of [['clip.mp4','sourceClipSha256'],['scene.blend','sceneSha256'],['receipt.json','receiptSha256']]){
    if(sha(path.join(media,file))!==anchors[key])throw Error('Stale anchor binding: '+file);
    if(file!=='receipt.json'&&receipt.outputs[file].sha256!==anchors[key])throw Error('Stale source receipt: '+file);
  }
  if(sha(path.join(root,'export-anchors.py'))!==anchors.exporterSha256)throw Error('Anchor exporter changed; rerun it.');
  if(JSON.stringify(anchors.observations.map(a=>a.value))!==JSON.stringify(item.values)||
      JSON.stringify(anchors.ticks.map(a=>a.value))!==JSON.stringify(item.ticks)||item.periods.length!==item.values.length)throw Error('Labels differ from rendered data.');
  const vertical=format==='vertical', width=vertical?1080:1920,height=vertical?1920:1080;
  if(anchors.width/anchors.height!==width/height||anchors.width!==receipt.config.width||anchors.height!==receipt.config.height)throw Error('Source and native aspect differ.');
  const reading=receipt.config.motion.phases.find(p=>p.id==='reading');
  if(anchors.visibleFromSeconds!==reading.startSeconds||anchors.holdFramesChecked!==reading.endFrame-reading.startFrame)throw Error('Unverified ending interval.');
  const margin=vertical?70:140;
  const text=(id,copy,x,y,size,extra={})=>({id,type:'text',text:copy,x,y,size,font:'text',fill:'ink',at:0,enter:'none',...extra});
  const value=v=>item.valuePrefix+(v*item.valueMultiplier).toLocaleString('en-US',{maximumFractionDigits:2})+item.valueSuffix;
  const tickValue=v=>{ const amount=v*item.valueMultiplier; return amount>=1000&&amount%1000===0 ? item.valuePrefix+(amount/1000)+'k'+item.valueSuffix : value(v); };
  const axisTick=v=>item.valueSuffix ? String(v*item.valueMultiplier) : tickValue(v);
  const ending={at:reading.startSeconds,enter:'fade',dur:.25};
  const elements=[
    {id:'header-band',type:'rect',x:0,y:0,w:width,h:vertical?290:220,fill:'#f3f2ef',at:0,enter:'none'},
    {id:'footer-band',type:'rect',x:0,y:height-(vertical?220:185),w:width,h:vertical?220:185,fill:'#f3f2ef',at:0,enter:'none'},
    text('title',item.title,margin,vertical?130:125,vertical?64:60,{font:'display',width:width-2*margin}),
    text('context',`${item.periods[0]}–${item.periods.at(-1)} ${item.periodYear} · Fictional monthly observations`,margin,vertical?208:190,vertical?34:36,{width:width-2*margin}),
    text('source',`Original fictional data · ClearFrame · ${inputs.asOf}`,margin,height-(vertical?130:80),vertical?30:42,{width:width-2*margin}),
    text('axis-unit',item.axis,vertical?margin:192,vertical?270:250,vertical?32:36,ending),
    ...anchors.ticks.map((a,i)=>text(`tick-${i}`,axisTick(a.value),a.point[0]*width-(vertical?6:22),a.point[1]*height+12,vertical?24:40,{anchor:'end',...ending})),
    ...anchors.observations.flatMap((a,i)=>[
      text(`month-${i}`,item.periods[i],a.base[0]*width,a.base[1]*height+(vertical?55:58),vertical?32:52,{anchor:'middle',...ending}),
      text(`value-${i}`,value(a.value),a.top[0]*width,a.top[1]*height-(vertical&&i===0&&item.valuePrefix?52:18),vertical?32:48,{anchor:'middle',font:'figures',...ending})])
  ];
  const storyboard={version:2,title:item.title,format:{preset:format,fps:receipt.config.fps},theme:'research-paper',type:'inter',backdrop:'none',
    motion:{preset:'gentle',intensity:.3},transition:'cut',sfx:'off',captions:false,music:false,
    assets:[{id:'chart',kind:'clip',file:'media/clip.mp4'}],
    sources:[{claim:`${item.title}: ${item.periods.map((p,i)=>`${p} ${item.periodYear}: ${value(item.values[i])}`).join('; ')}.`,source:inputs.source}],
    beats:[{id:'chart-flight',block:'canvas',duration:receipt.config.frames/receipt.config.fps,camera:'none',exit:'none',
      plate:{asset:'chart',side:'full',treatment:'none',drift:'none',scrim:0,loop:false},
      props:{sourceElement:'source',elements}}]};
  const dir=path.join(root,'specimens',revision,name);
  fs.mkdirSync(path.join(dir,'media'),{recursive:true});
  fs.copyFileSync(path.join(media,'clip.mp4'),path.join(dir,'media/clip.mp4'));
  fs.writeFileSync(path.join(dir,'storyboard.json'),JSON.stringify(storyboard,null,2)+'\n');
  const job=createJob(loadStoryboard(dir),computeTiming(dir),{draft:true});
  if(job.errors.length)throw Error(`${name}: ${job.errors.join('\n')}`);
  fs.writeFileSync(path.join(dir,'bindings.json'),JSON.stringify({version:1,status:'compiled-unreviewed',
    inputSha256:sha(path.join(root,'inputs.json')),anchorSha256:sha(path.join(media,'ending-anchors.json')),
    builderSha256:sha(fileURLToPath(import.meta.url)),sourceClipSha256:anchors.sourceClipSha256,
    storyboardSha256:sha(path.join(dir,'storyboard.json')),fps:receipt.config.fps,frames:receipt.config.frames,
    labelsVisibleFromSeconds:reading.startSeconds,labelsFullyVisibleSeconds:reading.startSeconds+.25},null,2)+'\n');
  console.log(`Compiled ${name}; source motion unchanged, native labels await visual review.`);
}
