"""Apply only the six explicit human decisions; preserve all original spatial results."""
import csv
import json
from collections import Counter
from pathlib import Path

OUT=Path(__file__).resolve().parents[1]/'outputs/daegu-accident-matching-2024-v2'
ids=json.loads((OUT/'preview-case-ids.json').read_text(encoding='utf-8'))
cases=json.loads((OUT/'review-data.json').read_text(encoding='utf-8'))
by_id={c['accident_id']:c for c in cases}
excluded={ids[4],ids[5]}
decisions={}
for aid in ids:
    if aid in excluded:
        decisions[aid]={'decision':'제외','selected_link_or_group':'','selected_candidate_link_id':'','note':'사용자 지시: 상인로26안길 쪽 또는 테크노상업로4길 사고 제외'}
    else:
        first=min((r for r in by_id[aid]['roads'] if r['candidate']),key=lambda r:r['d'])
        decisions[aid]={'decision':'선택','selected_link_or_group':first['group'],'selected_candidate_link_id':first['id'],'note':'사용자 지시: 예시의 후보 1번에 매핑; 상·하행은 구간 단위'}

def write_csv(name,rows):
    with (OUT/name).open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
write_csv('사용자판단_6건.csv',[{'accident_id':aid,**d} for aid,d in decisions.items()])
rows=list(csv.DictReader((OUT/'사고별_링크매칭.csv').open(encoding='utf-8-sig')))
counts=Counter()
for row in rows:
    aid=row['accident_id'];row['original_status']=row['status'];row['review_decision']='';row['user_selected_candidate_link_id']='';row['review_note']=''
    if aid in decisions:
        d=decisions[aid];row['review_decision']=d['decision'];row['review_note']=d['note'];row['user_selected_candidate_link_id']=d['selected_candidate_link_id']
        row['status']='user_excluded' if aid in excluded else 'user_selected_corridor'
        row['lev5_5_link_id_estimate']=''
        if aid not in excluded:row['nearest_candidate_group']=d['selected_link_or_group']
    if row['status'] in ('single_link_estimate','corridor_estimate_direction_ignored','user_selected_corridor'):
        counts[row['nearest_candidate_group']]+=1
write_csv('사고별_사용자검토반영.csv',rows)
write_csv('구간별_사용자검토반영.csv',[{'year':2024,'corridor_link_ids':g,'count_including_spatial_estimates':n,'user_selected_count':sum(d['selected_link_or_group']==g and d['decision']=='선택' for d in decisions.values())} for g,n in sorted(counts.items())])
pending=[c for c in cases if c['accident_id'] not in decisions]
selected=[]
for reason in ('competing_corridor_within_8m','intersection_or_near_endpoint','road_name_not_equal','road_level_or_parking_uncertain','distance_over_30m','no_candidate_within_50m'):
    selected.append(next(c for c in pending if reason in c['reasons'] and c['accident_id'] not in {s['accident_id'] for s in selected}))
(OUT/'next-review-data.json').write_text(json.dumps(selected,ensure_ascii=False),encoding='utf-8')
(OUT/'user-decisions.json').write_text(json.dumps(decisions,ensure_ascii=False,indent=2),encoding='utf-8')
# Embed the approved decisions in the existing map; keep local decisions for other cases.
p=OUT/'검토지도.html';html=p.read_text(encoding='utf-8')
marker='// APPROVED_REVIEW_START'
if marker in html:
    start=html.index(marker);end=html.index('// APPROVED_REVIEW_END',start)+len('// APPROVED_REVIEW_END');html=html[:start]+html[end:]
seed=json.dumps(decisions,ensure_ascii=False).replace('</','<\\/')
insertion=marker+'\ndecisions={...decisions,...'+seed+'};\n// APPROVED_REVIEW_END\n'
at=html.rfind('refresh();');html=html[:at]+insertion+html[at:];p.write_text(html,encoding='utf-8')
assert len(rows)==10222 and len({r['accident_id'] for r in rows})==10222
assert len(pending)==5665 and sum(counts.values())==4555
assert sum(r['status']=='user_excluded' for r in rows)==2
report={'statuses':dict(Counter(r['status'] for r in rows)),'counted_accidents':sum(counts.values()),'pending':len(pending),'manual_decisions':decisions,'scope':'Only six explicit user decisions; other assignments remain spatial estimates'}
(OUT/'user-review-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='manual_decisions'},ensure_ascii=True))
