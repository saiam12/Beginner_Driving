import React,{useId,useState} from 'react';
export default function LaneRoadStatus({state,zoom,children}) {
 const [collapsed,setCollapsed]=useState(false),bodyId=useId();
 if (state.kind === 'off') return null;
 const message = {
  waiting: '지도가 준비되면 코스 후보를 찾을 수 있습니다.',
  zoom: '배율 13 이상으로 확대하면 코스 후보를 찾을 수 있습니다. 밀집 지역은 더 확대해주세요.',
  loading: '현재 지도 범위의 도로를 불러오고 있습니다…',
  rendering: '지도 중심부터 도로를 차례로 표시하고 있습니다…',
  error: '도로를 불러오지 못했습니다.',
  ready: state.features.length ? `현재 지도 범위 · 도로구간 ${state.features.length.toLocaleString('ko-KR')}개 준비` : '현재 지도 범위에 연결할 도로가 없습니다.'
 }[state.kind];
 return <div className="lane-road-status" data-state={state.kind} data-link-count={state.features.length} data-collapsed={collapsed}>
  <span className="lane-road-swatch" aria-hidden="true"/><div className="lane-road-content"><span role="status">{collapsed?'코스 후보':message}</span><small>{Number.isFinite(zoom) && <>현재 배율 <strong>{Number(zoom.toFixed(1))}</strong>{!collapsed&&' · '}</>}{!collapsed&&'전체 차로에서 후보 탐색'}</small>
   <div id={bodyId} hidden={collapsed}>{children}{state.kind === 'error' && <button type="button" onClick={state.retry}>다시 불러오기</button>}</div>
  </div>
  <button className="lane-road-toggle" type="button" aria-label={collapsed?'코스 안내 펼치기':'코스 안내 접기'} aria-expanded={!collapsed} aria-controls={bodyId} onClick={()=>setCollapsed(value=>!value)}>{collapsed?'+':'−'}</button>
 </div>;
}
