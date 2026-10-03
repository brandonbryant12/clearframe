"""Original rising observations on a flat chart; source values are fictional."""
from chart_scene import build_chart
VALUES=(18,25,22,34,42,38,53,61)
TICKS=(0,20,40,60,70)

def build(config):
    return build_chart(config, VALUES, TICKS)
