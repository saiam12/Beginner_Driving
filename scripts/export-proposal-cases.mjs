import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {exploreCourseCandidates,geometryMeters} from '../src/lib/connected-course.js';
import {classifyCourseCandidates,courseOverlapRatio} from '../src/lib/course-overlap.js';
import {roadDataCost} from '../src/lib/road-data-cost.js';
const root=resolve('public');globalThis.fetch=async url=>{try{return new Response(await readFile(resolve(root,'.'+url)))}catch{return new Response('',{status:404})}};
const {loadLaneRoads}=await import(pathToFileURL(resolve('.local/accident-tests/accident-loaders.mjs')));
const bounds=[128.53,35.80,128.63,35.90],point=[128.58,35.85];
const {features}=await loadLaneRoads(bounds,null,{regional:true});
const courses=exploreCourseCandidates(features,point,{min:5,max:10},'loop',{bounds,startPoint:point,profile:{goals:['left']}});
const selection=classifyCourseCandidates(courses,{difficultyBased:true});
let pair;
for(const level of ['쉬움','보통','어려움']){
 const group=selection.eligibleIndices.filter(i=>selection.difficultyByIndex[i]===level);
 const a=group.slice().sort((i,j)=>courses[i].cost-courses[j].cost)[0];
 const b=selection.byDifficulty[level].find(i=>i!==a&&courses[i].practiceCounts.left>courses[a].practiceCounts.left);
 if(a!==undefined&&b!==undefined){pair=[a,b];break;}
}
if(!pair)pair=selection.eligibleIndices.slice(0,2);
if(pair.length<2)throw Error('Need two actual courses');
const selected=pair.map((i,j)=>{const c=courses[i];if(c.featureCollection.features.some(f=>roadDataCost(f.properties,geometryMeters(f.geometry)).accidentExcluded))throw Error('Excluded road in case');return {...c,label:j?'B':'A',poolIndex:i,difficulty:selection.difficultyByIndex[i],roadNames:[...new Set(c.featureCollection.features.map(f=>f.properties.roadName).filter(Boolean))],accidentLinkCount:c.featureCollection.features.filter(f=>f.properties.accidentCount!=null).length}});
const out={condition:{bounds,startPoint:point,range:{min:5,max:10},goals:['left']},candidateCount:courses.length,eligibleCount:selection.eligibleIndices.length,selection,overlap:courseOverlapRatio(...selected),cases:selected};
await writeFile('.local/proposal/actual-daegu-cases.json',JSON.stringify(out,null,2));
console.log(JSON.stringify({candidateCount:out.candidateCount,eligibleCount:out.eligibleCount,overlap:out.overlap,cases:selected.map(({featureCollection,...c})=>c)}));
