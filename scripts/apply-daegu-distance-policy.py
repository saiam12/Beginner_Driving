"""Apply the user's 20m / 50m nearest-link policy, retaining explicit exclusions."""
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

import geopandas as gpd
import pandas as pd
from pyproj import Transformer
from shapely.geometry import Point, box
from shapely.strtree import STRtree

ROOT=Path(__file__).resolve().parents[1]
PREVIOUS=ROOT/'outputs/daegu-accident-matching-2024-v2'
OUT=ROOT/'outputs/daegu-accident-matching-2024-distance-policy'
OUT.mkdir(parents=True,exist_ok=True)
raw=ROOT/'.local/daegu-accidents-2024/response.json'
response=json.loads(raw.read_text(encoding='utf-8-sig'))['resultValue']
accidents=response['accidentInfoList']
network=ROOT/'.local/viewt/level55-2024'
roads=gpd.read_file(network/'daegu/daegu_link_lev5.5_2024.shp',encoding='cp949')
crs=roads.crs
points=gpd.GeoSeries([Point(float(a['x_crdnt']),float(a['y_crdnt'])) for a in accidents],crs=5179).to_crs(crs)
to_wgs=Transformer.from_crs(crs,4326,always_xy=True)
plausible=[127<to_wgs.transform(p.x,p.y)[0]<130 and 34<to_wgs.transform(p.x,p.y)[1]<38 for p in points]
extent=box(*points[plausible].total_bounds).buffer(100)
hashes={}
for province in ('daegu','gyeongbuk','gyeongnam'):
    shp=network/province/f'{province}_link_lev5.5_2024.shp'
    hashes[province]=hashlib.sha256(shp.read_bytes()).hexdigest()
    if province!='daegu':
        other=gpd.read_file(shp,encoding='cp949').to_crs(crs)
        roads=gpd.GeoDataFrame(pd.concat([roads,other[other.intersects(extent)]],ignore_index=True),crs=crs)
roads=roads[roads.intersects(extent)].reset_index(drop=True)
roads['id']=roads.k_link_id.map(lambda x:str(int(x)))
assert not roads.id.duplicated().any()
geometries=list(roads.geometry);tree=STRtree(geometries)
old={r['accident_id']:r for r in csv.DictReader((PREVIOUS/'사고별_링크매칭.csv').open(encoding='utf-8-sig'))}
manual=json.loads((PREVIOUS/'user-decisions.json').read_text(encoding='utf-8'))
explicit_exclusions={k for k,v in manual.items() if v['decision']=='제외'}
membership={r['lev5_5_link_id']:r['corridor_id'] for r in csv.DictReader((PREVIOUS/'corridor-membership.csv').open(encoding='utf-8-sig'))}
rows=[];link_counts=Counter();corridor_counts=Counter();reasons=Counter()
for a,p,valid in zip(accidents,points,plausible,strict=True):
    aid=a['acdnt_no'];nearby=[]
    if valid:
        for i in tree.query(p.buffer(50)):
            i=int(i);d=p.distance(geometries[i])
            if d<=50:nearby.append((d,i))
    nearby.sort(key=lambda x:(x[0],int(roads.iloc[x[1]].id)))
    d,idx=nearby[0] if nearby else (None,None)
    closest=roads.iloc[idx].id if idx is not None else ''
    if aid in explicit_exclusions:
        status,reason='excluded','explicit_user_exclusion'
    elif not valid:
        status,reason='excluded','coordinate_outside_daegu_region_no_valid_candidate'
    elif d is None:
        status,reason='excluded','no_link_within_50m'
    elif d>20:
        status,reason='held','nearest_over_20m_within_50m'
    else:
        status,reason='mapped','nearest_within_20m'
    assigned=closest if status=='mapped' else ''
    group=membership[assigned] if assigned else ''
    if assigned:link_counts[assigned]+=1;corridor_counts[group]+=1
    lon,lat=to_wgs.transform(p.x,p.y)
    row={'accident_id':aid,'year':2024,'district':a['legaldong_name'],'status':status,
         'lev5_5_link_id':assigned,'corridor_link_ids':group,
         'nearest_candidate_link_id':closest,'nearest_distance_m':round(d,6) if d is not None else '',
         'candidate_links_within_50m':len(nearby),'reason':reason,
         'longitude':lon,'latitude':lat,'recorded_road_name':a.get('route_nm') or '',
         'candidate_road_name':str(roads.iloc[idx].road_name) if idx is not None else '',
         'road_form':a.get('road_stle_dc') or '',
         'taas_display_id':a.get('serial_no') or '',
         'previous_status':old[aid]['status'],'previous_review_reasons':old[aid]['reasons']}
    rows.append(row);reasons[reason]+=1

def write_csv(name,data,headers=None):
    with (OUT/name).open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=headers or list(data[0]));w.writeheader();w.writerows(data)
write_csv('전체_판정결과.csv',rows)
for status,name in [('mapped','매핑완료.csv'),('held','보류.csv'),('excluded','제외.csv')]:
    write_csv(name,[r for r in rows if r['status']==status],list(rows[0]))
write_csv('링크별_사고건수.csv',[{'year':2024,'lev5_5_link_id':r.id,'road_name':r.road_name,
    'nearest_link_accident_count':link_counts[r.id],'length_km':r.k_length,
    'count_per_km':round(link_counts[r.id]/float(r.k_length),6) if float(r.k_length)>0 else ''}
    for _,r in roads.iterrows() if r.id in link_counts])
write_csv('양방향구간별_사고건수.csv',[{'year':2024,'corridor_link_ids':g,'accident_count':n}
    for g,n in sorted(corridor_counts.items())])
statuses=Counter(r['status'] for r in rows)
assert len(rows)==response['paginationInfo']['totalRecordCount']==10222
assert len({r['accident_id'] for r in rows})==len(rows)
assert sum(link_counts.values())==sum(corridor_counts.values())==statuses['mapped']
assert all(r['lev5_5_link_id'] and r['nearest_distance_m']<=20 for r in rows if r['status']=='mapped')
assert all(20<r['nearest_distance_m']<=50 for r in rows if r['status']=='held')
assert all(not r['lev5_5_link_id'] for r in rows if r['status']!='mapped')
assert all(next(r for r in rows if r['accident_id']==aid)['status']=='excluded' for aid in explicit_exclusions)
assert all(next(r for r in rows if r['accident_id']==aid)['lev5_5_link_id']==m['selected_candidate_link_id'] for aid,m in manual.items() if m['decision']=='선택')
report={'year':2024,'source_accidents':len(rows),'statuses':dict(statuses),'reason_counts':dict(reasons),
        'links_with_counts':len(link_counts),'corridors_with_counts':len(corridor_counts),
        'rules':{'map_nearest_at_most_m':20,'hold_over_m':20,'hold_at_most_m':50,'exclude_no_link_within_m':50,'retain_explicit_user_exclusions':sorted(explicit_exclusions),'tie_break':'smallest numeric link ID'},
        'accuracy':'User-chosen nearest-distance policy; not official link-level statistics or measured assignment accuracy',
        'coordinate_operation':Transformer.from_crs(5179,crs,always_xy=True).description,
        'source_sha256':{'accidents':hashlib.sha256(raw.read_bytes()).hexdigest(),**hashes}}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'읽어주세요.md').write_text(f'''# 대구 2024 사고 — 사용자 지정 거리 기준 적용

2024년 대구(군위 포함) TAAS 사고 {len(rows):,}건을 보존했다. 20m 이내 최근접 링크에 매핑, 20m 초과~50m 이내 보류, 50m 내 후보 없음 제외. 앞서 사용자가 직접 제외한 사고 2건은 유지했다. 대구 밖 좌표 1건은 유효한 대구 주변 후보가 없어 제외했다.

결과: 매핑 {statuses['mapped']:,}건, 보류 {statuses['held']:,}건, 제외 {statuses['excluded']:,}건.

도로명 불일치·교차로·고가/지하 등 이전 보류 사유는 기록만 보존하고 이번 배정의 차단 조건으로 사용하지 않았다. 따라서 공식 확정 사고건수나 정확도를 검증한 매핑으로 해석하지 않는다.

각 사고는 최근접 링크 한 곳에만 집계한다. 양방향구간별 집계도 사고당 한 번만 반영한다. 0건 미기재 링크를 무사고라고 단정하지 않는다. km당 지표는 링크 길이 보정만 했으며 교통량 보정값이 아니다. 기존 결과와 앱 cost는 변경하지 않았다.

전체_판정결과.csv: 전체 사고번호·TAAS 화면 구분번호·최근접 후보·거리·이전 검토 사유.
매핑완료.csv / 보류.csv / 제외.csv: 판정별 자료.
링크별_사고건수.csv / 양방향구간별_사고건수.csv: 중복 없는 집계.

원본: https://taas.koroad.or.kr/gis/mcm/mcl/initMap.do?menuId=GIS_GMP_STS_RSN
도로망: https://viewt.ktdb.go.kr/cong/map/TableMove_Zeke.do
''',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ('source_sha256','rules')},ensure_ascii=True))
