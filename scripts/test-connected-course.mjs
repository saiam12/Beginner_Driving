import {courseOverlapRatio,classifyCourseCandidates} from '../src/lib/course-overlap.js';
import assert from 'node:assert/strict';
import {selectCourseStarts,exploreCourseCandidates,connectCourse,connectCourses,geometryMeters,laneCostMultiplier,turnType,TURN_COSTS,RETRACING_COST_PER_METER} from '../src/lib/connected-course.js';
import {distanceBands,updateDistanceRange} from '../src/lib/distance-range.js';
import {roadDataCost} from '../src/lib/road-data-cost.js';
import {lanePreferenceMultiplier} from '../src/lib/driver-preferences.js';
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
const preferredOne=connectCourses([direct,detour],points.S,range,'oneway',{preferredLanes:[1]})[0];
assert(laneCostMultiplier(1)+lanePreferenceMultiplier(1,[1])<laneCostMultiplier(3)+lanePreferenceMultiplier(3,[1]),'Explicit preference outranks the basic lane tier at equal length');
assert.equal(preferredOne.linkIds[0],'short-one-lane','A lane preference must change cost without filtering roads');
assert.equal(connectCourses([direct],points.S,range,'oneway',{preferredLanes:[3]})[0].linkIds[0],'short-one-lane','Unselected roads remain eligible when needed');
assert.equal(connectCourses([direct,detour],points.S,range,'oneway',{preferredLanes:[]})[0].linkIds[0],'long-three-lane','Empty selection retains the basic lane cost');
const mixed=square.map((f,i)=>({...f,properties:{...f.properties,lanes:i===1?2:3}}));
const bridgeCourse=connectCourses(mixed,points.S,range,'loop',{preferredLanes:[3]})[0];
assert(bridgeCourse.featureCollection.features.some(f=>f.properties.lanes===2),'Unselected connecting segment must not break a loop');
assert(bridgeCourse.costBreakdown.preference>0);
assert.equal(bridgeCourse.cost,Object.values(bridgeCourse.costBreakdown).reduce((sum,n)=>sum+n,0));
console.log('PASS: lane selection is a soft preference, unselected connecting roads remain eligible, empty selection and preference cost sum');
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
// Curved LINKs must use their endpoint bearings, including repeated endpoint coordinates.
const curvedSquare=square.map(feature=>{
 const [a,b]=feature.geometry.coordinates;
 const mid=[(a[0]+b[0])/2+.001,(a[1]+b[1])/2+.001];
 return {...feature,geometry:{type:'LineString',coordinates:[a,a,mid,b,b]}};
});
const originalCurves=JSON.stringify(curvedSquare);
for(const avoid of [[],['left','uturn']]){
 const curveProfile={goal:'gentle',avoid};
 const curveCourse=exploreCourseCandidates(curvedSquare,points.S,range,'loop',{profile:curveProfile})[0];
 const curveFeatures=curveCourse.featureCollection.features;
 const expected=curveFeatures.slice(1).reduce((sum,feature,i)=>{
  const type=turnType(curveFeatures[i],feature);
  return sum+TURN_COSTS[type]+(type==='left'&&avoid.includes('left')?250:0)+(type==='uturn'&&avoid.includes('uturn')?500:0);
 },0);
 assert.equal(curveCourse.costBreakdown.turns,expected);
}
assert.equal(JSON.stringify(curvedSquare),originalCurves,'Graph bearing preparation must not mutate source data');
console.log('PASS: cached endpoint bearings preserve curved/repeated-coordinate turn costs and independent preference runs');
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

const pool=exploreCourseCandidates(loopsFor(Array.from({length:10},(_,i)=>5200+i*400)),points.S,range);
assert.equal(pool.length,10,'retain all ten discovered loops including more expensive alternatives');
assert.equal(exploreCourseCandidates([...square,...square],points.S,range).length,1,'deduplicate rotations and repeated input');
const weightedPool=exploreCourseCandidates(weightedLoops,points.S,range);
assert.equal(weightedPool.length,2);assert(weightedPool[0].linkIds.every(id=>id.startsWith('loop1')),'total cost outranks physical length');
pool.forEach((course,i)=>{
 assert(course.lengthMeters>=5000&&course.lengthMeters<=10000);
 assert.equal(course.cost,Object.values(course.costBreakdown).reduce((a,b)=>a+b,0));
 assert.deepEqual(course.start,course.end);
 assert.equal(new Set(course.linkIds).size,course.linkIds.length);
 if(i)assert(pool[i-1].cost<=course.cost);
});
for(const count of [3,4,5])assert.equal(pool.slice(0,count).length,count);
assert.throws(()=>exploreCourseCandidates(square,points.S,range,'invalid'),/경로/);
assert.throws(()=>exploreCourseCandidates(square.slice(0,3),points.S,range),/찾지/);
console.log('PASS: full bounded candidate pool, 10 distinct loops, cost ordering, higher-cost retention, rotation deduplication and top 3/4/5 adoption');

const viewportBounds=[126.89,37.49,127.03,37.56];
const expensiveNear=loopsFor([5200,5500,5800,6200,6800]).map(f=>({...f,properties:{...f.properties,lanes:1}}));
const cheapFar=loopsFor([5600]).map(f=>({...f,properties:{...f.properties,linkId:'far-'+f.properties.linkId,fNode:'far-'+f.properties.fNode,tNode:'far-'+f.properties.tNode,lanes:3},geometry:{...f.geometry,coordinates:f.geometry.coordinates.map(([x,y])=>[x+.075,y])}}));
const automaticPool=exploreCourseCandidates([...expensiveNear,...cheapFar],points.S,range,'loop',{bounds:viewportBounds});
assert(automaticPool[0].start[0]>126.97,'Auto start must discover a cheaper loop away from map center');
assert(automaticPool[0].startNodesCompared>8&&automaticPool[0].startNodesCompared<=48);
const requested=[126.90005,37.50005];
const manualPool=exploreCourseCandidates([...expensiveNear,...cheapFar],points.S,range,'loop',{bounds:viewportBounds,startPoint:requested});
manualPool.forEach(c=>{assert.equal(c.startNode,'S');assert.deepEqual(c.start,points.S);assert.equal(c.startSelection,'manual');assert(c.startDistance<10);assert.equal(c.startNodesCompared,1);});
assert.throws(()=>exploreCourseCandidates(square,points.S,range,'loop',{bounds:viewportBounds,startPoint:[127,37.55]}),/300m/);
assert.throws(()=>exploreCourseCandidates(square,points.S,range,'loop',{bounds:[2,1,0,3]}),/지도 범위/);
assert.throws(()=>exploreCourseCandidates(square,points.S,range,'loop',{startPoint:[NaN,1]}),/출발/);
const sampled=selectCourseStarts([{node:'inside',point:points.S},{node:'outside',point:[128,38]}],points.S,{bounds:viewportBounds});
assert.equal(sampled.length,1);assert.equal(sampled[0].node,'inside');
assert.equal(selectCourseStarts([...Array(100)].map((_,i)=>({node:String(i),point:[126.9+i*.001,37.5+i*.0003]})),points.S,{bounds:viewportBounds}).length<=48,true);
console.log('PASS: distributed automatic start selects cheaper off-center loop; manual start anchors every candidate; out-of-view/far/invalid locations do not silently fall back');

// Opposite LINK IDs must not make a cheap out-and-back outrank a real loop.
const returnPoints={S:points.S,A:[126.934,37.5],B:[126.934,37.515]};
const returnEdge=(id,from,to)=>({type:'Feature',properties:{linkId:id,fNode:from,tNode:to,lanes:3},geometry:{type:'LineString',coordinates:[returnPoints[from],returnPoints[to]]}});
const returnRoads=[returnEdge('outward','S','A'),returnEdge('same-road-back','A','S'),returnEdge('other-road-1','A','B'),returnEdge('other-road-2','B','S')];
const unchangedReturnRoads=JSON.stringify(returnRoads);
const returnOptions={startPoint:points.S,profile:{goal:'gentle',avoid:['uturn']}};
const preferredReturn=exploreCourseCandidates(returnRoads,points.S,range,'loop',returnOptions)[0];
assert(preferredReturn.linkIds.includes('other-road-1')&&preferredReturn.linkIds.includes('other-road-2'));
assert(!preferredReturn.linkIds.includes('same-road-back'),'choose the longer alternative return instead of reversing the outbound road');
assert.equal(preferredReturn.costBreakdown.preference,0,'a real loop receives no retracing penalty');
const returnFallback=exploreCourseCandidates(returnRoads.slice(0,2),points.S,range,'loop',returnOptions)[0];
assert.deepEqual(returnFallback.linkIds,['outward','same-road-back'],'retain out-and-back when there is no other return');
assert.equal(returnFallback.costBreakdown.preference,geometryMeters(returnRoads[1].geometry)*RETRACING_COST_PER_METER);
assert.equal(returnFallback.cost,Object.values(returnFallback.costBreakdown).reduce((a,b)=>a+b,0));
assert.equal(returnFallback.lengthMeters,returnRoads.slice(0,2).reduce((n,f)=>n+geometryMeters(f.geometry),0),'penalty does not inflate driving distance');
assert.equal(JSON.stringify(returnRoads),unchangedReturnRoads,'return-search penalties never mutate road data');
assert.deepEqual(exploreCourseCandidates(returnRoads,points.S,range,'loop',returnOptions)[0],preferredReturn,'repeated searches do not retain penalties');
for(const profile of [undefined,{goal:'gentle',avoid:[]},{goal:'gentle',avoid:['left','narrow']}]){
 const defaultReturn=exploreCourseCandidates(returnRoads.slice(0,2),points.S,range,'loop',{startPoint:points.S,profile})[0];
 assert.equal(defaultReturn.costBreakdown.preference,0,'retracing penalty is enabled only by selecting U-turn');
 assert.equal(defaultReturn.costBreakdown.turns,TURN_COSTS.uturn,'base turn cost remains without the U-turn preference');
}
assert(exploreCourseCandidates(returnRoads,points.S,range,'loop',{startPoint:points.S})[0].linkIds.includes('same-road-back'),'without U-turn selection use the original lowest-cost return');
assert.equal(returnFallback.costBreakdown.turns,TURN_COSTS.uturn+500,'selected U-turn also retains its existing turn penalty');
console.log('PASS: selecting U-turn enables alternate-return preference, no added retracing cost when unselected, fallback, cost/physical distance separation and immutable graph');

function overlapRoute(parts,cost){
 const features=parts.map(([linkId,meters])=>({properties:{linkId},geometry:{type:'LineString',coordinates:[[0,0],[meters/111195.0802335329,0]]}}));
 return {cost,featureCollection:{features},lengthMeters:features.reduce((sum,f)=>sum+geometryMeters(f.geometry),0)};
}
const overlapBase=overlapRoute([['common',899],['one',1],['two',1],['base-tail',99]],10);
const at90=overlapRoute([['common',899],['one',1],['tail-90',100]],20);
const below90=overlapRoute([['common',899],['tail-below',101]],30);
const above90=overlapRoute([['common',899],['one',1],['two',1],['tail-above',99]],40);
const different=overlapRoute([['different',1000]],50);
assert(Math.abs(courseOverlapRatio(overlapBase,at90)-.90)<1e-12);
assert(Math.abs(courseOverlapRatio(overlapBase,below90)-.899)<1e-12);
assert(Math.abs(courseOverlapRatio(overlapBase,above90)-.901)<1e-12);
const suppression=classifyCourseCandidates([overlapBase,at90,above90,below90,different]);
assert.deepEqual(suppression.eligibleIndices,[0,3,4],'skip similar candidates and fill from later low-cost distinct routes');
assert.equal(suppression.similarTo[1].withIndex,0);assert.equal(suppression.similarTo[2].withIndex,0);
assert(!suppression.similarTo[3],'89.9 percent remains eligible');
assert.equal(courseOverlapRatio(overlapBase,{...overlapBase,featureCollection:{features:[...overlapBase.featureCollection.features].reverse()}}),1,'start rotation/order do not affect overlap');
const reversed={...overlapBase,featureCollection:{features:overlapBase.featureCollection.features.map(f=>({...f,properties:{linkId:'reverse-'+f.properties.linkId},geometry:{...f.geometry,coordinates:[...f.geometry.coordinates].reverse()}}))}};
assert.equal(courseOverlapRatio(overlapBase,reversed),0,'opposite direction LINKs are different roads for overlap');
const extended=overlapRoute([['common',899],['one',1],['two',1],['base-tail',99],['extension',1000]],70);
assert(Math.abs(courseOverlapRatio(overlapBase,extended)-.5)<1e-12,'longer-route denominator prevents containment from becoming 100 percent');
assert.deepEqual(classifyCourseCandidates([at90,overlapBase,different]).eligibleIndices,[1,2],'lowest cost survives regardless of input order');
assert.equal(classifyCourseCandidates([at90,overlapBase,different]).similarTo[0].withIndex,1);
assert.deepEqual(classifyCourseCandidates([]),{eligibleIndices:[],similarTo:{},adoptedIndices:[]});
assert.deepEqual(suppression.adoptedIndices,[0,4],'89.9% remains in the development list but cannot be adopted alongside the cheaper route');
const diverseBase=overlapRoute([['shared-a',399],['shared-b',1],['base-only',600]],10);
const exactly40=overlapRoute([['shared-a',399],['shared-b',1],['exact-only',600]],20);
const below40=overlapRoute([['shared-a',399],['below-only',601]],30);
const overlapsSecond=overlapRoute([['below-only',601],['second-only',399]],40);
const diversePool=[diverseBase,exactly40,below40,overlapsSecond,...Array.from({length:5},(_,i)=>overlapRoute([[`unique-${i}`,1000]],50+i))];
const diverseSelection=classifyCourseCandidates(diversePool);
assert.deepEqual(diverseSelection.eligibleIndices,[0,1,2,3,4,5,6,7,8],'40% exclusions remain inspectable in the full development list');
assert.deepEqual(diverseSelection.adoptedIndices,[0,2,4,5,6],'inclusive 40% exclusion, 39.9% acceptance, comparison against every adopted route, refill and cap at five');
for(const count of [3,4,5]){
 const chosen=diverseSelection.adoptedIndices.slice(0,count);
 assert.equal(chosen.length,count);
 chosen.forEach((index,i)=>chosen.slice(0,i).forEach(other=>assert(courseOverlapRatio(diversePool[index],diversePool[other])<.40)));
}
assert.deepEqual(classifyCourseCandidates([exactly40,diverseBase]).adoptedIndices,[1],'prefer cheaper route and do not relax threshold to fill slots');
console.log('PASS: adopted candidates are pairwise below 40% overlap, cost-first replacement, 3/4/5 selection and shortage handling');
console.log('PASS: length-weighted directed LINK overlap, inclusive 90 percent threshold, 89.9/90.1 boundaries, cheaper survivor, sparse stable indices and replacement shortlist');
