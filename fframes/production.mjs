import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CANVASES, FRAME_RATES, THEMES, MOTIONS, TRANSITIONS, BACKDROPS, normalizeProps, palette } from './catalog.mjs';
import { normalizeElements, scheduleElements, eachElement, hasCount, hasDigits, usesLevels, roughSpec, applyRough, TREATMENTS } from './canvas.mjs';
import { voiceLevels } from '../engine/lib/levels.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { computeTiming, captionCues, toSRT, toVTT, findWord, assetSrc } from '../engine/lib/timing.mjs';
import { mix, mux } from '../engine/lib/audio.mjs';
import { ffmpeg, writeJSON, readJSON, log } from '../engine/lib/util.mjs';

export const ROOT=path.dirname(fileURLToPath(import.meta.url));
export const REPO=path.dirname(ROOT);
export const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
// Incremental release builds apply only to local crates (Cargo never rebuilds registry/git
// dependencies for it), so edits to the renderer recompile only what changed.
export const nativeEnv=()=>({...process.env,PATH:[path.join(ROOT,'tools'),path.join(os.homedir(),'.cargo/bin'),process.env.PATH].join(path.delimiter),CARGO_TARGET_DIR:path.join(ROOT,'.cache/metal'),CARGO_BUILD_JOBS:'1',CARGO_PROFILE_RELEASE_INCREMENTAL:'true',SKIA_NINJA_COMMAND:path.join(ROOT,'tools/ninja-limited'),RAYON_NUM_THREADS:'2',FFRAMES_NUM_THREADS:'2',CMAKE_BUILD_PARALLEL_LEVEL:'2',NUM_JOBS:'2'});
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
  if(free<(warm?10:25))throw new Error(`Native build needs ${warm?10:25} GiB free; ${free.toFixed(1)} GiB available.`);
  log.step(`Building FFFrames ${warm?'with the existing dependency cache':'from a cold cache'} (one Cargo job)`);
  // Only compilation takes the machine-wide heavy-job lock; renders and checks run freely.
  const gate=path.join(os.homedir(),'.local/bin/codex-heavy'),cargo=['build','--manifest-path',path.join(crate,'Cargo.toml'),'--release','--locked','--jobs','1',...(process.platform==='darwin'?[]:['--no-default-features'])];
  if(fs.existsSync(gate)&&process.env.CLEARFRAME_HEAVY_HELD!=='1')await run(gate,['--','cargo',...cargo]);else await run('cargo',cargo);
  writeJSON(marker,{hash,backend:process.platform==='darwin'?'skia-metal':'cpu',revision:readJSON(path.join(ROOT,'upstream.json')).revision});
  return binary();
}

// Seconds each preset's element entrance takes; the renderer's motion.rs uses the same values.
export const ENTRANCE={gentle:.55,snappy:.30,spring:.72};
const EXITS=['auto','none','fade','push','zoom','wipe','panel','iris','whip'];
// Graphic transitions split one movement across the cut: [outgoing cover, incoming reveal]
// seconds, mirrored from motion.rs. The outgoing scene needs room to finish its cover.
export const COVER={panel:[.42,.5],iris:[.5,.55],whip:[.24,.3]};
const TONES=['none','accent','accent2','invert','surface'];
const PLATE_SIDES=['full','left','right','top','bottom'],DRIFTS=['none','in','out','left','right','up','down'],CAMERA_MOVES=['auto','none','in','out','left','right','up','down'];
const HERO_BLOCKS=new Set(['title','statement','endcard','chapter','highlight','quote','callout']);
const NUMERIC=new Set(['stat','kpis','bars','line','waffle','ring','delta','funnel','donut','magnitude']);
// Staged arrays: [prop, default offset after the scene cue, default spacing].
const STAGED={'icon-grid':['items',0,null],flow:['nodes',0,null],kpis:['items',0,.45],steps:['items',0,.45],timeline:['items',0,.45],
  list:['items',0,.45],funnel:['items',0,.45],magnitude:['items',0,.45],checklist:['items',.6,.55],annotate:['pins',.7,.6],highlight:['phrases',.7,.6]};
// Props that are displayed; others (cues, files, enums) are not glyph-checked.
const HIDDEN=new Set(['file','asset','say','land','growSay','drawSay','orientation','sort','mode','align','fit','icon','better','type','d','fill','stroke','enter','exit','exitSay','ease','anchor','font','blend','cap','join','arrow','treatment','name','emphasisStyle','to']);
const coverage=JSON.parse(fs.readFileSync(new URL('./assets/fonts/coverage.json',import.meta.url),'utf8')).ranges;
// Accent faces (Instrument Serif, IBM Plex Mono) cover fewer scripts than Inter; text set in them is checked against its own face.
const familyCoverage=JSON.parse(fs.readFileSync(new URL('./assets/fonts/coverage-families.json',import.meta.url),'utf8')).ranges;
const FACE={serif:'InstrumentSerif-Regular.ttf','serif-italic':'InstrumentSerif-Italic.ttf',italic:'InstrumentSerif-Italic.ttf',mono:'IBMPlexMono-Medium.ttf',hand:'ArchitectsDaughter-Regular.ttf'};
/** First character the bundled fonts cannot draw, if any. */
// Whitespace separates words and default-ignorable characters (soft hyphen, joiners,
// variation selectors) are shaped invisibly, so neither can become an empty box.
export function missingGlyph(text,face){const ranges=face?familyCoverage[FACE[face]]:coverage;for(const ch of String(text)){const cp=ch.codePointAt(0);if(cp<32||/[\s\p{Default_Ignorable_Code_Point}]/u.test(ch))continue;let lo=0,hi=ranges.length-1,ok=false;while(lo<=hi){const mid=(lo+hi)>>1,[a,b]=ranges[mid];if(cp<a)hi=mid-1;else if(cp>b)lo=mid+1;else{ok=true;break;}}if(!ok)return ch;}return null;}
function glyphCheck(value,where,fail,face=null){
  if(typeof value==='string'){const ch=missingGlyph(value,face);if(ch)fail(`"${ch}" (U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')}) in ${where} is not in the bundled ${face?FACE[face].replace(/-.*$/,''):'Inter'} font and would render as an empty box. Rephrase or add a font with that script.`);}
  else if(Array.isArray(value))value.forEach((v,i)=>glyphCheck(v,`${where}[${i}]`,fail,face));
  else if(value&&typeof value==='object'){
    // Text set in an accent face (canvas `font`, serif emphasis) must exist in that face.
    const own=FACE[value.font]?value.font:face;
    for(const [k,v] of Object.entries(value))if(!HIDDEN.has(k))glyphCheck(v,`${where}.${k}`,fail,k==='emphasis'&&value.emphasisStyle==='serif'?'serif-italic':own);
  }
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
    case 'canvas':return cue+entrance; // elements are scheduled separately (scheduleElements)
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
  const texture=sb.texture??null;
  if(texture!=null&&!(['grain','vignette','film','none'].includes(texture)||(typeof texture==='object'&&!Array.isArray(texture)&&Object.entries(texture).every(([k,v])=>k==='animate'?typeof v==='boolean':['grain','vignette'].includes(k)&&Number.isFinite(v)&&v>=0&&v<=1))))fail('texture must be grain, vignette, film, none or {grain: 0–1, vignette: 0–1, animate}.');
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
      const entrance=ENTRANCE[beatMotion.preset];
      let settle=settleTime(b.block,props,at,entrance);
      // Author-drawn elements: resolve spoken cues and write exact times for the renderer.
      const scheduleArt=(list,start,stagger=0)=>{
        const end=scheduleElements(list,{start,stagger,entrance,resolve:v=>cue(v)});
        eachElement(list,el=>{if(el.at>b.dur-frame+1e-7)throw new Error(`a canvas element is cued at ${el.at.toFixed(2)}s, after the beat ends; extend the beat or move the cue.`);});
        return end;
      };
      if(b.block==='canvas'){
        settle=Math.max(settle,scheduleArt(props.elements,at,props.stagger??0));
        if(hasCount(props.elements)&&(!props.source||!sb.sources.length))throw new Error('Counted numbers need visible props.source and a storyboard.sources entry.');
        if(hasDigits(props.elements)&&!props.source)warnings.push(`${b.id}: canvas text contains digits; if they are figures, add a visible source.`);
      }
      let art=null;
      if(sourceBeat.art!=null){
        const a=sourceBeat.art;if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['under','over','rough'].includes(k)))throw new Error('art must be {under: [...], over: [...], rough}');
        const state={count:0},artFail=m=>{throw new Error(`art: ${m}`);};
        art={under:normalizeElements(a.under??[],'art.under',artFail,state),over:normalizeElements(a.over??[],'art.over',artFail,state)};
        if(a.rough!=null&&a.rough!==false){const r=roughSpec(a.rough,'art.rough',artFail);applyRough(art.under,r);applyRough(art.over,r);}
        settle=Math.max(settle,scheduleArt(art.under,at),scheduleArt(art.over,at));
        glyphCheck(art,`${b.id}.art`,m=>{throw new Error(m);});
      }
      const tone=sourceBeat.tone??null;
      // Graphic-transition styling; the outgoing scene's exit copies it below.
      let enterStyle=null;
      if(sourceBeat.transitionColor!=null||sourceBeat.transitionOrigin!=null){
        if(sourceBeat.transitionColor!=null&&!['accent','accent2','ink','bg','surface'].includes(sourceBeat.transitionColor))throw new Error('transitionColor must be accent, accent2, ink, bg or surface');
        const o=sourceBeat.transitionOrigin;if(o!=null&&!(Array.isArray(o)&&o.length===2&&o.every(v=>Number.isFinite(v)&&v>=0&&v<=1)))throw new Error('transitionOrigin must be [x, y] from 0 to 1');
        enterStyle={...(sourceBeat.transitionColor?{color:sourceBeat.transitionColor}:{}),...(o?{origin:o}:{})};
      }
      if(sourceBeat.label!=null&&(typeof sourceBeat.label!=='string'||sourceBeat.label.length>40))throw new Error('label must be text up to 40 characters');
      const label=sourceBeat.label??(sb.frame&&typeof b.chapter==='string'?b.chapter.slice(0,40):'');
      if(tone!=null&&!TONES.includes(tone))throw new Error(`tone must be ${TONES.join(', ')}`);
      let camera=null;
      if(sourceBeat.camera!=null){
        camera=typeof sourceBeat.camera==='string'?{move:sourceBeat.camera}:structuredClone(sourceBeat.camera);
        if(!camera||typeof camera!=='object'||Object.keys(camera).some(k=>!['move','amount'].includes(k))||!CAMERA_MOVES.includes(camera.move??'auto')||(camera.amount!=null&&!(Number.isFinite(camera.amount)&&camera.amount>=0&&camera.amount<=1)))throw new Error(`camera must be ${CAMERA_MOVES.join('|')} or {move, amount: 0–1}`);
      }
      let plate=null;
      if(sourceBeat.plate!=null){
        plate=structuredClone(sourceBeat.plate);
        if(!plate||typeof plate!=='object'||Array.isArray(plate))throw new Error('plate must be an object');
        for(const k of Object.keys(plate))if(!['asset','file','side','treatment','drift','scrim','focus','offset','loop'].includes(k))throw new Error(`plate: unsupported field ${k}`);
        if(!plate.asset&&!plate.file)throw new Error('plate needs asset or file');
        if(plate.side!=null&&!PLATE_SIDES.includes(plate.side))throw new Error(`plate.side must be ${PLATE_SIDES.join(', ')}`);
        if(plate.treatment!=null&&!TREATMENTS.includes(plate.treatment))throw new Error(`plate.treatment must be ${TREATMENTS.join(', ')}`);
        if(plate.drift!=null&&!DRIFTS.includes(plate.drift))throw new Error(`plate.drift must be ${DRIFTS.join(', ')}`);
        if(plate.scrim!=null&&!(Number.isFinite(plate.scrim)&&plate.scrim>=0&&plate.scrim<=1))throw new Error('plate.scrim must be 0–1');
        if(plate.focus!=null&&!(Array.isArray(plate.focus)&&plate.focus.length===2&&plate.focus.every(v=>Number.isFinite(v)&&v>=0&&v<=1)))throw new Error('plate.focus must be [x, y] from 0 to 1');
        if(plate.offset!=null&&!(Number.isFinite(plate.offset)&&plate.offset>=0))throw new Error('plate.offset must be nonnegative');
        if(['image','video','annotate'].includes(b.block)&&(plate.side??'full')!=='full')throw new Error('media blocks already show media; use a full plate or a canvas');
      }
      if(NUMERIC.has(b.block)){
        if(!props.source||!sb.sources.length)throw new Error('Numbers need visible props.source and a storyboard.sources entry.');
        if(settle>b.dur-frame+1e-6)(draft?warnings:errors).push(`${b.id}: values finish counting at ${settle.toFixed(2)}s but the beat ends at ${b.dur.toFixed(2)}s, so the final figures would never be shown; extend the beat or cue earlier.`);
      }
      glyphCheck(props,`${b.id}.props`,m=>{throw new Error(m);});
      if(b.vo?.estimated){(draft?warnings:errors).push(`${b.id}: narration is estimated; record/import audio or use --draft.`);}
      if(b.vo&&(b.vo.start<b.start-1e-3||b.vo.end>b.end+frame))throw new Error('Narration crosses beat bounds; remove the forced duration/negative lead.');
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
        ...(art?{art}:{}),...(camera?{camera}:{}),...(plate?{plate}:{}),...(tone?{tone}:{}),...(enterStyle?{enter_style:enterStyle}:{}),...(label?{label}:{}),
        ...(sourceBeat.speaker&&sb.speakers?.[sourceBeat.speaker]?{speaker:{...sb.speakers[sourceBeat.speaker],id:sourceBeat.speaker,continues:b.index>0&&sb.beats[b.index-1].speaker===sourceBeat.speaker}}:{}),
        words:(b.vo?.words??[]).map(w=>({text:w.w,start:Math.max(0,w.t0-startFrame/timing.fps),end:Math.min(w.t1-startFrame/timing.fps,frames/timing.fps)})),
        captions:cues.filter(c=>c.start>=b.start&&c.start<b.end).map(c=>({start:c.start-b.start,end:Math.min(c.end,b.end)-b.start,text:c.text}))});
    }catch(e){fail(`${b.id}: ${e.message}`);}
  }
  for(let i=0;i+1<beats.length;i++)if(beats[i+1].enter_style&&beats[i].exit===beats[i+1].transition)beats[i].exit_style=beats[i+1].enter_style;
  // Morph by id: an element whose id also appears in the previous beat animates from that
  // element's geometry and colour across the cut, like Magic Move.
  const layers=b=>[...(b.block==='canvas'?b.props.elements:[]),...(b.art?.under??[]),...(b.art?.over??[])];
  for(let i=1;i<beats.length;i++){
    const prev=new Map(layers(beats[i-1]).filter(el=>el.id).map(el=>[el.id,el]));let linked=false;
    for(const el of layers(beats[i])){
      const from=el.id&&prev.get(el.id);if(!from)continue;
      const {morph,echo,keys,loop,along,exitAt,exitDur,exit,...state}=from;
      if(keys?.length)warnings.push(`${beats[i].id}: morph source "${el.id}" has keys; the morph starts from its unkeyed geometry.`);
      el.morph={from:{...state,at:0,dur:0,enter:'none'},dur:el.morphDur??0.8};el.enter='none';el.at=0;el.dur=0;delete el.morphDur;
      delete from.exit;delete from.exitAt;delete from.exitDur;linked=true;
    }
    if(!linked)continue;
    const a=beats[i-1],b=beats[i],src=sb.beats[timing.beats[i].index];
    if(src.transition&&src.transition!=='cut')warnings.push(`${b.id}: elements morph from ${a.id}; a ${src.transition} transition hides the morph, use cut.`);
    else{b.transition='cut';a.exit='none';}
    // A camera move would shift one side of the cut; morphing pairs hold still unless authored.
    for(const [beat,s] of [[a,sb.beats[timing.beats[i-1].index]],[b,src]])if(!s.camera)beat.camera={move:'none'};
    if(a.block==='canvas'&&b.block==='canvas'&&JSON.stringify(a.props.view??null)!==JSON.stringify(b.props.view??null))warnings.push(`${b.id}: morphing canvases use different views; positions will jump.`);
  }
  let frameChrome=null;
  if(sb.frame!=null&&sb.frame!==false){
    const f=sb.frame===true?{}:sb.frame;
    if(!f||typeof f!=='object'||Array.isArray(f)||Object.keys(f).some(k=>!['brand','left','right','label','progress'].includes(k)))fail('frame must be true or {brand, left, right, label, progress}.');
    else{for(const k of ['brand','left','right'])if(f[k]!=null&&(typeof f[k]!=='string'||f[k].length>40))fail(`frame.${k} must be text up to 40 characters.`);
      for(const k of ['label','progress'])if(f[k]!=null&&typeof f[k]!=='boolean')fail(`frame.${k} must be true or false.`);
      frameChrome={...f};if(f.brand)glyphCheck(f.brand,'frame.brand',fail,'serif-italic');for(const k of ['left','right'])if(f[k])glyphCheck(f[k].toUpperCase(),`frame.${k}`,fail,'mono');
      for(const b of beats)if(b.label)glyphCheck(b.label.toUpperCase(),`${b.id}.label`,fail,'mono');}
  }
  // A graphic transition covers the cut, so the outgoing scene must have room to finish
  // its cover after its last word and settled values; otherwise fall back to a fade.
  for(let i=0;i+1<beats.length;i++){
    const next=beats[i+1],cover=COVER[next.transition];if(!cover||!cover.length)continue;
    const a=beats[i],seconds=a.frames/timing.fps,lastWord=a.words.at(-1)?.end??0;
    const earliest=Math.max(lastWord,ENTRANCE[a.motion.preset]+.25,a.settle_seconds,COVER[a.transition]?.[1]??0);
    if(seconds-earliest<cover[0]-1e-6&&a.exit===next.transition){
      warnings.push(`${a.id} → ${next.id}: no room for the ${next.transition} transition (${(seconds-earliest).toFixed(2)}s after the last word, needs ${cover[0]}s); using a fade. Add tail or shorten the line.`);
      next.transition='fade';a.exit='fade';
    }
  }
  if(sb.pacing.outro)fail('Use an endcard beat instead of pacing.outro so every output frame has an authored scene.');
  const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;};
  const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  for(const key of ['ink','muted','accent'])if(contrast(theme[key],theme.bg)<4.5)warnings.push(`Palette ${key} has low text contrast against bg; review small text at delivery size.`);
  if(contrast(theme.accent2,theme.bg)<3)warnings.push('Palette accent2 has low graphic contrast (< 3:1) against bg; second series and chart segments may be hard to see.');
  const generatedSeconds=timing.beats.filter(b=>b.block==='video'&&sb.assets.some(a=>a.id===b.props?.asset&&!a.file)).reduce((n,b)=>n+b.dur,0);
  if(generatedSeconds>timing.duration*(sb.continuity?.maxGeneratedShare??0.2))warnings.push('Generated footage exceeds the configured runtime share (default 20%); use native graphics where they carry the story.');
  if(beats.some(b=>b.frames<1)||beats.reduce((n,b)=>n+b.frames,0)!==timing.frames)fail('Every beat must span at least one frame and cover the complete timeline.');
  const job={version:2,title:timing.title,width:timing.width,height:timing.height,fps:timing.fps,frames:timing.frames,theme,motion,backdrop,chrome:sb.chrome===true,captions,...(texture&&texture!=='none'?{texture}:{}),...(frameChrome?{frame:frameChrome}:{}),beats};
  return {job,errors,warnings};
}

export async function prepareProject(root,{draft=false}={}) {
  root=fs.realpathSync(root);const sb=loadStoryboard(root),timing=computeTiming(root);
  const result=createJob(sb,timing,{draft});if(result.errors.length)throw new Error(result.errors.join('\n'));
  const timingBeat=i=>timing.beats[i];
  const dir=path.join(root,'build/native'),media=path.join(dir,'media');fs.mkdirSync(media,{recursive:true});
  const neededMedia=new Set();
  const hashes={};
  const record=file=>{hashes[path.relative(root,file)]=sha256(fs.readFileSync(file));};record(path.join(root,'storyboard.json'));
  const stage=(rel,where)=>{const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))throw new Error(`${where}: media must exist inside the project`);record(file);const key=`${sha256(fs.readFileSync(file)).slice(0,16)}${path.extname(file).toLowerCase()}`;neededMedia.add(key);const out=path.join(media,key);if(!fs.existsSync(out))fs.copyFileSync(file,out);return {file,key};};
  const assetFile=(ref,kind,where)=>{if(ref.file)return ref.file;const a=sb.assets.find(a=>a.id===ref.asset);if(!a)throw new Error(`${where}: unknown asset ${ref.asset}`);if(kind&&a.kind!==kind)throw new Error(`${where}: asset ${a.id} is a ${a.kind}, not ${kind==='clip'?'footage':'an image'}`);const rel=assetSrc(root,a);if(!rel)throw new Error(`${where}: asset ${a.id} is missing; import it or run images/clips.`);return rel;};
  for(const b of result.job.beats){
    const images=[];eachElement(b.props.elements,el=>{if(el.type==='image')images.push(el);});if(b.art)for(const l of ['under','over'])eachElement(b.art[l],el=>{if(el.type==='image')images.push(el);});
    for(const el of images){const {key}=stage(assetFile(el,'image',`${b.id} canvas image`),b.id);el.file=key;delete el.asset;}
    const morphs=[];eachElement(b.props.elements,el=>{if(el.morph?.from?.type==='image')morphs.push(el.morph.from);});if(b.art)for(const l of ['under','over'])eachElement(b.art[l],el=>{if(el.morph?.from?.type==='image')morphs.push(el.morph.from);});
    for(const from of morphs){const {key}=stage(assetFile(from,'image',`${b.id} morph image`),b.id);from.file=key;delete from.asset;}
    if(b.plate){
      const rel=assetFile(b.plate,null,`${b.id} plate`),video=/\.(mp4|mov|webm|m4v)$/i.test(rel);const {file,key}=stage(rel,`${b.id} plate`);b.plate.file=key;b.plate.video=video;delete b.plate.asset;
      if(video){const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',file],{encoding:'utf8'});const duration=Number(JSON.parse(probe.stdout||'{}').format?.duration);if(!b.plate.loop&&!(duration-(b.plate.offset??0)+1/result.job.fps>=b.frames/result.job.fps))throw new Error(`${b.id}: plate footage is shorter than the beat; set loop, trim the beat or use a longer clip.`);}
    }
  }
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
  // Voice levels for speaker tags, meters and level loops, from the exact recordings the mix uses.
  for(const [i,jb] of result.job.beats.entries()){
    const tb=timingBeat(i);if(!tb?.vo?.src)continue;
    if(!(jb.speaker||usesLevels(jb.props.elements)||usesLevels(jb.art?.under)||usesLevels(jb.art?.over)))continue;
    jb.levels=voiceLevels(path.join(root,tb.vo.src),{fps:result.job.fps,frames:jb.frames,offset:tb.vo.start-jb.start_frame/result.job.fps});
  }
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
/**
 * Sound that follows the picture: cues placed on the job's own visual events, so hits land
 * on the frame they belong to. `sfx`: true/'normal', 'subtle', 'punchy', or false/'off'.
 */
export function soundDesign(job,sfx){
  const level=sfx===true?'normal':sfx;if(!['subtle','normal','punchy'].includes(level))return [];
  const gain={subtle:0.6,normal:1,punchy:1.35}[level],cues=[];
  const add=(name,t,volume,weight=1)=>{if(t>=0&&t<job.frames/job.fps)cues.push({name,t,volume:volume*gain,weight});};
  for(const b of job.beats){
    const start=b.start_frame/job.fps,cue=start+b.cue_seconds;
    if(['panel','iris','whip'].includes(b.transition)&&start>0)add('whoosh',start-0.3,0.3,3);
    if(b.block==='chapter')add('whoosh',start,0.2,2);
    if(['stat','delta','ring','magnitude'].includes(b.block))add('thud',cue+1.35,0.32,3);
    if(b.block==='kpis')for(const it of b.props.items)add('tick',it.at+start+1.25,0.22,1);
    if(b.block==='checklist')for(const it of b.props.items)add('tock',it.at+start+0.3,0.22,1);
    if(level!=='subtle'&&['steps','timeline','list','flow','icon-grid'].includes(b.block))for(const it of b.props.items??b.props.nodes??[])if(it.at!=null)add('tock',it.at+start,0.14,0);
    if(b.tone&&level==='punchy')add('thud',start+0.02,0.25,2);
    const canvas=[...(b.block==='canvas'?b.props.elements:[]),...(b.art?.over??[])];
    let pops=0;
    for(const el of canvas){
      if(el.count)add('thud',start+el.at+el.count.dur,0.28,3);
      else if((el.enter==='pop'||(el.enter==null&&['circle','icon'].includes(el.type)))&&pops<(level==='punchy'?8:4)){add('pop',start+el.at,0.16,0);pops++;}
    }
    if(level==='punchy'&&b.block==='kinetic'&&b.props.mode==='stack'){const keys=new Set((b.props.emphasis??[]).flatMap(e=>e.toLowerCase().split(/\s+/)));for(const w of b.words)if(keys.has(w.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')))add('tick',start+w.start,0.2,1);}
  }
  // Keep the heavier of two cues closer than 0.16 s, so hits never smear together.
  cues.sort((a,b)=>a.t-b.t);const kept=[];
  for(const c of cues){const last=kept.at(-1);if(last&&c.t-last.t<0.16){if(c.weight>last.weight)kept[kept.length-1]=c;continue;}kept.push(c);}
  return kept.map(({weight,...c})=>c);
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
    const soundCues=soundDesign(ctx.job,ctx.sb.sfx);
    const track=noAudio?null:await mix(root,ctx.timing,audio,ctx.sb.mix,soundCues);
    await mux(silent,track,finished);const probe=validateVideo(finished,ctx.job);unchanged(ctx);
    fs.mkdirSync(path.dirname(output),{recursive:true});fs.renameSync(finished,output);
    const report={...ctx.manifest,encoder:draft?'draft (x264 veryfast, CRF 23)':'final (x264 medium, CRF 16)',width:ctx.job.width,height:ctx.job.height,fps:ctx.job.fps,frames:ctx.job.frames,seconds:(performance.now()-start)/1000,backend:process.platform==='darwin'?'skia-metal':'cpu',audio:!!probe.audio,colorSpace:probe.video.color_space??null,outputSha256:sha256(fs.readFileSync(output)),voiceProviders:[...new Set(ctx.timing.beats.map(b=>b.vo?.provider).filter(Boolean))]};
    writeJSON(`${output}.json`,report);log.ok(`FFFrames video → ${output}`);return report;
  }finally{for(const f of [raw,silent,audio,finished])fs.rmSync(f,{force:true});}
}
/** Review copy of the prepared job with a labelled coordinate grid for placing art. */
function withGuides(ctx){const dir=path.join(ctx.dir,`guides-${crypto.randomUUID()}`);fs.mkdirSync(dir);writeJSON(path.join(dir,'job.json'),{...ctx.job,guides:true});return {...ctx,dir,cleanup:()=>fs.rmSync(dir,{recursive:true,force:true})};}
export async function stillProject(root,{draft=false,at,beat,pos=0.6,out,grid=false}={}) {
  let ctx=await prepareProject(root,{draft});const b=beat&&ctx.timing.beats.find(b=>b.id===beat);if(beat&&!b)throw new Error(`No beat ${beat}`);
  if(grid)ctx=withGuides(ctx);
  const time=b?b.start+b.dur*pos:Number(at??0);if(!Number.isFinite(time)||time<0||time>=ctx.timing.duration)throw new Error('Still time must lie within the film.');
  const file=path.resolve(out??path.join(root,'build',`still-${time.toFixed(2)}${grid?'-grid':''}.png`));fs.mkdirSync(path.dirname(file),{recursive:true});
  try{await singleFrame(ctx,time,file);}finally{ctx.cleanup?.();}unchanged(ctx);return file;
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
export async function sheetProject(root,{draft=false,per=3,columns=per,thumb=400,out,grid=false}={}) {
  let ctx=await prepareProject(root,{draft});if(grid)ctx=withGuides(ctx);if(!Number.isInteger(columns)||columns<1||columns>8||!Number.isInteger(thumb)||thumb<100||thumb>1920)throw new Error('Invalid sheet columns or thumb size');if(!Number.isInteger(per)||per<1||per>3)throw new Error('sheet --per must be 1–3');
  const times=ctx.timing.beats.flatMap(b=>(per===1?[0.65]:per===2?[0.3,0.85]:[0.15,0.55,0.9]).map(p=>Math.min(b.end-1/ctx.timing.fps,b.start+b.dur*p)));
  const shots=path.join(ctx.dir,`sheet-${crypto.randomUUID()}`);fs.mkdirSync(shots);const file=path.resolve(out??path.join(root,'build/sheet.png'));
  try {
    await nativeCommand(ctx,'frame',[times.map(t=>`${t.toFixed(4)}s`).join(','),'-o',shots]);
    const pngs=fs.readdirSync(shots).filter(f=>f.endsWith('.png')).sort();if(pngs.length!==times.length)throw new Error(`Expected ${times.length} frame PNGs; got ${pngs.length}`);
    // Upstream names contain frame numbers; numeric sort preserves beat order.
    pngs.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));pngs.forEach((f,i)=>fs.copyFileSync(path.join(shots,f),path.join(shots,`tile-${String(i).padStart(4,'0')}.png`)));
    fs.mkdirSync(path.dirname(file),{recursive:true});await ffmpeg(['-y','-framerate','1','-i',path.join(shots,'tile-%04d.png'),'-vf',`scale=${thumb}:-1,tile=${columns}x${Math.ceil(times.length/columns)}:padding=8:margin=8:color=0x161b22`,'-frames:v','1','-threads','1',file]);unchanged(ctx);writeJSON(`${file}.json`,{inputId:ctx.manifest.inputId,times,beats:ctx.job.beats.map(b=>b.id)});return file;
  }finally{fs.rmSync(shots,{recursive:true,force:true});ctx.cleanup?.();}
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
