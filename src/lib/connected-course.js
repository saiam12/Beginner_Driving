import {distanceBands,MIN_DISTANCE,MAX_DISTANCE,MAX_DISTANCE_SPAN} from './distance-range.js';
import {roadDataCost} from './road-data-cost.js';
import {lanePreferenceMultiplier,driverRoadPenalty,driverTurnPenalty,driverJunctionDiscount,practiceGoalMatch,validateProfile} from './driver-preferences.js';
export function metersBetween(a,b) {
 const rad=Math.PI/180,dy=(b[1]-a[1])*rad,dx=(b[0]-a[0])*rad;
 const h=Math.sin(dy/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dx/2)**2;
 return 6371008.8*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
export function geometryMeters(geometry) {
 const parts=geometry.type==='LineString'?[geometry.coordinates]:geometry.coordinates;
 return parts.reduce((sum,points)=>sum+points.slice(1).reduce((length,p,i)=>length+metersBetween(points[i],p),0),0);
}
// Binary heap keeps nationwide LINK subgraphs from blocking a quadratic search.
class Queue {
 items=[];
 push(value) {
  const a=this.items;a.push(value);let i=a.length-1;
  while(i>0){const parent=(i-1)>>1;if(a[parent][0]<=value[0])break;a[i]=a[parent];i=parent;}a[i]=value;
 }
 pop() {
  const a=this.items,first=a[0],last=a.pop();if(!a.length)return first;
  let i=0;while(i*2+1<a.length){let child=i*2+1;if(child+1<a.length&&a[child+1][0]<a[child][0])child++;if(a[child][0]>=last[0])break;a[i]=a[child];i=child;}a[i]=last;return first;
 }
}
export function laneCostMultiplier(lanes) {
 if(lanes===3||lanes===4||lanes===5)return 1;
 if(lanes===2||lanes===6)return 1.5;
 if(lanes===7)return 2;
 if(Number.isInteger(lanes)&&lanes>=8)return 2.5;
 return 3; // One lane and unknown lane counts receive no preference.
}
export const TURN_COSTS = {straight:0,right:50,left:150,uturn:500};
export const RETRACING_COST_PER_METER = 3;
function direction(points,atEnd) {
 const anchor=atEnd?points.at(-1):points[0];
 const candidates=atEnd?points.slice(0,-1).reverse():points.slice(1);
 const other=candidates.find(point=>metersBetween(anchor,point)>1);
 if(!other)return null;
 const [a,b]=atEnd?[other,anchor]:[anchor,other],rad=Math.PI/180;
 const delta=(b[0]-a[0])*rad,lat1=a[1]*rad,lat2=b[1]*rad;
 return Math.atan2(Math.sin(delta)*Math.cos(lat2),Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2))*180/Math.PI;
}
function turnFromDirections(incoming,outgoing) {
 if(incoming===null||outgoing===null)return 'straight';
 const angle=((outgoing-incoming+540)%360)-180;
 if(Math.abs(angle)>=150)return 'uturn';
 if(Math.abs(angle)<30)return 'straight';
 return angle>0?'right':'left';
}
export function turnType(previous,next) {
 if(!previous)return 'straight';
 return turnFromDirections(direction(previous.geometry.coordinates,true),direction(next.geometry.coordinates,false));
}
function transitionCost(previous,next) {
 if(!previous)return 0;
 // Bearings are fixed for the graph: do not rescan coordinates at every relaxation.
 const type=turnFromDirections(previous.endDirection,next.startDirection);
 return TURN_COSTS[type]+driverTurnPenalty(type,next.profile,TURN_COSTS[type]);
}
function shortest(graph,start,limit,blocked=new Set(),target=null,costLimit=Infinity,previousEdge=null,includeTurns=true,retracedPairs=null) {
 const initial={node:start,meters:0,cost:0,parent:null,edge:null,incoming:previousEdge};
 const labels=new Map([[start,[initial]]]),queue=new Queue();queue.push([0,initial]);
 while(queue.items.length){
  const [,current]=queue.pop();
  if(!labels.get(current.node)?.includes(current))continue;
  if(current.cost>=costLimit)break;
  if(current.node===target)return {labels,target:current};
  for(const edge of graph.get(current.node)||[]){
   if(blocked.has(edge.to))continue;
   const retracingCost=retracedPairs?.get(edge.to)?.has(edge.from)?edge.meters*RETRACING_COST_PER_METER:0;
   const next={node:edge.to,meters:current.meters+edge.meters,cost:current.cost+edge.cost+retracingCost+(includeTurns?transitionCost(current.incoming,edge):0),parent:current,edge,incoming:edge,retracingCost};
   if(next.meters>limit||next.cost>=costLimit)continue;
   const all=labels.get(edge.to)||[];
   // Different incoming roads have different future turn costs.
   const same=label=>!includeTurns||label.incoming?.feature.properties.linkId===edge.feature.properties.linkId;
   const existing=all.filter(same),others=all.filter(label=>!same(label));
   // Keep cheaper and shorter alternatives separately: cost is not physical distance.
   if(existing.some(label=>label.cost<=next.cost&&label.meters<=next.meters))continue;
   let kept=existing.filter(label=>!(next.cost<=label.cost&&next.meters<=label.meters));kept.push(next);
   if(kept.length>8){
    const shortest=kept.reduce((a,b)=>a.meters<b.meters?a:b);
    kept.sort((a,b)=>a.cost-b.cost);kept=kept.slice(0,7);
    if(!kept.includes(shortest))kept.push(shortest);
   }
   labels.set(edge.to,[...others,...kept]);if(kept.includes(next))queue.push([next.cost,next]);
  }
 }
 return {labels,target:null};
}
function path(label) {
 const edges=[];while(label?.edge){edges.push(label.retracingCost?{...label.edge,retracingCost:label.retracingCost}:label.edge);label=label.parent;}return edges.reverse();
}
export const AUTO_START_LIMIT=48;
export const MAX_START_SNAP_METERS=300;
export function selectCourseStarts(nodes,center,options={}) {
 const b=options.bounds;
 const visible=nodes.filter(item=>!b||(item.point[0]>=b[0]&&item.point[0]<=b[2]&&item.point[1]>=b[1]&&item.point[1]<=b[3]));
 if(options.startPoint){
  const nearest=visible.map(item=>({...item,distance:metersBetween(options.startPoint,item.point)})).sort((a,b)=>a.distance-b.distance||a.node.localeCompare(b.node))[0];
  if(!nearest||nearest.distance>MAX_START_SNAP_METERS)throw new Error('지정 위치의 300m 안에 출발할 도로가 없습니다. 도로 가까운 위치를 선택하거나 지도를 이동해주세요.');
  return [nearest];
 }
 if(!visible.length)return [];
 if(!b)return visible.map(item=>({...item,distance:metersBetween(center,item.point)})).sort((a,b)=>a.distance-b.distance).slice(0,8);
 // Spread the bounded search across the viewport instead of fixing it at its center.
 const cells=new Map();
 for(const item of visible){
  const x=Math.min(3,Math.floor((item.point[0]-b[0])/(b[2]-b[0])*4));
  const y=Math.min(3,Math.floor((item.point[1]-b[1])/(b[3]-b[1])*4));
  const key=y*4+x,cx=b[0]+(x+.5)*(b[2]-b[0])/4,cy=b[1]+(y+.5)*(b[3]-b[1])/4;
  if(!cells.has(key))cells.set(key,[]);
  cells.get(key).push({...item,distance:metersBetween(center,item.point),cellDistance:metersBetween([cx,cy],item.point)});
 }
 return [...cells.entries()].sort((a,b)=>a[0]-b[0]).flatMap(([,items])=>items.sort((a,b)=>a.cellDistance-b.cellDistance||a.node.localeCompare(b.node)).slice(0,3)).slice(0,AUTO_START_LIMIT);
}
export const CONNECTED_COURSE_COLOR = '#dc2626';
function connectInBand(features,center,range,mode='loop',options={}) {
 const min=range.min*1000,max=range.max*1000,target=(min+max)/2;
 if(!Number.isFinite(min)||min<=0||max<min||!center?.every(Number.isFinite))throw new Error('거리와 지도 위치를 확인해주세요.');
 const neighbors=new Map();
 for(const {properties:p,geometry:g} of features){
  if(!p.fNode||!p.tNode||g.type!=='LineString')continue;
  for(const [from,to] of [[p.fNode,p.tNode],[p.tNode,p.fNode]]){
   if(!neighbors.has(from))neighbors.set(from,new Set());neighbors.get(from).add(to);
  }
 }
 const graph=new Map(),reverse=new Map(),startPositions=new Map(),seen=new Set();
 for(const feature of features){
  const p=feature.properties,g=feature.geometry;
  // Disconnected multipart geometry cannot prove a continuous driving segment.
  if(!p.fNode||!p.tNode||seen.has(p.linkId)||g.type!=='LineString'||g.coordinates.length<2)continue;
  const meters=geometryMeters(g);if(meters<=0||meters>max)continue;seen.add(p.linkId);
  const dataCosts=roadDataCost(p,meters),laneCost=meters*laneCostMultiplier(p.lanes);
  const junction=(neighbors.get(p.fNode)?.size||0)>=3;
  const preferenceCost=meters*(lanePreferenceMultiplier(p.lanes,options.preferredLanes)+driverRoadPenalty(p.lanes,options.profile))-laneCost*driverJunctionDiscount(junction,options.profile);
  const edge={junction,from:p.fNode,to:p.tNode,meters,laneCost,preferenceCost,profile:options.profile,dataCosts,cost:laneCost+preferenceCost+dataCosts.trafficCost+dataCosts.accidentCost,feature,startDirection:direction(g.coordinates,false),endDirection:direction(g.coordinates,true)};
  if(!graph.has(edge.from))graph.set(edge.from,[]);graph.get(edge.from).push(edge);
  if(!reverse.has(edge.to))reverse.set(edge.to,[]);reverse.get(edge.to).push({...edge,to:edge.from});
  if(!startPositions.has(edge.from))startPositions.set(edge.from,g.coordinates[0]);
 }
 const starts=selectCourseStarts([...graph.keys()].map(node=>({node,point:startPositions.get(node)})),center,options);
 let best=null;const pool=new Map(),collectAll=options.collectAll===true;
 const accept=(edges,startDistance)=>{
  if(!edges.length)return false;
  if(mode==='oneway'&&edges[0].from===edges.at(-1).to)return false;
  if(edges.some((edge,i)=>i&&metersBetween(edges[i-1].feature.geometry.coordinates.at(-1),edge.feature.geometry.coordinates[0])>60))return false;
  if(mode==='loop'&&metersBetween(edges.at(-1).feature.geometry.coordinates.at(-1),edges[0].feature.geometry.coordinates[0])>60)return false;
  const lengthMeters=edges.reduce((sum,edge)=>sum+edge.meters,0);
  if(lengthMeters<min||lengthMeters>max)return false;
  if(new Set(edges.map(edge=>edge.feature.properties.linkId)).size!==edges.length)return false;
  const costBreakdown=edges.reduce((sum,edge,i)=>({lane:sum.lane+edge.laneCost,preference:sum.preference+edge.preferenceCost+(edge.retracingCost||0),traffic:sum.traffic+edge.dataCosts.trafficCost,accidents:sum.accidents+edge.dataCosts.accidentCost,turns:sum.turns+(i?transitionCost(edges[i-1],edge):0)}),{lane:0,preference:0,traffic:0,accidents:0,turns:0});
  const cost=Object.values(costBreakdown).reduce((sum,value)=>sum+value,0);
  const key=[...edges.map(edge=>edge.feature.properties.linkId)].sort().join(',');
  const previous=collectAll?pool.get(key):best;
  if(previous&&(cost>previous.cost||cost===previous.cost&&startDistance>=previous.startDistance))return false;
  const dataCoverage={traffic:edges.reduce((sum,edge)=>sum+(edge.dataCosts.trafficScore===null?0:edge.meters),0)/lengthMeters,accidents:edges.reduce((sum,edge)=>sum+(edge.dataCosts.accidentScore===null?0:edge.meters),0)/lengthMeters};
  const practiceCounts={right:0,left:0,uturn:0,narrow:0,junctions:0};
  edges.forEach((edge,i)=>{
   if(edge.feature.properties.lanes===1)practiceCounts.narrow+=edge.meters;
   if(edge.junction)practiceCounts.junctions++;
   if(i){const type=turnFromDirections(edges[i-1].endDirection,edge.startDirection);if(type in practiceCounts)practiceCounts[type]++;}
  });
  const goalMatch=practiceGoalMatch(options.profile,practiceCounts);
  const course={practiceCounts,goalMatch,startNode:edges[0].from,startSelection:options.startPoint?'manual':'auto',startNodesCompared:starts.length,mode,lengthMeters,cost,costBreakdown,dataCoverage,startDistance,linkIds:edges.map(edge=>edge.feature.properties.linkId),
   start:edges[0].feature.geometry.coordinates[0],end:edges.at(-1).feature.geometry.coordinates.at(-1),
   featureCollection:{type:'FeatureCollection',features:edges.map(edge=>edge.feature)}};
  if(collectAll)pool.set(key,course);
  if(!best||cost<best.cost||cost===best.cost&&startDistance<best.startDistance)best=course;
  return true;
 };
 for(const {node:start,distance:startDistance} of starts){
  const outward=shortest(graph,start,max);
  const labels=[...outward.labels.values()].flat();
  if(mode==='oneway'){
   const candidates=labels.filter(label=>label.meters>=min&&label.meters<=max)
    .sort((a,b)=>a.cost-b.cost||Math.abs(a.meters-target)-Math.abs(b.meters-target)).slice(0,128);
   for(const candidate of candidates){if(!collectAll&&best&&candidate.cost>=best.cost)break;accept(path(candidate),startDistance);}
  }else{
   // Ignore turns on the reverse graph: this is only an optimistic lower bound.
   const backward=shortest(reverse,start,max,new Set(),null,Infinity,null,false);
   const candidates=labels.filter(label=>label.node!==start&&label.meters>=min/4&&label.meters<max&&backward.labels.get(label.node)?.some(back=>label.meters+back.meters>=min&&label.meters+back.meters<=max))
    .map(label=>({label,bound:label.cost+Math.min(...backward.labels.get(label.node).map(back=>back.cost))}))
    .sort((a,b)=>a.bound-b.bound||Math.abs(a.label.meters-target/2)-Math.abs(b.label.meters-target/2)).slice(0,64);
   for(const {label,bound} of candidates){
    if(!collectAll&&best&&bound>=best.cost)break;
    const out=path(label),blocked=new Set(out.slice(0,-1).map(edge=>edge.to));
    // Directed LINK IDs differ on opposite carriageways. Match reversed node pairs
    // so returning along the outward corridor has a soft, length-weighted cost.
    const retracedPairs=options.profile?.goals.includes('uturn')?new Map():null;
    if(retracedPairs)for(const edge of out){if(!retracedPairs.has(edge.from))retracedPairs.set(edge.from,new Set());retracedPairs.get(edge.from).add(edge.to);}
    const back=shortest(graph,label.node,max-label.meters,blocked,start,!collectAll&&best?best.cost-label.cost:Infinity,out.at(-1),true,retracedPairs);
    if(!back.target||label.meters+back.target.meters<min)continue;
    accept([...out,...path(back.target)],startDistance);
   }
  }
 }
 if(collectAll&&pool.size)return [...pool.values()].sort((a,b)=>a.cost-b.cost||a.startDistance-b.startDistance);
 if(best)return [best];
 throw new Error('현재 화면에서 해당 거리의 연결 경로를 찾지 못했습니다. 지도 위치·배율·거리를 바꿔주세요.');
}
export function connectCourse(features,center,range,mode='loop',options={}) {
 return connectCourses(features,center,range,mode,options)[0];
}
function validateOptions(center,range,mode,options) {
 if(!['loop','oneway'].includes(mode))throw new Error('경로 형태를 확인해주세요.');
 if(options.bounds&&(!Array.isArray(options.bounds)||options.bounds.length!==4||!options.bounds.every(Number.isFinite)||options.bounds[0]>=options.bounds[2]||options.bounds[1]>=options.bounds[3]))throw new Error('지도 범위를 확인해주세요.');
 if(options.startPoint&&(!Array.isArray(options.startPoint)||options.startPoint.length!==2||!options.startPoint.every(Number.isFinite)||Math.abs(options.startPoint[0])>180||Math.abs(options.startPoint[1])>90))throw new Error('출발 위치를 확인해주세요.');
 if(options.profile)options={...options,profile:validateProfile(options.profile)};
 if(options.preferredLanes&&(!Array.isArray(options.preferredLanes)||options.preferredLanes.some(lane=>!Number.isInteger(lane)||lane<1||lane>7)))throw new Error('선호 차로를 확인해주세요.');
 if(!Number.isFinite(range.min)||!Number.isFinite(range.max)||range.min<MIN_DISTANCE||range.max>MAX_DISTANCE||range.max<range.min||range.max-range.min>MAX_DISTANCE_SPAN||!center||center.length!==2||!center.every(Number.isFinite))throw new Error('거리는 5~30km, 최소·최대 차이는 10km 이내로 설정해주세요.');
 return options;
}
// Bounded discovery: up to 48 spatially distributed viewport starts; one snapped manual start.
// This reports every unique accepted candidate, not all cycles in the graph.
export function exploreCourseCandidates(features,center,range,mode='loop',options={}) {
 options=validateOptions(center,range,mode,options);
 return connectInBand(features,center,range,mode,{...options,collectAll:true});
}
export function connectCourses(features,center,range,mode='loop',options={}) {
 options=validateOptions(center,range,mode,options);
 const courses=[];
 for(const [bandIndex,band] of distanceBands(range).entries()){
  try{
   const course=connectInBand(features,center,band,mode,options)[0];
   // Inclusive boundaries may match the same route; never recommend it twice.
   const key=[...course.linkIds].sort().join(',');
   if(!courses.some(other=>[...other.linkIds].sort().join(',')===key))courses.push({...course,distanceBand:band,bandIndex});
  }catch(error){if(!error.message.includes('찾지 못했습니다'))throw error;}
 }
 if(courses.length)return courses;
 throw new Error('현재 화면에서 해당 거리의 연결 경로를 찾지 못했습니다. 지도 위치·배율·거리를 바꿔주세요.');
}
