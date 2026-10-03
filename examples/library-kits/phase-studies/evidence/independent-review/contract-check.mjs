// Independent bounded review: calendar ordinal arithmetic, truth-table quadrants,
// gap masks, inverse coordinate equations and polygon-edge intersections.
// This imports the candidate only as the system under test.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {phaseTrail} from '../../../../../fframes/phase-data.mjs';
import {phaseScene,phaseValue} from '../../../../../fframes/phases.mjs';
const root=fileURLToPath(new URL('../../../../../',import.meta.url));
const kit='examples/library-kits/phase-studies', output=path.dirname(fileURLToPath(import.meta.url));
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
const cases=JSON.parse(fs.readFileSync(path.join(root,kit,'inputs.json'))).cases.map(({id,...d})=>d);
let assertions=0,modelCases=0,sceneCases=0,negativeCases=0,copyZones=0;
const eq=(a,b)=>{assert.deepEqual(a,b);assertions++;};
const ok=(a,m)=>{assert.ok(a,m);assertions++;};
const near=(a,b,tol=1e-8)=>ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
// Gregorian ordinal, independent of Date.parse and the shared utcDay helper.
const ordinal=s=>{let [y,m,d]=s.split('-').map(Number);const yy=y-1;const leap=y%4===0&&(y%100!==0||y%400===0);return 365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)+[0,31,59,90,120,151,181,212,243,273,304,334][m-1]+(m>2&&leap?1:0)+d;};
const classify=(p,d)=>{
 if(p.x===null||p.y===null)return [null,null];
 if(p.x===d.x.reference&&p.y===d.y.reference)return [null,'both-references'];
 if(p.x===d.x.reference)return [null,'x-reference'];
 if(p.y===d.y.reference)return [null,'y-reference'];
 const table=[['SW','NW'],['SE','NE']];
 return [table[Number(p.x>d.x.reference)][Number(p.y>d.y.reference)],null];
};
function model(d){
 const before=structuredClone(d),m=phaseTrail(d);modelCases++;
 eq(d,before);eq(m.points.length,d.points.length);eq(m.smoothing,'none');
 const start=ordinal(d.points[0].date),duration=ordinal(d.points.at(-1).date)-start,edges=[];
 let complete=0;
 for(let i=0;i<d.points.length;i++){
  const p=d.points[i],r=m.points[i],valid=p.x!==null&&p.y!==null;
  eq([r.index,r.date,r.x,r.y,r.valid],[i,p.date,p.x,p.y,valid]);
  eq([r.quadrant,r.boundary],classify(p,d));
  eq(r.missing,['x','y'].filter(k=>p[k]===null));
  near(r.time*duration,ordinal(p.date)-start);eq(r.day,ordinal(p.date)-ordinal('1970-01-01'));
  if(valid)complete++;
  if(i&&valid&&d.points[i-1].x!==null&&d.points[i-1].y!==null)edges.push([i-1,i,d.points[i-1].date,p.date,ordinal(p.date)-ordinal(d.points[i-1].date)]);
 }
 eq([m.observed,m.missing],[complete,d.points.length-complete]);
 eq(m.segments.map(s=>[s.from,s.to,s.fromDate,s.toDate,s.days]),edges);
 eq(m.focus.date,d.focusDate);eq(m.focus,m.points[d.points.findIndex(p=>p.date===d.focusDate)]);
 m.x.domain[0]=-999;m.points[0].x=999;eq(d,before);
}
for(const original of cases){
 // Exhaust every missing-row pattern except the all-missing input. Alternate
 // which coordinate is null, and retain exact source dates including gaps.
 for(let mask=0;mask<(1<<original.points.length)-1;mask++){
  const d=structuredClone(original);d.points.forEach((p,i)=>{if(mask&(1<<i)){p.x=i%3===0?null:p.x;p.y=i%3===0?p.y:null;}else if(p.x===null||p.y===null){p.x=d.x.reference;p.y=d.y.reference;}});
  model(d);
 }
 for(const xs of [-1,0,1])for(const ys of [-1,0,1]){
  const d=structuredClone(original);d.points[0].x=d.x.reference+xs*Number.EPSILON*Math.max(1,Math.abs(d.x.reference));d.points[0].y=d.y.reference+ys*Number.EPSILON*Math.max(1,Math.abs(d.y.reference));d.focusDate=d.points[0].date;model(d);
 }
}
// Leap-day and multi-century timing cases. The independent ordinal handles
// 1900's non-leap and 2000's leap year without JavaScript date conversion.
for(const dates of [['1899-12-31','1900-02-28','1900-03-01','1901-01-01'],['1999-12-31','2000-02-28','2000-02-29','2000-03-01'],['0001-01-01','0400-02-29','2000-02-29','9999-12-31']]){
 const d=structuredClone(cases[0]);d.points=dates.map((date,i)=>({date,x:i-2,y:i*3-4}));d.asOf=dates.at(-1);d.focusDate=dates[1];model(d);
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const on=(a,b,p)=>Math.abs(cross(a,b,p))<1e-9&&p[0]>=Math.min(a[0],b[0])-1e-9&&p[0]<=Math.max(a[0],b[0])+1e-9&&p[1]>=Math.min(a[1],b[1])-1e-9&&p[1]<=Math.max(a[1],b[1])+1e-9;
function hit(a,b,c,d){const x=[cross(a,b,c),cross(a,b,d),cross(c,d,a),cross(c,d,b)];return x[0]*x[1]<0&&x[2]*x[3]<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);}
function blocked(a,b,box){const [l,t,r,d]=box,inside=p=>p[0]>=l&&p[0]<=r&&p[1]>=t&&p[1]<=d;if(inside(a)||inside(b))return true;const corners=[[l,t],[r,t],[r,d],[l,d]];return corners.some((p,i)=>hit(a,b,p,corners[(i+1)%4]));}
for(const original of cases)for(const [w,h]of [[1920,1080],[1080,1920]])for(const view of ['trail','focus'])for(const reveal of [false,true])for(const focus of original.points){
 const d=structuredClone(original);d.focusDate=focus.date;
 const s=phaseScene(d,{width:w,height:h,id:'review',view,reveal}),e=s.props.elements,g=s.geometry,[l,t,r,b]=g.box;sceneCases++;
 const total=ordinal(d.points.at(-1).date)-ordinal(d.points[0].date),expectedEdges=[];
 eq(new Set(e.map(p=>p.id)).size,e.length);eq(e.filter(p=>p.id.startsWith('review-point-')).length,d.points.filter(p=>p.x!==null&&p.y!==null).length);
 for(let i=0;i<d.points.length;i++){
  const p=d.points[i],valid=p.x!==null&&p.y!==null,mark=e.find(p=>p.id===`review-point-${i}`),clock=(ordinal(p.date)-ordinal(d.points[0].date))/total,at=view==='trail'&&reveal?1+12*clock:0;
  near((g.timeline[i].point[0]-l)*total,(r-l)*(ordinal(p.date)-ordinal(d.points[0].date)),1e-6);eq(g.timeline[i].at,at);
  if(valid){ok(mark);near((mark.cx-l)*(d.x.domain[1]-d.x.domain[0]),(r-l)*(p.x-d.x.domain[0]),1e-6);near((b-mark.cy)*(d.y.domain[1]-d.y.domain[0]),(b-t)*(p.y-d.y.domain[0]),1e-6);eq(mark.at,at);eq(mark.enter,'none');eq(mark.along,undefined);eq(mark.motion,undefined);}
  else {eq(mark,undefined);eq(g.points[i].point,null);}
  if(i&&valid&&d.points[i-1].x!==null&&d.points[i-1].y!==null)expectedEdges.push([i-1,i]);
 }
 eq(g.segments.map(p=>[p.from,p.to]),expectedEdges);
 if(view==='trail'){
  const readouts=e.filter(p=>p.type==='text'&&p.id.startsWith('review-current-'));eq(readouts.length,d.points.length);
  const times=reveal?[0,.999,1,...d.points.flatMap(p=>{const at=1+12*(ordinal(p.date)-ordinal(d.points[0].date))/total;return[at-.00001,at+.00001];}),35.9]:[0,1,35.9];
  for(const time of times){const visible=readouts.filter(p=>time>=p.at&&(p.exitAt===undefined||time<p.exitAt));const selected=reveal?d.points.filter(p=>1+12*(ordinal(p.date)-ordinal(d.points[0].date))/total<=time).at(-1):d.points.at(-1);eq(visible.length,selected?1:0);if(selected){const valid=selected.x!==null&&selected.y!==null;eq(visible[0].text,`${valid?'Observation':'Missing pair'}: ${selected.date}`);const rings=e.filter(p=>p.id.startsWith('review-current-ring-')&&time>=p.at&&(p.exitAt===undefined||time<p.exitAt));eq(rings.length,valid?1:0);if(valid){const index=d.points.findIndex(p=>p.date===selected.date);eq([rings[0].cx,rings[0].cy],g.points[index].point);eq(rings[0].along,undefined);eq(rings[0].enter,'none');}}}
 }
 for(const edge of g.segments){const mark=e.find(p=>p.id===`review-segment-${edge.to}`);eq([mark.x1,mark.y1],g.points[edge.from].point);eq([mark.x2,mark.y2],g.points[edge.to].point);if(reveal&&view==='trail'){eq(mark.drawEase,'linear');near(mark.dur,12*(ordinal(edge.toDate)-ordinal(edge.fromDate))/total);}}
 for(const q of g.labels){const [x,y,bw,bh]=q.box,clear=w*.006*1.6+4,box=[x-clear,y-clear,x+bw+clear,y+bh+clear];copyZones++;for(const p of g.points.filter(p=>p.valid))ok(!blocked(p.point,p.point,box),'copy covers data point');for(const p of g.segments)ok(!blocked(p.p1,p.p2,box),'copy intersects guide');const [rx,ry]=g.reference;ok(x>=('NW SW'.includes(q.quadrant)?l:rx)&&x+bw<=('NW SW'.includes(q.quadrant)?rx:r));ok(y>=('NW NE'.includes(q.quadrant)?t:ry)&&y+bh<=('NW NE'.includes(q.quadrant)?ry:b));}
 if(view==='focus'){const selected=e.find(p=>p.id==='review-selected'),valid=focus.x!==null&&focus.y!==null;eq(!!selected,valid);if(valid){eq([selected.cx,selected.cy],g.points[d.points.findIndex(p=>p.date===focus.date)].point);eq(selected.fill,'none');}else ok(e.find(p=>p.id==='review-focus-state').text.includes('Incomplete'));}
}
const negatives=[
 ['sparse points',d=>delete d.points[1]],['duplicate dates',d=>d.points[1].date=d.points[0].date],['reverse dates',d=>d.points.reverse()],['future row',d=>d.asOf='2026-01-01'],['invalid date',d=>d.points[0].date='2026-02-30'],['timestamp instead of day',d=>d.points[0].date+='T00:00:00Z'],['nonleap date',d=>d.points[0].date='1900-02-29'],['omitted coordinate',d=>delete d.points[0].x],['undefined coordinate',d=>d.points[0].y=undefined],['numeric string',d=>d.points[0].x='1'],['NaN coordinate',d=>d.points[0].x=NaN],['infinite coordinate',d=>d.points[0].x=Infinity],['out of bounds',d=>d.points[0].x=4.0000001],['invented point field',d=>d.points[0].interpolated=true],['all incomplete',d=>d.points.forEach(p=>p.x=null)],['one row',d=>d.points=d.points.slice(0,1)],['missing focus',d=>d.focusDate='2026-02-01'],['smoothing',d=>d.smoothing='linear'],['smoothing omitted',d=>delete d.smoothing],['empty title',d=>d.title=' '],['extra field',d=>d.extra=1],['reference at edge',d=>d.x.reference=-4],['reference absent from ticks',d=>d.x.reference=1],['sparse domain',d=>delete d.x.domain[0]],['equal domain',d=>d.x.domain=[4,4]],['reversed domain',d=>d.y.domain=[20,-20]],['tick duplicates',d=>d.x.ticks=[-4,0,0,4]],['tick omitted endpoint',d=>d.x.ticks=[-3,0,4]],['sparse ticks',d=>delete d.x.ticks[1]],['rounded tick',d=>d.x.ticks=[-4,0,.1,4]],['negative precision',d=>d.x.decimals=-1],['fractional precision',d=>d.x.decimals=.5],['excess precision',d=>d.x.decimals=7],['extra quadrant',d=>d.quadrants.E='East'],['identical quadrant',d=>d.quadrants.NE=d.quadrants.NW],['whitespace-equivalent quadrant',d=>d.quadrants.NE=' '+d.quadrants.NW+' '],['empty definition',d=>d.x.definition=''],['huge domain',d=>d.x.domain=[-1e10,1e10]]
];
for(const [label,mutate]of negatives){const d=structuredClone(cases[0]);mutate(d);assert.throws(()=>phaseTrail(d),undefined,label);negativeCases++;}
for(const options of [{width:400,height:1080,id:'bad'},{width:1920,height:1080,id:'Bad'},{width:1920,height:1080,id:'bad',view:'smooth'},{width:1920,height:1080,id:'bad',reveal:'yes'}]){assert.throws(()=>phaseScene(cases[0],options));negativeCases++;}
for(const [label,change,errorPattern]of [
 ['long x labels',d=>{d.x={...d.x,domain:[999999999.99999,1000000000],ticks:[999999999.99999,999999999.999992,999999999.999994,999999999.999996,999999999.999998,1000000000],reference:999999999.999994,decimals:6};d.points.forEach(p=>p.x=d.x.reference);}],
 ['long y labels',d=>{d.y={...d.y,domain:[999999999.99999,1000000000],ticks:[999999999.99999,999999999.999994,1000000000],reference:999999999.999994,decimals:6};d.points.forEach(p=>p.y=d.y.reference);}],
 ['excess picture density',d=>{d.points=Array.from({length:25},(_,i)=>({date:`2026-01-${String(i+1).padStart(2,'0')}`,x:0,y:0}));d.focusDate=d.points[0].date;}],
 ['clustered dates',d=>{d.points=[{date:'2020-01-01',x:0,y:0},{date:'2020-01-02',x:0,y:0},{date:'2026-09-30',x:0,y:0}];d.focusDate=d.points[1].date;},/dated strip marks overlap/],
 ['three copy rows',d=>d.quadrants.NE='one/two/three'],
 ['empty copy row',d=>d.quadrants.NE='one/'],
 ['narrow quadrant',d=>{d.x.reference=3;d.x.ticks=[-4,0,3,4];}]
]){const d=structuredClone(cases[0]);change(d);assert.throws(()=>phaseScene(d,{width:1920,height:1080,id:'reject'}),errorPattern,label);negativeCases++;}
eq(phaseValue(-.004,2),'≈0.00');eq(phaseValue(1.25,2),'1.25');eq(phaseValue(null,2),'missing');
const bindings=Object.fromEntries(['fframes/phase-data.mjs','fframes/phases.mjs',kit+'/inputs.json',kit+'/evidence/independent-review/contract-check.mjs'].map(f=>[f,sha(f)]));
fs.writeFileSync(path.join(output,'contract-check.json'),JSON.stringify({passed:true,modelCases,sceneCases,assertions,negativeCases,copyZones,method:'Independent Gregorian ordinal, exact-reference truth table, exhaustive missing-row masks, inverse mapping equations and orientation-based polygon intersections. No render or full suite.',bindings},null,2)+'\n');
console.log(JSON.stringify({passed:true,modelCases,sceneCases,assertions,negativeCases,copyZones}));
