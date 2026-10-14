import React from 'react';
export default function LaneDisplayStatus({state}) {
 if(state.kind==='off')return null;
 const message={waiting:'지도 준비 중',loading:'도로 불러오는 중',zoom:'도로가 많습니다. 지도를 더 확대해주세요.',error:'차로 자료를 불러오지 못했습니다.',ready:`${state.features.length.toLocaleString('ko-KR')}개 도로 구간`}[state.kind];
 return <div className="lane-display-status" role="status"><strong>차로 수 · ITS 2026-09-14</strong><span>{message}</span>{state.kind==='error'&&<button onClick={state.retry}>다시 불러오기</button>}</div>;
}
