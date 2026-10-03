// Original native compositions. Quantitative geometry is static at its exact value;
// only opacity/ordering changes. Native camera/perspective never changes its scale.
const ensure=(ok,message)=>{if(!ok)throw Error(`retirement marks: ${message}`);};
export const money=v=>`${v<0?'−':''}$${Math.abs(v).toLocaleString('en-US',{maximumFractionDigits:0})}`;
export const percent=v=>`${(100*v).toLocaleString('en-US',{maximumFractionDigits:2})}%`;
export const text=(id,value,x,y,size,extra={})=>({id,type:'text',text:String(value),x,y,size,fill:'ink',font:'text',at:0,enter:'none',...extra});
export const rect=(id,x,y,w,h,fill,extra={})=>({id,type:'rect',x,y,w,h,fill,at:0,enter:'none',...extra});
export const line=(id,x1,y1,x2,y2,extra={})=>({id,type:'line',x1,y1,x2,y2,stroke:'muted',width:2,at:0,enter:'none',...extra});
export function frame(preset) {
  const sizes={landscape:[1920,1080],vertical:[1080,1920],square:[1080,1080],portrait:[1080,1350]};
  ensure(sizes[preset],'unknown preset');
  const [w,h]=sizes[preset], tall=h>w, margin=w*(tall?.11:.06);
  return {w,h,tall,margin,size:w*.031,left:margin,right:w-margin,width:w-2*margin};
}
export function canvasBeat(id,title,elements,source,F,duration=9) {
  return {id,block:'canvas',duration,camera:'none',exit:'none',props:{
    source,sourceSize:F.size,view:[0,0,F.w,F.h],elements:[
      text(`${id}-title`,title,F.left,F.h*.14,F.w*.041,{width:F.width,height:F.h*.10,font:'display'}),
      ...elements.map(e=>({...e,id:`${id}-${e.id}`}))]}};
}
// Equal-width rectangular compartments: length AND area are proportional to amount.
export function stackedRows(rows,{domain,title,unit='USD',id,source},F) {
  ensure(domain>0 && Number.isFinite(domain),'positive shared domain required');
  ensure(rows.length>=1 && rows.length<=4,'one to four rows');
  const e=[],left=F.left+F.width*.04,right=F.right-F.width*.04,span=right-left;
  const top=F.h*.31,bottom=F.h*(F.tall?.73:.65),rowStep=(bottom-top)/rows.length;
  const barH=Math.min(F.size*1.4,rowStep*.28);
  const geometry=[];
  rows.forEach((row,i)=>{
    let offset=0;
    const y=top+i*rowStep, total=row.parts.reduce((s,p)=>s+p.value,0);
    ensure(total<=domain+1e-7,'stack exceeds explicit domain');
    e.push(text(`row-${i}-name`,row.label,left,y,F.size,{width:span*.71,height:F.size*2.2,font:'semibold'}),
      text(`row-${i}-total`,row.summary??money(total),right,y,F.size,{anchor:'end',font:'figures',fit:span*.29}));
    e.push(rect(`row-${i}-track`,left,y+F.size*.45,span,barH,'surface'));
    row.parts.forEach((part,j)=>{
      ensure(Number.isFinite(part.value)&&part.value>=0,'stack values must be finite and nonnegative');
      const x=left+span*offset/domain,w=span*part.value/domain;
      if(w>0)e.push(rect(`row-${i}-part-${j}`,x,y+F.size*.45,w,barH,part.color,
        {at:.45+i*.45,enter:'fade',dur:.25}));
      geometry.push({kind:'stack',id:`row-${i}-part-${j}`,value:part.value,domain,pixelLength:w,pixelArea:w*barH,span,barH});
      offset+=part.value;
    });
    if(row.detail)e.push(text(`row-${i}-detail`,row.detail,left,y+F.size*.45+barH+F.size*1.1,F.size*.91,
      {width:span,height:F.size*2.3}));
  });
  e.push(text('scale',`Shared scale: ${money(0)}–${money(domain)} ${unit}`,left,F.h*(F.tall?.79:.73),F.size,{fit:span}));
  return {beat:canvasBeat(id,title,e,source,F),geometry};
}
export function reservoir(row,{capacity,title,id,source,periodLabel='One period',showContributors=false},F) {
  ensure(capacity>0 && Math.max(row.opening,row.closing)<=capacity,'reservoir exceeds capacity');
  const boxW=F.width*.30,boxH=F.h*(F.tall?.28:.22),top=F.h*.32,bottom=top+boxH;
  const xs=[F.left+F.width*.05,F.right-F.width*.05-boxW], e=[],geometry=[];
  for(const [i,value] of [row.opening,row.closing].entries()){
    const h=boxH*value/capacity,x=xs[i];
    e.push(text(`tank-${i}-name`,i?'Closing balance':'Opening balance',x,top-F.size*.65,F.size,{fit:boxW}),
      rect(`tank-${i}-outline`,x,top,boxW,boxH,'none',{stroke:'muted',width:2}),
      ...(h>0?[rect(`tank-${i}-fill`,x,bottom-h,boxW,h,i?'accent2':'accent')]:[]),
      text(`tank-${i}-value`,money(value),x+boxW/2,bottom+F.size*1.2,F.size*1.2,{anchor:'middle',font:'figures',fit:boxW}));
    geometry.push({kind:'reservoir',id:`tank-${i}-fill`,value,capacity,pixelHeight:h,pixelArea:boxW*h,boxH,boxW});
  }
  if(showContributors)e.push(text('contributors',`Employee ${money(row.employee)} + employer ${money(row.employer)}`,F.left,F.h*.225,F.size,{fit:F.width}));
  const cx=F.w/2;
  e.push(line('flow',xs[0]+boxW+F.size*.3,top+boxH*.5,xs[1]-F.size*.3,top+boxH*.5,{stroke:'ink',width:3}),
    text('flow-label',periodLabel,cx,top+boxH*.5-F.size*.6,F.size,{anchor:'middle',fit:xs[1]-xs[0]-boxW}));
  const y=F.h*(F.tall?.72:.67);
  e.push(text('accounting',`${money(row.employee+row.employer)} added · ${money(row.gain)} gain/loss · ${money(row.fees)} fees`,F.left,y,F.size,
      {fit:F.width}),
    text('withdrawals',`${money(row.withdrawn)} paid · ${money(row.shortfall)} unfunded`,F.left,F.tall?y+F.size*2.2:F.h*.73,F.size,
      {fit:F.width,font:'semibold'}));
  const visibleSource=`${source} Capacity scale ${money(capacity)}.`;
  return {beat:canvasBeat(id,title,e,visibleSource,F,11),geometry};
}
export function waterfall(parts,{title,id,source,domain},F) {
  ensure(Array.isArray(domain)&&domain.length===2&&domain[0]<=0&&domain[1]>0,'signed explicit domain required');
  const [lo,hi]=domain, top=F.h*.32,bottom=F.h*.66,span=bottom-top;
  const py=v=>bottom-(v-lo)/(hi-lo)*span;
  const count=parts.length+1,step=F.width/count,barW=step*.48,e=[],geometry=[];
  e.push(line('zero',F.left,py(0),F.right,py(0),{stroke:'muted'}));
  let running=0;
  [...parts,{label:'Ending gap',total:true}].forEach((p,i)=>{
    const from=p.total?0:running,to=p.total?running:running+p.value;
    ensure(Math.min(from,to)>=lo-1e-7&&Math.max(from,to)<=hi+1e-7,'waterfall exceeds domain');
    const x=F.left+step*i+(step-barW)/2,y=Math.min(py(from),py(to)),h=Math.abs(py(from)-py(to));
    e.push(...(h>0?[rect(`driver-${i}`,x,y,barW,h,p.total?'ink':p.value>=0?'accent':'accent2',{at:.5+i*.4,enter:'fade',dur:.25})]:[]),
      text(`driver-${i}-value`,money(to-from),x+barW/2,y-F.size*.45,F.size,{anchor:'middle',font:'figures',fit:step*.93}),
      text(`driver-${i}-label`,p.label,x+barW/2,bottom+F.size*1.5,F.size,{anchor:'middle',width:step*.93,height:F.size*3}));
    geometry.push({kind:'waterfall',id:`driver-${i}`,from,to,domain:[lo,hi],pixelHeight:h,span,pixelArea:barW*h,barW});
    if(!p.total)running=to;
  });
  return {beat:canvasBeat(id,title,e,source,F,10),geometry};
}
