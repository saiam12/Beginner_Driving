import {geometryMeters} from './connected-course.js';

export const COURSE_OVERLAP_THRESHOLD=0.90;
export const ADOPTED_COURSE_OVERLAP_THRESHOLD=0.40;

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
export function classifyCourseCandidates(courses) {
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
 // Measure once in the worker; adoption is stricter than development-list suppression.
 const adoptedIndices=[];
 for(const index of eligibleIndices){
  if(adoptedIndices.every(other=>overlap(measured[index],measured[other])+1e-12<ADOPTED_COURSE_OVERLAP_THRESHOLD))adoptedIndices.push(index);
  if(adoptedIndices.length===5)break;
 }
 return {eligibleIndices,similarTo,adoptedIndices};
}
