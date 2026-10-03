"""Bounded encoded source/native subject registration, including motion and holds."""
from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
bindings=json.loads((root/'bindings.json').read_text())['bindings']
# At half seconds, both 24fps source and 30fps native clocks land on exact frames.
# The final ten seconds compare against the last actual source image.
times=[i/2 for i in range(16)]+[8,8.5,10,14,17.5]
width,height=256,192;size=width*height*3

def decode(file,frames,dimensions):
    select='+'.join('eq(n\\,%d)'%f for f in sorted(set(frames)))
    vf=f'select={select},scale={dimensions[0]}:{dimensions[1]}:flags=area,crop=iw*0.84:ih*0.46:iw*0.08:ih*0.35,scale={width}:{height}:flags=area'
    r=subprocess.run(['ffmpeg','-v','error','-threads','2','-filter_threads','2','-i',str(file),'-vf',vf,'-vsync','0','-threads','2','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True)
    assert r.returncode==0,r.stderr.decode();expected=sorted(set(frames));assert len(r.stdout)==len(expected)*size,(file,len(r.stdout),len(expected)*size)
    return {f:r.stdout[i*size:(i+1)*size] for i,f in enumerate(expected)}

def difference(a,b):return sum(abs(x-y) for x,y in zip(a,b))/size
source={};reports=[]
for b in bindings:
    m=b['mediaName'];receipt=json.loads((root/'media'/m/'receipt.json').read_text());file=root/'media'/m/'clip.mp4'
    assert sha(file)==b['sourceClipSha256']==receipt['outputs']['clip.mp4']['sha256']
    sourceFrames=[min(int(t*24),191) for t in times];nativeFrames=[int(t*30) for t in times]
    if m not in source:source[m]=decode(file,sourceFrames,(receipt['config']['width'],receipt['config']['height']))
    native=root/'evidence'/b['name']/'video.mp4';actual=decode(native,nativeFrames,(receipt['config']['width'],receipt['config']['height']));samples=[]
    for t,s,n in zip(times,sourceFrames,nativeFrames):
        error=difference(source[m][s],actual[n]);samples.append({'seconds':t,'sourceFrame':s,'nativeFrame':n,'meanAbsoluteRgb':error})
    maximum=max(s['meanAbsoluteRgb'] for s in samples)
    reports.append({'name':b['name'],'sourceClipSha256':sha(file),'videoSha256':sha(native),'storyboardSha256':sha(root/'specimens'/b['name']/'storyboard.json'),'checkerSha256':sha(__file__),'samples':samples,'maximumMeanAbsoluteRgb':maximum,'threshold':1.5,'passed':maximum<1.5,'crop':[.08,.35,.84,.46],'scaledCrop':[width,height],'limits':'Subject-region color registration at exact shared-clock samples; not exhaustive pixels, OCR or subjective playback.'})
(root/'build/registration.json').write_text(json.dumps(reports,indent=2)+'\n')
print(json.dumps([{k:r[k] for k in ['name','maximumMeanAbsoluteRgb','passed']} for r in reports]))
assert len(reports)==8 and all(r['passed'] for r in reports),'Encoded source/native registration failed'
