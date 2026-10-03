#!/usr/bin/env python3
"""Bounded independent chart-flight review; no Blender, render or repo edits.

Run: python3 recheck.py --repo /path/to/clearframe-finance-library
Refuses changed reviewed source: geometry and analytic equations below are
manually reviewed assumptions, not a parser for arbitrary future scene code.
"""
import argparse
import datetime
import hashlib
import json
import math
from pathlib import Path
import sys

EXPECTED_SOURCE_HASHES = {'scripts/blender/camera_rig.py': '9836ea1438779dd98bf61ce91f0e10f4adc90adf3957aaff813e0a6c8022130e', 'scripts/blender/chart_scene.py': '68219e7ee14c12bb50d6f025ca0847062b6642f61502780cec0de1ba628de9ed', 'scripts/blender/artkit.py': '82012aac0931d55d37bbe6e1c08494449e8f6891a236439aaa9f58af366084ea', 'scripts/blender/render.py': '6f4a303612907309bd10621b85eb477d351a92045e6eddcc299f51da7f94c294', 'test/chart-flight.test.mjs': '87b8a931421c20f19b218732720e36dfd99912d50d016a37b2ca10887770e802', 'library/sculptures/graph-flight.py': '67a06f67b08623a48329c5821ddd17aa5f2bfbf4d4fe5c7083994a726a387945', 'library/sculptures/graph-flight.json': 'c38e593384151be74506ddd58f9d678a8abb13b4f78d8549f990d375dc47ddd1', 'library/sculptures/graph-flight-seasonal.py': '312d33aad6514632fe2d7a8314a46ed2eda5d4eb1522fc404e359cf1059e3f97', 'library/sculptures/graph-flight-seasonal.json': '32c66f5eaa4c47835a7fb19281459907fa588287736fc6f55ae4a61d7c47ab70', 'engine/lib/sculptures.mjs': '6c06451fadbd1e2d3f023e79b5d2386b19f6825a7a71106af8e9dcd86f2f9d49', 'engine/lib/motion-phases.mjs': '52c8fb4d25f0829725687b59094735aa7f36225378e20b978368aa0118b3ccd9', 'examples/library-kits/graph-flight-study/timing-reading-hold.json': 'c777b7ed4fe5b18caaa89d1118c03a60f235d9bfd21b378e79575acceab84b97'}
INPUTS = {
    'counts': [2, 3, 6, 7, 11, 12],
    'formats': [[1920, 1080], [1080, 1920]],
    'ticks': [[0, 25, 50, 70], [0, .001, .01, 30, 30.001, 69.9, 70],
              [0, 3, 4, 5, 6, 7, 70], [0, 69, 69.1, 69.2, 69.3, 69.4, 70]],
    'valuesRule': 'value[0]=0; value[i]=70*(i+1)/count for i>0',
}

def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()

def box(name, center, dimensions):
    return (name, [a-b/2 for a,b in zip(center,dimensions)],
            [a+b/2 for a,b in zip(center,dimensions)])

def distance(point, bounds):
    return math.sqrt(sum(max(lo-v,0,v-hi)**2
                         for v,lo,hi in zip(point,bounds[1],bounds[2])))

def inverse_ease(t):
    lo,hi=0.,1.
    for _ in range(48):
        mid=(lo+hi)/2
        if mid*mid*(3-2*mid)<t:
            lo=mid
        else:
            hi=mid
    return (lo+hi)/2

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo',default='/Users/brandon/Development/clearframe-finance-library')
    parser.add_argument('--out',default=str(Path(__file__).with_name('report.json')))
    args=parser.parse_args()
    root=Path(args.repo).resolve()
    source_hashes={name:sha(root/name) for name in EXPECTED_SOURCE_HASHES}
    assert source_hashes==EXPECTED_SOURCE_HASHES, 'Reviewed sources changed; revisit proof assumptions before refreshing hashes.'
    sys.dont_write_bytecode=True
    sys.path.insert(0,str(root/'scripts/blender'))
    import camera_rig as rig
    from chart_scene import chart_layout,chart_heights
    results=[]
    for n in INPUTS['counts']:
        for W,H in INPUTS['formats']:
            for ticks in INPUTS['ticks']:
                values=[0 if i==0 else 70*(i+1)/n for i in range(n)]
                layout=chart_layout({'width':W,'height':H},values,ticks)
                p=layout['path'];s=layout['spacing'];height=layout['height'];center=layout['center']
                end_x=2*math.ceil((n-1)/2)*s;A=p['amplitude'];E=p['eye_height'];clear=p['clearance']
                # Full-height bar envelopes conservatively cover every reveal
                # state, including the zero observation's zero-height mesh.
                shapes=[box('bar-'+str(i),(i*s,0,height/2),(layout['barWidth'],.055,height)) for i in range(n)]
                shapes += [box('time-grid-'+str(i),(i*s,.066,height/2),(.014,.006,height)) for i in range(n)]
                shapes += [box('value-grid-'+str(t),(center,.066,t*layout['unit']),(n*s,.006,.014)) for t in ticks]
                shapes += [box('baseline',(center,.054,0),(n*s,.012,.028)),
                           box('value-axis',(-s/2,.054,height/2),(.028,.012,height))]
                end=rig.path_at(p,1);D=-end['location'][1]
                # The regular 128-gon floor contains this disk. All camera
                # points, chart AABB vertices and their connecting segments
                # remain inside it; cyclorama walls lie outside it.
                radial_bound=max(math.hypot(center,A),math.hypot(end_x-center,A),
                                 D,math.hypot(n*s/2+.014,.069))
                disk_margin=layout['stageRadius']*math.cos(math.pi/128)-radial_bound
                assert disk_margin>1e-8
                def flight(q):
                    return (q,-A*math.cos(math.pi*q/s),E)
                start=rig.path_at(p,p['phases'][1])['location'];finish=end['location']
                def pullback(q):
                    return tuple(a+(b-a)*q for a,b in zip(start,finish))
                segments=[('flight',flight,0,end_x,math.sqrt(1+(A*math.pi/s)**2)),
                          ('pullback',pullback,0,1,math.dist(start,finish))]
                leaves=0;max_depth=0;minimum_bound=math.inf;minimum_midpoint=math.inf;nearest=None
                for kind,fn,left,right,speed in segments:
                    intervals=[(left,right,0)]
                    while intervals:
                        a,b,depth=intervals.pop();point=fn((a+b)/2)
                        dd,shape=min((distance(point,sh),sh[0]) for sh in shapes)
                        if dd<minimum_midpoint:
                            minimum_midpoint=dd;nearest={'segment':kind,'shape':shape,'parameter':(a+b)/2}
                        assert dd>clear
                        # Distance to an AABB, and minimum distance to their
                        # union, are 1-Lipschitz. Derivative bound gives a
                        # conservative maximum travel from the midpoint.
                        lower=dd-speed*(b-a)/2-1e-8
                        if lower>clear:
                            leaves+=1;max_depth=max(max_depth,depth);minimum_bound=min(minimum_bound,lower)
                        else:
                            assert depth<22, ('cannot certify interval',n,W,ticks,kind,a,b,shape)
                            intervals.extend([(a,(a+b)/2,depth+1),((a+b)/2,b,depth+1)])
                assert layout['gridCorridor'][0]+clear<E<layout['gridCorridor'][1]-clear
                # Match independent path equations to the implementation at
                # crossings, bar centers, dense turn samples and pullback.
                last_x=(n-1)*s;turn_start=last_x-.4*s;turn_end=min(last_x+.4*s,end_x)
                xs=[0,end_x]+[i*s/2 for i in range(1,int(2*end_x/s))]+[turn_start+(turn_end-turn_start)*k/80 for k in range(81)]+[turn_start-1e-7,turn_end+1e-7]
                xs=[x for x in xs if 0<=x<=end_x]
                phases=[]
                for x in xs:
                    phase=p['phases'][0]+inverse_ease(x/end_x)*(p['phases'][1]-p['phases'][0])
                    pose=rig.path_at(p,phase)
                    assert math.dist(pose['location'],flight(x))<1e-9
                    q=max(0,min(1,(x-turn_start)/(turn_end-turn_start)));blend=q*q*(3-2*q)
                    initial_target=(x+2.2*s,0,E-.04*height)
                    expected_target=tuple(a+(b-a)*blend for a,b in zip(initial_target,(center,0,height/2)))
                    assert math.dist(pose['target'],expected_target)<1e-9
                    phases.append(phase)
                for j in range(21):
                    q=j/20;phase=p['phases'][1]+(p['phases'][2]-p['phases'][1])*q
                    u=q*q*(3-2*q)
                    assert math.dist(rig.path_at(p,phase)['location'],pullback(u))<1e-9
                    phases.append(phase)
                phases += [0,1]
                forward=[rig.path_at(p,t) for t in phases]
                minimum_look=math.inf
                for t,pose in reversed(list(zip(phases,forward))):
                    assert rig.path_at(p,t)==pose
                    look=math.hypot(*(b-a for a,b in zip(pose['location'][:2],pose['target'][:2])))
                    minimum_look=min(minimum_look,look)
                    assert look>.001
                    heights=chart_heights(t,values,layout['unit'],p['phases'])
                    assert heights[0]==0 and all(0<=h<=v*layout['unit'] for h,v in zip(heights,values))
                assert chart_heights(1,values,layout['unit'],p['phases'])==[v*layout['unit'] for v in values]
                assert end['target']==[center,0,height/2] and end['lens']==48
                for x in [-s/2,(n-.5)*s]:
                    for z in [0,height]:
                        px=.5+(x-center)*48/(36*D)
                        py=.5+(z-height/2)*48*W/(36*D*H)
                        assert p['margin']-1e-12<=px<=1-p['margin']+1e-12
                        assert p['margin']-1e-12<=py<=1-p['margin']+1e-12
                # Analytic nondegeneracy: pre-turn dx=2.2*s. During the turn
                # abs(camera.y) >= A*cos(.4*pi)>0, on either chart side.
                # After the turn the target is fixed at chart center and
                # x-center >= turn_end-center>0, even at the next plane crossing.
                # Pullback starts at an even/front slot and stays in front.
                look_lower=min(2.2*s,A*math.cos(.4*math.pi),turn_end-center,A,D)
                assert look_lower>.001
                results.append({'count':n,'format':[W,H],'values':values,'ticks':ticks,
                    'path':p,'flightEndX':end_x,'turnWindowX':[turn_start,turn_end],'aabbCount':len(shapes),'certifiedClearance':clear,
                    'minimumCertifiedIntervalBound':minimum_bound,
                    'minimumCheckedMidpointDistance':minimum_midpoint,'nearestCheckedMidpoint':nearest,
                    'certifiedIntervals':leaves,'maximumSubdivisionDepth':max_depth,
                    'stageInradiusMargin':disk_margin,'sampledHorizontalLookMinimum':minimum_look,
                    'analyticHorizontalLookLowerBound':look_lower,'seekSamples':len(phases),
                    'zeroAndFinalHeightsPass':True,'endpointDeclaredBoundsPass':True})
    # Catch a source edit while the check was running.
    assert {name:sha(root/name) for name in EXPECTED_SOURCE_HASHES}==source_hashes
    report={'status':'pass','reviewedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'repository':str(root),'scriptSha256':sha(__file__),'sourceHashes':source_hashes,
        'inputs':INPUTS,'inputsSha256':hashlib.sha256(json.dumps(INPUTS,sort_keys=True,separators=(',',':')).encode()).hexdigest(),
        'coverage':{'layouts':len(results),'counts':INPUTS['counts'],'formats':INPUTS['formats'],
                    'irregularTickSets':4,'motion':'complete analytic flight and straight pullback, including endpoints'},
        'method':'Adaptive distance-to-AABB Lipschitz bounds certify all points of each tested path; separate critical-point checks bind the reviewed analytic equations to production samples.',
        'assumptions':[
            'Geometry constants are read manually from the exact hashed build_chart source, not extracted from an evaluated Blender scene.',
            'Every bar is contained in its full declared rectangular envelope. The inward bevel does not enlarge it; height reveal stays between zero and the original value.',
            'Grid and axes retain the hashed dimensions and locations, without animated transforms or other obstacles.',
            'The flight parameter covers x=0 through 2*ceil((count-1)/2)*spacing continuously and monotonically. The end slot is even/front and lies at or beyond the last real bar. Pullback is a straight interpolation after flight ends.',
            'The target turns across [last_x-.4*spacing,min(last_x+.4*spacing,end_x)]. During it abs(Y)>=amplitude*cos(.4*pi); afterward the fixed center target stays strictly behind the camera in X until the front-half-space pullback.',
            'AABB distance is 1-Lipschitz. Flight speed in x units is bounded by sqrt(1+(A*pi/spacing)^2); pullback speed in u units equals endpoint distance.',
            'The 128-sided flat-stage footprint is convex. The conservative radial bounds cover camera locations and chart AABB vertices; connecting sightlines stay within its inradius and above the floor.',
            'Endpoint projection assumes square pixels, horizontal 36 mm sensor, 48 mm lens, zero shift and a frontal camera, as the hashed bind/build source specifies.',
            'Double-precision arithmetic uses an extra 1e-8 world-unit safety deduction; this is numerical certification, not a formal outward-rounded interval proof.'],
        'limits':[
            'Only the 48 explicit input/layout cases are certified; this is not exhaustive coverage of arbitrary ticks, dimensions or future code.',
            'Clearance concerns the camera point plus the declared 0.18 radius, not its entire optical frustum or arbitrary added objects.',
            'Endpoint fit checks declared chart bounds, not yet-added labels or overlay safe zones.',
            'No Blender render, evaluated-mesh extraction, encoded motion inspection, shading check or continuous playback was performed by this script.',
            'Reverse sampling checks pure poses, not saved Blender animation playback. Visual quality and motion acceptance are separate.'],
        'summary':{'minimumCertifiedClearanceBound':min(r['minimumCertifiedIntervalBound'] for r in results),
                   'minimumStageInradiusMargin':min(r['stageInradiusMargin'] for r in results),
                   'minimumAnalyticHorizontalLookBound':min(r['analyticHorizontalLookLowerBound'] for r in results)},
        'results':results}
    Path(args.out).write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'status':report['status'],'layouts':len(results),'report':str(Path(args.out).resolve()),'summary':report['summary']}))

if __name__=='__main__':
    main()
