import React from 'react';
import {LANE_OPTIONS} from '../../lib/lane-roads';
export default function LaneFilter({selected, onChange}) {
 return <div className="lane-filter" role="group" aria-label="우선 추천할 도로 차로 수" title="선택한 차로를 우선 추천하고 다른 차로도 연결합니다. 전체 해제 시 기본 기준으로 추천합니다.">
  <span className="lane-filter-label">선호 차로</span>
  <div className="lane-filter-buttons">{LANE_OPTIONS.map(lane => <button type="button" key={lane}
   aria-label={lane === 7 ? '7차로 이상 우선 추천' : `${lane}차로 우선 추천`}
   aria-pressed={selected.includes(lane)} title={lane === 7 ? '7차로 이상' : `${lane}차로`}
   onClick={() => onChange(selected.includes(lane) ? selected.filter(value => value !== lane) : [...selected, lane].sort((a, b) => a - b))}>
   {lane === 7 ? '7+' : lane}
  </button>)}</div>
  <button type="button" className="lane-filter-clear" aria-label="차로 수 선택 해제" disabled={!selected.length} onClick={() => onChange([])}>해제</button>
 </div>;
}
