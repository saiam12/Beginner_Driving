import {geometryMeters} from './connected-course.js';
const coverageCache=new WeakMap();
// ITS observations come from a separate spatial assignment, never an ID crosswalk.
export function applyItsRoadAccidents(features,data) {
 if(data.identifierSystem!=='its'||data.year!==2024||data.roadSourceDate!=='2026-09-14')throw new Error('ITS 사고 자료의 출처와 기간을 확인해주세요.');
 if(!coverageCache.has(data))coverageCache.set(data,new Set(data.coveredLinkIds));
 const coverage=coverageCache.get(data);
 return features.map(feature=>{
  const p=feature.properties;
  if(p.identifierSystem!=='its'||p.sourceDate!==data.roadSourceDate)return feature;
  const observation=data.links[p.linkId],covered=coverage.has(p.linkId);
  return {...feature,properties:{...p,accidentCount:observation?.count??(covered?0:null),
   accidentLengthMeters:observation?.lengthMeters??geometryMeters(feature.geometry),
   accidentPeriod:data.period,accidentSource:data.source,accidentMatchMethod:data.method,
   accidentDirectionConfirmed:false,accidentTemporalMismatch:true,accidentPoints:observation?.points??[]}};
 });
}
// Missing observations are treated as zero by the user's routing policy.
export function applyRoadAccidents(features,data) {
 if(data.identifierSystem!=='level5.5'||data.year!==2024)throw new Error('사고 데이터의 도로 ID와 연도를 확인해주세요.');
 return features.map(feature=>{
  const p=feature.properties,observation=data.links[p.lev5_5_link_id];
  if(p.identifierSystem!=='level5.5'||p.linkId!==p.lev5_5_link_id)return feature;
  return {...feature,properties:{...p,accidentCount:observation?.count??0,accidentLengthMeters:observation?.lengthMeters??geometryMeters(feature.geometry),accidentZeroAssumed:!observation,
   accidentPeriod:data.period,accidentReferencePeriod:data.period,accidentsPerKmReference:data.accidentsPerKmReference,
   accidentSource:data.source,accidentMatchMethod:data.method}};
 });
}
