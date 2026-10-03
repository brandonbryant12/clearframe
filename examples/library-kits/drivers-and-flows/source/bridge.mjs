// Horizontal bridges preserve one scale and equal rectangle thickness in both formats.
// The rows are arithmetic ordering, not a reconstruction of transaction time.
const check=(ok,msg)=>{if(!ok)throw Error(`bridge: ${msg}`);};
export const text=(id,value,x,y,size,extra={})=>({id,type:'text',text:String(value),x,y,size,fill:'ink',font:'text',at:0,enter:'none',...extra});
const line=(id,x1,y1,x2,y2,extra={})=>({id,type:'line',x1,y1,x2,y2,stroke:'muted',width:2,at:0,enter:'none',...extra});
export function frame(preset){
  check(['landscape','vertical'].includes(preset),'only reviewed formats are supported');
  const [w,h]=preset==='landscape'?[1920,1080]:[1080,1920];return{w,h,tall:h>w,margin:w*(h>w?.105:.055),size:w*.030};
}
export function canvas(id,title,elements,source,F,duration=14){
  return{id,block:'canvas',duration,camera:'none',exit:'none',props:{view:[0,0,F.w,F.h],source,sourceSize:F.size,elements:[
    text(`${id}-title`,title,F.margin,F.h*.14,F.w*.041,{width:F.w-2*F.margin,height:F.h*.1,font:'display'}),
    ...elements.map(e=>({...e,id:`${id}-${e.id}`}))]}};
}
export function bridge({id,title,unit,opening,closing,parts,domain,ticks,source,valueLabel},F){
  check(domain.length===2&&domain[0]<=0&&domain[1]>=0&&domain[0]<domain[1],'domain must increase and include zero');
  check(parts.length<=6,'at most six contribution rows');
  check(ticks[0]===domain[0]&&ticks.at(-1)===domain[1]&&ticks.every((v,i)=>Number.isFinite(v)&&(!i||v>ticks[i-1])),'ticks need ordered domain endpoints');
  let running=opening;
  const rows=[{id:'opening',label:'Opening',from:0,to:opening,amount:opening,total:true},...parts.map(p=>{
    const from=running;running+=p.amount;return{...p,from,to:running};
  }),{id:'closing',label:'Closing',from:0,to:closing,amount:closing,total:true}];
  check(Math.abs(running-closing)<1e-9*Math.max(1,Math.abs(closing)),'contributions must reconcile to closing');
  const left=F.w*.37,right=F.w*.76,span=right-left,top=F.h*.34,bottom=F.h*.72;
  const step=(bottom-top)/(rows.length-1),barH=F.size*.55,px=v=>left+(v-domain[0])/(domain[1]-domain[0])*span;
  const e=[text('unit',unit,F.margin,F.h*.235,F.size,{fit:F.w-2*F.margin})],geometry=[];
  for(const [i,v]of ticks.entries()){
    e.push(line(`tick-${i}`,px(v),top-F.size*.3,px(v),bottom+barH*.75,{stroke:v===0?'muted':'line',width:v===0?2:1}),
      text(`tick-label-${i}`,v,px(v),top-F.size*.7,F.size*.94,{anchor:'middle',font:'figures'}));
  }
  rows.forEach((r,i)=>{
    check(Number.isFinite(r.from)&&Number.isFinite(r.to)&&Math.min(r.from,r.to)>=domain[0]&&Math.max(r.from,r.to)<=domain[1],`row ${r.id} exceeds the explicit domain`);
    const x=Math.min(px(r.from),px(r.to)),w=Math.abs(px(r.to)-px(r.from)),y=top+i*step,at=.4+i*.45;
    const phase={at,enter:'fade',dur:.25},color=r.total?'ink':r.kind==='residual'?'#796499':r.amount>=0?'accent':'accent2';
    if(w>0)e.push({id:`bar-${r.id}`,type:'rect',x,y:y-barH/2,w,h:barH,fill:color,...phase});
    e.push(text(`label-${r.id}`,r.label,F.margin,y+F.size*.3,F.size,{fit:left-F.margin-F.size*.5,font:'semibold',...phase}),
      text(`value-${r.id}`,valueLabel(r),F.w-F.margin,y+F.size*.3,F.size,{anchor:'end',fit:F.w-F.margin-right-F.size*.5,font:'figures',...phase}));
    // Connector joins the end of a contribution to the next arithmetic row.
    if(i<rows.length-2)e.push(line(`link-${r.id}`,px(r.to),y+barH/2,px(r.to),y+step-barH/2,{...phase,stroke:'muted',width:1}));
    geometry.push({beat:id,id:`bar-${r.id}`,row:r.id,from:r.from,to:r.to,amount:r.amount,total:!!r.total,domain,span,barH,at,duration:.25,color});
  });
  return{beat:canvas(id,title,e,source,F,14),geometry};
}
