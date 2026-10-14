import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {geometryMeters} from '../src/lib/connected-course.js';
const courses=JSON.parse(fs.readFileSync('src/data/seoul-courses.json','utf8'));
const needed=new Set(courses.flatMap(c=>c.linkIds)), features=new Map();
for(const x of fs.readdirSync('public/data/roads/lanes')){
 if(!fs.statSync(`public/data/roads/lanes/${x}`).isDirectory())continue;
 for(const y of fs.readdirSync(`public/data/roads/lanes/${x}`)){
  for(const line of zlib.gunzipSync(fs.readFileSync(`public/data/roads/lanes/${x}/${y}`)).toString().trim().split('\n')){
   const f=JSON.parse(line);if(needed.has(f.id))features.set(f.id,f);
  }
 }
}
assert.equal(courses.length,6);
for(const c of courses){
 assert(c.coordinates.length>20);
 assert(c.linkIds.length>4);
 assert.equal(c.identifierSystem,'level5.5');
 assert(c.linkIds.every(id=>/^\d{7}$/.test(id)));
 assert(c.costBreakdown.traffic>0);
 assert.equal(c.dataCoverage.traffic,1);
 assert.equal(c.cost,Object.values(c.costBreakdown).reduce((sum,n)=>sum+n,0));
 c.nodes.forEach(([from,to],i)=>assert.equal(to,c.nodes[(i+1)%c.nodes.length][0]));
 const source=c.linkIds.map(id=>{assert(features.has(id));return features.get(id);});
 assert.deepEqual(c.nodes,source.map(f=>[f.properties.fNode,f.properties.tNode]));
 const coordinates=[];
 source.forEach((f,i)=>{
  const next=source[(i+1)%source.length];
  assert(geometryMeters({type:'LineString',coordinates:[f.geometry.coordinates.at(-1),next.geometry.coordinates[0]]})<=60);
  for(const [lng,lat] of f.geometry.coordinates){const last=coordinates.at(-1);if(!last||last[0]!==lat||last[1]!==lng)coordinates.push([lat,lng]);}
 });
 assert.deepEqual(c.coordinates,coordinates);
 const meters=source.reduce((sum,f)=>sum+geometryMeters(f.geometry),0);
 assert(Math.abs(meters-c.lengthMeters)<0.01);
 assert.equal(c.distance,Number((meters/1000).toFixed(2)));
 assert(c.coordinates.every(([lat,lng])=>lat>37.50&&lat<37.62&&lng>126.88&&lng<127));
}
console.log('서울 6개 Level 5.5 코스: 원본 방향·노드 순환·형상 보존·구간 거리 합계·교통 비용 통과');
