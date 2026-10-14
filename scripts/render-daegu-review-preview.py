"""Render a sample of the review data without browser access."""
import json
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT=Path(__file__).resolve().parents[1]/'outputs/daegu-accident-matching-2024-v2'
cases=json.loads((OUT/(sys.argv[1] if len(sys.argv)>1 else 'review-data.json')).read_text(encoding='utf-8'))
selected=[]
for reason in ('competing_corridor_within_8m','intersection_or_near_endpoint','road_name_not_equal','road_level_or_parking_uncertain','distance_over_30m','no_candidate_within_50m'):
    c=next(c for c in cases if reason in c['reasons'] and c['accident_id'] not in {d['accident_id'] for d in selected})
    selected.append(c)
im=Image.new('RGB',(1600,1480),'#f5f7fa');d=ImageDraw.Draw(im)
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',19);small=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',15);title=ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf',25)
d.text((22,12),'대구 2024 사고 · 링크 검토 예시',font=title,fill='#142438')
d.text((22,48),'빨간 점: 사고 위치 / 같은 색: 같은 상·하행 구간 후보 / 거리는 원본 좌표계에서 계산',font=font,fill='#4b5563')
colors=['#1766c8','#b96b00','#7a39a5','#007c68','#bb3764','#4c5a6d']
for k,c in enumerate(selected):
    col=k%2;row=k//2;ox=col*790+15;oy=row*460+90
    d.rectangle((ox,oy,ox+770,oy+442),fill='white',outline='#bdc7d4')
    d.text((ox+10,oy+8),f"사고 {c['accident_id']} / {c['district']}",font=font,fill='#1f2937')
    d.text((ox+10,oy+36),f"기록 도로명: {c['route_name'] or '없음'}",font=small,fill='#4b5563')
    px,py=ox+15,oy+70;size=350;centerx=px+size/2;centery=py+size/2
    candidates=sorted([r for r in c['roads'] if r['candidate']],key=lambda r:r['d'])
    groups=list(dict.fromkeys(r['group'] for r in candidates))
    scale=size/(2*150/math.cos(c['latitude']*math.pi/180))
    panel=Image.new('RGB',(size,size),'#f7f9fc');pd=ImageDraw.Draw(panel)
    for r in sorted(c['roads'],key=lambda r:r['candidate']):
        color=colors[groups.index(r['group'])%len(colors)] if r['candidate'] else '#c6ced8'
        for line in r['lines']:
            pd.line([(size/2+x*scale,size/2-y*scale) for x,y in line],fill=color,width=4 if r['candidate'] else 1)
    pd.ellipse((size/2-8,size/2-8,size/2+8,size/2+8),fill='white',outline='#d51624',width=3)
    pd.ellipse((size/2-3,size/2-3,size/2+3,size/2+3),fill='#d51624')
    im.paste(panel,(px,py))
    d.text((ox+385,oy+70),'후보 링크 ID / 거리',font=font,fill='#1f2937')
    for n,r in enumerate(candidates[:8]):
        text=f"{n+1}. {r['id']}  {r['d']:.1f}m"
        color=colors[groups.index(r['group'])%len(colors)]
        d.text((ox+385,oy+104+n*35),text,font=small,fill=color)
        d.text((ox+385,oy+122+n*35),('도로명 없음' if r['name']=='nan' else r['name'])[:23],font=small,fill='#444')
    if not candidates:d.text((ox+385,oy+110),'표시할 후보 없음',font=small,fill='#444')
    d.text((ox+385,oy+395),{'review_required':'검토 필요','no_candidate_within_50m':'50m 내 링크 없음'}.get(c['status'],c['status']),font=small,fill='#444')
im.save(OUT/('검토지도_다음6건.png' if len(sys.argv)>1 else '검토지도_예시.png'))
(OUT/('next-preview-case-ids.json' if len(sys.argv)>1 else 'preview-case-ids.json')).write_text(json.dumps([c['accident_id'] for c in selected]),encoding='utf-8')
print('Rendered six cases')
