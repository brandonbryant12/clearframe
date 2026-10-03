"""Independent Decimal cash-flow models, native coordinates and encoded marks.
No JS imports. Bound decoded probes to 2Hz plus reveal/cut frames, two FFmpeg threads.
"""
import decimal,hashlib,json,math,subprocess
from pathlib import Path
D=decimal.Decimal;decimal.getcontext().prec=60
ROOT=Path(__file__).resolve().parent
INPUT=json.loads((ROOT/'inputs.json').read_text());AUDIT=json.loads((ROOT/'audit.json').read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text())
def near(a,b):assert abs(a-b)<1e-7,(a,b)
def fmt(value,decimals):
 if value is None:return '—'
 text=f'{value:.{decimals}f}'
 return text[1:] if text.startswith('-') and float(text)==0 else text
def value(c,g,r):
 if c['terminal']['kind']=='growing-perpetuity':return None if r<=g else D(str(c['cashFlowNow']))*(1+D(str(g))/100)/((D(str(r))-D(str(g)))/100)-D(str(c['initialOutlay']))
 return sum(D(str(c['cashFlowNow']))*((1+D(str(g))/100)/(1+D(str(r))/100))**t for t in range(1,c['terminal']['periods']+1))-D(str(c['initialOutlay']))
def shade(v,scale):
 if v is None:return '#e7e7e2'
 v=float(v);t=0 if v==0 else v/scale['min'] if v<0 else v/scale['max'];end=[231,170,119] if v<0 else [135,176,213]
 return '#'+''.join(f'{math.floor(a+(b-a)*t+.5):02x}' for a,b in zip([247,247,242],end))
def edges(a):return [a[0]-(a[1]-a[0])/2]+[(x+y)/2 for x,y in zip(a,a[1:])]+[a[-1]+(a[-1]-a[-2])/2]
def rgb(data,w,h,x,y):
 x=round(x);y=round(y);assert 0<=x<w and 0<=y<h
 return data[(y*w+x)*3:(y*w+x)*3+3]
def blue(v):r,g,b=v;return b-r>28 and b-g>20
def mark(data,w,h,x,y,radius=2):return any(blue(rgb(data,w,h,i,j)) for j in range(max(0,round(y)-radius),min(h,round(y)+radius+1)) for i in range(max(0,round(x)-radius),min(w,round(x)+radius+1)))
assert AUDIT['inputSha256']==sha(ROOT/'inputs.json');reports=[]
for a in AUDIT['results']:
 c=next(c for c in INPUT['cases'] if c['id']==a['caseId']);name=a['name'];folder=ROOT/'evidence'/name;video=folder/'video.mp4';job=read(folder/'native-job.json');W,H=job['width'],job['height'];w=720;h=round(w*H/W);q=w/W;tall=H>W;size=W*(.03 if tall else .023);scale=c['scale'];decimals=scale['decimals'];rates=c['rateDecimals']
 assert job['frames']==2160 and job['fps']==30 and [b['frames'] for b in job['beats']]==[1080,1080]
 matrix=[]
 for i,g in enumerate(c['growthRates']):
  for j,r in enumerate(c['discountRates']):matrix.append({'row':i,'column':j,'growth':g,'discount':r,'value':value(c,g,r)})
 native=arithmetic=0;stages=[]
 for bi,b in enumerate(job['beats']):
  ident=b['id'];els={e['id']:e for e in b['props']['elements']};m=a['stages'][bi]['model'];selected=value(c,c['selected']['growth'],c['selected']['discount'])
  assert els[ident+'-basis']['text']==f"Base annual flow {c['cashFlowNow']} · outlay {c['initialOutlay']} {c['unit']}";assert els[ident+'-source']['text']==c['source']+' '+c['asOf']+'.';native+=2
  fixed=f"Growth fixed at {c['selected']['growth']:.{rates}f}%" if c['slice']=='discount' else f"Discount fixed at {c['selected']['discount']:.{rates}f}%"
  assert els[ident+'-fixed']['text']==fixed+f" · selected {fmt(selected,decimals)} {c['unit']}";native+=1
  for cell,actual in zip(matrix,m['cells']):
   v=cell['value'];assert actual['valid']==(v is not None);assert actual['reason']==('discount-not-above-growth' if v is None else None)
   assert (actual['value'] is None and v is None) or v is not None and abs(float(v)-actual['value'])<1e-9;arithmetic+=3
   if c['terminal']['kind']=='none':
    assert len(actual['terms'])==c['terminal']['periods'];arithmetic+=1
    for term in actual['terms']:
     year=term['year'];cash=D(str(c['cashFlowNow']))*(1+D(str(cell['growth']))/100)**year;pv=cash/(1+D(str(cell['discount']))/100)**year
     assert abs(float(cash)-term['cashFlow'])<1e-9 and abs(float(pv)-term['presentValue'])<1e-9;arithmetic+=2
  if bi==0:
   xe,ye=edges(c['discountRates']),edges(c['growthRates']);left,right=W*(.25 if tall else .26),W*(.89 if tall else .84);top,bottom=H*(.375 if tall else .44),H*(.66 if tall else .72);px=lambda v:left+(v-xe[0])/(xe[-1]-xe[0])*(right-left);py=lambda v:top+(v-ye[0])/(ye[-1]-ye[0])*(bottom-top);cells=[]
   for j,r in enumerate(c['discountRates']):near(els[f'{ident}-x-{j}']['x'],px(r));assert els[f'{ident}-x-{j}']['text']==f'{r:.{rates}f}%';native+=2
   for i,g in enumerate(c['growthRates']):near(els[f'{ident}-y-{i}']['y'],py(g)+size*.3);assert els[f'{ident}-y-{i}']['text']==f'{g:.{rates}f}%';native+=2
   for cell in matrix:
    i,j=cell['row'],cell['column'];x,y=px(xe[j])+3,py(ye[i])+3;cw,ch=px(xe[j+1])-x-3,py(ye[i+1])-y-3;at=.4+(i+j)*.13;el=els[f'{ident}-cell-{i}-{j}'];label=els[f'{ident}-value-{i}-{j}'];fill=shade(cell['value'],scale)
    for k,v in [('x',x),('y',y),('w',cw),('h',ch),('at',at)]:near(el[k],v);native+=1
    assert el['fill']==fill;assert label['text']==fmt(cell['value'],decimals);near(label['x'],x+cw/2);near(label['y'],y+ch*.57);near(label['at'],at);native+=5
    onSlice=cell['growth']==c['selected']['growth'] if c['slice']=='discount' else cell['discount']==c['selected']['discount'];isSelected=cell['growth']==c['selected']['growth'] and cell['discount']==c['selected']['discount'];assert el['stroke']==('ink' if onSlice else 'line') and el['width']==(4 if isSelected else 2 if onSlice else 1);native+=2
    cells.append({'x':x,'y':y,'w':cw,'h':ch,'fill':fill,'at':at,'undefined':cell['value'] is None})
   stages.append({'cells':cells});continue
  points=[p for p in matrix if (p['growth']==c['selected']['growth'] if c['slice']=='discount' else p['discount']==c['selected']['discount'])];axis=[p[c['slice']] for p in points];left,right=W*.20,W*.89;top,bottom=H*(.36 if tall else .405),H*(.72 if tall else .745);px=lambda v:left+(v-axis[0])/(axis[-1]-axis[0])*(right-left);py=lambda v:bottom-(float(v)-scale['min'])/(scale['max']-scale['min'])*(bottom-top);visible=[];segments=[];invalid=[];prev=None
  for i,v in enumerate(scale['ticks']):near(els[f'{ident}-grid-{i}']['y1'],py(v));assert els[f'{ident}-y-{i}']['text']==str(v);native+=2
  for i,p in enumerate(points):
   xvalue=p[c['slice']];x=px(xvalue);at=.6+3.4*(xvalue-axis[0])/(axis[-1]-axis[0]);key=f'{ident}-point-{i}';linekey=f'{ident}-segment-{i}'
   assert els[f'{ident}-x-{i}']['text']==f'{xvalue:.{rates}f}%';near(els[f'{ident}-x-{i}']['x'],x);native+=2
   if p['value'] is None:assert key not in els and linekey not in els;invalid.append(x);prev=None;native+=2;continue
   y=py(p['value']);e=els[key];near(e['cx'],x);near(e['cy'],y);near(e['r'],W*.006);near(e['at'],at);native+=4
   pp={'x':x,'y':y,'at':at};visible.append(pp)
   if prev:
    s=els[linekey]
    for k,v in [('x1',prev['x']),('y1',prev['y']),('x2',x),('y2',y),('at',prev['at']),('dur',at-prev['at'])]:near(s[k],v);native+=1
    assert s['drawEase']=='linear';segments.append((prev,pp));native+=1
   else:assert linekey not in els;native+=1
   prev=pp
  stages.append({'points':visible,'segments':segments,'invalid':invalid,'top':top,'bottom':bottom})
 frames=sorted(set(range(0,2160,15))|{11,12,15,19,20,23,24,27,28,31,32,35,36,39,40,1079,1080,1081,1097,1098,1107,1113,1122,1140,1152,1170,1199,1200,1201,2159});expr='+'.join(f'eq(n\\,{v})' for v in frames)
 proc=subprocess.Popen(['ffmpeg','-v','error','-threads','2','-i',str(video),'-vf',f'select={expr},scale={w}:{h}','-vsync','0','-threads','2','-pix_fmt','rgb24','-f','rawvideo','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 sampled=fills=undefined=hidden=pointchecks=fronts=gaps=0
 try:
  for frame in frames:
   need=w*h*3;chunks=[]
   while need:
    chunk=proc.stdout.read(need);assert chunk,('short decode',name,frame);chunks.append(chunk);need-=len(chunk)
   data=b''.join(chunks);sampled+=1;bi=0 if frame<1080 else 1;local=(frame-bi*1080)/30
   if bi==0:
    bg=rgb(data,w,h,10,h/2)
    for cell in stages[0]['cells']:
     expected=bytes.fromhex(cell['fill'][1:]) if local+1e-7>=cell['at'] else bg
     for fx,fy in [(.15,.18),(.85,.18),(.15,.82),(.85,.82)]:
      actual=rgb(data,w,h,(cell['x']+fx*cell['w'])*q,(cell['y']+fy*cell['h'])*q)
      assert max(abs(a-b) for a,b in zip(actual,expected))<=18,(name,frame,'cell fill',cell,tuple(actual),tuple(expected))
      if local+1e-7>=cell['at']:fills+=1;undefined+=int(cell['undefined'])
      else:hidden+=1
    continue
   s=stages[1]
   for p in s['points']:
    if local+1e-7>=p['at']:assert mark(data,w,h,p['x']*q,p['y']*q),(name,frame,'point',p);pointchecks+=1
   for start,end in s['segments']:
    if start['at']<local<end['at']:
     t=(local-start['at'])/(end['at']-start['at']);x=start['x']+(end['x']-start['x'])*t;y=start['y']+(end['y']-start['y'])*t
     assert mark(data,w,h,x*q,y*q),(name,frame,'guide front',start,end);fronts+=1
   if local>=4.1:
    for x in s['invalid']:assert not any(mark(data,w,h,x*q,y,1) for y in range(math.ceil(s['top']*q),math.floor(s['bottom']*q)+1)),(name,frame,'invalid point bridged');gaps+=1
  assert proc.stdout.read(1)==b'';err=proc.stderr.read();assert proc.wait()==0,err
 finally:
  if proc.poll() is None:proc.kill();proc.wait()
 report={'project':name,'videoSha256':sha(video),'storyboardSha256':sha(ROOT/'specimens'/name/'storyboard.json'),'nativeJobSha256':sha(folder/'native-job.json'),'inputSha256':sha(ROOT/'inputs.json'),'checkerSha256':sha(Path(__file__)),'nativeMappingChecks':native,'arithmeticChecks':arithmetic,'sampledFrames':sampled,'cellFillChecks':fills,'undefinedFillChecks':undefined,'hiddenCellChecks':hidden,'pointChecks':pointchecks,'frontChecks':fronts,'invalidColumnChecks':gaps,'failures':0,'tolerances':{'geometryPixels':1e-7,'arithmeticAbsolute':1e-9,'fillRgbPerChannel':18,'markRadiusAt720':2,'invalidColumnRadiusAt720':1}}
 reports.append(report);print(json.dumps(report),flush=True)
(ROOT/'build/encoded-checks.json').write_text(json.dumps(reports,indent=2)+'\n')
