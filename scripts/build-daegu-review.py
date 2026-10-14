"""Build an offline, case-by-case human review artifact from the spatial results."""
import csv
import json
import math
import runpy
from pathlib import Path

from pyproj import Transformer
from shapely.ops import transform as transform_geometry

ROOT = Path(__file__).resolve().parents[1]
s = runpy.run_path(str(ROOT / 'scripts/rematch-daegu-accidents-2024.py'))
out, roads, points, tree = s['OUT'], s['roads'], s['points'], s['tree']
results, geometries, group_of = s['results'], s['geometries'], s['group_of']
mercator = Transformer.from_crs(roads.crs, 3857, always_xy=True)
cases = []
review_rows = []
for row, point in zip(results, points, strict=True):
    if row['status'] not in ('review_required', 'no_candidate_within_50m', 'coordinate_outside_daegu_region'):
        continue
    indices = [] if row['status']=='coordinate_outside_daegu_region' else [int(i) for i in tree.query(point.buffer(600))]
    indices = sorted(indices, key=lambda i: (point.distance(geometries[i]), int(roads.iloc[i].id)))
    nearest = [(point.distance(geometries[i]), i) for i in indices]
    candidates = [(d,i) for d,i in nearest if d <= 50]
    # Wider candidates are for manual inspection only; never enter automatic counts.
    if not candidates:
        candidates = [(d,i) for d,i in nearest if d <= 500][:6]
    candidate_indices = {i for d,i in candidates}
    x,y = mercator.transform(point.x,point.y)
    display_roads = []
    for d,i in nearest:
        clipped = geometries[i].intersection(point.buffer(600).envelope)
        geom = transform_geometry(mercator.transform, clipped)
        parts = list(geom.geoms) if hasattr(geom,'geoms') else [geom]
        lines = [[[round(cx-x,2), round(cy-y,2)] for cx,cy in line.coords] for line in parts if line.geom_type=='LineString']
        if lines:
            rr = roads.iloc[i]
            display_roads.append({'id':rr.id,'name':str(rr.road_name),'group':group_of[i], 'd':round(d,3),'candidate':i in candidate_indices,'lines':lines})
    case = dict(row)
    case.update(x=x,y=y,roads=display_roads)
    cases.append(case)
    review_rows.append([row['accident_id'],row['status'],row['reasons'],row['longitude'],row['latitude'],row['route_name'],row['road_form'],'|'.join(roads.iloc[i].id for d,i in candidates),'','',''])

with (out/'manual-review.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.writer(f)
    w.writerow(['accident_id','status','reasons','longitude','latitude','route_name','road_form','candidate_link_ids','review_decision','selected_link_or_group','review_note'])
    w.writerows(review_rows)
with (out/'corridor-membership.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.writer(f);w.writerow(['lev5_5_link_id','corridor_id','road_name','length_km'])
    w.writerows([r.id,group_of[i],r.road_name,r.k_length] for i,r in roads.iterrows())

old_rows=list(csv.DictReader((ROOT/'outputs/daegu-accident-matching-2024/사고별_링크매칭.csv').open(encoding='utf-8-sig')))
assert [r['accident_id'] for r in old_rows]==[r['accident_id'] for r in results]
transitions={}
for a,b in zip(old_rows,results,strict=True):
    key=a['status']+' -> '+b['status'];transitions[key]=transitions.get(key,0)+1
report=json.loads((out/'report.json').read_text(encoding='utf-8'))
report['transitions_from_v1']=transitions
report['review_case_count']=len(cases)
report['accident_to_road_operation']=Transformer.from_crs(5179,roads.crs,always_xy=True).description
report['reverse_pairs']={'groups':sum(len(v)>1 for v in s['members'].values()),'criterion':'reversed node IDs, equal road name/rank/number/link_type, Hausdorff <=30m; geometric grouping remains an estimate'}
(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
(out/'review-data.json').write_text(json.dumps(cases,ensure_ascii=False,allow_nan=False),encoding='utf-8')
template=(ROOT/'scripts/daegu-review-template.html').read_text(encoding='utf-8')
payload=json.dumps(cases,ensure_ascii=False,allow_nan=False).replace('</','<\\/')
(out/'검토지도.html').write_text(template.replace('/*CASE_DATA*/',payload),encoding='utf-8')
assert len(cases)==sum(report['statuses'].get(k,0) for k in ('review_required','no_candidate_within_50m','coordinate_outside_daegu_region'))
assert sum(s['corridor_counts'].values())==report['corridor_counted_accidents']
assert all(row['lev5_5_link_id_estimate']=='' for row in results if row['status']=='corridor_estimate_direction_ignored')
print(json.dumps({'review_cases':len(cases),'transitions':transitions,'reverse_groups':report['reverse_pairs']['groups']},ensure_ascii=True))
