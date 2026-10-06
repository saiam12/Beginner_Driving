import regions from './regions.json';
import {practiceGoalMatch,DEFAULT_DRIVER_PROFILE} from '../lib/driver-preferences';
import seoulCourses from './seoul-courses.json';
export { regions };
export function findRegion(query) {
 const q = query.trim().replace(/\s/g, '');
 if (!q) return null;
 return regions.find(r => [r.name, ...r.aliases].some(a => a.replace(/\s/g,'') === q));
}
export function getRoutes(region, batch = 0, distanceRange = {min:5,max:10}, difficulty = '전체', profile = DEFAULT_DRIVER_PROFILE) {
 if(region?.id !== 'mapo')return [];
 const candidates=seoulCourses.filter(c=>(difficulty==='전체'||c.difficulty===difficulty)&&c.lengthMeters>=distanceRange.min*1000&&c.lengthMeters<=distanceRange.max*1000);
 return candidates.map(course=>({...course,goalMatch:practiceGoalMatch(profile,course.practiceCounts||{}),cost:course.cost-profile.goals.reduce((sum,goal)=>sum+(course.goalCostBasis?.[goal]||0),0)})).sort((a,b)=>b.goalMatch.count-a.goalMatch.count||a.cost-b.cost).map((course,i)=>({...course,rank:i+1}));
}


export const rankedRegions = [...regions].sort((a,b)=>b.score-a.score);
export function getRankingMarkers(rankingRegions, zoom) {
 const seen = new Set();
 return rankingRegions.map((region,i)=>({...region,rank:i+1})).filter(region=>{
  if(zoom>=10)return true;
  const province=region.name.split(' ')[0];
  if(seen.has(province))return false;
  seen.add(province);return true;
 });
}
