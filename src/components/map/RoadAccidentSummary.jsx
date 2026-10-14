import React from 'react';
export function accidentPointLabel(point,index) {
 return `사고 ${index+1} · ${point.month} ${point.time}\n${point.type} · ${point.severity}\nTAAS 원본 위치 · 도로 매핑은 15m 최근접 추정`;
}
export function accidentClusterLabel(cluster) {
 return `도로 구간 사고 ${cluster.count}건 · 2024년\n${cluster.points.map((point,index)=>`${index+1}. ${point.month} ${point.time} · ${point.type} · ${point.severity}`).join('\n')}\n원 위치: 해당 구간 사고 좌표의 평균\nTAAS · 도로 매핑은 15m 최근접 추정`;
}
export default function RoadAccidentSummary({state,onClose}) {
 if(state.kind==='off')return null;
 const count=state.features.reduce((sum,feature)=>sum+feature.properties.count,0);
 return <div className="road-accident-summary" role="status"><div><strong>사고 위치 · 대구 2024년</strong><p>{state.kind==='loading'?'사고 위치 불러오는 중…':state.kind==='error'?state.error:state.features.length?`현재 화면 ${count.toLocaleString('ko-KR')}건 · ${state.features.length.toLocaleString('ko-KR')}개 도로 구간`:'현재 화면에 사고 자료가 없습니다.'}</p>{state.kind==='ready'&&!!count&&<p>원 크기·숫자는 사고 건수 · 누르면 사고 목록 표시</p>}{state.kind==='error'&&<button type="button" onClick={state.retry}>재시도</button>}</div><button type="button" onClick={onClose} aria-label="사고 위치 숨기기">×</button></div>;
}
