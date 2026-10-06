import {distanceBands,MIN_DISTANCE,MAX_DISTANCE,MAX_DISTANCE_SPAN} from './distance-range.js';
import {roadDataCost} from './road-data-cost.js';
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
function direction(points,atEnd) {
 const anchor=atEnd?points.at(-1):points[0];
 const candidates=atEnd?points.slice(0,-1).reverse():points.slice(1);
 const other=candidates.find(point=>metersBetween(anchor,point)>1);
 if(!other)return null;
 const [a,b]=atEnd?[other,anchor]:[anchor,other],rad=Math.PI/180;
 const delta=(b[0]-a[0])*rad,lat1=a[1]*rad,lat2=b[1]*rad;
 return Math.atan2(Math.sin(delta)*Math.cos(lat2),Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2))*180/Math.PI;
}
export function turnType(previous,next) {
 if(!previous)return 'straight';
 const incoming=direction(previous.geometry.coordinates,true),outgoing=direction(next.geometry.coordinates,false);
 if(incoming===null||outgoing===null)return 'straight';
 const angle=((outgoing-incoming+540)%360)-180;
 if(Math.abs(angle)>=150)return 'uturn';
 if(Math.abs(angle)<30)return 'straight';
 return angle>0?'right':'left';
}
function transitionCost(previous,next) {
 return TURN_COSTS[turnType(previous?.feature,next.feature)];
}
function shortest(graph,start,limit,blocked=new Set(),target=null,costLimit=Infinity,previousEdge=null,includeTurns=true) {
 const initial={node:start,meters:0,cost:0,parent:null,edge:null,incoming:previousEdge};
 const labels=new Map([[start,[initial]]]),queue=new Queue();queue.push([0,initial]);
 while(queue.items.length){
  const [,current]=queue.pop();
  if(!labels.get(current.node)?.includes(current))continue;
  if(current.cost>=costLimit)break;
  if(current.node===target)return {labels,target:current};
  for(const edge of graph.get(current.node)||[]){
   if(blocked.has(edge.to))continue;
   const next={node:edge.to,meters:current.meters+edge.meters,cost:current.cost+edge.cost+(includeTurns?transitionCost(current.incoming,edge):0),parent:current,edge,incoming:edge};
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
 const edges=[];while(label?.edge){edges.push(label.edge);label=label.parent;}return edges.reverse();
}
export const CONNECTED_COURSE_COLOR = '#dc2626';
function connectInBand(features,center,range,mode='loop') {
 const min=range.min*1000,max=range.max*1000,target=(min+max)/2;
 if(!Number.isFinite(min)||min<=0||max<min||!center?.every(Number.isFinite))throw new Error('거리와 지도 위치를 확인해주세요.');
 const graph=new Map(),reverse=new Map(),positions=new Map(),seen=new Set();
 for(const feature of features){
  const p=feature.properties,g=feature.geometry;
  // Disconnected multipart geometry cannot prove a continuous driving segment.
  if(!p.fNode||!p.tNode||seen.has(p.linkId)||g.type!=='LineString'||g.coordinates.length<2)continue;
  const meters=geometryMeters(g);if(meters<=0||meters>max)continue;seen.add(p.linkId);
  const dataCosts=roadDataCost(p,meters),laneCost=meters*laneCostMultiplier(p.lanes);
  const edge={from:p.fNode,to:p.tNode,meters,laneCost,dataCosts,cost:laneCost+dataCosts.trafficCost+dataCosts.accidentCost,feature};
  if(!graph.has(edge.from))graph.set(edge.from,[]);graph.get(edge.from).push(edge);
  if(!reverse.has(edge.to))reverse.set(edge.to,[]);reverse.get(edge.to).push({...edge,to:edge.from});
  positions.set(edge.from,g.coordinates[0]);positions.set(edge.to,g.coordinates.at(-1));
 }
 const starts=[...graph.keys()].map(node=>({node,distance:metersBetween(center,positions.get(node))})).sort((a,b)=>a.distance-b.distance).slice(0,8);
 let best=null;
 const accept=(edges,startDistance)=>{
  if(!edges.length)return false;
  if(mode==='oneway'&&edges[0].from===edges.at(-1).to)return false;
  if(edges.some((edge,i)=>i&&metersBetween(edges[i-1].feature.geometry.coordinates.at(-1),edge.feature.geometry.coordinates[0])>60))return false;
  if(mode==='loop'&&metersBetween(edges.at(-1).feature.geometry.coordinates.at(-1),edges[0].feature.geometry.coordinates[0])>60)return false;
  const lengthMeters=edges.reduce((sum,edge)=>sum+edge.meters,0);
  if(lengthMeters<min||lengthMeters>max)return false;
  if(new Set(edges.map(edge=>edge.feature.properties.linkId)).size!==edges.length)return false;
  const costBreakdown=edges.reduce((sum,edge,i)=>({lane:sum.lane+edge.laneCost,traffic:sum.traffic+edge.dataCosts.trafficCost,accidents:sum.accidents+edge.dataCosts.accidentCost,turns:sum.turns+(i?transitionCost(edges[i-1],edge):0)}),{lane:0,traffic:0,accidents:0,turns:0});
  const cost=costBreakdown.lane+costBreakdown.traffic+costBreakdown.accidents+costBreakdown.turns;
  if(best&&(cost>best.cost||cost===best.cost&&startDistance>=best.startDistance))return false;
  const dataCoverage={traffic:edges.reduce((sum,edge)=>sum+(edge.dataCosts.trafficScore===null?0:edge.meters),0)/lengthMeters,accidents:edges.reduce((sum,edge)=>sum+(edge.dataCosts.accidentScore===null?0:edge.meters),0)/lengthMeters};
  best={mode,lengthMeters,cost,costBreakdown,dataCoverage,startDistance,linkIds:edges.map(edge=>edge.feature.properties.linkId),
   start:edges[0].feature.geometry.coordinates[0],end:edges.at(-1).feature.geometry.coordinates.at(-1),
   featureCollection:{type:'FeatureCollection',features:edges.map(edge=>edge.feature)}};
  return true;
 };
 for(const {node:start,distance:startDistance} of starts){
  const outward=shortest(graph,start,max);
  const labels=[...outward.labels.values()].flat();
  if(mode==='oneway'){
   const candidates=labels.filter(label=>label.meters>=min&&label.meters<=max)
    .sort((a,b)=>a.cost-b.cost||Math.abs(a.meters-target)-Math.abs(b.meters-target)).slice(0,128);
   for(const candidate of candidates){if(best&&candidate.cost>=best.cost)break;accept(path(candidate),startDistance);}
  }else{
   // Ignore turns on the reverse graph: this is only an optimistic lower bound.
   const backward=shortest(reverse,start,max,new Set(),null,Infinity,null,false);
   const candidates=labels.filter(label=>label.node!==start&&label.meters>=min/4&&label.meters<max&&backward.labels.get(label.node)?.some(back=>label.meters+back.meters>=min&&label.meters+back.meters<=max))
    .map(label=>({label,bound:label.cost+Math.min(...backward.labels.get(label.node).map(back=>back.cost))}))
    .sort((a,b)=>a.bound-b.bound||Math.abs(a.label.meters-target/2)-Math.abs(b.label.meters-target/2)).slice(0,64);
   for(const {label,bound} of candidates){
    if(best&&bound>=best.cost)break;
    const out=path(label),blocked=new Set(out.slice(0,-1).map(edge=>edge.to));
    const back=shortest(graph,label.node,max-label.meters,blocked,start,best?best.cost-label.cost:Infinity,out.at(-1));
    if(!back.target||label.meters+back.target.meters<min)continue;
    accept([...out,...path(back.target)],startDistance);
   }
  }
 }
 if(best)return [best];
 throw new Error('현재 화면과 차로 조건에서 해당 거리의 연결 경로를 찾지 못했습니다. 차로를 추가하거나 지도 위치·거리를 바꿔주세요.');
}
export function connectCourse(features,center,range,mode='loop') {
 return connectCourses(features,center,range,mode)[0];
}
export function connectCourses(features,center,range,mode='loop') {
 if(!Number.isFinite(range.min)||!Number.isFinite(range.max)||range.min<MIN_DISTANCE||range.max>MAX_DISTANCE||range.max<range.min||range.max-range.min>MAX_DISTANCE_SPAN||!center||center.length!==2||!center.every(Number.isFinite))throw new Error('거리는 5~30km, 최소·최대 차이는 10km 이내로 설정해주세요.');
 const courses=[];
 for(const [bandIndex,band] of distanceBands(range).entries()){
  try{
   const course=connectInBand(features,center,band,mode)[0];
   // Inclusive boundaries may match the same route; never recommend it twice.
   const key=[...course.linkIds].sort().join(',');
   if(!courses.some(other=>[...other.linkIds].sort().join(',')===key))courses.push({...course,distanceBand:band,bandIndex});
  }catch(error){if(!error.message.includes('찾지 못했습니다'))throw error;}
 }
 if(courses.length)return courses;
 throw new Error('현재 화면과 차로 조건에서 해당 거리의 연결 경로를 찾지 못했습니다. 차로를 추가하거나 지도 위치·거리를 바꿔주세요.');
}
