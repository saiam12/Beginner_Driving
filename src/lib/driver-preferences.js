export const DEFAULT_DRIVER_PROFILE = {goals:[]};
export const GOAL_OPTIONS = [['right','우회전'],['junctions','교차로'],['left','좌회전'],['uturn','유턴'],['narrow','좁은 도로']];
export const UNPREFERRED_LANE_COST = 3;
function selectedGoals(profile) {
 return profile?.goals??[...(profile?.goal&&profile.goal!=='gentle'?[profile.goal]:[]),...(profile?.avoid||[])];
}
export function validateProfile(profile) {
 // Accept the previous API shape during deployment, but emit only the shared goals list.
 if(!profile||profile.goals===undefined&&(!['gentle','right','junctions'].includes(profile.goal)||!Array.isArray(profile.avoid)||profile.avoid.some(id=>!['left','uturn','narrow'].includes(id))))throw new Error('연습 목표를 확인해주세요.');
 const goals=selectedGoals(profile);
 if(!Array.isArray(goals)||goals.length>5||new Set(goals).size!==goals.length||goals.some(id=>!GOAL_OPTIONS.some(([option])=>id===option)))throw new Error('연습 목표를 확인해주세요.');
 return {goals:[...goals]};
}
export function lanePreferenceMultiplier(lanes,selected=[]) {
 return selected.length&&!selected.includes(Math.min(lanes,7))?UNPREFERRED_LANE_COST:0;
}
// Discounts apply only to observed road properties; unknown lanes receive no bonus.
export function driverRoadPenalty(lanes,profile) {
 return selectedGoals(profile).includes('narrow')&&lanes===1?-.75:0;
}
export function driverTurnPenalty(type,profile,baseCost={straight:0,right:50,left:150,uturn:500}[type]||0) {
 return ['right','left','uturn'].includes(type)&&selectedGoals(profile).includes(type)?-baseCost*.7:0;
}
export function driverJunctionDiscount(isJunction,profile) {
 return isJunction&&selectedGoals(profile).includes('junctions') ? .15 : 0;
}
export function practiceGoalMatch(profile,counts) {
 const matched=selectedGoals(profile).filter(goal=>(counts[goal]||0)>0);
 return {matched,count:matched.length,total:selectedGoals(profile).length};
}
