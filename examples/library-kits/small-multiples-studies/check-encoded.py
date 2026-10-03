"""Independent ranks, shared-domain geometry and sampled encoded affine registration.
Decode one 720-wide RGB frame at a time, using at most two FFmpeg workers.
"""
import datetime,hashlib,json,math,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
INPUT=json.loads((ROOT/'inputs.json').read_text());AUDIT=json.loads((ROOT/'audit.json').read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text())
def day(s):return datetime.date.fromisoformat(s).toordinal()
def near(a,b):assert abs(a-b)<1e-7,(a,b)
def easing(t):
 t=max(0,min(1,t));return 4*t*t*t if t<.5 else 1-(-2*t+2)**3/2
def is_color(rgb,color):
 r,g,b=rgb;return b-r>28 and b-g>20 if color=='blue' else r-b>48 and r-g>25
def mark(data,w,h,x,y,color,radius=3):
 return any(is_color(data[(j*w+i)*3:(j*w+i)*3+3],color) for j in range(max(0,round(y)-radius),min(h,round(y)+radius+1)) for i in range(max(0,round(x)-radius),min(w,round(x)+radius+1)))
def ranks(c,index):
 ordered=sorted(c['series'],key=lambda s:(s['values'][index] is None,(s['values'][index] or 0)*(1 if c['direction']=='ascending' else -1),s['id']))
 result=[]
 for s in ordered:
  value=s['values'][index];rank=None if value is None else 1+sum(v['values'][index] is not None and (v['values'][index]<value if c['direction']=='ascending' else v['values'][index]>value) for v in c['series'])
  tied=value is not None and sum(v['values'][index]==value for v in c['series'])>1
  result.append((s,rank,tied,value))
 return result
assert AUDIT['inputSha256']==sha(ROOT/'inputs.json')
reports=[]
for a in AUDIT['results']:
 c=next(c for c in INPUT['cases'] if c['id']==a['caseId']);name=a['name'];folder=ROOT/'evidence'/name;video=folder/'video.mp4';job=read(folder/'native-job.json');W,H=job['width'],job['height'];w=720;h=round(w*H/W);q=w/W
 assert job['frames']==2340 and job['fps']==30 and [b['frames'] for b in job['beats']]==[840,780,720]
 native=0;stages=[];common=None
 for bi,b in enumerate(job['beats']):
  ident=b['id'];groups=[e for e in b['props']['elements'] if e['type']=='group'];ordered=ranks(c,0 if bi==0 else len(INPUT['dates'])-1);assert len(groups)==4
  stage=[];layout=a['stages'][bi]['layout'];first=day(INPUT['dates'][0]);last=day(INPUT['dates'][-1])
  for slot,(s,rank,tied,value) in enumerate(ordered):
   prefix=f"{ident}-{s['id']}";g=groups[slot];assert g['id']==prefix+'-panel';near(g['x'],layout['boxes'][slot][0]);near(g['y'],layout['boxes'][slot][1]);els={e['id']:e for e in g['children']}
   tag='—' if rank is None else str(rank)+('=' if tied else '')
   assert els[prefix+'-name']['text']==tag+'  '+s['label'];assert els[prefix+'-rank-value']['text'].split(' · ')[0]==('Missing' if value is None else str(value));native+=5
   grid=[els[prefix+f'-grid-{i}'] for i in range(len(c['ticks']))];left,right=grid[0]['x1'],grid[0]['x2'];bottom,top=grid[0]['y1'],grid[-1]['y1'];coordinates=(left,right,bottom,top)
   if common is None:common=coordinates
   else:
    for x,y in zip(common,coordinates):near(x,y)
   px=lambda d:left+(day(d)-first)/(last-first)*(right-left)
   py=lambda v:bottom-(v-c['domain'][0])/(c['domain'][1]-c['domain'][0])*(bottom-top)
   for i,tick in enumerate(c['ticks']):near(grid[i]['y1'],py(tick));assert els[prefix+f'-y-{i}']['text']==str(tick);native+=2
   points=[];segments=[];gaps=[];previous=None;expectedids=[]
   for i,(date,value) in enumerate(zip(INPUT['dates'],s['values'])):
    key=prefix+f'-point-{i}';segment=prefix+f'-segment-{i}';at=.7+3.5*(day(date)-first)/(last-first) if bi==0 else 0
    if value is None:
     assert key not in els and segment not in els;gaps.append(px(date));previous=None;native+=2;continue
    actual=els[key];near(actual['cx'],px(date));near(actual['cy'],py(value));near(actual['at'],at);expectedids.append(key);native+=3
    point={'x':px(date),'y':py(value),'at':at};points.append(point)
    if previous:
     line=els[segment]
     for field,expected in [('x1',previous['x']),('y1',previous['y']),('x2',point['x']),('y2',point['y'])]:near(line[field],expected);native+=1
     if bi==0:near(line['at'],previous['at']);near(line['dur'],point['at']-previous['at']);assert line['drawEase']=='linear';native+=3
     segments.append((previous,point))
    else:assert segment not in els;native+=1
    previous=point
   assert sorted(expectedids)==sorted(k for k in els if '-point-' in k)
   if bi==2:
    if s['id']==c['selected']:
     assert g['origin']==[g['x'],g['y']];key=g['keys'][1];near(key['at'],.6);near(key['dur'],1.4);assert key['ease']=='inOut';near(key['scale'],layout['expanded'][2]/layout['pw']);near(key['x'],layout['expanded'][0]-g['x']);near(key['y'],layout['expanded'][1]-g['y']);native+=7
    else:assert g['keys']==[{'at':0,'dur':.35,'opacity':0,'ease':'linear'}];native+=1
   stage.append({'id':s['id'],'x':g['x'],'y':g['y'],'points':points,'segments':segments,'gaps':gaps,'top':top,'bottom':bottom,'keys':g.get('keys')})
  stages.append(stage)
 selected=set(range(0,job['frames'],15))|{27,36,51,66,81,96,111,123,837,839,840,841,1617,1619,1620,1621,1629,1630,1638,1641,1647,1653,1662,1668,1674,1680,1681,2339}
 frames=sorted(selected);expr='+'.join(f'eq(n\\,{n})' for n in frames)
 proc=subprocess.Popen(['ffmpeg','-v','error','-threads','2','-i',str(video),'-vf',f'select={expr},scale={w}:{h}','-vsync','0','-threads','2','-pix_fmt','rgb24','-f','rawvideo','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 pointchecks=frontchecks=gapchecks=disappearance=expansionchecks=0;sampled=0
 try:
  for n in frames:
   need=w*h*3;chunks=[]
   while need:
    chunk=proc.stdout.read(need)
    assert chunk,('short decode',name,n)
    chunks.append(chunk);need-=len(chunk)
   data=b''.join(chunks);sampled+=1;bi=0 if n<840 else 1 if n<1620 else 2;local=(n-[0,840,1620][bi])/30
   for g in stages[bi]:
    selectedpanel=bi==2 and g['id']==c['selected'];color='orange' if selectedpanel else 'blue';sx=1;dx=dy=0
    if selectedpanel:
     e=easing((local-.6)/1.4);key=g['keys'][1];sx=1+(key['scale']-1)*e;dx=key['x']*e;dy=key['y']*e
    xy=lambda x,y:((g['x']+dx+x*sx)*q,(g['y']+dy+y*sx)*q)
    if bi==2 and not selectedpanel and local>=.4:
     for p in g['points']:
      assert not mark(data,w,h,*xy(p['x'],p['y']),'blue',2),(name,n,'faded point remains',g['id']);disappearance+=1
     continue
    if bi==2 and not selectedpanel and local>0:continue # only geometry, not subjective fade opacity
    for p in g['points']:
     if local+1e-7<p['at']:continue
     assert mark(data,w,h,*xy(p['x'],p['y']),color),(name,n,'observation',g['id'],p);pointchecks+=1
     if selectedpanel and .6<local<2:expansionchecks+=1
    if bi==0:
     for start,end in g['segments']:
      if start['at']<local<end['at']:
       f=(local-start['at'])/(end['at']-start['at']);x=start['x']+(end['x']-start['x'])*f;y=start['y']+(end['y']-start['y'])*f
       assert mark(data,w,h,*xy(x,y),color),(name,n,'shared-clock front',g['id']);frontchecks+=1
    if (bi==0 and local>=4.3) or bi==1 or (bi==2 and selectedpanel and local>=.4):
     for x in g['gaps']:
      xx,top=xy(x,g['top']);_,bottom=xy(x,g['bottom'])
      assert not any(mark(data,w,h,xx,y,color,1) for y in range(math.ceil(top),math.floor(bottom)+1)),(name,n,'missing gap bridged',g['id']);gapchecks+=1
  assert proc.stdout.read(1)==b'';error=proc.stderr.read();assert proc.wait()==0,error
 finally:
  if proc.poll() is None:proc.kill();proc.wait()
 report={'project':name,'videoSha256':sha(video),'storyboardSha256':sha(ROOT/'specimens'/name/'storyboard.json'),'nativeJobSha256':sha(folder/'native-job.json'),'inputSha256':sha(ROOT/'inputs.json'),'checkerSha256':sha(Path(__file__)),'nativeMappingChecks':native,'sampledFrames':sampled,'pointChecks':pointchecks,'frontChecks':frontchecks,'missingColumnChecks':gapchecks,'disappearanceChecks':disappearance,'expansionPointChecks':expansionchecks,'failures':0,'tolerances':{'geometryPixels':1e-7,'markRadiusAt720':3,'missingColumnRadiusAt720':1,'fadedPointRadiusAt720':2}}
 reports.append(report);print(json.dumps(report),flush=True)
(ROOT/'build'/'encoded-checks.json').write_text(json.dumps(reports,indent=2)+'\n')
