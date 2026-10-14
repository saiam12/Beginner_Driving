import {readRoadJSON} from './road-search';
let pending;
export function accidentCircleDiameter(count=1) {
 return (20*2/3)*Math.sqrt(Math.max(1,count));
}
export function pointFeatures(data) {
 if(data.identifierSystem!=='its'||data.year!==2024)throw new Error('사고 자료의 출처와 연도를 확인해주세요.');
 const features=Object.entries(data.links).map(([roadId,link])=>{
  if(link.points?.length!==link.count)throw new Error('사고 위치와 집계 건수가 일치하지 않습니다.');
  if(!link.count)throw new Error('병합할 사고 건수가 없습니다.');
  const coordinates=link.points.reduce((sum,point)=>[sum[0]+point.coordinates[0],sum[1]+point.coordinates[1]],[0,0]).map(value=>value/link.count);
  return {geometry:{type:'Point',coordinates},properties:{linkId:roadId,roadId,count:link.count,points:link.points}};
 });
 if(features.reduce((sum,feature)=>sum+feature.properties.count,0)!==data.mappedAccidents)throw new Error('사고 위치 자료가 누락되었습니다.');
 const coordinates=features.flatMap(f=>f.properties.points.map(point=>point.coordinates));
 return {features,bounds:[Math.min(...coordinates.map(p=>p[0])),Math.min(...coordinates.map(p=>p[1])),Math.max(...coordinates.map(p=>p[0])),Math.max(...coordinates.map(p=>p[1]))]};
}
export function pointsInBounds(features,bounds) {
 if(!bounds)return [];
 return features.filter(({geometry:{coordinates:[lng,lat]}})=>lng>=bounds[0]&&lng<=bounds[2]&&lat>=bounds[1]&&lat<=bounds[3]);
}
export function loadAccidentPoints() {
 if(!pending)pending=readRoadJSON('accidents-2024-daegu-its.json').then(pointFeatures).catch(error=>{pending=null;throw error;});
 return pending;
}
