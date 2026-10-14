"""Reclassify existing exact nearest-distance results under the user's 10m rule."""
import csv
import json
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PREVIOUS=ROOT/'outputs/daegu-accident-matching-2024-distance-policy'
OUT=ROOT/'outputs/daegu-accident-matching-2024-10m-policy'
OUT.mkdir(parents=True,exist_ok=True)
rows=list(csv.DictReader((PREVIOUS/'전체_판정결과.csv').open(encoding='utf-8-sig')))
metadata={r['lev5_5_link_id']:r for r in csv.DictReader((PREVIOUS/'링크별_사고건수.csv').open(encoding='utf-8-sig'))}
membership={r['lev5_5_link_id']:r['corridor_id'] for r in csv.DictReader((ROOT/'outputs/daegu-accident-matching-2024-v2/corridor-membership.csv').open(encoding='utf-8-sig'))}
counts=Counter();groups=Counter()
for r in rows:
    r['previous_20m_policy_status']=r['status']
    distance=float(r['nearest_distance_m']) if r['nearest_distance_m'] else None
    assert distance is None or abs(distance-10)>0.000001
    if r['reason']=='explicit_user_exclusion':
        r['status']='excluded'
    elif distance is not None and distance<=10:
        r['status']='mapped';r['reason']='nearest_within_10m'
    else:
        r['status']='excluded'
        if distance is not None:r['reason']='nearest_over_10m_link_unavailable'
    r['lev5_5_link_id']=r['nearest_candidate_link_id'] if r['status']=='mapped' else ''
    r['corridor_link_ids']=membership[r['lev5_5_link_id']] if r['lev5_5_link_id'] else ''
    r['decision']='최근접 링크 매핑' if r['status']=='mapped' else '해당 링크 없음'
    if r['status']=='mapped':counts[r['lev5_5_link_id']]+=1;groups[r['corridor_link_ids']]+=1

def write(name,records,headers=None):
    with (OUT/name).open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=headers or list(records[0]));w.writeheader();w.writerows(records)
write('전체_판정결과.csv',rows)
write('매핑완료.csv',[r for r in rows if r['status']=='mapped'])
write('링크없음.csv',[r for r in rows if r['status']=='excluded'])
write('링크별_사고건수.csv',[{'year':2024,'lev5_5_link_id':k,'road_name':metadata[k]['road_name'],'nearest_link_accident_count':n,'length_km':metadata[k]['length_km'],'count_per_km':round(n/float(metadata[k]['length_km']),6) if float(metadata[k]['length_km'])>0 else ''} for k,n in sorted(counts.items())])
write('양방향구간별_사고건수.csv',[{'year':2024,'corridor_link_ids':k,'accident_count':n} for k,n in sorted(groups.items())])
statuses=Counter(r['status'] for r in rows)
assert len(rows)==len({r['accident_id'] for r in rows})==10222
assert statuses['mapped']==sum(counts.values())==sum(groups.values())==5690
assert statuses['excluded']==4532 and statuses['held']==0
assert all(float(r['nearest_distance_m'])<=10 for r in rows if r['status']=='mapped')
assert all(not r['lev5_5_link_id'] for r in rows if r['status']=='excluded')
report={'source_accidents':len(rows),'statuses':dict(statuses),'held':0,'max_mapping_distance_m':10,'links':len(counts),'corridors':len(groups),'retained_explicit_user_exclusions':2,'method':'Nearest-link inference, not official link-level crash statistics'}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
held=list(csv.DictReader((PREVIOUS/'보류_사고상세정보.csv').open(encoding='utf-8-sig')))
for r in held:r['status']='excluded';r['decision']='해당 링크 없음';r['reason']='nearest_over_10m_link_unavailable'
write('기존보류627건_링크없음.csv',held)
print(json.dumps(report,ensure_ascii=False))
