"""Check final encoded bar heights against fixture values on the projected grid.

Streams every fully labeled ending frame. Checks blue bar centerlines (not OCR),
source/native clock registration before labels, and current evidence hashes.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import numpy as np

ROOT = Path(__file__).resolve().parent

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def read(p):
    return json.loads(Path(p).read_text())

def probe(video):
    result=subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-count_frames',
        '-show_entries','stream=width,height,r_frame_rate,nb_read_frames','-of','json',str(video)],
        capture_output=True,check=True)
    return json.loads(result.stdout)['streams'][0]

def frame(video, index, w, h):
    result=subprocess.run(['ffmpeg','-v','error','-threads','2','-i',str(video),
        '-vf',f'select=eq(n\\,{index}),scale={w}:{h}', '-frames:v','1',
        '-threads','2','-filter_threads','2','-pix_fmt','rgb24','-f','rawvideo','-'],
        capture_output=True,check=True)
    assert len(result.stdout)==w*h*3
    return np.frombuffer(result.stdout,dtype=np.uint8).reshape(h,w,3)

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--revision',required=True)
parser.add_argument('names',nargs='+')
args=parser.parse_args()
assert args.revision and all(c in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in args.revision)
inputs=read(ROOT/'inputs.json')
candidates={f"{case['id']}-{fmt}":(case,fmt) for case in inputs['cases'] for fmt in ['landscape','vertical']}
reports=[]
for name in args.names:
    assert name in candidates,name
    item,fmt=candidates[name]
    specimen=ROOT/'specimens'/args.revision/name
    media=ROOT/'media'/args.revision/name
    video=specimen/'build/video.mp4'
    anchors=read(media/'ending-anchors.json')
    binding=read(specimen/'bindings.json')
    storyboard=read(specimen/'storyboard.json')
    job=read(specimen/'build/native/job.json')
    receipt=read(media/'receipt.json')
    for file,key in [(ROOT/'inputs.json','inputSha256'),(ROOT/'build.mjs','builderSha256'),
        (media/'ending-anchors.json','anchorSha256'),(specimen/'storyboard.json','storyboardSha256'),
        (specimen/'media/clip.mp4','sourceClipSha256')]:
        assert sha(file)==binding[key],(name,key)
    for file,key in [(media/'scene.blend','sceneSha256'),(media/'clip.mp4','sourceClipSha256'),
        (media/'receipt.json','receiptSha256'),(ROOT/'export-anchors.py','exporterSha256')]:
        assert sha(file)==anchors[key],(name,key)
    assert binding['sourceClipSha256']==anchors['sourceClipSha256']==receipt['outputs']['clip.mp4']['sha256']
    assert anchors['holdFramesChecked']==120
    assert [a['value'] for a in anchors['observations']]==item['values']
    assert [a['value'] for a in anchors['ticks']]==item['ticks']
    info=probe(video);w,h=info['width'],info['height'];frames=int(info['nb_read_frames'])
    fps=receipt['config']['fps'];num,den=map(int,info['r_frame_rate'].split('/'))
    assert num/den==fps and frames==binding['frames']==receipt['config']['frames']==444
    assert abs(w/h-anchors['width']/anchors['height'])<1e-9
    assert job['fps']==fps and job['frames']==frames
    by_id={e['id']:e for e in storyboard['beats'][0]['props']['elements']}
    native={e['id']:e for e in job['beats'][0]['props']['elements']}
    for i,value in enumerate(item['values']):
        amount=value*item['valueMultiplier']
        expected=item['valuePrefix']+format(amount,',g')+item['valueSuffix']
        assert by_id[f'value-{i}']['text']==native[f'value-{i}']['text']==expected
        assert by_id[f'month-{i}']['text']==native[f'month-{i}']['text']==item['periods'][i]
    first=round(binding['labelsFullyVisibleSeconds']*fps)
    assert frames-first>=4.5*fps
    assert binding['labelsVisibleFromSeconds']==13.5 and binding['labelsFullyVisibleSeconds']==13.75
    # Common baseline and axis range independently convert source values into
    # screen-space heights. This does not reuse each exported bar-top ordinate.
    ticks={p['value']:p['point'][1]*h for p in anchors['ticks']}
    baseline=ticks[0];domain=max(item['ticks']);full_height=baseline-ticks[domain]
    assert full_height>0
    # Ticks sit behind the bars. At the horizontal ending view, perspective
    # scales these two parallel planes about the image center. Calibrate with
    # their zero baselines; do not reuse any per-bar top anchor.
    bar_baseline=anchors['observations'][0]['base'][1]*h
    assert all(abs(a['base'][1]*h-bar_baseline)<.001 for a in anchors['observations'])
    assert abs((ticks[domain]+baseline)/2-h/2)<.001
    plane_scale=(bar_baseline-h/2)/(baseline-h/2)
    assert 1<=plane_scale<1.02
    columns=[round(a['base'][0]*w) for a in anchors['observations']]
    max_error=0.;bar_checks=0;sample_frames=[]
    process=subprocess.Popen(['ffmpeg','-v','error','-threads','2','-i',str(video),'-vf',f'select=gte(n\\,{first})',
        '-vsync','0','-threads','2','-filter_threads','2','-pix_fmt','rgb24','-f','rawvideo','-'],
        stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    for index in range(first,frames):
        raw=bytearray()
        while len(raw)<w*h*3:
            block=process.stdout.read(w*h*3-len(raw))
            if not block: break
            raw.extend(block)
        assert len(raw)==w*h*3,(name,index,'missing decoded frame')
        rgb=np.frombuffer(raw,dtype=np.uint8).reshape(h,w,3).astype(np.int16)
        blue=(rgb[:,:,2]-rgb[:,:,0]>25)&(rgb[:,:,2]-rgb[:,:,1]>10)
        for i,(x,value) in enumerate(zip(columns,item['values'])):
            rows=np.flatnonzero(blue[:,x-1:x+2].sum(axis=1)>=2)
            assert len(rows)>0,(name,index,i,'missing blue bar')
            predicted_top=bar_baseline-full_height*plane_scale*value/domain
            errors=[abs(float(rows[0])-predicted_top),abs(float(rows[-1])+1-bar_baseline)]
            max_error=max(max_error,*errors)
            assert max(errors)<=3.,(name,index,i,errors,'centerline edge mismatch')
            bar_checks+=1
        if index in (first,frames-1):sample_frames.append(index)
    assert process.stdout.read(1)==b''
    assert process.wait()==0,process.stderr.read().decode()
    # No labels appear in this crop before the ending. Compare decoded clips
    # on the same clock, including late-flight/pullback samples.
    samples=[]
    for seconds in [.5,2,4,6,8,9.5,10.5,12,13.25]:
        index=round(seconds*fps)
        a=frame(video,index,w,h).astype(np.int16)
        b=frame(media/'clip.mp4',index,w,h).astype(np.int16)
        lo,hi=round(h*.23),round(h*.82)
        delta=a[lo:hi]-b[lo:hi]
        error=float(np.abs(delta).mean())
        bias=delta.mean(axis=(0,1))
        residual=float(np.abs(delta-bias).mean())
        # Timing comparison removes only a constant offset per RGB channel.
        # Record raw color differences separately; this is not color-fidelity proof.
        assert residual<2.5,(name,index,residual,'source/native spatial registration')
        neighbors=[]
        for offset in [-1,1]:
            nearby=frame(media/'clip.mp4',index+offset,w,h).astype(np.int16)
            difference=a[lo:hi]-nearby[lo:hi]
            nearby_residual=float(np.abs(difference-difference.mean(axis=(0,1))).mean())
            neighbors.append({'offset':offset,'biasRemovedMeanAbsoluteRgb':nearby_residual})
        assert residual<=min(n['biasRemovedMeanAbsoluteRgb'] for n in neighbors)+.05,(name,index,'neighbor frame fits better')
        samples.append({'frame':index,'meanAbsoluteRgb':error,'channelBias':bias.tolist(),
            'biasRemovedMeanAbsoluteRgb':residual,'adjacentFrameComparisons':neighbors})
    report={'name':name,'status':'pass','videoSha256':sha(video),'checkerSha256':sha(__file__),
        'nativeJobSha256':sha(specimen/'build/native/job.json'),'bindingsSha256':sha(specimen/'bindings.json'),
        'anchorsSha256':sha(media/'ending-anchors.json'),'inputSha256':sha(ROOT/'inputs.json'),
        'encodedSize':[w,h],'frames':frames,'fps':fps,'endingFramesChecked':frames-first,
        'fullyLabeledHoldSeconds':(frames-first)/fps,'barCenterlineChecks':bar_checks,
        'gridBaselinePixels':baseline,'barBaselinePixels':bar_baseline,'barToGridPlaneScale':plane_scale,
        'maximumEdgeErrorPixels':max_error,'edgeTolerancePixels':3.,'registrationSamples':samples,
        'registrationCropY':[.23,.82],'registrationBiasRemovedRgbTolerance':2.5,'adjacentFrameTieTolerance':.05,
        'colorFidelityAccepted':False,
        'limitations':'Checks blue centerlines and source/native timing crops, not OCR, color fidelity, exhaustive pixels, unobscured flight views or continuous playback quality. Timing comparison removes constant channel bias; raw color errors are retained.'}
    out=ROOT/'evidence'/args.revision/name;out.mkdir(parents=True,exist_ok=True)
    (out/'encoded-checks.json').write_text(json.dumps(report,indent=2)+'\n')
    reports.append({'name':name,'status':'pass','endingFrames':frames-first,'maximumEdgeErrorPixels':max_error})
print(json.dumps(reports,indent=2))
