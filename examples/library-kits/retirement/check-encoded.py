"""Bounded independent ratio and decoded edge checks for rectangular quantities.

Use codex-heavy. Streams one 720px RGB frame at a time; two FFmpeg threads.
Samples horizontal/vertical centerlines, not every pixel or subjective motion.
"""
import hashlib, json, math, pathlib, subprocess
ROOT=pathlib.Path(__file__).resolve().parent
runs=json.loads((ROOT/'build/renders.json').read_text())
audit=json.loads((ROOT/'audit.json').read_text())['results']
def near(a,b):
    assert abs(a-b)<1e-7, (a,b)
def rgb_at(data,x,y,w):
    i=(round(y)*w+round(x))*3
    return tuple(data[i:i+3])
def dist(a,b): return sum((x-y)**2 for x,y in zip(a,b))**.5
reports=[]
for run in runs:
    a=next(a for a in audit if a['project'].endswith(run['project']))
    quantities=[g for c in a['cases'] for g in c['geometry']]
    if not quantities: continue
    project=ROOT/'specimens'/run['project']; out=pathlib.Path(run['dir'])
    job=json.loads((project/'build/native/job.json').read_text())
    receipt=json.loads((out/'video.mp4.json').read_text())
    assert receipt['hashes']['storyboard.json']==hashlib.sha256((project/'storyboard.json').read_bytes()).hexdigest()
    width=720; scale=width/job['width']; height=round(job['height']*scale)
    mapped=[]
    for q in quantities:
        beat=next(b for b in job['beats'] if b['id']==q['beat'])
        elements={e.get('id'):e for e in beat['props']['elements']}
        mark=elements.get(q['beat']+'-'+q['id'])
        value=q.get('value',q.get('to',0)-q.get('from',0))
        if value==0:
            assert mark is None, 'Zero amount has a visible fill'
            continue
        assert not mark.get('keys') and mark.get('enter') in ('fade','none')
        if q['kind']=='stack':
            track=elements[q['beat']+'-'+q['id'].split('-part-')[0]+'-track']
            near(mark['w']/track['w'],q['value']/q['domain'])
            near(mark['w']*mark['h']/(track['w']*track['h']),q['value']/q['domain'])
            near(mark['y'],track['y'])
        elif q['kind']=='reservoir':
            tank=elements[q['beat']+'-'+q['id'].replace('-fill','-outline')]
            near(mark['h']/tank['h'],q['value']/q['capacity'])
            near(mark['w']*mark['h']/(tank['w']*tank['h']),q['value']/q['capacity'])
            near(mark['y']+mark['h'],tank['y']+tank['h'])
        else:
            near(mark['h']/q['span'],abs(q['to']-q['from'])/(q['domain'][1]-q['domain'][0]))
        mapped.append((beat,mark,{k:mark[k]*scale for k in ('x','y','w','h')}))
    proc=subprocess.Popen(['ffmpeg','-v','error','-threads','2','-i',str(out/'video.mp4'),'-vf',f'scale={width}:{height}',
        '-filter_threads','2','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    frames=checks=fade_checks=excluded=0; failures=[]; frame_bytes=width*height*3
    while True:
        data=proc.stdout.read(frame_bytes)
        if not data: break
        assert len(data)==frame_bytes
        f=frames;frames+=1
        for beat,mark,p in mapped:
            t=(f-beat['start_frame'])/job['fps']
            if t<max(.5,mark['at']+.10) or t>beat['frames']/job['fps']-.5: continue
            x,y,w,h=(p[k] for k in ('x','y','w','h'))
            if min(w,h)<4: excluded+=1;continue
            center=rgb_at(data,x+w/2,y+h/2,width)
            # Fade still too faint to recover an antialiased edge reliably.
            if min(dist(center,bg) for bg in [(245,243,237),(233,231,223)])<35:
                excluded+=1;continue
            for axis,lo,length,fixed in [('x',x,w,y+h/2),('y',y,h,x+w/2)]:
                coords=range(max(0,math.floor(lo)-4),min(width if axis=='x' else height,math.ceil(lo+length)+5))
                hits=[n for n in coords if dist(rgb_at(data,n,fixed,width) if axis=='x' else rgb_at(data,fixed,n,width),center)<28]
                checks+=1
                if t<mark['at']+mark.get('dur',0):fade_checks+=1
                if not hits or abs(min(hits)-lo)>2.5 or abs((max(hits)+1)-(lo+length))>2.5:
                    failures.append({'frame':f,'id':mark['id'],'axis':axis,'expected':[lo,lo+length],'actual':[min(hits),max(hits)+1] if hits else []})
    err=proc.stderr.read().decode();assert proc.wait()==0,err
    assert frames==job['frames']
    result={'project':run['project'],'framesDecoded':frames,'nativeQuantities':len(quantities),'encodedEdgeChecks':checks,
        'duringFadeEdgeChecks':fade_checks,'faintOrSubpixelExcluded':excluded,'failures':len(failures),'firstFailures':failures[:8],
        'nativeRatioTolerance':1e-7,'encodedEdgeTolerancePx':2.5,'auditWidth':width,
        'scope':'Actual source/native length and rectangle area ratios; decoded centerline edges during visible fade and hold. Excludes first/last half-second, faint and under-4px marks. No full-area raster census, chart-path or subjective playback claim.'}
    reports.append(result);print(json.dumps(result),flush=True)
(ROOT/'build/encoded-rectangles.json').write_text(json.dumps(reports,indent=2)+'\n')
assert not any(r['failures'] for r in reports),'Decoded rectangle geometry mismatch'
