"""Original data-height graph and analytic camera flight; exploratory picture."""
import math
import json

VALUES=(18,25,22,34,42,38,53,61)
STEP=3.0
UNIT=.085

def smooth(t):
    t=max(0,min(1,t));return t*t*(3-2*t)

def sample(phase):
    # Smooth entry/exit speed; periodic side changes occur only between bars.
    t=smooth((phase-.08)/.57)
    x=-3+23*t
    y=-3.6*math.cos(math.pi*x/STEP)
    z=1.75+.035*(x+3)
    location=[x,y,z];target=[x+6.5,-1.4*math.sin(math.pi*x/STEP),z-.25]
    u=smooth((phase-.65)/.19)
    final_location=[10.5,-36,2.975]
    final_target=[10.5,0,2.975]
    location=[a+(b-a)*u for a,b in zip(location,final_location)]
    target=[a+(b-a)*u for a,b in zip(target,final_target)]
    heights=[v*UNIT*smooth((x+10.5-i*STEP)/3.5) for i,v in enumerate(VALUES)]
    return {'location':location,'target':target,'heights':heights,'lens':24+24*u,'overview':u}

def build(config):
    import bpy
    from mathutils import Vector
    import artkit as a
    blue=a.material('Satin blue ceramic','#3465aa',roughness=.23,coat=.20)
    bsdf=blue.node_tree.nodes.get('Principled BSDF');nodes=blue.node_tree.nodes;links=blue.node_tree.links
    coords=nodes.new('ShaderNodeTexCoord');noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=120;noise.inputs['Detail'].default_value=2
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.025;bump.inputs['Distance'].default_value=.004
    links.new(coords.outputs['Object'],noise.inputs['Vector']);links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
    line=a.material('Graphite construction lines','#8d969d',roughness=.82,coat=0)
    base=a.material('Matte drafting surface','#eaeeec',roughness=.88,coat=0)
    # A continuous cyclorama removes the floor/world horizon without haze.
    rings=[(40,-.015),(44,.35),(48,1.5),(51,3.5),(53,6.5),(54,11),(54,60)]
    vertices=[];faces=[];segments=128
    for radius,z in rings:
        for j in range(segments):
            angle=math.tau*j/segments;vertices.append((10.5+radius*math.cos(angle),radius*math.sin(angle),z))
    faces.append(tuple(range(segments)))
    for row in range(len(rings)-1):
        for j in range(segments):faces.append((row*segments+j,(row+1)*segments+j,(row+1)*segments+(j+1)%segments,row*segments+(j+1)%segments))
    mesh=bpy.data.meshes.new('Continuous studio surface');mesh.from_pydata(vertices,[],faces);mesh.update()
    stage=bpy.data.objects.new('Seamless stage',mesh);bpy.context.collection.objects.link(stage);mesh.materials.append(base)
    for poly in mesh.polygons:poly.use_smooth=poly.index>0
    # The graph occupies one upright X/Z plane. No floor grid or 3D columns.
    # Horizontal lines are value steps; vertical lines are observation dates.
    for i in range(8):
        a.box('Time grid %d'%i,(.014,.006,5.95),(i*STEP,.066,2.975),line,bevel=0)
    for value in [0,20,40,60,70]:
        a.box('Value grid %d'%value,(23.5,.006,.014),(10.5,.066,value*UNIT),line,bevel=0)
    axis=a.material('Chart axes graphite','#465664',roughness=.8,coat=0)
    a.box('Time axis baseline',(23.7,.012,.028),(10.5,.054,0),axis,bevel=0)
    a.box('Value axis',(.028,.012,6.15),(-1.25,.054,3.075),axis,bevel=0)
    bars=[]
    for i,value in enumerate(VALUES):
        h=value*UNIT
        bar=a.box('Observation %02d'%i,(1.15,.055,h),(i*STEP,0,h/2),blue,bevel=.004)
        # The modifier stays within the original rectangular bounds. Height
        # is data; the edge finish must never add a cap above that height.
        bar['observation']=value;bar['unitHeight']=UNIT;bar['timeIndex']=i
        bars.append(bar)
    world=bpy.data.worlds.new('Neutral studio sky');bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.88,.93,1,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35
    key=a.light('Long grazing key',(6,-9,9),(10.5,0,2),2400,12);key.data.shape='RECTANGLE';key.data.size_y=3
    a.light('Edge separation',(14,6,10),(10.5,0,1),1700,8)
    a.light('Soft entry fill',(-4,-1,5),(4,0,1),550,6)
    data=bpy.data.cameras.new('Camera');camera=bpy.data.objects.new('Camera',data);bpy.context.collection.objects.link(camera);bpy.context.scene.camera=camera
    data.type='PERSP';data.lens=32;data.clip_start=.05;data.clip_end=300;data.dof.use_dof=False
    camera['clearframe_graph_flight']=json.dumps({'version':1,'status':'exploratory','values':VALUES,'timeSpacing':STEP,'heightPerUnit':UNIT,'barWidth':1.15,'barDepth':.055,'flight':[.08,.65],'overview':[.65,.84],'purpose':'Camera crosses the bar plane in the time gaps; full clearance and motion review pending.'})
    def update(phase,frame):
        state=sample(phase)
        for bar,height,value in zip(bars,state['heights'],VALUES):
            bar.scale.z=max(height/(value*UNIT),1e-6);bar.location.z=height/2;a.key(bar,frame,'scale','location')
        camera.location=state['location'];a.aim(camera,state['target']);data.lens=state['lens']
        # Portrait needs a separately fitted overview; defer acceptance until
        # that composition is authored rather than silently cropping it.
        a.key(camera,frame,'location','rotation_euler');data.keyframe_insert(data_path='lens',frame=frame)
    return update
