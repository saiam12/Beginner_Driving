import assert from 'node:assert/strict';
import {connectCourse,connectCourses,geometryMeters,laneCostMultiplier,turnType,TURN_COSTS} from '../src/lib/connected-course.js';
import {distanceBands,updateDistanceRange} from '../src/lib/distance-range.js';
import {roadDataCost} from '../src/lib/road-data-cost.js';
const points={S:[126.9,37.5],A:[126.92,37.5],B:[126.92,37.52],C:[126.9,37.52]};
const link=(from,to)=>({type:'Feature',properties:{linkId:`${from}-${to}`,fNode:from,tNode:to},geometry:{type:'LineString',coordinates:[points[from],points[to]]}});
const square=[link('S','A'),link('A','B'),link('B','C'),link('C','S')];
const range={min:5,max:10};
const cycle=connectCourse(square,points.S,range);
assert(cycle.lengthMeters>=5000&&cycle.lengthMeters<=10000);
assert.equal(cycle.linkIds.length,4);
assert.equal(new Set(cycle.linkIds).size,4);
assert.deepEqual(cycle.start,cycle.end);
const features=cycle.featureCollection.features;
features.forEach((feature,i)=>assert.equal(feature.properties.tNode,features[(i+1)%features.length].properties.fNode));
assert.equal(cycle.lengthMeters,square.reduce((sum,feature)=>sum+geometryMeters(feature.geometry),0));
const oneWay=connectCourse(square.slice(0,3),points.S,range,'oneway');
assert(oneWay.lengthMeters>=5000&&oneWay.lengthMeters<=10000);
assert.notDeepEqual(oneWay.start,oneWay.end);
assert.throws(()=>connectCourse(square.slice(0,3),points.S,range,'loop'),/찾지/);
assert.throws(()=>connectCourse([],points.S,range),/찾지/);
assert.throws(()=>connectCourse(square,points.S,{min:0,max:10}),/거리/);
// Geographic crossing alone is not a junction: only original node IDs connect.
const disconnected=square.map((feature,i)=>({...feature,properties:{...feature.properties,fNode:`F${i}`,tNode:`T${i}`}}));
assert.throws(()=>connectCourse(disconnected,points.S,range),/찾지/);
const duplicated=connectCourse([...square,...square],points.S,range);
assert.equal(duplicated.linkIds.length,4);
assert.equal(connectCourses([...square,...square],points.S,range).length,1,'rotated and duplicate loops are not alternatives');
// Independent loops of different lengths verify one result per distance band.
function loopsFor(lengths){
 return lengths.flatMap((length,i)=>{
  const scale=length/cycle.lengthMeters;
  const coords=[points.S,[126.9+0.02*scale,37.5],[126.9+0.02*scale,37.5+0.02*scale],[126.9,37.5+0.02*scale],points.S];
  const nodes=['S',`A${i}`,`B${i}`,`C${i}`,'S'];
  return coords.slice(1).map((to,j)=>({type:'Feature',properties:{linkId:`loop${i}-${j}`,fNode:nodes[j],tNode:nodes[j+1]},geometry:{type:'LineString',coordinates:[coords[j],to]}}));
 });
}
assert.deepEqual(distanceBands({min:5,max:10}),[{min:5,max:6},{min:7,max:8},{min:9,max:10}]);
assert.deepEqual(distanceBands({min:10,max:20}),[{min:10,max:13},{min:13,max:16},{min:16,max:20}]);
assert.deepEqual(updateDistanceRange({min:5,max:15},'max',16),{min:6,max:16});
assert.deepEqual(updateDistanceRange({min:10,max:20},'min',5),{min:5,max:15});
assert.deepEqual(updateDistanceRange({min:5,max:10},'min',3),{min:5,max:10});
assert.deepEqual(updateDistanceRange({min:5,max:15},'max',20),{min:10,max:20});
assert.deepEqual(updateDistanceRange({min:10,max:20},'max',30),{min:20,max:30});
assert.deepEqual(updateDistanceRange({min:20,max:30},'max',35),{min:20,max:30});
for(let min=5;min<=30;min++)for(let max=min;max<=Math.min(30,min+10);max++)for(const field of ['min','max'])for(let next=0;next<=35;next++){
 const updated=updateDistanceRange({min,max},field,next);
 assert(updated.min>=5&&updated.max<=30&&updated.min<=updated.max&&updated.max-updated.min<=10);
}
for(const mode of ['loop','oneway'])for(const [r,lengths] of [[range,[5500,7500,9500]],[{min:10,max:20},[11500,14500,18000]],[{min:20,max:30},[21500,24500,28000]]]){
 const courses=connectCourses(loopsFor(lengths),points.S,r,mode);
 assert.equal(courses.length,3);
 assert.equal(new Set(courses.map(c=>c.bandIndex)).size,3);
 courses.forEach(course=>{
  assert(course.lengthMeters>=course.distanceBand.min*1000&&course.lengthMeters<=course.distanceBand.max*1000);
  assert.equal(course.lengthMeters,course.featureCollection.features.reduce((sum,f)=>sum+geometryMeters(f.geometry),0));
  course.featureCollection.features.forEach((f,i,all)=>{if(i)assert.equal(all[i-1].properties.tNode,f.properties.fNode);});
  if(mode==='loop')assert.deepEqual(course.start,course.end);
 });
}
const partial=connectCourses(square,points.S,range);
assert.equal(partial.length,1);
assert.deepEqual(partial[0].distanceBand,{min:7,max:8});
assert.throws(()=>connectCourses(square,points.S,{min:5,max:20}),/10km/);
assert.throws(()=>connectCourses(square,points.S,{min:3,max:10}),/5~30km/);
assert.deepEqual([3,4,5,2,6,7,8,10,1].map(laneCostMultiplier),[1,1,1,1.5,1.5,2,2.5,2.5,3]);
// Prefer a slightly longer three-lane loop over a shorter one-lane loop in the SAME band.
const weightedLoops=loopsFor([5500,5700]).map(f=>({...f,properties:{...f.properties,lanes:f.properties.linkId.startsWith('loop0')?1:3}}));
const preferredLoop=connectCourses(weightedLoops,points.S,range,'loop')[0];
assert(preferredLoop.linkIds.every(id=>id.startsWith('loop1')));
assert(preferredLoop.lengthMeters>5500&&preferredLoop.lengthMeters<=6000);
const preferredFeatures=preferredLoop.featureCollection.features;
assert.equal(preferredLoop.cost,preferredLoop.lengthMeters+preferredFeatures.slice(1).reduce((sum,f,i)=>sum+TURN_COSTS[turnType(preferredFeatures[i],f)],0));
// Two directed edges share endpoints: the longer preferred road wins, until distance excludes it.
const makeEdge=(id,lanes,coords)=>({type:'Feature',properties:{linkId:id,fNode:'S',tNode:'T',lanes},geometry:{type:'LineString',coordinates:coords}});
const end=[126.96,37.5];
const direct=makeEdge('short-one-lane',1,[points.S,end]);
const detour=makeEdge('long-three-lane',3,[points.S,[126.93,37.51],end]);
assert(geometryMeters(detour.geometry)>geometryMeters(direct.geometry));
assert.equal(connectCourses([direct,detour],points.S,range,'oneway')[0].linkIds[0],'long-three-lane');
const limited=connectCourses([direct,detour],points.S,{min:5,max:5.5},'oneway')[0];
assert.equal(limited.linkIds[0],'short-one-lane');
assert.equal(limited.cost,limited.lengthMeters*3);
console.log('PASS: requested lane cost order, preferred longer loop/one-way path, independent physical distance constraint and cost sum');
const center=[126.9,37.5];
const line=coords=>({geometry:{type:'LineString',coordinates:coords}});
const entering=line([[126.9,37.49],center]);
assert.equal(turnType(entering,line([center,[126.91,37.5]])),'right');
assert.equal(turnType(entering,line([center,[126.89,37.5]])),'left');
assert.equal(turnType(entering,line([center,[126.9,37.51]])),'straight');
assert.equal(turnType(entering,line([center,[126.9,37.49]])),'uturn');
assert(TURN_COSTS.straight<TURN_COSTS.right&&TURN_COSTS.right<TURN_COSTS.left&&TURN_COSTS.left<TURN_COSTS.uturn);
assert.equal(turnType(line([[126.9,37.49],center,center]),line([center,center,[126.91,37.5]])),'right');
const junction=[126.93,37.525];
const turnEdge=(id,from,to,coords)=>({...makeEdge(id,3,coords),properties:{linkId:id,fNode:from,tNode:to,lanes:3}});
const turnRoads=[
 turnEdge('right-in','S','N',[center,[126.9,37.525]]),
 turnEdge('right-out','N','T',[[126.9,37.525],junction]),
 turnEdge('left-in','S','E',[center,[126.93,37.5]]),
 turnEdge('left-out','E','T',[[126.93,37.5],junction])
];
const turnPreferred=connectCourses(turnRoads,center,range,'oneway')[0];
assert.deepEqual(turnPreferred.linkIds,['right-in','right-out']);
assert.equal(turnPreferred.cost,turnPreferred.lengthMeters+TURN_COSTS.right);
console.log('PASS: turn classification from local bearings, duplicate coordinates, right/left/U-turn ordering and lower-cost right-turn route');
const metrics={lanes:3,trafficVolume:900,trafficPeriod:'weekday-08-09',trafficReferencePeriod:'weekday-08-09',trafficPerLaneReference:1000,accidentCount:2,accidentPeriod:'2023-2025',accidentReferencePeriod:'2023-2025',accidentsPerKmReference:4};
const calculated=roadDataCost(metrics,2000);
assert.equal(calculated.trafficPerLane,300);
assert.equal(calculated.accidentsPerKm,1);
assert.equal(calculated.trafficCost,1200);
assert.equal(calculated.accidentCost,1500);
assert.equal(roadDataCost({...metrics,lanes:6},2000).trafficCost,600);
const missing=roadDataCost({lanes:3},2000);
assert.equal(missing.trafficScore,null);assert.equal(missing.accidentScore,null);
assert.equal(missing.trafficCost+missing.accidentCost,0);
const zero=roadDataCost({...metrics,trafficVolume:0,accidentCount:0},2000);
assert.equal(zero.trafficScore,0);assert.equal(zero.accidentScore,0);
for(const invalid of [null,undefined,'900',-1,NaN,Infinity]){
 const result=roadDataCost({...metrics,trafficVolume:invalid,accidentCount:invalid},2000);
 assert.equal(result.trafficScore,null);assert.equal(result.accidentScore,null);
}
assert.equal(roadDataCost({...metrics,lanes:0},2000).trafficScore,null);
assert.equal(roadDataCost({...metrics,trafficPerLaneReference:0},2000).trafficScore,null);
assert.equal(roadDataCost({...metrics,trafficPeriod:'night'},2000).trafficScore,null);
assert.equal(roadDataCost({...metrics,accidentPeriod:'2022'},2000).accidentScore,null);
assert.equal(roadDataCost({...metrics,accidentCount:1.5},2000).accidentScore,null);
assert.equal(roadDataCost(metrics,-1).trafficCost,0);
const noDataCourse=connectCourses([direct,detour],points.S,range,'oneway')[0];
assert.equal(noDataCourse.costBreakdown.traffic,0);assert.equal(noDataCourse.costBreakdown.accidents,0);
assert.deepEqual(noDataCourse.dataCoverage,{traffic:0,accidents:0});
const populated=feature=>({...feature,properties:{...feature.properties,...metrics,trafficVolume:feature.properties.linkId===direct.properties.linkId?0:3000,accidentCount:0}});
const trafficChoice=connectCourses([populated(direct),populated(detour)],points.S,range,'oneway')[0];
assert.equal(trafficChoice.linkIds[0],'short-one-lane');
assert.equal(trafficChoice.dataCoverage.traffic,1);
const accidentFeatures=[direct,detour].map(feature=>({...feature,properties:{...feature.properties,...metrics,trafficVolume:0,accidentCount:feature===direct?0:100}}));
assert.equal(connectCourses(accidentFeatures,points.S,range,'oneway')[0].linkIds[0],'short-one-lane');
const combined=connectCourses([{...direct,properties:{...direct.properties,...metrics}}],points.S,range,'oneway')[0];
assert(combined.costBreakdown.traffic>0&&combined.costBreakdown.accidents>0);
assert.equal(combined.cost,Object.values(combined.costBreakdown).reduce((sum,n)=>sum+n,0));
assert.deepEqual(combined.dataCoverage,{traffic:1,accidents:1});
assert.equal(combined.lengthMeters,geometryMeters(direct.geometry));
console.log('PASS: future traffic-per-lane and accidents/km costs, missing versus measured zero, bad values/reference/period rejection, data coverage, traffic/accident route preference, unchanged physical distance');
console.log('PASS: one loop/one-way per distance band, 5–10 and 10–20 splits, unavailable bands omitted, moving input bounds, minimum 5 / maximum span 10');
console.log(`PASS: directed node continuity, ${(cycle.lengthMeters/1000).toFixed(2)}km loop, one-way path, exact geometry length sum, no invented junction, duplicate LINKs, disconnected/no-match/invalid range`);
