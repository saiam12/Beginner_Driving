import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'vite';
await build({configFile:false,logLevel:'silent',define:{'import.meta.env.BASE_URL':JSON.stringify('/')},build:{lib:{entry:resolve('src/lib/lane-roads.js'),formats:['es'],fileName:()=> 'lane-roads.mjs'},outDir:'.local/roads/test-its-display',emptyOutDir:false,copyPublicDir:false}});
const api=await import(pathToFileURL(resolve('.local/roads/test-its-display/lane-roads.mjs')));
assert.equal(typeof api.loadDisplayLaneRoads,'function','ITS lane display needs an independent loader');
const root=resolve('public');let requested=[];
globalThis.fetch=async(url,{signal}={})=>{signal?.throwIfAborted();requested.push(url);const file=resolve(root,'.'+url);assert(file.startsWith(root+sep));try{return new Response(await readFile(file));}catch{return new Response('',{status:404});}};
const bounds=[126.93,37.55,126.96,37.57];
const display=await api.loadDisplayLaneRoads(bounds,[1,2]);
assert(!display.tooWide&&display.features.length>0);
assert(display.features.every(f=>[1,2].includes(f.properties.lanes)&&f.properties.identifierSystem==='its'&&f.properties.sourceDate==='2026-09-14'));
assert.equal(new Set(display.features.map(f=>f.properties.linkId)).size,display.features.length);
assert(display.features.every(f=>f.properties.accidentCount==null&&f.properties.trafficVolume==null),'Do not join Level 5.5 observations onto ITS IDs');
assert(requested.some(path=>path.endsWith('accidents-2024-daegu-its.json')));
assert(!requested.some(path=>path.endsWith('accidents-2024-daegu.json')),'ITS must never load Level 5.5 accident observations');
assert(api.laneTooltip(display.features[0].properties).includes('ITS LINK ID:'));
assert(!api.laneTooltip(display.features[0].properties).includes('Level 5.5 LINK ID:'));
assert(api.laneTooltip(display.features[0].properties).includes('2026-09-14'));
const routing=await api.loadLaneRoads(bounds);
assert(routing.features.length>0&&routing.features.every(f=>f.properties.identifierSystem==='level5.5'));
assert(display.features.length>routing.features.length,'Detailed ITS display must cover more source segments in this sample');
const controller=new AbortController();controller.abort();await assert.rejects(()=>api.loadDisplayLaneRoads(bounds,[1],{signal:controller.signal}),{name:'AbortError'});
assert.deepEqual((await api.loadDisplayLaneRoads(bounds,[])).features,[]);
assert.deepEqual((await api.loadDisplayLaneRoads([124,32.5,130.5,39],[1])).features,[]);
console.log(`PASS: ITS ${display.features.length} selected segments / View-T ${routing.features.length} routing segments; source isolation, selection, deduplication, tooltip, cancellation and bounds`);

const observations=JSON.parse(await readFile('public/data/roads/accidents-2024-daegu-its.json','utf8'));
assert.equal(observations.sourceAccidents,10222);
assert.equal(Object.values(observations.links).reduce((sum,value)=>sum+value.count,0),8310);
assert.equal(observations.mappedAccidents+observations.excludedAccidents,10222);
const daegu=await api.loadDisplayLaneRoads([128.59,35.84,128.62,35.86],[1,2,3,4,5,6,7]);
assert(!daegu.tooWide&&daegu.features.length>0);
assert(daegu.features.some(f=>f.properties.accidentCount>0));
assert(daegu.features.some(f=>f.properties.accidentCount===0));
for(const feature of daegu.features){
 const p=feature.properties,observation=observations.links[p.linkId];
 if(observation)assert.equal(p.accidentCount,observation.count);
 assert(api.laneTooltip(p).includes('2024년 사고'));
}
console.log(`PASS: ${daegu.features.length} Daegu ITS segments with 2024 accident counts; all 10,222 records accounted for, outside coverage remains unknown`);

assert.equal(observations.pointCoordinates,'EPSG:4326-original-accident-location');
let points=0;
for(const link of Object.values(observations.links)){
 assert.equal(link.points.length,link.count);
 for(const point of link.points){
  assert.deepEqual(Object.keys(point).sort(),['coordinates','month','severity','time','type']);
  assert(point.coordinates.every(Number.isFinite));
  assert(point.coordinates[0]>127&&point.coordinates[0]<130&&point.coordinates[1]>34&&point.coordinates[1]<38);
 }
 points+=link.points.length;
}
assert.equal(points,8310);
for(const f of daegu.features)assert.equal(f.properties.accidentPoints.length,f.properties.accidentCount??0);
assert(display.features.every(f=>f.properties.accidentPoints.length===0));
console.log('PASS: 8,310 original accident points; per-road count equality, coordinate bounds, minimal fields and no points outside coverage');
