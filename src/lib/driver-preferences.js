export const DEFAULT_DRIVER_PROFILE = {goal:'gentle',avoid:[]};
export const GOAL_OPTIONS = [['gentle','부담 적은 주행'],['right','우회전 연습'],['junctions','교차로 적응']];
export const AVOID_OPTIONS = [['left','좌회전'],['uturn','유턴'],['narrow','좁은 도로']];
export const UNPREFERRED_LANE_COST = 3;
export function validateProfile(profile) {
 if(!profile||!GOAL_OPTIONS.some(([id])=>id===profile.goal)||!Array.isArray(profile.avoid)||profile.avoid.length>3||new Set(profile.avoid).size!==profile.avoid.length||profile.avoid.some(id=>!AVOID_OPTIONS.some(([option])=>id===option)))throw new Error('연습 목표를 확인해주세요.');
 return {goal:profile.goal,avoid:[...profile.avoid]};
}
export function lanePreferenceMultiplier(lanes,selected=[]) {
 return selected.length&&!selected.includes(Math.min(lanes,7))?UNPREFERRED_LANE_COST:0;
}
export function driverRoadPenalty(lanes,profile) {
 return profile?.avoid.includes('narrow')&&(!Number.isInteger(lanes)||lanes<2)?1.5:0;
}
export function driverTurnPenalty(type,profile) {
 if(!profile)return 0;
 return (type==='left'&&profile.avoid.includes('left')?250:0)+(type==='uturn'&&profile.avoid.includes('uturn')?500:0);
}
