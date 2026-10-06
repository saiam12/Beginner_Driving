import {geometryMeters} from './connected-course.js';

export const COURSE_OVERLAP_THRESHOLD=0.90;
export const ADOPTED_COURSE_OVERLAP_THRESHOLD=0.50;

function measuredLinks(course) {
 const links=new Map();
 for(const feature of course.featureCollection.features){
  const id=feature.properties.linkId,length=geometryMeters(feature.geometry);
  if(length>0)links.set(id,length);
 }
 return {links,length:[...links.values()].reduce((sum,value)=>sum+value,0)};
}
function overlap(a,b) {
 const denominator=Math.max(a.length,b.length);
 if(!denominator)return 0;
 let shared=0;
 for(const [id,length] of a.links)if(b.links.has(id))shared+=Math.min(length,b.links.get(id));
 return Math.min(1,shared/denominator);
}
export function courseOverlapRatio(a,b) {
 return overlap(measuredLinks(a),measuredLinks(b));
}
// Greedy suppression against retained representatives, in ascending total cost.
// Keep original pool indices so development labels and selection remain stable.
export function classifyCourseCandidates(courses,{difficultyBased=false}={}) {
 const measured=courses.map(measuredLinks),eligibleIndices=[],similarTo={};
 const ordered=courses.map((_,i)=>i).sort((a,b)=>courses[a].cost-courses[b].cost||a-b);
 for(const index of ordered){
  let duplicate=null;
  for(const withIndex of eligibleIndices){
   const ratio=overlap(measured[index],measured[withIndex]);
   if(ratio+1e-12>=COURSE_OVERLAP_THRESHOLD){duplicate={withIndex,ratio};break;}
  }
  if(duplicate)similarTo[index]=duplicate;
  else eligibleIndices.push(index);
 }
 if(difficultyBased)return {...difficultySelection(courses,eligibleIndices,measured),eligibleIndices,similarTo};
 // Measure once in the worker; adoption is stricter than development-list suppression.
 const adoptedIndices=[];
 for(const index of eligibleIndices){
  if(adoptedIndices.every(other=>overlap(measured[index],measured[other])+1e-12<ADOPTED_COURSE_OVERLAP_THRESHOLD))adoptedIndices.push(index);
  if(adoptedIndices.length===5)break;
 }
 return {eligibleIndices,similarTo,adoptedIndices};
}

export const COURSE_DIFFICULTIES=['쉬움','보통','어려움'];
function difficultySelection(courses,eligible,measured) {
 const byDifficulty=Object.fromEntries(COURSE_DIFFICULTIES.map(level=>[level,[]]));
 const difficultyByIndex={},queues=Object.fromEntries(COURSE_DIFFICULTIES.map(level=>[level,[]]));
 const fallbackIndices={all:[],byDifficulty:Object.fromEntries(COURSE_DIFFICULTIES.map(level=>[level,[]]))};
 if(!eligible.length)return {byDifficulty,difficultyByIndex,adoptedIndices:[],costRange:null,fallbackIndices};
 const min=courses[eligible[0]].cost,max=courses[eligible.at(-1)].cost,span=max-min,middle=(min+max)/2;
 const costRange={min,max,middle,easyUpper:min+span/3,hardLower:min+span*2/3};
 for(const index of eligible){
  const cost=courses[index].cost;
  const level=span===0||cost<costRange.easyUpper?'쉬움':cost>=costRange.hardLower?'어려움':'보통';
  difficultyByIndex[index]=level;queues[level].push(index);
 }
 const priority=(a,b)=>(courses[b].goalMatch?.count||0)-(courses[a].goalMatch?.count||0);
 const targets={'쉬움':min,'보통':middle,'어려움':max};
 const compatible=(index,chosen)=>chosen.every(other=>overlap(measured[index],measured[other])+1e-12<ADOPTED_COURSE_OVERLAP_THRESHOLD);
 for(const level of COURSE_DIFFICULTIES){
  queues[level].sort((a,b)=>priority(a,b)||Math.abs(courses[a].cost-targets[level])-Math.abs(courses[b].cost-targets[level])||a-b);
  for(const index of queues[level]){
   if(compatible(index,byDifficulty[level]))byDifficulty[level].push(index);
   if(byDifficulty[level].length===4)break;
  }
 }
 const highestFirst=[...eligible].sort((a,b)=>priority(a,b)||courses[b].cost-courses[a].cost||a-b);
 for(const level of COURSE_DIFFICULTIES){
  const selected=byDifficulty[level];
  for(const index of highestFirst){
   if(selected.length===4)break;
   if(selected.includes(index)||!compatible(index,selected))continue;
   selected.push(index);fallbackIndices.byDifficulty[level].push(index);
  }
 }
 // Round-robin keeps each difficulty represented; test diversity across all six courses.
 const adoptedIndices=[];
 for(let round=0;round<2;round++)for(const level of COURSE_DIFFICULTIES){
  const index=queues[level].find(index=>!adoptedIndices.includes(index)&&compatible(index,adoptedIndices));
  if(index!==undefined)adoptedIndices.push(index);
 }
 for(const index of highestFirst){
  if(adoptedIndices.length===6)break;
  if(!adoptedIndices.includes(index)&&compatible(index,adoptedIndices)){
   adoptedIndices.push(index);fallbackIndices.all.push(index);
  }
 }
 adoptedIndices.sort((a,b)=>COURSE_DIFFICULTIES.indexOf(difficultyByIndex[a])-COURSE_DIFFICULTIES.indexOf(difficultyByIndex[b])||priority(a,b)||a-b);
 return {byDifficulty,difficultyByIndex,adoptedIndices,costRange,fallbackIndices};
}
