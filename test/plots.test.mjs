import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { utcDay, axisPosition, axisLabel, plotSpec } from '../fframes/plot-data.mjs';
import { expandPlotProps, plotLayout } from '../fframes/plots.mjs';
import { normalizeElements } from '../fframes/canvas.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { createJob } from '../fframes/job.mjs';
const source='Hypothetical illustration';
const frame={width:1920,height:1080,duration:7};
const base={title:'Two paths, one scale',asOf:'2026-10-02',source,
  x:{type:'linear',label:'Years',domain:[0,10],ticks:[0,5,10]},
  y:{type:'linear',label:'Balance · USD thousands',domain:[0,100],ticks:[0,50,100]},
  series:[{id:'a',label:'Path A',values:[{x:0,y:10},{x:5,y:40},{x:10,y:90}]},
    {id:'b',label:'Path B',values:[{x:0,y:10},{x:2,y:20},{x:10,y:60}]}]};
const draw=p=>expandPlotProps({plot:p},frame);
const named=(p,id)=>p.elements.find(e=>e.id===id);
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('shared scales retain exact positions, including signed and logarithmic values',()=>{
  assert.equal(axisPosition(50,base.y),.5);
  assert.equal(axisPosition(0,{type:'linear',domain:[-10,10]}),.5);
  near(axisPosition(10,{type:'log',domain:[1,100]}),.5);
  assert.throws(()=>axisPosition(0,{type:'log',domain:[1,100]}));
  const p=draw({...base,motion:'none'}),L=plotLayout(frame,{xLabel:base.x.type!=='date'});
  near(named(p,'plot-a-point-1').cy,L.bottom-.4*(L.bottom-L.top));
  assert.equal(named(p,'plot-a-point-0').cy,named(p,'plot-b-point-0').cy);
});

test('date spacing represents real elapsed days and validates the calendar in UTC',()=>{
  assert.equal(utcDay('2024-03-01')-utcDay('2024-02-28'),2);
  assert.throws(()=>utcDay('2025-02-29')); assert.throws(()=>utcDay('10/02/2026'));
  const axis={type:'date',domain:['2024-01-01','2024-03-01'],dateFormat:'month'};
  near(axisPosition('2024-02-01',axis),31/60);
  assert.equal(axisLabel('2024-02-01',axis),'Feb 2024');
});

test('different sampling intervals follow one linear reveal clock',()=>{
  const p=draw(base),a=named(p,'plot-a-segment-1'),b=named(p,'plot-b-segment-2');
  const clock=1.55; // x=3.5 of 10: after B's second point, during A's first segment.
  const visibleX=s=>s.x1+(s.x2-s.x1)*(clock-s.at)/s.dur;
  near(visibleX(a),visibleX(b));
  assert.equal(a.drawEase,'linear'); assert.equal(b.drawEase,'linear');
  assert.equal(named(p,'plot-a-label').at,0);
  assert.equal(named(p,'plot-a-value').at,3.5);
  assert.throws(()=>expandPlotProps({plot:base},{...frame,duration:5}),/two seconds/);
});

test('missing observations break lines and retain solitary points without inventing a bridge',()=>{
  const p=draw({...base,series:[{id:'a',label:'A',values:[{x:0,y:10},{x:5,y:null},{x:10,y:30}]}]});
  assert.equal(p.elements.filter(e=>e.id.includes('-segment-')).length,0);
  assert(named(p,'plot-a-point-0'));assert(named(p,'plot-a-point-2'));
  assert(p.source.includes('Gap: 5'));
  assert(p.sourceSize>=32);
  assert.throws(()=>draw({...base,series:[{id:'a',label:'A',values:[{x:0,y:null}]}]}),/all-missing/);
});

test('input errors fail before pictures can hide units, domains, dates or missing values',()=>{
  const bads=[{...base,asOf:'2025-02-29'},{...base,source:''},{...base,y:{...base.y,domain:[0,50]}},
    {...base,y:{...base.y,ticks:[0,50]}},{...base,y:{...base.y,domain:[.5,100],ticks:[.5,100]}},
    {...base,series:[{id:'a',label:'A',values:[{x:0,y:10},{x:0,y:20}]}]},
    {...base,series:[{id:'a',label:'A',values:[{x:0,y:undefined}]}]}];
  for(const bad of bads)assert.throws(()=>plotSpec(bad));
  assert.throws(()=>plotSpec({...base,forecast: true}),/unknown/);
  assert.throws(()=>plotSpec(base,'Different source'),/conflicts/);
  assert.throws(()=>expandPlotProps({plot:base,kpi:{}},frame),/combine/);
});

test('labels move independently of data points and an annotation must name actual evidence',()=>{
  const p=draw({...base,series:base.series.map(s=>({...s,values:[{x:0,y:20},{x:10,y:50}]}))});
  assert.equal(named(p,'plot-a-point-1').cy,named(p,'plot-b-point-1').cy);
  assert.notEqual(named(p,'plot-a-label').x,named(p,'plot-b-label').x);
  assert.throws(()=>draw({...base,annotation:{seriesId:'a',x:3,label:'Invented',dx:0,dy:0}}),/actual/);
  assert(named(draw({...base,annotation:{seriesId:'a',x:5,label:'Illustrative midpoint',dx:.1,dy:-.1}}),'plot-annotation-point'));
});

test('geometry validates and source jobs compile in all four frame presets without paid assets',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cf-plots-'));
  try {
    for(const [preset,width,height] of [['landscape',1920,1080],['vertical',1080,1920],['square',1080,1080],['portrait',1080,1350]]){
      const p=expandPlotProps({plot:base},{width,height,duration:7});
      normalizeElements(p.elements,'elements',message=>{throw Error(message)});
      const sb={format:{preset},theme:'paper',music:false,captions:false,
        sources:[{claim:'All values are hypothetical',source,asOf:base.asOf}],
        beats:[{id:'compare',block:'canvas',duration:7,camera:'none',props:{plot:base}}]};
      fs.writeFileSync(path.join(tmp,'storyboard.json'),JSON.stringify(sb));
      const {job,errors,warnings}=createJob(loadStoryboard(tmp),computeTiming(tmp),{draft:true});
      assert.deepEqual(errors,[]);
      assert(!warnings.some(w=>w.includes("outside this beat's camera view")), 'fitted titles remain in the view');
      assert(job.beats[0].props.elements.length>0);
      assert.equal(job.beats[0].props.plot,undefined);
      assert(job.beats[0].props.source.includes('2026-10-02'));
      sb.beats[0].duration=4;
      fs.writeFileSync(path.join(tmp,'storyboard.json'),JSON.stringify(sb));
      assert(createJob(loadStoryboard(tmp),computeTiming(tmp),{draft:true}).errors.some(e=>e.includes('two seconds')));
      sb.beats[0].duration=7;
      sb.sources=[];fs.writeFileSync(path.join(tmp,'storyboard.json'),JSON.stringify(sb));
      assert(createJob(loadStoryboard(tmp),computeTiming(tmp),{draft:true}).errors.some(e=>e.includes('sources entry')));
    }
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

test('linear stroke easing is explicit, bounded to draw entrances, and backward-compatible',()=>{
  const normalize=el=>normalizeElements([el],'elements',message=>{throw Error(message)})[0];
  const line={type:'line',x2:10,y2:20,enter:'draw'};
  assert.equal(normalize({...line,drawEase:'linear'}).drawEase,'linear');
  assert.equal(normalize(line).drawEase,undefined);
  assert.throws(()=>normalize({...line,drawEase:'spring'}),/drawEase/);
  assert.throws(()=>normalize({...line,enter:'fade',drawEase:'linear'}),/drawEase/);
});
