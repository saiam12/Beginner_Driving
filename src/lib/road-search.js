import {regions} from '../data';
let manifest;
const searchCache=new Map(),geometryCache=new Map();
const normalize=value=>value.trim().replace(/\s/g,'').toLocaleLowerCase('ko');
function remember(cache,key,value,limit){cache.delete(key);cache.set(key,value);if(cache.size>limit)cache.delete(cache.keys().next().value);return value;}
async function readJSON(path,signal,lines=false){
 const response=await fetch(`${import.meta.env.BASE_URL}data/roads/${path}`,{signal});
 if(!response.ok)throw new Error('도로 데이터를 불러오지 못했습니다. 다시 검색해주세요.');
 let bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes[0]===31&&bytes[1]===139){
  if(typeof DecompressionStream==='undefined')throw new Error('도로 검색을 위해 최신 브라우저로 업데이트해주세요.');
  bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 }
 signal?.throwIfAborted();
 const text=new TextDecoder().decode(bytes);
 try{return lines?text.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)):JSON.parse(text);}
 catch{throw new Error('도로 데이터 형식을 확인할 수 없습니다. 다시 검색해주세요.');}
}
async function getManifest(signal){if(!manifest)manifest=await readJSON('manifest.json.gz',signal);return manifest;}
export {readJSON as readRoadJSON};
export function matchRoadNames(roads,query){
 const q=normalize(query);if(!q)return [];
 return roads.filter(r=>normalize(r.roadName).includes(q)).sort((a,b)=>{
  const an=normalize(a.roadName),bn=normalize(b.roadName);
  return Number(bn===q)-Number(an===q)||Number(bn.startsWith(q))-Number(an.startsWith(q))||an.length-bn.length||an.localeCompare(bn,'ko');
 });
}
export async function searchRoads(query,{signal,cursor=null}={}){
 const q=normalize(query);if(!q)return {items:[],cursor:null,total:0};
 const index=await getManifest(signal),names=matchRoadNames(index.roads,query);
 const start=cursor?.nameOffset??0,offset=cursor?.resultOffset??0,batch=names.slice(start,start+8);
 const shards=[...new Set(batch.map(n=>n.searchShard))];
 const loaded=await Promise.all(shards.map(async shard=>searchCache.get(shard)??remember(searchCache,shard,await readJSON(`search/${shard}.json.gz`,signal),16)));
 signal?.throwIfAborted();
 const order=new Map(batch.map((name,i)=>[name.roadName,i]));
 const groups=loaded.flat().filter(r=>order.has(r.roadName)).sort((a,b)=>order.get(a.roadName)-order.get(b.roadName)||a.regions.join().localeCompare(b.regions.join(),'ko')||a.roadGroupId.localeCompare(b.roadGroupId));
 const legacy=regions.filter(r=>[r.name,...r.aliases].some(name=>normalize(name).includes(q))).map(r=>({kind:'region',id:r.id,name:r.name,region:r}));
 const areas=(index.areas??[]).filter(r=>normalize(r.name).includes(q)).map(r=>({...r,name:formatRegionName(r.name),kind:'area',id:r.name}));
 const all=start===0?[...legacy,...areas,...groups.map(r=>({...r,kind:'road',id:r.roadGroupId}))]:groups.map(r=>({...r,kind:'road',id:r.roadGroupId}));
 const nextOffset=offset+20;
 const next=nextOffset<all.length?{nameOffset:start,resultOffset:nextOffset}:start+8<names.length?{nameOffset:start+8,resultOffset:0}:null;
 return {items:all.slice(offset,nextOffset),cursor:next,total:legacy.length+areas.length+names.reduce((sum,n)=>sum+n.groupCount,0)};
}
export async function loadRoadGroup(metadata,{signal}={}){
 const shard=metadata.geometryShard;
 const groups=geometryCache.get(shard)??remember(geometryCache,shard,await readJSON(`geometry/${shard}.jsonl.gz`,signal,true),2);
 signal?.throwIfAborted();const group=groups.find(group=>group.roadGroupId===metadata.roadGroupId);
 if(!group||group.features.length!==metadata.linkCount)throw new Error('선택한 도로 데이터를 찾을 수 없습니다. 다시 검색해주세요.');
 return {...metadata,featureCollection:{type:'FeatureCollection',features:group.features},linkIds:group.features.map(f=>f.properties.linkId)};
}
export function roadCoordinates(road){return road.featureCollection.features.flatMap(f=>(f.geometry.type==='MultiLineString'?f.geometry.coordinates:[f.geometry.coordinates]).flatMap(line=>line.map(([lng,lat])=>[lat,lng])));}
export const laneLabel=road=>road.laneMin==null?'차로 정보 없음':road.laneMin===road.laneMax?`${road.laneMin}차로`:`${road.laneMin}~${road.laneMax}차로`;
export const formatRegionName=name=>name.replace(/시(?=[^\s]+구$)/g,'시 ');
export const regionLabel=road=>road.regions.length?road.regions.map(formatRegionName).join(' · '):`지역 미확인 (위도 ${road.centerLat.toFixed(4)}, 경도 ${road.centerLng.toFixed(4)})`;
export const lengthLabel=road=>road.lengthMeters>=1000?`${(road.lengthMeters/1000).toFixed(2)} km`:`${Math.round(road.lengthMeters)} m`;
export function linkTooltip(p){return `${p.roadName}\n${p.regions.map(formatRegionName).join(' · ')||'지역 미확인'}\n${p.lanes==null?'차로 정보 없음':p.lanes+'차로'}\nLINK_ID: ${p.linkId}`;}
