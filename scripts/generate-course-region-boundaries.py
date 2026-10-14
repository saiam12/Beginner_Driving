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

# Match shared boundary vertices at approximately 10m precision after simplification.
vertices=defaultdict(set);adjacency={name:set() for name in index}
for name,file in index.items():
 geometry=json.loads(gzip.decompress((output/file).read_bytes()))
 polygons=[geometry['coordinates']] if geometry['type']=='Polygon' else geometry['coordinates']
 for rings in polygons:
  for x,y in rings[0]:vertices[(round(x*10000),round(y*10000))].add(name)
for names in vertices.values():
 for name in names:adjacency[name].update(names-{name})
# Product-defined neighboring choices requested for Seongdong-gu.
name='서울특별시 성동구'
adjacency[name]={f'서울특별시 {district}' for district in ['용산구','동대문구','강남구','광진구','송파구','중구']}
for other,neighbors in adjacency.items():
 if other==name:continue
 if other in adjacency[name]:neighbors.add(name)
 else:neighbors.discard(name)
(output/'adjacency.json').write_text(json.dumps({name:sorted(neighbors) for name,neighbors in adjacency.items()},ensure_ascii=False,indent=2),encoding='utf-8')
