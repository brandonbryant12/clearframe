import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const root=new URL('../examples/library-kits/research-study/',import.meta.url);
const input=JSON.parse(fs.readFileSync(new URL('source/inputs.json',root)));
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('research styling preserves date/value positions, linear reveals and exactly bounded shaded window',()=>{
 for(const preset of ['landscape','vertical'])for(const name of ['comparison','interval']){
  const d=input[name],sb=JSON.parse(fs.readFileSync(new URL(`${name}-${preset}/storyboard.json`,root))),els=sb.beats[0].props.elements;
  const grids=els.filter(e=>e.id.includes('-plot-y-grid-')),left=grids[0].x1,right=grids[0].x2,top=grids.at(-1).y1,bottom=grids[0].y1;
  const fraction=x=>(Date.parse(x)-Date.parse(d.dates[0]))/(Date.parse(d.dates.at(-1))-Date.parse(d.dates[0]));
  for(const s of d.series)for(const [i,y] of s.values.entries()){
   const mark=els.find(e=>e.id===`${name}-plot-${s.id}-point-${i}`);
   near(mark.cx,left+fraction(d.dates[i])*(right-left));near(mark.cy,bottom-(y-d.yDomain[0])/(d.yDomain[1]-d.yDomain[0])*(bottom-top));
   near(mark.at,.5+4*fraction(d.dates[i]));
  }
  if(name==='interval'){
   const shade=els.find(e=>e.id==='interval-window');near(shade.x,left+fraction('2026-07-01')*(right-left));near(shade.x+shade.w,right);near(shade.h,bottom-top);
   near(d.series[0].values.at(-1)/d.series[1].values.at(-1),.5);
  }
 }
});
