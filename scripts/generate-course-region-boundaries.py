import json,gzip
from pathlib import Path
from collections import defaultdict
from shapely.geometry import shape,mapping
from shapely.ops import unary_union
source=Path('.local/roads/admin-boundaries.geojson'); groups=defaultdict(list)
for feature in json.loads(source.read_text(encoding='utf-8'))['features']:
 p=feature['properties']; groups[f"{p['sidonm']} {p['sggnm']}"].append(shape(feature['geometry']))
output=Path('public/data/roads/areas');output.mkdir(exist_ok=True);index={}
for i,(name,geometries) in enumerate(sorted(groups.items())):
 geometry=unary_union(geometries).simplify(.00001,preserve_topology=True)
 file=f'{i:03d}.json.gz';data=json.dumps(mapping(geometry),separators=(',',':')).encode()
 (output/file).write_bytes(gzip.compress(data,mtime=0));index[name]=file
(output/'index.json').write_text(json.dumps(index,ensure_ascii=False),encoding='utf-8')
print(f'{len(index)} regional boundaries, compressed bytes {sum(f.stat().st_size for f in output.glob("*.gz"))}')
