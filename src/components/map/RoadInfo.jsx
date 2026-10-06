import React,{useEffect,useState} from 'react';
import {MapPin} from 'lucide-react';
import {laneLabel,regionLabel,lengthLabel} from '../../lib/road-search';
export function RoadMapInfo({road}){
 return <div className="map-selected road-map-info"><span className="selected-icon"><MapPin size={22}/></span><div><small>지금 선택한 도로</small><strong>{road.roadName}</strong><p>{regionLabel(road)}</p><p>{laneLabel(road)} · 도로구간 {road.linkCount}개 · {lengthLabel(road)}</p></div></div>;
}
export default function RoadInfo({road}){
 const [expanded,setExpanded]=useState(false),[limit,setLimit]=useState(40);
 useEffect(()=>{setExpanded(false);setLimit(40);},[road.roadGroupId]);
 return <section className="results-heading road-info" aria-label="선택한 도로 정보"><span className="eyebrow"><MapPin size={12}/>실제 도로 데이터</span><h2>{road.roadName}</h2><p>{regionLabel(road)}</p><div className="result-note">{laneLabel(road)} · 도로구간 {road.linkCount}개</div><p className="road-length">총 길이 약 {lengthLabel(road)}</p><p>지도에서 도로구간을 선택하면 차로 수와 구간 정보를 확인할 수 있어요.</p><p className="data-note">실제 도로 위치를 표시합니다. 추천 점수와 주행 코스는 아직 계산하지 않습니다.</p><details open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}><summary>도로구간 정보 보기</summary><div className="road-links">{expanded&&road.featureCollection.features.slice(0,limit).map(({properties:p})=><div key={p.linkId}><strong>{p.lanes==null?'차로 정보 없음':`${p.lanes}차로`}{p.speedLimit!=null&&` · 제한속도 ${p.speedLimit} km/h`}</strong><small>LINK_ID: {p.linkId}</small><small>{p.fNodeName||p.fNode||'시작 노드 미확인'} → {p.tNodeName||p.tNode||'끝 노드 미확인'}</small></div>)}</div>{expanded&&limit<road.linkCount&&<button className="search-more" onClick={()=>setLimit(value=>value+40)}>도로구간 더 보기 ({Math.min(limit,road.linkCount)}/{road.linkCount})</button>}</details><p className="data-note">도로: 국토교통부/ITS 표준노드링크<br/>지역 경계: 통계청 SGIS 원자료 기반 <a href="https://github.com/vuski/admdongkor" target="_blank" rel="noreferrer">admdongkor</a> (2026.07.01)</p></section>;
}
