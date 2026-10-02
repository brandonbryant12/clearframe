#!/usr/bin/env node
// Real-source Coca-Cola Q2 2026 earnings recap. No paid generation calls.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const cli=path.join(repo,'engine/cli.mjs');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const json=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n');
export const releaseURL='https://www.coca-colacompany.com/media-center/coca-cola-reports-second-quarter-2026-results';
export const exhibitURL='https://investors.coca-colacompany.com/filings-reports/all-sec-filings/content/0001628280-26-049922/a2026q2earningsreleaseex-9.htm';
const assetURLs={
 'company-logo.svg':'https://www.coca-colacompany.com/content/dam/corporate/us/en/header-footer/Header%20Icon.svg',
 'brand-hero.jpg':'https://www.coca-colacompany.com/content/dam/corporate/us/en/tccc/brands/coca-cola-new-picture-1.jpg',
 'brand-detail.jpg':'https://www.coca-colacompany.com/content/dam/corporate/us/en/tccc/brands/coca-cola-new-picture-3.jpg',
};
export const claims=[
 {id:'period',claim:'Second quarter 2026 covers the three months ended July 3, 2026; results released July 28, 2026.',source:releaseURL,section:'Title and Operating Review – Three Months Ended July 3, 2026'},
 {id:'revenue',claim:'Net revenues were $13.4 billion, up 7% year over year.',source:releaseURL,section:'Quarterly Performance: Revenues'},
 {id:'organic',claim:'Organic revenue (non-GAAP) grew 6%, driven by concentrate sales growth of 4% and price/mix growth of 2%.',source:releaseURL,section:'Quarterly Performance: Revenues'},
 {id:'volume',claim:'Unit case volume grew 5%. Concentrate sales were one point behind unit case volume due to shipment timing.',source:releaseURL,section:'Quarterly Performance: Revenues; Operating Review: Consolidated'},
 {id:'margin',claim:'GAAP operating margin was 34.9%, compared with 34.1% in the prior-year quarter.',source:releaseURL,section:'Quarterly Performance: Operating margin'},
 {id:'eps',claim:'GAAP EPS was $1.03, up 16%. Comparable EPS (non-GAAP) was $0.97, up 11%.',source:releaseURL,section:'Quarterly Performance: Earnings per share'},
 {id:'outlook',claim:'The company raised its full-year guidance; numeric guidance is outside this recap.',source:releaseURL,section:'Release title and Outlook'},
];
const approaches=[
 {id:'inside-the-growth',selected:true,story:'A familiar bottle opens into the economics: two revenue drivers, a distinct volume measure, then margin and earnings.',picture:'Real bottle photography, a red ribbon splitting into labelled components, physically distinct before/after margin rails.',edit:'Branded close-up to wide mechanism to evidence inserts, ending on real product imagery.',pace:'A short identity beat, a longer mechanism, then concise results.',reason:'Makes the accounting distinction visible while preserving a recognizable brand world.'},
 {id:'around-the-system',selected:false,story:'Follow concentrate, bottling and customers across an illustrated system.',picture:'An original route map, containers and cropped real packaging.',edit:'A continuous camera world.',pace:'One unbroken journey with holds at each measurement boundary.'},
 {id:'read-the-release',selected:false,story:'An editorial analyst marks the release and compares the reported figures.',picture:'Native document typography, underlines and quiet photographic margins.',edit:'Close evidence crops intercut with full-page context.',pace:'Patient reading with sharp typographic emphasis.'},
];
const source='Coca-Cola Q2 2026 release · July 28, 2026';
const show={at:0,enter:'none'};
const red='#e41e2b',white='#ffffff',ink='#1d1d1f';
const tx=(text,x,y,size=48,extra={})=>({type:'text',text,x,y,size,font:'display',fill:'ink',fit:1540,...show,...extra});
const rect=(x,y,w,h,fill,extra={})=>({type:'rect',x,y,w,h,fill,...show,...extra});
const line=(x1,y1,x2,y2,color='line',width=3,extra={})=>({type:'line',x1,y1,x2,y2,stroke:color,width,...show,...extra});
const caption=(text,x=192,y=922,extra={})=>tx(text,x,y,27,{font:'mono',fill:'muted',...extra});
const logo=(x=190,y=105,w=500)=>({type:'image',asset:'logo',x,y,w,h:w*80/493,fit:'contain',subject:true,...show});
const image=(asset,x,y,w,h,extra={})=>({type:'image',asset,x,y,w,h,fit:'cover',subject:true,...show,...extra});
function bubbles(x,y,w,h,color=white){return{type:'particles',kind:'bubbles',x,y,w,h,count:15,seed:21,size:7,speed:0.12,fill:color,opacity:0.15,...show};}
function bottle(x,y,fill=white){return{type:'group',x,y,origin:[0,0], ...show,children:[
 {type:'path',d:'M 29 0 L 71 0 L 74 67 C 74 90 95 100 97 137 L 103 257 C 104 283 96 304 82 312 L 18 312 C 4 304 -4 283 -3 257 L 3 137 C 5 100 26 90 26 67 Z',fill,stroke:'accent',width:3,...show},
 rect(3,139,94,87,'accent'),line(26,8,74,8,'accent',6),]};}
export function authorStoryboard(base,revised=false){
 const sb=structuredClone(base);
 Object.assign(sb,{title:'Inside the growth — Coca-Cola Q2 2026',logline:'From a familiar bottle to the drivers behind Coca-Cola’s reported quarter.',
  format:{preset:'landscape',fps:30},theme:{base:'paper',bg:white,surface:'#f2e9e2',ink,muted:'#635a57',accent:red,accent2:'#7e111b',positive:'#216146',negative:'#a82c2c'},
  type:'condensed',motion:{preset:'gentle',intensity:0.65},transition:'cut',backdrop:'none',sfx:'subtle',music:false,captions:false,chrome:false,
  texture:{grain:0.08},sources:claims.map(c=>({claim:c.claim,source:c.source+' — '+c.section,asOf:'2026-07-28'})),
  continuity:{treatment:'Warm white, Coca-Cola red, actual brand photography and unaltered corporate identity.',camera:'Close brand opening, wide causal diagram, result inserts, photographic close.',motion:'A red ribbon is the visual continuity device; measures stay labelled and separate.'},
  beats:[
   {id:'opening',block:'canvas',vo:'Coca-Cola’s second quarter of 2026: a familiar bottle, and a stronger earnings picture.',tail:0.7,
    props:{source,elements:[rect(0,0,1040,965,red),image('hero',1040,0,880,965),rect(165,130,680,180,white),logo(205,175,600),
     tx('INSIDE',185,520,142,{font:'poster',fill:white,at:0.1,enter:'wipe',dur:0.55}),tx('THE GROWTH',185,685,142,{font:'poster',fill:white,at:0.3,enter:'wipe',dur:0.7}),
     tx('Q2 2026',192,817,59,{font:'mono',fill:white}),caption('Independent earnings recap',192,924,{fill:white}),bubbles(60,40,930,875)]},camera:{move:'in',amount:0.15}},
   {id:'revenue',block:'canvas',vo:'Net revenue reached 13.4 billion dollars, up 7 percent from the same quarter last year.',tail:0.8,
    transition:'panel',props:{source,elements:[logo(192,98,400),tx('A larger top line',192,312,72),
     tx('$13.4B',182,655,250,{font:'poster',fill:'accent',at:0.2,enter:'wipe-up',dur:0.85}),
     tx('+7%',1270,581,140,{font:'poster',fill:'accent',at:1,enter:'rise',dur:0.65}),tx('year over year',1280,652,39,{font:'mono'}),
     {type:'path',d:'M 200 790 C 580 790 920 805 1230 780 S 1580 750 1710 720',fill:'none',stroke:'accent',width:16,arrow:'end',head:40,at:0.45,enter:'draw',dur:1.3},
     caption('Net revenue · USD · Quarter ended July 3, 2026')]},camera:{move:'in',amount:0.12}},
   {id:'organic',block:'canvas',vo:'Organic revenue grew 6 percent. Concentrate sales rose 4 percent, while price and mix increased 2 percent.',tail:1.2,
    props:{source,elements:[tx('What powered organic growth?',192,225,77),caption('Organic revenue is a non-GAAP measure.',192,303),
     {type:'path',d:'M 250 500 L 850 500 Q 950 500 1040 600 L 1120 650',fill:'none',stroke:'accent',width:56,cap:'round',at:0.15,enter:'draw',dur:1.8},
     {type:'path',d:'M 250 800 L 850 800 Q 950 800 1040 700 L 1120 650',fill:'none',stroke:'accent2',width:28,cap:'round',at:0.6,enter:'draw',dur:1.8},
     {type:'path',d:'M 1120 650 L 1550 650',fill:'none',stroke:'accent',width:84,cap:'butt',at:1.3,enter:'draw',dur:1.1},
     tx('+4%',245,449,95,{font:'poster',fill:'accent',at:0.2,enter:'wipe',dur:0.6}),tx('Concentrate sales',460,446,45),
     tx('+2%',245,749,95,{font:'poster',fill:'accent2',at:0.6,enter:'wipe',dur:0.6}),tx('Price / mix',460,746,45),
     tx('+6%',1400,515,150,{font:'poster',fill:'accent',at:1.1,enter:'wipe-up',dur:0.8}),
     tx('Organic revenue',1320,805,45,{at:1.5,enter:'fade',dur:0.6}),
     line(270,500,800,500,white,6,{dash:[14,22],loop:{type:'dash',period:2},opacity:0.7,at:1.8}),
     line(270,800,800,800,white,4,{dash:[14,22],loop:{type:'dash',period:2},opacity:0.7,at:2}),
     caption(revised?'Growth drivers, as reported by the company.':'Reported components; rounded percentages') ]},camera:{move:'in',amount:0.1}},
   {id:'volume',block:'canvas',vo:'Unit case volume grew 5 percent. Concentrate shipments lagged by one point because of timing.',tail:0.9,
    transition:'iris',props:{source,elements:[rect(0,0,1920,965,red),tx('Different measures.',192,235,86,{fill:white}),
     ...(revised?[0,1,2]:[0,1,2,3,4]).map((i)=>({...bottle(revised?320+i*280:245+i*188,390,white),at:0.25+i*0.15,enter:'rise',dur:0.6})),
     tx('+5%',1330,587,188,{font:'poster',fill:white,at:0.7,enter:'wipe-up',dur:0.8}),
     tx('unit case volume',1285,676,46,{fill:white}),
     line(210,787,1680,787,white,2,{opacity:0.7}),
     tx(revised?'Concentrate sales +4%: shipment timing':'Concentrate sales: one point behind',215,862,revised?43:46,{fill:white}),
     caption(revised?'Illustrative bottles · separate measurement bases':'Bottle silhouettes are illustrative; the count does not encode growth.',192,926,{fill:white,size:25})]},camera:{move:'in',amount:0.12}},
   {id:'margin',block:'canvas',vo:'GAAP operating margin expanded from 34.1 percent to 34.9 percent.',tail:1.2,
    props:{source,elements:[tx(revised?'A wider operating margin.':'More revenue became operating profit.',192,232,74),
     tx('GAAP operating margin',192,309,40,{font:'mono',fill:'muted'}),
     rect(250,475,1420,95,'surface'),rect(250,475,1420*0.341,95,'muted',{at:0.2,enter:'grow-x',dur:0.9}),
     rect(250,720,1420,95,'surface'),rect(250,720,1420*0.349,95,'accent',{at:0.6,enter:'grow-x',dur:0.9}),
     tx('Q2 2025',250,435,37,{font:'mono'}),tx('34.1%',870,550,100,{font:'poster',fill:'muted'}),
     tx('Q2 2026',250,680,37,{font:'mono'}),tx('34.9%',870,795,100,{font:'poster',fill:'accent'}),
     tx('100% revenue',1670,882,30,{font:'mono',anchor:'end',fill:'muted'}),caption(revised?'Equal scales · 0–100%':'Both rails use the same zero-to-100% scale.')]},camera:{move:'in',amount:0.08}},
   {id:'earnings',block:'canvas',vo:'GAAP earnings per share rose 16 percent to 1 dollar 3 cents. Comparable earnings rose 11 percent to 97 cents.',tail:1.3,
    transition:'panel',props:{source,elements:[rect(0,0,990,965,red),tx('EARNINGS',192,250,106,{font:'poster',fill:white}),
     tx('GAAP EPS',192,392,46,{font:'mono',fill:white}),tx('$1.03',184,661,211,{font:'poster',fill:white,at:0.2,enter:'wipe-up',dur:0.8}),
     tx('+16% year over year',192,807,48,{fill:white}),
     tx('Comparable EPS',1120,370,48),tx('Non-GAAP',1120,426,31,{font:'mono',fill:'muted'}),
     tx('$0.97',1110,657,178,{font:'poster',fill:'accent',at:0.9,enter:'wipe-up',dur:0.8}),
     tx('+11% year over year',1120,805,44,{fill:'accent'}),caption('USD per share · Q2 2026',1120,924)]},camera:{move:'in',amount:0.1}},
   {id:'closing',block:'canvas',vo:'The company raised full-year guidance. These are reported results, in an independent earnings recap.',tail:1.3,hold:revised?0.8:0,
    props:{source,elements:[image('detail',0,0,970,965),rect(970,0,950,965,white),logo(1100,155,610),
     tx('GROWTH,',1095,420,123,{font:'poster',fill:'accent',at:0.2,enter:'wipe',dur:0.6}),
     tx('WITH CONTEXT.',1095,557,110,{font:'poster',fill:'accent',at:0.4,enter:'wipe',dur:0.7}),
     tx('Full-year guidance raised',1105,696,44),tx('Quarter ended July 3, 2026',1105,765,34,{font:'mono',fill:'muted'}),
     tx('Independent recap',1105,867,35),tx('Local synthetic draft narration',1105,917,28,{font:'mono',fill:'muted'})]},camera:{move:'in',amount:0.08}},
  ]});
 if(revised){
  // Changes made after the actual first contact/phone-sheet review.
  for(const b of sb.beats)for(const e of b.props.elements)if(e.h===965)e.h=945;
  for(const id of ['revenue','earnings'])sb.beats.find(b=>b.id===id).transition='cut';
 }
 return sb;
}
async function prepare(out){
 const kit=path.join(out,'source-kit');fs.mkdirSync(kit,{recursive:true});
 const downloads=[['earnings.html',releaseURL],['sec-exhibit.html',exhibitURL],...Object.entries(assetURLs)];
 const provenance=[];for(const[file,url]of downloads){const f=path.join(kit,file);if(!fs.existsSync(f)){const r=await fetch(url);if(!r.ok)throw new Error(url+' returned '+r.status);fs.writeFileSync(f,Buffer.from(await r.arrayBuffer()));}const bytes=fs.readFileSync(f);provenance.push({file,url,bytes:bytes.length,sha256:sha(bytes),recordedAt:new Date().toISOString(),altered:false});}
 json(path.join(kit,'source-provenance.json'),provenance);
 fs.writeFileSync(path.join(kit,'verified-facts.md'),'# Coca-Cola Q2 2026 — verified factual source notes\n\nIndependent editorial recap. No investment recommendation or forecast.\n\n'+claims.map(c=>`- ${c.id}: ${c.claim}\n  Source: ${c.source} — ${c.section}`).join('\n\n')+'\n\nThe official release and SEC exhibit HTML are retained with SHA-256 hashes in source-provenance.json. The official imagery represents brand identity, not evidence of any quantitative result.\n');
 json(path.join(kit,'brand.json'),{name:'Coca-Cola — independent editorial recap',theme:{base:'paper',bg:white,surface:'#f2e9e2',ink,muted:'#635a57',accent:red,accent2:'#7e111b'},type:'condensed',rules:['Use original company SVG unchanged.','Use actual official brand photography.','No invented claims, numbers, quotes or official endorsement.'],assets:[{id:'logo',kind:'image',file:'company-logo.svg',role:'unaltered official company identity'},{id:'hero',kind:'image',file:'brand-hero.jpg',role:'official bottle photograph; brand illustration'},{id:'detail',kind:'image',file:'brand-detail.jpg',role:'official product photograph; brand illustration'}]});
 json(path.join(out,'approaches.json'),approaches);json(path.join(out,'source-to-claim.json'),claims);
 fs.writeFileSync(path.join(out,'DIRECTION.md'),'# Inside the growth — Coca-Cola Q2 2026\n\n## Brief\nA 45–60 second, 1920×1080, independent branded earnings recap. Real source facts, actual official identity and imagery, local draft narration. No paid generation.\n\n## Decisions\nOne-shot authoring is authorized. Select inside-the-growth: the familiar bottle opens into the drivers behind the reported quarter. Keep GAAP/non-GAAP and unit case/concentrate measures explicitly labelled. Omit numeric guidance rather than widening the evidence scope. Branded close, wide mechanism, margin insert, paired earnings, photographic close. Preserve source originals and separate authoring time from CLI replay.\n\n'+approaches.map(x=>`## ${x.id}${x.selected?' — selected':''}\n${x.story}\n\nPicture: ${x.picture}\nEdit: ${x.edit}\nPace: ${x.pace}\n`).join('\n')+'\n## Review requirements\nInspect contact and phone sheets, compare all narration/displayed figures to the source ledger, retain actual initial and revised files, review boundary output and report playback/listening limits. No human approval is implied.\n');
 return kit;
}
export async function run(out,phase='initial'){
 out=path.resolve(out);fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(out,'logs'),{recursive:true});
 const saved=path.join(out,'trajectory.json');
 if(phase==='initial'&&fs.existsSync(saved)&&read(saved).runs.some(x=>x.variant==='initial'))throw new Error('Initial evidence exists; preserve it.');
 if(phase!=='initial'&&!fs.existsSync(saved))throw new Error('Run initial first.');
 const report=fs.existsSync(saved)?read(saved):{version:1,kind:'actual-source-video',startedAt:new Date().toISOString(),approaches,runs:[],milestones:[],timingNotice:'Source download and authored-storyboard replay timing do not measure original creative authoring. See live-session.json.'};
 if(report.error){(report.recoveredFailures??=[]).push({error:report.error,at:report.lastFinishedAt});delete report.error;}
 const save=()=>json(saved,report);
 const command=(name,args)=>{const at=new Date().toISOString(),t=performance.now();const r=spawnSync(process.execPath,[cli,...args],{cwd:repo,encoding:'utf8',maxBuffer:64*1024*1024});fs.writeFileSync(path.join(out,'logs',name+'.stdout'),r.stdout||'');fs.writeFileSync(path.join(out,'logs',name+'.stderr'),r.stderr||'');report.milestones.push({name,at,seconds:(performance.now()-t)/1000,exitCode:r.status,command:['node','engine/cli.mjs',...args]});save();if(r.status!==0)throw new Error(name+': '+(r.error?.message||r.stderr));return r;};
 try{
  const kit=await prepare(out);const variant=phase==='final'?'revised':phase;const project=path.join(out,variant);
  if(phase!=='final'){
   if(!fs.existsSync(path.join(project,'storyboard.json')))command(variant+'-start',['start',project,'--document',path.join(kit,'verified-facts.md'),'--brand',path.join(kit,'brand.json'),'--idea','Make a branded independent Coca-Cola Q2 2026 earnings film.','--audience','A general business audience','--takeaway','Understand the drivers behind reported growth.','--json']);
   const sb=authorStoryboard(read(path.join(project,'storyboard.json')),variant==='revised');json(path.join(project,'storyboard.json'),sb);json(path.join(out,variant+'-authored-storyboard.json'),sb);
   if(variant==='revised'){const initial=report.runs.find(x=>x.variant==='initial');assert.ok(initial);fs.cpSync(path.join(initial.project,'assets/vo'),path.join(project,'assets/vo'),{recursive:true});}
  }
  const free=fs.statfsSync(repo);assert.ok(free.bavail*free.bsize>=20*2**30,'Retain 20 GiB before native render.');
  const p=JSON.parse(command(phase+'-pipeline',['pipeline',project,...(phase==='final'?[]:['--draft']),'--scale',phase==='final'?'1':'0.5','--json']).stdout);
  assert.equal(p.status,'ready-for-review');assert.equal(p.check.errors.length,0);assert.ok(!p.qa.findings.some(f=>f.level==='error'));
  const intake=read(path.join(project,'intake.json'));const original=intake.assets.find(a=>a.id==='logo').original;assert.ok(original);assert.equal(sha(fs.readFileSync(path.join(project,original.file))),sha(fs.readFileSync(path.join(kit,'company-logo.svg'))));
  const result={variant:phase,project,pipeline:p,intake,source:claims,logoOriginalUnchanged:true,revisionCause:phase==='revised'?'Actual first-pass contact/phone review: simplify the bottle illustration so its count cannot imply 5% growth; shorten margin text; keep source region clear; reserve graphic transitions for the measurement turn; extend final context.':null};report.runs.push(result);report.status=phase+'-ready-for-review';save();
  if(phase==='final'){
   assert.ok(p.check.duration>=45&&p.check.duration<=60,'Final duration should be 45–60 seconds.');
   try{command('captions',['captions',project]);report.captions={timing:'measured'};}
   catch(e){
    if(!e.message.includes('requires measured word timestamps'))throw e;
    command('captions-rough',['captions',project,'--draft']);
    report.captions={timing:'partly estimated',rough:true,reason:'Whisper alignment contains interpolated words; do not label every timestamp measured.'};
   }
   save();
  }
  console.log(JSON.stringify({variant:phase,status:p.status,seconds:p.check.duration,pipelineSeconds:p.seconds,artifacts:p.artifacts},null,2));
 }catch(e){report.status='failed';report.error=e.message;throw e;}finally{report.lastFinishedAt=new Date().toISOString();save();}
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values,positionals}=parseArgs({args:process.argv.slice(2),allowPositionals:true,options:{phase:{type:'string',default:'initial'}}});
 assert.ok(positionals[0],'Usage: coca-cola.mjs OUTPUT --phase initial|revised|final');assert.ok(['initial','revised','final'].includes(values.phase));await run(positionals[0],values.phase);
}
