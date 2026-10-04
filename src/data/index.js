import regions from './regions.json';
import templates from './routes.json';
export { regions };
export function findRegion(query) {
 const q = query.trim().replace(/\s/g, '');
 if (!q) return null;
 return regions.find(r => [r.name, ...r.aliases].some(a => a.replace(/\s/g,'') === q));
}
export function getRoutes(region, batch = 0, distanceRange = {min:5,max:10}, difficulty = '전체') {
 const candidates = difficulty === '전체' ? templates : templates.filter(t=>t.difficulty===difficulty);
 return Array.from({length:Math.min(3,candidates.length)},(_,i)=>candidates[(batch*3+i)%candidates.length]).sort((a,b)=>b.score-a.score).map((t, i) => {
  const distance = Math.round((distanceRange.min + (distanceRange.max-distanceRange.min)*[0.5,0,1][i]) * 10) / 10;
  const scale = distance / t.distance;
  return {
   ...t, id: `${region.id}-${t.id}-${batch % 2}`, rank: i+1,
   name: `${region.places[i]} ${t.name}${batch % 2 ? " (대안)" : ""}`, score: t.score + region.score - 92,
   distance, duration: Math.max(5,Math.round(t.duration*scale)),
   startLocation: `${region.name} ${region.places[i]}`,
   coordinates: t.offsets.map(([lat,lng]) => [region.starts[i][0]+lat*scale*(batch % 2 ? -1 : 1),region.starts[i][1]+lng*scale*(batch % 2 ? -1 : 1)]),
   sections: [`${region.places[i]} 출발`, '생활권 도로 따라 주행', '주변 간선도로 순환', `${region.places[i]} 출발점 복귀`],
   reason: t.difficulty === '어려움' ? '교차로와 차로 변경을 집중적으로 연습하는 예시 코스입니다. 기초 주행에 익숙해진 뒤 도전하는 조건을 가정합니다.' : '교통량이 비교적 적고 복잡한 다차로 구간이 적으며, 사고 발생 빈도가 낮은 조건을 가정한 초보 운전 연습 코스입니다.'
  };
 });
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
