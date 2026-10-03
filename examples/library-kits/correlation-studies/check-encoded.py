"""Independent monthly pair arithmetic, native marks and bounded encoded probes.
Two FFmpeg workers, one 720px RGB frame in memory. Does not import JS helpers.
"""
import datetime,hashlib,json,math,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
INPUT=json.loads((ROOT/'inputs.json').read_text());AUDIT=json.loads((ROOT/'audit.json').read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text())
def day(s):return datetime.date.fromisoformat(s).toordinal()
def near(a,b):assert abs(a-b)<1e-7,(a,b)
def color(v):
 if v is None:return '#eeeeea'
 base=[247,247,242];end=[231,170,119] if v<0 else [135,176,213]
 return '#'+''.join(f'{math.floor(a+(b-a)*abs(v)+.5):02x}' for a,b in zip(base,end))
def label(v):
 if v is None:return '—'
 s=f'{v:+.2f}' if v>0 else f'{v:.2f}'
 return '0.00' if s=='-0.00' else s
def pair(c,a,b,window):
 idx=[i for i,d in enumerate(INPUT['dates']) if window['start']<=d<=window['end']]
 used=[i for i in idx if a['values'][i] is not None and b['values'][i] is not None]
 n=len(used);v=None;reason='insufficient-pairs'
 if n>=c['minObservations']:
  xs=[a['values'][i] for i in used];ys=[b['values'][i] for i in used];mx=math.fsum(xs)/n;my=math.fsum(ys)/n
  xx=math.fsum((x-mx)**2 for x in xs);yy=math.fsum((y-my)**2 for y in ys)
  if xx==0 or yy==0:reason='zero-variance'
  else:v=max(-1,min(1,math.fsum((x-mx)*(y-my) for x,y in zip(xs,ys))/math.sqrt(xx*yy)));reason=None
 return {'value':v,'n':n,'reason':reason,'dates':[INPUT['dates'][i] for i in used],'missingDates':[INPUT['dates'][i] for i in idx if i not in used]}
def rgb(data,w,h,x,y):
 x=round(x);y=round(y);assert 0<=x<w and 0<=y<h
 return data[(y*w+x)*3:(y*w+x)*3+3]
def is_color(rgb,c):
 r,g,b=rgb;return b-r>28 and b-g>20 if c=='blue' else r-b>48 and r-g>25
def mark(data,w,h,x,y,c,radius=3):
 return any(is_color(rgb(data,w,h,i,j),c) for j in range(max(0,round(y)-radius),min(h,round(y)+radius+1)) for i in range(max(0,round(x)-radius),min(w,round(x)+radius+1)))
assert AUDIT['inputSha256']==sha(ROOT/'inputs.json')
reports=[]
for audit in AUDIT['results']:
 c=next(c for c in INPUT['cases'] if c['id']==audit['caseId']);name=audit['name'];folder=ROOT/'evidence'/name;video=folder/'video.mp4';job=read(folder/'native-job.json');W,H=job['width'],job['height'];w=720;h=round(w*H/W);q=w/W;tall=H>W
 assert job['frames']==2820 and job['fps']==30 and [b['frames'] for b in job['beats']]==[1020,960,840]
 native=arithmetic=0;stages=[];margin=W*(.105 if tall else .07);N=len(c['series'])
 for bi,b in enumerate(job['beats']):
  ident=b['id'];els={e['id']:e for e in b['props']['elements']};window=INPUT['windows'][0 if bi==0 else 1];first=day(window['start']);last=day(window['end']);months=[d for d in INPUT['dates'] if window['start']<=d<=window['end']]
  assert els[ident+'-window']['text']==window['start']+' to '+window['end'];native+=1
  for i,a in enumerate(c['series']):
   for j,z in enumerate(c['series']):
    r=pair(c,a,z,window);actual=audit['stages'][bi]['model']['cells'][i*N+j]
    assert all(actual[k]==r[k] for k in ['n','reason','dates','missingDates'])
    assert (r['value'] is None and actual['value'] is None) or (r['value'] is not None and abs(r['value']-actual['value'])<1e-12);arithmetic+=5
  if bi<2:
   step=min(W*(.59 if tall else .48)/N,H*(.36 if tall else .44)/N);stepx=step if tall else W*.48/N;left=W*.305 if tall else (W-stepx*N)/2+W*.055;top=H*(.315 if tall else .34);cells=[]
   for i,a in enumerate(c['series']):
    assert els[ident+'-row-'+a['id']]['text']==a['label'] and els[ident+'-column-'+a['id']]['text']==a['label'];native+=2
    for j,z in enumerate(c['series']):
     p=pair(c,a,z,window);key=f'{ident}-cell-{i}-{j}';rect=els[key];x=left+j*stepx+4;y=top+i*step+4;cw=stepx-8;ch=step-8;at=.4+(i+j)*.13 if bi==0 else 0
     for k,v in [('x',x),('y',y),('w',cw),('h',ch),('at',at)]:near(rect[k],v);native+=1
     detail=f"n={p['n']} · few" if p['reason']=='insufficient-pairs' else f"n={p['n']} · flat" if p['reason']=='zero-variance' else f"n = {p['n']}"
     assert rect['fill']==color(p['value']);assert els[key+'-value']['text']==label(p['value']);assert els[key+'-count']['text']==detail;near(els[key+'-value']['at'],at);near(els[key+'-count']['at'],at);native+=5
     selected=[a['id'],z['id']]==c['selectedPair'] or [z['id'],a['id']]==c['selectedPair'];assert rect['stroke']==('ink' if selected else 'line');native+=1
     cells.append({'x':x,'y':y,'w':cw,'h':ch,'at':at,'fill':rect['fill'],'undefined':p['value'] is None})
   stages.append({'cells':cells});continue
  groups=[];common=None
  for si,sid in enumerate(c['selectedPair']):
   s=next(s for s in c['series'] if s['id']==sid);prefix=ident+'-'+sid;g=els[prefix+'-panel'];children={e['id']:e for e in g['children']};pw=W-2*margin if tall else (W-2*margin-W*.065)/2;ph=H*(.205 if tall else .39);gap=H*.08 if tall else W*.065;x=margin if tall else margin+si*(pw+gap);y=H*(.30 if tall else .34)+(si*(ph+gap) if tall else 0)
   near(g['x'],x);near(g['y'],y);native+=2
   left,right,top,bottom=pw*.14,pw*.96,ph*.23,ph*.82
   coords=(left,right,top,bottom)
   if common is None:common=coords
   else:assert coords==common
   px=lambda d:left+(day(d)-first)/(last-first)*(right-left)
   py=lambda v:bottom-(v-c['domain'][0])/(c['domain'][1]-c['domain'][0])*(bottom-top)
   paired=pair(c,*(next(s for s in c['series'] if s['id']==sid) for sid in c['selectedPair']),window)
   for j,v in enumerate(c['ticks']):grid=children[prefix+f'-grid-{j}'];near(grid['y1'],py(v));assert children[prefix+f'-y-{j}']['text']==str(v)+'%';native+=2
   points=[];segments=[];gaps=[];prev=None
   for j,d in enumerate(months):
    v=s['values'][INPUT['dates'].index(d)];key=prefix+f'-point-{j}';linekey=prefix+f'-segment-{j}';at=.6+3.4*(day(d)-first)/(last-first)
    if v is None:assert key not in children and linekey not in children;gaps.append(px(d));prev=None;native+=2;continue
    p=children[key];near(p['cx'],px(d));near(p['cy'],py(v));near(p['at'],at);near(p['r'],W*.006);assert p['width']==2;ispaired=d in paired['dates'];assert p['fill']==(('accent' if si==0 else 'accent2') if ispaired else 'bg');native+=6
    point={'x':px(d),'y':py(v),'at':at,'paired':ispaired,'radius':W*.006};points.append(point)
    if prev:
     seg=children[linekey]
     for k,vv in [('x1',prev['x']),('y1',prev['y']),('x2',point['x']),('y2',point['y']),('at',prev['at']),('dur',at-prev['at'])]:near(seg[k],vv);native+=1
     assert seg['drawEase']=='linear';segments.append((prev,point));native+=1
    else:assert linekey not in children;native+=1
    prev=point
   groups.append({'id':sid,'x':x,'y':y,'points':points,'segments':segments,'gaps':gaps,'top':top,'bottom':bottom,'color':'blue' if si==0 else 'orange'})
  stages.append({'groups':groups})
 selected=set(range(0,job['frames'],15))|{11,12,15,19,20,23,24,27,28,29,30,1019,1020,1021,1979,1980,1981,1997,1998,2007,2013,2022,2040,2052,2070,2099,2100,2101,2819}
 frames=sorted(selected);expr='+'.join(f'eq(n\\,{n})' for n in frames)
 proc=subprocess.Popen(['ffmpeg','-v','error','-threads','2','-i',str(video),'-vf',f'select={expr},scale={w}:{h}','-vsync','0','-threads','2','-pix_fmt','rgb24','-f','rawvideo','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 fills=undefined=hidden=points=fronts=gaps=hollows=sampled=0
 try:
  for frame in frames:
   need=w*h*3;chunks=[]
   while need:
    chunk=proc.stdout.read(need);assert chunk,('short decode',name,frame);chunks.append(chunk);need-=len(chunk)
   data=b''.join(chunks);sampled+=1;bi=0 if frame<1020 else 1 if frame<1980 else 2;local=(frame-[0,1020,1980][bi])/30
   if bi<2:
    bg=rgb(data,w,h,10,h/2)
    for ccell in stages[bi]['cells']:
     expected=bytes.fromhex(ccell['fill'][1:]) if local+1e-7>=ccell['at'] else bg
     for fx,fy in [(.1,.12),(.9,.12),(.1,.9),(.9,.9)]:
      actual=rgb(data,w,h,(ccell['x']+fx*ccell['w'])*q,(ccell['y']+fy*ccell['h'])*q)
      assert max(abs(a-b) for a,b in zip(actual,expected))<=18,(name,frame,'cell fill',ccell,tuple(actual),tuple(expected))
      if local+1e-7>=ccell['at']:fills+=1;undefined+=int(ccell['undefined'])
      else:hidden+=1
    continue
   for g in stages[bi]['groups']:
    xy=lambda x,y:((g['x']+x)*q,(g['y']+y)*q)
    for p in g['points']:
     if local+1e-7<p['at']:continue
     X,Y=xy(p['x'],p['y']);assert mark(data,w,h,X,Y,g['color']),(name,frame,'point',g['id'],p);points+=1
     if not p['paired']:
      assert not mark(data,w,h,X,Y,g['color'],1),(name,frame,'hollow center',g['id'],p)
      for side in [-1,1]:assert mark(data,w,h,X,Y+side*p['radius']*q,g['color'],2),(name,frame,'hollow rim',g['id'],p)
      hollows+=1
    for start,end in g['segments']:
     if start['at']<local<end['at']:
      t=(local-start['at'])/(end['at']-start['at']);X,Y=xy(start['x']+(end['x']-start['x'])*t,start['y']+(end['y']-start['y'])*t)
      assert mark(data,w,h,X,Y,g['color']),(name,frame,'linear front',g['id']);fronts+=1
    if local>=4.1:
     for x in g['gaps']:
      X,top=xy(x,g['top']);_,bottom=xy(x,g['bottom']);assert not any(mark(data,w,h,X,Y,g['color'],1) for Y in range(math.ceil(top),math.floor(bottom)+1)),(name,frame,'gap bridged',g['id']);gaps+=1
  assert proc.stdout.read(1)==b'';error=proc.stderr.read();assert proc.wait()==0,error
 finally:
  if proc.poll() is None:proc.kill();proc.wait()
 report={'project':name,'videoSha256':sha(video),'storyboardSha256':sha(ROOT/'specimens'/name/'storyboard.json'),'nativeJobSha256':sha(folder/'native-job.json'),'inputSha256':sha(ROOT/'inputs.json'),'checkerSha256':sha(Path(__file__)),'nativeMappingChecks':native,'arithmeticChecks':arithmetic,'sampledFrames':sampled,'cellFillChecks':fills,'undefinedFillChecks':undefined,'hiddenCellChecks':hidden,'pointChecks':points,'frontChecks':fronts,'missingColumnChecks':gaps,'hollowPointChecks':hollows,'failures':0,'tolerances':{'geometryPixels':1e-7,'matrixRgbPerChannel':18,'markRadiusAt720':3,'missingColumnRadiusAt720':1,'hollowCenterRadiusAt720':1,'hollowRimRadiusAt720':2}}
 reports.append(report);print(json.dumps(report),flush=True)
(ROOT/'build'/'encoded-checks.json').write_text(json.dumps(reports,indent=2)+'\n')
