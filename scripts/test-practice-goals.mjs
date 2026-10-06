import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectCourse,TURN_COSTS,geometryMeters} from '../src/lib/connected-course.js';
import {driverTurnPenalty,driverRoadPenalty,driverJunctionDiscount} from '../src/lib/driver-preferences.js';
import {classifyCourseCandidates} from '../src/lib/course-overlap.js';
const all={goals:['right','junctions','left','uturn','narrow']};
for(const type of ['right','left','uturn'])assert.equal(TURN_COSTS[type]+driverTurnPenalty(type,all),TURN_COSTS[type]*.3);
assert.equal(driverRoadPenalty(1,all),-.75);assert.equal(driverRoadPenalty(null,all),0);assert.equal(driverRoadPenalty(2,all),0);
assert.equal(driverJunctionDiscount(true,all),.15);assert.equal(driverJunctionDiscount(false,all),0);
const p={A:[126.9,37.5],B:[126.92,37.5],C:[126.92,37.52],D:[126.9,37.52],E:[126.89,37.5]};
const edge=(a,b,lanes=1)=>({properties:{linkId:a+b,fNode:a,tNode:b,lanes},geometry:{type:'LineString',coordinates:[p[a],p[b]]}});
const loop=[edge('A','B'),edge('B','C'),edge('C','D'),edge('D','A'),edge('A','E')];
const base=connectCourse(loop,p.A,{min:5,max:10},'loop',{startPoint:p.A,profile:{goals:[]}});
for(const goal of ['left','narrow','junctions']){
 const c=connectCourse(loop,p.A,{min:5,max:10},'loop',{startPoint:p.A,profile:{goals:[goal]}});
 assert(c.cost<base.cost,`${goal} must lower actual search cost`);
 assert.equal(c.lengthMeters,base.lengthMeters);assert(c.cost>=0);assert.equal(c.goalMatch.count,1);
 assert.equal(c.cost,Object.values(c.costBreakdown).reduce((a,b)=>a+b,0));
}
const both=connectCourse(loop,p.A,{min:5,max:10},'loop',{startPoint:p.A,profile:all});assert.equal(both.goalMatch.count,3);
assert(both.cost>0);assert.equal(both.costBreakdown.traffic,0);assert.equal(both.costBreakdown.accidents,0);
const route=(i,cost,count)=>({cost,goalMatch:{count},featureCollection:{features:[{properties:{linkId:`unique-${i}`},geometry:{type:'LineString',coordinates:[[126+i*.01,37],[126+i*.01,37.01]]}}]}});
const courses=[route(0,100,0),route(1,110,1),route(2,120,2),route(3,130,0),route(4,400,0),route(5,410,1),route(6,420,2),route(7,430,0),route(8,800,0),route(9,810,1),route(10,820,2),route(11,830,0)];
const selected=classifyCourseCandidates(courses,{difficultyBased:true});
assert.equal(selected.byDifficulty['쉬움'][0],2);assert.equal(selected.byDifficulty['보통'][0],6);assert.equal(selected.byDifficulty['어려움'][0],10);
assert.equal(selected.adoptedIndices.length,6);assert.equal(selected.adoptedIndices[0],2);assert(selected.adoptedIndices.includes(2)&&selected.adoptedIndices.includes(6)&&selected.adoptedIndices.includes(10));
console.log('PASS: all five practice goal discounts, observed-only eligibility, graph junctions, additive cost consistency, unchanged distance, per-difficulty and overall goal priority');

const saved=JSON.parse(fs.readFileSync('src/data/seoul-courses.json','utf8'));
for(const c of saved){
 const discounted=c.cost-Object.values(c.goalCostBasis).reduce((a,b)=>a+b,0);
 assert(discounted>0&&discounted<c.cost);
 assert.equal(c.goalCostBasis.narrow,c.practiceCounts.narrow*.75);
 assert.equal(c.goalCostBasis.right,c.practiceCounts.right*35);
 assert.equal(c.goalCostBasis.left,c.practiceCounts.left*105);
 assert.equal(c.goalCostBasis.uturn,c.practiceCounts.uturn*350);
}
console.log('PASS: saved Seoul courses carry actual goal counts and positive discounted costs');
