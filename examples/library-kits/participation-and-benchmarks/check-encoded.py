"""Bounded independent input/native/pixel checks; stream frames, two FFmpeg workers.
Rectangle lengths/equal-tile areas and circle areas are verified independently.
Encoded edge/chord probes complement native areas; not an exhaustive pixel census.
"""
import hashlib,json,math,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parent
INPUT=json.loads((ROOT/'inputs.json').read_text());AUDIT=json.loads((ROOT/'audit.json').read_text())
assert AUDIT['inputSha256']==hashlib.sha256((ROOT/'inputs.json').read_bytes()).hexdigest()
CASES={c['id']:c for c in INPUT['cases']};RUNS=json.loads((ROOT/'build/verification.json').read_text())
COLORS={'meets':'#315cce','other':'#c2641f','missing':'#796499'}
def near(a,b):assert abs(a-b)<1e-7,(a,b)
def state(c,p):
    if p['value'] is None:return 'missing'
    op,t=c['condition']['operator'],c['condition']['threshold'];v=p['value']
    return 'meets' if {'gt':v>t,'gte':v>=t,'lt':v<t,'lte':v<=t}[op] else 'other'
def color(data,x,y,width):
    i=(round(y)*width+round(x))*3;return tuple(data[i:i+3])
def distance(a,b):return sum((x-y)**2 for x,y in zip(a,b))**.5
def colored(data,offset):
    r,g,b=data[offset:offset+3]
    return b-r>28 and b-g>20 or r-b>48 and r-g>25
reports=[]
for run in RUNS:
    name=run['name'];c=CASES[name.rsplit('-',1)[0]];project=ROOT/'specimens'/name;out=pathlib.Path(run['dir'])
    job=json.loads((project/'build/native/job.json').read_text());receipt=json.loads((out/'video.mp4.json').read_text())
    source_hash=hashlib.sha256((project/'storyboard.json').read_bytes()).hexdigest()
    assert receipt['hashes']['storyboard.json']==source_hash
    width=720;scale=width/job['width'];height=round(job['height']*scale);rects=[];circles=[];zeros=[];missing=[]
    native_count=native_weight=native_area=native_position=native_absence=0
    if c['recipe']=='C05':
        count,weight=job['beats'];els={e['id']:e for e in count['props']['elements']};wel={e['id']:e for e in weight['props']['elements']}
        tiles=[e for e in els.values() if e['type']=='rect'];assert len(tiles)==len(c['members']);tile_area=tiles[0]['w']*tiles[0]['h']
        for p in c['members']:
            e=els[f"{c['id']}-count-tile-{p['id']}"];near(e['w'],e['h']);near(e['w']*e['h'],tile_area)
            assert e['fill']==COLORS[state(c,p)] and e['enter']=='fade' and not e.get('keys') and not e.get('scale');native_count+=1
            rects.append((count,e,.18))
        bars=[e for e in wel.values() if e['type']=='rect'];span=sum(e['w'] for e in bars);total=sum(p['weight'] for p in c['members']);x=bars[0]['x']
        for kind in ['meets','other','missing']:
            amount=sum(p['weight'] for p in c['members'] if state(c,p)==kind);e=wel.get(f"{c['id']}-weight-weight-{kind}")
            if amount==0:assert e is None;native_absence+=1;continue
            near(e['x'],x);near(e['w']/span,amount/total);near(e['h'],bars[0]['h']);near(e['w']*e['h']/(span*bars[0]['h']),amount/total)
            assert e['fill']==COLORS[kind] and e['enter']=='fade' and not e.get('keys') and not e.get('scale');x+=e['w'];native_weight+=1
            rects.append((weight,e,.5))
    else:
        beat=job['beats'][1];els={e['id']:e for e in beat['props']['elements']};left=els[f"{c['id']}-tick-0"]['x1'];right=els[f"{c['id']}-tick-{len(c['ticks'])-1}"]['x1']
        top=els[f"{c['id']}-tick-0"]['y1']+job['width']*.03*.3
        bottom=els[f"{c['id']}-label-{c['items'][-1]['id']}"]['y']-job['width']*.03*.3;rad=job['width']*.025
        px=lambda v:left+(v-c['domain'][0])/(c['domain'][1]-c['domain'][0])*(right-left)
        for i,value in enumerate(c['ticks']):near(els[f"{c['id']}-tick-{i}"]['x1'],px(value));native_position+=1
        for i,p in enumerate(c['items']):
            circle=els.get(f"{c['id']}-bubble-{p['id']}");stem=els.get(f"{c['id']}-stem-{p['id']}");cross=els.get(f"{c['id']}-zero-a-{p['id']}");y=top+i*(bottom-top)/(len(c['items'])-1)
            if p['value'] is None:
                assert circle is None and stem is None and cross is None;native_absence+=1;missing.append((beat,(left*scale,right*scale,y*scale,rad*scale)));continue
            d=p['value']-c['benchmark'];x=px(d)
            if d:near(stem['x1'],px(0));near(stem['x2'],x);near(stem['y1'],y);near(stem['y2'],y);native_position+=1
            if p['size']==0:
                assert circle is None;near((cross['x1']+cross['x2'])/2,x);near((cross['y1']+cross['y2'])/2,y);native_absence+=1;zeros.append((beat,cross,x*scale,y*scale));continue
            near(circle['cx'],x);near(circle['cy'],y);near(math.pi*circle['r']**2/(math.pi*rad**2),p['size']/c['maxSize']);native_position+=1;native_area+=1
            assert circle['enter']=='fade' and not circle.get('keys') and not circle.get('scale');circles.append((beat,circle))
    proc=subprocess.Popen(['ffmpeg','-v','error','-threads','2','-i',str(out/'video.mp4'),'-vf',f'scale={width}:{height}','-filter_threads','2','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    frames=edges=chords=fades=zero_checks=missing_checks=excluded=0;failures=[];size=width*height*3
    while True:
        data=proc.stdout.read(size)
        if not data:break
        assert len(data)==size
        frame=frames;frames+=1
        for beat,mark,offset in rects:
            t=(frame-beat['start_frame'])/job['fps']
            if t<max(.5,mark['at']+.10) or t>beat['frames']/job['fps']-.5:continue
            x,y,w,h=[mark[k]*scale for k in ('x','y','w','h')]
            if min(w,h)<4:excluded+=1;continue
            sample=color(data,x+w*offset,y+h*offset,width)
            if min(distance(sample,bg) for bg in [(245,243,237),(233,231,223)])<35:excluded+=1;continue
            for axis,lo,length,fixed in [('x',x,w,y+h*offset),('y',y,h,x+w*offset)]:
                coords=range(max(0,math.floor(lo)-4),min(width if axis=='x' else height,math.ceil(lo+length)+5))
                hits=[n for n in coords if distance(color(data,n,fixed,width) if axis=='x' else color(data,fixed,n,width),sample)<28]
                edges+=1
                if t<mark['at']+mark.get('dur',0):fades+=1
                if not hits or abs(min(hits)-lo)>2.5 or abs(max(hits)+1-lo-length)>2.5:failures.append({'kind':'rect-edge','frame':frame,'id':mark['id'],'axis':axis,'expected':[lo,lo+length],'actual':[min(hits),max(hits)+1] if hits else []})
        for beat,mark in circles:
            t=(frame-beat['start_frame'])/job['fps']
            if t<max(.5,mark['at']+.12) or t>beat['frames']/job['fps']-.5:continue
            x,y,r=[mark[k]*scale for k in ('cx','cy','r')]
            if r<4:excluded+=1;continue
            sample=color(data,x+r*.25,y-r*.25,width)
            if min(distance(sample,bg) for bg in [(245,243,237),(233,231,223)])<35:excluded+=1;continue
            probes=[]
            for yy in (round(y-r*.55),round(y+r*.55)):
                half=math.sqrt(max(0,r*r-(yy-y)**2));probes.append(('x',x-half,x+half,yy))
            xx=round(x);half=math.sqrt(max(0,r*r-(xx-x)**2));probes.append(('y',y-half,y+half,xx))
            for axis,lo,hi,fixed in probes:
                coords=range(max(0,math.floor(lo)-4),min(width if axis=='x' else height,math.ceil(hi)+5))
                hits=[n for n in coords if distance(color(data,n,fixed,width) if axis=='x' else color(data,fixed,n,width),sample)<28]
                chords+=1
                if t<mark['at']+mark.get('dur',0):fades+=1
                if not hits or abs(min(hits)-lo)>2.5 or abs(max(hits)+1-hi)>2.5:failures.append({'kind':'circle-chord','frame':frame,'id':mark['id'],'axis':axis,'expected':[lo,hi],'actual':[min(hits),max(hits)+1] if hits else []})
        for beat,mark,x,y in zeros:
            t=(frame-beat['start_frame'])/job['fps']
            if t<mark['at']+.3 or t>beat['frames']/job['fps']-.5:continue
            zero_checks+=1
            if not any(max(color(data,xx,yy,width))<110 for yy in range(round(y)-3,round(y)+4) for xx in range(round(x)-3,round(x)+4)):failures.append({'kind':'zero-marker','frame':frame,'id':mark['id']})
        for beat,(left,right,y,r) in missing:
            t=(frame-beat['start_frame'])/job['fps']
            if t<.5 or t>beat['frames']/job['fps']-.5:continue
            missing_checks+=1
            if any(colored(data,(yy*width+xx)*3) for yy in range(round(y-r*.8),round(y+r*.8)+1) for xx in range(math.ceil(left),math.floor(right)+1)):failures.append({'kind':'missing-endpoint','frame':frame})
    err=proc.stderr.read().decode();assert proc.wait()==0,err;assert frames==job['frames']
    report={'project':name,'storyboardSha256':source_hash,'pipelineId':out.name,'framesDecoded':frames,'nativeEqualTileChecks':native_count,'nativeWeightAreaChecks':native_weight,'nativeCircleAreaChecks':native_area,'nativePositionChecks':native_position,'nativeAbsenceChecks':native_absence,
     'rectangleEdgeChecks':edges,'circleChordChecks':chords,'duringFadeProbes':fades,'zeroMarkerChecks':zero_checks,'missingEndpointChecks':missing_checks,'excludedFaintOrSmallSamples':excluded,'failures':len(failures),'firstFailures':failures[:8],
     'auditWidth':width,'nativeTolerance':1e-7,'encodedEdgeTolerancePx':2.5,'scope':'Original-input count/weight/difference mappings and exact native rectangle/circle area ratios; bounded decoded edge/chord/absence probes. First/last half-seconds and faint or under-4px marks excluded. No exhaustive pixel-area census or observed continuous-playback claim.'}
    reports.append(report);print(json.dumps(report),flush=True)
(ROOT/'build/encoded-proportions.json').write_text(json.dumps(reports,indent=2)+'\n')
assert not any(r['failures'] for r in reports),'Encoded marks differ from source quantities'
