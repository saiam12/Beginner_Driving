// Test actual national data through the application's loaders and route engine.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'vite';
import {roadDataCost} from '../src/lib/road-data-cost.js';
import {exploreCourseCandidates,geometryMeters} from '../src/lib/connected-course.js';
import {courseToSavedRoute,readSavedCourses,saveCourse,SAVED_COURSES_KEY} from '../src/lib/saved-courses.js';

async function loadModule(entry,name){
 await build({configFile:false,logLevel:'silent',define:{'import.meta.env.BASE_URL':JSON.stringify('/')},build:{lib:{entry:resolve(entry),formats:['es'],fileName:()=>name+'.mjs'},outDir:'.local/level55-tests',emptyOutDir:false,copyPublicDir:false}});
 return import(pathToFileURL(resolve('.local/level55-tests/'+name+'.mjs')));
}
const root=resolve('public');
globalThis.fetch=async(url,{signal}={})=>{signal?.throwIfAborted();const path=resolve(root,'.'+url);assert(path.startsWith(root+sep));try{return new Response(await readFile(path));}catch{return new Response('',{status:404});}};
const lanes=await loadModule('src/lib/lane-roads.js','lane-roads');
const search=await loadModule('src/lib/road-search.js','road-search');
const target=JSON.parse(await readFile('public/data/roads/target-link.json','utf8'));
const b=target.feature.properties.bounds;
const result=await lanes.loadLaneRoads([b[0]-.001,b[1]-.001,b[2]+.001,b[3]+.001],[4]);
const f=result.features.find(f=>f.id==='1014051');
assert.deepEqual(f,target.feature);
assert.equal(f.properties.linkId,f.properties.lev5_5_link_id);
assert.equal(f.properties.trafficAadt,90682);
assert.equal(f.properties.trafficPerLaneReference,58071/24);
const expectedScore=(90682/4)/58071;
assert(Math.abs(roadDataCost(f.properties,1000).trafficScore-expectedScore)<1e-12);
assert(Math.abs(roadDataCost(f.properties,1000).trafficCost-2000*expectedScore)<1e-9);
assert.equal(roadDataCost({...f.properties,trafficVolume:0},1000).trafficCost,0);
assert.equal(roadDataCost({...f.properties,trafficVolume:null},1000).trafficScore,null);
assert.equal(roadDataCost({...f.properties,trafficReferencePeriod:'wrong-year'},1000).trafficScore,null);
let cursor=null,group;
do{const response=await search.searchRoads('올림픽대로',{cursor});cursor=response.cursor;group=response.items.find(item=>item.id===target.roadGroupId)||group;}while(cursor&&!group);
assert(group);
assert.deepEqual((await search.loadRoadGroup(group)).featureCollection.features.find(f=>f.id==='1014051'),f);
assert(search.linkTooltip(f.properties).includes('Level 5.5 LINK ID: 1014051'));

const roads=await lanes.loadLaneRoads([126.89,37.53,126.97,37.60],null,{regional:true});
const pool=exploreCourseCandidates(roads.features,[126.93,37.565],{min:5,max:10},'loop',{bounds:[126.89,37.53,126.97,37.60]});
assert(pool.length>1);
for(const c of pool){
 assert(c.featureCollection.features.every(f=>f.properties.identifierSystem==='level5.5'));
 const traffic=c.featureCollection.features.reduce((sum,f)=>sum+roadDataCost(f.properties,geometryMeters(f.geometry)).trafficCost,0);
 assert(Math.abs(traffic-c.costBreakdown.traffic)<1e-8);
 assert(c.costBreakdown.traffic>0);
 assert.equal(c.dataCoverage.traffic,1);
 assert(Math.abs(c.cost-Object.values(c.costBreakdown).reduce((sum,n)=>sum+n,0))<1e-8);
}
const legacy='beginner-driving.saved-courses.v1';
const storageData=new Map([[legacy,'original-browser-records']]);
const storage={getItem:key=>storageData.get(key)??null,setItem:(key,value)=>storageData.set(key,value)};
assert.deepEqual(readSavedCourses(storage),[]);
const saved=courseToSavedRoute(pool[0]);saveCourse(storage,saved);
assert.equal(SAVED_COURSES_KEY,'beginner-driving.saved-courses.level55.v2');
assert.equal(storageData.get(legacy),'original-browser-records');
assert.deepEqual(readSavedCourses(storage)[0].costBreakdown,saved.costBreakdown);
assert.deepEqual(readSavedCourses(storage)[0].linkIds,saved.linkIds);
assert.throws(()=>courseToSavedRoute({...pool[0],identifierSystem:'legacy'}));
const presets=JSON.parse(await readFile('src/data/seoul-courses.json','utf8'));
assert(presets.every(c=>c.identifierSystem==='level5.5'&&c.costBreakdown.traffic>0));
console.log(`PASS: Level 5.5 actual geometry/search, matching units, positive cost, ${pool.length} real course candidates with exact traffic breakdown, presets and saved namespace preservation`);
