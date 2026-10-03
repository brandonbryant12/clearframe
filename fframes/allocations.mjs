import {allocationPlan,allocationClock,allocationAmount} from './allocation-data.mjs';
const check=(ok,m)=>{if(!ok)throw Error(`allocation scene: ${m}`);};
const show={at:0,enter:'none'};
const text=(id,value,x,y,size,extra={})=>({id,type:'text',text:String(value),x,y,size,fill:'ink',font:'text',...show,...extra});
const rect=(id,x,y,w,h,extra={})=>({id,type:'rect',x,y,w,h,r:0,fill:'accent',...show,...extra});
// Axis-aligned token routes. Moving bounding boxes must clear all stationary
// tokens throughout each leg, not merely at sampled frames.
function hits(a,b,p,size,pad=2){
 const lo=[p[0]-size-pad,p[1]-size-pad],hi=[p[0]+size+pad,p[1]+size+pad];
 if(a[0]===b[0])return a[0]>lo[0]&&a[0]<hi[0]&&Math.max(a[1],b[1])>lo[1]&&Math.min(a[1],b[1])<hi[1];
 check(a[1]===b[1],'routes must have orthogonal legs');
 return a[1]>lo[1]&&a[1]<hi[1]&&Math.max(a[0],b[0])>lo[0]&&Math.min(a[0],b[0])<hi[0];
}
export function allocationLayout(model,clock,w,h){
 check(Number.isFinite(w)&&Number.isFinite(h)&&w>=960&&h>=960&&w<=4096&&h<=4096,'frame dimensions must be 960–4096');
 check(model.buckets.length<=3&&model.total<=36&&model.events.length<=8,'native trays support 2–3 buckets, up to 36 tokens and 8 individual moves');
 const tall=h>w,n=model.buckets.length,font=w*(tall?.032:.021),small=w*(tall?.030:.0185),size=w*(tall?.042:.024),gap=size*.32,columns=6,cards=[];
 for(let i=0;i<n;i++){
  const x=tall?w*.115:w*.09+i*(w*.82/n+w*.035/n),y=tall?h*.29+i*h*.48/n:h*.30;
  const width=tall?w*.65:(w*.82-w*.035*(n-1))/n,height=tall?h*.48/n-h*.045:h*.37;
  const gridWidth=columns*size+(columns-1)*gap,gridX=x+(width-gridWidth)/2,gridY=y+font*3.1;
  check(gridX>=x+12,'tray columns do not fit');
  const rows=Math.ceil(model.capacity[i]/columns);check(gridY+Math.max(0,rows*size+(rows-1)*gap)<=y+height-8,'tray capacity does not fit this format');
  check(model.buckets[i].label.length*font*.62<width-24,'tray label too long');
  const maxText=`${model.capacity[i]} tiles · ${allocationAmount(model.capacity[i]*model.quantum.minorUnits,model.quantum)}`;
  check(maxText.length*small*.60<width-24,'tray amount label too long; change the declared unit or layout');
  cards.push({id:model.buckets[i].id,index:i,x,y,width,height,gridX,gridY,columns,corridorY:tall?y+height+h*.0225-size/2:h*.725-size/2});
 }
 const cardById=new Map(cards.map(c=>[c.id,c])),slot=(bucket,index)=>{const c=cardById.get(bucket);return[c.gridX+(index%columns)*(size+gap),c.gridY+Math.floor(index/columns)*(size+gap)];};
 const tracks=model.tokens.map(t=>({id:t.id,initial:slot(t.initialBucket,t.initialSlot),keys:[]})),trackById=new Map(tracks.map(t=>[t.id,t])),positions=new Map(tracks.map(t=>[t.id,[...t.initial]])),routes=[];
 for(const e of clock.events){
  const from=slot(e.from,e.fromSlot),to=slot(e.to,e.toSlot),a=cardById.get(e.from),b=cardById.get(e.to),raw=tall?[from,[from[0],a.corridorY],[w*.865-size/2,a.corridorY],[w*.865-size/2,b.corridorY],[to[0],b.corridorY],to]:[from,[from[0],a.corridorY],[to[0],b.corridorY],to];
  const points=raw.filter((p,i)=>!i||p.some((v,k)=>v!==raw[i-1][k])),lengths=points.slice(1).map((p,i)=>Math.abs(p[0]-points[i][0])+Math.abs(p[1]-points[i][1])),length=lengths.reduce((s,v)=>s+v,0);
  check(positions.get(e.token).every((v,k)=>v===from[k]),'token source slot mismatch');
  for(const p of points)check(p[0]>=w*.08&&p[0]+size<=w*.92&&p[1]>=h*.28&&p[1]+size<=h*.80,'token route leaves reserved bounds');
  for(const [id,p]of positions)if(id!==e.token)for(let i=1;i<points.length;i++)check(!hits(points[i-1],points[i],p,size),`route overlaps stationary token ${id}`);
  const track=trackById.get(e.token),legs=[];let elapsed=0;
  for(let i=1;i<points.length;i++){
   const duration=(e.end-e.start)*lengths[i-1]/length,start=e.start+elapsed;
   track.keys.push({at:start,dur:duration,ease:'linear',x:points[i][0]-track.initial[0],y:points[i][1]-track.initial[1]});legs.push({from:points[i-1],to:points[i],start,end:start+duration});elapsed+=duration;
  }
  positions.set(e.token,[...to]);routes.push({...e,points,legs});
 }
 return {width:w,height:h,tall,font,small,size,cards,tracks,routes,finalPositions:Object.fromEntries(positions),tokenMeaning:`1 tile = ${allocationAmount(model.quantum.minorUnits,model.quantum)}`};
}
export function allocationScene(input,{width:w,height:h,id,view='trays',timing}={}){
 check(typeof id==='string'&&/^[a-z][a-z0-9-]*$/.test(id),'scene id required');check(['trays','comparison'].includes(view),'view must be trays or comparison');
 const model=allocationPlan(input),clock=allocationClock(model,timing),geometry=allocationLayout(model,clock,w,h),{tall,font,small,size}=geometry,margin=w*(tall?.105:.09),sourceId=id+'-source',elements=[];
 const span=w-2*margin;
 elements.push(text(id+'-title',model.title,margin,h*.12,w*(tall?.047:.032),{font:'display',width:span,height:h*.075}),text(id+'-unit',`${geometry.tokenMeaning} · total ${allocationAmount(model.totalMinorUnits,model.quantum)}`,margin,h*(tall?.205:.19),font,{font:'figures',fit:span}),text(id+'-period',`${model.period} · fixed total; no inflows or losses`,margin,h*(tall?.25:.245),small,{fit:span}));
 if(view==='trays'){
  for(const c of geometry.cards)elements.push(rect(`${id}-tray-${c.id}`,c.x,c.y,c.width,c.height,{fill:'none',stroke:'line',width:2}),text(`${id}-label-${c.id}`,model.buckets[c.index].label,c.x+c.width/2,c.y+font*1.05,font,{anchor:'middle',fit:c.width-24}));
  const states=[{at:0,counts:model.before.map(b=>b.count),inTransit:0},...clock.events.flatMap(e=>[{at:e.start,counts:e.inTransit,inTransit:1},{at:e.end,counts:e.after,inTransit:0}])];
  for(const [i,s]of states.entries()){
   const timing={at:s.at,...(i<states.length-1?{exit:'none',exitAt:states[i+1].at}:{})};
   for(const c of geometry.cards)elements.push(text(`${id}-amount-${i}-${c.id}`,`${s.counts[c.index]} tiles · ${allocationAmount(s.counts[c.index]*model.quantum.minorUnits,model.quantum)}`,c.x+c.width/2,c.y+font*2.18,small,{anchor:'middle',font:'figures',fit:c.width-24,...timing}));
   elements.push(text(`${id}-conservation-${i}`,`${model.total-s.inTransit} parked + ${s.inTransit} in transit = ${model.total} tiles`,margin,h*(tall?.865:.885),small,{font:'figures',fit:span,...timing}));
  }
  const groups=clock.events.filter((e,i)=>!i||e.groupIndex!==clock.events[i-1].groupIndex);
  elements.push(text(id+'-initial','Before · every tile has one home',margin,h*(tall?.815:.82),font,{fit:span,...(groups.length?{exit:'none',exitAt:groups[0].start}:{})}));
  for(const [i,g]of groups.entries()){
   const from=model.buckets.find(b=>b.id===g.from).label,to=model.buckets.find(b=>b.id===g.to).label,count=clock.events.filter(e=>e.groupIndex===g.groupIndex).length,end=groups[i+1]?.start??clock.events.at(-1).end;
   elements.push(text(`${id}-move-${i}`,`Move ${count} tiles: ${from} → ${to}`,margin,h*(tall?.815:.82),font,{fit:span,at:g.start,exit:'none',exitAt:end}));
  }
  if(clock.events.length)elements.push(text(id+'-finished','After · all transfers complete',margin,h*(tall?.815:.82),font,{fit:span,at:clock.events.at(-1).end}));
  for(const t of geometry.tracks)elements.push(rect(`${id}-token-${t.id}`,...t.initial,size,size,{stroke:'ink',width:1,keys:t.keys}));
 }else{
  const left=margin,right=w*.82,barWidth=right-left,barHeight=h*(tall?.021:.032),start=h*(tall?.32:.33),stride=h*(tall?.165:.18),labels=[],ticks=[0,Math.floor(model.total/2),model.total];
  for(const [i,b]of model.before.entries()){
   const a=model.after[i],y=start+i*stride;
   elements.push(text(`${id}-name-${i}`,`${b.label} · ${b.count} → ${a.count} tiles`,left,y,font,{fit:span}));
   for(const [j,v]of ticks.entries()){const x=left+barWidth*v/model.total;elements.push({id:`${id}-grid-${i}-${j}`,type:'line',x1:x,y1:y+font*.40,x2:x,y2:y+font*.50+barHeight*2+12,stroke:'line',width:v===0?2:1,...show});}
   if(b.count)elements.push(rect(`${id}-before-${i}`,left,y+font*.50,barWidth*b.count/model.total,barHeight,{fill:'muted'}));
   if(a.count)elements.push(rect(`${id}-after-${i}`,left,y+font*.50+barHeight+8,barWidth*a.count/model.total,barHeight));
   const tx=left+barWidth*a.count/model.total+small*.35,ty=y+font*.50+barHeight*1.85+8;
   elements.push(text(`${id}-share-${i}`,a.shareLabel,tx,ty,small,{font:'figures'}));
   labels.push({id:b.id,y,beforeWidth:barWidth*b.count/model.total,afterWidth:barWidth*a.count/model.total,share:a.shareLabel});
  }
  const tickY=start+(model.buckets.length-1)*stride+font*.5+barHeight*2+small*1.45+8;
  for(const [i,v]of ticks.entries())elements.push(text(`${id}-tick-${i}`,`${v}${i===ticks.length-1?' tiles':''}`,left+barWidth*v/model.total,tickY,small,{font:'figures',anchor:i===0?'start':i===ticks.length-1?'end':'middle'}));
  const legendY=h*(tall?.285:.29);
  elements.push(rect(id+'-before-key',margin,legendY-small*.8,small*.6,small*.6,{fill:'muted'}),text(id+'-before-legend','Before',margin+small*.9,legendY,small),rect(id+'-after-key',margin+small*5,legendY-small*.8,small*.6,small*.6),text(id+'-after-legend','After',margin+small*5.9,legendY,small));
  elements.push(text(id+'-qualification',model.qualification,margin,h*(tall?.865:.885),small,{width:span,height:h*.04}));
  Object.assign(geometry,{comparison:{left,right,barWidth,barHeight,labels,ticks,tickY,scale:[0,model.total],meaning:'Bar length encodes token count on the same zero-based total scale; colored keys label before and after, not performance.'}});
 }
 elements.push(text(sourceId,`${model.source} · as of ${model.asOf}`,margin,h*(tall?.925:.935),Math.max(28,small),{width:span,height:h*.04}));
 return {model,clock,geometry,duration:view==='trays'?clock.duration:24,props:{view:[0,0,w,h],sourceElement:sourceId,elements}};
}
