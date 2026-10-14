import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'vite';
import {roadDataCost} from '../src/lib/road-data-cost.js';
import {geometryMeters,exploreCourseCandidates} from '../src/lib/connected-course.js';
import {splitAtManualPoints} from '../src/lib/road-point-snap.js';
const observations=JSON.parse(await readFile('public/data/roads/accidents-2024-daegu.json','utf8'));
assert.equal(Object.keys(observations.links).length,1874);
assert.equal(Object.values(observations.links).reduce((n,r)=>n+r.count,0),6440);
const root=resolve('public');
globalThis.fetch=async(url,{signal}={})=>{signal?.throwIfAborted();const path=resolve(root,'.'+url);assert(path.startsWith(root+sep));try{return new Response(await readFile(path));}catch{return new Response('',{status:404});}};
await build({configFile:false,logLevel:'silent',define:{'import.meta.env.BASE_URL':JSON.stringify('/')},build:{lib:{entry:resolve('src/lib/lane-roads.js'),formats:['es'],fileName:()=> 'accident-loaders.mjs'},outDir:'.local/accident-tests',emptyOutDir:false,copyPublicDir:false}});
const {loadLaneRoads,laneTooltip}=await import(pathToFileURL(resolve('.local/accident-tests/accident-loaders.mjs')));
const {features}=await loadLaneRoads([128.53,35.80,128.63,35.90],null,{regional:true});
const known=features.filter(f=>!f.properties.accidentZeroAssumed);
assert(known.length>100);
for(const f of known){const p=f.properties;assert.equal(p.accidentCount,observations.links[p.linkId].count);assert(roadDataCost(p,geometryMeters(f.geometry)).accidentCost>0);}
const unknown=features.find(f=>!observations.links[f.properties.linkId]);assert(unknown);assert.equal(unknown.properties.accidentCount,0);assert(unknown.properties.accidentZeroAssumed);assert.equal(roadDataCost(unknown.properties,geometryMeters(unknown.geometry)).accidentScore,0);
assert(laneTooltip(known[0].properties).includes('2024년 사고'));
const whole=known.find(f=>f.geometry.type==='LineString'&&f.geometry.coordinates.length>2);
const split=splitAtManualPoints([whole],whole.geometry.coordinates[1],null).features;
const before=roadDataCost(whole.properties,geometryMeters(whole.geometry)).accidentCost;
const after=split.reduce((sum,f)=>sum+roadDataCost(f.properties,geometryMeters(f.geometry)).accidentCost,0);
assert(Math.abs(before-after)<1e-6,'Splitting a link must not duplicate its accident cost');
const bounds=[128.53,35.80,128.63,35.90];
const courses=exploreCourseCandidates(features,[128.58,35.85],{min:5,max:10},'loop',{bounds});
assert(courses.length>0);assert(courses.some(c=>c.costBreakdown.accidents>0));
for(const c of courses){assert(c.featureCollection.features.every(f=>!roadDataCost(f.properties,geometryMeters(f.geometry)).accidentExcluded));assert(Math.abs(c.cost-Object.values(c.costBreakdown).reduce((s,n)=>s+n,0))<1e-6);}
console.log(`PASS: ${known.length} observed links loaded, missing data treated as zero, split cost unchanged, ${courses.length} courses include accident costs`);


const density=n=>roadDataCost({accidentCount:n,accidentLengthMeters:1000,accidentPeriod:'2024',accidentReferencePeriod:'2024'},1000);
assert(!density(11).accidentExcluded);assert(density(12).accidentExcluded);
assert(roadDataCost({accidentCount:12,accidentLengthMeters:10000,accidentPeriod:'2024',accidentReferencePeriod:'2024'},100).accidentExcluded);
assert(Math.abs(density(6).accidentCost/density(3).accidentCost-3)<1e-10);
assert(Math.abs(density(9).accidentCost/density(3).accidentCost-7)<1e-10);
assert(!roadDataCost({accidentCount:2,accidentLengthMeters:8,accidentPeriod:'2024',accidentReferencePeriod:'2024'},8).accidentExcluded);
console.log('PASS: 12 annual crashes excluded, 11 allowed, 3/km exponential increments, short-link boundary');

const short=(count,length)=>roadDataCost({accidentCount:count,accidentLengthMeters:length,accidentPeriod:'2024',accidentReferencePeriod:'2024'},length);
assert(!short(2,8).accidentExcluded,'two crashes do not trigger density exclusion');
assert(short(3,100).accidentExcluded,'three crashes at exactly 30/km are excluded');
assert(!short(3,100.01).accidentExcluded,'density just below 30/km is allowed');
assert(short(11,300).accidentExcluded,'density excludes links with fewer than twelve crashes');
assert(short(12,10000).accidentExcluded,'twelve crashes exclude even a long link');
console.log('PASS: combined annual-count and density exclusion boundaries');
