import fs from 'node:fs';
import zlib from 'node:zlib';
import {exploreCourseCandidates,laneCostMultiplier,geometryMeters} from '../src/lib/connected-course.js';
import {classifyCourseCandidates} from '../src/lib/course-overlap.js';
const bounds=[126.89,37.53,126.97,37.60], n=4096;
const tile=(lng,lat)=>[Math.floor((lng+180)/360*n),Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n)];
const [x0,y0]=tile(bounds[0],bounds[3]),[x1,y1]=tile(bounds[2],bounds[1]);
const unique=new Map();
for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
 const file=`public/data/roads/lanes/${x}/${y}.jsonl.gz`;
 if(!fs.existsSync(file))continue;
 for(const line of zlib.gunzipSync(fs.readFileSync(file)).toString().trim().split('\n')){
  const f=JSON.parse(line),b=f.properties.bounds;
  if(b[0]<=bounds[2]&&b[2]>=bounds[0]&&b[1]<=bounds[3]&&b[3]>=bounds[1])unique.set(f.properties.linkId,f);
 }
}
const neighbors=new Map();
for(const f of unique.values())for(const [from,to] of [[f.properties.fNode,f.properties.tNode],[f.properties.tNode,f.properties.fNode]]){if(!neighbors.has(from))neighbors.set(from,new Set());neighbors.get(from).add(to);}
const pool=exploreCourseCandidates([...unique.values()],[126.93,37.565],{min:5,max:10},'loop',{bounds});
const selection=classifyCourseCandidates(pool,{difficultyBased:true});
const courses=selection.adoptedIndices.map((index,i)=>{
 const c=pool[index], features=c.featureCollection.features;
 const coordinates=[];
 for(const f of features)for(const [lng,lat] of f.geometry.coordinates){const last=coordinates.at(-1);if(!last||last[0]!==lat||last[1]!==lng)coordinates.push([lat,lng]);}
 const roads=[...new Set(features.map(f=>f.properties.roadName).filter(Boolean))];
 return {id:`seoul-link-${i+1}`,name:`서울 ${roads[0]||'마포'} 순환 코스 ${i+1}`,difficulty:selection.difficultyByIndex[index],practiceCounts:c.practiceCounts,goalCostBasis:{narrow:c.practiceCounts.narrow*.75,junctions:features.reduce((sum,f)=>sum+((neighbors.get(f.properties.fNode)?.size||0)>=3?geometryMeters(f.geometry)*laneCostMultiplier(f.properties.lanes)*.15:0),0),right:c.practiceCounts.right*35,left:c.practiceCounts.left*105,uturn:c.practiceCounts.uturn*350},distance:Number((c.lengthMeters/1000).toFixed(2)),lengthMeters:c.lengthMeters,cost:c.cost,coordinates,linkIds:c.linkIds,nodes:features.map(f=>[f.properties.fNode,f.properties.tNode]),startLocation:`${roads[0]||'이름 없는 도로'} · 시작 노드 ${c.startNode}`,sections:roads.slice(0,6),metrics:{},score:null,duration:Math.round(c.lengthMeters/1000/25*60),real:true,reason:'표준노드링크의 방향별 도로 연결과 차로·회전 비용으로 계산한 순환 코스입니다. 난이도는 후보 비용에 따른 상대적인 구분입니다.'};
});
fs.writeFileSync('src/data/seoul-courses.json',JSON.stringify(courses));
console.log(JSON.stringify({features:unique.size,pool:pool.length,courses:courses.map(c=>({name:c.name,distance:c.distance,difficulty:c.difficulty}))}));
