"""Join TAAS popup fields to held accidents without altering mapping decisions."""
import csv
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs/daegu-accident-matching-2024-distance-policy'
RAW=ROOT/'.local/daegu-accidents-2024/response.json'
source=json.loads(RAW.read_text(encoding='utf-8-sig'))['resultValue']['accidentInfoList']
by_id={a['acdnt_no']:a for a in source}
held=list(csv.DictReader((OUT/'보류.csv').open(encoding='utf-8-sig')))
fields={
    '발생년월':'acdnt_dd_dc','주야':'tmzon_div_1_dc','사고유형':'acdnt_dc',
    '사고유형_세부':'acdnt_mdc','사고심각도':'acdnt_gae_dc',
    '사망자수':'dprs_cnt','중상자수':'sep_cnt','경상자수':'slp_cnt','부상신고자수':'inj_aplcnt_cnt',
    '가해운전자_차종':'wrngdo_vhcle_asort_dc','가해운전자_성별':'sexdstn_div_1_dc',
    '가해운전자_연령대':'acdnt_age_1_dc','가해운전자_상해정도':'injury_dgree_1_dc',
    '피해운전자_차종':'dmge_vhcle_asort_dc','피해운전자_성별':'sexdstn_div_2_dc',
    '피해운전자_연령대':'acdnt_age_2_dc','피해운전자_상해정도':'injury_dgree_2_dc',
    '기상상태':'wether_sttus_dc','노면상태':'rdse_sttus_dc','도로형태':'road_stle_dc',
    '법규위반':'lrg_violt_1_dc','사고장소_원문':'acdnt_pos','도로명_원문':'route_nm',
}
rows=[];missing={label:0 for label in fields}
for r in held:
    a=by_id[r['accident_id']]
    assert r['taas_display_id']==a['serial_no']
    for label,key in fields.items():
        v=a.get(key)
        if v is None or (isinstance(v,str) and not v.strip()):missing[label]+=1
        r[label]=v.strip() if isinstance(v,str) else ('' if v is None else v)
    rows.append(r)
with (OUT/'보류_사고상세정보.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
(OUT/'보류_TAAS원본상세.json').write_text(json.dumps([by_id[r['accident_id']] for r in held],ensure_ascii=False,indent=2),encoding='utf-8')
assert len(rows)==len({r['accident_id'] for r in rows})==627
assert all(r['status']=='held' and 20<float(r['nearest_distance_m'])<=50 for r in rows)
assert all(r['사망자수']+r['중상자수']+r['경상자수']+r['부상신고자수']>=1 for r in rows)
# Update the existing held review map in place using its embedded case data.
p=OUT/'보류검토지도.html';page=p.read_text(encoding='utf-8')
start=page.index('const data=')+len('const data=');end=page.index(';\nconst $=',start)
cases=json.loads(page[start:end].replace('<\\/','</'))
details={r['accident_id']:{k:r[k] for k in fields} for r in rows}
assert {c['accident_id'] for c in cases}==set(details)
for c in cases:
    c['details']=details[c['accident_id']]
    c['taas_display_id']=by_id[c['accident_id']]['serial_no']
page=page[:start]+json.dumps(cases,ensure_ascii=False).replace('</','<\\/')+page[end:]
anchor="$('note').value=saved?.note||'';"
insertion="""if(c.details){$('summary').insertAdjacentHTML('beforeend','<hr><strong>TAAS 상세정보 · 구분번호 '+escapeHTML(c.taas_display_id)+'</strong><table>'+Object.entries(c.details).filter(([k])=>["사고유형", "사고유형_세부", "가해운전자_차종", "피해운전자_차종", "도로형태", "법규위반"].includes(k)).map(([k,v])=>'<tr><th>'+escapeHTML(k.replaceAll('_',' '))+'</th><td>'+escapeHTML(v===''?'미제공':v)+'</td></tr>').join('')+'</table>');}
 """
if insertion not in page:
    assert anchor in page;page=page.replace(anchor,insertion+anchor)
p.write_text(page,encoding='utf-8')
screenshot=next(a for a in source if a.get('serial_no')=='2024099341')
all_rows=list(csv.DictReader((OUT/'전체_판정결과.csv').open(encoding='utf-8-sig')))
screenshot_status=next(r for r in all_rows if r['accident_id']==screenshot['acdnt_no'])
report={'held_accidents':len(rows),'unique_accident_ids':len(details),'missing_by_field':missing,
        'source_sha256':hashlib.sha256(RAW.read_bytes()).hexdigest(),
        'method':'Exact join by original TAAS acdnt_no; display serial_no independently checked; no location join',
        'screenshot_example':{'taas_display_id':'2024099341','accident_id':screenshot['acdnt_no'],'status':screenshot_status['status'],'lev5_5_link_id':screenshot_status['lev5_5_link_id'],'distance_m':screenshot_status['nearest_distance_m']},
        'mapping_decisions_changed':False}
(OUT/'detail-collection-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True))
