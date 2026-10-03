// Fixed quantitative geometry. Only opacity changes during the data entrances.
const check=(v,msg)=>{if(!v)throw Error(`participation scene: ${msg}`)};
export const fmt=v=>Number(v.toFixed(2)).toLocaleString('en-US',{maximumFractionDigits:2});
export const signed=v=>`${v>0?'+':v<0?'−':''}${fmt(Math.abs(v))}`;
export const colors={meets:'#315cce',other:'#c2641f',missing:'#796499'};
export function frame(preset){check(['landscape','vertical'].includes(preset),'unsupported format');const [w,h]=preset==='landscape'?[1920,1080]:[1080,1920];return{w,h,tall:h>w,margin:w*(h>w?.105:.065),size:w*.030};}
export const text=(id,value,x,y,size,extra={})=>({id,type:'text',text:String(value),x,y,size,font:'text',fill:'ink',at:0,enter:'none',...extra});
export const line=(id,x1,y1,x2,y2,extra={})=>({id,type:'line',x1,y1,x2,y2,stroke:'line',width:1,at:0,enter:'none',...extra});
export function scene(id,title,elements,source,F,duration){return{id,block:'canvas',duration,camera:'none',exit:'none',props:{view:[0,0,F.w,F.h],source,sourceSize:F.size,elements:[text(`${id}-title`,title,F.margin,F.h*.14,F.w*.041,{font:'display',fit:F.w-2*F.margin}),...elements.map(e=>({...e,id:`${id}-${e.id}`}))]}};}
const condition=c=>`${c.metricUnit} ${{gt:'>',gte:'≥',lt:'<',lte:'≤'}[c.condition.operator]} ${fmt(c.condition.threshold)}`;
export function participation(c,r,F){
 check(r.totalCount===12,'this composition supports twelve member tiles');
 const conditionText=`Condition: ${condition(c)}`,meet=r.groups.find(g=>g.state==='meets'),cols=F.tall?4:6;
 const tile=F.tall?F.w*.15:F.h*.12,gap=F.w*.025,rows=r.totalCount/cols;
 const x0=(F.w-cols*tile-(cols-1)*gap)/2,y0=F.h*(F.tall?.35:.37);
 const e=[text('condition',conditionText,F.margin,F.h*.235,F.size,{fit:F.w-2*F.margin}),
   text('summary',`${meet.count} of ${r.totalCount} members meet the condition`,F.margin,F.h*.31,F.size*1.15,{fit:F.w-2*F.margin,font:'figures',at:2.1,enter:'fade',dur:.25})];
 for(const [i,p]of r.members.entries()){
  const x=x0+(i%cols)*(tile+gap),y=y0+Math.floor(i/cols)*(tile+gap),phase={at:.5+i*.10,enter:'fade',dur:.25};
  e.push({id:`tile-${p.id}`,type:'rect',x,y,w:tile,h:tile,fill:colors[p.state],...phase},
    text(`member-${p.id}`,p.label,x+tile/2,y+tile/2+F.size*.32,F.size*1.15,{anchor:'middle',font:'figures',fill:'#ffffff',...phase}));
 }
 check(y0+rows*tile+(rows-1)*gap<F.h*.73,'tile field exceeds reserved region');
 r.groups.forEach((g,i)=>{
  const col=(F.w-2*F.margin)/3,x=F.margin+i*col;
  e.push(text(`key-${g.state}`,`${{meets:'Meets',other:'Other',missing:'Missing'}[g.state]}: ${g.count}`,x,F.h*(F.tall?.765:.73),F.size,{fill:colors[g.state],fit:col-F.size*.4,font:'semibold',at:2.1,enter:'fade',dur:.25}));
 });
 const count=scene(`${c.id}-count`,c.title,e,`Fictional. Membership ${c.membershipDate}; metric ${c.metricAsOf}. Equal tiles count members. Missing stays in the denominator.`,F,10);
 const left=F.margin,right=F.w-F.margin,span=right-left,barY=F.h*.43,barH=F.w*.065;
 const w=[text('condition',conditionText,F.margin,F.h*.235,F.size,{fit:span}),
   text('summary',`${fmt(meet.countFraction*100)}% by count; ${fmt(meet.weightFraction*100)}% by weight`,F.margin,F.h*.325,F.size*1.12,{font:'figures',fit:span,at:.95,enter:'fade',dur:.25})];
 let cursor=0;
 for(const g of r.groups){
  if(g.weight>0)w.push({id:`weight-${g.state}`,type:'rect',x:left+span*cursor,y:barY,w:span*g.weightFraction,h:barH,fill:colors[g.state],at:.5,enter:'fade',dur:.3});
  cursor+=g.weightFraction;
 }
 r.groups.forEach((g,i)=>{
  const y=F.h*(.61+i*.065);
  w.push(text(`label-${g.state}`,`${{meets:'Meets condition',other:'Other observed',missing:'Missing metric'}[g.state]}`,F.margin,y,F.size,{fill:colors[g.state],fit:span*.58}),
    text(`share-${g.state}`,`${fmt(g.weight)} / ${fmt(r.totalWeight)} = ${fmt(g.weightFraction*100)}%`,right,y,F.size,{anchor:'end',font:'figures',fit:span*.42,at:.95,enter:'fade',dur:.25}));
 });
 const weighted=scene(`${c.id}-weight`,'Same members, a different denominator',w,`Fictional. ${c.weightUnit}; total ${fmt(r.totalWeight)}. Membership ${c.membershipDate}. Missing weight is retained; no renormalization.`,F,12);
 return[count,weighted];
}
export function branches(c,r,F){
 check(r.items.length===4,'this composition supports four items');
 const width=F.w-2*F.margin;
 const raw=[text('basis',`${c.metricUnit} · benchmark ${fmt(c.benchmark)}%`,F.margin,F.h*.235,F.size,{fit:width}),
  text('size-unit',`Size: ${c.sizeUnit}`,F.margin,F.h*.31,F.size,{fit:width})];
 r.items.forEach((p,i)=>raw.push(text(`input-${p.id}`,`${p.label}: ${p.value===null?'missing':fmt(p.value)+'%'} · ${fmt(p.size)} ${c.sizeSuffix}`,F.margin,F.h*(.41+i*.09),F.size,{fit:width,at:.5+i*.35,enter:'fade',dur:.25})));
 const inputs=scene(`${c.id}-inputs`,'Read the metric and the separate size',raw,`Fictional. ${c.period}. ${c.basis}`,F,10);
 const left=F.w*.37,right=F.w*.73,top=F.h*(F.tall?.37:.40),bottom=F.h*(F.tall?.73:.67),radius=F.w*.025,span=right-left;
 check(c.domain[0]<0&&c.domain[1]>0,'a signed shared domain is required');
 const px=v=>left+(v-c.domain[0])/(c.domain[1]-c.domain[0])*span,zero=px(0);
 const e=[text('unit',`${c.relativeUnit} (${fmt(c.benchmark)}%)`,F.margin,F.h*(F.tall?.235:.215),F.size,{fit:width}),
   text('area',`Circle area: ${c.sizeUnit}`,F.margin,F.h*(F.tall?.30:.285),F.size,{fit:width})];
 c.ticks.forEach((v,i)=>e.push(line(`tick-${i}`,px(v),top-F.size*.3,px(v),bottom+radius*1.25,{stroke:v===0?'muted':'line',width:v===0?2:1}),text(`tick-label-${i}`,signed(v),px(v),top-F.size*.7,F.size*.94,{anchor:'middle',font:'figures'})));
 r.items.forEach((p,i)=>{
  const y=top+i*(bottom-top)/(r.items.length-1),phase={at:.5+i*.5,enter:'fade',dur:.3};
  e.push(text(`label-${p.id}`,`${p.label} · ${p.difference===null?'missing':signed(p.difference)+' pp'}`,F.margin,y+F.size*.3,F.size,{font:'semibold',fit:left-F.margin-radius-F.size*.2,...phase}),
    text(`size-${p.id}`,`${fmt(p.size)} ${c.sizeSuffix}`,F.w-F.margin,y+F.size*.3,F.size,{anchor:'end',font:'figures',fit:F.w-F.margin-right-radius-F.size*.2,...phase}));
  if(p.difference===null)return;
  check(p.difference>=c.domain[0]&&p.difference<=c.domain[1],'endpoint outside declared domain');
  check(p.size>=0&&p.size<=c.maxSize,'size outside area scale');
  const x=px(p.difference),color=p.difference<0?colors.other:p.difference>0?colors.meets:'ink';
  if(p.difference!==0)e.push(line(`stem-${p.id}`,zero,y,x,y,{stroke:color,width:2,...phase}));
  if(p.size>0){const rr=radius*Math.sqrt(p.size/c.maxSize);e.push({id:`bubble-${p.id}`,type:'circle',cx:x,cy:y,r:rr,fill:color,...phase});}
  else{
   const cross=F.size*.13;
   e.push(line(`zero-a-${p.id}`,x-cross,y-cross,x+cross,y+cross,{stroke:'ink',width:2,...phase}),line(`zero-b-${p.id}`,x-cross,y+cross,x+cross,y-cross,{stroke:'ink',width:2,...phase}));
  }
 });
 return[inputs,scene(c.id,c.title,e,`Fictional. ${c.period}. Difference = metric − benchmark; not a ratio. × marks zero size. Missing metric has no endpoint.`,F,14)];
}
