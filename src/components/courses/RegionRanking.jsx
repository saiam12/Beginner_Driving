import React from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import {rankedRegions} from '../../data';
export default function RegionRanking({onSearch}) {
 return <div className="ranking"><span className="eyebrow">지역별 추천 순위</span><h2>지역별 코스 예시</h2><p className="subtext">지역을 선택해 코스와 도로 지표를 비교하세요.</p><div className="ranking-banner"><div><strong>비교 가능한 지역 {rankedRegions.length}곳</strong><small>예시 점수 기준 · 실제 안전도 순위 아님</small></div></div><div className="ranking-list">{rankedRegions.map((r,i)=><button className="ranking-row" key={r.id} onClick={()=>onSearch(r.name)} aria-label={`${i+1}위 ${r.name} ${r.score}점 코스 추천 보기`}><b className={i===0?'first':''}>{i+1}</b><div><strong><MapPin size={12}/>{r.name}</strong><p>{r.description}</p><span className="ranking-action">이 지역 코스 추천 <ArrowRight size={11}/></span></div><span>{r.score}<small>점</small></span></button>)}</div><p className="data-note">순위와 점수는 예시입니다. 지도에서 확대하거나 목록에서 전체 지역을 선택할 수 있습니다.</p></div>;
}
