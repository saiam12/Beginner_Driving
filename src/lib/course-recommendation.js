import {geometryMeters,turnType} from './connected-course.js';
import {roadDataCost} from './road-data-cost.js';
import {validateProfile} from './driver-preferences.js';
import {MIN_DISTANCE,MAX_DISTANCE,MAX_DISTANCE_SPAN} from './distance-range.js';

export const EVIDENCE_KEYS = ['distance','preferredLanes','narrowRoads','leftTurns','uTurns','rightPractice','turnSimplicity','traffic','accidents'];
export function summarizeCourse(course,index,preferredLanes=[]) {
 const features=course.featureCollection.features,turns={straight:0,right:0,left:0,uturn:0};
 let total=0,preferred=0,narrow=0,trafficMeters=0,accidentMeters=0,trafficSum=0,accidentSum=0;
 const trafficPeriods=new Set(),accidentPeriods=new Set();
 features.forEach((feature,i)=>{
  const p=feature.properties,meters=geometryMeters(feature.geometry),data=roadDataCost(p,meters);
  total+=meters;
  if(preferredLanes.includes(Math.min(p.lanes,7)))preferred+=meters;
  if(Number.isInteger(p.lanes)&&p.lanes===1)narrow+=meters;
  if(i)turns[turnType(features[i-1],feature)]++;
  if(data.trafficScore!==null){trafficMeters+=meters;trafficSum+=meters*data.trafficScore;trafficPeriods.add(p.trafficPeriod);}
  if(data.accidentScore!==null){accidentMeters+=meters;accidentSum+=meters*data.accidentScore;accidentPeriods.add(p.accidentPeriod);}
 });
 return {id:`candidate_${index+1}`,distanceKm:total/1000,mode:course.mode,cost:course.cost,
  preferredLaneRatio:preferredLanes.length?preferred/total:null,narrowRoadRatio:narrow/total,turns,
  traffic:{coverage:trafficMeters/total,score:trafficMeters&&trafficPeriods.size===1?trafficSum/trafficMeters:null,period:trafficPeriods.size===1?[...trafficPeriods][0]:null},
  accidents:{coverage:accidentMeters/total,score:accidentMeters&&accidentPeriods.size===1?accidentSum/accidentMeters:null,period:accidentPeriods.size===1?[...accidentPeriods][0]:null}};
}
const finite=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
function metric(input) {
 if(!input||!finite(input.coverage,0,1)||!(input.score===null||finite(input.score,0,1))||!(input.period===null||typeof input.period==='string'&&input.period.length>0&&input.period.length<=120))throw new Error('관측 정보가 올바르지 않습니다.');
 if(input.coverage===0&&(input.score!==null||input.period!==null))throw new Error('미관측 자료에 점수를 넣을 수 없습니다.');
 if(input.score!==null&&input.period===null)throw new Error('관측 기간을 확인해주세요.');
 return {coverage:input.coverage,score:input.score,period:input.period};
}
// Whitelist the payload: no geometry, precise location, road names or arbitrary prompts.
export function validateRecommendationInput(body) {
 if(!body||!finite(body.range?.min,MIN_DISTANCE,MAX_DISTANCE)||!finite(body.range?.max,body.range.min,MAX_DISTANCE)||body.range.max-body.range.min>MAX_DISTANCE_SPAN)throw new Error('주행 거리 조건을 확인해주세요.');
 const profile=validateProfile(body.profile),selected=body.preferredLanes;
 if(!Array.isArray(selected)||selected.length>7||new Set(selected).size!==selected.length||selected.some(lane=>!Number.isInteger(lane)||lane<1||lane>7))throw new Error('선호 차로를 확인해주세요.');
 if(!Array.isArray(body.candidates)||!body.candidates.length||body.candidates.length>5)throw new Error('먼저 코스 후보를 생성해주세요.');
 const candidates=body.candidates.map(c=>{
  if(!c||!/^candidate_[1-5]$/.test(c.id)||!finite(c.distanceKm,body.range.min-0.000001,body.range.max+0.000001)||!['loop','oneway'].includes(c.mode)||!finite(c.cost,0,1e8)||!finite(c.narrowRoadRatio,0,1)||!(c.preferredLaneRatio===null||finite(c.preferredLaneRatio,0,1))||selected.length===0&&c.preferredLaneRatio!==null||selected.length>0&&c.preferredLaneRatio===null)throw new Error('후보 정보가 올바르지 않습니다.');
  const turns={};for(const key of ['straight','right','left','uturn']){if(!Number.isInteger(c.turns?.[key])||!finite(c.turns[key],0,12000))throw new Error('회전 정보를 확인해주세요.');turns[key]=c.turns[key];}
  return {id:c.id,distanceKm:c.distanceKm,mode:c.mode,cost:c.cost,preferredLaneRatio:c.preferredLaneRatio,narrowRoadRatio:c.narrowRoadRatio,turns,traffic:metric(c.traffic),accidents:metric(c.accidents)};
 });
 if(new Set(candidates.map(c=>c.id)).size!==candidates.length||new Set(candidates.map(c=>c.mode)).size!==1)throw new Error('후보 식별 정보를 확인해주세요.');
 return {profile,range:{min:body.range.min,max:body.range.max},preferredLanes:[...selected],candidates};
}
export function comparableMetric(candidates,key) {
 return candidates.every(c=>c[key].coverage===1&&c[key].score!==null&&c[key].period!==null)&&new Set(candidates.map(c=>c[key].period)).size===1;
}
export function allowedEvidence(input) {
 return EVIDENCE_KEYS.filter(key=>key==='traffic'||key==='accidents'?comparableMetric(input.candidates,key):key==='preferredLanes'?input.preferredLanes.length>0:true);
}
export function recommendationSchema(input) {
 return {type:'object',properties:{ranking:{type:'array',minItems:input.candidates.length,maxItems:input.candidates.length,items:{type:'object',properties:{candidateId:{type:'string',enum:input.candidates.map(c=>c.id)},evidenceKeys:{type:'array',minItems:1,maxItems:3,items:{type:'string',enum:allowedEvidence(input)}}},required:['candidateId','evidenceKeys'],additionalProperties:false}}},required:['ranking'],additionalProperties:false};
}
export function evidenceText(candidate,key) {
 const t=candidate.turns;
 return {distance:`실제 거리 ${candidate.distanceKm.toFixed(2)}km`,preferredLanes:`선호 차로 비율 ${Math.round(candidate.preferredLaneRatio*100)}%`,narrowRoads:`1차로 구간 비율 ${Math.round(candidate.narrowRoadRatio*100)}%`,leftTurns:`좌회전 ${t.left}회`,uTurns:`유턴 ${t.uturn}회`,rightPractice:`우회전 ${t.right}회`,turnSimplicity:`회전 ${t.left+t.right+t.uturn}회 · km당 ${((t.left+t.right+t.uturn)/candidate.distanceKm).toFixed(1)}회`,traffic:`교통량 비교 지표 ${candidate.traffic.score?.toFixed(2)} · 전체 구간 관측`,accidents:`사고 비교 지표 ${candidate.accidents.score?.toFixed(2)} · 전체 구간 관측`}[key];
}
export function validateRecommendationOutput(output,input) {
 const allowed=allowedEvidence(input);
 if(!Array.isArray(output?.ranking)||output.ranking.length!==input.candidates.length)throw new Error('AI 응답 형식을 확인할 수 없습니다.');
 const ranking=output.ranking.map(item=>{
  const candidate=input.candidates.find(c=>c.id===item?.candidateId);
  if(!candidate||!Array.isArray(item.evidenceKeys)||!item.evidenceKeys.length||item.evidenceKeys.length>3||new Set(item.evidenceKeys).size!==item.evidenceKeys.length||item.evidenceKeys.some(key=>!allowed.includes(key)))throw new Error('AI 추천 근거를 확인할 수 없습니다.');
  return {candidateId:candidate.id,evidenceKeys:item.evidenceKeys,reasons:item.evidenceKeys.map(key=>evidenceText(candidate,key))};
 });
 if(new Set(ranking.map(item=>item.candidateId)).size!==ranking.length)throw new Error('AI가 후보를 중복 추천했습니다.');
 return {source:'gemini',recommendedCandidateId:ranking[0].candidateId,ranking,missingData:['traffic','accidents'].filter(key=>!comparableMetric(input.candidates,key))};
}
export async function requestCourseRecommendation(input,{signal}={}) {
 const payload=validateRecommendationInput(input);
 const response=await fetch('/api/recommend-courses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
 let result;try{result=await response.json();}catch{throw new Error('AI 추천 서버에 연결하지 못했습니다. 후보를 유지합니다.');}
 if(!response.ok)throw new Error(result.error||'AI 추천에 실패했습니다. 다시 시도해주세요.');
 return validateRecommendationOutput(result,payload);
}
