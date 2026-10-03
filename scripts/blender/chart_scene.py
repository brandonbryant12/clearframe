"""Original flat chart geometry shared by graph-flight recipe examples.

Only the Blender build imports bpy; data/layout can be inspected independently.
"""
import json
import math
import camera_rig as rig


def smooth(t):
    t=max(0,min(1,t)); return t*t*(3-2*t)


def chart_layout(config, values, ticks):
    if not isinstance(values, (list, tuple)) or not 2 <= len(values) <= 12:
        raise ValueError('Chart needs 2–12 original observations.')
    if not isinstance(ticks, (list, tuple)) or not 2 <= len(ticks) <= 8:
        raise ValueError('Chart needs 2–8 explicit ticks.')
    for value in [*values, *ticks]:
        rig.number(value, 0, 1e9, 'chart value')
    if ticks[0] != 0 or ticks[-1] <= 0 or any(a >= b for a,b in zip(ticks,ticks[1:])) or max(values) > ticks[-1]:
        raise ValueError('Chart ticks must increase from zero and include every value.')
    rig.number(config['width'], 1, 16384, 'width')
    rig.number(config['height'], 1, 16384, 'height')
    vertical=config['height'] > config['width']
    step, height, width, amplitude = (1.3,11.9,.65,4.2) if vertical else (3,5.95,1.15,3.6)
    unit=height/ticks[-1]
    corridors=[(a*unit+.007,b*unit-.007) for a,b in zip(ticks,ticks[1:])
               if (b-a)*unit>.014+2*.18]
    if not corridors:
        raise ValueError('No horizontal grid corridor can clear the camera.')
    corridor=min(corridors,key=lambda pair:abs(sum(pair)/2-height*.4))
    eye_height=sum(corridor)/2
    path=rig.make_chart_flight(count=len(values),spacing=step,bar_width=width,bar_depth=.055,
        chart_height=height,amplitude=amplitude,clearance=.18,aspect=config['width']/config['height'],
        eye_height=eye_height)
    stage_radius=max(40, -rig.path_at(path,1)['location'][1]+3,
                     (2*math.ceil(len(values)/2)-(len(values)-1)/2)*step+3)
    return {'spacing':step,'height':height,'unit':unit,'center':(len(values)-1)*step/2,
            'barWidth':width,'stageRadius':stage_radius,'gridCorridor':list(corridor),'path':path}


def chart_heights(phase, values, unit, phases):
    rig.number(phase,0,1,'chart phase')
    t=smooth((phase-phases[0])/(phases[1]-phases[0]))
    return [value*unit*smooth((t*(len(values)+1)+1.8-i)/1.25) for i,value in enumerate(values)]


def build_chart(config, values, ticks):
    layout = chart_layout(config, values, ticks)
    step, unit = layout["spacing"], layout["unit"]
    height, center = layout["height"], layout["center"]
    path = layout["path"]
    import bpy
    import artkit as a
    blue=a.material('Satin blue ceramic','#3465aa',roughness=.23,coat=.20)
    bsdf=blue.node_tree.nodes.get('Principled BSDF');nodes=blue.node_tree.nodes;links=blue.node_tree.links
    coords=nodes.new('ShaderNodeTexCoord');noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=120;noise.inputs['Detail'].default_value=2
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.025;bump.inputs['Distance'].default_value=.004
    links.new(coords.outputs['Object'],noise.inputs['Vector']);links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
    line=a.material('Graphite construction lines','#a9afb4',roughness=.82,coat=0)
    # Guide color is independent of the grazing lights; avoid bright wire-like
    # highlights when the camera sees the rear of the chart.
    node=line.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value=(0,0,0,1)
    node.inputs['Emission Color'].default_value=a.linear_rgba('#a9afb4')
    node.inputs['Emission Strength'].default_value=1
    base=a.material('Matte drafting surface','#eaeeec',roughness=.88,coat=0)
    # A continuous cyclorama removes the floor/world horizon without haze.
    radius=layout['stageRadius']
    rings=[(radius,-.015),(radius+4,.35),(radius+8,1.5),(radius+11,3.5),
           (radius+13,6.5),(radius+14,11),(radius+14,60)]
    vertices=[];faces=[];segments=128
    for radius,z in rings:
        for j in range(segments):
            angle=math.tau*j/segments;vertices.append((center+radius*math.cos(angle),radius*math.sin(angle),z))
    faces.append(tuple(range(segments)))
    for row in range(len(rings)-1):
        for j in range(segments):faces.append((row*segments+j,(row+1)*segments+j,(row+1)*segments+(j+1)%segments,row*segments+(j+1)%segments))
    mesh=bpy.data.meshes.new('Continuous studio surface');mesh.from_pydata(vertices,[],faces);mesh.update()
    stage=bpy.data.objects.new('Seamless stage',mesh);bpy.context.collection.objects.link(stage);mesh.materials.append(base)
    for poly in mesh.polygons:poly.use_smooth=poly.index>0
    # The graph occupies one upright X/Z plane. No floor grid or 3D columns.
    # Horizontal lines are value steps; vertical lines are observation dates.
    for i in range(len(values)):
        a.box('Time grid %d'%i,(.014,.006,height),(i*step,.066,height/2),line,bevel=0)
    for value in ticks:
        a.box('Value grid %d'%value,(len(values)*step,.006,.014),(center,.066,value*unit),line,bevel=0)
    axis=a.material('Chart axes graphite','#465664',roughness=.8,coat=0)
    a.box('Time axis baseline',(len(values)*step,.012,.028),(center,.054,0),axis,bevel=0)
    a.box('Value axis',(.028,.012,height),(-step/2,.054,height/2),axis,bevel=0)
    bars=[]
    for i,value in enumerate(values):
        h=value*unit
        bar=a.box('Observation %02d'%i,(layout["barWidth"],.055,max(h,.001)),(i*step,0,h/2),blue,bevel=.004)
        # The modifier stays within the original rectangular bounds. Height
        # is data; the edge finish must never add a cap above that height.
        bar['observation']=value;bar['unitHeight']=unit;bar['timeIndex']=i
        bars.append(bar)
    world=bpy.data.worlds.new('Neutral studio sky');bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.88,.93,1,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35
    key=a.light('Long grazing key',(center-4.5,-9,height+3),(center,0,height/3),2400,12);key.data.shape='RECTANGLE';key.data.size_y=3
    a.light('Edge separation',(center+3.5,6,height+4),(center,0,height/3),1700,8).data.use_shadow=False
    a.light('Soft entry fill',(-4,-1,5),(4,0,1),550,6).data.use_shadow=False
    data=bpy.data.cameras.new('Camera');camera=bpy.data.objects.new('Camera',data);bpy.context.collection.objects.link(camera);bpy.context.scene.camera=camera
    data.type='PERSP';data.lens=32;data.clip_start=.05;data.clip_end=300;data.dof.use_dof=False
    camera['clearframe_graph_flight']=json.dumps({'version':2,'status':'exploratory','values':values,'ticks':ticks,'heightPerUnit':unit,'layout':layout,'purpose':'Flat data chart with declared camera clearance; perspective is not a common screen-space comparison.'})
    camera['clearframe_camera_review']=camera['clearframe_graph_flight']
    camera_update = rig.bind(camera, path)
    def update(phase,frame):
        heights = chart_heights(phase, values, unit, path['phases'])
        for bar, height, value in zip(bars, heights, values):
            bar.scale.z=height/max(value*unit,.001)
            bar.location.z=height/2
            a.key(bar,frame,'scale','location')
        camera_update(phase, frame)
    return update
