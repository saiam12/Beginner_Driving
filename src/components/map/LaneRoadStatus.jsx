import React from 'react';
export default function LaneRoadStatus({state,zoom,children}) {
 if (state.kind === 'off') return null;
 const message = {
  waiting: '지도가 준비되면 선택한 차로의 도로를 표시합니다.',
  zoom: '배율 13 이상으로 확대하면 현재 구역의 도로가 표시됩니다. 밀집 지역은 더 확대해주세요.',
  loading: '현재 지도 범위의 도로를 불러오고 있습니다…',
  rendering: '지도 중심부터 도로를 차례로 표시하고 있습니다…',
  error: '도로를 불러오지 못했습니다.',
  ready: state.features.length ? `현재 지도 범위 · 도로구간 ${state.features.length.toLocaleString('ko-KR')}개` : '현재 지도 범위에 선택한 차로의 도로가 없습니다.'
 }[state.kind];
 return <div className="lane-road-status" role="status" data-state={state.kind} data-link-count={state.features.length}>
  <span className="lane-road-swatch" aria-hidden="true"/><span>{message}<small>{Number.isFinite(zoom) && <>현재 배율 <strong>{Number(zoom.toFixed(1))}</strong> · </>}원본 차로 수 기준 · 도로명 없는 구간 포함</small>{children}</span>
  {state.kind === 'error' && <button type="button" onClick={state.retry}>다시 불러오기</button>}
 </div>;
}
