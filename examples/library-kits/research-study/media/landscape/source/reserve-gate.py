"""Original qualitative access mechanism; no liquid, simulated force or amount encoding."""
import math
import artkit as a


def build(config):
    c=config['colors']
    porcelain=a.material('Matte porcelain', '#e3e2e5', roughness=.58, coat=.10)
    orange=a.material('Amber enamel gate',c['accent2'],roughness=.28,coat=.28)
    rail=a.material('Graphite guide hardware',c['ink'],metallic=.45,roughness=.32)
    lining=a.material('Muted violet lining','#9586b4',roughness=.66,coat=.04)
    camera=a.studio(config,target=(0,0,1.0),scale=13.0 if config['width']>=config['height'] else 10.2,dark=False)
    camera.location=(7,-11,8)
    a.aim(camera,(0,0,1.0))
    # Two connected open basins, with a visible channel floor and outside walls.
    a.box('Porcelain plinth',(6.8,3.0,.28),(0,0,.16),porcelain,bevel=.10)
    a.box('Recessed violet floor',(6.1,2.1,.055),(0,0,.335),lining,bevel=.035)
    for y in [-1.18,1.18]:
        a.box('Continuous channel wall',(6.45,.25,.78),(0,y,.70),porcelain,bevel=.045)
    for x in [-3.10,3.10]:
        a.box('End wall',(.25,2.45,.78),(x,0,.70),porcelain,bevel=.045)
    # The gate overlaps the two jambs, so a closed gate has no false side passage.
    for y in [-1.06,1.06]:
        a.box('Upright guide',(.32,.22,2.45),(0,y,1.57),rail,bevel=.035)
    a.box('Guide crossbar',(.34,2.36,.20),(0,0,2.77),rail,bevel=.035)
    gate=a.box('Opening gate',(.20,2.10,.84),(0,0,.76),orange,bevel=.025)
    spindle=a.cylinder('Gate lift spindle',(0,0,1.975),.065,1.59,rail)
    collar=a.cylinder('Fixed spindle collar',(0,0,2.78),.14,.13,rail)
    # The fixed handle is a visual connection, not a simulated threaded drive.
    a.box('Operating grip',(.85,.12,.12),(0,0,2.96),rail,bevel=.045)
    base_z=.76
    def update(phase,frame):
        t=min(1,max(0,(phase-.2)/.45))
        lift=1.10*(t*t*(3-2*t))
        gate.location.z=base_z+lift
        spindle.location.z=1.975+lift*.5
        spindle.scale.z=1-lift/1.59
        a.key(gate,frame,'location')
        a.key(spindle,frame,'location','scale')
    return update
