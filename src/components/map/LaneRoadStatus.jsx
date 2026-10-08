import React,{useId,useState} from 'react';
export default function LaneRoadStatus({state,zoom,children,region}) {
 const [collapsed,setCollapsed]=useState(false),bodyId=useId();
 if (state.kind === 'off') return null;
 const message = {
  waiting: '지도가 준비되면 코스 후보를 찾을 수 있습니다.',
  zoom: region?'지역의 도로가 너무 많습니다. 더 작은 지역을 선택해주세요.':'지도를 배율 13 이상으로 확대해주세요.',
  loading: region?'희망 지역의 도로를 불러오고 있습니다…':'현재 지도 범위의 도로를 불러오고 있습니다…',
  rendering: '지도 중심부터 도로를 차례로 표시하고 있습니다…',
  error: '도로를 불러오지 못했습니다.',
  ready: state.features.length ? `${region?'희망 지역 · ':''}도로 ${state.features.length.toLocaleString('ko-KR')}개 구간 준비됨` : '탐색 범위에 연결할 도로가 없습니다.'
 }[state.kind];
 return <div className="lane-road-status" data-state={state.kind} data-link-count={state.features.length} data-collapsed={collapsed}>
  <div className="lane-road-content"><div className="course-panel-heading"><strong>코스 탐색</strong>{Number.isFinite(zoom)&&<span className="course-zoom">배율 {Number(zoom.toFixed(1))}</span>}</div>{!collapsed&&<p className="course-panel-status" role="status">{message}</p>}
   <div id={bodyId} hidden={collapsed}>{children}{state.kind === 'error' && <button type="button" onClick={state.retry}>다시 불러오기</button>}</div>
  </div>
  <button className="lane-road-toggle" type="button" aria-label={collapsed?'코스 안내 펼치기':'코스 안내 접기'} aria-expanded={!collapsed} aria-controls={bodyId} onClick={()=>setCollapsed(value=>!value)}>{collapsed?'+':'−'}</button>
 </div>;
}
