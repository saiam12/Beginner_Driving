import React from 'react';
import { ArrowRight, Trophy, MapPin } from 'lucide-react';
import {rankedRegions} from '../data';
export default function RegionRanking({onSearch}) {
 return <div className="ranking"><span className="eyebrow">지역별 추천 순위</span><h2>어디서 시작할까요?</h2><p className="subtext">목록이나 지도의 지역명을 누르면 코스를 추천해드려요.</p><div className="ranking-banner"><Trophy size={22}/><div><strong>전국 추천 지역 {rankedRegions.length}곳</strong><small>4가지 도로 지표를 종합한 예시 순위</small></div></div><div className="ranking-list">{rankedRegions.map((r,i)=><button className="ranking-row" key={r.id} onClick={()=>onSearch(r.name)} aria-label={`${i+1}위 ${r.name} ${r.score}점 코스 추천 보기`}><b className={i===0?'first':''}>{i+1}</b><div><strong><MapPin size={12}/>{r.name}</strong><p>{r.description}</p><span className="ranking-action">이 지역 코스 추천 <ArrowRight size={11}/></span></div><span>{r.score}<small>점</small></span></button>)}</div><p className="data-note">순위와 분석 점수는 프로토타입 예시 데이터입니다.<br/>지도에는 겹치지 않는 상위 지역을 간결하게 표시합니다.<br/>확대하면 더 많은 지역을 볼 수 있고,<br/>전체 21곳은 이 목록에서 선택할 수 있습니다.</p></div>;
}
