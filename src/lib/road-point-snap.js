// Project onto road geometry, preserving LINK IDs and directed travel order.
export function nearestRoadPoint(features,point) {
 let best=null;
 const scale=Math.cos(point[1]*Math.PI/180);
 for(const feature of features){
  if(feature.geometry.type!=='LineString'||!feature.properties.fNode||!feature.properties.tNode)continue;
  const coords=feature.geometry.coordinates;
  for(let i=0;i<coords.length-1;i++){
   const a=coords[i],b=coords[i+1],dx=(b[0]-a[0])*scale,dy=b[1]-a[1];
   const t=Math.max(0,Math.min(1,((point[0]-a[0])*scale*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
   const projected=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
   const distance=Math.hypot((projected[0]-point[0])*scale,projected[1]-point[1]);
   if(!best||distance<best.distance)best={feature,point:projected,position:i+t,distance};
  }
 }
 return best;
}

export function splitAtManualPoints(features,startPoint,endPoint) {
 const start=startPoint?nearestRoadPoint(features,startPoint):null,end=endPoint?nearestRoadPoint(features,endPoint):null;
 const splits=new Map();
 for(const [label,snap] of [['start',start],['end',end]]){
  if(!snap)continue;
  const coords=snap.feature.geometry.coordinates;
  snap.node=snap.position<1e-8?snap.feature.properties.fNode:snap.position>coords.length-1-1e-8?snap.feature.properties.tNode:`manual-${label}`;
  if(snap.position>=1e-8&&snap.position<=coords.length-1-1e-8){
   if(!splits.has(snap.feature))splits.set(snap.feature,[]);
   splits.get(snap.feature).push(snap);
  }
 }
 const result=[];
 for(const feature of features){
  const cuts=splits.get(feature);
  if(!cuts){result.push(feature);continue;}
  const coords=feature.geometry.coordinates;
  const points=[{position:0,point:coords[0],node:feature.properties.fNode},...cuts.sort((a,b)=>a.position-b.position),{position:coords.length-1,point:coords.at(-1),node:feature.properties.tNode}];
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i];
   if(b.position-a.position<1e-8){b.node=a.node;continue;}
   const middle=coords.filter((_,j)=>j>a.position&&j<b.position);
   result.push({...feature,properties:{...feature.properties,fNode:a.node,tNode:b.node,routingKey:`${feature.properties.linkId}:${i}`},geometry:{type:'LineString',coordinates:[a.point,...middle,b.point]}});
  }
 }
 return {features:result,start,end};
}
