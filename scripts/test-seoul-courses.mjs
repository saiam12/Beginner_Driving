import assert from 'node:assert/strict';
import fs from 'node:fs';
import {geometryMeters} from '../src/lib/connected-course.js';
const courses=JSON.parse(fs.readFileSync('src/data/seoul-courses.json','utf8'));
assert.equal(courses.length,6);
for(const c of courses){
 assert(c.coordinates.length>20);
 assert(c.linkIds.length>4);
 assert.deepEqual(c.coordinates[0],c.coordinates.at(-1));
 c.nodes.forEach(([from,to],i)=>assert.equal(to,c.nodes[(i+1)%c.nodes.length][0]));
 const meters=geometryMeters({type:'LineString',coordinates:c.coordinates.map(([lat,lng])=>[lng,lat])});
 assert(Math.abs(meters-c.lengthMeters)<0.01);
 assert.equal(c.distance,Number((meters/1000).toFixed(2)));
 assert(c.coordinates.every(([lat,lng])=>lat>37.50&&lat<37.62&&lng>126.88&&lng<127));
}
console.log('서울 6개 실제 도로 코스: 원본 노드 연결, 순환, 형상 거리 일치 통과');
