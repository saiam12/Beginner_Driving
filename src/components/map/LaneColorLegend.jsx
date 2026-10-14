import React from 'react';
import {LANE_OPTIONS,laneColor} from '../../lib/lane-roads';
export default function LaneColorLegend({selected}) {
 if(!selected?.length)return null;
 return <aside className="lane-color-legend" aria-label="차로 수 범례"><strong>차로 수</strong><small>진행 방향 기준</small><ul>{LANE_OPTIONS.map(lane=><li key={lane}><i aria-hidden="true" style={{background:laneColor(lane)}}/><span>{lane===7?'7+':lane}차로</span></li>)}</ul></aside>;
}
