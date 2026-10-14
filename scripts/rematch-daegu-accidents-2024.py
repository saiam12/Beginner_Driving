"""Exploratory spatial matching. Never publishes inferred counts into the app."""
import csv
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

import geopandas as gpd
from pyproj import Transformer
from shapely.geometry import Point, box, mapping
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'outputs/daegu-accident-matching-2024-v2'
OUT.mkdir(parents=True, exist_ok=True)
RAW = ROOT / '.local/daegu-accidents-2024/response.json'
response = json.loads(RAW.read_text(encoding='utf-8-sig'))['resultValue']
accidents = response['accidentInfoList']
assert len(accidents) == response['paginationInfo']['totalRecordCount']
assert len({a['acdnt_no'] for a in accidents}) == len(accidents)
assert all(a['acdnt_year'] == '2024' and a['legaldong_code'].startswith('27') for a in accidents)

network = ROOT / '.local/viewt/level55-2024'
roads = gpd.read_file(network / 'daegu/daegu_link_lev5.5_2024.shp', encoding='cp949')
road_crs = roads.crs
points = gpd.GeoSeries([Point(float(a['x_crdnt']), float(a['y_crdnt'])) for a in accidents], crs=5179).to_crs(road_crs)
assert all(math.isfinite(p.x) and math.isfinite(p.y) for p in points)
to_wgs = Transformer.from_crs(road_crs, 4326, always_xy=True)
valid_location = [127 < to_wgs.transform(p.x,p.y)[0] < 130 and 34 < to_wgs.transform(p.x,p.y)[1] < 38 for p in points]
extent = box(*points[valid_location].total_bounds).buffer(100)
source_hashes = {}
for province in ('daegu', 'gyeongbuk', 'gyeongnam'):
    shp = network / province / f'{province}_link_lev5.5_2024.shp'
    source_hashes[province] = hashlib.sha256(shp.read_bytes()).hexdigest()
    if province != 'daegu':
        other = gpd.read_file(shp, encoding='cp949').to_crs(road_crs)
        other = other[other.intersects(extent)]
        import pandas as pd
        roads = gpd.GeoDataFrame(pd.concat([roads, other], ignore_index=True), crs=road_crs)
roads['id'] = roads.k_link_id.map(lambda v: str(int(v)))
assert not roads.id.duplicated().any()
roads = roads[roads.intersects(extent)].reset_index(drop=True)
geometries = list(roads.geometry)
tree = STRtree(geometries)

# Collapse only near-identical opposite-direction links with matching attributes.
# This allows corridor counts without duplicating accidents into both directions.
buckets = defaultdict(list)
for i, r in roads.iterrows():
    key = (tuple(sorted((int(r.fnode_id), int(r.tnode_id)))), str(r.road_name), str(r.road_rank), str(r.road_no), str(r.link_type))
    buckets[key].append(i)
group_of, members = {}, {}
for indices in buckets.values():
    remaining = list(indices)
    while remaining:
        first = remaining.pop(0)
        same = [first]
        for i in remaining[:]:
            a, b = roads.iloc[first], roads.iloc[i]
            reverse = a.fnode_id == b.tnode_id and a.tnode_id == b.fnode_id
            if reverse and geometries[first].hausdorff_distance(geometries[i]) <= 30:
                same.append(i)
                remaining.remove(i)
        gid = '|'.join(sorted(roads.iloc[same].id, key=int))
        members[gid] = same
        for i in same:
            group_of[i] = gid

transform = Transformer.from_crs(road_crs, 4326, always_xy=True)
results, candidates, point_features = [], [], []
link_counts, corridor_counts = Counter(), Counter()
status_counts, sensitivity = Counter(), Counter()

def endpoints(geom):
    parts = list(geom.geoms) if hasattr(geom, 'geoms') else [geom]
    return [Point(c) for p in parts for c in (p.coords[0], p.coords[-1])]

for a, point, valid in zip(accidents, points, valid_location, strict=True):
    nearby = []
    for idx in (tree.query(point.buffer(50)) if valid else []):
        idx = int(idx)
        distance = point.distance(geometries[idx])
        if distance <= 50:
            nearby.append((distance, idx))
    nearby.sort(key=lambda v: (v[0], int(roads.iloc[v[1]].id)))
    grouped = {}
    for distance, idx in nearby:
        grouped.setdefault(group_of[idx], (distance, idx))
    ordered = sorted(grouped.items(), key=lambda v: (v[1][0], v[0]))
    reasons, selected, best_group = [], '', ''
    status = 'no_candidate_within_50m'
    distance = None
    if ordered:
        best_group, (distance, idx) = ordered[0]
        r = roads.iloc[idx]
        runner_up = ordered[1][1][0] if len(ordered) > 1 else float('inf')
        if distance > 30:
            reasons.append('distance_over_30m')
        if runner_up - distance < 8:
            reasons.append('competing_corridor_within_8m')
        road_form = str(a.get('road_stle_dc') or '')
        if ('교차로' in road_form or min(point.distance(p) for p in endpoints(geometries[idx])) < 15) and runner_up <= 12:
            reasons.append('intersection_or_near_endpoint')
        if any(v in road_form for v in ('고가도로', '지하차도', '터널', '주차장')):
            reasons.append('road_level_or_parking_uncertain')
        route = str(a.get('route_nm') or '').strip()
        if route and not route.startswith(('일반국도', '고속국도', '지방도')) and route != str(r.road_name).strip():
            reasons.append('road_name_not_equal')
        if not reasons:
            # Threshold stability is evidence, not a measured accuracy score.
            if distance > 20:
                reasons.append('unstable_at_20m_threshold')
        if reasons:
            status = 'review_required'
        elif len(members[best_group]) > 1:
            status = 'corridor_estimate_direction_ignored'
            corridor_counts[best_group] += 1
        else:
            status = 'single_link_estimate'
            selected = roads.iloc[idx].id
            link_counts[selected] += 1
            corridor_counts[best_group] += 1
        for threshold in (20, 30, 50):
            if distance <= threshold:
                sensitivity[f'nearest_within_{threshold}m'] += 1
        for rank, (d, i) in enumerate(nearby, 1):
            rr = roads.iloc[i]
            candidates.append([a['acdnt_no'], rr.id, group_of[i], rank, round(d, 3), rr.road_name, rr.road_rank, rr.road_no])
    else:
        if valid:
            reasons.append('no_candidate_within_50m')
        else:
            status = 'coordinate_outside_daegu_region'
            reasons.append('daegu_record_coordinate_outside_regional_bounds')
    longitude, latitude = transform.transform(point.x, point.y)
    row = {
        'accident_id': a['acdnt_no'], 'year': 2024, 'district': a['legaldong_name'],
        'longitude': longitude, 'latitude': latitude,
        'lev5_5_link_id_estimate': selected, 'nearest_candidate_group': best_group,
        'status': status, 'reasons': ';'.join(reasons),
        'nearest_distance_m': '' if distance is None else round(distance, 3),
        'candidate_links_within_50m': len(nearby), 'route_name': a.get('route_nm') or '',
        'road_form': a.get('road_stle_dc') or '', 'severity': a.get('acdnt_gae_dc') or '',
    }
    results.append(row)
    status_counts[status] += 1
    point_features.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [longitude, latitude]}, 'properties': row})

def csv_file(name, headers, data):
    with (OUT / name).open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(headers)
        w.writerows(data)

csv_file('사고별_링크매칭.csv', list(results[0]), [list(r.values()) for r in results])
csv_file('사고별_전체후보.csv', ['accident_id','lev5_5_link_id','candidate_group','rank','distance_m','road_name','road_rank','road_no'], candidates)
csv_file('링크별_추정사고건수.csv', ['year','lev5_5_link_id','road_name','single_link_estimated_count','length_km','estimated_count_per_km'], [
    [2024,r.id,r.road_name,link_counts[r.id],r.k_length,round(link_counts[r.id]/float(r.k_length),3) if float(r.k_length)>0 else '']
    for _,r in roads.iterrows() if r.id in link_counts
])
csv_file('구간별_추정사고건수.csv', ['year','candidate_link_ids','road_name','estimated_count','single_candidate_link'], [
    [2024,g,roads.iloc[members[g][0]].road_name,n,len(members[g])==1] for g,n in sorted(corridor_counts.items())
])
assert sum(status_counts.values()) == len(accidents)
assert sum(link_counts.values()) == status_counts['single_link_estimate']
assert sum(corridor_counts.values()) == status_counts['single_link_estimate'] + status_counts['corridor_estimate_direction_ignored']
for r in results:
    assert bool(r['lev5_5_link_id_estimate']) == (r['status']=='single_link_estimate')
    if r['lev5_5_link_id_estimate']:
        assert len(members[r['nearest_candidate_group']])==1
        assert roads.iloc[members[r['nearest_candidate_group']][0]].id == r['lev5_5_link_id_estimate']

point_geojson = {'type':'FeatureCollection','features':point_features}
(OUT / '사고매칭_지도.geojson').write_text(json.dumps(point_geojson,ensure_ascii=False),encoding='utf-8')
roads_wgs = roads.to_crs(4326)
road_features = [{'type':'Feature','geometry':mapping(r.geometry),'properties':{'lev5_5_link_id':r.id,'road_name':r.road_name}} for _,r in roads_wgs.iterrows()]
(OUT / '도로링크_지도.geojson').write_text(json.dumps({'type':'FeatureCollection','features':road_features},ensure_ascii=False),encoding='utf-8')
report = {
    'scope':'Daegu including Gunwi, 2024; local validation case',
    'raw_accidents':len(accidents),'unique_accident_ids':len(results),'candidate_road_links':len(roads),
    'statuses':dict(status_counts),'distance_sensitivity':dict(sensitivity),
    'single_link_counted_accidents':sum(link_counts.values()),'single_links_with_estimates':len(link_counts),
    'corridor_counted_accidents':sum(corridor_counts.values()),
    'manual_ground_truth_accuracy':'not measured; all matches remain estimates',
    'accident_crs':'EPSG:5179, confirmed in TAAS srh/tas.js x_crdnt transformation',
    'road_crs_wkt':road_crs.to_wkt(),'coordinate_operation':str(transform.get_last_used_operation().description),
    'source_sha256':{'accidents':hashlib.sha256(RAW.read_bytes()).hexdigest(),**source_hashes},
    'rules':{'candidate_radius_m':50,'max_distance_m':20,'runner_up_gap_m':8,'endpoint_exclusion_m':15,'reverse_geometry_tolerance_m':30,'junction_competing_group_distance_m':12},
}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ('road_crs_wkt','source_sha256')},ensure_ascii=False))

# Standalone offline vector overlay: preserves coordinates, supports zoom and inspection.
minx,miny,maxx,maxy=points[valid_location].total_bounds
scale=900/max(maxx-minx,maxy-miny)
def xy(x,y): return ((x-minx)*scale+35,(maxy-y)*scale+35)
road_svg=[]
for _,r in roads.iterrows():
    parts=list(r.geometry.geoms) if hasattr(r.geometry,'geoms') else [r.geometry]
    for line in parts:
        coords=' '.join(f'{x:.2f},{y:.2f}' for x,y in (xy(*c) for c in line.coords))
        road_svg.append(f'<polyline points="{coords}" fill="none" stroke="#b2bdc9" stroke-width="0.45"/>')
colors={'single_link_estimate':'#16834a','corridor_estimate_direction_ignored':'#1a66c4','review_required':'#dd8411','no_candidate_within_50m':'#cc334c'}
import html
point_svg=[]
for r,p in zip(results,points,strict=True):
    if r['status'] == 'coordinate_outside_daegu_region':
        continue
    x,y=xy(p.x,p.y)
    title=html.escape(f"사고 {r['accident_id']} / {r['district']} / 후보 {r['nearest_candidate_group']} / {r['nearest_distance_m']}m / {r['status']} / {r['reasons']}")
    point_svg.append(f'<circle class="accident" data-status="{r["status"]}" cx="{x:.2f}" cy="{y:.2f}" r="1.8" fill="{colors[r["status"]]}"><title>{title}</title></circle>')
legend=' '.join(f'<label><input type="checkbox" checked onchange="document.querySelectorAll(\'[data-status={s}]\').forEach(e=>e.style.display=this.checked?\'\':\'none\')"> <span style="color:{colors[s]}">{label} {status_counts[s]:,}건</span></label>' for s,label in [('single_link_estimate','단일 링크 추정'),('corridor_estimate_direction_ignored','방향 미구분 구간 추정'),('review_required','검토 필요'),('no_candidate_within_50m','50m 내 후보 없음')])
page='''<!doctype html><meta charset="utf-8"><title>대구 2024 사고·Level 5.5 겹침 지도</title><style>body{font:15px sans-serif;margin:24px;color:#23354b}label{margin-right:18px}svg{background:#f7f9fc;border:1px solid #d4dce6;width:100%;height:78vh;touch-action:none}button{padding:8px;margin:6px}.accident:hover{stroke:#111;stroke-width:1}</style><h1>대구 2024 사고·Level 5.5 겹침 지도</h1><p>사고 10,222건 · 군위 포함 · 대구 외 좌표 1건은 지도에서 제외 · 모든 연결은 공간 추정입니다. 방향이 불명확한 사고를 양쪽 링크에 중복 집계하지 않았습니다.</p><p>색상을 켜거나 끌 수 있습니다. 마우스 휠로 확대, 드래그로 이동, 점에 마우스를 올려 후보 ID·거리·검토 사유를 확인하세요.</p>LEGEND<button onclick="v=[0,0,1000,1000];update()">초기화</button><svg id="map" viewBox="0 0 1000 1000">ROADSPOINTS</svg><script>let v=[0,0,1000,1000],drag;const map=document.getElementById('map');function update(){map.setAttribute('viewBox',v.join(' '))}map.addEventListener('wheel',e=>{e.preventDefault();let b=map.getBoundingClientRect(),x=(e.clientX-b.left)/b.width,y=(e.clientY-b.top)/b.height,k=e.deltaY>0?1.2:1/1.2;v=[v[0]+v[2]*x*(1-k),v[1]+v[3]*y*(1-k),v[2]*k,v[3]*k];update()},{passive:false});map.onpointerdown=e=>{drag=[e.clientX,e.clientY,...v];map.setPointerCapture(e.pointerId)};map.onpointermove=e=>{if(!drag)return;let b=map.getBoundingClientRect();v=[drag[2]-(e.clientX-drag[0])*drag[4]/b.width,drag[3]-(e.clientY-drag[1])*drag[5]/b.height,drag[4],drag[5]];update()};map.onpointerup=()=>drag=null;</script>'''
(OUT/'대구2024_사고링크_겹침지도.html').write_text(page.replace('LEGEND',legend).replace('ROADS',''.join(road_svg)).replace('POINTS',''.join(point_svg)),encoding='utf-8')
(OUT/'읽어주세요.md').write_text(f'''# 대구 2024년 사고 위치–Level 5.5 매핑

TAAS 공개 GIS의 대구(법정동 코드 27%) 2024년 사고 {len(accidents):,}건, 9개 구·군(군위 포함)을 같은 연도 KTDB Level 5.5 도로망과 비교했다. 경찰 조사 사고자료의 제공 범위이며 미신고 사고까지 포함한 모든 사고라고 주장하지 않는다.

## 결과
{json.dumps(dict(status_counts),ensure_ascii=False,indent=2)}

단일 링크 추정은 위치상 경쟁 후보가 적다는 뜻이다. 사람이 확인한 확정 사고건수가 아니며 정확도를 측정한 것도 아니다. 비교 대상에 대구 주변 경북·경남 링크도 포함했다. 양방향 링크는 동일 노드·속성 및 형상 차이 30m 이하일 때만 후보 구간으로 묶었으며, 사고를 양쪽에 복사하지 않았다.

대구 분류 사고 중 좌표가 경도 126.6800, 위도 35.9764인 1건은 대구 밖으로 별도 분류해 매칭하지 않았다. 원본 좌표와 사고번호는 보존했다.

## 판정
50m 이내 모든 후보를 저장. 최단 거리 20m 이내, 차순위 구간과 거리차 8m 이상, 링크 끝점 15m 밖, 사고 도로명과 불일치 없음일 때만 추정 집계했다. 교차로·끝점 근처는 다른 후보 구간도 12m 이내에 있을 때 보류한다. 고가·지하차도·터널·주차장 관련 사고는 높이 정보 부족으로 보류한다. 도로명/방향/높이가 없으면 확정 판정할 수 없다. 임계값은 탐색 기준으로 사전에 정확도가 검증된 기준이 아니다.

## 파일
- 사고별_링크매칭.csv: 10,222개 고유 사고번호 모두 보존. 추정 링크가 없는 행은 빈값.
- 사고별_전체후보.csv: 50m 내 링크 후보 모두 기록. 후보 행 수를 사고건수로 세지 않는다.
- 링크별_추정사고건수.csv: 단일 링크 추정만 집계. 미확인 링크의 사고건수를 0으로 채우지 않았다. km당 지표는 길이로만 보정한 추정치이며 통행량 보정값이 아니다.
- 구간별_추정사고건수.csv: 추정 구간별 중복 없는 집계. single_candidate_link는 후보 수 구분이며 사고의 실제 주행방향 확인을 뜻하지 않는다.
- 겹침 지도 HTML: 인터넷 없이 열리는 위치 기반 벡터 지도. 점의 색상·후보 ID·거리·판정 사유 확인.
- 두 GeoJSON: QGIS에서 사고 점과 도로 선을 겹쳐 개별 검토 가능(EPSG:4326).
- report.json: 데이터 건수, 좌표계, 임계값, 해시, 거리 민감도 기록.

원본: https://taas.koroad.or.kr/gis/mcm/mcl/initMap.do?menuId=GIS_GMP_STS_RSN
도로망: https://viewt.ktdb.go.kr/cong/map/TableMove_Zeke.do

사고 번호 중복 0, 응답 전체건수 일치, 판정 건수 합계 및 중복 없는 집계 일치 검증. 수동 정답표가 없어 매칭 정확도는 아직 검증하지 못했다. 앱의 사고 cost에는 반영하지 않았다. 검토 후 채택된 매핑을 별도로 만들고 통행량·기간·길이를 보정해야 한다.
''',encoding='utf-8')
