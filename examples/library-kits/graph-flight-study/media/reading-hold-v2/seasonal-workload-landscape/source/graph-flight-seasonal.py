"""Original uneven seasonal observations; source values are fictional."""
from chart_scene import build_chart
VALUES=(52,31,44,27,63,48)
TICKS=(0,20,40,60,80)

def build(config):
    return build_chart(config, VALUES, TICKS)
