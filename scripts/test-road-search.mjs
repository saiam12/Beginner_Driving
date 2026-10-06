// Exercise the real search module against the generated static files, including
// compression, pagination, LINK selection, aborts, and failed geometry requests.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'vite';

await build({configFile:false,logLevel:'silent',define:{'import.meta.env.BASE_URL':JSON.stringify('/')},
 build:{lib:{entry:resolve('src/lib/road-search.js'),formats:['es'],fileName:()=> 'road-search.mjs'},
 outDir:'.local/roads/test-service',emptyOutDir:false,copyPublicDir:false}});
const api=await import(pathToFileURL(resolve('.local/roads/test-service/road-search.mjs')));
const root=resolve('public');
globalThis.fetch=async(url,{signal}={})=>{
 signal?.throwIfAborted();
 const file=resolve(root,'.'+url);
 assert(file.startsWith(root+sep),'Requests stay inside static data');
 try{return new Response(await readFile(file));}catch{return new Response('',{status:404});}
};

const manifest=JSON.parse(await readFile('public/data/roads/manifest.json','utf8'));
const wanted=manifest.roads.filter(r=>r.roadName.includes('공원로')).reduce((sum,r)=>sum+r.groupCount,0);
let cursor=null,all=[],total;
do{
 const response=await api.searchRoads('공원로',{cursor});
 all.push(...response.items);cursor=response.cursor;total=response.total;
}while(cursor);
assert.equal(all.length,total,'All results accessible through pagination');
assert.equal(all.filter(r=>r.kind==='road').length,wanted);
assert.equal(new Set(all.map(r=>`${r.kind}:${r.id}`)).size,all.length,'Pagination has no duplicate groups');
assert.equal(all[0].roadName,'공원로','Exact matches precede partial names');
const target=JSON.parse(await readFile('public/data/roads/target-link.json','utf8'));
const chosen=all.find(r=>r.id===target.roadGroupId);
assert(chosen);
const road=await api.loadRoadGroup(chosen);
assert.equal(road.linkIds.length,chosen.linkCount);
assert(road.linkIds.includes('1160059701'));
assert.deepEqual(road.featureCollection.features.find(f=>f.id==='1160059701'),target.feature);
assert(road.featureCollection.features.every(f=>f.properties.trafficVolume===null));
const area=await api.searchRoads('구로구');
assert(area.items.some(r=>r.kind==='area'&&r.name==='서울특별시 구로구'));
const partial=await api.searchRoads('공원');
assert(partial.items.some(r=>r.kind==='road'&&r.roadName.includes('공원')));
assert(partial.total>=wanted);
assert.deepEqual(await api.searchRoads('   '),{items:[],cursor:null,total:0});
assert.equal((await api.searchRoads('없는도로명검증abcdef')).total,0);
const controller=new AbortController();controller.abort();
await assert.rejects(()=>api.searchRoads('공원로',{signal:controller.signal}),{name:'AbortError'});
await assert.rejects(()=>api.loadRoadGroup(chosen,{signal:controller.signal}),{name:'AbortError'});
await assert.rejects(()=>api.loadRoadGroup({...chosen,geometryShard:'missing'}),/다시 검색/);
assert.equal(api.formatRegionName('경기도 성남시수정구'),'경기도 성남시 수정구');
console.log(`PASS: real compressed search, ${all.length} paginated results, target LINK geometry, area/partial search, cancellation, failed request`);
