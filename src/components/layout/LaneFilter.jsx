import React from 'react';
import {LANE_OPTIONS} from '../../lib/lane-roads';
export default function LaneFilter({selected, onChange}) {
 return <div className="lane-filter" role="group" aria-label="지도에 표시할 도로 차로 수">
  <span className="lane-filter-label">차로 수</span>
  <div className="lane-filter-buttons">{LANE_OPTIONS.map(lane => <button type="button" key={lane}
   aria-label={lane === 7 ? '7차로 이상 도로 표시' : `${lane}차로 도로 표시`}
   aria-pressed={selected.includes(lane)} title={lane === 7 ? '7차로 이상' : `${lane}차로`}
   onClick={() => onChange(selected.includes(lane) ? selected.filter(value => value !== lane) : [...selected, lane].sort((a, b) => a - b))}>
   {lane === 7 ? '7+' : lane}
  </button>)}</div>
  <button type="button" className="lane-filter-clear" aria-label="차로 수 선택 해제" disabled={!selected.length} onClick={() => onChange([])}>해제</button>
 </div>;
}
