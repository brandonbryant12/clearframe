// Explicit scales -> existing native geometry. Data never passes through a raster illustration.
import { plotSpec, axisPosition, axisLabel } from './plot-data.mjs';
const check = (ok, message) => { if (!ok) throw new Error(`plot: ${message}`); };
const show = { at: 0, enter: 'none' };
const line = (id, x1, y1, x2, y2, extra = {}) => ({ id, type: 'line', x1, y1, x2, y2, stroke: 'muted', width: 2, ...show, ...extra });
const text = (id, value, x, y, size, extra = {}) => ({ id, type: 'text', text: value, x, y, size, fill: 'ink', font: 'text', ...show, ...extra });
const colors = ['accent', 'accent2', 'ink', 'muted'];

export function plotLayout({ width, height }) {
  check(Number.isFinite(width) && Number.isFinite(height) && width >= 640 && height >= 640, 'frame must be at least 640×640');
  const u = Math.min(width, height), tall = width <= height * 1.1;
  const margin=width*(height>width?.105:.055), type=width*.030;
  return { u, tall, margin, type, left:margin+width*.11, right:width-margin-width*.025,
    top:height*(tall?.41:.38), bottom:height*(tall?.70:.59) };
}

export function plotElements(p, frame) {
  const { width, height } = frame, L = plotLayout(frame), { u, tall, left, right, top, bottom } = L;
  const px = x => left + axisPosition(x, p.x) * (right-left);
  const py = y => bottom - axisPosition(y, p.y) * (bottom-top);
  const time = x => p.motion === 'none' ? 0 : p.motion.at + p.motion.duration * axisPosition(x, p.x);
  const end = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration;
  const arrive = at => at === 0 ? show : { at, enter: 'fade', dur: 0.15 };
  const final = arrive(end);
  const font=L.type, contentWidth=width-2*L.margin;
  const elements = [
    text('plot-title', p.title, L.margin, height*.14, width*.041,
      { width:contentWidth, height:height*.11, font:'display' }),
    text('plot-unit', p.y.label + (p.y.type==='log'?' · log scale':''), left,top-font*.75,font,
      {fit:right-left}),
    text('plot-x-label',p.x.label,(left+right)/2,bottom+font*2.5,font,
      {anchor:'middle',fit:right-left}),
  ];
  const keyRows=Math.ceil(p.series.length/2), keyTop=height*.19;
  const keyStep=(top-font*2-keyTop)/keyRows;
  for(const [i,s] of p.series.entries()) {
    const x=L.margin+(i%2)*contentWidth/2, y=keyTop+Math.floor(i/2)*keyStep;
    const column=contentWidth/2-width*.025;
    elements.push(line(`plot-${s.id}-key`,x,y-font*.3,x+font*.65,y-font*.3,{stroke:colors[i],width:font*.12}),
      text(`plot-${s.id}-label`,s.label,x+font*.85,y,font,
        {width:column-font*4.8,height:Math.max(font*2.4,keyStep-font*.2),font:'semibold',fill:colors[i]}));
    const terminal=s.values.findLast(v=>v.y!==null);
    elements.push(text(`plot-${s.id}-value`,axisLabel(terminal.y,p.y),x+column,y,font*1.05,
      {anchor:'end',font:'figures',fill:colors[i],fit:font*3.6,...final}));
  }
  for (const [i, y] of p.y.ticks.entries()) {
    elements.push(line(`plot-y-grid-${i}`,left,py(y),right,py(y),{stroke: y === 0 ? 'muted' : 'line', width:y===0?2:1}),
      text(`plot-y-tick-${i}`,axisLabel(y,p.y),left-u*.018,py(y)+font*.3,font,{anchor:'end',font:'figures',fit:left-L.margin-font*.2}));
  }
  for (const [i,x] of p.x.ticks.entries()) {
    elements.push(line(`plot-x-tick-${i}`,px(x),bottom,px(x),bottom+u*.014),
      text(`plot-x-value-${i}`,axisLabel(x,p.x),px(x),bottom+font*1.3,font,{anchor:i===0?'start':i===p.x.ticks.length-1?'end':'middle',font:'figures',fit:(right-left)/(p.x.ticks.length-1)*.93}));
  }
  for (const [seriesIndex,s] of p.series.entries()) {
    const color=colors[seriesIndex];
    let last=null;
    for (const [i,v] of s.values.entries()) {
      if (v.y === null) { last=null; continue; }
      const x=px(v.x), y=py(v.y), at=time(v.x);
      if (last) {
        const start=time(last.x), duration=at-start;
        elements.push(line(`plot-${s.id}-segment-${i}`,px(last.x),py(last.y),x,y,
          {stroke:color,width:u*.004,...(p.motion==='none'?show:{at:start,dur:duration,enter:'draw',drawEase:'linear'})}));
      }
      // Dots mark observations, including isolated observations on either side of a gap.
      elements.push({id:`plot-${s.id}-point-${i}`,type:'circle',cx:x,cy:y,r:u*.0045,fill:color,...(p.motion==='none'?show:{at,enter:'none'})});
      last=v;
    }
  }
  if (p.annotation) {
    const a=p.annotation, point=p.series.find(s=>s.id===a.seriesId).values.find(v=>v.x===a.x);
    const x=px(point.x),y=py(point.y), tx=x+a.dx*(right-left),ty=y+a.dy*(bottom-top);
    check(tx>=left && tx<=right && ty>=top && ty<=bottom, 'annotation offsets must keep the label anchor inside the plot');
    const anchor=a.dx<0?'end':'start', fit=a.dx<0?tx-left:right-tx;
    check(fit>=u*.14,'annotation needs a wider clear text region');
    elements.push(line('plot-annotation-leader',x,y,tx,ty+u*.014,{stroke:'ink',width:2,...final}),
      {id:'plot-annotation-point',type:'circle',cx:x,cy:y,r:u*.009,fill:'none',stroke:'ink',width:2,...final},
      text('plot-annotation-text',a.label,tx,ty,font,{anchor,fit,font:'semibold',...final}));
  }
  return elements;
}

export function expandPlotProps(input, frame) {
  if (input?.plot == null) return input;
  const { plot, ...rest } = structuredClone(input);
  for (const key of ['kpi','teaching','chart','sketch','plates','world','dolly','focus','view','viewFrom','viewTall','viewDrift','title'])
    check(rest[key] == null, `cannot combine plot with ${key}`);
  const p=plotSpec(plot,rest.source);
  const end=p.motion==='none'?0:p.motion.at+p.motion.duration;
  if (frame.duration!=null) check(frame.duration>=end+2.15,'beat needs two seconds after the final plot labels settle');
  const elements=plotElements(p,frame);
  if (frame.beatId) for (const el of elements) if(el.id)el.id=`${frame.beatId}-${el.id}`;
  const missing=[...new Set(p.series.flatMap(s=>s.values.filter(v=>v.y===null).map(v=>v.x)))];
  const early=p.series.some(s=>s.values.findLast(v=>v.y!==null).x!==p.x.domain[1]);
  const note=[missing.length?`Gap: ${missing.slice(0,2).join(', ')}${missing.length>2?'…':''}.`:'',early?'Values: last observation.':''].filter(Boolean).join(' ');
  return {...rest,sourceSize:frame.width*.030,source:`${p.source} ${note} · ${p.asOf}`,view:[0,0,frame.width,frame.height],elements:[...elements,...(rest.elements??[])]};
}
