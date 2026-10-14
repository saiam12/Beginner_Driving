import React from 'react';
import {LANE_OPTIONS,laneColor} from '../../lib/lane-roads';
export default function LaneFilter({selected, onChange}) {
 return <div className="lane-filter" role="group" aria-label="지도에 표시할 차로 수" title="선택한 차로의 도로를 연한 파랑(1)부터 진한 파랑(7+)으로 표시합니다. 전체 해제 시 도로 표시를 끕니다.">
  <span className="lane-filter-label">차로 수</span>
  <div className="lane-filter-buttons">{LANE_OPTIONS.map(lane => <button type="button" key={lane}
   aria-label={lane === 7 ? '7차로 이상 도로 표시' : `${lane}차로 도로 표시`}
   style={{'--lane-color':laneColor(lane),'--lane-text':lane<=3?'#173b6b':'#ffffff'}}
   aria-pressed={selected.includes(lane)} title={lane === 7 ? '7차로 이상' : `${lane}차로`}
   onClick={() => onChange(selected.includes(lane) ? selected.filter(value => value !== lane) : [...selected, lane].sort((a, b) => a - b))}>
   {lane === 7 ? '7+' : lane}
  </button>)}</div>
  <button type="button" className="lane-filter-clear" aria-label="차로 수 선택 해제" disabled={!selected.length} onClick={() => onChange([])}>해제</button>
 </div>;
}
