import importlib.util
from pathlib import Path
from shapely.geometry import LineString, Point
from shapely.strtree import STRtree

spec = importlib.util.spec_from_file_location('its_match', Path(__file__).with_name('map-daegu-accidents-to-its.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
roads = [LineString([(0, 0), (100, 0)]), LineString([(0, 0), (100, 0)]), LineString([(0, 40), (100, 40)])]
tree = STRtree(roads)
ids = ['200', '100', '300']
assert module.nearest_assignment(Point(50, 15), tree, roads, ids) == (1, 15, True)
assert module.nearest_assignment(Point(50, 15.0001), tree, roads, ids)[0] is None
assert module.nearest_assignment(Point(50, 39), tree, roads, ids) == (2, 1, False)
assert module.nearest_assignment(Point(500, 500), tree, roads, ids)[0] is None
print('PASS: 15m boundary, nearest geometry, one assignment and deterministic tie break')
