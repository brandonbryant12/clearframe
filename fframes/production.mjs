import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CANVASES, FRAME_RATES, THEMES, MOTIONS, TRANSITIONS, BACKDROPS, normalizeProps, palette } from './catalog.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { computeTiming, captionCues, toSRT, toVTT, findWord, assetSrc } from '../engine/lib/timing.mjs';
import { mix, mux } from '../engine/lib/audio.mjs';
import { ffmpeg, writeJSON, readJSON, log } from '../engine/lib/util.mjs';

export const ROOT=path.dirname(fileURLToPath(import.meta.url));
export const REPO=path.dirname(ROOT);
export const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
export const nativeEnv=()=>({...process.env,PATH:[path.join(ROOT,'tools'),path.join(os.homedir(),'.cargo/bin'),process.env.PATH].join(path.delimiter),CARGO_TARGET_DIR:path.join(ROOT,'.cache/metal'),CARGO_BUILD_JOBS:'1',SKIA_NINJA_COMMAND:path.join(ROOT,'tools/ninja-limited'),RAYON_NUM_THREADS:'2',FFRAMES_NUM_THREADS:'2',CMAKE_BUILD_PARALLEL_LEVEL:'2',NUM_JOBS:'2'});
export const binary=()=>path.join(ROOT,'.cache/metal/release/clearframe-native');

export function run(bin,args,{cwd=REPO,env=nativeEnv(),capture=false}={}) {
  return new Promise((resolve,reject)=>{const child=spawn(bin,args,{cwd,env,stdio:capture?['ignore','pipe','pipe']:'inherit'});let output='';if(capture){child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);}const stop=s=>child.kill(s);const interrupt=()=>stop('SIGINT'),terminate=()=>stop('SIGTERM');process.once('SIGINT',interrupt);process.once('SIGTERM',terminate);child.on('error',reject);child.on('close',code=>{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',terminate);code===0?resolve(output):reject(new Error(`${path.basename(bin)} exited ${code}${output?'\n'+output.slice(-6000):''}`));});});
}
const walk=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
export function rendererHash(){const crate=path.join(ROOT,'native');const src=[...walk(path.join(crate,'src')),...(fs.existsSync(path.join(crate,'vendor'))?walk(path.join(crate,'vendor')):[]),path.join(crate,'Cargo.toml'),path.join(crate,'Cargo.lock')].sort();return sha256(Buffer.concat(src.map(f=>Buffer.concat([Buffer.from(path.relative(crate,f)+'\0'),fs.readFileSync(f)]))));}
export async function buildNative({force=false}={}) {
  const crate=path.join(ROOT,'native'),hash=rendererHash();
  const marker=path.join(ROOT,'.cache/native-build.json');
  if(!force&&fs.existsSync(binary())&&readJSON(marker,null)?.hash===hash)return binary();
  const st=fs.statfsSync(ROOT),free=st.bavail*st.bsize/2**30;
  const warm=fs.existsSync(path.join(ROOT,'.cache/metal/release/deps'));
  if(free<(warm?20:30))throw new Error(`Native build needs ${warm?20:30} GiB free; ${free.toFixed(1)} GiB available. Preserve swap headroom.`);
  log.step(`Building FFFrames ${warm?'with the existing dependency cache':'from a cold cache'} (one Cargo job)`);
  await run('cargo',['build','--manifest-path',path.join(crate,'Cargo.toml'),'--release','--locked','--jobs','1',...(process.platform==='darwin'?[]:['--no-default-features'])]);
  writeJSON(marker,{hash,backend:process.platform==='darwin'?'skia-metal':'cpu',revision:readJSON(path.join(ROOT,'upstream.json')).revision});
  return binary();
}

// Seconds each preset's element entrance takes; the renderer's motion.rs uses the same values.
export const ENTRANCE={gentle:.55,snappy:.30,spring:.72};
const EXITS=['auto','none','fade','push','zoom','wipe'];
const HERO_BLOCKS=new Set(['title','statement','endcard','chapter','highlight','quote','callout']);
const NUMERIC=new Set(['stat','kpis','bars','line','waffle','ring','delta','funnel','donut','magnitude']);
// Staged arrays: [prop, default offset after the scene cue, default spacing].
const STAGED={'icon-grid':['items',0,null],flow:['nodes',0,null],kpis:['items',0,.45],steps:['items',0,.45],timeline:['items',0,.45],
  list:['items',0,.45],funnel:['items',0,.45],magnitude:['items',0,.45],checklist:['items',.6,.55],annotate:['pins',.7,.6],highlight:['phrases',.7,.6]};
// Props that are displayed; others (cues, files, enums) are not glyph-checked.
const HIDDEN=new Set(['file','asset','say','land','growSay','drawSay','orientation','sort','mode','align','fit','icon','better']);
const coverage=JSON.parse(fs.readFileSync(new URL('./assets/fonts/coverage.json',import.meta.url),'utf8')).ranges;
/** First character the bundled fonts cannot draw, if any. */
// Whitespace separates words and default-ignorable characters (soft hyphen, joiners,
// variation selectors) are shaped invisibly, so neither can become an empty box.
export function missingGlyph(text){for(const ch of String(text)){const cp=ch.codePointAt(0);if(cp<32||/[\s\p{Default_Ignorable_Code_Point}]/u.test(ch))continue;let lo=0,hi=coverage.length-1,ok=false;while(lo<=hi){const mid=(lo+hi)>>1,[a,b]=coverage[mid];if(cp<a)hi=mid-1;else if(cp>b)lo=mid+1;else{ok=true;break;}}if(!ok)return ch;}return null;}
function glyphCheck(value,where,fail){
  if(typeof value==='string'){const ch=missingGlyph(value);if(ch)fail(`"${ch}" (U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')}) in ${where} is not in the bundled Inter fonts and would render as an empty box. Rephrase or add a font with that script.`);}
  else if(Array.isArray(value))value.forEach((v,i)=>glyphCheck(v,`${where}[${i}]`,fail));
  else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))if(!HIDDEN.has(k))glyphCheck(v,`${where}.${k}`,fail);
}
/** Seconds one staged item takes to reach its final state (mirrors the renderer). */
function itemDuration(block,entrance){
  switch(block){
    case 'checklist':return Math.max(entrance,.4);        // box pop, then the tick draws
    case 'highlight':return .8;                           // marker sweep, capped in scenes.rs
    case 'annotate':return entrance+.05;                  // legend row follows its pin
    case 'kpis':return Math.max(1.3,entrance);            // count-up
    case 'funnel':case 'magnitude':return Math.max(.9,.3+entrance); // growth, then labels
    default:return entrance;
  }
}
/** Scene seconds by which every value, label and staged item is final. The renderer never
 *  starts the exit earlier, and check fails when this falls after the beat's last frame. */
function settleTime(block,props,cue,entrance){
  const items=(list)=>Math.max(cue+entrance,...(list??[]).map(it=>(it.at??cue)+itemDuration(block,entrance)));
  switch(block){
    case 'stat':return cue+Math.max(1.4,.6+entrance);
    case 'ring':return cue+Math.max(1.4,.8+entrance);
    case 'delta':return cue+Math.max(.45+1.3,1+entrance);
    case 'bars':{const grown=cue+(props.data.length-1)*.09+1.1;return props.focus?Math.max(grown,props.focus.at+props.focus.dur):grown;}
    case 'line':return cue+1.6+entrance;               // the final-value tip label enters last
    case 'waffle':{const rows=Math.ceil(props.total/props.cols);return cue+Math.max(.35+(rows+props.cols)*.012+1.3,.7+entrance);}
    case 'donut':return cue+Math.max(1.5,1.1+entrance); // legend rows follow the sweep
    default:{const key=STAGED[block]?.[0];if(key)return items(props[key]);return cue+entrance+(HERO_BLOCKS.has(block)?.3:0);}
  }
}

export function createJob(sb,timing,{draft=false}={}) {
  const errors=[],warnings=[];
  const fail=(s)=>errors.push(s);
  if(!CANVASES.some(([w,h])=>w===timing.width&&h===timing.height))fail('Native canvas must be landscape, vertical, square, portrait, or 640×360.');
  if(!FRAME_RATES.includes(timing.fps))fail(`Native fps must be ${FRAME_RATES.join(', ')}.`);
  const theme=palette(sb.theme??'paper');
  const motion={preset:'gentle',intensity:0.65,...sb.motion};
  if(!MOTIONS.includes(motion.preset)||!Number.isFinite(motion.intensity)||motion.intensity<0||motion.intensity>1)fail('motion requires a known preset and intensity from 0 to 1.');
  const vertical=timing.height>timing.width;
  const captions=sb.captions===true||(sb.captions??'auto')==='auto'&&vertical;
  if(sb.captions!=null&&![true,false,'auto','off'].includes(sb.captions))fail('captions must be true, false, auto or off.');
  const backdrop=sb.backdrop??'none';if(!BACKDROPS.includes(backdrop))fail(`Native backdrop must be ${BACKDROPS.join(', ')}.`);
  const frame=1/timing.fps;
  // Resolve every entrance first: a scene's exit mirrors the next scene's entrance.
  const transitions=timing.beats.map(b=>{let t=sb.beats[b.index].transition??sb.transition??'fade';if(t==='auto')t=b.index&&timing.beats[b.index-1].chapter!==b.chapter?'rise':'fade';return t;});
  const beats=[];
  const cues=captionCues(timing);
  for(const b of timing.beats) {
    try {
      if(b.scene)throw new Error('JavaScript scenes are retired. Port this beat to a native block; no browser fallback runs.');
      const props=normalizeProps(b.block,b.props??{},{vertical});
      const sourceBeat=sb.beats[b.index];
      const beatMotion={...motion,...sourceBeat.motion};
      if(!MOTIONS.includes(beatMotion.preset)||!Number.isFinite(beatMotion.intensity)||beatMotion.intensity<0||beatMotion.intensity>1)throw new Error('Invalid beat motion');
      const cue=(value,fallback=0.35)=>{
        if(value==null)return Math.min(fallback,Math.max(0,b.dur-frame));
        if(typeof value==='number'){if(!Number.isFinite(value)||value<0||value>=b.dur)throw new Error('Cue seconds must lie within the beat');return value;}
        const t=findWord(b.vo?.words??[],String(value));if(t==null)throw new Error(`Spoken cue "${value}" not found`);return Math.max(0,t-b.start);
      };
      const authoredCue=props.land??props.growSay??props.drawSay;
      // Headlines start almost immediately; data scenes leave a beat for the header.
      const at=cue(authoredCue,HERO_BLOCKS.has(b.block)?0.1:0.35);
      if(props.focus&&b.block==='bars')props.focus.at=cue(props.focus.say,at+1.6);
      if(props.focus&&b.block==='annotate')props.focus.at=cue(props.focus.say,at+.4);
      if(STAGED[b.block]){
        // Arrivals fit inside the beat: automatic spacing compresses, authored cues never
        // move, and a cue too late to finish its entrance fails instead of being hidden.
        const [key,offset,nominal]=STAGED[b.block],items=props[key];
        const duration=itemDuration(b.block,ENTRANCE[beatMotion.preset]);
        const lastStart=b.dur-frame-duration;
        if(lastStart<0)throw new Error(`Beat is too short for its ${duration.toFixed(2)}s item entrance; extend the beat.`);
        if(authoredCue!=null&&at>lastStart+1e-7)throw new Error('Scene cue is too late to complete its item entrances; extend the beat or move the cue.');
        const start=Math.min(at+offset,Math.max(at,lastStart));
        const latest=Math.max(authoredCue!=null?at:0,lastStart-Math.min(.3,b.dur*.1)),first=authoredCue!=null?start:Math.min(start,latest);
        const spacing=items.length>1?Math.max(0,Math.min(nominal??props.stagger,(latest-first)/(items.length-1))):0;
        props[key]=items.map((it,i)=>{const time=it.say==null?first+i*spacing:cue(it.say);if(time>lastStart+1e-7)throw new Error(`Item cue is too late to complete its entrance; extend the beat or move the cue.`);const {say,...rest}=it;return {...rest,at:time};});
      }
      const settle=settleTime(b.block,props,at,ENTRANCE[beatMotion.preset]);
      if(NUMERIC.has(b.block)){
        if(!props.source||!sb.sources.length)throw new Error('Numbers need visible props.source and a storyboard.sources entry.');
        if(settle>b.dur-frame+1e-6)(draft?warnings:errors).push(`${b.id}: values finish counting at ${settle.toFixed(2)}s but the beat ends at ${b.dur.toFixed(2)}s, so the final figures would never be shown; extend the beat or cue earlier.`);
      }
      glyphCheck(props,`${b.id}.props`,m=>{throw new Error(m);});
      if(b.vo?.estimated){(draft?warnings:errors).push(`${b.id}: narration is estimated; record/import audio or use --draft.`);}
      if(b.vo&&(b.vo.start<b.start||b.vo.end>b.end+frame))throw new Error('Narration crosses beat bounds; remove the forced duration/negative lead.');
      if(b.block==='kinetic'&&!b.vo?.words?.length)throw new Error('kinetic needs narration and word timestamps.');
      if((b.block==='kinetic'||captions)&&b.vo){
        glyphCheck(b.vo.text,`${b.id}.vo (shown as ${b.block==='kinetic'?'kinetic text':'captions'})`,m=>{throw new Error(m);});
        if(b.vo.wordTiming!=='measured')(draft?warnings:errors).push(`${b.id}: speech-following text requires measured word timestamps; run align or import timed speech.${b.vo.alignmentIssue?' '+b.vo.alignmentIssue:''}`);
      }
      const transition=transitions[b.index];
      if(!TRANSITIONS.includes(transition))throw new Error(`Unsupported native transition ${transition}`);
      const authoredExit=sourceBeat.exit??'auto';
      if(!EXITS.includes(authoredExit))throw new Error(`exit must be ${EXITS.join(', ')}`);
      const next=transitions[b.index+1];
      const exit=authoredExit!=='auto'?authoredExit:next==null?'fade':next==='cut'?'none':next==='rise'?'fade':next;
      const startFrame=Math.round(b.start*timing.fps),frames=Math.round(b.end*timing.fps)-startFrame;
      beats.push({id:b.id,block:b.block,frames,start_frame:startFrame,cue_seconds:at,transition,exit,settle_seconds:Math.max(0,Math.min(settle,frames/timing.fps)),motion:beatMotion,props,
        words:(b.vo?.words??[]).map(w=>({text:w.w,start:Math.max(0,w.t0-startFrame/timing.fps),end:Math.min(w.t1-startFrame/timing.fps,frames/timing.fps)})),
        captions:cues.filter(c=>c.start>=b.start&&c.start<b.end).map(c=>({start:c.start-b.start,end:Math.min(c.end,b.end)-b.start,text:c.text}))});
    }catch(e){fail(`${b.id}: ${e.message}`);}
  }
  if(sb.pacing.outro)fail('Use an endcard beat instead of pacing.outro so every output frame has an authored scene.');
  const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;};
  const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  for(const key of ['ink','muted','accent'])if(contrast(theme[key],theme.bg)<4.5)warnings.push(`Palette ${key} has low text contrast against bg; review small text at delivery size.`);
  if(contrast(theme.accent2,theme.bg)<3)warnings.push('Palette accent2 has low graphic contrast (< 3:1) against bg; second series and chart segments may be hard to see.');
  const generatedSeconds=timing.beats.filter(b=>b.block==='video'&&sb.assets.some(a=>a.id===b.props?.asset&&!a.file)).reduce((n,b)=>n+b.dur,0);
  if(generatedSeconds>timing.duration*(sb.continuity?.maxGeneratedShare??0.2))warnings.push('Generated footage exceeds the configured runtime share (default 20%); use native graphics where they carry the story.');
  if(beats.some(b=>b.frames<1)||beats.reduce((n,b)=>n+b.frames,0)!==timing.frames)fail('Every beat must span at least one frame and cover the complete timeline.');
  const job={version:2,title:timing.title,width:timing.width,height:timing.height,fps:timing.fps,frames:timing.frames,theme,motion,backdrop,chrome:sb.chrome===true,captions,beats};
  return {job,errors,warnings};
}

export async function prepareProject(root,{draft=false}={}) {
  root=fs.realpathSync(root);const sb=loadStoryboard(root),timing=computeTiming(root);
  const result=createJob(sb,timing,{draft});if(result.errors.length)throw new Error(result.errors.join('\n'));
  const dir=path.join(root,'build/native'),media=path.join(dir,'media');fs.mkdirSync(media,{recursive:true});
  const neededMedia=new Set();
  const hashes={};
  const record=file=>{hashes[path.relative(root,file)]=sha256(fs.readFileSync(file));};record(path.join(root,'storyboard.json'));
  for(const b of result.job.beats)if(['image','video','annotate'].includes(b.block)) {
    const prop=b.props,a=prop.asset&&sb.assets.find(a=>a.id===prop.asset);
    if(a&&a.kind!==(b.block==='video'?'clip':'image'))throw new Error(`${b.id}: asset kind does not match the block`);
    const rel=prop.file??(a&&assetSrc(root,a));if(!rel)throw new Error(`${b.id}: asset is missing; import it or run images/clips.`);
    const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))throw new Error(`${b.id}: media must exist inside the project`);
    record(file);const key=`${sha256(fs.readFileSync(file)).slice(0,16)}${path.extname(file).toLowerCase()}`;
    neededMedia.add(key);const out=path.join(media,key);if(!fs.existsSync(out))fs.copyFileSync(file,out);prop.file=key;
    if(b.block==='video') {
      const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',file],{encoding:'utf8'});
      if(probe.status!==0)throw new Error(`Cannot probe clip ${rel}`);
      const duration=Number(JSON.parse(probe.stdout).format?.duration);
      if(!Number.isFinite(duration)||duration-(prop.offset??0)+1/timing.fps<b.frames/timing.fps)throw new Error(`${b.id}: clip is shorter than the authored beat; trim the beat or provide a longer clip.`);
    }
  }
  for(const b of timing.beats)if(b.vo?.src){record(path.join(root,b.vo.src));const m=path.join(root,'assets/vo',`${b.id}.json`);if(fs.existsSync(m))record(m);}
  if(timing.music?.src)record(path.join(root,timing.music.src));
  for(const f of fs.readdirSync(path.join(ROOT,'assets/fonts')).filter(f=>/\.ttf$/i.test(f))){neededMedia.add(f);fs.copyFileSync(path.join(ROOT,'assets/fonts',f),path.join(media,f));}
  for(const f of fs.readdirSync(media))if(!neededMedia.has(f)&&fs.statSync(path.join(media,f)).isFile())fs.unlinkSync(path.join(media,f));
  writeJSON(path.join(dir,'job.json'),result.job);writeJSON(path.join(root,'build/timing.json'),timing);
  fs.writeFileSync(path.join(root,'build/captions.srt'),toSRT(captionCues(timing)));fs.writeFileSync(path.join(root,'build/captions.vtt'),toVTT(captionCues(timing)));
  const fontHashes=Object.fromEntries(fs.readdirSync(path.join(ROOT,'assets/fonts')).filter(f=>/\.ttf$/i.test(f)).map(f=>[f,sha256(fs.readFileSync(path.join(ROOT,'assets/fonts',f)))]));
  const rendererSourceHash=rendererHash();
  const manifest={version:2,renderer:'fframes',rendererSourceHash,fontHashes,revision:readJSON(path.join(ROOT,'upstream.json')).revision,hashes,inputId:sha256(JSON.stringify({job:result.job,hashes,rendererSourceHash,fontHashes})),draft,warnings:result.warnings};writeJSON(path.join(dir,'manifest.json'),manifest);
  return {...result,root,sb,timing,dir,media,manifest};
}
function unchanged(ctx){if(rendererHash()!==ctx.manifest.rendererSourceHash)throw new Error('Renderer source changed during the render; run again.');for(const [file,hash] of Object.entries(ctx.manifest.fontHashes))if(sha256(fs.readFileSync(path.join(ROOT,'assets/fonts',file)))!==hash)throw new Error('Font changed during the render; run again.');for(const [file,hash] of Object.entries(ctx.manifest.hashes))if(sha256(fs.readFileSync(path.join(ctx.root,file)))!==hash)throw new Error(`Input changed during render: ${file}. Run again.`);}
export async function nativeCommand(ctx,command,args=[],capture=false) {
  const bin=await buildNative();return run(bin,['--job',path.join(ctx.dir,'job.json'),'--media',ctx.media,command,...args],{capture,cwd:ctx.dir});
}
export async function checkProject(root,options={}) {
  let ctx;try{ctx=await prepareProject(root,options);}catch(e){return {errors:[e.message],warnings:[],notes:[]};}
  const errors=[],notes=[];try{notes.push(await nativeCommand(ctx,'inspect',['--fail-on','error'],true));}catch(e){errors.push(e.message);}
  return {errors,warnings:ctx.warnings,notes,duration:ctx.timing.duration,inputId:ctx.manifest.inputId};
}
export function validateVideo(file,{width,height,fps,frames}) {
  const r=spawnSync('ffprobe',['-v','error','-threads','2','-count_frames','-show_streams','-of','json',file],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||'ffprobe failed');
  const streams=JSON.parse(r.stdout).streams,v=streams.find(s=>s.codec_type==='video');const [n,d]=(v?.avg_frame_rate??'0/1').split('/').map(Number);
  if(!v||v.width!==width||v.height!==height||Math.abs(n/d-fps)>0.001||Number(v.nb_read_frames)!==frames)throw new Error('Native output dimensions, frame rate or decoded frame count differ from the storyboard.');
  return {video:v,audio:streams.find(s=>s.codec_type==='audio')??null};
}
export async function renderProject(root,{draft=false,out,noAudio=false,force=false}={}) {
  const ctx=await prepareProject(root,{draft});const output=path.resolve(out??path.join(root,'build/video.mp4'));
  if(out&&fs.existsSync(output)&&!force)throw new Error(`Output exists: ${output}; choose a new file or use --force.`);
  const token=crypto.randomUUID(),raw=path.join(ctx.dir,`${token}-raw.mp4`),silent=path.join(ctx.dir,`${token}-video.mp4`),audio=path.join(ctx.dir,`${token}-mix.wav`),finished=path.join(ctx.dir,`${token}-final.mp4`);
  const start=performance.now();
  try {
    // Drafts keep the authored canvas and frame rate but use the fast review encoder.
    await nativeCommand(ctx,'render',[...(draft?['--draft','--scale','1']:[]),'-o',raw]);
    // Upstream segment concatenation can end the MP4 edit list one frame early at some
    // lengths (e.g. 451 frames), so players drop the final frame. Rebuild the timeline
    // from the packets themselves; frames are copied bit-for-bit.
    await ffmpeg(['-y','-ignore_editlist','1','-i',raw,'-map','0:v:0','-c:v','copy','-bsf:v','setts=pts=PTS-STARTPTS:dts=DTS-STARTPTS','-an',silent]);
    validateVideo(silent,ctx.job);
    const soundCues=ctx.sb.sfx?ctx.job.beats.filter(b=>['stat','kpis','bars','steps','timeline','checklist','donut','magnitude','chapter'].includes(b.block)).map(b=>({name:'tick',t:b.start_frame/ctx.job.fps+b.cue_seconds,volume:0.2})):[];
    const track=noAudio?null:await mix(root,ctx.timing,audio,ctx.sb.mix,soundCues);
    await mux(silent,track,finished);const probe=validateVideo(finished,ctx.job);unchanged(ctx);
    fs.mkdirSync(path.dirname(output),{recursive:true});fs.renameSync(finished,output);
    const report={...ctx.manifest,encoder:draft?'draft (x264 veryfast, CRF 23)':'final (x264 medium, CRF 16)',width:ctx.job.width,height:ctx.job.height,fps:ctx.job.fps,frames:ctx.job.frames,seconds:(performance.now()-start)/1000,backend:process.platform==='darwin'?'skia-metal':'cpu',audio:!!probe.audio,colorSpace:probe.video.color_space??null,outputSha256:sha256(fs.readFileSync(output)),voiceProviders:[...new Set(ctx.timing.beats.map(b=>b.vo?.provider).filter(Boolean))]};
    writeJSON(`${output}.json`,report);log.ok(`FFFrames video → ${output}`);return report;
  }finally{for(const f of [raw,silent,audio,finished])fs.rmSync(f,{force:true});}
}
export async function stillProject(root,{draft=false,at,beat,pos=0.6,out}={}) {
  const ctx=await prepareProject(root,{draft}),b=beat&&ctx.timing.beats.find(b=>b.id===beat);if(beat&&!b)throw new Error(`No beat ${beat}`);
  const time=b?b.start+b.dur*pos:Number(at??0);if(!Number.isFinite(time)||time<0||time>=ctx.timing.duration)throw new Error('Still time must lie within the film.');
  const file=path.resolve(out??path.join(root,'build',`still-${time.toFixed(2)}.png`));fs.mkdirSync(path.dirname(file),{recursive:true});
  await singleFrame(ctx,time,file);unchanged(ctx);return file;
}
async function singleFrame(ctx,time,file) {
  // Upstream's frame -o is always a directory, even for a single timestamp.
  const shots=path.join(ctx.dir,`frame-${crypto.randomUUID()}`);fs.mkdirSync(shots);
  try {
    await nativeCommand(ctx,'frame',[`${time}s`,'-o',shots]);
    const pngs=fs.readdirSync(shots).filter(f=>f.endsWith('.png')&&fs.statSync(path.join(shots,f)).isFile());
    if(pngs.length!==1)throw new Error(`Expected one frame PNG; received ${pngs.length}`);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.copyFileSync(path.join(shots,pngs[0]),file);
  }finally{fs.rmSync(shots,{recursive:true,force:true});}
}
export async function sheetProject(root,{draft=false,per=3,columns=per,thumb=400,out}={}) {
  const ctx=await prepareProject(root,{draft});if(!Number.isInteger(columns)||columns<1||columns>8||!Number.isInteger(thumb)||thumb<100||thumb>1920)throw new Error('Invalid sheet columns or thumb size');if(!Number.isInteger(per)||per<1||per>3)throw new Error('sheet --per must be 1–3');
  const times=ctx.timing.beats.flatMap(b=>(per===1?[0.65]:per===2?[0.3,0.85]:[0.15,0.55,0.9]).map(p=>Math.min(b.end-1/ctx.timing.fps,b.start+b.dur*p)));
  const shots=path.join(ctx.dir,`sheet-${crypto.randomUUID()}`);fs.mkdirSync(shots);const file=path.resolve(out??path.join(root,'build/sheet.png'));
  try {
    await nativeCommand(ctx,'frame',[times.map(t=>`${t.toFixed(4)}s`).join(','),'-o',shots]);
    const pngs=fs.readdirSync(shots).filter(f=>f.endsWith('.png')).sort();if(pngs.length!==times.length)throw new Error(`Expected ${times.length} frame PNGs; got ${pngs.length}`);
    // Upstream names contain frame numbers; numeric sort preserves beat order.
    pngs.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));pngs.forEach((f,i)=>fs.copyFileSync(path.join(shots,f),path.join(shots,`tile-${String(i).padStart(4,'0')}.png`)));
    fs.mkdirSync(path.dirname(file),{recursive:true});await ffmpeg(['-y','-framerate','1','-i',path.join(shots,'tile-%04d.png'),'-vf',`scale=${thumb}:-1,tile=${columns}x${Math.ceil(times.length/columns)}:padding=8:margin=8:color=0x161b22`,'-frames:v','1','-threads','1',file]);unchanged(ctx);writeJSON(`${file}.json`,{inputId:ctx.manifest.inputId,times,beats:ctx.job.beats.map(b=>b.id)});return file;
  }finally{fs.rmSync(shots,{recursive:true,force:true});}
}
export async function lookbookProject(root,{draft=false,beat,pos=0.6,out}={}) {
  const ctx=await prepareProject(root,{draft});
  const b=beat?ctx.timing.beats.find(b=>b.id===beat):ctx.timing.beats[0];
  if(!b)throw new Error(`No beat ${beat}`);
  if(!Number.isFinite(pos)||pos<0||pos>=1)throw new Error('Lookbook --pos must be 0–1, excluding 1.');
  const time=Math.min(b.end-1/ctx.job.fps,b.start+b.dur*pos);
  const temp=path.join(ctx.dir,`looks-${crypto.randomUUID()}`);fs.mkdirSync(temp);
  const file=path.resolve(out??path.join(root,'build/looks.png')),themes=Object.keys(THEMES);
  try{
    for(const [i,name] of themes.entries()){
      const dir=path.join(temp,name);fs.mkdirSync(dir);
      writeJSON(path.join(dir,'job.json'),{...ctx.job,theme:palette(name)});
      await singleFrame({...ctx,dir},time,path.join(temp,`tile-${String(i).padStart(4,'0')}.png`));
    }
    fs.mkdirSync(path.dirname(file),{recursive:true});
    const columns=Math.min(4,themes.length),rows=Math.ceil(themes.length/columns);
    await ffmpeg(['-y','-framerate','1','-i',path.join(temp,'tile-%04d.png'),'-vf',`scale=480:-2,tile=${columns}x${rows}:padding=12:margin=12:color=0x161b22`,'-frames:v','1','-threads','1',file]);
    unchanged(ctx);writeJSON(`${file}.json`,{inputId:ctx.manifest.inputId,beat:b.id,time,themes,order:'left to right, top to bottom',note:'Same scene and media; only the native palette changes. Generated footage is not recolored.'});return file;
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
export function doctor() {
  const env=nativeEnv(),rows=[];for(const [name,bin,args] of [['Rust','rustc',['--version']],['Cargo','cargo',['--version']],['FFmpeg','ffmpeg',['-version']],['ffprobe','ffprobe',['-version']],['NASM','nasm',['-v']],['Ninja','ninja',['--version']],['Codecs','pkg-config',['--modversion','x264','x265','opus']]]){const r=spawnSync(bin,args,{encoding:'utf8',env});rows.push({name,ok:r.status===0,detail:(r.stdout||r.stderr||r.error?.message||'').trim().split('\n')[0]});}
  const s=fs.statfsSync(ROOT),free=s.bavail*s.bsize/2**30,warm=fs.existsSync(path.join(ROOT,'.cache/metal/release/deps'));rows.push({name:'Disk headroom',ok:free>=(warm?20:30),detail:`${free.toFixed(1)} GiB free (${warm?'warm cache':'cold build'})`});return rows;
}
